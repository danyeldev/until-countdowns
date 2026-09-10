import { readFileSync } from "node:fs";
import { readFestivalsForYear, type FestivalsFile, type FestivalTableDay } from "panchang-ts/festivals";
import { describe, expect, it } from "vitest";
import { adapter, groupByKey, holiForYear, LOCATION, parseCursor, planUnits, resolveOccurrences, rowsForYear, YEARS } from "@/lib/ingest/sources/hindu";
import { HINDU_FESTIVALS, TITHI_FALLBACKS } from "@/lib/ingest/sources/hindu/festivals";
import { addDays, tithiEndDay } from "@/lib/ingest/sources/hindu/tithi";
import { IngestEventSchema, type IngestContext } from "@/lib/ingest/types";

const NOW = new Date("2026-09-09T12:00:00Z");
const table = JSON.parse(readFileSync(new URL("../fixtures/hindu/table-2027.json", import.meta.url), "utf8")) as FestivalsFile;
const days2027 = readFestivalsForYear(table, 2027, "en")!;
const silent: IngestContext["log"] = { info() {}, warn() {}, error() {} };

function ctx(now = NOW): IngestContext {
  return {
    http: { fetchJson: async () => ({}) as never, fetchText: async () => "" },
    log: silent,
    now,
    budget: { remainingMs: () => 60_000 },
    dryRun: true,
  };
}

