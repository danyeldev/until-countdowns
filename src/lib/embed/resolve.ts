/**
 * Slug → `EmbedSubject`, shared by the embed document and the oEmbed provider so the two agree on
 * exactly which URLs exist: whatever can be framed can also be pasted into WordPress.
 *
 * Server-side only — it reads the catalog. The lenient readers (`getEvent`, not `getEventStrict`)
 * are deliberate: a database blip should leave a widget on someone else's page showing our polite
 * "countdown not found" card for five minutes, not a 500 inside their layout.
 */
import { getEvent, getSeries, resolveSeriesAlias, resolveSlugAlias } from "@/lib/catalog";
import type { EmbedSubject } from "@/lib/embed/html";
import { absoluteUrl } from "@/lib/seo";
import { isCoarsePrecision } from "@/lib/time";
import { decodeSharePayload } from "@/lib/user-events";

/**
 * Longest slug worth reading. It bounds the work a pathological URL can ask for rather than shaping
 * behaviour, so it sits well above any real share payload — Next and the platform cap the request
 * URL long before this. Over the limit is a refusal, never a truncation: half a base64 payload
 * decodes to nothing, which would 404 a countdown whose own `/event/share-…` page renders fine.
 */
export const EMBED_SLUG_MAX = 8192;

/** The subject behind `/embed/<slug>`, or null when there is nothing to count down to. */
export async function resolveEmbedSubject(slug: string): Promise<EmbedSubject | null> {
  if (!slug || slug.length > EMBED_SLUG_MAX) return null;

  if (slug.startsWith("share-")) {
    const shared = decodeSharePayload(slug.slice("share-".length));
    if (!shared) return null;
    // A personal countdown carried entirely in its own URL: no catalog read, and the click-through
    // has to keep the payload, since the `mine-…` id it decodes to means nothing to a visitor.
    return {
      slug,
      title: shared.title,
      description: shared.description,
      date: shared.date,
      allDay: shared.allDay,
      href: absoluteUrl(`/event/${slug}`),
    };
  }

  // `mine-…` can never resolve here: it lives in one browser's localStorage, and a third-party
  // iframe is storage-partitioned away from that anyway. Embedding one means sharing it first,
  // which mints the self-contained `share-…` payload above.
  if (slug.startsWith("mine-")) return null;

  let event = await getEvent(slug);
  if (!event) {
    const current = await resolveSlugAlias(slug);
    if (current) event = await getEvent(current);
  }
  if (event) {
    // Same rule the series branch applies below, and the same one the event page applies to its own
    // clock: a month- or year-precision row carries a placeholder day, so there is nothing to tick.
    if (isCoarsePrecision(event.datePrecision)) return null;
    return {
      slug: event.slug,
      title: event.title,
      description: event.description,
      date: event.date,
      allDay: event.allDay,
      href: absoluteUrl(`/event/${event.slug}`),
    };
  }

  // The evergreen case, and the reason the fallback earns its place: a series embed ticks to
  // whichever occurrence is next, so `/embed/christmas` pasted into a sidebar this year is still
  // counting down in five years' time, where an occurrence embed goes dark the day after its date.
  let series = await getSeries(slug);
  if (!series) {
    const canonical = await resolveSeriesAlias(slug);
    if (canonical) series = await getSeries(canonical);
  }
  // No next date, or one the source has only pinned to a month or a year: there is no clock to
  // show, and a widget that reads "expected 2029" is better served by the page itself.
  if (!series?.nextDate || isCoarsePrecision(series.nextPrecision)) return null;
  return {
    slug: series.slug,
    title: series.title,
    description: series.description,
    date: series.nextDate,
    allDay: series.nextAllDay ?? true,
    href: absoluteUrl(`/days-until/${series.slug}`),
  };
}
