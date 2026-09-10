import { describe, expect, it } from "vitest";
import { computeHolidayRows, parseCursor, planUnits, resumeIndex } from "@/lib/ingest/sources/holidays";
import { IngestEventSchema, type IngestEvent } from "@/lib/ingest/types";

/**
 * The holiday set is filtered by "now", so a pass resumed days later sees a shorter array. The
 * cursor is therefore the last slug upserted, not an index: the resumed unit set must be the
 * same rows (minus those that legitimately became past), never shifted.
 */
const NOW_A = new Date("2026-09-09T12:00:00Z");
const NOW_B = new Date("2026-09-16T12:00:00Z");

function fake(slugs: string[]): IngestEvent[] {
  return slugs.map((slug) => ({ slug }) as IngestEvent);
}

describe("holiday cursor", () => {
  it("resumeIndex finds the first slug after the cursor", () => {
    const rows = fake(["a-2027-01-01", "b-2027-01-01", "d-2027-01-01"]);
    expect(resumeIndex(rows, null)).toBe(0);
    expect(resumeIndex(rows, "a-2027-01-01")).toBe(1);
    expect(resumeIndex(rows, "c-2027-01-01")).toBe(2); // cursor row vanished: continue after it
    expect(resumeIndex(rows, "z-2027-01-01")).toBe(3);
  });
  it("planUnits carries the last slug of each unit as the cursor", () => {
    const rows = fake(["a-2027-01-01", "b-2027-01-01", "c-2027-01-01", "d-2027-01-01", "e-2027-01-01"]);
    const units = planUnits(rows, 2026, null, 2);
    expect(units.map((u) => u.after)).toEqual([
      { year: 2026, afterSlug: "b-2027-01-01" },
      { year: 2026, afterSlug: "d-2027-01-01" },
      { year: 2026, afterSlug: "e-2027-01-01" },
    ]);
    expect(planUnits(rows, 2026, "b-2027-01-01", 2).map((u) => [u.start, u.end])).toEqual([
      [2, 4],
      [4, 5],
    ]);
  });
  it("parseCursor ignores foreign shapes and other years", () => {
    expect(parseCursor({ year: 2026, next: 400 }, 2026)).toEqual({ year: 2026, afterSlug: null });
    expect(parseCursor({ year: 2025, afterSlug: "x" }, 2026)).toEqual({ year: 2026, afterSlug: null });
    expect(parseCursor({ year: 2026, afterSlug: "x-2027-01-01" }, 2026)).toEqual({ year: 2026, afterSlug: "x-2027-01-01" });
  });
  it("a pass resumed a week later emits the same remaining rows (none skipped)", () => {
    const a = computeHolidayRows(2026, NOW_A);
    const b = computeHolidayRows(2026, NOW_B);
    expect(b.length).toBeLessThan(a.length); // some rows became past
    const idx = Math.min(2400, a.length - 1);
    const afterSlug = a[idx - 1].slug;
    const expected = a.slice(resumeIndex(a, afterSlug)).map((r) => r.slug);
    const resumed = b.slice(resumeIndex(b, afterSlug)).map((r) => r.slug);
    const lostToTime = new Set(expected.filter((s) => !resumed.includes(s)));
    for (const s of lostToTime) {
      const row = a.find((r) => r.slug === s)!;
      expect(row.date < "2026-09-15", `${s} skipped although still future`).toBe(true);
    }
    expect(resumed.every((s) => expected.includes(s))).toBe(true);
  }, 20_000);
  it("emits no empty-base slugs and only valid rows; non-Latin names get a holiday-<cc> digest base", () => {
    const rows = computeHolidayRows(2026, NOW_A);
    expect(rows.some((r) => r.slug.startsWith("-"))).toBe(false);
    const fallback = rows.filter((r) => /^holiday-[a-z]{2}-[0-9a-f]{8}-\d{4}/.test(r.slug));
    expect(fallback.length).toBeGreaterThan(0);
    expect(new Set(fallback.map((r) => r.slug)).size).toBe(fallback.length);
    for (const r of rows.slice(0, 200)) expect(IngestEventSchema.safeParse(r).success, r.slug).toBe(true);
    for (const r of fallback) expect(IngestEventSchema.safeParse(r).success, r.slug).toBe(true);
  }, 20_000);
});
