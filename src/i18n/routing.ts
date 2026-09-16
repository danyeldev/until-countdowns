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
});
