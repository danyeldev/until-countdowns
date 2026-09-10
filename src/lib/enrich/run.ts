/**
 * The enrichment worker behind `GET /api/cron/enrich`.
 *
 * Claims jobs of each requested kind with `claim_enrichment_jobs` (FOR UPDATE SKIP LOCKED, so two
 * overlapping invocations never fight over the same row), enriches them under a wall-clock
 * budget, and reports which event slugs changed so the caller can invalidate their cache tags.
 *
 * Ordering inside a run matters for politeness, not for correctness: the batched Wikimedia
 * lookups happen once per kind, and image downloads are serial (the thumb host asks for a
 * concurrency of at most two, and sharp is CPU-bound anyway).
 */
import type { Json } from "@/lib/db/database.types";
import { errorMessage, getDb, type Db } from "@/lib/ingest/db";
import { isBudgetExceeded } from "@/lib/ingest/http";
import { makeContext, type EnrichContext } from "./context";
import { claimJobs, type EnrichJob, type EnrichKind, finishJob, retryJob } from "./jobs";
import {
  attachImageToEvent,
  attachImageToSeries,
  isPermanentImageError,
  markImageFailed,
  markImageSkipped,
  storeLicensedImage,
} from "./images/process";
import { resolveImages, type ResolvableEvent } from "./images/resolve";
import { RECHECK_LIMIT, runRecheck } from "./recheck";
import { enrichSummary, type EnrichableEvent } from "./wikipedia";

export const DEFAULT_BUDGET_MS = 240_000;
export const DEFAULT_LIMIT = 60;
export const MAX_LIMIT = 200;
/** Stop claiming (and stop starting new events) with less than this much of the budget left. */
const MIN_WORK_MS = 12_000;
/**
 * Measured wall-clock cost of one job, used to size a claim to the budget that is actually left.
 * `claim_enrichment_jobs` bumps `attempts` on everything it hands out, so claiming 60 image jobs
 * for a slice that can only do 40 does not just waste the run: it ages 20 jobs by half an hour and
 * pushes them a step closer to the attempt cap without them ever having failed.
 */
const COST_MS: Record<EnrichKind, number> = { wikipedia_summary: 2_500, image: 3_500 };
/** Cap on the per-run tag list handed back to the route. */
export const MAX_CHANGED_TAGS = 50;

const EVENT_COLUMNS =
  "id, slug, title, description, summary, category, tags, external_ids, source_url, series_slug, image_id, image_candidate_url, image_candidate_meta";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  summary: string | null;
  category: string;
  tags: string[] | null;
  external_ids: Json;
  source_url: string | null;
  series_slug: string | null;
  image_id: string | null;
  image_candidate_url: string | null;
  image_candidate_meta: Json;
};

/** `recheck` is not an `enrichment_jobs` kind (see `recheck.ts`); it is a pass over `images`. */
export type RunKind = EnrichKind | "recheck";

export function isRunKind(value: string | null | undefined): value is RunKind {
  return value === "wikipedia_summary" || value === "image" || value === "recheck";
}

export type EnrichOptions = {
  kinds: RunKind[];
  limit: number;
  dryRun: boolean;
  /** Enrich exactly this event, ignoring the queue (testing hook, `?slug=`). */
  slug?: string;
  budgetMs: number;
};

export type EnrichSummary = {
  ok: boolean;
  dry: boolean;
  claimed: number;
  done: number;
  skipped: number;
  failed: number;
  images_created: number;
  images_reused: number;
  /** Licence re-checks: files still free, files re-licensed, files dropped from the bucket. */
  rechecked: number;
  relicensed: number;
  dropped: number;
  durations: Record<string, number>;
  /** Slugs whose row changed, capped by the caller before being turned into cache tags. */
  changed: string[];
  errors: string[];
};

function asRecord(value: Json | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toEnrichable(row: EventRow): EnrichableEvent {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    summary: row.summary,
    source_url: row.source_url,
    external_ids: asRecord(row.external_ids),
  };
}

function toResolvable(row: EventRow): ResolvableEvent {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    tags: row.tags ?? [],
    external_ids: asRecord(row.external_ids),
    source_url: row.source_url,
    image_candidate_url: row.image_candidate_url,
    image_candidate_meta: row.image_candidate_meta ? asRecord(row.image_candidate_meta) : null,
  };
}

