import type { NextRequest } from "next/server";
import { assertCron } from "@/lib/cron";

/** Ops view: the last 30 ingest runs, per-source state and the catalog stats row. */
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const denied = assertCron(req);
  if (denied) return denied;
  const { serviceClient } = await import("@/lib/db/admin");
  const { listSources } = await import("@/lib/ingest/sources/index");
  const db = serviceClient();
  const [runs, state, stats] = await Promise.all([
    db.from("ingest_runs").select("*").order("started_at", { ascending: false }).limit(30),
    db.from("ingest_state").select("*").order("source"),
    db.from("catalog_stats").select("*").eq("id", true).maybeSingle(),
  ]);
  const errors = [runs.error, state.error, stats.error].filter(Boolean).map((e) => e!.message);
  return Response.json(
    {
      ok: errors.length === 0,
      ingest_enabled: process.env.INGEST_ENABLED === "true",
      sources: listSources().map(({ id, label, rank, cadence }) => ({ id, label, rank, cadence })),
      runs: runs.data ?? [],
      state: state.data ?? [],
      catalog_stats: stats.data ?? null,
      errors,
    },
    { status: errors.length ? 500 : 200, headers: NO_STORE },
  );
}
