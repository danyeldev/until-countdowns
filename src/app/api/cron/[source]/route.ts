import type { NextRequest } from "next/server";
import { assertCron } from "@/lib/cron";

/**
 * Cron entry point for one ingest source: `GET /api/cron/<source>[?force=1][&dry=1][&budget=<ms>]`.
 * Bearer `CRON_SECRET` required (Vercel Cron sends it). `INGEST_ENABLED !== 'true'` is the kill
 * switch: 200 `{skipped:true}` without touching the database. The runner and the adapter are
 * imported lazily so an invocation for one source never loads the others.
 */
export const maxDuration = 300;

/** The run budget (env or `?budget=`) is clamped so the runner's own margin fits under `maxDuration`. */
const MAX_BUDGET_MS = (maxDuration - 20) * 1000;

const NO_STORE = { "Cache-Control": "no-store" };
const SOURCE_RE = /^[a-z][a-z0-9-]{1,40}$/;

function budgetMs(param: string | null): number {
  const fromParam = Number(param);
  const fromEnv = Number(process.env.INGEST_BUDGET_MS);
  const wanted = Number.isFinite(fromParam) && fromParam > 0 ? fromParam : Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : MAX_BUDGET_MS;
  return Math.min(wanted, MAX_BUDGET_MS);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ source: string }> }) {
  const denied = assertCron(req);
  if (denied) return denied;
  const { source } = await ctx.params;
  if (process.env.INGEST_ENABLED !== "true") {
    return Response.json({ skipped: true, reason: "INGEST_ENABLED is not 'true'", source }, { headers: NO_STORE });
  }
  if (!SOURCE_RE.test(source)) return Response.json({ ok: false, error: "unknown source" }, { status: 404, headers: NO_STORE });
  const { isSource } = await import("@/lib/ingest/sources/index");
  if (!isSource(source)) return Response.json({ ok: false, error: "unknown source" }, { status: 404, headers: NO_STORE });

  const params = req.nextUrl.searchParams;
  const force = params.get("force") === "1";
  const dryRun = params.get("dry") === "1";
  const trigger = req.headers.get("user-agent")?.startsWith("vercel-cron") ? "cron" : "manual";
  try {
    const { runSource } = await import("@/lib/ingest/run");
    const summary = await runSource(source, { trigger, force, dryRun, budgetMs: budgetMs(params.get("budget")) });
    const status = summary.status === "error" ? 500 : 200;
    return Response.json(summary, { status, headers: NO_STORE });
  } catch (err) {
    // Failures before the runner's own try/finally (missing env, ingest_state read, lease RPC).
    const error = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ evt: "ingest_run", source, status: "error", trigger, error }));
    return Response.json({ ok: false, source, status: "error", error }, { status: 500, headers: NO_STORE });
  }
}
