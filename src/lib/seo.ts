/**
 * Metadata helpers shared by every page: site URL, title/description patterns and the one
 * `buildMetadata()` that turns them into Next `Metadata` (canonical, Open Graph, Twitter, robots).
 *
 * Titles never carry the day count (it would go stale in the index); descriptions and the
 * server-rendered intent sentence do. `todayUtc()` is the shared clock for dated social images
 * and calendar navigation; date formatting itself is deterministic.
 */
import type { Metadata } from "next";
import {
  DEFAULT_LOCALE,
  LOCALES,
  localeBcp47,
  localeHreflang,
  localeOg,
  localizePath,
} from "@/i18n/locales";
import { CATEGORY_LABELS } from "./labels";
import { catalogDay, formatApproximate, isCoarsePrecision, isValidDate } from "./time";
import type { Category, CountdownEvent, DatePrecision, Series } from "./types";

const DEFAULT_SITE_URL = "https://until.day";
export const SITE_NAME = "Until";
/** Root layout default title and the home page's absolute title (kept identical on purpose). */
export const HOME_TITLE = "Until — something to look forward to";
export const SITE_DESCRIPTION =
  "Find your next thing to look forward to. Explore holidays, sports, space and culture with live countdowns, source links and free calendar links.";
export const DESCRIPTION_MAX = 155;
/** `/calendar/[year]/[month]` and `/og/month` answer only for this window (else 404). */
export const CALENDAR_MIN_YEAR = 2026;
export const CALENDAR_MAX_YEAR = 2040;

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** Origin of the deployed site, without a trailing slash. */
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  try {
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol)) return DEFAULT_SITE_URL;
    // Preview deployments expire; they must not become canonicals or calendar links.
    if (url.hostname.endsWith(".vercel.app")) return DEFAULT_SITE_URL;
    return url.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
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

