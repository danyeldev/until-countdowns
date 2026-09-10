import { describe, expect, it, vi } from "vitest";
import { CURATED } from "@/data/curated";
import { aliasRows, computeCuratedRows, expandCurated, filterAliasCollisions, parseCursor, planUnits, resumeIndex } from "@/lib/ingest/sources/curated";

const NOW = new Date("2026-09-09T12:00:00Z");

describe("curated far-future guard", () => {
  it("keeps explicitly tagged far-future one-offs and drops untagged ones with a warning", () => {
    const rows = expandCurated(CURATED, NOW);
    expect(rows.some((r) => r.slug.startsWith("halley-s-comet-perihelion-2061"))).toBe(true);
    expect(rows.find((r) => r.slug.startsWith("halley-s-comet-perihelion-2061"))?.tags).toContain("far-future");
    const warn = vi.fn();
    const typo = [{ ...CURATED[0], title: "Typo Event", date: "2107-05-01", tags: ["x"], series: undefined, skip: false }];
    const out = expandCurated(typo, NOW, { info: vi.fn(), warn, error: vi.fn() });
    expect(out).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/Typo Event/);
  });
  it("computeCuratedRows never emits an untagged far-future row", () => {
    const rows = computeCuratedRows(NOW);
    const cutoff = "2041-09-09";
    for (const r of rows.filter((r) => r.date > cutoff)) expect(r.tags, r.slug).toContain("far-future");
  });
});

describe("curated cursor", () => {
  it("is content-addressed and resumes after the last slug", () => {
    const rows = computeCuratedRows(NOW);
    const units = planUnits(rows, 2026, null, 100);
    expect(units[0].after).toEqual({ year: 2026, afterSlug: rows[99].slug });
    const resumed = planUnits(rows, 2026, rows[99].slug, 100);
    expect(resumed[0].start).toBe(100);
    expect(resumeIndex(rows, rows[rows.length - 1].slug)).toBe(rows.length);
    expect(parseCursor({ year: 2026, next: 400 }, 2026)).toEqual({ year: 2026, afterSlug: null });
  });
});

describe("series aliases", () => {
  it("skips aliases that collide with an existing series slug (auto-created shells)", () => {
    const aliases = aliasRows();
    const shells = ["new-year", "shrove-tuesday", "thanksgiving", "spring-festival"];
    const { kept, collisions } = filterAliasCollisions(aliases, shells);
    expect(collisions.map((c) => c.alias).sort()).toEqual(shells.sort());
    expect(kept.length + collisions.length).toBe(aliases.length);
    expect(kept.some((k) => shells.includes(k.alias))).toBe(false);
    expect(filterAliasCollisions(aliases, []).collisions).toHaveLength(0);
  });
});
