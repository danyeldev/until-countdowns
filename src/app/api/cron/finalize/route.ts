import type { NextRequest } from "next/server";
import { invalidateTags, TAG_EVENTS, TAG_STATS } from "@/lib/cache";
import { assertCron, CRON_HEADERS } from "@/lib/cron";

export const maxDuration = 180;

/** Refresh publication, event status, series, enrichment queue, and catalog counts. */
export async function GET(req: NextRequest) {
  const denied = assertCron(req);
  if (denied) return denied;
  if (process.env.INGEST_ENABLED !== "true") {
    return Response.json({ skipped: true, reason: "INGEST_ENABLED is not 'true'" }, { headers: CRON_HEADERS });
  }
  const started = Date.now();
  let release: (() => Promise<void>) | null = null;
  try {
    const { getDb, getLongDb, FINALIZE_TIMEOUT_MS } = await import("@/lib/ingest/db");
    const db = await getDb();
    const { data: lease, error: leaseError } = await db.rpc("acquire_source_lease", { p_source: "__finalize", p_ttl: "5 minutes" });
    if (leaseError) throw new Error(`finalize lease failed: ${leaseError.message}`);
    if (!lease) return Response.json({ ok: true, skipped: true, reason: "leased" }, { headers: CRON_HEADERS });
    release = async () => {
      const { error } = await db.rpc("release_source_lease", { p_source: "__finalize", p_token: lease });
      if (error) throw new Error(`finalize lease release failed: ${error.message}`);
    };
    const rpcDb = await getLongDb(FINALIZE_TIMEOUT_MS);
    const { error } = await rpcDb.rpc("finalize_catalog");
    if (error) throw new Error(error.message);
    invalidateTags([TAG_EVENTS, TAG_STATS]);
    const { error: stateError } = await db.from("ingest_state").update({ last_success_at: new Date().toISOString() }).eq("source", "__finalize");
    if (stateError) throw new Error(`finalize state failed: ${stateError.message}`);
    const duration_ms = Date.now() - started;
    console.log(JSON.stringify({ evt: "finalize", status: "ok", duration_ms }));
    return Response.json({ ok: true, duration_ms, revalidated: [TAG_EVENTS, TAG_STATS] }, { headers: CRON_HEADERS });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ evt: "finalize", status: "error", duration_ms: Date.now() - started, error }));
    return Response.json({ ok: false, error }, { status: 500, headers: CRON_HEADERS });
  } finally {
    if (release) {
      try { await release(); }
      catch (err) { console.error(JSON.stringify({ evt: "finalize_release", status: "error", error: String(err) })); }
    }
  }
}
