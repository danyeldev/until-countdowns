/**
 * `enrichment_jobs` queue helpers shared by both enrichment kinds.
 *
 * Claiming goes through the SQL `claim_enrichment_jobs(kind, limit)` (FOR UPDATE SKIP LOCKED),
 * which already bumps `attempts` and pushes `next_attempt_at` 30 minutes out, so a crashed run
 * never wedges a job: the worst case is one retry half an hour later. This module only writes the
 * *outcome* back:
 *
 * - `done`     — the job did its work (summary written, image stored).
 * - `skipped`  — nothing to do and nothing to retry (no licensed candidate, description already
 *                good enough, event gone). Terminal; the reason is kept in `last_error`.
 * - retry      — a transient failure: the row stays `pending` with `next_attempt_at = now +
 *                min(2^attempts hours, 7 days)`; after `MAX_ATTEMPTS` it becomes `failed`.
 *
 * Every statement carries a `WHERE` (PostgREST runs pg-safeupdate, which rejects unfiltered
 * UPDATEs).
 */
import type { Db } from "@/lib/ingest/db";

export type EnrichKind = "wikipedia_summary" | "image";

export const ENRICH_KINDS: readonly EnrichKind[] = ["wikipedia_summary", "image"] as const;

export function isEnrichKind(value: string | null | undefined): value is EnrichKind {
  return value === "wikipedia_summary" || value === "image";
}

export type EnrichJob = {
  id: number;
  kind: EnrichKind;
  event_id: string;
  attempts: number;
  /** Last recorded failure, if any. `null` means every attempt so far was a wasted claim. */
  last_error: string | null;
};

/** After this many attempts a job stops being retried and is parked as `failed`. */
export const MAX_ATTEMPTS = 6;
/** `last_error` is a plain text column; long upstream errors are cut so one row cannot bloat. */
export const MAX_ERROR_CHARS = 500;

const HOUR_MS = 3_600_000;
const MAX_BACKOFF_MS = 7 * 24 * HOUR_MS;

/** `now + min(2^attempts hours, 7 days)`, as an ISO timestamp. */
export function backoffUntil(attempts: number, now: number = Date.now()): string {
  const steps = Math.max(0, Math.min(attempts, 20));
  return new Date(now + Math.min(MAX_BACKOFF_MS, HOUR_MS * 2 ** steps)).toISOString();
}

export function truncateError(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length > MAX_ERROR_CHARS ? `${clean.slice(0, MAX_ERROR_CHARS - 1)}…` : clean;
}

/** Claim up to `limit` due jobs of one kind. Returns [] when the queue is empty. */
export async function claimJobs(db: Db, kind: EnrichKind, limit: number): Promise<EnrichJob[]> {
  const { data, error } = await db.rpc("claim_enrichment_jobs", { p_kind: kind, p_limit: limit });
  if (error) throw new Error(`claim_enrichment_jobs(${kind}) failed: ${error.message}`);
  const rows = (data ?? []) as Array<{ id: number; kind: string; event_id: string; attempts: number; last_error: string | null }>;
  return rows
    .filter((r) => isEnrichKind(r.kind))
    .map((r) => ({
      id: r.id,
      kind: r.kind as EnrichKind,
      event_id: r.event_id,
      attempts: r.attempts ?? 0,
      last_error: r.last_error ?? null,
    }));
}

/** Terminal outcome: `done` or `skipped` (the reason of a skip is kept for the next operator). */
export async function finishJob(db: Db, jobId: number, status: "done" | "skipped", note?: string | null): Promise<void> {
  const { error } = await db
    .from("enrichment_jobs")
    .update({ status, last_error: note ? truncateError(note) : null })
    .eq("id", jobId);
  if (error) throw new Error(`enrichment_jobs update (${status}) failed: ${error.message}`);
}

/**
 * Transient failure: keep the job `pending` with an exponential backoff, or park it as `failed`
 * once it has burned `MAX_ATTEMPTS`. Returns the status actually written.
 *
 * `attempts` counts *claims*, not failures — `claim_enrichment_jobs` bumps it, and a run that
 * claims more work than its budget can do leaves the tail of the batch untouched with the counter
 * already raised. So a job is only parked as `failed` when it has also failed before (a
 * `last_error` from an earlier run): otherwise a first genuine hiccup after six wasted claims
 * would retire a job that never actually failed.
 */
export async function retryJob(db: Db, job: EnrichJob, message: string, now: number = Date.now()): Promise<"pending" | "failed"> {
  const status = job.attempts >= MAX_ATTEMPTS && job.last_error ? "failed" : "pending";
  const { error } = await db
    .from("enrichment_jobs")
    .update({ status, last_error: truncateError(message), next_attempt_at: backoffUntil(job.attempts, now) })
    .eq("id", job.id);
  if (error) throw new Error(`enrichment_jobs update (retry) failed: ${error.message}`);
  return status;
}
