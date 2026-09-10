import type { NextRequest } from "next/server";
import { invalidateTags, TAG_EVENTS, TAG_STATS } from "@/lib/cache";
import { assertCron } from "@/lib/cron";

/**
 * Nightly `finalize_catalog()`: past events → done, indexability gate, series linking,
 * enrichment queue, `catalog_stats`; then the `events`/`stats` cache tags are invalidated so the
 * SQL day counts are fresh every morning.
 */
export const maxDuration = 120;

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(req: NextRequest) {
  const denied = assertCron(req);
  if (denied) return denied;
  if (process.env.INGEST_ENABLED !== "true") {
    return Response.json({ skipped: true, reason: "INGEST_ENABLED is not 'true'" }, { headers: NO_STORE });
  }
  const started = Date.now();
  // finalize_catalog() touches the whole events table: the default 10 s client deadline is too short.
  const { getLongDb, FINALIZE_TIMEOUT_MS } = await import("@/lib/ingest/db");
  const db = await getLongDb(FINALIZE_TIMEOUT_MS);
  const { error } = await db.rpc("finalize_catalog");
  if (error) {
    console.error(JSON.stringify({ evt: "finalize", status: "error", error: error.message }));
    return Response.json({ ok: false, error: error.message }, { status: 500, headers: NO_STORE });
  }
  invalidateTags([TAG_EVENTS, TAG_STATS]);
  const duration_ms = Date.now() - started;
  console.log(JSON.stringify({ evt: "finalize", status: "ok", duration_ms }));
  return Response.json({ ok: true, duration_ms, revalidated: [TAG_EVENTS, TAG_STATS] }, { headers: NO_STORE });
}
