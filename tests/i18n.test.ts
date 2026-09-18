import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseHandle } from "@/lib/auth/profile";
import { isAuthGatedPath } from "@/lib/auth/paths";
import {
  DEFAULT_LOCALE,
  LOCALES,
  localeDir,
  localePrefix,
  localizePath,
  pathnameWithoutLocale,
} from "@/i18n/locales";
import { absoluteUrl, buildMetadata, formatLongDate } from "@/lib/seo";

describe("locale routing helpers", () => {
  it("keeps English unprefixed and prefixes other locales", () => {
    expect(localePrefix(DEFAULT_LOCALE)).toBe("");
    expect(localizePath("/event/new-year", "en")).toBe("/event/new-year");
    expect(localizePath("/event/new-year", "es")).toBe("/es/event/new-year");
    expect(localizePath("/", "ja")).toBe("/ja");
    expect(localizePath("/", "zh-Hant")).toBe("/zh-hant");
    expect(localizePath("/about", "zh-Hant")).toBe("/zh-hant/about");
  });

  it("strips a known prefix so gated paths still match", () => {
    expect(pathnameWithoutLocale("/es/saved")).toBe("/saved");
    expect(pathnameWithoutLocale("/zh-hant/create")).toBe("/create");
    expect(pathnameWithoutLocale("/saved")).toBe("/saved");
    expect(isAuthGatedPath("/es/saved")).toBe(true);
    expect(isAuthGatedPath("/ja/create")).toBe(true);
    expect(isAuthGatedPath("/es/about")).toBe(false);
  });

  it("reserves locale handle tokens", () => {
    expect(parseHandle("zhhant")).toBeNull();
    expect(parseHandle("until")).toBeNull();
    expect(LOCALES).toHaveLength(27);
    expect(localeDir("ar")).toBe("rtl");
    expect(localeDir("he")).toBe("rtl");
    expect(localeDir("es")).toBe("ltr");
  });
});

describe("localized metadata", () => {
  it("keeps the English URL canonical for every locale and emits no hreflang alternates", () => {
    // Localized pages translate the chrome around the same English catalog. Giving each its own
    // canonical and 27 hreflang links made crawlers fetch the catalog 27 times over.
    expect(formatLongDate("2026-09-15T00:00:00Z", "America/New_York")).toBe("Monday, 14 September 2026");
    expect(formatLongDate("2026-09-15T00:00:00Z", "America/New_York", "es")).toMatch(/septiembre/i);
    const metadata = buildMetadata({
      title: "An event",
      description: "The event date.",
      canonical: "/event/example",
      ogPath: "/og/default",
      locale: "es",
    });
    expect(metadata.alternates?.canonical).toBe(absoluteUrl("/event/example"));
    expect(metadata.alternates?.languages).toBeUndefined();
    expect(metadata.openGraph).toMatchObject({ url: absoluteUrl("/event/example"), locale: "es_ES" });
  });

  it("ships a complete message tree for every locale", () => {
    const keys = (value: unknown, prefix = ""): string[] => {
      if (!value || typeof value !== "object") return [prefix];
      return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
        keys(child, prefix ? `${prefix}.${key}` : key),
      );
    };
    const english = keys(JSON.parse(readFileSync("messages/en.json", "utf8")));
    for (const locale of LOCALES) {
      const file = locale === "en" ? "en" : locale;
      const tree = keys(JSON.parse(readFileSync(`messages/${file}.json`, "utf8")));
      expect(tree, file).toEqual(english);
    }
  });
});
