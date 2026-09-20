import { NextRequest } from "next/server";
import { parseProfileParam } from "@/lib/auth/profile";
import {
  calendarEvents,
  icsFeedContent,
  sanitizeCalendarEvent,
} from "@/lib/calendar";
import {
  collectionItemHref,
  parseCollectionSlug,
} from "@/lib/collections";
import { getPublicCollectionServer } from "@/lib/collections-server";
import {
  icsFileResponse,
  icsNeedsDate,
  icsNotFound,
  icsUnavailable,
} from "@/lib/ics-response";
import { absoluteUrl } from "@/lib/seo";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/ics/collection/[handle]/[slug]">,
) {
  const { handle: rawHandle, slug: rawSlug } = await ctx.params;
  const handle = parseProfileParam(rawHandle);
  const slug = parseCollectionSlug(rawSlug);
  if (!handle || !slug) return icsNotFound();

  let collection;
  try {
    collection = await getPublicCollectionServer(handle, slug);
  } catch {
    return icsUnavailable();
  }
  if (!collection) return icsNotFound();

  const events = calendarEvents(collection.items).map(sanitizeCalendarEvent);
  if (!events.length) return icsNeedsDate();

  return icsFileResponse(
    icsFeedContent(events, {
      name: collection.title,
      eventUrl: (event) => absoluteUrl(collectionItemHref(event)),
    }),
    `${handle}-${slug}.ics`,
    "public, s-maxage=60, stale-while-revalidate=86400",
    "inline",
  );
}
