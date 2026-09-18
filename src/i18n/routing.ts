import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALES } from "./locales";

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: {
    mode: "as-needed",
    prefixes: {
      "zh-Hant": "/zh-hant",
    },
  },
  localeDetection: false,
  // No `Link: <…>; rel="alternate"; hreflang=…` header listing the 26 locale copies of every
  // page: they canonicalise to the English URL and are disallowed in robots.txt (see
  // `isCrawlTrap`). The header was handing crawlers the whole multiplied catalog to fetch.
  alternateLinks: false,
});
