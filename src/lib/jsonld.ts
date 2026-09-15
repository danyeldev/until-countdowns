/**
 * JSON-LD builders. Kept deliberately small: BreadcrumbList everywhere, WebSite + Organization on
 * the home page, CollectionPage (+ ItemList) on hubs, EventSeries on series pages and schema.org
 * Event only for rows the finalize job marked `jsonld_eligible` (attendable events with a place).
 * No FAQPage and no SearchAction: neither earns a rich result any more.
 */
import { absoluteUrl, eventDescription, SITE_DESCRIPTION, SITE_NAME } from "./seo";
import { isCoarsePrecision, isValidDate } from "./time";
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
    "@id": absoluteUrl("/#website"),
    name: SITE_NAME,
    url: absoluteUrl("/"),
    inLanguage: "en",
    description: SITE_DESCRIPTION,
    publisher: { "@id": absoluteUrl("/#organization") },
  };
}

export function organization(): JsonLdObject {
  return {
    "@context": SCHEMA,
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: { "@type": "ImageObject", url: absoluteUrl("/icons/icon-512.png"), width: 512, height: 512 },
  };
}

export type CollectionItem = { name: string; path: string };

export function profilePage(name: string, handle: string): JsonLdObject {
  const path = `/${handle}`;
  return {
    "@context": SCHEMA,
    "@type": "ProfilePage",
    "@id": absoluteUrl(`${path}#profile`),
    name: `${name} (@${handle})`,
    url: absoluteUrl(path),
    inLanguage: "en",
    isPartOf: { "@id": absoluteUrl("/#website") },
    mainEntity: {
      "@type": "Person",
      name,
      alternateName: `@${handle}`,
      url: absoluteUrl(path),
    },
  };
}

export function collectionPage(name: string, description: string, path: string, items: CollectionItem[]): JsonLdObject {
  return {
    "@context": SCHEMA,
    "@type": "CollectionPage",
    "@id": absoluteUrl(`${path}#collection`),
    name,
    description,
    url: absoluteUrl(path),
    inLanguage: "en",
    isPartOf: { "@id": absoluteUrl("/#website") },
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
      return `${SCHEMA}/EventPostponed`;
    default:
      return rescheduled ? `${SCHEMA}/EventRescheduled` : `${SCHEMA}/EventScheduled`;
  }
}

function placeOf(event: CountdownEvent): JsonLdObject | undefined {
  const loc = event.location;
  if (!loc || (!loc.name?.trim() && !loc.city?.trim() && !loc.country?.trim())) return undefined;
  const address: JsonLdObject = { "@type": "PostalAddress" };
  if (loc.city) address.addressLocality = loc.city;
  if (loc.country) address.addressCountry = loc.country;
  const place: JsonLdObject = { "@type": "Place", name: loc.name ?? loc.city ?? loc.country ?? event.title };
  if (loc.city || loc.country) place.address = address;
  if (Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
    place.geo = { "@type": "GeoCoordinates", latitude: loc.lat, longitude: loc.lng };
  }
  if (loc.url) place.url = loc.url;
  return place;
}

/** schema.org Event, or null when the row is not eligible (holidays, eclipses, releases…). */
export function eventJsonLd(event: CountdownEvent): JsonLdObject | null {
  if (!event.jsonldEligible || isCoarsePrecision(event.datePrecision) || !isValidDate(event.date)) return null;
  const place = placeOf(event);
  if (!place) return null;
  const out: JsonLdObject = {
    "@context": SCHEMA,
    "@type": "Event",
    "@id": absoluteUrl(`/event/${event.slug}#event`),
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
  if (event.endDate && isValidDate(event.endDate)) out.endDate = schemaDate(event.endDate, event.allDay);
  if (event.image?.url) out.image = [event.image.url];
  const previous = event.dateHistory?.at(-1)?.date;
  if (previous && isValidDate(previous) && out.eventStatus === `${SCHEMA}/EventRescheduled`) {
    out.previousStartDate = schemaDate(previous, event.allDay);
  }
  return out;
}

/**
 * Attendable series carry qualified Event children. Other recurring dates are collections,
 * without fictional exact start dates or location-less Event markup for holidays and releases.
 */
export function eventSeries(series: Series, occurrences: CountdownEvent[]): JsonLdObject {
  const description = series.description || `Upcoming dates of ${series.title}.`;
  const subEvents = occurrences
    .map(eventJsonLd)
    .filter((event): event is JsonLdObject => event !== null)
    .slice(0, 20)
    .map((event) => {
      const child = { ...event };
      delete child["@context"];
      return child;
    });
  if (subEvents.length === 0) {
    return collectionPage(series.title, description, `/days-until/${series.slug}`, occurrences.map((event) => ({
      name: event.title,
      path: `/event/${event.slug}`,
    })));
  }
  const out: JsonLdObject = {
    "@context": SCHEMA,
    "@type": "EventSeries",
    "@id": absoluteUrl(`/days-until/${series.slug}#series`),
    name: series.title,
    url: absoluteUrl(`/days-until/${series.slug}`),
    description,
    subEvent: subEvents,
  };
  return out;
}
