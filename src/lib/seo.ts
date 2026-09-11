/**
 * Metadata helpers shared by every page: site URL, title/description patterns and the one
 * `buildMetadata()` that turns them into Next `Metadata` (canonical, hreflang, Open Graph, Twitter,
 * robots).
 *
 * Titles never carry the day count (it would go stale in the index); descriptions and the
 * server-rendered intent sentence do, from SQL `days_until`. This module is the only server-side
 * place allowed to read the wall clock (`todayUtc()`), and only for the dated OG-image URL that
 * must change daily.
 *
 * Everything a reader sees is a template from `messages/<locale>/seo.ts`, filled here. Nothing in
 * this file is English: the patterns live in the catalogues, because "how many days until X" is a
 * different *query* in every language, not the same sentence with different words.
 */
import type { Metadata } from "next";
import type { Localized } from "./i18n/bind";
import { DEFAULT_LOCALE, LOCALES, localeMeta, type Locale } from "./i18n/config";
import { localizedTitle } from "./i18n/content";
import { longDate } from "./i18n/format";
import { localePath } from "./i18n/paths";
import { isCoarsePrecision, isValidDate } from "./time";
import type { Category, CountdownEvent, DatePrecision, Series } from "./types";

const DEFAULT_SITE_URL = "https://until-inky.vercel.app";
export const SITE_NAME = "Until";
export const DESCRIPTION_MAX = 155;
/** `/calendar/[year]/[month]` and `/og/month` answer only for this window (else 404). */
export const CALENDAR_MIN_YEAR = 2026;
export const CALENDAR_MAX_YEAR = 2040;

/** Origin of the deployed site, without a trailing slash. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  try {
    return new URL(raw).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Absolute URL of an app-internal path as that locale publishes it. */
export function localeUrl(locale: Locale, path: string): string {
  return absoluteUrl(localePath(locale, path));
}

/** Today's UTC calendar date, `YYYY-MM-DD`. For dated OG-image URLs only (see module docs). */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** `{ year, month }` of a `YYYY-MM-DD` string, 1-based month. */
export function yearMonthOf(date: string): { year: number; month: number } {
  return { year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)) || 1 };
}

