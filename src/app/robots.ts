import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/i18n/config";
import { localePath } from "@/lib/i18n/paths";
import { absoluteUrl } from "@/lib/seo";

/**
 * Crawl rules. Personal/shared countdowns, the embeddable widget and the query-string URL space
 * (`?q=`, `?sort=`, `?page=`) are disallowed because `noindex` alone does not save crawl budget —
 * and an embed is linked from every page that hosts it, so it would be crawled a great deal. AI
 * crawlers are allowed on purpose: the catalog is public and attributed.
 *
 * The per-page rules are repeated in every locale's spelling (`/es/evento/mine-`, `/de/ereignis/…`)
 * — a `Disallow` is a literal prefix match, so the English one does not cover the others.
 */
function everyLocale(path: string): string[] {
  return LOCALES.map((locale) => localePath(locale, path));
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/og/"],
      disallow: [
        "/api/",
        ...everyLocale("/event/mine-"),
        ...everyLocale("/event/share-"),
        "/embed/",
        "/*?q=",
        "/*?sort=",
        "/*?page=",
      ],
    },
    sitemap: [absoluteUrl("/sitemap-index.xml")],
  };
}
