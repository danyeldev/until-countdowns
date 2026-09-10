import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, PREFIXED_LOCALES } from "@/lib/i18n/config";
import { localePath, SECTIONS, sectionName, type Section } from "@/lib/i18n/paths";
import { hubQueryRedirects, localeRedirects, localeRewrites } from "@/lib/i18n/routing";

const APP_DIR = fileURLToPath(new URL("../../src/app/[locale]", import.meta.url));

/** Route folders under `[locale]`, minus route groups, private folders and dynamic segments. */
function routeSections(): string[] {
  return readdirSync(APP_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !name.startsWith("(") && !name.startsWith("_") && !name.startsWith("["));
}

describe("the app tree and the section list agree", () => {
  it("has a SECTIONS entry for every route folder under [locale]", () => {
    // The rewrites are generated from SECTIONS. A folder missing from it would be reachable at
    // /es/<folder> but 404 at /<folder> in English, which is the one failure mode worth a test.
    expect([...routeSections()].sort()).toEqual([...SECTIONS].sort());
  });
});

describe("localeRewrites", () => {
  const rewrites = localeRewrites();
  const sources = new Set(rewrites.map((r) => r.source));

  it("routes the bare English URL of every section to /en", () => {
    expect(sources.has("/")).toBe(true);
    for (const section of SECTIONS) {
      expect(sources.has(`/${section}`), section).toBe(true);
      expect(sources.has(`/${section}/:rest*`), section).toBe(true);
    }
  });

  it("routes every renamed section of every locale to its English file route", () => {
    for (const locale of PREFIXED_LOCALES) {
      for (const section of SECTIONS) {
        const name = sectionName(locale, section);
        if (name === section) continue;
        const rule = rewrites.find((r) => r.source === `/${locale}/${name}`);
        expect(rule, `${locale}/${name}`).toBeDefined();
        expect(rule?.destination).toBe(`/${locale}/${section}`);
      }
    }
  });

  it("never rewrites a path outside the nine sections", () => {
    const heads = new Set([...sources].map((s) => s.split("/").filter(Boolean)[0]).filter(Boolean));
    const allowed = new Set<string>([...SECTIONS, ...PREFIXED_LOCALES]);
    for (const head of heads) expect(allowed.has(head), head).toBe(true);
  });

  it("has no duplicate sources: the first match wins, so a duplicate is a dead rule", () => {
    expect(sources.size).toBe(rewrites.length);
  });
});

describe("localeRedirects", () => {
  const redirects = localeRedirects();

  it("folds /en back onto the bare path", () => {
    expect(redirects).toContainEqual({ source: "/en", destination: "/", permanent: true });
    expect(redirects).toContainEqual({ source: "/en/:rest*", destination: "/:rest*", permanent: true });
  });

  it("folds the English spelling of a section onto the locale's own", () => {
    expect(redirects).toContainEqual({
      source: "/es/days-until",
      destination: "/es/cuantos-dias-faltan",
      permanent: true,
    });
  });

  it("cannot loop: no redirect source is also a rewrite destination", () => {
    // Next runs redirects first, then the `beforeFiles` rewrites. A loop would need a redirect whose
    // source matches what the rewrites produce; the rewrites only ever produce English spellings
    // under a locale prefix, which is exactly what the redirects consume — and the redirect fires on
    // the *incoming* URL only, never on a rewrite's internal destination.
    const rewriteSources = new Set(localeRewrites().map((r) => r.source));
    for (const redirect of redirects) expect(rewriteSources.has(redirect.source), redirect.source).toBe(false);
  });

  it("leaves a locale that keeps the English section alone", () => {
    // `ja` does not rename anything, so there is nothing to fold.
    expect(redirects.some((r) => r.source.startsWith("/ja/"))).toBe(false);
  });
});

describe("hubQueryRedirects", () => {
  const redirects = hubQueryRedirects();

  it("repeats the pre-i18n query redirects in every locale's spelling", () => {
    expect(redirects.length).toBe(LOCALES.length * 3);
    const es = redirects.filter((r) => r.source === "/es" || r.source.startsWith("/es/"));
    expect(es.map((r) => r.destination)).toEqual([
      "/es/categoria/:c",
      "/es/categoria/:c/page/:n",
      "/es/etiqueta/:t/page/:n",
    ]);
  });

  it("keeps the English rules at the unprefixed paths", () => {
    const en = redirects.filter((r) => r.source === "/" || r.source.startsWith("/category") || r.source.startsWith("/tag"));
    expect(en.map((r) => r.destination)).toEqual(["/category/:c", "/category/:c/page/:n", "/tag/:t/page/:n"]);
  });
});

describe("the rewrite table covers what the app links to", () => {
  it("every localized href a page can build has a rule that resolves it", () => {
    const rewrites = localeRewrites();
    const resolves = (publicPath: string): boolean =>
      rewrites.some((r) => {
        const prefix = r.source.replace("/:rest*", "");
        return r.source.endsWith("/:rest*") ? publicPath === prefix || publicPath.startsWith(`${prefix}/`) : publicPath === r.source;
      });
    const paths: string[] = ["/", ...SECTIONS.map((s: Section) => `/${s}`), "/category/sports", "/days-until/christmas"];
    for (const locale of LOCALES) {
      for (const path of paths) {
        const publicPath = localePath(locale, path);
        // A prefixed locale's own file route needs no rewrite when the section is not renamed.
        const needsRule = locale === DEFAULT_LOCALE || sectionName(locale, path.split("/")[1] as Section) !== path.split("/")[1];
        if (!needsRule || path === "/") continue;
        expect(resolves(publicPath), `${locale} ${publicPath}`).toBe(true);
      }
    }
  });
});
