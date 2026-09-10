import type { NextRequest } from "next/server";
import { eventTag, invalidateTags, TAG_EVENTS } from "@/lib/cache";
import { assertCron } from "@/lib/cron";

/**
 * Enrichment cron: `GET /api/cron/enrich[?kind=…][&limit=n][&dry=1][&slug=…]`.
 *
 * Runs every 10 minutes and drains the `enrichment_jobs` queue a slice at a time — Wikipedia
 * summaries (text only, CC BY-SA, credited on the page) and the licensed image pipeline. Same
 * guards as the ingest routes: bearer `CRON_SECRET`, and `INGEST_ENABLED !== 'true'` is the kill
 * switch. The worker itself lives in `src/lib/enrich/run.ts` and is imported lazily so an
 * unauthorised request never loads sharp.
 *
 * Flags: `kind` (`wikipedia_summary` / `image`, default both, plus `recheck` — the monthly pass
 * that re-verifies the oldest stored Commons files and drops any that stopped being free),
 * `limit` (per kind, default 60 and 25 for `recheck`, max 200), `dry=1` (resolve and report,
 * write nothing), `slug=<slug>` (enrich one event and ignore the queue — the way to test a single
 * row without burning jobs).
 */
export const maxDuration = 300;

/** Clamped so the worker's own margin still fits inside `maxDuration`. */
const MAX_BUDGET_MS = (maxDuration - 20) * 1000;
const NO_STORE = { "Cache-Control": "no-store" };
const SLUG_RE = /^[a-z0-9-]{1,200}$/;

function budgetMs(param: string | null): number {
  const fromParam = Number(param);
  const fromEnv = Number(process.env.ENRICH_BUDGET_MS ?? process.env.INGEST_BUDGET_MS);
  const wanted =
    Number.isFinite(fromParam) && fromParam > 0 ? fromParam : Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 240_000;
  return Math.min(wanted, MAX_BUDGET_MS);
}

export async function GET(req: NextRequest) {
  const denied = assertCron(req);
  if (denied) return denied;
  if (process.env.INGEST_ENABLED !== "true") {
    return Response.json({ skipped: true, reason: "INGEST_ENABLED is not 'true'" }, { headers: NO_STORE });
  }

  const params = req.nextUrl.searchParams;
  const { DEFAULT_LIMIT, isRunKind, MAX_CHANGED_TAGS, MAX_LIMIT, runEnrichment } = await import("@/lib/enrich/run");
  const { ENRICH_KINDS } = await import("@/lib/enrich/jobs");

  const kindParam = params.get("kind");
  if (kindParam && !isRunKind(kindParam)) {
    return Response.json({ ok: false, error: `unknown kind "${kindParam}"` }, { status: 400, headers: NO_STORE });
  }
  // `recheck` is opt-in: the default run drains the two queue kinds.
  const kinds = kindParam && isRunKind(kindParam) ? [kindParam] : [...ENRICH_KINDS];

  const limitParam = Number(params.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.trunc(limitParam), MAX_LIMIT) : DEFAULT_LIMIT;

  const slug = params.get("slug") ?? undefined;
  if (slug && !SLUG_RE.test(slug)) {
    return Response.json({ ok: false, error: "bad slug" }, { status: 400, headers: NO_STORE });
  }

  const trigger = req.headers.get("user-agent")?.startsWith("vercel-cron") ? "cron" : "manual";
  try {
    const summary = await runEnrichment({ kinds, limit, dryRun: params.get("dry") === "1", slug, budgetMs: budgetMs(params.get("budget")) });

    // One catalog-wide tag plus a bounded list of per-event tags: a big run must not turn into
    // hundreds of revalidations, and `events` alone would already be correct.
    const tags = [TAG_EVENTS, ...summary.changed.slice(0, MAX_CHANGED_TAGS).map(eventTag)];
    if (!summary.dry && summary.changed.length > 0) invalidateTags(tags);

    console.log(
      JSON.stringify({
        evt: "enrich_run",
        status: summary.ok ? "ok" : "partial",
        trigger,
        kinds,
        limit,
        slug: slug ?? null,
        dry: summary.dry,
        claimed: summary.claimed,
        done: summary.done,
        skipped: summary.skipped,
        failed: summary.failed,
        images_created: summary.images_created,
        images_reused: summary.images_reused,
        rechecked: summary.rechecked,
        dropped: summary.dropped,
        changed: summary.changed.length,
        durations: summary.durations,
      }),
    );
    return Response.json(
      { ...summary, revalidated: summary.dry || summary.changed.length === 0 ? [] : tags.length },
      { headers: NO_STORE },
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ evt: "enrich_run", status: "error", trigger, kinds, error }));
    return Response.json({ ok: false, status: "error", error }, { status: 500, headers: NO_STORE });
  }
}
