import { createHttp, isBudgetExceeded, sleep } from "./http";
import { errorMessage, getDb, getLongDb, RPC_TIMEOUT_MS, type Db } from "./db";
import { revalidateCatalog } from "./revalidate";
import { loadAdapter } from "./sources/index";
import { prepareRows, upsertEvents } from "./upsert";
import type { Adapter, IngestContext, IngestEvent, IngestLogger, Json, RunSummary, Unit } from "./types";

/**
 * Runs one source: lease → ingest_runs row → resumable plan/run/upsert loop under a time budget →
 * stale marking after a complete pass → lease release. See README "Ingestion".
 *
 * Budget: the deadline is `started + budgetMs - margin`. It is checked before and after every
 * unit, and — through `ctx.budget.remainingMs()` — inside the HTTP layer, which clamps every
 * request timeout to the remaining budget and refuses retries that would not fit. A unit cut
 * short by the deadline is not a failure of the source: the run ends `partial` with the cursor
 * still pointing at that unit, and the next invocation retries it with a fresh budget (unless it
 * was the only unit of this run, in which case it is recorded as failed and skipped so the pass
 * always makes progress).
 */

export type RunOptions = {
  budgetMs?: number;
  trigger?: "cron" | "manual";
  force?: boolean;
  dryRun?: boolean;
};

const DEFAULT_BUDGET_MS = 240_000;
/** Reserved for the work after the last unit (upsert of its rows, state writes, stale marking). */
const SAFETY_MARGIN_MS = 15_000;
const LEASE_MIN_MS = 10 * 60_000;
const MAX_UNIT_ERRORS_KEPT = 20;
const MAX_CONSECUTIVE_UNIT_FAILURES = 3;
const BACKOFF_BASE_MS = 60 * 60_000;
const BACKOFF_CAP_MS = 24 * 60 * 60_000;
const SAMPLE_ROWS = 5;

type StateRow = {
  cursor: Json | null;
  pass_started_at: string | null;
  backoff_until: string | null;
  consecutive_failures: number;
};

function makeLogger(source: string): IngestLogger {
  const prefix = `[ingest:${source}]`;
  const fmt = (msg: string, extra?: Record<string, unknown>) => (extra ? `${prefix} ${msg} ${JSON.stringify(extra)}` : `${prefix} ${msg}`);
  return {
    info: (msg, extra) => console.log(fmt(msg, extra)),
    warn: (msg, extra) => console.warn(fmt(msg, extra)),
    error: (msg, extra) => console.error(fmt(msg, extra)),
  };
}

