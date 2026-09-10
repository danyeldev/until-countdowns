import { getDailyPanchang, type GeoLocation } from "panchang-ts";

/**
 * Kshaya fallback for the festival table. panchang-ts emits a festival only when its tithi
 * touches the festival's anchor instant (sunrise for Holi, sunset for Diwali …). Roughly once
 * a decade per festival the tithi begins after that anchor and ends before the next one — a
 * "kshaya" (skipped) tithi — and the table has no entry for the year (Holi 2028, Diwali 2036).
 * Almanacs then observe the festival on the civil day in which the tithi ends: a tithi lasts
 * 20–27 h, so a kshaya tithi always ends after midnight of the following day, and that is
 * the day the puja happens. The scan below finds that day for one (month, paksha, tithi).
 */

export type TithiRule = {
  /** Purnimanta lunar month, 0 = Chaitra … 7 = Kartika … 11 = Phalguna. */
  month: number;
  paksha: "Shukla" | "Krishna";
  /** 1–15; 15 is Purnima (Shukla) or Amavasya (Krishna). */
  number: number;
  /** Inclusive Gregorian scan window as `MM-DD` (the lunar month drifts about a month either way). */
  from: string;
  to: string;
};

const IST_OFFSET_MINUTES = 330;

/** Civil `YYYY-MM-DD` in IST of an instant. */
export function istDay(t: Date): string {
  return new Date(t.getTime() + IST_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

function* daysBetween(year: number, from: string, to: string): Generator<Date> {
  const [fm, fd] = from.split("-").map(Number);
  const [tm, td] = to.split("-").map(Number);
  // Local IST midnight is 18:30 UTC of the previous day; 00:30 UTC (06:00 IST) sits safely inside the day.
  const start = Date.UTC(year, fm - 1, fd, 0, 30);
  const end = Date.UTC(year, tm - 1, td, 0, 30);
  for (let t = start; t <= end; t += 86_400_000) yield new Date(t);
}

/**
 * The IST civil day on which the tithi ends in the given year, or null when the scan window
 * holds no such tithi (an adhika month or an engine gap). Only the true end instant counts:
 * the last segment of a panchang day is clamped to the next sunrise, so a segment is read
 * from the day it ends in, never from the day it starts in.
 */
export function tithiEndDay(year: number, rule: TithiRule, location: GeoLocation): string | null {
  for (const day of daysBetween(year, rule.from, rule.to)) {
    let p: ReturnType<typeof getDailyPanchang>;
    try {
      p = getDailyPanchang(day, location, { timezone: IST_OFFSET_MINUTES, language: "en", sections: [] });
    } catch {
      continue;
    }
    if (!p) continue;
    const cm = p.calendar.chandramasa;
    if (cm.purnimantaIndex !== rule.month || cm.isAdhika) continue;
    const tithis = p.angas.tithis;
    for (let i = 0; i < tithis.length - 1; i++) {
      const t = tithis[i];
      if (t.number === rule.number && t.paksha === rule.paksha && t.endTime) return istDay(t.endTime);
    }
  }
  return null;
}

/** `YYYY-MM-DD` plus `n` days. */
export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * The last IST civil day of the year on which the tithi is running at local sunset (the
 * pradosha rule: Holika Dahan is lit on the evening Phalguna Purnima prevails at sunset, and
 * Rangwali Holi is the next day). Null when no sunset in the window falls inside the tithi —
 * in that rare case callers should fall back to `tithiEndDay`. Segments tile
 * [sunrise, nextSunrise], so the segment containing `sun.set` is the one whose start
 * (or sunrise, for the first) is at or before sunset and whose end is after it.
 */
export function tithiAtSunsetLastDay(year: number, rule: TithiRule, location: GeoLocation): string | null {
  let found: string | null = null;
  for (const day of daysBetween(year, rule.from, rule.to)) {
    let p: ReturnType<typeof getDailyPanchang>;
    try {
      p = getDailyPanchang(day, location, { timezone: IST_OFFSET_MINUTES, language: "en", sections: [] });
    } catch {
      continue;
    }
    if (!p) continue;
    const cm = p.calendar.chandramasa;
    if (cm.purnimantaIndex !== rule.month || cm.isAdhika) {
      if (found) break;
      continue;
    }
    const set = p.sun.set.getTime();
    const tithis = p.angas.tithis;
    for (let i = 0; i < tithis.length; i++) {
      const t = tithis[i];
      const start = i === 0 ? p.sun.rise.getTime() : (t.startTime ?? p.sun.rise).getTime();
      const end = (t.endTime ?? p.sun.nextRise).getTime();
      if (start <= set && set < end) {
        if (t.number === rule.number && t.paksha === rule.paksha) found = istDay(p.sun.set);
        else if (found) return found;
        break;
      }
    }
  }
  return found;
}