export function monthLabel(year: number, month: number, locale: string = DEFAULT_LOCALE): string {
  if (locale === DEFAULT_LOCALE) {
    return `${MONTH_NAMES[Math.min(11, Math.max(0, month - 1))]} ${year}`;
  }
  const utc = new Date(Date.UTC(year, Math.min(11, Math.max(0, month - 1)), 1));
  const monthName = new Intl.DateTimeFormat(localeBcp47(locale), { month: "long", timeZone: "UTC" }).format(utc);
  return `${monthName} ${year}`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "Friday, 25 December 2026", using a timed event's local calendar day when known. */
export function formatLongDate(date: string, timezone?: string | null, locale: string = DEFAULT_LOCALE): string {
  if (!isValidDate(date)) return "a date to be announced";
  const [y, m, d] = catalogDay(date, timezone).split("-").map(Number);
  const utc = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  if (locale === DEFAULT_LOCALE) {
    return `${WEEKDAY_NAMES[utc.getUTCDay()]}, ${utc.getUTCDate()} ${MONTH_NAMES[utc.getUTCMonth()]} ${utc.getUTCFullYear()}`;
  }
  return new Intl.DateTimeFormat(localeBcp47(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(utc);
}

/** "Fri, 25 Dec 2026". */
export function formatShortDate(date: string, timezone?: string | null, locale: string = DEFAULT_LOCALE): string {
  if (!isValidDate(date)) return "TBA";
  const [y, m, d] = catalogDay(date, timezone).split("-").map(Number);
  const utc = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  if (locale === DEFAULT_LOCALE) {
    return `${WEEKDAY_NAMES[utc.getUTCDay()].slice(0, 3)}, ${utc.getUTCDate()} ${MONTH_NAMES[utc.getUTCMonth()].slice(0, 3)} ${utc.getUTCFullYear()}`;
  }
  return new Intl.DateTimeFormat(localeBcp47(locale), {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(utc);
}

/** "expected June 2027" style label for coarse precisions, without the leading verb. */
export function expectedPeriod(date: string, precision?: DatePrecision | null): string {
  return formatApproximate(date, precision).replace(/^expected\s+/, "");
}

export function truncate(text: string, max = DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[,;:\s]+$/, "")}…`;
}

/** "That is 107 days away." / "That is today." / "It was 3 days ago." */
export function daysSentence(days: number | undefined | null, locale = DEFAULT_LOCALE): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return "";
  const n = Math.trunc(days);
  const count = Math.abs(n).toLocaleString(localeBcp47(locale));
  if (n === 0) return "That is today.";
  if (n === 1) return "That is tomorrow.";
  if (n === -1) return "That was yesterday.";
  if (n < 0) return `That was ${count} days ago.`;
  return `That is ${count} days away.`;
}

// ---------------------------------------------------------------------------
// Title / description patterns
// ---------------------------------------------------------------------------

type TitleStyle = "countdown-dash" | "countdown-colon" | "when-is";

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

/** "Friday, 25 December 2026", or "expected June 2027" for coarse precisions (never the bare period). */
function whenLabel(date: string, precision?: DatePrecision | null, timezone?: string): string {
  return isCoarsePrecision(precision) ? `expected ${expectedPeriod(date, precision)}` : formatLongDate(date, timezone);
}

/** One-off event title, rotated by category so the corpus is not a single template. Never the day count. */
export function eventTitle(event: Pick<CountdownEvent, "title" | "date" | "category" | "datePrecision" | "timezone" | "status">): string {
  if (event.status === "cancelled") return `${event.title} — cancelled`;
  if (event.status === "postponed") return `${event.title} — postponed`;
  const when = whenLabel(event.date, event.datePrecision, event.timezone);
  const coarse = isCoarsePrecision(event.datePrecision);
  switch (TITLE_STYLE[event.category] ?? "countdown-dash") {
    case "when-is":
      return coarse ? `When is ${event.title}? Expected ${expectedPeriod(event.date, event.datePrecision)}` : `When is ${event.title}? ${when}`;
    case "countdown-colon":
      return `${event.title} countdown: ${when}`;
    default:
      // "2026 Alpine Skiing World Cup — expected 2026" rather than "… — 2026 countdown".
      return coarse ? `${event.title} — ${when}` : `${event.title} — ${when} countdown`;
  }
}

export function eventDescription(
  event: Pick<CountdownEvent, "title" | "date" | "datePrecision" | "daysUntil" | "status" | "timezone">,
): string {
  if (event.status === "cancelled") {
    return truncate(`${event.title} has been cancelled. See the last announced date, source details and related events on Until.`);
  }
  if (event.status === "postponed") {
    return truncate(`${event.title} has been postponed. The new date is awaiting confirmation. Check the source and date history on Until.`);
  }
  if (isCoarsePrecision(event.datePrecision)) {
    return truncate(
      `${event.title} is expected ${expectedPeriod(event.date, event.datePrecision)}. The exact day is not announced yet. Live countdown once it is, add to calendar.`,
    );
  }
  const when = formatLongDate(event.date, event.timezone);
  if (event.status === "tentative") {
    return truncate(`${event.title} is provisionally scheduled for ${when}. The date may change. Check the source and follow the countdown.`);
  }
  const past = typeof event.daysUntil === "number" && event.daysUntil < 0;
  return truncate(
    `${event.title} ${past ? "was" : "is"} on ${when}. ${daysSentence(event.daysUntil)} ${past ? "Explore the date and related events." : "Live countdown and free calendar links."}`,
  );
}

export function seriesTitle(series: Pick<Series, "title" | "nextDate" | "nextPrecision" | "nextTimezone">): string {
  const when = series.nextDate ? whenLabel(series.nextDate, series.nextPrecision, series.nextTimezone) : null;
  return when ? `How many days until ${series.title}? — ${when}` : `How many days until ${series.title}?`;
}

export function seriesDescription(series: Pick<Series, "title" | "nextDate" | "nextPrecision" | "daysUntil" | "nextTimezone">): string {
  if (!series.nextDate) {
    return truncate(`${series.title}: upcoming dates, a live countdown to the next one, and calendar links.`);
  }
  if (isCoarsePrecision(series.nextPrecision)) {
    return truncate(
      `The next ${series.title} is expected ${expectedPeriod(series.nextDate, series.nextPrecision)}. Dates for every year, live countdown, add to calendar.`,
    );
  }
  return truncate(
    `${series.title} is on ${formatLongDate(series.nextDate, series.nextTimezone)}. ${daysSentence(series.daysUntil)} Live countdown, recurring dates and calendar links.`,
  );
}

export function categoryTitle(category: Category): string {
  return `Upcoming ${CATEGORY_LABELS[category].toLowerCase()} — countdowns and dates`;
}

export function countryTitle(countryName: string): string {
  return `${countryName}: upcoming holidays and events`;
}

export function monthTitle(year: number, month: number): string {
  return `${monthLabel(year, month)} — what is coming up`;
}

export function tagTitle(tag: string): string {
  return `${tag.replace(/-/g, " ")} — upcoming dates and countdowns`;
}

export function collectionHubDescription(featuredCount: number, publicCount: number): string {
  const featured =
    featuredCount > 0
      ? `${featuredCount} editorial list${featuredCount === 1 ? "" : "s"}`
      : "Editorial lists";
  const published =
    publicCount > 0
      ? ` and ${publicCount} public collection${publicCount === 1 ? "" : "s"} people share`
      : " and public lists people share";
  return truncate(`${featured}${published}. Live countdowns, calendar links, and shareable lists.`);
}

/** Description for a featured Until list or a public user collection. */
export function collectionListDescription(lead: string, count: number): string {
  const body = lead.trim();
  if (count <= 0) return truncate(body);
  return truncate(
    `${body} ${count} countdown${count === 1 ? "" : "s"} with live dates and calendar links.`,
  );
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
export function oembedDiscoveryUrl(canonical: string): string {
  return absoluteUrl(`/api/oembed?url=${encodeURIComponent(absoluteUrl(canonical))}`);
}

// ---------------------------------------------------------------------------
// Metadata builder
// ---------------------------------------------------------------------------

export type BuildMetadataInput = {
  title: string;
  description: string;
  /** Unprefixed path (or absolute URL) of the canonical page. */
  canonical: string;
  /** Path (or absolute URL) of the 1200×630 OG image. */
  ogPath: string;
  noindex?: boolean;
  type?: "website" | "article";
  ogAlt?: string;
  locale?: string;
};

/** Metadata helper that stamps the active request locale onto canonicals and hreflang. */
export async function localizedMetadata(input: Omit<BuildMetadataInput, "locale"> & { locale?: string }): Promise<Metadata> {
  const { getLocale } = await import("next-intl/server");
  const locale = input.locale ?? (await getLocale());
  return buildMetadata({ ...input, locale });
}

export function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) {
    languages[localeHreflang(locale)] = absoluteUrl(localizePath(path, locale));
  }
  languages["x-default"] = absoluteUrl(localizePath(path, DEFAULT_LOCALE));
  return languages;
}

export function buildMetadata({ title, description, canonical, ogPath, noindex, type, ogAlt, locale = DEFAULT_LOCALE }: BuildMetadataInput): Metadata {
  const localized = /^https?:\/\//.test(canonical) ? canonical : localizePath(canonical, locale);
  const url = absoluteUrl(localized);
  const image = absoluteUrl(ogPath);
  const desc = truncate(description);
  const alternates = /^https?:\/\//.test(canonical)
    ? { canonical: url }
    : { canonical: url, languages: languageAlternates(canonical) };
  return {
    title,
    description: desc,
    alternates,
    openGraph: {
      title,
      description: desc,
      url,
      siteName: SITE_NAME,
      type: type ?? "website",
      locale: localeOg(locale),
      alternateLocale: LOCALES.filter((item) => item !== locale).map(localeOg),
      images: [{ url: image, width: 1200, height: 630, alt: ogAlt ?? title, type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [{ url: image, width: 1200, height: 630, alt: ogAlt ?? title }],
    },
    robots: noindex
      ? { index: false, follow: true }
      : {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
        },
  };
}
