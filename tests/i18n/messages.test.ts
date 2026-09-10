import { describe, expect, it } from "vitest";
import { LOCALES, localeMeta, type Locale } from "@/lib/i18n/config";
import { selectPlural } from "@/lib/i18n/format";
import { EN, type Messages } from "@/lib/i18n/messages/en";
import { fill } from "@/lib/i18n/messages/types";
import { ar } from "@/lib/i18n/messages/ar";
import { de } from "@/lib/i18n/messages/de";
import { es } from "@/lib/i18n/messages/es";
import { fr } from "@/lib/i18n/messages/fr";
import { hi } from "@/lib/i18n/messages/hi";
import { id } from "@/lib/i18n/messages/id";
import { it as itMessages } from "@/lib/i18n/messages/it";
import { ja } from "@/lib/i18n/messages/ja";
import { ko } from "@/lib/i18n/messages/ko";
import { nl } from "@/lib/i18n/messages/nl";
import { pl } from "@/lib/i18n/messages/pl";
import { pt } from "@/lib/i18n/messages/pt";
import { ru } from "@/lib/i18n/messages/ru";
import { tr } from "@/lib/i18n/messages/tr";

/**
 * Imported one by one rather than through `messages/index.ts`, which is `server-only` and throws
 * when Node resolves it outside the `react-server` condition (the same reason `ingest/db.ts`
 * imports it lazily).
 */
const CATALOGS: Record<Exclude<Locale, "en">, Messages> = {
  es, pt, fr, de, it: itMessages, nl, pl, tr, ru, id, ja, ko, hi, ar,
};

const TRANSLATED = Object.entries(CATALOGS) as [Locale, Messages][];

type Leaf = { path: string; placeholders: string[]; kind: "string" | "plural" | "other" };

const PLURAL_CATEGORIES = new Set(["zero", "one", "two", "few", "many", "other"]);

function isPluralForms(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((k) => PLURAL_CATEGORIES.has(k)) && keys.includes("other");
}

function placeholdersOf(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

/** Every message in a catalogue, flattened to `a.b.c` paths with the placeholders each one uses. */
function leaves(value: unknown, path = "", out: Leaf[] = []): Leaf[] {
  if (typeof value === "string") {
    out.push({ path, placeholders: placeholdersOf(value), kind: "string" });
    return out;
  }
  if (isPluralForms(value)) {
    const used = new Set(Object.values(value).flatMap(placeholdersOf));
    out.push({ path, placeholders: [...used].sort(), kind: "plural" });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => leaves(v, `${path}[${i}]`, out));
    return out;
  }
  if (typeof value === "object" && value !== null) {
    for (const [k, v] of Object.entries(value)) leaves(v, path ? `${path}.${k}` : k, out);
    return out;
  }
  out.push({ path, placeholders: [], kind: "other" });
  return out;
}

function readPath(root: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc as Record<string, unknown>)?.[key], root);
}

const EN_LEAVES = leaves(EN);
const EN_BY_PATH = new Map(EN_LEAVES.map((l) => [l.path, l]));

describe("the English catalogue", () => {
  it("is not empty and has no placeholder namespace left", () => {
    expect(EN_LEAVES.length).toBeGreaterThan(120);
    for (const ns of Object.keys(EN)) {
      expect(Object.keys(EN[ns as keyof Messages]).length, `${ns} is still empty`).toBeGreaterThan(0);
    }
  });

  it("has no empty message", () => {
    const empty = EN_LEAVES.filter((l) => l.kind === "string" && !String(readPath(EN, l.path)).trim());
    expect(empty.map((l) => l.path)).toEqual([]);
  });
});

describe.each(TRANSLATED)("the %s catalogue", (locale, catalog) => {
  const found = leaves(catalog);

  it("has exactly the keys English has", () => {
    const missing = EN_LEAVES.filter((l) => !found.some((f) => f.path === l.path)).map((l) => l.path);
    const extra = found.filter((f) => !EN_BY_PATH.has(f.path)).map((f) => f.path);
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it("keeps every {placeholder} English uses", () => {
    const wrong = found
      .filter((f) => EN_BY_PATH.has(f.path))
      .map((f) => ({ path: f.path, expected: EN_BY_PATH.get(f.path)!.placeholders, got: f.placeholders }))
      .filter((f) => f.expected.join(",") !== f.got.join(","));
    expect(wrong).toEqual([]);
  });

  it("is actually translated, not a copy of English", () => {
    // A locale left as English would publish fifteen copies of one page — which is worse for search
    // than not publishing them at all, and is exactly what the `hreflang` cluster promises is false.
    expect(catalog).not.toBe(EN);
    expect(JSON.stringify(catalog)).not.toBe(JSON.stringify(EN));
  });

  it("keeps Next's %s in the title template", () => {
    // The template is handed to Next as `title.template`; without the placeholder every page on the
    // site would be titled "Until".
    expect(catalog.seo.titleTemplate).toContain("%s");
  });

  it("translates the phrasing the locale is meant to rank for", () => {
    expect(catalog.seo.series.heading).not.toBe(EN.seo.series.heading);
    expect(catalog.seo.event.whenIs).not.toBe(EN.seo.event.whenIs);
    expect(catalog.common.nav.daysUntil).not.toBe(EN.common.nav.daysUntil);
  });

  it("supplies a form for every plural category the language actually uses", () => {
    const needed = new Set<string>();
    for (const n of [0, 1, 2, 3, 5, 11, 21, 100, 1000]) {
      needed.add(new Intl.PluralRules(localeMeta(locale).tag).select(n));
    }
    for (const leaf of found.filter((f) => f.kind === "plural")) {
      const forms = readPath(catalog, leaf.path) as Record<string, string>;
      for (const category of needed) {
        // `other` always covers a missing form at runtime, so this is a quality check, not a crash
        // check: Polish rendering "5 dni" through the `one` form would simply be wrong grammar.
        expect(Object.keys(forms), `${locale} ${leaf.path} lacks "${category}"`).toContain(category);
      }
    }
  });
});

describe("plural selection", () => {
  it("uses ICU categories, not an English n === 1", () => {
    const forms = { one: "{n} dzień", few: "{n} dni", many: "{n} dni", other: "{n} dnia" };
    expect(fill(selectPlural("pl", 1, forms), { n: 1 })).toBe("1 dzień");
    expect(fill(selectPlural("pl", 3, forms), { n: 3 })).toBe("3 dni");
    expect(fill(selectPlural("pl", 25, forms), { n: 25 })).toBe("25 dni");
  });

  it("falls back to `other` when a form is missing", () => {
    expect(selectPlural("ru", 3, { other: "x" })).toBe("x");
  });
});

describe("fill", () => {
  it("replaces every placeholder and leaves unknown ones visible", () => {
    expect(fill("{a} and {b}", { a: "1", b: "2" })).toBe("1 and 2");
    expect(fill("{a} and {b}", { a: "1" })).toBe("1 and {b}");
    expect(fill("no placeholders")).toBe("no placeholders");
  });
});

describe("every locale is wired up", () => {
  it("has a catalogue", () => {
    for (const locale of LOCALES) {
      if (locale === "en") continue;
      expect(CATALOGS[locale as Exclude<Locale, "en">], locale).toBeDefined();
    }
  });
});
