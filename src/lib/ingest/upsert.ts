import { IngestEventSchema, type IngestEvent, type IngestLogger } from "./types";
import { rehash } from "./normalize";
import { errorMessage, getLongDb, RPC_TIMEOUT_MS, type Db } from "./db";

/**
 * Validates, de-duplicates and writes rows through SQL `upsert_events(p_rows jsonb)`.
 * Invalid rows are counted and logged, never thrown. The batch is deduped by `source_key`
 * (first wins) and by `slug` (tags/regions union, higher popularity, first row's other fields):
 * Postgres rejects touching the same row twice in one `INSERT … ON CONFLICT`.
 */

export const CHUNK_SIZE = 500;
const MIN_SPLIT = 25;
const MAX_ERROR_SAMPLES = 20;

export type UpsertResult = {
  inserted: number;
  updated: number;
  unchanged: number;
  drifted: number;
  invalid: number;
  /** Rows that reached the database (after validation and dedupe). */
  sent: number;
  /** Rows lost to failed chunks. */
  failed: number;
  errors: string[];
};

export type PreparedBatch = {
  rows: IngestEvent[];
  invalid: number;
  dupKeys: number;
  dupSlugs: number;
  errors: string[];
};

function mergeInto(target: IngestEvent, extra: IngestEvent): void {
  target.tags = [...new Set([...target.tags, ...extra.tags])];
  target.regions = [...new Set([...target.regions, ...extra.regions])];
  target.popularity = Math.max(target.popularity, extra.popularity);
  target.featured = target.featured || extra.featured;
  if (!target.description && extra.description) target.description = extra.description;
  if (!target.end_date && extra.end_date) target.end_date = extra.end_date;
  if (!target.source_url && extra.source_url) target.source_url = extra.source_url;
  if (!target.series_slug && extra.series_slug) target.series_slug = extra.series_slug;
  target.external_ids = { ...extra.external_ids, ...target.external_ids };
  rehash(target);
}

/** Pure: zod-validate and dedupe. Exported for tests and dry runs. */
export function prepareRows(input: readonly unknown[], log?: IngestLogger): PreparedBatch {
  const byKey = new Map<string, IngestEvent>();
  const bySlug = new Map<string, IngestEvent>();
  const errors: string[] = [];
  let invalid = 0;
  let dupKeys = 0;
  let dupSlugs = 0;
  for (const candidate of input) {
    const parsed = IngestEventSchema.safeParse(candidate);
    if (!parsed.success) {
      invalid++;
      if (errors.length < MAX_ERROR_SAMPLES) {
        const slug = (candidate as { slug?: unknown })?.slug;
        const issue = parsed.error.issues[0];
        errors.push(`invalid row ${String(slug ?? "?")}: ${issue?.path.join(".")} ${issue?.message}`);
      }
      continue;
    }
    const row = parsed.data;
    if (byKey.has(row.source_key)) {
      dupKeys++;
      continue;
    }
    const sameSlug = bySlug.get(row.slug);
    if (sameSlug) {
      dupSlugs++;
      mergeInto(sameSlug, row);
      continue;
    }
    byKey.set(row.source_key, row);
    bySlug.set(row.slug, row);
  }
  if (invalid && log) log.warn(`${invalid} invalid row(s) dropped`, { sample: errors.slice(0, 3) });
  return { rows: [...bySlug.values()], invalid, dupKeys, dupSlugs, errors };
}

type Counts = { inserted: number; updated: number; unchanged: number; drifted: number };

async function sendChunk(db: Db, chunk: IngestEvent[], out: UpsertResult, log?: IngestLogger, depth = 0): Promise<void> {
  const { data, error } = await db.rpc("upsert_events", { p_rows: chunk as unknown as never });
  if (!error) {
    const r = (Array.isArray(data) ? data[0] : data) as Partial<Counts> | null | undefined;
    out.inserted += Number(r?.inserted ?? 0);
    out.updated += Number(r?.updated ?? 0);
    out.unchanged += Number(r?.unchanged ?? 0);
    out.drifted += Number(r?.drifted ?? 0);
    out.sent += chunk.length;
    return;
  }
  // One bad row rolls back the whole chunk inside plpgsql, and the bounded fetch aborts a slow
  // chunk after RPC_TIMEOUT_MS: split and retry so the good rows still land and the culprit is isolated.
  if (chunk.length > MIN_SPLIT && depth < 6) {
    log?.warn(`upsert_events failed for ${chunk.length} rows (${errorMessage(error)}); splitting`);
    const mid = Math.ceil(chunk.length / 2);
    await sendChunk(db, chunk.slice(0, mid), out, log, depth + 1);
    await sendChunk(db, chunk.slice(mid), out, log, depth + 1);
    return;
  }
  out.failed += chunk.length;
  if (out.errors.length < MAX_ERROR_SAMPLES) {
    out.errors.push(`upsert_events failed (${chunk.length} rows, e.g. ${chunk[0]?.slug}): ${errorMessage(error)}`);
  }
}

export async function upsertEvents(input: readonly unknown[], log?: IngestLogger): Promise<UpsertResult> {
  const prepared = prepareRows(input, log);
  const out: UpsertResult = {
    inserted: 0,
    updated: 0,
    unchanged: 0,
    drifted: 0,
    invalid: prepared.invalid,
    sent: 0,
    failed: 0,
    errors: [...prepared.errors],
  };
  if (prepared.rows.length === 0) return out;
  const db = await getLongDb(RPC_TIMEOUT_MS);
  for (let i = 0; i < prepared.rows.length; i += CHUNK_SIZE) {
    await sendChunk(db, prepared.rows.slice(i, i + CHUNK_SIZE), out, log);
  }
  return out;
}
