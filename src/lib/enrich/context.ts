/**
 * Shared runtime context for the enrichment workers: polite HTTP, a logger and the run's time
 * budget. Same conventions as the ingest runner (`src/lib/ingest/run.ts`) — descriptive
 * User-Agent on every call (Wikimedia 403s without one), per-host spacing, retries clamped to the
 * remaining budget.
 */
import { createHttp } from "@/lib/ingest/http";
import type { IngestHttp, IngestLogger } from "@/lib/ingest/types";

/**
 * Wikimedia's API etiquette: serial requests, ≤ 200 req/min with a compliant UA. 350 ms of
 * spacing keeps us at ~170 req/min with headroom, and the bucket in `http.ts` is per host, so
 * en.wikipedia, commons and wikidata each get their own lane.
 */
export const WIKIMEDIA_INTERVAL_MS = 350;
/** JPL-style "one request at a time" politeness for the NASA library (rate limit undocumented). */
export const NASA_INTERVAL_MS = 1_000;

export type EnrichContext = {
  http: IngestHttp;
  log: IngestLogger;
  budget: { remainingMs: () => number };
  /** `?dry=1`: resolve and report, write nothing to the database or Storage. */
  dryRun: boolean;
};

export function makeLogger(scope: string): IngestLogger {
  const prefix = `[enrich:${scope}]`;
  const fmt = (msg: string, extra?: Record<string, unknown>) =>
    extra ? `${prefix} ${msg} ${JSON.stringify(extra)}` : `${prefix} ${msg}`;
  return {
    info: (msg, extra) => console.log(fmt(msg, extra)),
    warn: (msg, extra) => console.warn(fmt(msg, extra)),
    error: (msg, extra) => console.error(fmt(msg, extra)),
  };
}

export function makeContext(options: { deadline: number; dryRun?: boolean; scope?: string; log?: IngestLogger }): EnrichContext {
  const budget = { remainingMs: () => options.deadline - Date.now() };
  const log = options.log ?? makeLogger(options.scope ?? "run");
  const http: IngestHttp = createHttp(
    { timeoutMs: 15_000, maxRetries: 2, minIntervalMs: WIKIMEDIA_INTERVAL_MS, remainingMs: budget.remainingMs },
    log,
  );
  return { http, log, budget, dryRun: options.dryRun ?? false };
}