function budgetFromEnv(): number {
  const n = Number(process.env.INGEST_BUDGET_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_BUDGET_MS;
}

async function readState(db: Db, source: string): Promise<StateRow | null> {
  const { data, error } = await db
    .from("ingest_state")
    .select("cursor, pass_started_at, backoff_until, consecutive_failures")
    .eq("source", source)
    .maybeSingle();
  if (error) throw new Error(`ingest_state read failed: ${error.message}`);
  return (data as StateRow | null) ?? null;
}

async function writeState(db: Db, source: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await db
    .from("ingest_state")
    .update({ ...patch, updated_at: new Date().toISOString() } as never)
    .eq("source", source);
  if (error) throw new Error(`ingest_state update failed: ${error.message}`);
}

function skipped(base: RunSummary, reason: RunSummary["reason"]): RunSummary {
  return { ...base, status: "skipped", reason, duration_ms: Date.now() - Date.parse(base.started_at) };
}

/** Skipped runs get an `ingest_runs` row too, so `/api/cron/status` shows lease collisions and backoffs. */
async function recordSkipped(db: Db | null, summary: RunSummary, log: IngestLogger): Promise<RunSummary> {
  if (summary.dryRun) return summary;
  try {
    const client = db ?? (await getDb());
    const { error } = await client.from("ingest_runs").insert({
      source: summary.source,
      trigger: summary.trigger,
      status: "skipped",
      finished_at: new Date().toISOString(),
      errors: [{ message: `skipped: ${summary.reason ?? "unknown"}` }],
      duration_ms: summary.duration_ms,
    } as never);
    if (error) log.warn(`ingest_runs insert (skipped) failed: ${error.message}`);
  } catch (err) {
    log.warn(`ingest_runs insert (skipped) failed: ${errorMessage(err)}`);
  }
  return summary;
}

export async function runSource(id: string, opts: RunOptions = {}): Promise<RunSummary> {
  const started = Date.now();
  const trigger = opts.trigger ?? "manual";
  const dryRun = Boolean(opts.dryRun);
  const force = Boolean(opts.force);
  const budgetMs = opts.budgetMs ?? budgetFromEnv();
  const log = makeLogger(id);
  const summary: RunSummary = {
    source: id,
    status: "ok",
    trigger,
    dryRun,
    runId: null,
    started_at: new Date(started).toISOString(),
    duration_ms: 0,
    units: 0,
    fetched: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    drifted: 0,
    invalid: 0,
    validated: 0,
    errors: [],
    cursor: null,
  };

  let adapter: Adapter;
  try {
    adapter = await loadAdapter(id);
  } catch (err) {
    log.error(errorMessage(err));
    return emit({ ...skipped(summary, "unknown"), errors: [{ message: errorMessage(err) }] });
  }
  if (!adapter.isConfigured()) return emit(await recordSkipped(null, skipped(summary, "unconfigured"), log));

  const db = await getDb();
  const state = await readState(db, id);
  if (!force && !dryRun && state?.backoff_until && Date.parse(state.backoff_until) > started) {
    log.warn(`in backoff until ${state.backoff_until}`);
    return emit(await recordSkipped(db, skipped(summary, "backoff"), log));
  }

  let lease: string | null = null;
  if (!dryRun) {
    const ttlMs = Math.max(LEASE_MIN_MS, budgetMs + 60_000);
    const { data, error } = await db.rpc("acquire_source_lease", { p_source: id, p_ttl: `${Math.ceil(ttlMs / 1000)} seconds` });
    if (error) throw new Error(`acquire_source_lease failed: ${error.message}`);
    lease = (data as string | null) ?? null;
    if (!lease) return emit(await recordSkipped(db, skipped(summary, "leased"), log));
  }

  const deadline = started + budgetMs - Math.min(SAFETY_MARGIN_MS, Math.floor(budgetMs / 4));
  const remainingMs = () => Math.max(0, deadline - Date.now());
  const ctx: IngestContext = {
    http: createHttp(
      { timeoutMs: adapter.limits.timeoutMs, maxRetries: adapter.limits.maxRetries, minIntervalMs: adapter.limits.minIntervalMs, remainingMs },
      log,
    ),
    log,
    now: new Date(started),
    budget: { remainingMs },
    dryRun,
  };

  const unitErrors: RunSummary["errors"] = [];
  const sample: IngestEvent[] = [];
  let cursor: Json | null = force ? null : (state?.cursor ?? null);
  let passStartedAt = force || cursor === null ? null : state?.pass_started_at ?? null;
  let systemic: string | null = null;
  let passComplete = false;
  let budgetOut = false;
  let consecutiveFailures = 0;
  let lostUnits = false;
  let completedUnits = 0;

  try {
    if (!dryRun) {
      const { data, error } = await db
        .from("ingest_runs")
        .insert({ source: id, trigger, status: "running" } as never)
        .select("id")
        .single();
      if (error) throw new Error(`ingest_runs insert failed: ${error.message}`);
      summary.runId = Number((data as { id: number }).id);
      if (!passStartedAt) {
        passStartedAt = summary.started_at;
        await writeState(db, id, { pass_started_at: passStartedAt, cursor: force ? null : cursor });
      }
    } else if (!passStartedAt) {
      passStartedAt = summary.started_at;
    }
    log.info(`start ${trigger}${dryRun ? " (dry run)" : ""}${force ? " (forced)" : ""} budget=${budgetMs}ms cursor=${JSON.stringify(cursor)}`);

    planning: for (;;) {
      const plan = await adapter.plan(cursor, ctx);
      for (const unit of plan.units) {
        if (remainingMs() <= 0) {
          budgetOut = true;
          log.warn(`budget exhausted before ${unit.label}; resuming from ${JSON.stringify(cursor)} next run`);
          break planning;
        }
        const result = await runUnit(adapter, unit, ctx);
        summary.units++;
        if (result.kind === "budget") {
          if (completedUnits === 0) {
            // The whole budget went into this one unit: skip it so the pass still progresses.
            lostUnits = true;
            unitErrors.push({ unit: unit.key, message: `unit exceeded the whole budget (${budgetMs} ms) and was skipped` });
            log.error(`${unit.label}: exceeded the whole budget; skipped`);
            cursor = unit.after;
            if (!dryRun) await writeState(db, id, { cursor });
          } else {
            log.warn(`budget exhausted during ${unit.label}; it is retried from ${JSON.stringify(cursor)} next run`);
          }
          budgetOut = true;
          break planning;
        }
        if (result.kind === "failed") {
          consecutiveFailures++;
          lostUnits = true;
          unitErrors.push({ unit: unit.key, message: `unit failed after ${UNIT_ATTEMPTS} attempt(s)` });
          if (consecutiveFailures >= MAX_CONSECUTIVE_UNIT_FAILURES) {
            systemic = `${consecutiveFailures} consecutive unit failures`;
            break planning;
          }
        } else {
          const rows = result.rows;
          consecutiveFailures = 0;
          summary.fetched += rows.length;
          if (dryRun) {
            const prepared = prepareRows(rows, log);
            summary.invalid += prepared.invalid;
            summary.validated += prepared.rows.length;
            for (const r of prepared.rows) if (sample.length < SAMPLE_ROWS) sample.push(r);
            for (const e of prepared.errors) if (unitErrors.length < MAX_UNIT_ERRORS_KEPT) unitErrors.push({ unit: unit.key, message: e });
          } else if (rows.length > 0) {
            const res = await upsertEvents(rows, log);
            summary.inserted += res.inserted;
            summary.updated += res.updated;
            summary.unchanged += res.unchanged;
            summary.drifted += res.drifted;
            summary.invalid += res.invalid;
            for (const e of res.errors) if (unitErrors.length < MAX_UNIT_ERRORS_KEPT) unitErrors.push({ unit: unit.key, message: e });
            if (res.failed > 0) lostUnits = true;
            if (res.sent === 0 && res.failed > 0) {
              consecutiveFailures++;
              if (consecutiveFailures >= MAX_CONSECUTIVE_UNIT_FAILURES) {
                systemic = "database rejected every chunk";
                break planning;
              }
            }
            log.info(
              `${unit.label}: ${rows.length} rows → +${res.inserted} ins, ${res.updated} upd, ${res.unchanged} same, ${res.drifted} drift` +
                (res.invalid ? `, ${res.invalid} invalid` : "") +
                (res.failed ? `, ${res.failed} FAILED` : ""),
            );
          } else {
            log.info(`${unit.label}: 0 rows`);
          }
        }
        completedUnits++;
        cursor = unit.after;
        if (!dryRun) await writeState(db, id, { cursor });
        if (remainingMs() <= 0) {
          budgetOut = true;
          log.warn(`budget exhausted after ${summary.units} unit(s); resuming from ${JSON.stringify(cursor)} next run`);
          break planning;
        }
      }
      if (plan.done) {
        passComplete = true;
        break;
      }
      cursor = plan.nextCursor ?? null;
      if (!dryRun) await writeState(db, id, { cursor });
      if (remainingMs() <= 0) {
        budgetOut = true;
        log.warn(`budget exhausted; resuming from ${JSON.stringify(cursor)} next run`);
        break;
      }
    }
  } catch (err) {
    systemic = errorMessage(err);
    log.error(`systemic failure: ${systemic}`);
  }

  // Outcome.
  if (systemic) {
    summary.status = "error";
  } else if (passComplete && !lostUnits) {
    summary.status = "ok";
    cursor = null;
  } else if (passComplete) {
    // Finished the plan but lost units: do not mark stale, start over next time.
    summary.status = "partial";
    summary.partialReason = "lost-units";
    cursor = null;
  } else {
    summary.status = "partial";
    summary.partialReason = budgetOut ? "budget" : "lost-units";
  }
  summary.cursor = cursor;
  summary.errors = unitErrors.slice(0, MAX_UNIT_ERRORS_KEPT);
  if (systemic) summary.errors.unshift({ message: systemic });
  if (dryRun) summary.sample = sample;

  if (!dryRun) {
    try {
      const nowIso = new Date().toISOString();
      if (summary.status === "ok") {
        let stale = 0;
        if (adapter.rank > 0 && passStartedAt) {
          const rpcDb = await getLongDb(RPC_TIMEOUT_MS);
          const { data, error } = await rpcDb.rpc("mark_stale_records", { p_source: id, p_pass_started: passStartedAt });
          if (error) log.warn(`mark_stale_records failed: ${error.message}`);
          else stale = Number(data ?? 0);
        }
        if (stale) log.info(`${stale} row(s) not seen this pass (tentative)`);
        await writeState(db, id, { cursor: null, pass_started_at: null, last_success_at: nowIso, consecutive_failures: 0, backoff_until: null });
      } else if (summary.status === "partial") {
        await writeState(db, id, { cursor, pass_started_at: cursor === null ? null : passStartedAt, consecutive_failures: 0, backoff_until: null });
      } else if (summary.status === "error") {
        const n = (state?.consecutive_failures ?? 0) + 1;
        const backoff = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** (n - 1));
        await writeState(db, id, { cursor, consecutive_failures: n, backoff_until: new Date(Date.now() + backoff).toISOString() });
        log.warn(`consecutive_failures=${n}; backing off ${Math.round(backoff / 60000)} min`);
      }
    } catch (err) {
      log.error(`state update failed: ${errorMessage(err)}`);
    } finally {
      if (lease) {
        const { error } = await db.rpc("release_source_lease", { p_source: id, p_token: lease });
        if (error) log.error(`release_source_lease failed: ${error.message}`);
      }
    }
    summary.duration_ms = Date.now() - started;
    if (summary.runId !== null) {
      const { error } = await db
        .from("ingest_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: summary.status,
          fetched: summary.fetched,
          inserted: summary.inserted,
          updated: summary.updated,
          unchanged: summary.unchanged,
          drifted: summary.drifted,
          errors: summary.errors,
          cursor_out: cursor,
          duration_ms: summary.duration_ms,
        } as never)
        .eq("id", summary.runId);
      if (error) log.error(`ingest_runs update failed: ${error.message}`);
    }
    if (summary.inserted + summary.updated + summary.drifted > 0) await revalidateCatalog(log);
  }
  summary.duration_ms = Date.now() - started;
  return emit(summary);
}

