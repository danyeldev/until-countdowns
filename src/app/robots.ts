import type { MetadataRoute } from "next";
import { PREFIXED_LOCALE_PATTERN } from "@/i18n/locales";
import { absoluteUrl } from "@/lib/seo";

/** `/search` and every locale-prefixed variant (`/es/search`, `/zh-hant/search`, …). */
export const SEARCH_PATHS = [
  "/search",
  ...PREFIXED_LOCALE_PATTERN.split("|").map((prefix) => `/${prefix}/search`),
];

/**
 * HTML stays crawlable so search engines can read canonical and noindex instructions on
 * personal countdowns and embeds. A robots disallow cannot prevent indexing.
 *
 * Search results are the exception. They were already `noindex`, but every tag chip, sort
 * toggle and pager link leads into `/search?…`, and across 27 locales that is an unbounded,
 * uncached URL space: in September 2026 one crawler walked it at ~7 requests a second for
 * two days. Nothing there is worth indexing, so crawling it is disallowed outright.
 *
 * API endpoints are not discoverable pages. Public catalog and social images remain open.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/og/"],
      disallow: ["/api/", ...SEARCH_PATHS],
    },
    sitemap: [absoluteUrl("/sitemap-index.xml")],
  };
}