describe("hindu fixture → rows (2027, Ujjain table)", () => {
  const rows = rowsForYear(days2027, 2027, NOW, { fallbacks: false });
  const byKey = new Map(rows.map((r) => [r.source_key, r]));

  it("emits only whitelist keys, every row valid, source_keys stable across two runs", () => {
    expect(rows.length).toBeGreaterThanOrEqual(25);
    for (const r of rows) expect(IngestEventSchema.safeParse(r).success, r.slug).toBe(true);
    for (const r of rows) expect(HINDU_FESTIVALS[String(r.external_ids.panchang_key)], r.source_key).toBeDefined();
    const again = rowsForYear(days2027, 2027, NOW, { fallbacks: false });
    expect(again.map((r) => r.source_key)).toEqual(rows.map((r) => r.source_key));
    expect(again.map((r) => r.content_hash)).toEqual(rows.map((r) => r.content_hash));
    expect(new Set(rows.map((r) => r.source_key)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(rows.length);
  });
  it("matches the research anchors: Holi 2027-03-22, Diwali 2027-10-29", () => {
    const holi = byKey.get("hindu:2027:holi")!;
    const diwali = byKey.get("hindu:2027:diwali")!;
    expect(holi.date).toBe("2027-03-22");
    expect(holi.slug).toBe("holi-2027-03-22");
    expect(diwali.date).toBe("2027-10-29");
    expect(diwali.slug).toBe("diwali-2027-10-29");
    expect(byKey.get("hindu:2027:ganesh_chaturthi")!.date).toBe("2027-09-04");
    expect(byKey.get("hindu:2027:navaratri")!.date).toBe("2027-09-30");
    expect(byKey.get("hindu:2027:dussehra")!.date).toBe("2027-10-09");
  });
  it("maps precision/status/timezone/category/tags/regions/popularity per the brief", () => {
    const diwali = byKey.get("hindu:2027:diwali")!;
    expect(diwali).toMatchObject({
      title: "Diwali",
      all_day: true,
      timezone: "Asia/Kolkata",
      date_precision: "day",
      status: "scheduled",
      category: "religion",
      source: "hindu",
      confidence: 0.8,
      featured: true,
      popularity: 70,
      regions: ["IN", "NP", "GLOBAL"],
      jsonld_eligible: false,
      location: null,
      image_candidate_url: null,
      series_slug: null,
      end_date: null,
    });
    expect(diwali.tags).toEqual(expect.arrayContaining(["hindu", "panchang", "india", "diwali"]));
    expect(diwali.external_ids).toEqual({ panchang_key: "diwali" });
    expect(diwali.source_url).toBe("https://www.npmjs.com/package/panchang-ts");
    expect(byKey.get("hindu:2027:holi")!.featured).toBe(true);
    expect(byKey.get("hindu:2027:holi")!.popularity).toBe(65);
    expect(rows.filter((r) => r.featured).map((r) => r.external_ids.panchang_key).sort()).toEqual(["diwali", "holi"]);
    expect(byKey.get("hindu:2027:baisakhi")!.tags).toContain("sikh");
    expect(byKey.get("hindu:2027:maha_shivaratri")!.regions).toEqual(["IN", "NP"]);
    for (const r of rows) {
      expect(r.description.length, r.slug).toBeGreaterThanOrEqual(80);
      expect(r.description).toContain("computed for the Ujjain reference observer");
      expect(r.description.split(/\.\s/).length).toBeGreaterThanOrEqual(2);
      expect(r.popularity).toBeLessThanOrEqual(70);
      expect(r.status).toBe("scheduled");
      expect(r.date_precision).toBe("day");
    }
  });
  it("folds two consecutive table days for one key into a date range at confidence 0.7", () => {
    const ashtami = byKey.get("hindu:2027:durga_ashtami")!;
    expect(ashtami.date).toBe("2027-10-07");
    expect(ashtami.end_date).toBe("2027-10-08");
    expect(ashtami.confidence).toBe(0.7);
    expect(ashtami.external_ids).toEqual({ alt_dates: ["2027-10-08"], panchang_key: "durga_ashtami" });
  });
  it("emits candidates more than two days apart (Onam 2032) as one tentative row at 0.55 with alt_dates", () => {
    const onam = { key: "onam", name: "Thiru Onam", type: "major" } as const;
    expect(resolveOccurrences([{ date: "2032-08-20", entry: onam }, { date: "2032-09-16", entry: onam }])).toEqual({
      date: "2032-08-20",
      confidence: 0.55,
      alt: ["2032-09-16"],
      status: "tentative",
    });
    const warned: string[] = [];
    const log: IngestContext["log"] = { info() {}, warn: (m) => warned.push(m), error() {} };
    const synthetic = [
      { date: "2032-08-20", festivals: [onam] },
      { date: "2032-09-16", festivals: [onam] },
    ] as unknown as readonly FestivalTableDay[];
    const all = rowsForYear(synthetic, 2032, NOW, { fallbacks: false }, log);
    const onamRows = all.filter((r) => r.external_ids.panchang_key === "onam");
    expect(onamRows).toHaveLength(1);
    const row = onamRows[0];
    expect(row.source_key).toBe("hindu:2032:onam");
    expect(row).toMatchObject({ date: "2032-08-20", end_date: null, status: "tentative", confidence: 0.55 });
    expect(row.external_ids).toEqual({ alt_dates: ["2032-09-16"], panchang_key: "onam" });
    expect(IngestEventSchema.safeParse(row).success).toBe(true);
    expect(warned.some((m) => /onam .*2032-08-20, 2032-09-16.*tentative/.test(m))).toBe(true);
  });
  it("drops past dates and, without HINDU_INCLUDE_ALL, the long tail", () => {
    const later = rowsForYear(days2027, 2027, new Date("2027-06-01T00:00:00Z"), { fallbacks: false });
    const keys = later.map((r) => r.source_key);
    expect(keys).not.toContain("hindu:2027:holi");
    expect(keys).toContain("hindu:2027:diwali");
    expect(rows.some((r) => String(r.external_ids.panchang_key) === "anant_chaturdashi")).toBe(false);
    expect(groupByKey(days2027).has("anant_chaturdashi")).toBe(true);
  });
  it("HINDU_INCLUDE_ALL: long tail with empty description, popularity 20, recurring keys keyed by day, monthly fasts excluded", () => {
    const all = rowsForYear(days2027, 2027, NOW, { fallbacks: false, includeAll: true });
    for (const r of all) expect(IngestEventSchema.safeParse(r).success, r.slug).toBe(true);
    expect(all.length).toBeGreaterThan(rows.length + 20);
    const anant = all.find((r) => r.source_key === "hindu:2027:anant_chaturdashi")!;
    expect(anant).toMatchObject({ title: "Anant Chaturdashi", description: "", popularity: 20, regions: ["IN"], featured: false });
    expect(anant.tags).toContain("long-tail");
    expect(all.map((r) => r.source_key)).toEqual(expect.arrayContaining(["hindu:2027:vat_savitri_purnima", "hindu:2027:vat_savitri_purnima:06-19"]));
    expect(all.some((r) => /masik_shivaratri|sankashti_chaturthi|^hindu:2027:sankranti$/.test(r.source_key))).toBe(false);
    expect(all.some((r) => /ekadashi|pradosha|grahan/.test(r.source_key))).toBe(false);
    expect(new Set(all.map((r) => r.source_key)).size).toBe(all.length);
    expect(new Set(all.map((r) => r.slug)).size).toBe(all.length);
  });
});

describe("hindu kshaya fallback (live engine, offline)", () => {
  it("recovers the days the table skips and stays within a day of it elsewhere", () => {
    expect(tithiEndDay(2028, TITHI_FALLBACKS.holi, LOCATION)).toBe("2028-03-11");
    expect(tithiEndDay(2037, TITHI_FALLBACKS.holi, LOCATION)).toBe("2037-03-02");
    expect(tithiEndDay(2036, TITHI_FALLBACKS.diwali, LOCATION)).toBe("2036-10-19");
    expect(tithiEndDay(2037, TITHI_FALLBACKS.diwali, LOCATION)).toBe("2037-11-07");
    expect(tithiEndDay(2039, TITHI_FALLBACKS.chhath_sandhya_arghya, LOCATION)).toBe("2039-11-21");
    // Non-kshaya years: the tithi end lands on the table's day (Amavasya ends 19:06 on 2027-10-29)
    // or the day after it (2026-11-08 has Amavasya at sunset, it ends at 12:32 next day).
    expect(tithiEndDay(2027, TITHI_FALLBACKS.diwali, LOCATION)).toBe("2027-10-29");
    expect(tithiEndDay(2026, TITHI_FALLBACKS.diwali, LOCATION)).toBe("2026-11-09");
    expect(tithiEndDay(2027, TITHI_FALLBACKS.holi, LOCATION)).toBe("2027-03-22");
  });
  it("adapter.run(2028): Holi (absent from the table) is computed by the at-sunset rule at confidence 0.8", async () => {
    const unit = planUnits(2026, 2027)[0];
    expect(unit.year).toBe(2028);
    const rows = await adapter.run(unit, ctx());
    const holi = rows.find((r) => r.source_key === "hindu:2028:holi")!;
    expect(holi.date).toBe("2028-03-11");
    expect(holi.confidence).toBe(0.8);
    expect(holi.status).toBe("scheduled");
    expect(holi.external_ids).toEqual({ derived: "purnima-at-sunset+1", holika_dahan: "2028-03-10", panchang_key: "holi" });
    expect(holi.raw).toEqual({ derived: "purnima-at-sunset+1", key: "holi" });
    const diwali = rows.find((r) => r.source_key === "hindu:2028:diwali")!;
    expect(diwali.date).toBe("2028-10-17");
    expect(diwali.confidence).toBe(0.8);
    for (const r of rows) expect(IngestEventSchema.safeParse(r).success, r.slug).toBe(true);
  }, 20_000);
  it("Holi is derived by the at-sunset rule in every year; 2029 lands on 03-01 (table says 02-28) and 2027 on the table's 03-22", () => {
    for (let year = 2026; year < 2026 + YEARS; year++) {
      const holi = holiForYear(year)!;
      expect(holi, String(year)).toMatchObject({ derived: "purnima-at-sunset+1" });
      expect(holi.date.startsWith(String(year)), String(year)).toBe(true);
      expect(holi.date, String(year)).toBe(addDays(holi.holikaDahan, 1));
    }
    expect(holiForYear(2029)).toEqual({ date: "2029-03-01", holikaDahan: "2029-02-28", derived: "purnima-at-sunset+1" });
    expect(holiForYear(2027)!.date).toBe("2027-03-22");
    expect(rowsForYear(days2027, 2027, NOW, { fallbacks: false }).find((r) => r.source_key === "hindu:2027:holi")!.external_ids).toEqual({
      derived: "purnima-at-sunset+1",
      holika_dahan: "2027-03-21",
      panchang_key: "holi",
    });
  }, 30_000);
});

describe("hindu plan/cursor", () => {
  it("one unit per year, content-addressed cursor, resume after a year", async () => {
    const plan = await adapter.plan(null, ctx());
    expect(plan.done).toBe(true);
    expect(plan.units).toHaveLength(YEARS);
    expect(plan.units[0]).toMatchObject({ key: "hindu:2026", year: 2026, after: { start: 2026, afterYear: 2026 } });
    expect(plan.units[YEARS - 1].year).toBe(2040);
    const resumed = await adapter.plan({ start: 2026, afterYear: 2030 }, ctx());
    expect(resumed.units.map((u) => u.year)).toEqual([2031, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040]);
    expect((await adapter.plan({ start: 2026, afterYear: 2040 }, ctx())).units).toHaveLength(0);
    expect(parseCursor({ start: 2025, afterYear: 2030 }, 2026)).toEqual({ start: 2026, afterYear: 2025 });
    expect(parseCursor({ year: 2026, afterSlug: "x" }, 2026)).toEqual({ start: 2026, afterYear: 2025 });
    expect(parseCursor(7, 2026)).toEqual({ start: 2026, afterYear: 2025 });
  });
  it("adapter.run is deterministic across calls and Diwali 2026 lands on 8 November", async () => {
    const unit = planUnits(2026, 2025)[0];
    const a = await adapter.run(unit, ctx());
    const b = await adapter.run(unit, ctx());
    expect(a.map((r) => r.source_key)).toEqual(b.map((r) => r.source_key));
    expect(a.map((r) => r.content_hash)).toEqual(b.map((r) => r.content_hash));
    expect(a.find((r) => r.source_key === "hindu:2026:diwali")?.date).toBe("2026-11-08");
    expect(a.some((r) => r.date < "2026-09-07")).toBe(false); // now − 2 d
    for (const r of a) expect(IngestEventSchema.safeParse(r).success, r.slug).toBe(true);
  }, 20_000);
});
