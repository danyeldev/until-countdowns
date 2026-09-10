import { regionLabel } from "./regions";
import { absoluteUrl } from "./seo";
import { googleDates, icsDate, isValidDate, shiftDay } from "./time";
import type { CountdownEvent } from "./types";

/** The countdown's own page, unless the caller knows a better one (a share payload, a series). */
function pageUrlFor(event: CountdownEvent, pageUrl?: string): string {
  return pageUrl || absoluteUrl(`/event/${event.slug}`);
}

/**
 * How long an entry runs when the row gives no end: an hour — the value the three inline
 * `3_600_000` literals here already used, kept rather than re-judged. Named because all three
 * builders now reach it through `timedEndIso()`, so the ICS and the two links cannot drift apart
 * on it.
 */
const DEFAULT_DURATION_MS = 3_600_000;

/**
 * Body of the calendar entry.
 *
 * A bare description is not much use when the reminder fires eight months later: the one thing
 * someone wants then is the way back. So it carries the countdown's page, and the source the date
 * came from when the catalog has one. Google and Outlook both linkify a bare URL in the body, and
 * the ICS repeats the page in `URL:` for clients that show that as a field of its own.
 */
export function calendarDescription(event: CountdownEvent, pageUrl?: string): string {
  const page = pageUrlFor(event, pageUrl);
  const lines = [event.description?.trim() || event.title];
  lines.push("", `Countdown: ${page}`);
  if (event.sourceUrl && event.sourceUrl !== page) lines.push(`Source: ${event.sourceUrl}`);
  return lines.join("\n");
}

/**
 * The place, written the way an address is written: venue, then city, then country — narrowest
 * first, which is also the order that survives a client truncating a one-line field.
 *
 * Two rules the catalog's data forces:
 *
 *  - A bare country is not a place. "Japan" in a calendar entry tells the reader nothing the
 *    country tag on the page did not, and it leaves a client to drop a pin in the middle of the
 *    country. So the string needs a venue or a city; the country only ever qualifies one of those.
 *    This is a live shape, not a hypothetical: confs.ts gives an in-person conference whose country
 *    resolved but whose city it could not read exactly `{ country }` (an online one gets no
 *    location at all).
 *  - `location.country` is not one shape across sources: musicbrainz, espn and confs store an
 *    ISO-3166 alpha-2 code, liquipedia stores the English name ("United States"). `regionLabel()`
 *    expands a code it knows and passes anything else through untouched, which covers both.
 *
 * Duplicates are dropped case-insensitively: a venue named after its city ("Roskilde, Roskilde") or
 * a city-state whose city and country resolve to the same name ("Singapore, Singapore") would
 * otherwise read like a typo.
 */
export function calendarLocation(event: CountdownEvent): string {
  const loc = event.location;
  if (!loc) return "";
  const venue = loc.name?.trim() ?? "";
  const city = loc.city?.trim() ?? "";
  if (!venue && !city) return "";
  const rawCountry = loc.country?.trim() ?? "";
  const country = rawCountry ? regionLabel(rawCountry) : "";
  const parts: string[] = [];
  for (const part of [venue, city, country]) {
    if (!part) continue;
    if (parts.some((p) => p.toLowerCase() === part.toLowerCase())) continue;
    parts.push(part);
  }
  return parts.join(", ");
}

/**
 * Whether the entry is an instant rather than a whole day.
 *
 * `allDay` alone is not enough to decide that, because the flag and the granularity of `date` are
 * set independently: `buildEvent()` keeps a caller's `allDay: false` even when the date it was
 * handed is a bare `YYYY-MM-DD`. No row is shaped that way today — the only caller that passes the
 * flag through is curated.ts, and both of its `allDay: false` entries carry an instant date — but
 * one entry that pairs `allDay: false` with a day-precision date would be enough. Trusting the flag
 * there emits `DTSTART:20380119` (measured against the pre-fix builder): a DATE value on a property
 * whose default value type is DATE-TIME, which is malformed — and it invents a midnight the row
 * never claimed for the hosted links. The date itself is the honest witness.
 */
function isTimed(event: CountdownEvent): boolean {
  return !event.allDay && event.date.includes("T");
}

/** Day part of a catalog date, `YYYY-MM-DD`, whether or not it carries a time. */
function dayOf(date: string): string {
  return date.slice(0, 10);
}

/**
 * Last day an all-day entry covers, inclusive. Falls back to the start day when there is no end,
 * and also when the end precedes the start: `events_end_after_start` forbids that in the database
 * (`left(end_date, 10) >= left(date, 10)`), but personal countdowns and share payloads never pass
 * through it, and RFC 5545 §3.8.2.2 requires DTEND to be later than DTSTART. What a given client
 * does with a file that breaks that is unverified from here; not writing one is cheaper than
 * finding out.
 */
