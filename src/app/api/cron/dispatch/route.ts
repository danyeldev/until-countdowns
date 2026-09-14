import type { NextRequest } from "next/server";
import { assertCron, cronBudget, CRON_HEADERS, cronTrigger } from "@/lib/cron";

export const maxDuration = 300;

/** One bounded source per tick. The per-source lease remains the authority for concurrency. */
export async function GET(req: NextRequest) {
  const denied = assertCron(req);
  if (denied) return denied;
  if (process.env.INGEST_ENABLED !== "true") {
    return Response.json({ skipped: true, reason: "INGEST_ENABLED is not 'true'" }, { headers: CRON_HEADERS });
  }
  try {
    const [{ getDb }, { listSources, loadAdapter }, { sourceSchedule }, { runSource }] = await Promise.all([
      import("@/lib/ingest/db"), import("@/lib/ingest/sources/index"), import("@/lib/ingest/schedule"), import("@/lib/ingest/run"),
    ]);
    const db = await getDb();
    const { data, error } = await db.from("ingest_state").select("*");
    if (error) throw new Error(`ingest_state read failed: ${error.message}`);
    const schedule = sourceSchedule(listSources(), data ?? []);
    const disabled: string[] = [];
    const started = Date.now();
    for (const source of schedule.filter((entry) => entry.due)) {
      const adapter = await loadAdapter(source.id);
      if (!adapter.isConfigured()) {
        disabled.push(source.id);
        continue;
      }
      const available = 240_000 - (Date.now() - started);
      if (available < 15_000) break;
      const summary = await runSource(source.id, {
        trigger: cronTrigger(req),
        dryRun: req.nextUrl.searchParams.get("dry") === "1",
        budgetMs: cronBudget(req.nextUrl.searchParams.get("budget"), process.env.INGEST_BUDGET_MS, available),
      });
      // A simultaneous tick may have claimed this source after our snapshot. Try another.
      if (summary.reason === "leased" || summary.reason === "backoff") continue;
      return Response.json({ ...summary, dispatched: source.id, disabled }, { status: summary.status === "error" ? 500 : 200, headers: CRON_HEADERS });
    }
    return Response.json({ ok: true, skipped: true, reason: "no configured sources due", disabled }, { headers: CRON_HEADERS });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ evt: "dispatch", status: "error", error }));
    return Response.json({ ok: false, error }, { status: 500, headers: CRON_HEADERS });
  }
}
