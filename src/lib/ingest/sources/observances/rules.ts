import { Seasons } from "astronomy-engine";
import { isoDate } from "../../normalize";
import { chineseLunarToSolar, easterSunday, addDays, fromUtc, isLeapYear, nthWeekday, toIso, weekday } from "../../recurrence";

/**
 * Day-of-year rules behind Wikidata `P837` (day in year for periodic occurrence). P837 values
 * are items ("March 14", "first Monday in August", "Easter + 39 days") with no numeric month/day,
 * so the English label is parsed into a rule that is expanded per year and kept in
 * `raw.recurrence` for the series page. Anything non-Gregorian (Nisan, Farvardin, Hindu tithis,
 * "variable") is rejected — the religion adapters own those calendars. Pure, no network.
 */

export type Recurrence =
  | { kind: "fixed_day"; month: number; day: number }
  /** `n` 1..5, or -1 for the last one; `weekday` 0 = Sunday … 6 = Saturday. */
  | { kind: "nth_weekday"; n: number; weekday: number; month: number }
  | { kind: "easter_offset"; days: number }
  | { kind: "equinox"; which: "march" | "september" }
  | { kind: "solstice"; which: "june" | "december" }
  | { kind: "chinese_lunar"; month: number; day: number };

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const ORDINALS: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, last: -1 };

const MONTH_RE = MONTHS.join("|");
const WEEKDAY_RE = WEEKDAYS.join("|");
const FIXED_RE = new RegExp(`^(${MONTH_RE}) (\\d{1,2})$`);
const NTH_RE = new RegExp(`^(first|second|third|fourth|fifth|last) (${WEEKDAY_RE}) (?:in|of) (${MONTH_RE})$`, "i");
/** "Easter + 39 days" / "Easter − 47 days" (Wikidata uses U+2212 for the minus). */
const EASTER_RE = /^Easter ([+\-−–]) (\d{1,3}) days?$/i;
const EQUINOX_RE = /^(March|September) equinox$/i;
const SOLSTICE_RE = /^(June|December) solstice$/i;
const CHINESE_RE = /^(\d{1,2})(?:st|nd|rd|th) day of the (\d{1,2})(?:st|nd|rd|th) month (?:of|in) the Chinese (?:lunisolar |lunar )?calendar$/i;

/** Movable feasts that Wikidata links as P837 values by name (offsets from Easter Sunday). */
const EASTER_NAMED: Record<string, number> = {
  easter: 0,
  "easter sunday": 0,
  "date of easter": 0,
  "easter monday": 1,
  "good friday": -2,
  "maundy thursday": -3,
  "holy saturday": -1,
  "palm sunday": -7,
  "ash wednesday": -46,
  "shrove tuesday": -47,
  "feast of the ascension": 39,
  "ascension day": 39,
  pentecost: 49,
  "whit sunday": 49,
  "whit monday": 50,
  "trinity sunday": 56,
  "feast of corpus christi": 60,
  "corpus christi": 60,
};

const FIXED_NAMED: Record<string, { month: number; day: number }> = {
  "new year's day": { month: 1, day: 1 },
  "new year's eve": { month: 12, day: 31 },
  ōmisoka: { month: 12, day: 31 },
  "christmas day": { month: 12, day: 25 },
  christmas: { month: 12, day: 25 },
  "christmas eve": { month: 12, day: 24 },
};

const CHINESE_NAMED: Record<string, { month: number; day: number }> = {
  "lunar/lunisolar new year's day": { month: 1, day: 1 },
  "chinese new year": { month: 1, day: 1 },
  "lunar new year": { month: 1, day: 1 },
};

function monthIndex(name: string): number {
  const i = MONTHS.findIndex((m) => m.toLowerCase() === name.toLowerCase());
  return i + 1;
}

function weekdayIndex(name: string): number {
  return WEEKDAYS.findIndex((w) => w.toLowerCase() === name.toLowerCase());
}