function lastDayOf(event: CountdownEvent): string {
  const start = dayOf(event.date);
  if (!event.endDate || !isValidDate(event.endDate)) return start;
  const end = dayOf(event.endDate);
  return end >= start ? end : start;
}

/**
 * The exclusive end instant of a timed entry, as an ISO string.
 *
 * RFC 5545 §3.8.2.2: DTEND is non-inclusive and MUST carry the same value type as DTSTART. So a row
 * that pairs an instant start with a day-granularity end — a run that opens 19:00 on the 9th and
 * plays through the 10th — cannot hand its end straight through. `20270710` is a DATE value on a
 * DATE-TIME property, and `2027-07-10T00:00:00Z` (what `new Date()` makes of the same string) ends
 * the entry at the *start* of its last day, which is how the two links lose that day.
 *
 * No adapter builds that pair today — read off the adapters, not off the stored rows, which cannot
 * be queried from here: every `buildEvent()` call that passes an `endDate` passes a day-granularity
 * date beside it, and every instant-dated call (ll2, tvmaze, espn, football-data, astronomy) passes
 * no end at all. The one call site that could pass both is curated.ts, which forwards whatever an
 * entry declares, and neither of its two `allDay: false` entries carries an end. But the type permits
 * the pair, the `end_date text` column permits it (its check is a prefix match, so a time passes),
 * and one adapter setting `allDay: !instant` beside a day-granularity end would produce it, so the
 * builder is total over it rather than trusting that nothing upstream will ever ask.
 *
 * The end of day D is the start of day D+1, and DTEND being exclusive is exactly what makes that
 * the right instant — the same +1 the all-day branch and `googleDates()` apply.
 *
 * That boundary is taken in UTC: the ICS carries UTC instants throughout (`icsDate()` emits `…Z`)
 * and a date-only end names no zone of its own. For a row that has a `timezone`, local midnight is
 * up to 14 hours away from this one; a day-granularity end cannot say which of the two the source
 * meant, so the builder does not pretend to know.
 */
function timedEndIso(event: CountdownEvent): string {
  const startMs = new Date(event.date).getTime();
  const raw = event.endDate && isValidDate(event.endDate) ? event.endDate : null;
  const endMs = raw
    ? raw.includes("T")
      ? new Date(raw).getTime()
      : Date.parse(`${shiftDay(raw, 1)}T00:00:00Z`)
    : Number.NaN;
  // An end that is not later than the start (dates entered backwards) gets the default hour rather
  // than a DTEND the RFC forbids.
  const resolved = Number.isFinite(endMs) && endMs > startMs ? endMs : startMs + DEFAULT_DURATION_MS;
  return new Date(resolved).toISOString();
}

/**
 * The query parameter both hosted composers read for the place.
 *
 * Read this before trusting it: GUESS. The name was chosen offline, with no way to open either
 * composer. `location` is believed to be the parameter both Google's `calendar/render?action=
 * TEMPLATE` template and Outlook's `calendar/.../action/compose` deeplink read, and believed to be
 * the same word in both — neither was checked against a live request. If a generated link ever
 * opens with an empty place field, this is the first thing to re-check; nothing else in the link
 * depends on it, since an unrecognised query parameter is expected to be ignored, not rejected.
 */
const LOCATION_PARAM = "location";

export function googleCalendarUrl(event: CountdownEvent, pageUrl?: string): string {
  if (!isValidDate(event.date)) return "#";
  const timed = isTimed(event);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    // `!timed`, not `event.allDay`: `googleDates()` reads the flag to pick DATE vs DATE-TIME halves
    // of the range, so it has to be told the same thing the ICS decided, from the same evidence.
    dates: googleDates(event.date, timed ? timedEndIso(event) : lastDayOf(event), !timed),
    details: calendarDescription(event, pageUrl),
  });
  // Omitted rather than sent empty: a blank place row is worse than none. See LOCATION_PARAM.
  const where = calendarLocation(event);
  if (where) params.set(LOCATION_PARAM, where);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(event: CountdownEvent, pageUrl?: string): string {
  if (!isValidDate(event.date)) return "#";
  const timed = isTimed(event);
  const start = timed ? new Date(event.date).toISOString() : `${dayOf(event.date)}T00:00:00`;
  // The all-day end stays inclusive (`23:59:59` on the last day): unchanged from before this
  // change, because whether Outlook wants an inclusive or an exclusive end alongside `allday=true`
  // is a GUESS with no live link to test it against, and a guess is not a reason to move it. What
  // did change is that it is built from the day part, so an end carrying a time can no longer
  // produce `2027-07-11T23:00:00ZT23:59:59`.
  const end = timed ? timedEndIso(event) : `${lastDayOf(event)}T23:59:59`;
  const params = new URLSearchParams({
    rru: "addevent",
    subject: event.title,
    startdt: start,
    enddt: end,
    body: calendarDescription(event, pageUrl),
    allday: timed ? "false" : "true",
  });
  const where = calendarLocation(event);
  if (where) params.set(LOCATION_PARAM, where);
  return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}

