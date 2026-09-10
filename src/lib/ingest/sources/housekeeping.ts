import { getDb } from "../db";
import type { Adapter, IngestContext, Plan, Unit } from "../types";
import { CADENCE_MS, SOURCES } from "./index";

/**
 * Daily maintenance, no events emitted (rank 0):
 *  - popularity decay: −1 per week for non-curated rows not seen for 30 days with popularity > 20
 *  - prune `ingest_runs` older than 90 days
 *  - log `[ingest] STALE <source>` for sources whose last ok run is older than 2× their cadence
 * Every UPDATE/DELETE carries an explicit WHERE (safeupdate-compatible PostgREST).
 */

const DECAY_AFTER_DAYS = 30;
const DECAY_FLOOR = 20;
const RUNS_RETENTION_DAYS = 90;
const DECAY_BATCH = 500;

/** Decay runs on Mondays only so the daily cron yields −1 per week. */
export function isDecayDay(now: Date): boolean {
  return now.getUTCDay() === 1;
}

export async function decayPopularity(ctx: IngestContext): Promise<number> {
  if (!isDecayDay(ctx.now)) {
    ctx.log.info("decay: not today (runs on Mondays)");
    return 0;
  }
  const db = await getDb();
  const cutoff = new Date(ctx.now.getTime() - DECAY_AFTER_DAYS * 86_400_000).toISOString();
  const { data, error } = await db
    .from("events")
    .select("id, popularity")
    .neq("source", "curated")
    .lt("last_seen_at", cutoff)
    .gt("popularity", DECAY_FLOOR)
    .limit(20_000);
  if (error) throw new Error(`decay select failed: ${error.message}`);
  const rows = (data ?? []) as Array<{ id: string; popularity: number }>;
  if (ctx.dryRun) {
    ctx.log.info(`decay (dry run): ${rows.length} row(s) would lose 1 popularity point`);
    return 0;
  }
  const byPop = new Map<number, string[]>();
  for (const r of rows) {
    if (!byPop.has(r.popularity)) byPop.set(r.popularity, []);
    byPop.get(r.popularity)!.push(r.id);
  }
  let updated = 0;
  for (const [pop, ids] of byPop) {
    for (let i = 0; i < ids.length; i += DECAY_BATCH) {
      const batch = ids.slice(i, i + DECAY_BATCH);
      const { error: updErr } = await db
        .from("events")
        .update({ popularity: pop - 1 } as never)
        .in("id", batch)
        .eq("popularity", pop);
      if (updErr) throw new Error(`decay update failed: ${updErr.message}`);
      updated += batch.length;
    }
  }
  return updated;
}

export async function pruneRuns(ctx: IngestContext): Promise<number> {
  const db = await getDb();
  const cutoff = new Date(ctx.now.getTime() - RUNS_RETENTION_DAYS * 86_400_000).toISOString();
  if (ctx.dryRun) {
    const { count, error } = await db.from("ingest_runs").select("id", { count: "exact", head: true }).lt("started_at", cutoff);
    if (error) throw new Error(`prune count failed: ${error.message}`);
    ctx.log.info(`prune (dry run): ${count ?? 0} ingest_runs row(s) older than ${RUNS_RETENTION_DAYS} days`);
    return 0;
  }
  const { data, error } = await db.from("ingest_runs").delete().lt("started_at", cutoff).select("id");
  if (error) throw new Error(`prune failed: ${error.message}`);
  return (data ?? []).length;
}

export async function staleSources(ctx: IngestContext): Promise<string[]> {
  const db = await getDb();
  const stale: string[] = [];
  for (const entry of Object.values(SOURCES)) {
    if (entry.rank === 0) continue;
    const { data, error } = await db
      .from("ingest_runs")
      .select("started_at")
      .eq("source", entry.id)
      .eq("status", "ok")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`staleness check failed for ${entry.id}: ${error.message}`);
    const last = (data as { started_at: string } | null)?.started_at;
    const age = last ? ctx.now.getTime() - Date.parse(last) : Number.POSITIVE_INFINITY;
    if (age > 2 * CADENCE_MS[entry.cadence]) {
      stale.push(entry.id);
      console.warn(`[ingest] STALE ${entry.id}: last ok run ${last ?? "never"} (cadence ${entry.cadence})`);
    }
  }
  return stale;
}

export const adapter: Adapter<Unit> = {
  id: "housekeeping",
  label: "Housekeeping",
  rank: 0,
  cadence: "daily",
  isConfigured: () => true,
  limits: { concurrency: 1, minIntervalMs: 0, timeoutMs: 30_000, maxRetries: 0 },

  async plan(): Promise<Plan<Unit>> {
    return { units: [{ key: "housekeeping", label: "housekeeping", after: null }], done: true };
  },

  async run(_unit, ctx) {
    const decayed = await decayPopularity(ctx);
    const pruned = await pruneRuns(ctx);
    const stale = await staleSources(ctx);
    ctx.log.info(`decayed ${decayed} row(s), pruned ${pruned} run(s), stale sources: ${stale.length ? stale.join(", ") : "none"}`);
    return [];
  },
};
