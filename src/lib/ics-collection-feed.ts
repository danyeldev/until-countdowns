import { parseProfileParam } from "@/lib/auth/profile";
import {
  calendarEvents,
  calendarFileSlug,
  icsFeedContent,
  sanitizeCalendarEvent,
} from "@/lib/calendar";
import {
  collectionItemHref,
  parseCollectionSlug,
} from "@/lib/collections";
import { getPublicCollectionServer } from "@/lib/collections-server";
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
import { absoluteUrl } from "@/lib/seo";

export async function featuredCollectionIcsResponse(rawSlug: string) {
  const slug = parseFeaturedCollectionSlug(calendarFileSlug(rawSlug));
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
    false,
  );
}

export async function publicCollectionIcsResponse(
  rawHandle: string,
  rawSlug: string,
) {
  const handle = parseProfileParam(rawHandle);
  const slug = parseCollectionSlug(calendarFileSlug(rawSlug));
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
    false,
  );
}
