/**
 * URL shapes, in fifteen languages.
 *
 * One rule: the *file* route is always the English one (`/[locale]/days-until/[series]`), and the
 * *public* URL is the localized one (`/es/cuantos-dias-faltan/navidad`). `next.config.ts` bridges
 * the two with generated rewrites (see `routing.ts`), so nothing in the app tree has to know that
 * a section has more than one name.
 *
 * English keeps its bare paths (`/days-until/christmas`) — every URL the site had before i18n is
 * still the canonical English one, which is the whole reason the default locale is unprefixed.
 *
 * Only the *section* (the first path segment) is translated. Slugs are not: a category slug is a
 * database key, a series slug is what `finalize_catalog()` links rows by, and a mistranslated slug
 * is a 404 on a page that was ranking. The keyword value of a slug is small; the risk is not.
 *
 * Imported by `next.config.ts` — no React, no `server-only`, no `@/` alias.
 */
import { DEFAULT_LOCALE, isLocale, LOCALES, type Locale } from "./config";

/** First path segment of every localizable route. Also the exhaustive list the rewrites are built from. */
export const SECTIONS = [
  "about",
  "attributions",
  "calendar",
  "category",
  "country",
  "create",
  "days-until",
  "event",
  "tag",
] as const;

export type Section = (typeof SECTIONS)[number];

/**
 * Localized section names, ASCII and lowercase because they end up in `next.config.ts` matchers.
 *
 * A locale that omits a section keeps the English word. Latin-script locales translate everything;
 * `ru` translates in transliteration (which is what Russian sites do, and what a Russian reader can
 * type); `ja`, `ko` and `ar` keep the English sections, since a romanisation of those scripts is a
 * keyword to nobody and native script in a path only buys percent-encoding. `hi` is in between and
 * is explained where it sits.
 */
export const SECTION_NAMES: Record<Locale, Partial<Record<Section, string>>> = {
  en: {},
  es: {
    about: "acerca-de",
    attributions: "atribuciones",
    calendar: "calendario",
    category: "categoria",
    country: "pais",
    create: "crear",
    "days-until": "cuantos-dias-faltan",
    event: "evento",
    tag: "etiqueta",
  },
  pt: {
    about: "sobre",
    attributions: "atribuicoes",
    calendar: "calendario",
    category: "categoria",
    country: "pais",
    create: "criar",
    "days-until": "quantos-dias-faltam",
    event: "evento",
    // "Etiqueta" is a sticker; Brazilian Portuguese says "tag" for this.
    tag: "tag",
  },
  fr: {
    about: "a-propos",
    attributions: "attributions",
    calendar: "calendrier",
    category: "categorie",
    country: "pays",
    create: "creer",
    "days-until": "combien-de-jours-avant",
    event: "evenement",
    tag: "etiquette",
  },
  de: {
    // A bare "ueber" is a preposition with nothing after it; German sites say /ueber-uns/.
    about: "ueber-uns",
    attributions: "quellen",
    calendar: "kalender",
    category: "kategorie",
    country: "land",
    create: "erstellen",
    "days-until": "wie-viele-tage-bis",
    // "Ereignis" is a happening; a scheduled dated row is a Termin, which is also what people type.
    event: "termin",
    // "Tag" is German for "day", which would read as a date section; a tag is a Schlagwort.
    tag: "schlagwort",
  },
  it: {
    about: "informazioni",
    attributions: "attribuzioni",
    calendar: "calendario",
    category: "categoria",
    country: "paese",
    create: "crea",
    "days-until": "quanti-giorni-mancano",
    event: "evento",
    tag: "etichetta",
  },
  nl: {
    about: "over",
    attributions: "bronvermelding",
    calendar: "kalender",
    category: "categorie",
    country: "land",
    create: "maken",
    "days-until": "hoeveel-dagen-tot",
    event: "evenement",
    tag: "label",
  },
  pl: {
    about: "o-serwisie",
    attributions: "zrodla",
    calendar: "kalendarz",
    category: "kategoria",
    country: "kraj",
    create: "utworz",
    "days-until": "ile-dni-do",
    event: "wydarzenie",
    tag: "tag",
  },
  tr: {
    about: "hakkinda",
    attributions: "kaynaklar",
    calendar: "takvim",
    category: "kategori",
    country: "ulke",
    create: "olustur",
    "days-until": "kac-gun-kaldi",
    event: "etkinlik",
    tag: "etiket",
  },
  ru: {
    about: "o-proekte",
    attributions: "istochniki",
    calendar: "kalendar",
    category: "kategoriya",
    country: "strana",
    create: "sozdat",
    "days-until": "skolko-dney-do",
    event: "sobytie",
    tag: "metka",
  },
  id: {
    about: "tentang",
    attributions: "atribusi",
    calendar: "kalender",
    category: "kategori",
    country: "negara",
    create: "buat",
    "days-until": "berapa-hari-lagi",
    event: "acara",
    tag: "tag",
  },
  ja: {},
  ko: {},
  hi: {
    /**
     * The exception to the rule below. Roman-script Hindi is a mainstream written register —
     * "diwali kitne din baaki hai" is typed in Latin letters at high volume — so this segment is a
     * keyword rather than a transliteration. The other eight stay English because category,
     * calendar, event and tag are themselves loanwords in spoken Hindi: the English spelling
     * already *is* the word, while a romanisation off the Devanagari is a keyword to nobody.
     */
    "days-until": "kitne-din-baaki",
  },
  ar: {},
};

