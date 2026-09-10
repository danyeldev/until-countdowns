/**
 * JSON-LD builders. Kept deliberately small: BreadcrumbList everywhere, WebSite + Organization on
 * the home page, CollectionPage (+ ItemList) on hubs, EventSeries on series pages and schema.org
 * Event only for rows the finalize job marked `jsonld_eligible` (attendable events with a place).
 * No FAQPage and no SearchAction: neither earns a rich result any more.
 */
import type { Localized } from "./i18n/bind";
import { localeMeta } from "./i18n/config";
import { absoluteUrl, displayTitle, eventDescription, localeUrl, SITE_NAME } from "./seo";
import type { CountdownEvent, Series } from "./types";

export type JsonLdObject = Record<string, unknown>;

const SCHEMA = "https://schema.org";

export type Crumb = { name: string; path: string };

/**
 * Every builder takes the page's locale: the URLs it emits have to be the locale's own (a Spanish
 * page whose breadcrumbs point at English URLs is telling Google the two are the same document),
 * and `inLanguage` is what makes the graph agree with the `hreflang` cluster.
 */
export function breadcrumbList(L: Localized, items: Crumb[]): JsonLdObject {
  return {
    "@context": SCHEMA,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: localeUrl(L.locale, item.path),
    })),
  };
}

export function webSite(L: Localized): JsonLdObject {
  return {
    "@context": SCHEMA,
    "@type": "WebSite",
    name: SITE_NAME,
    url: localeUrl(L.locale, "/"),
    inLanguage: localeMeta(L.locale).lang,
    description: L.m.seo.jsonLd.siteDescription,
  };
}

export function organization(): JsonLdObject {
  return {
    "@context": SCHEMA,
    "@type": "Organization",
    name: SITE_NAME,
    // Language-neutral: one organisation, described once, at the site's canonical root.
    url: absoluteUrl("/"),
    logo: absoluteUrl("/og/default"),
  };
}

export type CollectionItem = { name: string; path: string };

export function collectionPage(
  L: Localized,
  name: string,
  description: string,
  path: string,
  items: CollectionItem[],
): JsonLdObject {
  return {
    "@context": SCHEMA,
    "@type": "CollectionPage",
    name,
    description,
    url: localeUrl(L.locale, path),
    inLanguage: localeMeta(L.locale).lang,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: localeUrl(L.locale, "/") },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.slice(0, 100).map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.name,
        url: localeUrl(L.locale, item.path),
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
export function eventJsonLd(L: Localized, event: CountdownEvent): JsonLdObject | null {
  if (!event.jsonldEligible) return null;
  const place = placeOf(event);
  if (!place) return null;
  const out: JsonLdObject = {
    "@context": SCHEMA,
    "@type": "Event",
    name: displayTitle(L, event),
    inLanguage: localeMeta(L.locale).lang,
    startDate: schemaDate(event.date, event.allDay),
    eventStatus: eventStatusUrl(event),
    eventAttendanceMode: `${SCHEMA}/OfflineEventAttendanceMode`,
    // Our own prose, never the CC BY-SA Wikipedia summary: JSON-LD is machine-readable
    // redistribution with nowhere to carry the attribution the licence requires. The summary
    // stays on the event page, under its "Summary from Wikipedia (CC BY-SA 4.0)" credit.
    location: place,
    description: event.description || eventDescription(L, event),
    url: localeUrl(L.locale, `/event/${event.slug}`),
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
export function eventSeries(L: Localized, series: Series, occurrences: CountdownEvent[]): JsonLdObject {
  const title = displayTitle(L, series);
  const out: JsonLdObject = {
    "@context": SCHEMA,
    "@type": "EventSeries",
    name: title,
    inLanguage: localeMeta(L.locale).lang,
    url: localeUrl(L.locale, `/days-until/${series.slug}`),
    description: series.summary || series.description || L.t(L.m.seo.jsonLd.seriesDescription, { title }),
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
        name: displayTitle(L, o),
        startDate: schemaDate(o.date, o.allDay),
        ...(o.endDate ? { endDate: schemaDate(o.endDate, o.allDay) } : {}),
        url: localeUrl(L.locale, `/event/${o.slug}`),
        eventStatus: eventStatusUrl(o),
        eventAttendanceMode: `${SCHEMA}/OfflineEventAttendanceMode`,
        location: place,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);
  if (subEvents.length > 0) out.subEvent = subEvents;
  return out;
}
