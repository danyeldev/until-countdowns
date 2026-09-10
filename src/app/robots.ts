import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/**
 * Crawl rules. Personal/shared countdowns, the embeddable widget and the query-string URL space
 * (`?q=`, `?sort=`, `?page=`) are disallowed because `noindex` alone does not save crawl budget —
 * and an embed is linked from every page that hosts it, so it would be crawled a great deal. AI
 * crawlers are allowed on purpose: the catalog is public and attributed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/og/"],
      disallow: ["/api/", "/event/mine-", "/event/share-", "/embed/", "/*?q=", "/*?sort=", "/*?page="],
    },
    sitemap: [absoluteUrl("/sitemap-index.xml")],
  };
}
