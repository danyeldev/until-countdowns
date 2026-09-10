import { Lunar } from "lunar-typescript";
import { isoDate } from "./normalize";

/**
 * Calendar arithmetic for the recurring series in src/data/series.ts. Everything works in
 * UTC on `YYYY-MM-DD` strings; no wall-clock reads.
 */

export type Ymd = { y: number; m: number; d: number };

export function toIso({ y, m, d }: Ymd): string {
  return isoDate(y, m, d);
}

export function fromUtc(t: number): Ymd {
  const dt = new Date(t);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

export function addDays(date: Ymd, days: number): Ymd {
  return fromUtc(Date.UTC(date.y, date.m - 1, date.d + days));
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return toIso(addDays({ y, m, d }, days));
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: Ymd): number {
  return new Date(Date.UTC(date.y, date.m - 1, date.d)).getUTCDay();
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * The n-th `weekday` of a month (n = 1..5), or the last one when n = -1 (−2 = second to last …).
 * Returns null when the month has no such occurrence (a 5th Monday, say).
 */
export function nthWeekday(y: number, m: number, wd: number, n: number): Ymd | null {
  if (n > 0) {
    const first = weekday({ y, m, d: 1 });
    const d = 1 + ((wd - first + 7) % 7) + (n - 1) * 7;
    return d <= daysInMonth(y, m) ? { y, m, d } : null;
  }
  const lastDay = daysInMonth(y, m);
  const last = weekday({ y, m, d: lastDay });
  const d = lastDay - ((last - wd + 7) % 7) + (n + 1) * 7;
  return d >= 1 ? { y, m, d } : null;
}

/** First `weekday` strictly after the given date. */
export function nextWeekdayAfter(date: Ymd, wd: number): Ymd {
  const cur = weekday(date);
  const delta = ((wd - cur + 7) % 7) || 7;
  return addDays(date, delta);
}

/** First `weekday` on or before the given date. */
export function weekdayOnOrBefore(date: Ymd, wd: number): Ymd {
  const cur = weekday(date);
  return addDays(date, -((cur - wd + 7) % 7));
}

/** Gregorian Easter Sunday (Anonymous Gregorian algorithm / Meeus–Jones–Butcher). */
export function easterSunday(y: number): Ymd {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { y, m: month, d: day };
}

/**
 * Orthodox (Julian) Easter via Meeus' Julian algorithm, converted to the Gregorian calendar.
 * The Julian→Gregorian offset is 13 days for 1900–2099 and 14 days for 2100–2199.
 */
export function orthodoxEaster(y: number): Ymd {
  const a = y % 4;
  const b = y % 7;
  const c = y % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const offset = y >= 2100 ? 14 : 13;
  return addDays({ y, m: month, d: day }, offset);
}

/** Solar date of a Chinese lunisolar month/day (Chinese New Year = month 1, day 1). */
export function chineseLunarToSolar(y: number, lunarMonth: number, lunarDay: number): Ymd {
  const solar = Lunar.fromYmd(y, lunarMonth, lunarDay).getSolar();
  return { y: solar.getYear(), m: solar.getMonth(), d: solar.getDay() };
}

/** Day-of-year (1-based) → date. */
export function dayOfYear(y: number, n: number): Ymd {
  return addDays({ y, m: 1, d: 1 }, n - 1);
}

/** Every Friday the 13th of a year. */
export function fridays13(y: number): Ymd[] {
  const out: Ymd[] = [];
  for (let m = 1; m <= 12; m++) if (weekday({ y, m, d: 13 }) === 5) out.push({ y, m, d: 13 });
  return out;
}
