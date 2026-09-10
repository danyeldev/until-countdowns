import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  adapter,
  buildYearRows,
  HIJRI_MONTHS,
  hijriYearsFor,
  indexMonth,
  monthUrl,
  OBSERVANCES,
  parseCursor,
  parseGregorian,
  planUnits,
  tabularDrift,
  tabularIslamicToUtcMs,
  type HijriDay,
  type HijriMonthResponse,
} from "@/lib/ingest/sources/aladhan";
import { compareRows, type Reference } from "@/lib/ingest/sources/aladhan/crosscheck";
import { IngestEventSchema, type IngestContext, type IngestEvent } from "@/lib/ingest/types";

const NOW = new Date("2026-09-09T12:00:00Z");
const YEAR = 1451; // Ramadan 1451 = 2030-01-05 … 2030-02-03 (recorded 2026-09-09)

function fixture(month: number): HijriMonthResponse {
  return JSON.parse(readFileSync(new URL(`../fixtures/aladhan/hToGCalendar-${month}-${YEAR}.json`, import.meta.url), "utf8"));
}

function fixtureMonths(): Map<number, Map<number, HijriDay>> {
  return new Map(HIJRI_MONTHS.map((m) => [m, indexMonth(fixture(m), m, YEAR)]));
}

type Logged = { warns: string[]; infos: string[] };

function ctxFor(logged: Logged = { warns: [], infos: [] }, responses: (url: string) => unknown = defaultResponses): IngestContext {
  return {
    http: {
      fetchJson: async <T,>(url: string) => responses(url) as T,
      fetchText: async () => "",
    },
    log: { info: (m) => logged.infos.push(m), warn: (m) => logged.warns.push(m), error: (m) => logged.warns.push(m) },
    now: NOW,
    budget: { remainingMs: () => 60_000 },
    dryRun: true,
  };
}

function defaultResponses(url: string): unknown {
  const m = /hToGCalendar\/(\d+)\/(\d+)$/.exec(url);
  if (!m || Number(m[2]) !== YEAR) throw new Error(`unexpected url ${url}`);
  return fixture(Number(m[1]));
}

describe("aladhan helpers", () => {
  it("parses DD-MM-YYYY and rejects other shapes", () => {
    expect(parseGregorian("05-01-2030")).toBe("2030-01-05");
    expect(parseGregorian("2030-01-05")).toBeNull();
    expect(parseGregorian("31-02-2030")).toBeNull();
    expect(parseGregorian(undefined)).toBeNull();
  });
  it("tabular Islamic calendar lands within two days of the API (1 Muharram 1448 = 2026-06-16)", () => {
    expect(new Date(tabularIslamicToUtcMs(1448, 1, 1)).toISOString().slice(0, 10)).toBe("2026-06-17");
    expect(tabularDrift("2030-01-05", 1451, 9, 1)).toBeLessThanOrEqual(2);
    expect(tabularDrift("2029-01-05", 1451, 9, 1)).toBeGreaterThan(300);
  });
  it("hijriYearsFor spans the current Hijri year to the 15-year horizon", () => {
    const years = hijriYearsFor(NOW);
    expect(years[0]).toBe(1448); // began 2026-06-16
    expect(years[years.length - 1]).toBe(1463); // begins ~2041-01, ends before 2041-09-09 + grace
    expect(years).toEqual(Array.from({ length: 16 }, (_, i) => 1448 + i));
    expect(hijriYearsFor(new Date("2027-06-10T00:00:00Z"))[0]).toBe(1448); // 1448 ended 2027-06-05: still inside the 30-day grace
    expect(hijriYearsFor(new Date("2027-07-15T00:00:00Z"))[0]).toBe(1449);
  });
  it("cursor is the last Hijri year upserted; foreign shapes restart the pass", () => {
    expect(parseCursor(null)).toEqual({ afterHijriYear: null });
    expect(parseCursor({ afterHijriYear: 1450 })).toEqual({ afterHijriYear: 1450 });
    expect(parseCursor({ i: 3, page: 0 })).toEqual({ afterHijriYear: null });
    expect(parseCursor([1450])).toEqual({ afterHijriYear: null });
    const units = planUnits([1448, 1449, 1450], 1448);
    expect(units.map((u) => u.key)).toEqual(["aladhan:1449", "aladhan:1450"]);
    expect(units[0].after).toEqual({ afterHijriYear: 1449 });
    expect(planUnits([1448, 1449], null)).toHaveLength(2);
  });
  it("indexMonth rejects a response for another month/year", () => {
    expect(() => indexMonth(fixture(9), 10, YEAR)).toThrow(/got 9\/1451 back/);
    expect(() => indexMonth(fixture(9), 9, 1452)).toThrow(/got 9\/1451 back/);
    expect(() => indexMonth({ code: 404, status: "Not Found" }, 9, YEAR)).toThrow(/unexpected response/);
    expect(indexMonth(fixture(12), 12, YEAR).get(10)?.gregorian?.date).toBe("13-04-2030");
  });
  it("the whitelist (except Islamic New Year, derived from day 1) is confirmed by specialDays", () => {
    const special = JSON.parse(readFileSync(new URL("../fixtures/aladhan/specialDays.json", import.meta.url), "utf8")) as {
      data: Array<{ month: number; day: number; name: string }>;
    };
    const pairs = new Set(special.data.map((d) => `${d.month}/${d.day}`));
    for (const o of OBSERVANCES) {
      if (o.key === "islamic-new-year") continue;
      expect(pairs.has(`${o.month}/${o.day}`), `${o.key} ${o.month}/${o.day}`).toBe(true);
    }
    expect(special.data.some((d) => d.month === 1 && d.day === 1 && /new year|muharram/i.test(d.name))).toBe(false);
  });
});

