export const LOCALES = [
  "en",
  "es",
  "pt",
  "fr",
  "de",
  "it",
  "nl",
  "pl",
  "ru",
  "uk",
  "tr",
  "ar",
  "he",
  "hi",
  "id",
  "ja",
  "ko",
  "zh",
  "zh-Hant",
  "vi",
  "th",
  "sv",
  "da",
  "no",
  "fi",
  "cs",
  "el",
] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const RTL_LOCALES = new Set<Locale>(["ar", "he"]);

type LocaleMeta = {
  /** BCP 47 tag for `<html lang>` and `Intl`. */
  bcp47: string;
  hreflang: string;
  ogLocale: string;
  dir: "ltr" | "rtl";
  /** Native endonym for the language switcher. */
  endonym: string;
  font: "latin" | "cyrillic" | "greek" | "arabic" | "hebrew" | "devanagari" | "thai" | "jp" | "kr" | "sc" | "tc" | "vietnamese";
};

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: { bcp47: "en", hreflang: "en", ogLocale: "en_US", dir: "ltr", endonym: "English", font: "latin" },
  es: { bcp47: "es", hreflang: "es", ogLocale: "es_ES", dir: "ltr", endonym: "Español", font: "latin" },
  pt: { bcp47: "pt", hreflang: "pt", ogLocale: "pt_BR", dir: "ltr", endonym: "Português", font: "latin" },
  fr: { bcp47: "fr", hreflang: "fr", ogLocale: "fr_FR", dir: "ltr", endonym: "Français", font: "latin" },
  de: { bcp47: "de", hreflang: "de", ogLocale: "de_DE", dir: "ltr", endonym: "Deutsch", font: "latin" },
  it: { bcp47: "it", hreflang: "it", ogLocale: "it_IT", dir: "ltr", endonym: "Italiano", font: "latin" },
  nl: { bcp47: "nl", hreflang: "nl", ogLocale: "nl_NL", dir: "ltr", endonym: "Nederlands", font: "latin" },
  pl: { bcp47: "pl", hreflang: "pl", ogLocale: "pl_PL", dir: "ltr", endonym: "Polski", font: "latin" },
  ru: { bcp47: "ru", hreflang: "ru", ogLocale: "ru_RU", dir: "ltr", endonym: "Русский", font: "cyrillic" },
  uk: { bcp47: "uk", hreflang: "uk", ogLocale: "uk_UA", dir: "ltr", endonym: "Українська", font: "cyrillic" },
  tr: { bcp47: "tr", hreflang: "tr", ogLocale: "tr_TR", dir: "ltr", endonym: "Türkçe", font: "latin" },
  ar: { bcp47: "ar", hreflang: "ar", ogLocale: "ar_AR", dir: "rtl", endonym: "العربية", font: "arabic" },
  he: { bcp47: "he", hreflang: "he", ogLocale: "he_IL", dir: "rtl", endonym: "עברית", font: "hebrew" },
  hi: { bcp47: "hi", hreflang: "hi", ogLocale: "hi_IN", dir: "ltr", endonym: "हिन्दी", font: "devanagari" },
  id: { bcp47: "id", hreflang: "id", ogLocale: "id_ID", dir: "ltr", endonym: "Indonesia", font: "latin" },
  ja: { bcp47: "ja", hreflang: "ja", ogLocale: "ja_JP", dir: "ltr", endonym: "日本語", font: "jp" },
  ko: { bcp47: "ko", hreflang: "ko", ogLocale: "ko_KR", dir: "ltr", endonym: "한국어", font: "kr" },
  zh: { bcp47: "zh-Hans", hreflang: "zh-Hans", ogLocale: "zh_CN", dir: "ltr", endonym: "简体中文", font: "sc" },
  "zh-Hant": { bcp47: "zh-Hant", hreflang: "zh-Hant", ogLocale: "zh_TW", dir: "ltr", endonym: "繁體中文", font: "tc" },
  vi: { bcp47: "vi", hreflang: "vi", ogLocale: "vi_VN", dir: "ltr", endonym: "Tiếng Việt", font: "vietnamese" },
  th: { bcp47: "th", hreflang: "th", ogLocale: "th_TH", dir: "ltr", endonym: "ไทย", font: "thai" },
  sv: { bcp47: "sv", hreflang: "sv", ogLocale: "sv_SE", dir: "ltr", endonym: "Svenska", font: "latin" },
  da: { bcp47: "da", hreflang: "da", ogLocale: "da_DK", dir: "ltr", endonym: "Dansk", font: "latin" },
  no: { bcp47: "nb", hreflang: "no", ogLocale: "nb_NO", dir: "ltr", endonym: "Norsk", font: "latin" },
  fi: { bcp47: "fi", hreflang: "fi", ogLocale: "fi_FI", dir: "ltr", endonym: "Suomi", font: "latin" },
  cs: { bcp47: "cs", hreflang: "cs", ogLocale: "cs_CZ", dir: "ltr", endonym: "Čeština", font: "latin" },
  el: { bcp47: "el", hreflang: "el", ogLocale: "el_GR", dir: "ltr", endonym: "Ελληνικά", font: "greek" },
};

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function localeOf(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function localeDir(locale: string): "ltr" | "rtl" {
  return RTL_LOCALES.has(localeOf(locale)) ? "rtl" : "ltr";
}

export function localeBcp47(locale: string): string {
  return LOCALE_META[localeOf(locale)].bcp47;
}

export function localeHreflang(locale: string): string {
  return LOCALE_META[localeOf(locale)].hreflang;
}

export function localeOg(locale: string): string {
  return LOCALE_META[localeOf(locale)].ogLocale;
}

export function localeEndonym(locale: string): string {
  return LOCALE_META[localeOf(locale)].endonym;
}

export function localeFont(locale: string): LocaleMeta["font"] {
  return LOCALE_META[localeOf(locale)].font;
}

/** URL prefix without a trailing slash. English is unprefixed. */
export function localePrefix(locale: string): string {
  const value = localeOf(locale);
  if (value === DEFAULT_LOCALE) return "";
  return value === "zh-Hant" ? "/zh-hant" : `/${value}`;
}

/** Prefix an in-app path for a locale (`/` → `/es`, `/event/x` → `/es/event/x`). */
export function localizePath(path: string, locale: string): string {
  const prefix = localePrefix(locale);
  if (!prefix) return path.startsWith("/") ? path : `/${path}`;
  if (path === "/") return prefix;
  return `${prefix}${path.startsWith("/") ? path : `/${path}`}`;
}

export const PREFIXED_LOCALE_PATTERN = "es|pt|fr|de|it|nl|pl|ru|uk|tr|ar|he|hi|id|ja|ko|zh-hant|zh|vi|th|sv|da|no|fi|cs|el";

/** Strip a known locale prefix so `/es/saved` and `/saved` compare the same. */
export function pathnameWithoutLocale(path: string): string {
  const [pathname, query] = path.split("?");
  const suffix = query ? `?${query}` : "";
  const lower = pathname.toLowerCase();
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    const prefix = localePrefix(locale);
    if (lower === prefix) return query ? `/?${query}` : "/";
    if (lower.startsWith(`${prefix}/`)) return `${pathname.slice(prefix.length)}${suffix}`;
  }
  return path;
}

/** Handle-safe tokens that must never become public profile slugs. */
export const LOCALE_HANDLE_RESERVATIONS = [
  ...LOCALES.map((locale) => locale.toLowerCase().replace(/-/g, "")),
  "zh",
  "zhhant",
] as const;
