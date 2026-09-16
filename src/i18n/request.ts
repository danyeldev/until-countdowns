import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE } from "./locales";
import { routing } from "./routing";

const loaders = {
  en: () => import("../../messages/en.json"),
  es: () => import("../../messages/es.json"),
  pt: () => import("../../messages/pt.json"),
  fr: () => import("../../messages/fr.json"),
  de: () => import("../../messages/de.json"),
  it: () => import("../../messages/it.json"),
  nl: () => import("../../messages/nl.json"),
  pl: () => import("../../messages/pl.json"),
  ru: () => import("../../messages/ru.json"),
  uk: () => import("../../messages/uk.json"),
  tr: () => import("../../messages/tr.json"),
  ar: () => import("../../messages/ar.json"),
  he: () => import("../../messages/he.json"),
  hi: () => import("../../messages/hi.json"),
  id: () => import("../../messages/id.json"),
  ja: () => import("../../messages/ja.json"),
  ko: () => import("../../messages/ko.json"),
  zh: () => import("../../messages/zh.json"),
  "zh-Hant": () => import("../../messages/zh-Hant.json"),
  vi: () => import("../../messages/vi.json"),
  th: () => import("../../messages/th.json"),
  sv: () => import("../../messages/sv.json"),
  da: () => import("../../messages/da.json"),
  no: () => import("../../messages/no.json"),
  fi: () => import("../../messages/fi.json"),
  cs: () => import("../../messages/cs.json"),
  el: () => import("../../messages/el.json"),
} satisfies Record<(typeof routing.locales)[number], () => Promise<{ default: Messages }>>;

type Messages = typeof import("../../messages/en.json");

export default getRequestConfig(async ({ requestLocale, locale: explicit }) => {
  const requested = explicit ?? (await requestLocale);
  const locale = hasLocale(routing.locales, requested) ? requested : DEFAULT_LOCALE;
  const messages = (await loaders[locale]()).default;
  return { locale, messages };
});