describe("aladhan rows (fixture 1451 AH)", () => {
  it("maps the whitelisted days to tentative, moon-sighting rows with stable source_keys", () => {
    const rows = buildYearRows(YEAR, fixtureMonths(), NOW);
    expect(rows).toHaveLength(OBSERVANCES.length);
    for (const r of rows) {
      const parsed = IngestEventSchema.safeParse(r);
      expect(parsed.success, `${r.slug}: ${parsed.success ? "" : JSON.stringify(parsed.error.issues)}`).toBe(true);
      expect(r.source).toBe("aladhan");
      expect(r.category).toBe("religion");
      expect(r.status).toBe("tentative");
      expect(r.date_precision).toBe("day");
      expect(r.all_day).toBe(true);
      expect(r.timezone).toBeNull();
      expect(r.confidence).toBe(0.7);
      expect(r.regions).toEqual(["GLOBAL"]);
      expect(r.jsonld_eligible).toBe(false);
      expect(r.image_candidate_url).toBeNull();
      expect(r.tags).toEqual(expect.arrayContaining(["islamic", "hijri", "aladhan", "moon-sighting"]));
      expect(r.description.length).toBeGreaterThanOrEqual(80);
      expect(r.description.split(/\.\s/).length).toBeGreaterThanOrEqual(3);
      expect(r.description).toMatch(/moon sighting\.$/);
    }
    expect(rows.map((r) => r.source_key)).toEqual(OBSERVANCES.map((o) => `aladhan:${YEAR}:${o.key}`));
    // Deterministic: a second build over the same fixture is byte-identical (content_hash included).
    expect(buildYearRows(YEAR, fixtureMonths(), NOW)).toEqual(rows);
  });
  it("Eid al-Fitr 1451 = 2030-02-04, featured, popularity 60, hijri external id", () => {
    const eid = buildYearRows(YEAR, fixtureMonths(), NOW).find((r) => r.source_key === "aladhan:1451:eid-al-fitr")!;
    expect(eid.title).toBe("Eid al-Fitr");
    expect(eid.slug).toBe("eid-al-fitr-2030-02-04");
    expect(eid.date).toBe("2030-02-04");
    expect(eid.end_date).toBeNull();
    expect(eid.featured).toBe(true);
    expect(eid.popularity).toBe(60);
    expect(eid.external_ids).toEqual({ hijri: "1451-10-01" });
    expect(eid.source_url).toBe("https://api.aladhan.com/v1/hToGCalendar/10/1451");
    expect(eid.tags).toContain("eid-al-fitr");
    expect(eid.tags).toContain("religious");
    expect((eid.raw as { hijri: { holidays: string[] } }).hijri.holidays).toEqual(["Eid-ul-Fitr"]);
    const ramadan = buildYearRows(YEAR, fixtureMonths(), NOW).find((r) => r.source_key === "aladhan:1451:ramadan-begins")!;
    expect(ramadan.date).toBe("2030-01-05");
    expect(ramadan.slug).toBe("ramadan-begins-2030-01-05");
    expect(ramadan.featured).toBe(true);
  });
  it("multi-day observances carry end_date (Eid al-Adha 10–13, Hajj 8–13 Dhu al-Hijjah)", () => {
    const rows = buildYearRows(YEAR, fixtureMonths(), NOW);
    const adha = rows.find((r) => r.source_key === "aladhan:1451:eid-al-adha")!;
    expect(adha.date).toBe("2030-04-13");
    expect(adha.end_date).toBe("2030-04-16");
    expect(adha.popularity).toBe(55);
    const hajj = rows.find((r) => r.source_key === "aladhan:1451:hajj")!;
    expect(hajj.date).toBe("2030-04-11");
    expect(hajj.end_date).toBe("2030-04-16");
    const arafah = rows.find((r) => r.source_key === "aladhan:1451:day-of-arafah")!;
    expect(arafah.date).toBe("2030-04-12");
    expect(arafah.end_date).toBeNull();
    expect(rows.find((r) => r.source_key === "aladhan:1451:laylat-al-baraat")!.slug).toBe("laylat-al-bara-at-2029-12-21");
  });
  it("filters: past days are dropped, far-future days are dropped, a drifted API date is skipped with a warning", () => {
    const later = new Date("2030-02-01T00:00:00Z");
    const keys = buildYearRows(YEAR, fixtureMonths(), later).map((r) => r.source_key);
    expect(keys).not.toContain("aladhan:1451:ramadan-begins"); // 2030-01-05
    expect(keys).toContain("aladhan:1451:laylat-al-qadr"); // 2030-01-31, within the 2-day grace
    expect(keys).toContain("aladhan:1451:eid-al-fitr");
    expect(buildYearRows(YEAR, fixtureMonths(), new Date("2014-01-01T00:00:00Z"))).toHaveLength(0); // all > now + 15 y (2029-01-01)
    const warns: string[] = [];
    const months = fixtureMonths();
    const tampered = new Map(months.get(10)!);
    tampered.set(1, { ...tampered.get(1)!, gregorian: { date: "04-02-2031" } });
    months.set(10, tampered);
    const rows = buildYearRows(YEAR, months, NOW, { info() {}, warn: (m) => warns.push(m), error() {} });
    expect(rows.map((r) => r.source_key)).not.toContain("aladhan:1451:eid-al-fitr");
    expect(rows).toHaveLength(OBSERVANCES.length - 1);
    expect(warns.some((w) => /eid-al-fitr: 2031-02-04 is \d+ days from the tabular date/.test(w))).toBe(true);
    const missing = fixtureMonths();
    missing.delete(9);
    const warns2: string[] = [];
    const rows2 = buildYearRows(YEAR, missing, NOW, { info() {}, warn: (m) => warns2.push(m), error() {} });
    expect(rows2).toHaveLength(OBSERVANCES.length - 2);
    expect(warns2).toHaveLength(2);
  });
});

