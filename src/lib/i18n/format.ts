/**
 * Locale-aware formatting. Everything here is `Intl`, which is the point: dates, numbers, relative
 * times, country names and lists in fifteen languages, with no translation to maintain and no
 * chance of a stale hand-written month name.
 *
 * English output is byte-identical to what the site rendered before i18n. That is not tidiness —
 * these strings are in `<title>` and `<meta name=description>` on tens of thousands of indexed
 * pages, and re-writing them all for the sake of a comma is churn Google has to re-crawl. Where the
 * old hand-rolled format differs from what `Intl` produces for `en` (`formatLongDate`,
 * `formatShortDate`), the hand-rolled branch is kept for English only.
 *
 * Usable from Client Components: no `server-only`, no root params.
 */
import { localeMeta, type Locale } from "./config";
import { catalogDay, isValidDate } from "../time";

const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const WEEKDAY_NAMES_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** `Intl` objects are expensive to construct and immutable once built, so they are made once. */
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const relativeFormats = new Map<string, Intl.RelativeTimeFormat>();
const numberFormats = new Map<string, Intl.NumberFormat>();
const displayNames = new Map<string, Intl.DisplayNames>();
const listFormats = new Map<string, Intl.ListFormat>();
const pluralRules = new Map<string, Intl.PluralRules>();

function dateFormat(locale: Locale, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  let f = dateFormats.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(localeMeta(locale).tag, options);
    dateFormats.set(key, f);
  }
  return f;
}