/** English P837 label → rule, or null when the label is not a Gregorian/Easter/season/Chinese-lunar rule. */
export function parseDayLabel(label: string): Recurrence | null {
  const s = String(label ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return null;
  const key = s.toLowerCase();

  const fixed = FIXED_RE.exec(s);
  if (fixed) {
    const month = monthIndex(fixed[1]);
    const day = Number(fixed[2]);
    const maxDay = month === 2 ? 29 : new Date(Date.UTC(2001, month, 0)).getUTCDate();
    if (day < 1 || day > maxDay) return null;
    return { kind: "fixed_day", month, day };
  }
  if (FIXED_NAMED[key]) return { kind: "fixed_day", ...FIXED_NAMED[key] };

  const nth = NTH_RE.exec(s);
  if (nth) {
    return { kind: "nth_weekday", n: ORDINALS[nth[1].toLowerCase()], weekday: weekdayIndex(nth[2]), month: monthIndex(nth[3]) };
  }

  const easter = EASTER_RE.exec(s);
  if (easter) {
    const sign = easter[1] === "+" ? 1 : -1;
    return { kind: "easter_offset", days: sign * Number(easter[2]) };
  }
  if (key in EASTER_NAMED) return { kind: "easter_offset", days: EASTER_NAMED[key] };

  const eq = EQUINOX_RE.exec(s);
  if (eq) return { kind: "equinox", which: eq[1].toLowerCase() as "march" | "september" };
  const sol = SOLSTICE_RE.exec(s);
  if (sol) return { kind: "solstice", which: sol[1].toLowerCase() as "june" | "december" };

  const cn = CHINESE_RE.exec(s);
  if (cn) {
    const day = Number(cn[1]);
    const month = Number(cn[2]);
    if (month < 1 || month > 12 || day < 1 || day > 30) return null;
    return { kind: "chinese_lunar", month, day };
  }
  if (CHINESE_NAMED[key]) return { kind: "chinese_lunar", ...CHINESE_NAMED[key] };

  return null;
}

/** Stable identity of a rule (two labels that mean the same day compare equal). */
export function ruleKey(rule: Recurrence): string {
  switch (rule.kind) {
    case "fixed_day":
      return `fixed:${rule.month}-${rule.day}`;
    case "nth_weekday":
      return `nth:${rule.month}:${rule.weekday}:${rule.n}`;
    case "easter_offset":
      return `easter:${rule.days}`;
    case "equinox":
      return `equinox:${rule.which}`;
    case "solstice":
      return `solstice:${rule.which}`;
    case "chinese_lunar":
      return `chinese:${rule.month}-${rule.day}`;
  }
}

/** The rule's date in a given year as `YYYY-MM-DD`, or null when it has none (Feb 29 off leap years, a missing 5th weekday). */
export function occurrence(rule: Recurrence, year: number): string | null {
  switch (rule.kind) {
    case "fixed_day": {
      if (rule.month === 2 && rule.day === 29 && !isLeapYear(year)) return null;
      return isoDate(year, rule.month, rule.day);
    }
    case "nth_weekday": {
      const d = nthWeekday(year, rule.month, rule.weekday, rule.n);
      return d ? toIso(d) : null;
    }
    case "easter_offset":
      return toIso(addDays(easterSunday(year), rule.days));
    case "equinox":
    case "solstice": {
      const s = Seasons(year);
      const t =
        rule.kind === "equinox" ? (rule.which === "march" ? s.mar_equinox : s.sep_equinox) : rule.which === "june" ? s.jun_solstice : s.dec_solstice;
      return toIso(fromUtc(t.date.getTime()));
    }
    case "chinese_lunar": {
      // Lunar months 11–12 (and part of 1) of lunar year Y fall in Gregorian Y+1, so the row for
      // Gregorian `year` is whichever of lunar `year − 1` / `year` lands inside it (the earlier one
      // when a month-11 day happens twice in the same Gregorian year); null when neither does.
      for (const ly of [year - 1, year]) {
        try {
          const d = chineseLunarToSolar(ly, rule.month, rule.day);
          if (d.y === year) return toIso(d);
        } catch {
          // lunar day/month missing in that year (short month, no such leap month)
        }
      }
      return null;
    }
  }
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Prose fragment used in own-written descriptions: "on March 14", "on the first Monday of August", "39 days after Easter Sunday". */
export function describeRule(rule: Recurrence): string {
  switch (rule.kind) {
    case "fixed_day":
      return `on ${MONTHS[rule.month - 1]} ${rule.day}`;
    case "nth_weekday": {
      const nth = rule.n === -1 ? "last" : ["first", "second", "third", "fourth", "fifth"][rule.n - 1];
      return `on the ${nth} ${WEEKDAYS[rule.weekday]} of ${MONTHS[rule.month - 1]}`;
    }
    case "easter_offset": {
      if (rule.days === 0) return "on Easter Sunday";
      const n = Math.abs(rule.days);
      return `${n} day${n === 1 ? "" : "s"} ${rule.days > 0 ? "after" : "before"} Easter Sunday`;
    }
    case "equinox":
      return `on the ${rule.which === "march" ? "March" : "September"} equinox`;
    case "solstice":
      return `on the ${rule.which === "june" ? "June" : "December"} solstice`;
    case "chinese_lunar":
      return `on the ${ordinal(rule.day)} day of the ${ordinal(rule.month)} month of the Chinese lunar calendar`;
  }
}

/** "Sunday, 14 March 2027" for a `YYYY-MM-DD` day. */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${WEEKDAYS[weekday({ y, m, d })]}, ${d} ${MONTHS[m - 1]} ${y}`;
}