async function loadEvents(db: Db, ids: readonly string[]): Promise<Map<string, EventRow>> {
  const out = new Map<string, EventRow>();
  if (ids.length === 0) return out;
  const { data, error } = await db.from("events").select(EVENT_COLUMNS).in("id", [...ids]);
  if (error) throw new Error(`events read failed: ${error.message}`);
  for (const row of (data ?? []) as unknown as EventRow[]) out.set(row.id, row);
  return out;
}

async function loadEventBySlug(db: Db, slug: string): Promise<EventRow | null> {
  const { data, error } = await db.from("events").select(EVENT_COLUMNS).eq("slug", slug).maybeSingle();
  if (error) throw new Error(`events read failed: ${error.message}`);
  return (data as unknown as EventRow) ?? null;
}

// ---------------------------------------------------------------------------
// Per-kind workers. Both take an optional job: with `?slug=` there is none, and the
// outcome is reported without touching the queue.
// ---------------------------------------------------------------------------

type Tally = {
  done: number;
  skipped: number;
  failed: number;
  images_created: number;
  images_reused: number;
  changed: Set<string>;
  errors: string[];
};

function pushError(tally: Tally, message: string): void {
  if (tally.errors.length < 10) tally.errors.push(message);
}

async function settle(
  db: Db,
  tally: Tally,
  job: EnrichJob | null,
  outcome: "done" | "skipped",
  note: string | null,
  dryRun: boolean,
): Promise<void> {
  if (outcome === "done") tally.done++;
  else tally.skipped++;
  if (job && !dryRun) await finishJob(db, job.id, outcome, note);
}

async function failOne(db: Db, tally: Tally, job: EnrichJob | null, slug: string, err: unknown, dryRun: boolean): Promise<void> {
  tally.failed++;
  const message = errorMessage(err);
  pushError(tally, `${slug}: ${message}`);
  if (job && !dryRun) await retryJob(db, job, message);
}

async function runSummaries(
  db: Db,
  ctx: EnrichContext,
  rows: Array<{ row: EventRow; job: EnrichJob | null }>,
  tally: Tally,
  dryRun: boolean,
): Promise<void> {
  for (const { row, job } of rows) {
    if (ctx.budget.remainingMs() < MIN_WORK_MS) break;
    try {
      const outcome = await enrichSummary(ctx, toEnrichable(row));
      if (outcome.patch && !dryRun) {
        const patch: Record<string, unknown> = { external_ids: outcome.patch.external_ids as Json };
        if (outcome.patch.summary) patch.summary = outcome.patch.summary;
        const { error } = await db.from("events").update(patch as never).eq("id", row.id);
        if (error) throw new Error(`events summary update failed: ${error.message}`);
      }
      if (outcome.status === "done") tally.changed.add(row.slug);
      await settle(db, tally, job, outcome.status, outcome.status === "skipped" ? outcome.reason : null, dryRun);
    } catch (err) {
      if (isBudgetExceeded(err)) break;
      await failOne(db, tally, job, row.slug, err, dryRun);
    }
  }
}

async function runImages(
  db: Db,
  ctx: EnrichContext,
  rows: Array<{ row: EventRow; job: EnrichJob | null }>,
  tally: Tally,
  dryRun: boolean,
): Promise<void> {
  const resolutions = await resolveImages(ctx, rows.map(({ row }) => toResolvable(row)));
  for (const { row, job } of rows) {
    if (ctx.budget.remainingMs() < MIN_WORK_MS) break;
    const resolution = resolutions.get(row.id);
    if (!resolution) continue; // out of budget before this event was reached: leave it pending.
    if (!resolution.ok) {
      if (!dryRun) await markImageSkipped(db, row.id);
      await settle(db, tally, job, "skipped", resolution.reason, dryRun);
      continue;
    }
    if (dryRun) {
      await settle(db, tally, job, "done", null, dryRun);
      continue;
    }
    try {
      const stored = await storeLicensedImage(db, resolution.image);
      if (stored.reused) tally.images_reused++;
      else tally.images_created++;
      // A curated image already on the row wins: `attachImageToEvent` only fills a null.
      if (!row.image_id) await attachImageToEvent(db, row.id, stored.imageId);
      if (row.series_slug) await attachImageToSeries(db, row.series_slug, stored.imageId);
      tally.changed.add(row.slug);
      await settle(db, tally, job, "done", null, dryRun);
    } catch (err) {
      if (isBudgetExceeded(err)) break;
      // A file that is too big, too small or not an image will never process: park the job.
      if (isPermanentImageError(err)) {
        await markImageSkipped(db, row.id).catch(() => undefined);
        await settle(db, tally, job, "skipped", errorMessage(err), dryRun);
        continue;
      }
      await markImageFailed(db, row.id).catch(() => undefined);
      await failOne(db, tally, job, row.slug, err, dryRun);
    }
  }
}

