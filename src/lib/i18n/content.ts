/**
 * Catalog content in the reader's language.
 *
 * The catalog itself is one English corpus — 40,000 rows from Wikidata, date-holidays, ESPN and a
 * dozen other feeds, none of which ships a Spanish title. Machine-translating all of it would be
 * both expensive and wrong: "Eclipse Temurin 26 end of life" has no Spanish name, and inventing one
 * puts a page in the index for a phrase nobody types.
 *
 * So translation is **curated and narrow**. `src/data/i18n/entities/` carries the names people
 * actually search for in their own language — Navidad, Weihnachten, رمضان, 크리스마스 — for the
 * couple of hundred dates that carry the volume. Everything else keeps its English name inside a
 * fully translated sentence ("¿Cuántos días faltan para Black Friday?"), which is what a Spanish
 * speaker types anyway for an entity with no Spanish name.
 *
 * The lookup key is `slugify(title)`, which is the same string the ingest pipeline uses as a slug
 * base (`src/lib/ingest/normalize.ts`), so a curated series and the dated rows expanded from it
 * share one entry — `christmas-day` translates on the series page, on the event page and in every
 * listing, without either side storing an id.
 */
import { ENTITY_NAMES } from "@/data/i18n/entities";
import { ENTITY_KEYS } from "@/data/i18n/entities/keys";
import type { Locale } from "./config";
import { DEFAULT_LOCALE } from "./config";

/**
 * `slugify()` from the ingest pipeline, minus its digest fallback.
 *
 * Deliberately a copy: importing `normalize.ts` would pull `node:crypto` into anything a Client
 * Component touches. `tests/i18n/content.test.ts` asserts the two agree on every catalog title
 * shape, so the copy cannot drift.
 */
export function entityKey(title: string): string {
  return String(title)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * The locale's own name for an entity, or `undefined` when there is no curated one.
 * `slug` is used when the caller already has it (a series slug is `slugify(title)` by invariant).
 */
export function entityName(locale: Locale, title: string, slug?: string): string | undefined {
  if (locale === DEFAULT_LOCALE) return undefined;
  const names = ENTITY_NAMES[locale];
  if (!names) return undefined;
  // `hasOwnProperty`, not a truthiness check: the tables are object literals, so a row titled
  // "Constructor" slugifies to a key every object already has and would otherwise hand back
  // `Object.prototype.constructor` — a function, which `truncate()` then throws on.
  const own = (key: string): string | undefined =>
    Object.prototype.hasOwnProperty.call(names, key) ? names[key] : undefined;
  return (slug ? own(slug) : undefined) ?? own(entityKey(title));
}

/** The title to display: the curated translation when there is one, the catalog's English otherwise. */
export function localizedTitle(locale: Locale, title: string, slug?: string): string {
  return entityName(locale, title, slug) ?? title;
}

/** Whether an entity has a curated name in this locale — the gate for indexing a translated page. */
export function hasEntityName(locale: Locale, title: string, slug?: string): boolean {
  return entityName(locale, title, slug) !== undefined;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** Case- and accent-insensitive form, so "NAVIDAD" and "Navidad" are the same needle. */
function fold(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

/** Built once per locale, lazily: the locale's own name for an entity → the catalog's English title. */
const reverseIndexes = new Map<Locale, Map<string, string>>();

function reverseIndex(locale: Locale): Map<string, string> {
  let index = reverseIndexes.get(locale);
  if (index) return index;
  index = new Map();
  const names = ENTITY_NAMES[locale];
  if (names) {
    const englishByKey = new Map(ENTITY_KEYS);
    for (const [key, name] of Object.entries(names)) {
      const english = englishByKey.get(key);
      if (english) index.set(fold(name), english);
    }
  }
  reverseIndexes.set(locale, index);
  return index;
}

/**
 * The needle to actually search the catalog with.
 *
 * `search_events` matches English titles — the corpus is English and no amount of interface
 * translation changes that — so a Spanish reader typing "navidad" would otherwise get nothing at
 * all. Where the query names an entity this locale has a curated name for, it is swapped for the
 * English title before the RPC sees it; everything else is passed through untouched, because a
 * partial or fuzzy remapping would do more harm than the miss it is trying to fix.
 */
export function searchQueryFor(locale: Locale, q: string): string {
  if (locale === DEFAULT_LOCALE || !q) return q;
  return reverseIndex(locale).get(fold(q)) ?? q;
}
