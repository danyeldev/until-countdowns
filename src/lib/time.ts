import type { DatePrecision } from "./types";

/**
 * The calendar day a row belongs to — what the slug carries, what the listings file it under, and
 * what `starts_on` has to agree with.
 *
 * For an all-day date that is simply the date. For an instant it is the day in the event's OWN
 * zone, not in UTC: a 22:00 premiere in New York happens on the 12th where it airs, though its
 * instant is the 13th in UTC. Taking the UTC prefix is what used to force adapters to choose
 * between keeping the time and filing the row on the right day — tvmaze threw the time away.
 * Without a zone there is nothing better to go on than UTC.
 */
export function catalogDay(date: string, timezone?: string | null): string {
  const utcDay = date.slice(0, 10);
  if (!date.includes("T") || !timezone) return utcDay;
  const ms = Date.parse(date);
  if (Number.isNaN(ms)) return utcDay;
  try {
    // en-CA renders as YYYY-MM-DD, which is the shape the rest of the pipeline expects.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(ms);
  } catch {
    // An unrecognised zone must never fail a whole ingest pass.
    return utcDay;
  }
}


export type Remaining = {
  totalMs: number;
  past: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export function isValidDate(date: string | undefined): date is string {
  if (!date) return false;
  const d = date.includes("T") ? new Date(date) : new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

export function eventInstant(date: string, allDay = true): Date {
  if (date.includes("T")) return new Date(date);
  if (allDay) return new Date(`${date}T00:00:00`);
  return new Date(`${date}T00:00:00Z`);
}

export function remainingUntil(date: string, allDay = true, now = Date.now()): Remaining {
  if (!isValidDate(date)) {
    return { totalMs: 0, past: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const target = eventInstant(date, allDay).getTime();
  const totalMs = target - now;
  const past = totalMs <= 0;
  const abs = Math.abs(totalMs);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const seconds = Math.floor((abs % 60_000) / 1_000);
  return { totalMs, past, days, hours, minutes, seconds };
}

function utcParts(date: string): Date {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

export function formatWhen(date: string, allDay = true): string {
  if (!isValidDate(date)) return "Pick a date";
  if (allDay && !date.includes("T")) {
    return new Intl.DateTimeFormat("en", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(utcParts(date));
  }
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(eventInstant(date, allDay));
}

export function formatCompactDate(date: string, timezone?: string | null): string {
  if (!isValidDate(date)) return "—";
  // Rendered from the catalog day, so a listing never contradicts the day the row is filed under.
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(utcParts(catalogDay(date, timezone)));
}

export function formatRange(start: string, end?: string): string {
  if (!end || end === start) return formatWhen(start);
  return `${formatCompactDate(start)} – ${formatCompactDate(end)}`;
}

export function icsDate(date: string, allDay: boolean): string {
  if (!isValidDate(date)) return "19700101";
  if (allDay || !date.includes("T")) {
    return date.slice(0, 10).replace(/-/g, "");
  }
  return new Date(date)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export function googleDates(date: string, endDate: string | undefined, allDay: boolean): string {
  if (!isValidDate(date)) return "19700101/19700102";
  const start = icsDate(date, allDay);
  if (allDay) {
    const end = endDate && isValidDate(endDate)
      ? icsDate(shiftDay(endDate, 1), true)
      : icsDate(shiftDay(date, 1), true);
    return `${start}/${end}`;
  }
  const startMs = new Date(date).getTime();
  const endMs = endDate && isValidDate(endDate) ? new Date(endDate).getTime() : startMs + 3_600_000;
  return `${icsDate(new Date(startMs).toISOString(), false)}/${icsDate(new Date(endMs).toISOString(), false)}`;
}

/** `YYYY-MM-DD` plus/minus whole days (UTC arithmetic on the date part only). */
export function shiftDay(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate.slice(0, 10) || "1970-01-01";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Local calendar date (`YYYY-MM-DD`) of an epoch-ms instant, in the runtime's timezone. Client-side use. */
export function localDateString(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function humanRemaining(r: Remaining): string {
  if (r.past) {
    if (r.days === 0) return "just happened";
    if (r.days === 1) return "yesterday";
    return `${r.days} days ago`;
  }
  if (r.days === 0 && r.hours === 0 && r.minutes < 2) return "moments away";
  if (r.days === 0) return `in ${r.hours}h ${r.minutes}m`;
  if (r.days === 1) return "tomorrow";
  if (r.days < 14) return `in ${r.days} days`;
  if (r.days < 60) return `in ${Math.round(r.days / 7)} weeks`;
  if (r.days < 400) return `in ${Math.round(r.days / 30)} months`;
  return `in ${Math.round(r.days / 365)} years`;
}

/** "today", "tomorrow", "in 3 days", "in 2 weeks", "5 days ago" — from a SQL-computed whole-day delta. */
export function humanDays(days?: number | null): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return "";
  const d = Math.trunc(days);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  const abs = Math.abs(d);
  let n: number;
  let unit: string;
  if (abs < 14) {
    n = abs;
    unit = "day";
  } else if (abs < 60) {
    n = Math.round(abs / 7);
    unit = "week";
  } else if (abs < 400) {
    n = Math.round(abs / 30);
    unit = "month";
  } else {
    n = Math.round(abs / 365);
    unit = "year";
  }
  const label = `${n} ${unit}${n === 1 ? "" : "s"}`;
  return d < 0 ? `${label} ago` : `in ${label}`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Whether a precision is coarser than a calendar day (no ticking clock should be shown). */
export function isCoarsePrecision(precision?: DatePrecision | null): boolean {
  return precision === "month" || precision === "quarter" || precision === "year" || precision === "decade";
}

/** "expected June 2027" (month), "expected Q3 2027" (quarter), "expected 2027" (year / decade). */
export function formatApproximate(date: string, precision?: DatePrecision | null): string {
  if (!isValidDate(date)) return "date to be announced";
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) || 1;
  switch (precision) {
    case "month":
      return `expected ${MONTHS[Math.min(11, Math.max(0, month - 1))]} ${year}`;
    case "quarter":
      return `expected Q${Math.min(4, Math.max(1, Math.ceil(month / 3)))} ${year}`;
    case "year":
    case "decade":
      return `expected ${year}`;
    default:
      return formatWhen(date);
  }
}
