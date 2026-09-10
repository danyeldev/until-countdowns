/**
 * The locale set, and everything about a locale that is not a translated string.
 *
 * Why the site is multilingual at all: "how many days until X" is a query people type in their own
 * language, and the phrasing *is* the keyword — "cuántos días faltan para", "wie viele Tage bis",
 * "kaç gün kaldı", "كم باقي على". An English-only page cannot rank for any of them, however good
 * its data is. So the catalog stays one corpus and the wrapper around it — titles, descriptions,
 * headings, dates, the URL path — is rendered in fifteen languages.
 *
 * This module is imported by `next.config.ts` (through `routing.ts`), so it must stay free of
 * React, `server-only`, and the `@/` path alias.
 */

/**
 * Supported locales. `en` is the default and is served without a path prefix, so every URL the
 * site had before i18n keeps working and keeps its ranking; the others live under `/<locale>/`.
 *
 * Chosen for search volume on countdown phrasings plus a catalog the language actually has dates
 * for (Hindi and Arabic pull their weight through the Hindu and Islamic calendars). Adding one is
 * a message file, an entity file and an entry here — see the README.
 */
export const LOCALES = [
  "en",
  "es",
  "pt",
  "fr",
  "de",
  "it",
  "nl",
  "pl",
  "tr",
  "ru",
  "id",
  "ja",
  "ko",
  "hi",
  "ar",
] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Locales that carry a `/<locale>` path prefix (every one but the default). */
export const PREFIXED_LOCALES: Locale[] = LOCALES.filter((l) => l !== DEFAULT_LOCALE);

export type LocaleMeta = {
  /** BCP-47 tag handed to `Intl.*`. Regional where the region decides the formatting. */
  tag: string;
  /** `<html lang>` and the `hreflang` value. Language-only: the content is not region-specific. */
  lang: string;
  /** Name of the language in that language, for the switcher. */
  nativeName: string;
  /** English name, for `title` attributes and the sitemap comments. */
  englishName: string;
  dir: "ltr" | "rtl";
  /** Open Graph `og:locale` (language_TERRITORY). */
  ogLocale: string;
};

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: { tag: "en-US", lang: "en", nativeName: "English", englishName: "English", dir: "ltr", ogLocale: "en_US" },
  es: { tag: "es-ES", lang: "es", nativeName: "Español", englishName: "Spanish", dir: "ltr", ogLocale: "es_ES" },
  // Brazil is the larger search market by an order of magnitude, so `pt` reads as pt-BR.
  pt: { tag: "pt-BR", lang: "pt", nativeName: "Português", englishName: "Portuguese", dir: "ltr", ogLocale: "pt_BR" },
  fr: { tag: "fr-FR", lang: "fr", nativeName: "Français", englishName: "French", dir: "ltr", ogLocale: "fr_FR" },
  de: { tag: "de-DE", lang: "de", nativeName: "Deutsch", englishName: "German", dir: "ltr", ogLocale: "de_DE" },
  it: { tag: "it-IT", lang: "it", nativeName: "Italiano", englishName: "Italian", dir: "ltr", ogLocale: "it_IT" },
  nl: { tag: "nl-NL", lang: "nl", nativeName: "Nederlands", englishName: "Dutch", dir: "ltr", ogLocale: "nl_NL" },
  pl: { tag: "pl-PL", lang: "pl", nativeName: "Polski", englishName: "Polish", dir: "ltr", ogLocale: "pl_PL" },
  tr: { tag: "tr-TR", lang: "tr", nativeName: "Türkçe", englishName: "Turkish", dir: "ltr", ogLocale: "tr_TR" },
  ru: { tag: "ru-RU", lang: "ru", nativeName: "Русский", englishName: "Russian", dir: "ltr", ogLocale: "ru_RU" },
  id: { tag: "id-ID", lang: "id", nativeName: "Bahasa Indonesia", englishName: "Indonesian", dir: "ltr", ogLocale: "id_ID" },
  ja: { tag: "ja-JP", lang: "ja", nativeName: "日本語", englishName: "Japanese", dir: "ltr", ogLocale: "ja_JP" },
  ko: { tag: "ko-KR", lang: "ko", nativeName: "한국어", englishName: "Korean", dir: "ltr", ogLocale: "ko_KR" },
  hi: { tag: "hi-IN", lang: "hi", nativeName: "हिन्दी", englishName: "Hindi", dir: "ltr", ogLocale: "hi_IN" },
  ar: { tag: "ar", lang: "ar", nativeName: "العربية", englishName: "Arabic", dir: "rtl", ogLocale: "ar_AR" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** The locale, or the default when the segment is anything else. Never throws. */
export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function localeMeta(locale: Locale): LocaleMeta {
  return LOCALE_META[locale] ?? LOCALE_META[DEFAULT_LOCALE];
}
