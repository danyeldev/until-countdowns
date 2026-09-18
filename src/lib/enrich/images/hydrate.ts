/**
 * Turn a just-ingested event's licensed candidate (or the discovery chain) into R2 objects.
 * Called from the scrape/upsert path so a new row does not wait for `/api/cron/enrich` —
 * that queue only claims featured / high-popularity / series rows, which left hundreds of
 * adapter candidates sitting at `image_status = pending` with no job.
 */
import { errorMessage, getDb, type Db } from "@/lib/ingest/db";
import { isBudgetExceeded } from "@/lib/ingest/http";
import { makeContext } from "../context";
import {
  attachImageToEvent,
  attachImageToSeries,
  isPermanentImageError,
  markImageFailed,
  markImageSkipped,
  storeLicensedImage,
} from "./process";
import { resolveImages, type ResolvableEvent } from "./resolve";

export const HYDRATE_MIN_MS = 20_000;
export const HYDRATE_PER_EVENT_MS = 3_500;
export const HYDRATE_MAX_EVENTS = 8;

export type HydrateSummary = {
  inspected: number;
  created: number;
  reused: number;
  skipped: number;
  failed: number;
  errors: string[];
};

type EventRow = ResolvableEvent & { series_slug: string | null; image_id: string | null };

const COLUMNS =
  "id, slug, title, category, tags, external_ids, source_url, series_slug, image_id, image_candidate_url, image_candidate_meta";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function loadBySlugs(db: Db, slugs: readonly string[]): Promise<EventRow[]> {
  if (slugs.length === 0) return [];
  const { data, error } = await db.from("events").select(COLUMNS).in("slug", [...slugs]);
  if (error) throw new Error(`events read failed: ${error.message}`);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title ?? ""),
    category: String(row.category ?? ""),
    tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string") : [],
    external_ids: asRecord(row.external_ids),
    source_url: typeof row.source_url === "string" ? row.source_url : null,
    series_slug: typeof row.series_slug === "string" ? row.series_slug : null,
    image_id: typeof row.image_id === "string" ? row.image_id : null,
    image_candidate_url: typeof row.image_candidate_url === "string" ? row.image_candidate_url : null,
    image_candidate_meta: row.image_candidate_meta ? asRecord(row.image_candidate_meta) : null,
  }));
}

export function slugsNeedingImages(rows: ReadonlyArray<{ slug: string; image_candidate_url?: string | null }>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    if (!row.image_candidate_url || seen.has(row.slug)) continue;
    seen.add(row.slug);
    out.push(row.slug);
  }
  return out;
}

/**
 * Resolve and store images for the given slugs. Skips rows that already have an `image_id`.
 * Budget is wall-clock: Wikimedia spacing plus sharp is ~3.5 s per new file.
 */
export async function hydrateEventImages(
  slugs: readonly string[],
  options: { budgetMs?: number; db?: Db; dryRun?: boolean } = {},
): Promise<HydrateSummary> {
  const summary: HydrateSummary = { inspected: 0, created: 0, reused: 0, skipped: 0, failed: 0, errors: [] };
  const unique = [...new Set(slugs.filter(Boolean))].slice(0, HYDRATE_MAX_EVENTS);
  if (unique.length === 0) return summary;

  const budgetMs = options.budgetMs ?? unique.length * HYDRATE_PER_EVENT_MS + 8_000;
  const ctx = makeContext({ deadline: Date.now() + budgetMs, dryRun: options.dryRun, scope: "hydrate" });
  const db = options.db ?? (await getDb());
  const rows = (await loadBySlugs(db, unique)).filter((row) => !row.image_id);
  summary.inspected = rows.length;
  if (rows.length === 0) return summary;

  const resolutions = await resolveImages(ctx, rows);
  for (const row of rows) {
    if (ctx.budget.remainingMs() < HYDRATE_MIN_MS) break;
    const resolution = resolutions.get(row.id);
    if (!resolution) continue;
    if (!resolution.ok) {
      if (!options.dryRun) await markImageSkipped(db, row.id);
      summary.skipped++;
      continue;
    }
    if (options.dryRun) {
      summary.created++;
      continue;
    }
    try {
      const stored = await storeLicensedImage(db, resolution.image);
      if (stored.reused) summary.reused++;
      else summary.created++;
      await attachImageToEvent(db, row.id, stored.imageId);
      if (row.series_slug) await attachImageToSeries(db, row.series_slug, stored.imageId);
    } catch (err) {
      if (isBudgetExceeded(err)) break;
      if (isPermanentImageError(err)) {
        await markImageSkipped(db, row.id).catch(() => undefined);
        summary.skipped++;
        continue;
      }
      await markImageFailed(db, row.id).catch(() => undefined);
      summary.failed++;
      if (summary.errors.length < 8) summary.errors.push(`${row.slug}: ${errorMessage(err)}`);
    }
  }
  return summary;
}