/** One retry at most: `ctx.http` already retries transient failures per request. */
const UNIT_ATTEMPTS = 2;

type UnitResult = { kind: "ok"; rows: IngestEvent[] } | { kind: "failed" } | { kind: "budget" };

/**
 * Runs one unit. `budget` means the deadline (not the source) stopped it: either the HTTP layer
 * raised `BudgetExceededError`, or a retry no longer fits in the remaining budget.
 */
async function runUnit(adapter: Adapter, unit: Unit, ctx: IngestContext): Promise<UnitResult> {
  const attempts = UNIT_ATTEMPTS;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return { kind: "ok", rows: await adapter.run(unit, ctx) };
    } catch (err) {
      const msg = errorMessage(err);
      if (isBudgetExceeded(err)) {
        ctx.log.warn(`${unit.label}: ${msg}`);
        return { kind: "budget" };
      }
      ctx.log.warn(`${unit.label}: attempt ${attempt + 1}/${attempts} failed: ${msg}`);
      if (attempt === attempts - 1) return { kind: "failed" };
      const remaining = ctx.budget.remainingMs();
      if (remaining < adapter.limits.timeoutMs) {
        ctx.log.warn(`${unit.label}: not retried, ${remaining} ms of budget left (< ${adapter.limits.timeoutMs} ms timeout)`);
        return { kind: "budget" };
      }
      await sleep(Math.min(remaining, 1000 * 2 ** attempt));
    }
  }
  return { kind: "failed" };
}

/** Exactly one machine-readable line per run. */
function emit(summary: RunSummary): RunSummary {
  const line = {
    evt: "ingest_run",
    source: summary.source,
    status: summary.status,
    reason: summary.reason ?? summary.partialReason,
    trigger: summary.trigger,
    dry_run: summary.dryRun || undefined,
    run_id: summary.runId ?? undefined,
    duration_ms: summary.duration_ms,
    units: summary.units,
    fetched: summary.fetched,
    inserted: summary.inserted,
    updated: summary.updated,
    unchanged: summary.unchanged,
    drifted: summary.drifted,
    invalid: summary.invalid,
    validated: summary.dryRun ? summary.validated : undefined,
    errors: summary.errors.length,
    cursor: summary.cursor ?? undefined,
  };
  console.log(JSON.stringify(line));
  return summary;
}