/** Midnight UTC of the date part, so a date is never shifted by the server's own timezone. */
function utcParts(date: string): Date {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * "Friday, 25 December 2026" (en) · "viernes, 25 de diciembre de 2026" (es).
 *
 * Rendered from the *catalog day* — the day in the event's own zone — for the same reason the slug
 * and `starts_on` are: a 20:00 premiere in New York is on the 12th where it airs even though its
 * instant is the 13th in UTC. Without the zone this said the 13th in the title and description
 * while the table underneath said the 12th.
 */
export function longDate(locale: Locale, date: string, timezone?: string | null, fallback = ""): string {
  if (!isValidDate(date)) return fallback;
  const utc = utcParts(catalogDay(date, timezone));
  if (locale === "en") {
    return `${WEEKDAY_NAMES_EN[utc.getUTCDay()]}, ${utc.getUTCDate()} ${MONTH_NAMES_EN[utc.getUTCMonth()]} ${utc.getUTCFullYear()}`;
  }
  return dateFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(utc);
}

/** "Fri, 25 Dec 2026" (en), rendered from the day the row is filed under. */
export function shortDate(locale: Locale, date: string, timezone?: string | null, fallback = "TBA"): string {
  if (!isValidDate(date)) return fallback;
  const utc = utcParts(catalogDay(date, timezone));
  if (locale === "en") {
    return `${WEEKDAY_NAMES_EN[utc.getUTCDay()].slice(0, 3)}, ${utc.getUTCDate()} ${MONTH_NAMES_EN[utc.getUTCMonth()].slice(0, 3)} ${utc.getUTCFullYear()}`;
  }
  return dateFormat(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(utc);
}

/** "Dec 25, 2026" (en) — no weekday, for tables and cards. */
export function compactDate(locale: Locale, date: string, timezone?: string | null, fallback = "—"): string {
  if (!isValidDate(date)) return fallback;
  return dateFormat(locale, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(
    utcParts(catalogDay(date, timezone)),
  );
}

/**
 * The full date, with the clock time when the row carries one.
 *
 * A timed row is shown in its own zone when it has one — "Saturday, 12 December 2026 at 20:00 EST",
 * the time and the day it actually happens — rather than in whatever zone the server runs in.
 */
export function whenDate(locale: Locale, date: string, allDay = true, timezone?: string | null, fallback = ""): string {
  if (!isValidDate(date)) return fallback;
  if (allDay && !date.includes("T")) {
    return dateFormat(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(
      utcParts(date),
    );
  }
  return dateFormat(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(date.includes("T") ? new Date(date) : new Date(`${date}T00:00:00${allDay ? "" : "Z"}`));
}

/** "December" · "diciembre" (1-based month). */
export function monthName(locale: Locale, month: number): string {
  const m = Math.min(12, Math.max(1, Math.trunc(month) || 1));
  if (locale === "en") return MONTH_NAMES_EN[m - 1];
  return dateFormat(locale, { month: "long", timeZone: "UTC" }).format(Date.UTC(2001, m - 1, 15));
}

/** "December 2026" · "diciembre de 2026". */
export function monthYear(locale: Locale, year: number, month: number): string {
  if (locale === "en") return `${monthName(locale, month)} ${year}`;
  return dateFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    Date.UTC(year, Math.min(12, Math.max(1, month)) - 1, 15),
  );
}

// ---------------------------------------------------------------------------
// Numbers, relative time, names
// ---------------------------------------------------------------------------

export function number(locale: Locale, value: number): string {
  const key = locale;
  let f = numberFormats.get(key);
  if (!f) {
    f = new Intl.NumberFormat(localeMeta(locale).tag);
    numberFormats.set(key, f);
  }
  return f.format(value);
}

function relative(locale: Locale, numeric: "auto" | "always"): Intl.RelativeTimeFormat {
  const key = `${locale}:${numeric}`;
  let f = relativeFormats.get(key);
  if (!f) {
    f = new Intl.RelativeTimeFormat(localeMeta(locale).tag, { numeric });
    relativeFormats.set(key, f);
  }
  return f;
}

/**
 * "today" · "tomorrow" · "in 3 days" · "in 2 weeks" · "5 days ago", from a whole-day delta.
 *
 * `numeric: "auto"` on the day unit is what gives today/tomorrow/yesterday their words; the coarser
 * units stay `"always"` because "in 1 year" is a countdown and "next year" is not — and because
 * that pair reproduces the previous English output exactly, for every delta. Every other locale
 * gets its own grammar (Polish "za 3 tygodnie", Arabic's dual, Russian's four plural forms) free.
 */
export function humanDays(locale: Locale, days?: number | null): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return "";
  const d = Math.trunc(days);
  const abs = Math.abs(d);
  if (abs < 14) return relative(locale, "auto").format(d, "day");
  if (abs < 60) return relative(locale, "always").format(Math.sign(d) * Math.round(abs / 7), "week");
  if (abs < 400) return relative(locale, "always").format(Math.sign(d) * Math.round(abs / 30), "month");
  return relative(locale, "always").format(Math.sign(d) * Math.round(abs / 365), "year");
}

/** "Spain" · "España" · "スペイン" — ICU's own region names, so no country list needs translating. */
export function countryName(locale: Locale, code: string, fallback?: string): string {
  const key = `${locale}:region`;
  let f = displayNames.get(key);
  if (!f) {
    try {
      f = new Intl.DisplayNames([localeMeta(locale).tag], { type: "region", fallback: "none" });
    } catch {
      return fallback ?? code;
    }
    displayNames.set(key, f);
  }
  try {
    return f.of(code.toUpperCase()) ?? fallback ?? code;
  } catch {
    return fallback ?? code;
  }
}

/** "a, b and c" in the locale's own conjunction. */
export function list(locale: Locale, items: string[], type: "conjunction" | "disjunction" = "conjunction"): string {
  const key = `${locale}:${type}`;
  let f = listFormats.get(key);
  if (!f) {
    f = new Intl.ListFormat(localeMeta(locale).tag, { style: "long", type });
    listFormats.set(key, f);
  }
  return f.format(items);
}

// ---------------------------------------------------------------------------
// Plurals
// ---------------------------------------------------------------------------

/**
 * The forms a message needs. `other` is the only one every language has; Polish adds `few`/`many`,
 * Russian all four, Arabic `zero`/`two` as well, and Japanese, Korean, Turkish and Indonesian need
 * nothing else. A translator supplies the categories their language actually distinguishes and
 * `plural()` picks with ICU's rules rather than a hand-written `n === 1`.
 */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

export function selectPlural(locale: Locale, n: number, forms: PluralForms): string {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(localeMeta(locale).tag);
    pluralRules.set(locale, rules);
  }
  const category = rules.select(n);
  return forms[category] ?? forms.other;
}
