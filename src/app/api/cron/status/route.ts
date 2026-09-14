import type { NextRequest } from "next/server";
import { assertCron, CRON_HEADERS } from "@/lib/cron";

/** Read-only operations view: freshness, stalled runs, resumable sources, and queue pressure. */
export async function GET(req: NextRequest) {
  const denied = assertCron(req);
  if (denied) return denied;
  try {
    const [{ getDb }, { listSources, loadAdapter }, { sourceSchedule }] = await Promise.all([
      import("@/lib/ingest/db"), import("@/lib/ingest/sources/index"), import("@/lib/ingest/schedule"),
    ]);
    const db = await getDb();
    const now = Date.now();
    const [runs, state, stats, dueJobs, failedJobs] = await Promise.all([
      db.from("ingest_runs").select("*").order("started_at", { ascending: false }).limit(30),
      db.from("ingest_state").select("*").order("source"),
      db.from("catalog_stats").select("*").eq("id", true).maybeSingle(),
      db.from("enrichment_jobs").select("id", { count: "exact", head: true }).eq("status", "pending").lte("next_attempt_at", new Date(now).toISOString()),
      db.from("enrichment_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
    ]);
    const errors = [runs.error, state.error, stats.error, dueJobs.error, failedJobs.error].filter(Boolean).map((error) => error!.message);
    const schedule = sourceSchedule(listSources(), state.data ?? [], now);
    const sources = await Promise.all(schedule.map(async ({ order: _order, ...source }) => {
      void _order;
      try {
        const configured = (await loadAdapter(source.id)).isConfigured();
        return { ...source, configured, due: configured && source.due, health: configured ? source.health : "disabled" };
      } catch (err) {
        errors.push(`source ${source.id}: ${err instanceof Error ? err.message : String(err)}`);
        return { ...source, configured: false, due: false, health: "error" };
      }
    }));
    const enabled = process.env.INGEST_ENABLED === "true";
    const alerts: string[] = [];
    if (enabled) {
      for (const source of sources) {
        if (["stale", "backoff", "never-synced", "error"].includes(source.health)) alerts.push(`${source.id}: ${source.health}`);
      }
      const generated = stats.data?.generated_at ? Date.parse(stats.data.generated_at) : 0;
      if (!generated || now - generated > 16 * 3_600_000) alerts.push("catalog finalization is overdue");
      if ((failedJobs.count ?? 0) > 0) alerts.push(`${failedJobs.count} enrichment jobs need review`);
      const stalled = (runs.data ?? []).filter((run) => run.status === "running" && now - Date.parse(run.started_at) > 10 * 60_000);
      if (stalled.length > 0) alerts.push(`${stalled.length} ingest runs did not finish before their lease expired`);
    }
    return Response.json({
      ok: errors.length === 0,
      health: errors.length ? "error" : !enabled ? "paused" : alerts.length ? "degraded" : "healthy",
      checked_at: new Date(now).toISOString(),
      ingest_enabled: enabled,
      sources,
      enrichment: { due: dueJobs.count, failed: failedJobs.count },
      runs: runs.data ?? [],
      state: state.data ?? [],
      catalog_stats: stats.data ?? null,
      alerts,
      errors,
    }, { status: errors.length ? 500 : 200, headers: CRON_HEADERS });
  } catch (err) {
    return Response.json({ ok: false, health: "error", errors: [err instanceof Error ? err.message : String(err)] }, { status: 500, headers: CRON_HEADERS });
  }
}