// ---------------------------------------------------------------------------

export async function runEnrichment(options: EnrichOptions): Promise<EnrichSummary> {
  const started = Date.now();
  const deadline = started + options.budgetMs;
  const db = await getDb();
  const tally: Tally = { done: 0, skipped: 0, failed: 0, images_created: 0, images_reused: 0, changed: new Set(), errors: [] };
  const durations: Record<string, number> = {};
  let claimed = 0;
  let rechecked = 0;
  let relicensed = 0;
  let dropped = 0;

  // Alternate the order of the queue kinds run to run: images were always second, so a summary
  // batch that ran long meant image jobs were claimed and then abandoned every single time.
  const kinds = [...options.kinds];
  if (kinds.length > 1 && Math.floor(started / 600_000) % 2 === 1) kinds.reverse();

  for (const kind of kinds) {
    if (Date.now() > deadline - MIN_WORK_MS) break;
    const kindStarted = Date.now();
    const ctx = makeContext({ deadline, dryRun: options.dryRun, scope: kind });

    if (kind === "recheck") {
      const summary = await runRecheck(db, ctx, {
        limit: options.limit === DEFAULT_LIMIT ? RECHECK_LIMIT : options.limit,
        dryRun: options.dryRun,
      });
      rechecked += summary.checked;
      relicensed += summary.relicensed;
      dropped += summary.dropped;
      for (const slug of summary.changed) tally.changed.add(slug);
      for (const message of summary.errors) pushError(tally, message);
      durations[kind] = Date.now() - kindStarted;
      continue;
    }

    let rows: Array<{ row: EventRow; job: EnrichJob | null }> = [];

    if (options.slug) {
      const row = await loadEventBySlug(db, options.slug);
      if (!row) {
        tally.errors.push(`slug not found: ${options.slug}`);
        durations[kind] = Date.now() - kindStarted;
        continue;
      }
      rows = [{ row, job: null }];
    } else {
      // Claim only what the remaining budget can actually work through.
      const affordable = Math.floor((deadline - Date.now()) / COST_MS[kind]);
      const slice = Math.max(1, Math.min(options.limit, affordable));
      const jobs = await claimJobs(db, kind, slice);
      claimed += jobs.length;
      if (jobs.length === 0) {
        durations[kind] = Date.now() - kindStarted;
        continue;
      }
      const events = await loadEvents(
        db,
        jobs.map((j) => j.event_id),
      );
      for (const job of jobs) {
        const row = events.get(job.event_id);
        if (!row) {
          // The event was deleted between the queue insert and now: the job is dead, not failed.
          tally.skipped++;
          if (!options.dryRun) await finishJob(db, job.id, "skipped", "event no longer exists");
          continue;
        }
        rows.push({ row, job });
      }
    }

    if (kind === "wikipedia_summary") await runSummaries(db, ctx, rows, tally, options.dryRun);
    else await runImages(db, ctx, rows, tally, options.dryRun);
    durations[kind] = Date.now() - kindStarted;
  }

  durations.total = Date.now() - started;
  return {
    ok: tally.failed === 0,
    dry: options.dryRun,
    claimed,
    done: tally.done,
    skipped: tally.skipped,
    failed: tally.failed,
    images_created: tally.images_created,
    images_reused: tally.images_reused,
    rechecked,
    relicensed,
    dropped,
    durations,
    changed: [...tally.changed],
    errors: tally.errors,
  };
}
