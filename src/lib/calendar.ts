import { absoluteUrl } from "./seo";
import { googleDates, icsDate, isValidDate, shiftDay } from "./time";
import type { CountdownEvent } from "./types";

/** The countdown's own page, unless the caller knows a better one (a share payload, a series). */
function pageUrlFor(event: CountdownEvent, pageUrl?: string): string {
  return pageUrl || absoluteUrl(`/event/${event.slug}`);
}

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

export function googleCalendarUrl(event: CountdownEvent, pageUrl?: string): string {
  if (!isValidDate(event.date)) return "#";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: googleDates(event.date, event.endDate, event.allDay),
    details: calendarDescription(event, pageUrl),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(event: CountdownEvent, pageUrl?: string): string {
  if (!isValidDate(event.date)) return "#";
  const start = event.allDay
    ? `${event.date}T00:00:00`
    : new Date(event.date).toISOString();
  const end = event.endDate
    ? event.allDay
      ? `${event.endDate}T23:59:59`
      : new Date(event.endDate).toISOString()
    : event.allDay
      ? `${event.date}T23:59:59`
      : new Date(new Date(event.date).getTime() + 3_600_000).toISOString();
  const params = new URLSearchParams({
    rru: "addevent",
    subject: event.title,
    startdt: start,
    enddt: end,
    body: calendarDescription(event, pageUrl),
    allday: event.allDay ? "true" : "false",
  });
  return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}

export function icsContent(event: CountdownEvent, pageUrl?: string): string {
  if (!isValidDate(event.date)) return "BEGIN:VCALENDAR\r\nEND:VCALENDAR";
  const uid = `${event.id}@until`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const start = icsDate(event.date, event.allDay);
  // RFC 5545: an all-day DTEND (VALUE=DATE) is exclusive, so it is the day AFTER the last day —
  // the same +1 that googleDates() applies. Timed events without an end default to one hour.
  const end = event.allDay
    ? icsDate(shiftDay(event.endDate && isValidDate(event.endDate) ? event.endDate : event.date, 1), true)
    : event.endDate && isValidDate(event.endDate)
      ? icsDate(event.endDate, false)
      : icsDate(new Date(new Date(event.date).getTime() + 3_600_000).toISOString(), false);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Until//Countdowns//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    event.allDay ? `DTSTART;VALUE=DATE:${start}` : `DTSTART:${start}`,
    event.allDay ? `DTEND;VALUE=DATE:${end}` : `DTEND:${end}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(calendarDescription(event, pageUrl))}`,
    // `URL` is a URI value, not TEXT: its commas and semicolons are part of the address and must
    // not be escaped the way the description's are.
    `URL:${pageUrlFor(event, pageUrl)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldIcsLine).join("\r\n");
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