/**
 * `GEO:lat;lng` — RFC 5545 §3.8.1.6. Two FLOAT values separated by a semicolon, which is *not* the
 * TEXT delimiter here and must not be escaped.
 *
 * Worth the one line: it is lossless (the coordinates are already on the row), it is ignored
 * silently by clients that do not read it, and where it is read it pins the venue exactly instead
 * of leaving a geocoder to guess which "The Forum" the text meant. GEO is never a substitute for
 * LOCATION — it is not human-readable — so it is emitted alongside, never instead.
 *
 * GUESS: which clients actually act on a bare GEO (as opposed to Apple's X-APPLE-STRUCTURED-LOCATION
 * or a geocoded LOCATION string) was not verifiable offline. The line is cheap either way.
 *
 * Guarded, because a bad pin is worse than none: both values finite and in range, and never exactly
 * 0,0 — Null Island is what a missing coordinate looks like once it has been through a parser that
 * coerced an empty string to a number.
 */
function geoValue(event: CountdownEvent): string | null {
  const lat = event.location?.lat;
  const lng = event.location?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  // Six decimal places is the precision RFC 5545 §3.8.1.6 has receivers accept (finer values they
  // may truncate), and ~0.1 m of latitude — well past what naming a venue needs.
  return `${lat.toFixed(6)};${lng.toFixed(6)}`;
}

export function icsContent(event: CountdownEvent, pageUrl?: string): string {
  if (!isValidDate(event.date)) return "BEGIN:VCALENDAR\r\nEND:VCALENDAR";
  const uid = `${event.id}@until`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const timed = isTimed(event);
  const start = icsDate(event.date, !timed);
  // RFC 5545: an all-day DTEND (VALUE=DATE) is exclusive, so it is the day AFTER the last day —
  // the same +1 that googleDates() applies. A timed one is exclusive too; see timedEndIso().
  const end = timed ? icsDate(timedEndIso(event), false) : icsDate(shiftDay(lastDayOf(event), 1), true);
  const where = calendarLocation(event);
  const geo = geoValue(event);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Until//Countdowns//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    timed ? `DTSTART:${start}` : `DTSTART;VALUE=DATE:${start}`,
    timed ? `DTEND:${end}` : `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(calendarDescription(event, pageUrl))}`,
    // LOCATION is a TEXT value like SUMMARY and DESCRIPTION (§3.8.1.7), and this one is built from
    // a comma-joined address: unescaped, its commas and any semicolon in a venue's name are TEXT
    // delimiters (§3.3.11) that a parser is free to split the value on.
    where ? `LOCATION:${escapeIcs(where)}` : null,
    geo ? `GEO:${geo}` : null,
    // `URL` is a URI value, not TEXT: its commas and semicolons are part of the address and must
    // not be escaped the way the description's are.
    `URL:${pageUrlFor(event, pageUrl)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.filter((l): l is string => l !== null).map(foldIcsLine).join("\r\n");
}

/**
 * TEXT escaping, RFC 5545 §3.3.11. The newline rule comes last on purpose: it introduces a
 * backslash of its own, which the first rule must not have already doubled.
 */
function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

const ICS_LINE_OCTETS = 75;

/**
 * RFC 5545 §3.1: a content line should not exceed 75 octets, and a longer one continues on the
 * next line after a single space. Counted in octets rather than characters — a description
 * carrying an em dash, or a title in Arabic or Thai, would otherwise be cut through the middle of
 * a UTF-8 sequence. Iterating the string yields whole code points, so an emoji stays intact too.
 */
function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= ICS_LINE_OCTETS) return line;
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // Every line after the first spends one octet on the leading space that marks it a continuation.
    const limit = parts.length === 0 ? ICS_LINE_OCTETS : ICS_LINE_OCTETS - 1;
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function downloadIcs(event: CountdownEvent, pageUrl?: string) {
  const blob = new Blob([icsContent(event, pageUrl)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.slug}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
