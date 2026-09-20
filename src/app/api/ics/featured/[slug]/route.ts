import { NextRequest } from "next/server";
import {
  calendarEvents,
  icsFeedContent,
  sanitizeCalendarEvent,
} from "@/lib/calendar";
import {
  loadFeaturedCollection,
  parseFeaturedCollectionSlug,
} from "@/lib/featured-collections";
import {
  icsFileResponse,
  icsNeedsDate,
  icsNotFound,
  icsUnavailable,
} from "@/lib/ics-response";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/ics/featured/[slug]">,
) {
  const { slug: rawSlug } = await ctx.params;
  const slug = parseFeaturedCollectionSlug(rawSlug);
  if (!slug) return icsNotFound();

  let collection;
  try {
    collection = await loadFeaturedCollection(slug);
  } catch {
    return icsUnavailable();
  }
  if (!collection) return icsNotFound();

  const events = calendarEvents(collection.events).map(sanitizeCalendarEvent);
  if (!events.length) return icsNeedsDate();

  return icsFileResponse(
    icsFeedContent(events, { name: collection.meta.title }),
    `${collection.meta.slug}.ics`,
    "public, s-maxage=900, stale-while-revalidate=86400",
    "inline",
  );
}