/** The month after `{ year, month }` (1-based). */
export function nextMonth(year: number, month: number): { year: number; month: number } {
  return month >= 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

export function prevMonth(year: number, month: number): { year: number; month: number } {
  return month <= 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function truncate(text: string, max = DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[,;:\s]+$/, "")}…`;
}

// ---------------------------------------------------------------------------
// Dates in prose
// ---------------------------------------------------------------------------

/**
 * "Friday, 25 December 2026" — the long form used inside titles and descriptions.
 *
 * `timezone` is the row's own zone, and passing it is not optional politeness: it is what makes the
 * title name the same day as the slug, `starts_on` and every listing. A 20:00 premiere in New York
 * is filed under the 12th; without the zone this sentence would say the 13th.
 */
export function formatLongDate(L: Localized, date: string, timezone?: string | null): string {
  return longDate(L.locale, date, timezone, L.m.common.labels.dateToBeAnnounced);
}

/** "June 2027" · "Q3 2027" · "2027" — a coarse precision's period, with no leading verb. */
export function expectedPeriod(L: Localized, date: string, precision?: DatePrecision | null): string {
  const { period } = L.m.seo;
  if (!isValidDate(date)) return period.unknown;
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) || 1;
  switch (precision) {
    case "month":
      return L.t(period.month, { month: L.fmt.monthName(month), year });
    case "quarter":
      return L.t(period.quarter, { q: Math.min(4, Math.max(1, Math.ceil(month / 3))), year });
    default:
      return L.t(period.year, { year });
  }
}

/** "expected June 2027" for coarse precisions, the full date otherwise. */
export function formatApproximate(
  L: Localized,
  date: string,
  precision?: DatePrecision | null,
  timezone?: string | null,
): string {
  if (!isValidDate(date)) return L.m.seo.period.unknown;
  if (!isCoarsePrecision(precision)) return L.fmt.whenDate(date, true, timezone, L.m.seo.period.unknown);
  return L.t(L.m.seo.period.expected, { period: expectedPeriod(L, date, precision) });
}

/** The date as a title should say it: the full day, or "expected <period>" when that is all we have. */
function whenLabel(L: Localized, date: string, precision?: DatePrecision | null, timezone?: string | null): string {
  return isCoarsePrecision(precision)
    ? L.t(L.m.seo.period.expected, { period: expectedPeriod(L, date, precision) })
    : formatLongDate(L, date, timezone);
}

/** "That is 107 days away." · "That is today." · "It was 3 days ago." */
export function daysSentence(L: Localized, days: number | undefined | null): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return "";
  const n = Math.trunc(days);
  const { days: d } = L.m.seo;
  if (n === 0) return d.today;
  if (n === 1) return d.tomorrow;
  if (n === -1) return d.yesterday;
  return n < 0 ? L.tn(d.ago, Math.abs(n)) : L.tn(d.away, n);
}

// ---------------------------------------------------------------------------
// Title / description patterns
// ---------------------------------------------------------------------------

type TitleStyle = "when-is" | "countdown-colon" | "countdown-dash";

/**
 * Which phrasing a category takes. Structure, not language: a holiday is a "when is …?" question in
 * every language, a game release is a "… countdown". Each locale writes its own three templates.
 */
const TITLE_STYLE: Record<Category, TitleStyle> = {
  holidays: "when-is",
  national: "when-is",
  religion: "when-is",
  awareness: "when-is",
  fun: "when-is",
  culture: "when-is",
  festivals: "when-is",
  sports: "countdown-dash",
  esports: "countdown-dash",
  games: "countdown-colon",
  film: "countdown-colon",
  tv: "countdown-colon",
  anime: "countdown-colon",
  music: "countdown-dash",
  entertainment: "countdown-dash",
  politics: "countdown-dash",
  tech: "countdown-colon",
  science: "countdown-dash",
  space: "countdown-colon",
  astronomy: "countdown-dash",
  nature: "countdown-dash",
  history: "countdown-colon",
  curiosities: "countdown-colon",
};

/** The name to show for a row: the locale's own name for the entity, or the catalog's English. */
export function displayTitle(L: Localized, item: { title: string; slug?: string }): string {
  return localizedTitle(L.locale, item.title, item.slug);
}

/** One-off event title, rotated by category so the corpus is not a single template. Never the day count. */
export function eventTitle(
  L: Localized,
  event: Pick<CountdownEvent, "title" | "date" | "category" | "datePrecision"> & { slug?: string; timezone?: string },
): string {
  const title = displayTitle(L, event);
  const when = whenLabel(L, event.date, event.datePrecision, event.timezone);
  const coarse = isCoarsePrecision(event.datePrecision);
  const period = expectedPeriod(L, event.date, event.datePrecision);
  const e = L.m.seo.event;
  switch (TITLE_STYLE[event.category] ?? "countdown-dash") {
    case "when-is":
      return coarse ? L.t(e.whenIsCoarse, { title, period }) : L.t(e.whenIs, { title, when });
    case "countdown-colon":
      return L.t(e.countdownColon, { title, when });
    default:
      return coarse ? L.t(e.countdownDashCoarse, { title, when }) : L.t(e.countdownDash, { title, when });
  }
}

export function eventDescription(
  L: Localized,
  event: Pick<CountdownEvent, "title" | "date" | "datePrecision" | "daysUntil" | "status"> & {
    slug?: string;
    timezone?: string;
  },
): string {
  const title = displayTitle(L, event);
  const e = L.m.seo.event;
  if (isCoarsePrecision(event.datePrecision)) {
    return truncate(L.t(e.descriptionCoarse, { title, period: expectedPeriod(L, event.date, event.datePrecision) }));
  }
  const status =
    event.status === "cancelled" ? e.statusCancelled : event.status === "postponed" ? e.statusPostponed : "";
  return truncate(
    L.t(e.description, {
      title,
      status,
      date: formatLongDate(L, event.date, event.timezone),
      days: daysSentence(L, event.daysUntil),
    }),
  );
}

export function seriesTitle(L: Localized, series: Pick<Series, "title" | "nextDate" | "nextPrecision"> & { slug?: string }): string {
  const title = displayTitle(L, series);
  const s = L.m.seo.series;
  if (!series.nextDate) return L.t(s.titleNoDate, { title });
  return L.t(s.title, { title, when: whenLabel(L, series.nextDate, series.nextPrecision) });
}

/** The `<h1>` of a series page: the question, without the date the title carries. */
export function seriesHeading(L: Localized, series: Pick<Series, "title"> & { slug?: string }): string {
  return L.t(L.m.seo.series.heading, { title: displayTitle(L, series) });
}

export function seriesDescription(
  L: Localized,
  series: Pick<Series, "title" | "nextDate" | "nextPrecision" | "daysUntil"> & { slug?: string },
): string {
  const title = displayTitle(L, series);
  const s = L.m.seo.series;
  if (!series.nextDate) return truncate(L.t(s.descriptionNoDate, { title }));
  if (isCoarsePrecision(series.nextPrecision)) {
    return truncate(
      L.t(s.descriptionCoarse, { title, period: expectedPeriod(L, series.nextDate, series.nextPrecision) }),
    );
  }
  return truncate(
    L.t(s.description, {
      title,
      date: formatLongDate(L, series.nextDate),
      days: daysSentence(L, series.daysUntil),
    }),
  );
}

export function categoryTitle(L: Localized, category: Category): string {
  const label = L.m.categories.labels[category];
  return L.t(L.m.seo.hub.category, {
    category: L.m.seo.hub.lowercaseCategory ? label.toLocaleLowerCase(L.tag) : label,
  });
}

export function countryTitle(L: Localized, countryName: string): string {
  return L.t(L.m.seo.hub.country, { country: countryName });
}

export function monthTitle(L: Localized, year: number, month: number): string {
  return L.t(L.m.seo.hub.month, { month: L.fmt.monthYear(year, month) });
}

export function tagTitle(L: Localized, tag: string): string {
  return L.t(L.m.seo.hub.tag, { tag: tag.replace(/-/g, " ") });
}

/** Dated OG-image path for an event or series (the date makes social scrapers refetch daily). */
export function ogDatedPath(kind: "event" | "series", slug: string, today: string): string {
  return `/og/${kind}/${encodeURIComponent(slug)}/${today}.png`;
}

/**
 * Absolute oEmbed discovery endpoint for a page, advertised as an `alternates.types` link.
 * A consumer handed the plain countdown URL (WordPress, Ghost, Notion) can then find the
 * `<iframe>` on its own, so "embed this" costs the visitor one paste and no explanation.
 */
export function oembedDiscoveryUrl(locale: Locale, canonical: string): string {
  return absoluteUrl(`/api/oembed?url=${encodeURIComponent(localeUrl(locale, canonical))}`);
}

// ---------------------------------------------------------------------------
// Metadata builder
// ---------------------------------------------------------------------------

export type BuildMetadataInput = {
  locale: Locale;
  title: string;
  description: string;
  /** App-internal path of the page (`/days-until/christmas`); localized here, never by the caller. */
  canonical: string;
  /** Path (or absolute URL) of the 1200×630 OG image. */
  ogPath: string;
  noindex?: boolean;
  /**
   * Whether the page exists in every locale and should advertise its siblings with `hreflang`.
   * Default true. Turned off where the page is language-neutral, or where the variants are not
   * indexed — an hreflang cluster that points at a `noindex` page is a contradiction, and Google
   * drops the whole cluster when it finds one.
   */
  translated?: boolean;
  /**
   * Narrows the cluster to the locales where this page is genuinely indexed. Dated event pages use
   * it: English always, plus the locales that have a curated name for the entity, so
   * `/es/evento/christmas-day-2026-12-25` is in the cluster (it says "Navidad") and
   * `/pl/wydarzenie/eclipse-temurin-26-end-of-life-2027-…` is not.
   */
  translatedIn?: Locale[];
  type?: "website" | "article";
  ogAlt?: string;
};

export function buildMetadata({
  locale,
  title,
  description,
  canonical,
  ogPath,
  noindex,
  translated = true,
  translatedIn,
  type,
  ogAlt,
}: BuildMetadataInput): Metadata {
  const url = localeUrl(locale, canonical);
  const image = absoluteUrl(ogPath);
  const desc = truncate(description);
  const meta = localeMeta(locale);
  const cluster = translatedIn ?? LOCALES;
  const languages =
    translated && !noindex && cluster.length > 1
      ? Object.fromEntries([
          ...cluster.map((l) => [localeMeta(l).lang, localeUrl(l, canonical)] as const),
          ["x-default", localeUrl(DEFAULT_LOCALE, canonical)] as const,
        ])
      : undefined;
  return {
    title,
    description: desc,
    alternates: { canonical: url, ...(languages ? { languages } : {}) },
    openGraph: {
      title,
      description: desc,
      url,
      siteName: SITE_NAME,
      type: type ?? "website",
      locale: meta.ogLocale,
      alternateLocale: translated ? cluster.filter((l) => l !== locale).map((l) => localeMeta(l).ogLocale) : undefined,
      images: [{ url: image, width: 1200, height: 630, alt: ogAlt ?? title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [image],
    },
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}
