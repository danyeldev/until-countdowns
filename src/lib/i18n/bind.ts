/**
 * Everything a locale needs except its message catalogue, bound once so callers stop passing the
 * locale to every helper. Client-safe (no `server-only`, no root params): a Client Component that
 * receives `locale` as a prop calls `bind(locale)` and gets the same API a page has.
 */
import { localeMeta, type Locale } from "./config";
import * as format from "./format";
import type { PluralForms } from "./format";
import type { Messages } from "./messages/en";
import { fill, plural, type Vars } from "./messages/types";
import { alternatePaths, localePath } from "./paths";

export type Bound = {
  locale: Locale;
  dir: "ltr" | "rtl";
  /** BCP-47 tag, for anything that takes one directly (`toLocaleLowerCase`, a stray `Intl` call). */
  tag: string;
  /** Fill `{placeholders}` in a message. */
  t: (template: string, vars?: Vars) => string;
  /** Pick the plural form for `n` and fill it; `{n}` is the count, grouped for the locale. */
  tn: (message: PluralForms | string, n: number, vars?: Vars) => string;
  /** The public URL of an app-internal path in this locale (`/days-until/x` → `/es/cuantos-dias-faltan/x`). */
  href: (path: string) => string;
  /** Every locale's URL for a path, keyed by `hreflang`, for `alternates.languages`. */
  alternates: (path: string) => Record<string, string>;
  fmt: {
    longDate: (date: string, fallback?: string) => string;
    shortDate: (date: string, timezone?: string | null, fallback?: string) => string;
    compactDate: (date: string, timezone?: string | null, fallback?: string) => string;
    whenDate: (date: string, allDay?: boolean, fallback?: string) => string;
    monthName: (month: number) => string;
    monthYear: (year: number, month: number) => string;
    number: (value: number) => string;
    humanDays: (days?: number | null) => string;
    countryName: (code: string, fallback?: string) => string;
    list: (items: string[], type?: "conjunction" | "disjunction") => string;
  };
};

/**
 * A locale with its catalogue — what a page actually holds, and what the metadata builders in
 * `src/lib/seo.ts` take. Defined here rather than in `server.ts` so that importing the type never
 * drags `next/root-params` (Server-Components-only) into a module a Client Component touches.
 */
export type Localized = Bound & { m: Messages };

const cache = new Map<Locale, Bound>();

export function bind(locale: Locale): Bound {
  const hit = cache.get(locale);
  if (hit) return hit;
  const meta = localeMeta(locale);
  const bound: Bound = {
    locale,
    dir: meta.dir,
    tag: meta.tag,
    t: (template, vars) => fill(template, vars),
    tn: (message, n, vars) => plural(locale, message, n, vars),
    href: (path) => localePath(locale, path),
    alternates: (path) => alternatePaths(path),
    fmt: {
      longDate: (date, fallback) => format.longDate(locale, date, fallback),
      shortDate: (date, timezone, fallback) => format.shortDate(locale, date, timezone, fallback),
      compactDate: (date, timezone, fallback) => format.compactDate(locale, date, timezone, fallback),
      whenDate: (date, allDay, fallback) => format.whenDate(locale, date, allDay, fallback),
      monthName: (month) => format.monthName(locale, month),
      monthYear: (year, month) => format.monthYear(locale, year, month),
      number: (value) => format.number(locale, value),
      humanDays: (days) => format.humanDays(locale, days),
      countryName: (code, fallback) => format.countryName(locale, code, fallback),
      list: (items, type) => format.list(locale, items, type),
    },
  };
  cache.set(locale, bound);
  return bound;
}