describe("aladhan adapter plan/run", () => {
  it("plans one unit per Hijri year from the cursor and run() fetches the seven months", async () => {
    const plan = await adapter.plan({ afterHijriYear: 1450 }, ctxFor());
    expect(plan.done).toBe(true);
    expect(plan.units[0].key).toBe("aladhan:1451");
    expect(plan.units[0].after).toEqual({ afterHijriYear: 1451 });
    expect(plan.units.map((u) => u.hijriYear)).toEqual(Array.from({ length: 13 }, (_, i) => 1451 + i));
    const urls: string[] = [];
    const logged: Logged = { warns: [], infos: [] };
    const ctx = ctxFor(logged, (url) => {
      urls.push(url);
      return defaultResponses(url);
    });
    const a = await adapter.run(plan.units[0], ctx);
    expect(urls).toEqual(HIJRI_MONTHS.map((m) => monthUrl(m, 1451)));
    expect(a).toHaveLength(OBSERVANCES.length);
    const b = await adapter.run(plan.units[0], ctxFor());
    expect(b.map((r) => r.source_key)).toEqual(a.map((r) => r.source_key));
    expect(b.map((r) => r.content_hash)).toEqual(a.map((r) => r.content_hash));
    expect(logged.infos.some((m) => /Hijri year 1451 AH: 11 rows/.test(m))).toBe(true);
    // date-holidays agrees within a day for 1451 AH (SA Eid al-Fitr 2030-02-03 vs 2030-02-04): no mismatch warnings.
    expect(logged.warns).toEqual([]);
    expect(adapter.id).toBe("aladhan");
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.limits.concurrency).toBe(1);
  }, 20_000);
  it("a month for the wrong year makes the unit fail (runner retries) instead of emitting rows", async () => {
    const plan = await adapter.plan({ afterHijriYear: 1450 }, ctxFor());
    const ctx = ctxFor({ warns: [], infos: [] }, (url) => (url.endsWith("/9/1451") ? fixture(10) : defaultResponses(url)));
    await expect(adapter.run(plan.units[0], ctx)).rejects.toThrow(/got 10\/1451 back/);
  });
});

describe("aladhan date-holidays cross-check", () => {
  const row = (key: string, date: string) =>
    ({ source_key: `aladhan:1451:${key}`, date, tags: ["islamic", key] }) as unknown as IngestEvent;
  it("warns only above two days and ignores keys without a reference", () => {
    const refs = (key: string, year: number): Reference[] =>
      key === "eid-al-fitr" && year === 2030 ? [{ name: "End of Ramadan (Eid al-Fitr)", date: "2030-02-03", country: "SA" }] : [];
    const warns: string[] = [];
    const log = { info() {}, warn: (m: string) => warns.push(m), error() {} };
    expect(compareRows([row("eid-al-fitr", "2030-02-04"), row("ashura", "2029-05-23"), row("mawlid", "2029-07-24")], refs, log)).toBe(0);
    expect(warns).toEqual([]);
    expect(compareRows([row("eid-al-fitr", "2030-02-07")], refs, log)).toBe(1);
    expect(warns[0]).toMatch(/aladhan:1451:eid-al-fitr: 2030-02-07 is 4 days from date-holidays SA/);
  });
});
