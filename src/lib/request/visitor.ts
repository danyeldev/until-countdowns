/**
 * Cheap, header-only guess at whether a request was made by a person in a browser rather than by
 * a crawler or an HTTP library. Used to decide what gets *recorded* (the `search_log` demand
 * signal), never what gets served: a wrong guess costs one log row, not a page.
 */

/** Self-identifying crawlers, HTTP libraries and headless/audit tooling. */
const AUTOMATION_UA =
  /bot|crawl|spider|slurp|scrapy|python|curl|wget|go-http-client|java\/|httpclient|okhttp|headless|libwww|node-fetch|axios|undici|lighthouse|pagespeed|ia_archiver|dataforseo|sogou/i;

export function isBrowserVisit(headers: Headers): boolean {
  const ua = headers.get("user-agent");
  if (!ua || AUTOMATION_UA.test(ua)) return false;
  // A `<Link>` prefetch is the router speculating, not the visitor asking.
  if (headers.has("next-router-prefetch")) return false;
  // Every current browser sends Fetch Metadata on navigations and same-origin fetches
  // (Chrome 76, Firefox 90, Safari 16.4); scripted clients almost never bother to fake it.
  return headers.has("sec-fetch-site");
}
