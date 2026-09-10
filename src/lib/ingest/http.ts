import type { HttpInit, IngestHttp, IngestLogger } from "./types";

/**
 * Polite HTTP for adapters: descriptive User-Agent (Wikimedia returns 403 without one),
 * hard timeout via AbortSignal.timeout clamped to the run's remaining budget, a per-host token
 * bucket (`minIntervalMs`), retries with exponential backoff + jitter (only when they fit the
 * budget), `Retry-After` honoured on 429/503, retries hard-capped.
 */

export const DEFAULT_USER_AGENT = "UntilCountdowns/2.0 (https://github.com/danyeldev/until-countdowns; catalog ingest)";

export function userAgent(): string {
  return process.env.INGEST_USER_AGENT || DEFAULT_USER_AGENT;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    message?: string,
  ) {
    super(message ?? `HTTP ${status} for ${url}`);
    this.name = "HttpError";
  }
}

/** Thrown when the run's time budget cannot accommodate (another) request; never retried. */
export class BudgetExceededError extends Error {
  constructor(
    public readonly url: string,
    public readonly remainingMs: number,
  ) {
    super(`budget exhausted (${Math.max(0, Math.round(remainingMs))} ms left) before ${url}`);
    this.name = "BudgetExceededError";
  }
}

export function isBudgetExceeded(err: unknown): err is BudgetExceededError {
  return err instanceof BudgetExceededError || (err instanceof Error && err.name === "BudgetExceededError");
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_RETRIES_CAP = 6;
const MAX_WAIT_MS = 60_000;
/** A request is not started with less than this much budget left. */
const MIN_REQUEST_MS = 1_000;

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Per-host spacing: the next request to a host starts no sooner than `minIntervalMs` after the previous one started. */
class HostBucket {
  private nextAt = new Map<string, number>();

  async take(host: string, minIntervalMs: number): Promise<void> {
    if (minIntervalMs <= 0) return;
    const now = Date.now();
    const at = Math.max(now, this.nextAt.get(host) ?? 0);
    this.nextAt.set(host, at + minIntervalMs);
    if (at > now) await sleep(at - now);
  }
}

const bucket = new HostBucket();

export function retryAfterMs(res: Response): number | null {
  const header = res.headers.get("retry-after");
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(header);
  return Number.isNaN(at) ? null : Math.max(0, at - Date.now());
}

export function backoffMs(attempt: number, base = 1000): number {
  const exp = Math.min(MAX_WAIT_MS, base * 2 ** attempt);
  return Math.round(exp * (0.5 + Math.random()));
}

export type HttpDefaults = {
  timeoutMs: number;
  maxRetries: number;
  minIntervalMs: number;
  /**
   * Remaining run budget in ms (the runner's `ctx.budget.remainingMs`). Every attempt's timeout is
   * clamped to it, a retry that would not fit is not started, and an attempt cut off by the
   * deadline surfaces as `BudgetExceededError` instead of a generic timeout.
   */
  remainingMs?: () => number;
};

export function createHttp(defaults: Partial<HttpDefaults> = {}, log?: IngestLogger): IngestHttp {
  const d: HttpDefaults = { timeoutMs: 20_000, maxRetries: 3, minIntervalMs: 0, ...defaults };
  const remaining = (): number => (d.remainingMs ? d.remainingMs() : Number.POSITIVE_INFINITY);

  async function request(url: string, init: HttpInit, accept: string): Promise<Response> {
    const host = new URL(url).host;
    const retries = Math.min(MAX_RETRIES_CAP, init.maxRetries ?? d.maxRetries);
    const timeoutMs = init.timeoutMs ?? d.timeoutMs;
    const spacing = init.minIntervalMs ?? d.minIntervalMs;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (remaining() < MIN_REQUEST_MS) throw new BudgetExceededError(url, remaining());
      await bucket.take(host, spacing);
      const left = remaining();
      if (left < MIN_REQUEST_MS) throw new BudgetExceededError(url, left);
      const budgetBound = left < timeoutMs;
      try {
        const res = await fetch(url, {
          method: init.method ?? "GET",
          body: init.body,
          headers: { "User-Agent": userAgent(), Accept: accept, ...(init.headers ?? {}) },
          signal: AbortSignal.timeout(Math.min(timeoutMs, left)),
          redirect: "follow",
        });
        if (res.ok) return res;
        const err = new HttpError(res.status, url);
        if (!RETRYABLE.has(res.status) || attempt === retries) {
          await res.body?.cancel().catch(() => undefined);
          throw err;
        }
        const wait = Math.min(MAX_WAIT_MS, Math.max(retryAfterMs(res) ?? 0, backoffMs(attempt, 1500)));
        await res.body?.cancel().catch(() => undefined);
        lastErr = err;
        if (remaining() < wait + MIN_REQUEST_MS) throw new BudgetExceededError(url, remaining());
        log?.warn(`http ${res.status} from ${host}; retry ${attempt + 1}/${retries} in ${wait}ms`, { url });
        await sleep(wait);
      } catch (err) {
        if (err instanceof HttpError || isBudgetExceeded(err)) throw err;
        // An abort that fired because the budget (not the per-request timeout) ran out is not a
        // transient failure of the remote: report it as such so the runner keeps the cursor.
        if (budgetBound && (err as Error)?.name === "TimeoutError" && remaining() < MIN_REQUEST_MS) {
          throw new BudgetExceededError(url, remaining());
        }
        lastErr = err;
        if (attempt === retries) break;
        const wait = backoffMs(attempt, 500);
        if (remaining() < wait + MIN_REQUEST_MS) throw new BudgetExceededError(url, remaining());
        log?.warn(`http error from ${host}: ${(err as Error)?.message ?? err}; retry ${attempt + 1}/${retries} in ${wait}ms`, {
          url,
        });
        await sleep(wait);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(`request failed: ${url}`);
  }

  return {
    async fetchJson<T>(url: string, init: HttpInit = {}): Promise<T> {
      const res = await request(url, init, init.headers?.Accept ?? "application/json");
      return (await res.json()) as T;
    },
    async fetchText(url: string, init: HttpInit = {}): Promise<string> {
      const res = await request(url, init, init.headers?.Accept ?? "text/html, text/plain;q=0.9, */*;q=0.5");
      return await res.text();
    },
  };
}

export type PoolResult<R> = { ok: true; value: R } | { ok: false; error: unknown };

/** Run `fn` over `items` with at most `concurrency` in flight; never rejects, each slot records its own outcome. */
export async function pool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PoolResult<R>[]> {
  const out: PoolResult<R>[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = { ok: true, value: await fn(items[i], i) };
      } catch (error) {
        out[i] = { ok: false, error };
      }
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: n }, worker));
  return out;
}
