import { describe, expect, it } from "vitest";
import { ENTITY_KEYS, ENTITY_KEY_SET } from "@/data/i18n/entities/keys";
import { ENTITY_NAMES } from "@/data/i18n/entities";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { entityKey, entityName, hasEntityName, localizedTitle } from "@/lib/i18n/content";
import { slugify } from "@/lib/ingest/normalize";

describe("entityKey", () => {
  it("agrees with the ingest pipeline's slugify, which is what the keys are", () => {
    // `content.ts` keeps its own copy so that a Client Component importing it does not pull in
    // node:crypto. This is the test that stops the copy drifting.
    const titles = [
      ...ENTITY_KEYS.map(([, title]) => title),
      "Christmas Day",
      "New Year's Eve",
      "São Paulo Grand Prix",
      "Fête de la Musique",
      "Eid al-Fitr",
      "2027 FIFA World Cup",
      "Eclipse Temurin 26 end of life",
      "  Spaced   out  ",
      "Ünïcödé Ẁôrds",
      "A".repeat(120),
    ];
    for (const title of titles) expect(entityKey(title), title).toBe(slugify(title));
  });

  it("produces the key each curated entity is filed under", () => {
    for (const [key, title] of ENTITY_KEYS) expect(entityKey(title)).toBe(key);
  });
});

describe("the entity tables", () => {
  const tables = Object.entries(ENTITY_NAMES) as [Locale, Record<string, string>][];

  it("covers every locale but English", () => {
    expect(tables.map(([l]) => l).sort()).toEqual(LOCALES.filter((l) => l !== "en").sort());
  });

  it.each(tables)("%s uses only keys from keys.ts", (_locale, names) => {
    // A key that is not in the list is a name nothing will ever look up — a typo, in practice.
    const unknown = Object.keys(names).filter((key) => !ENTITY_KEY_SET.has(key));
    expect(unknown).toEqual([]);
  });

  it.each(tables)("%s has no empty or whitespace-only name", (_locale, names) => {
    const blank = Object.entries(names).filter(([, value]) => !value || !value.trim());
    expect(blank).toEqual([]);
  });

  it.each(tables)("%s keys are lowercase slugs", (_locale, names) => {
    const malformed = Object.keys(names).filter((key) => key !== entityKey(key));
    expect(malformed).toEqual([]);
  });
});

describe("localizedTitle", () => {
  it("leaves English alone — the catalog title is the English name", () => {
    expect(localizedTitle("en", "Christmas Day")).toBe("Christmas Day");
    expect(entityName("en", "Christmas Day")).toBeUndefined();
  });

  it("falls back to the catalog title when a locale has no curated name", () => {
    expect(localizedTitle("es", "Eclipse Temurin 26 end of life")).toBe("Eclipse Temurin 26 end of life");
    expect(hasEntityName("es", "Eclipse Temurin 26 end of life")).toBe(false);
  });

  it("finds a name by slug as well as by title", () => {
    const [key, title] = ENTITY_KEYS[0];
    const locale = LOCALES.find((l) => l !== "en" && ENTITY_NAMES[l]?.[key]);
    if (!locale) return; // no translations for this key yet
    expect(localizedTitle(locale, "Something Else Entirely", key)).toBe(ENTITY_NAMES[locale]![key]);
    expect(localizedTitle(locale, title)).toBe(ENTITY_NAMES[locale]![key]);
  });
});
