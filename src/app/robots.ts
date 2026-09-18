import type { MetadataRoute } from "next";
import { crawlTrapDisallows } from "@/lib/request/crawlers";
import { absoluteUrl } from "@/lib/seo";

/**
 * English HTML stays crawlable so search engines can read canonical and noindex instructions on
 * personal countdowns and embeds. A robots disallow cannot prevent indexing.
 *
 * Two families are disallowed outright because crawling them costs a render and indexes nothing
 * (see `isCrawlTrap`): search results — every tag chip, sort toggle and pager link leads into an
 * unbounded, uncached `/search?…` space that one crawler walked at ~7 requests a second for two
 * days in September 2026 — and the 26 locale-prefixed copies of the catalog, which serve the same
 * English events under translated chrome and canonicalise to the unprefixed URL. Crawlers were
 * walking those at ~9 event renders a second the same month. The proxy enforces both for
 * self-identified crawlers.
 *
 * API endpoints are not discoverable pages. Public catalog and social images remain open.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/og/"],
      disallow: ["/api/", ...crawlTrapDisallows()],
    },
    sitemap: [absoluteUrl("/sitemap-index.xml")],
  };
}
