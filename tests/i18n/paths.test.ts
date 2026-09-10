import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n/config";
import { alternatePaths, localePath, parsePath, SECTIONS, sectionName } from "@/lib/i18n/paths";

describe("localePath", () => {
  it("leaves English unprefixed, so every pre-i18n URL is still the canonical one", () => {
    expect(localePath("en", "/")).toBe("/");
    expect(localePath("en", "/days-until/christmas")).toBe("/days-until/christmas");
    expect(localePath("en", "/category/sports/page/3")).toBe("/category/sports/page/3");
  });

  it("prefixes and translates the section for every other locale", () => {
    expect(localePath("es", "/")).toBe("/es");
    expect(localePath("es", "/days-until/christmas")).toBe("/es/cuantos-dias-faltan/christmas");
    expect(localePath("de", "/category/sports")).toBe("/de/kategorie/sports");
    expect(localePath("tr", "/event/halloween-2026-10-31")).toBe("/tr/etkinlik/halloween-2026-10-31");
  });

  it("keeps the English section for a locale that does not rename it", () => {
    expect(localePath("ja", "/days-until/christmas")).toBe("/ja/days-until/christmas");
    expect(localePath("ar", "/about")).toBe("/ar/about");
  });

  it("keeps slugs English — they are database keys, not words", () => {
    expect(localePath("es", "/category/sports")).toContain("/sports");
    expect(localePath("fr", "/tag/world-cup")).toBe("/fr/etiquette/world-cup");
  });

  it("passes non-page paths through untouched", () => {
    for (const path of ["/api/events", "/og/default", "/embed/christmas", "/sitemap-index.xml", "/robots.txt"]) {
      for (const locale of LOCALES) expect(localePath(locale, path)).toBe(path);
    }
  });

  it("passes absolute URLs through untouched", () => {
    expect(localePath("es", "https://example.com/days-until/x")).toBe("https://example.com/days-until/x");
    expect(localePath("es", "//example.com/x")).toBe("//example.com/x");
  });

  it("carries the query string and hash", () => {
    expect(localePath("en", "/?q=eclipse&sort=popular")).toBe("/?q=eclipse&sort=popular");
    expect(localePath("es", "/?q=eclipse&sort=popular")).toBe("/es?q=eclipse&sort=popular");
    expect(localePath("pl", "/category/sports?page=2")).toBe("/pl/kategoria/sports?page=2");
    expect(localePath("it", "/days-until/christmas#dates")).toBe("/it/quanti-giorni-mancano/christmas#dates");
  });
});

describe("parsePath", () => {
  it("is the inverse of localePath for every locale and every section", () => {
    const paths = [
      "/",
      "/about",
      "/attributions",
      "/create",
      "/category",
      "/category/sports",
      "/category/sports/page/4",
      "/country",
      "/country/es",
      "/calendar/2027/03",
      "/days-until",
      "/days-until/christmas",
      "/event/christmas-day-2026-12-25",
      "/tag/world-cup",
      "/tag/world-cup/page/2",
    ];
    for (const locale of LOCALES) {
      for (const path of paths) {
        const parsed = parsePath(localePath(locale, path));
        expect(parsed, `${locale} ${path}`).toEqual({ locale, path });
      }
    }
  });

  it("reads an unknown first segment as the default locale rather than throwing", () => {
    expect(parsePath("/foobar")).toEqual({ locale: DEFAULT_LOCALE, path: "/foobar" });
    expect(parsePath("/")).toEqual({ locale: DEFAULT_LOCALE, path: "/" });
  });

  it("leaves a section it does not recognise alone", () => {
    expect(parsePath("/es/nonsense/x")).toEqual({ locale: "es", path: "/nonsense/x" });
  });
});

describe("section names", () => {
  it("are unique within a locale, so no two sections collide on one URL", () => {
    for (const locale of LOCALES) {
      const names = SECTIONS.map((s) => sectionName(locale, s));
      expect(new Set(names).size, locale).toBe(SECTIONS.length);
    }
  });

  it("are lowercase ASCII: they end up in next.config matchers", () => {
    for (const locale of LOCALES) {
      for (const section of SECTIONS) {
        expect(sectionName(locale, section), `${locale}/${section}`).toMatch(/^[a-z0-9-]+$/);
      }
    }
  });

  it("never collide with a locale code, which would make /es/es ambiguous", () => {
    const codes = new Set<string>(LOCALES);
    for (const locale of LOCALES) {
      for (const section of SECTIONS) expect(codes.has(sectionName(locale, section))).toBe(false);
    }
  });
});

describe("alternatePaths", () => {
  it("names every locale plus x-default, and x-default is English", () => {
    const alt = alternatePaths("/days-until/christmas");
    expect(Object.keys(alt).sort()).toEqual([...LOCALES, "x-default"].sort());
    expect(alt["x-default"]).toBe(alt[DEFAULT_LOCALE]);
    expect(alt.es).toBe("/es/cuantos-dias-faltan/christmas");
  });

  it("is reciprocal: every alternate parses back to the same page", () => {
    const alt = alternatePaths("/category/sports");
    for (const [key, path] of Object.entries(alt)) {
      if (key === "x-default") continue;
      expect(parsePath(path).path).toBe("/category/sports");
    }
  });
});
