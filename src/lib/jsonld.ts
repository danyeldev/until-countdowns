/**
 * JSON-LD builders. Kept deliberately small: BreadcrumbList everywhere, WebSite + Organization on
 * the home page, CollectionPage (+ ItemList) on hubs, EventSeries on series pages and schema.org
 * Event only for rows the finalize job marked `jsonld_eligible` (attendable events with a place).
 * No FAQPage and no SearchAction: neither earns a rich result any more.
 */
import { absoluteUrl, eventDescription, SITE_NAME } from "./seo";
import type { CountdownEvent, Series } from "./types";

export type JsonLdObject = Record<string, unknown>;

const SCHEMA = "https://schema.org";

export type Crumb = { name: string; path: string };

export function breadcrumbList(items: Crumb[]): JsonLdObject {
  return {
    "@context": SCHEMA,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function webSite(): JsonLdObject {
  return {
    "@context": SCHEMA,
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    inLanguage: "en",
    description: "Live countdowns and dates for thousands of upcoming events, holidays and milestones.",
  };
}

export function organization(): JsonLdObject {
  return {
    "@context": SCHEMA,
    "@type": "Organization",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/og/default"),
  };
}

export type CollectionItem = { name: string; path: string };

export function collectionPage(name: string, description: string, path: string, items: CollectionItem[]): JsonLdObject {
  return {
    "@context": SCHEMA,
    "@type": "CollectionPage",
    name,
    description,
    url: absoluteUrl(path),
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/") },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.slice(0, 100).map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.name,
        url: absoluteUrl(item.path),
      })),
    },
  };
}

/** `YYYY-MM-DD` for all-day rows, the full ISO instant otherwise. */
function schemaDate(date: string, allDay: boolean): string {
  return allDay || !date.includes("T") ? date.slice(0, 10) : date;
}

function eventStatusUrl(event: CountdownEvent): string {
  const rescheduled = (event.dateHistory?.length ?? 0) > 0;
  switch (event.status) {
    case "cancelled":
      return `${SCHEMA}/EventCancelled`;
    case "postponed":
      return rescheduled ? `${SCHEMA}/EventRescheduled` : `${SCHEMA}/EventPostponed`;
    default:
      return rescheduled ? `${SCHEMA}/EventRescheduled` : `${SCHEMA}/EventScheduled`;
  }
}

function placeOf(event: CountdownEvent): JsonLdObject | undefined {
  const loc = event.location;
  if (!loc) return undefined;
  const address: JsonLdObject = { "@type": "PostalAddress" };
  if (loc.city) address.addressLocality = loc.city;
  if (loc.country) address.addressCountry = loc.country;
  const place: JsonLdObject = { "@type": "Place", name: loc.name ?? loc.city ?? loc.country ?? event.title };
  if (loc.city || loc.country) place.address = address;
  if (loc.lat !== undefined && loc.lng !== undefined) {
    place.geo = { "@type": "GeoCoordinates", latitude: loc.lat, longitude: loc.lng };
  }
  if (loc.url) place.url = loc.url;
  return place;
}

/** schema.org Event, or null when the row is not eligible (holidays, eclipses, releases…). */
export function eventJsonLd(event: CountdownEvent): JsonLdObject | null {
  if (!event.jsonldEligible) return null;
  const place = placeOf(event);
  if (!place) return null;
  const out: JsonLdObject = {
    "@context": SCHEMA,
    "@type": "Event",
    name: event.title,
    startDate: schemaDate(event.date, event.allDay),
    eventStatus: eventStatusUrl(event),
    eventAttendanceMode: `${SCHEMA}/OfflineEventAttendanceMode`,
    // Our own prose, never the CC BY-SA Wikipedia summary: JSON-LD is machine-readable
    // redistribution with nowhere to carry the attribution the licence requires. The summary
    // stays on the event page, under its "Summary from Wikipedia (CC BY-SA 4.0)" credit.
    location: place,
    description: event.description || eventDescription(event),
    url: absoluteUrl(`/event/${event.slug}`),
  };
  if (event.endDate) out.endDate = schemaDate(event.endDate, event.allDay);
  if (event.image?.url) out.image = [event.image.url];
  const previous = event.dateHistory?.at(-1)?.date;
  if (previous && out.eventStatus === `${SCHEMA}/EventRescheduled`) {
    out.previousStartDate = schemaDate(previous, event.allDay);
  }
  return out;
}

/**
 * EventSeries for a series page. `subEvent` carries schema.org `Event` items only for occurrences
 * that are `jsonld_eligible` (attendable, with a place) — the same gate as `eventJsonLd()` — so a
 * holiday series never emits location-less Events that Search Console flags. Every other series
 * keeps the EventSeries with `startDate`/`endDate`/`url` and no `subEvent`.
 */
export function eventSeries(series: Series, occurrences: CountdownEvent[]): JsonLdObject {
  const out: JsonLdObject = {
    "@context": SCHEMA,
    "@type": "EventSeries",
    name: series.title,
    url: absoluteUrl(`/days-until/${series.slug}`),
    description: series.summary || series.description || `Upcoming dates of ${series.title}.`,
  };
  if (series.nextDate) out.startDate = schemaDate(series.nextDate, series.nextAllDay ?? true);
  const last = occurrences.at(-1);
  if (last) out.endDate = schemaDate(last.endDate ?? last.date, last.allDay);
  const subEvents = occurrences
    .filter((o) => o.jsonldEligible === true)
    .slice(0, 20)
    .map((o) => {
      const place = placeOf(o);
      if (!place) return null;
      return {
        "@type": "Event",
        name: o.title,
        startDate: schemaDate(o.date, o.allDay),
        ...(o.endDate ? { endDate: schemaDate(o.endDate, o.allDay) } : {}),
        url: absoluteUrl(`/event/${o.slug}`),
        eventStatus: eventStatusUrl(o),
        eventAttendanceMode: `${SCHEMA}/OfflineEventAttendanceMode`,
        location: place,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);
  if (subEvents.length > 0) out.subEvent = subEvents;
  return out;
}
