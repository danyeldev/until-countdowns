import type { NextRequest } from "next/server";
import { eventTag, invalidateTags, TAG_EVENTS, TAG_STATS } from "@/lib/cache";
import { assertCron } from "@/lib/cron";

/**
 * Ops-only cache invalidation, protected by `CRON_SECRET`. Call it right after `npm run push`
 * (or any manual catalog change) so the Data Cache does not keep serving the previous —
 * possibly empty — catalog for up to an hour:
 *
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" "$NEXT_PUBLIC_SITE_URL/api/revalidate"
 *
 * Optional `?tags=events,stats` (default: both) or `?slug=<slug>` to refresh one event page.
 * Uses the `max` profile: stale pages keep being served while the next request refills them.
 */
export const dynamic = "force-dynamic";

const SLUG_RE = /^[a-z0-9-]{1,200}$/;
const ALLOWED = new Set([TAG_EVENTS, TAG_STATS]);

function handle(req: NextRequest): Response {
  const denied = assertCron(req);
  if (denied) return denied;

  const tags = new Set<string>();
  const raw = req.nextUrl.searchParams.get("tags");
  for (const t of (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    if (!ALLOWED.has(t)) return Response.json({ ok: false, error: `unknown tag: ${t}` }, { status: 400 });
    tags.add(t);
  }
  const slug = req.nextUrl.searchParams.get("slug");
  if (slug !== null) {
    if (!SLUG_RE.test(slug)) return Response.json({ ok: false, error: "bad slug" }, { status: 400 });
    tags.add(eventTag(slug));
  }
  if (tags.size === 0) {
    tags.add(TAG_EVENTS);
    tags.add(TAG_STATS);
  }

  const list = [...tags];
  invalidateTags(list);
  return Response.json({ ok: true, revalidated: list }, { headers: { "Cache-Control": "no-store" } });
}

export function GET(req: NextRequest) {
  return handle(req);
}

export function POST(req: NextRequest) {
  return handle(req);
}