/** The public name of a section in a locale (the English word when the locale does not rename it). */
export function sectionName(locale: Locale, section: Section): string {
  return SECTION_NAMES[locale]?.[section] ?? section;
}

/** Reverse map, per locale: public section name → English section. Built once. */
const REVERSE: Record<Locale, Record<string, Section>> = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    Object.fromEntries(SECTIONS.map((s) => [sectionName(locale, s), s])) as Record<string, Section>,
  ]),
) as Record<Locale, Record<string, Section>>;

function isSection(value: string): value is Section {
  return (SECTIONS as readonly string[]).includes(value);
}

/** Splits `/a/b?q=1#x` into its path and everything the path helpers must pass through untouched. */
function splitPath(path: string): { pathname: string; rest: string } {
  const cut = path.search(/[?#]/);
  if (cut === -1) return { pathname: path, rest: "" };
  return { pathname: path.slice(0, cut), rest: path.slice(cut) };
}

/**
 * The public URL of an app-internal path in a locale.
 *
 * `localePath("es", "/days-until/navidad")` → `/es/cuantos-dias-faltan/navidad`
 * `localePath("en", "/days-until/navidad")` → `/days-until/navidad`
 * `localePath("es", "/")`                   → `/es`
 *
 * Absolute URLs and non-page paths (`/api/…`, `/og/…`, `/embed/…`) are returned unchanged: they are
 * not localized, and a locale prefix on them would 404.
 */
export function localePath(locale: Locale, path: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("//")) return path;
  const { pathname, rest } = splitPath(path);
  if (!pathname.startsWith("/")) return path;
  const segments = pathname.split("/").filter(Boolean);
  const head = segments[0];
  if (head) {
    if (!isSection(head)) return path; // /api, /og, /embed, /sitemap.xml, …
    segments[0] = sectionName(locale, head);
  }
  if (locale !== DEFAULT_LOCALE) segments.unshift(locale);
  const joined = segments.join("/");
  return joined ? `/${joined}${rest}` : `/${rest}`;
}

export type ParsedPath = { locale: Locale; path: string };

/**
 * The inverse of `localePath()`: the locale a public path is in, and the app-internal (English)
 * path it names. Unknown sections are left alone, so this is safe on any URL.
 */
export function parsePath(path: string): ParsedPath {
  const { pathname, rest } = splitPath(path);
  const segments = pathname.split("/").filter(Boolean);
  const locale = isLocale(segments[0]) ? (segments.shift() as Locale) : DEFAULT_LOCALE;
  const head = segments[0];
  if (head) {
    const section = REVERSE[locale][head];
    if (section) segments[0] = section;
  }
  return { locale, path: `/${segments.join("/")}${rest}` };
}

/**
 * Every locale's public URL for one app-internal path, keyed by `hreflang` value, plus `x-default`
 * pointing at English. Handed to Next's `alternates.languages`.
 */
export function alternatePaths(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const locale of LOCALES) out[locale] = localePath(locale, path);
  out["x-default"] = localePath(DEFAULT_LOCALE, path);
  return out;
}
