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

export function formatCompactDate(date: string): string {
  if (!isValidDate(date)) return "—";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(utcParts(date));
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

function shiftDay(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate.slice(0, 10) || "1970-01-01";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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
