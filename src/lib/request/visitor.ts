/**
 * Cheap, header-only guesses at who is asking. `isBrowserVisit` decides what gets *recorded*
 * (the `search_log` demand signal), never what gets served: a wrong guess costs one log row, not
 * a page. `isAutomationUserAgent` is the half the proxy uses to keep self-identified crawlers
 * out of the paths robots.txt already disallows.
 */

/**
 * Self-identifying crawlers, HTTP libraries and headless/audit tooling. The last group names
 * crawlers whose user agent carries none of the generic tokens: GoogleOther (Google's non-Search
 * crawler, which walked the locale copies at ~1.5 requests a second in September 2026 wearing a
 * Chrome-on-Nexus-5X string), Meta's and Anthropic's AI crawlers, and Babbar's Barkrowler.
 */
const AUTOMATION_UA =
  /bot|crawl|spider|slurp|scrapy|python|curl|wget|go-http-client|java\/|httpclient|okhttp|headless|libwww|node-fetch|axios|undici|lighthouse|pagespeed|ia_archiver|dataforseo|sogou|googleother|meta-externalagent|anthropic-ai|barkrowler/i;

/**
 * Matches of `AUTOMATION_UA` that are not automation: link unfurlers a person triggers by pasting
 * a URL into a chat or a post (they fetch one page on someone's behalf), and Cubot phones, whose
 * model name puts "bot" in a real Android browser's user agent.
 */
const NOT_AUTOMATION_UA =
  /facebookexternalhit|facebot|twitterbot|slackbot|discordbot|telegrambot|whatsapp|linkedinbot|skypeuripreview|pinterestbot|redditbot|iframely|embedly|cubot/i;

/** A missing user agent counts as automation: every browser sends one. */
export function isAutomationUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true;
  return AUTOMATION_UA.test(ua) && !NOT_AUTOMATION_UA.test(ua);
}

export function isBrowserVisit(headers: Headers): boolean {
  const ua = headers.get("user-agent");
  if (!ua || AUTOMATION_UA.test(ua)) return false;
  // A `<Link>` prefetch is the router speculating, not the visitor asking.
  if (headers.has("next-router-prefetch")) return false;
  // Every current browser sends Fetch Metadata on navigations and same-origin fetches
  // (Chrome 76, Firefox 90, Safari 16.4); scripted clients almost never bother to fake it.
  return headers.has("sec-fetch-site");
}
