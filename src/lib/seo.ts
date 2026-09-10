/**
 * Metadata helpers shared by every page: site URL, title/description patterns and the one
 * `buildMetadata()` that turns them into Next `Metadata` (canonical, Open Graph, Twitter, robots).
 *
 * Titles never carry the day count (it would go stale in the index); descriptions and the
 * server-rendered intent sentence do. This module is the only server-side place allowed to read
 * the wall clock (`todayUtc()`), and only for the dated OG-image URL that must change daily.
 */
import type { Metadata } from "next";
import { CATEGORY_LABELS } from "./labels";
import { catalogDay, formatApproximate, isCoarsePrecision, isValidDate } from "./time";
import type { Category, CountdownEvent, DatePrecision, Series } from "./types";

const DEFAULT_SITE_URL = "https://until-inky.vercel.app";
export const SITE_NAME = "Until";
/** Root layout default title and the home page's absolute title (kept identical on purpose). */
export const HOME_TITLE = "Until — countdowns for everything coming";
export const SITE_DESCRIPTION =
  "Thousands of future dates, tagged and ticking. Holidays, eclipses, World Cups, elections — plus the ones you make yourself.";
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
    return new URL(raw).origin;
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

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[Math.min(11, Math.max(0, month - 1))]} ${year}`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** "Friday, 25 December 2026" from the date part of an ISO string (UTC calendar). */
export function formatLongDate(date: string): string {
  if (!isValidDate(date)) return "a date to be announced";
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  const utc = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  return `${WEEKDAY_NAMES[utc.getUTCDay()]}, ${utc.getUTCDate()} ${MONTH_NAMES[utc.getUTCMonth()]} ${utc.getUTCFullYear()}`;
}

/** "Fri, 25 Dec 2026". */
export function formatShortDate(date: string, timezone?: string | null): string {
  if (!isValidDate(date)) return "TBA";
  const [y, m, d] = catalogDay(date, timezone).split("-").map(Number);
  const utc = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  return `${WEEKDAY_NAMES[utc.getUTCDay()].slice(0, 3)}, ${utc.getUTCDate()} ${MONTH_NAMES[utc.getUTCMonth()].slice(0, 3)} ${utc.getUTCFullYear()}`;
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
export function daysSentence(days: number | undefined | null): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return "";
  const n = Math.trunc(days);
  if (n === 0) return "That is today.";
  if (n === 1) return "That is tomorrow.";
  if (n === -1) return "That was yesterday.";
  if (n < 0) return `That was ${Math.abs(n).toLocaleString("en-US")} days ago.`;
  return `That is ${n.toLocaleString("en-US")} days away.`;
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
function whenLabel(date: string, precision?: DatePrecision | null): string {
  return isCoarsePrecision(precision) ? `expected ${expectedPeriod(date, precision)}` : formatLongDate(date);
}

/** One-off event title, rotated by category so the corpus is not a single template. Never the day count. */
export function eventTitle(event: Pick<CountdownEvent, "title" | "date" | "category" | "datePrecision">): string {
  const when = whenLabel(event.date, event.datePrecision);
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
  event: Pick<CountdownEvent, "title" | "date" | "datePrecision" | "daysUntil" | "status">,
): string {
  if (isCoarsePrecision(event.datePrecision)) {
    return truncate(
      `${event.title} is expected ${expectedPeriod(event.date, event.datePrecision)}. The exact day is not announced yet. Live countdown once it is, add to calendar.`,
    );
  }
  const status =
    event.status === "cancelled" ? " (cancelled)" : event.status === "postponed" ? " (postponed)" : "";
  return truncate(
    `${event.title}${status} is on ${formatLongDate(event.date)}. ${daysSentence(event.daysUntil)} Live countdown, add to calendar.`,
  );
}

export function seriesTitle(series: Pick<Series, "title" | "nextDate" | "nextPrecision">): string {
  const when = series.nextDate ? whenLabel(series.nextDate, series.nextPrecision) : null;
  return when ? `How many days until ${series.title}? — ${when}` : `How many days until ${series.title}?`;
}

export function seriesDescription(series: Pick<Series, "title" | "nextDate" | "nextPrecision" | "daysUntil">): string {
  if (!series.nextDate) {
    return truncate(`${series.title}: upcoming dates, a live countdown to the next one, and calendar links.`);
  }
  if (isCoarsePrecision(series.nextPrecision)) {
    return truncate(
      `The next ${series.title} is expected ${expectedPeriod(series.nextDate, series.nextPrecision)}. Dates for every year, live countdown, add to calendar.`,
    );
  }
  return truncate(
    `${series.title} is on ${formatLongDate(series.nextDate)}. ${daysSentence(series.daysUntil)} Live countdown, dates for every year, add to calendar.`,
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
  /** Path (or absolute URL) of the canonical page. */
  canonical: string;
  /** Path (or absolute URL) of the 1200×630 OG image. */
  ogPath: string;
  noindex?: boolean;
  type?: "website" | "article";
  ogAlt?: string;
};

export function buildMetadata({ title, description, canonical, ogPath, noindex, type, ogAlt }: BuildMetadataInput): Metadata {
  const url = absoluteUrl(canonical);
  const image = absoluteUrl(ogPath);
  const desc = truncate(description);
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: desc,
      url,
      siteName: SITE_NAME,
      type: type ?? "website",
      locale: "en_US",
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
