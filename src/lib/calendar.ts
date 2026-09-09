import type { CountdownEvent } from "./types";
import { googleDates, icsDate, isValidDate } from "./time";

export function googleCalendarUrl(event: CountdownEvent): string {
  if (!isValidDate(event.date)) return "#";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: googleDates(event.date, event.endDate, event.allDay),
    details: event.description || `Countdown via Until — ${event.title}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(event: CountdownEvent): string {
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
    body: event.description || event.title,
    allday: event.allDay ? "true" : "false",
  });
  return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}

export function icsContent(event: CountdownEvent): string {
  if (!isValidDate(event.date)) return "BEGIN:VCALENDAR\r\nEND:VCALENDAR";
  const uid = `${event.id}@until`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const start = icsDate(event.date, event.allDay);
  const end = event.endDate
    ? icsDate(event.endDate, event.allDay)
    : event.allDay
      ? icsDate(event.date, true)
      : icsDate(new Date(new Date(event.date).getTime() + 3_600_000).toISOString(), false);
  const desc = (event.description || event.title).replace(/\n/g, "\\n");
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
    `DESCRIPTION:${escapeIcs(desc)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function downloadIcs(event: CountdownEvent) {
  const blob = new Blob([icsContent(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.slug}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
