import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/**
 * HTML stays crawlable so search engines can read canonical and noindex instructions on
 * search results, personal countdowns and embeds. A robots disallow cannot prevent indexing.
 * API endpoints are not discoverable pages. Public catalog and social images remain open.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/og/"],
      disallow: ["/api/"],
    },
    sitemap: [absoluteUrl("/sitemap-index.xml")],
  };
}
