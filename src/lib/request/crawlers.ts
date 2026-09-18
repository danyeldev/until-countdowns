import { DEFAULT_LOCALE, LOCALES, localePrefix, pathnameWithoutLocale } from "@/i18n/locales";
import { isAutomationUserAgent } from "./visitor";

/** URL prefixes of the non-English locales, without slashes: `es`, `pt`, …, `zh-hant`, `zh`. */
export const LOCALE_URL_PREFIXES: readonly string[] = LOCALES.filter(
  (locale) => locale !== DEFAULT_LOCALE,
).map((locale) => localePrefix(locale).slice(1));

const LOCALE_URL_PREFIX_SET = new Set(LOCALE_URL_PREFIXES);

/**
 * Pages robots.txt disallows because a crawler gains nothing from them and each hit costs a
 * function render (an uncached one, for search):
 *
 * - `/search`: results are `noindex` and rendered live from the database.
 * - Every locale-prefixed page: the 26 non-English locales serve the same English catalog with
 *   translated chrome, canonicalised to the unprefixed English URL. Left open, they multiply the
 *   crawlable catalog by 27 — in September 2026 that was ~9 event renders a second, all cache
 *   misses, with nobody reading them.
 *
 * `robots.txt` is advisory; the proxy enforces this list for self-identified crawlers.
 */
export function isCrawlTrap(pathname: string): boolean {
  const head = pathname.split("/").find(Boolean)?.toLowerCase();
  if (!head) return false;
  return LOCALE_URL_PREFIX_SET.has(head) || head === "search";
}

/** `Disallow:` lines for the traps above. `$` anchors the bare locale home (`/es`) — Google and Bing honour it. */
export function crawlTrapDisallows(): string[] {
  return ["/search", ...LOCALE_URL_PREFIXES.flatMap((prefix) => [`/${prefix}/`, `/${prefix}$`])];
}

/** True when a self-identified crawler asks for a trap path (or is about to be redirected into one). */
export function isBlockedCrawl(headers: Headers, pathname: string, redirectsToTrap = false): boolean {
  if (!redirectsToTrap && !isCrawlTrap(pathname)) return false;
  return isAutomationUserAgent(headers.get("user-agent"));
}

/**
 * Where an unverified client asking for a locale-prefixed page is sent instead: the English page.
 * Browsers send Fetch Metadata on every navigation (Chrome 76, Firefox 90, Safari 16.4); a client
 * without it is a script wearing a browser's user agent — the crawler that survives the user-agent
 * check — or a browser old enough that English will do. Twenty-six locale copies collapse into the
 * one English render, which is also the only one search engines are asked to index.
 *
 * Null when the request carries Fetch Metadata or the path has no locale prefix.
 */
export function englishDetour(headers: Headers, pathname: string): string | null {
  if (headers.has("sec-fetch-site")) return null;
  const english = pathnameWithoutLocale(pathname);
  return english === pathname ? null : english;
}
