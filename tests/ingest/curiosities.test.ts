import { describe, expect, it } from "vitest";
import {
  adapter,
  allUnits,
  calendarRows,
  curatedRows,
  palindromeDates,
  parseCursor,
  planUnits,
  unixMilestones,
} from "@/lib/ingest/sources/curiosities";
import { CURIOSITIES } from "@/lib/ingest/sources/curiosities/data";
import { IngestEventSchema, type IngestContext, type IngestEvent } from "@/lib/ingest/types";

/**
 * Everything here is computed, so the tests pin the generator's output for a fixed "now"
 * (file snapshots under tests/fixtures/curiosities/) and check the horizon/past filters,
 * the precision → status mapping and the content-addressed cursor.
 */
const NOW = new Date("2026-09-09T12:00:00Z");
const LATER = new Date("2026-09-30T12:00:00Z"); // same pass resumed three weeks later

const log = { info() {}, warn() {}, error() {} };
const ctx: IngestContext = {
  http: { fetchJson: async () => ({}) as never, fetchText: async () => "" },
  log,
  now: NOW,
  budget: { remainingMs: () => 120_000 },
  dryRun: true,
};

async function fullPass(now: Date): Promise<IngestEvent[]> {
  const c = { ...ctx, now };
  const out: IngestEvent[] = [];
  for (const unit of (await adapter.plan(null, c)).units) out.push(...(await adapter.run(unit, c)));
  return out;
}

/** Strip the volatile hash so the fixture diff shows the field that changed, not the digest. */
function stable(rows: IngestEvent[]) {
  return rows.map(({ content_hash: _hash, ...rest }) => rest);
}

describe("curiosities fixtures", () => {
  it("calendar rows for 2027–2028 match the snapshot", async () => {
    const rows = [...calendarRows(2027, NOW), ...calendarRows(2028, NOW)];
    expect(rows.length).toBeGreaterThanOrEqual(5);
    await expect(JSON.stringify(stable(rows), null, 2)).toMatchFileSnapshot("../fixtures/curiosities/calendar-2027-2028.json");
  });
  it("unix milestones and the far-future list match the snapshot", async () => {
    const rows = [...unixMilestones(NOW), ...curatedRows(NOW, CURIOSITIES, log)];
    await expect(JSON.stringify(stable(rows), null, 2)).toMatchFileSnapshot("../fixtures/curiosities/unix-and-far-future.json");
  });
});

describe("curiosities rows", () => {
  it("every row of a full pass validates, with unique source_keys and slugs", async () => {
    const rows = await fullPass(NOW);
    expect(rows.length).toBeGreaterThan(50);
    for (const r of rows) {
      const parsed = IngestEventSchema.safeParse(r);
      expect(parsed.success, `${r.slug}: ${JSON.stringify(parsed.success ? null : parsed.error.issues[0])}`).toBe(true);
      expect(r.source).toBe("curiosities");
      expect(r.category).toBe("curiosities");
      expect(r.source_key.startsWith("curiosities:")).toBe(true);
      expect(r.jsonld_eligible).toBe(false);
      expect(r.location).toBeNull();
      expect(r.external_ids).toEqual({});
      expect(r.description.length, `${r.slug} description too short`).toBeGreaterThanOrEqual(80);
      expect(r.description.split(/\.\s/).length, `${r.slug} needs two sentences`).toBeGreaterThanOrEqual(2);
      const year = r.title.match(/\b(1[89]\d{2}|2\d{3}|[3-9]\d{3})\b/);
      if (year) expect(Number(year[1]), `${r.slug} title year`).toBe(Number(r.date.slice(0, 4)));
    }
    expect(new Set(rows.map((r) => r.source_key)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(rows.length);
  });
  it("source_keys are identical across two passes and across a resumed pass weeks later", async () => {
    const a = await fullPass(NOW);
    const b = await fullPass(NOW);
    expect(b.map((r) => r.source_key)).toEqual(a.map((r) => r.source_key));
    expect(b.map((r) => r.content_hash)).toEqual(a.map((r) => r.content_hash));
    const later = new Set((await fullPass(LATER)).map((r) => r.source_key));
    for (const r of a) if (r.date.slice(0, 10) >= "2026-09-28") expect(later.has(r.source_key), r.source_key).toBe(true);
  });
  it("unix milestones: exact instants, UTC, verified dates, popularity and featured flags", () => {
    const rows = unixMilestones(NOW);
    const byKey = Object.fromEntries(rows.map((r) => [r.source_key, r]));
    expect(byKey["curiosities:unix:1800000000"].date).toBe("2027-01-15T08:00:00.000Z");
    expect(byKey["curiosities:unix:2000000000"].date).toBe("2033-05-18T03:33:20.000Z");
    expect(byKey["curiosities:unix:2147483647"].date).toBe("2038-01-19T03:14:07.000Z");
    expect(byKey["curiosities:unix:2000000000"]).toMatchObject({ popularity: 70, featured: true, title: "Unix time reaches 2,000,000,000" });
    expect(byKey["curiosities:unix:2147483647"]).toMatchObject({
      popularity: 80,
      featured: true,
      title: "Year 2038 problem: 32-bit Unix time overflows",
      source_url: "https://en.wikipedia.org/wiki/Year_2038_problem",
    });
    expect(byKey["curiosities:unix:2147483647"].tags).toContain("y2038");
    expect(byKey["curiosities:unix:1800000000"]).toMatchObject({ popularity: 50, featured: false, source_url: "https://en.wikipedia.org/wiki/Unix_time" });
    for (const r of rows) {
      expect(r.all_day).toBe(false);
      expect(r.timezone).toBe("UTC");
      expect(r.date_precision).toBe("instant");
      expect(r.status).toBe("scheduled");
      expect(r.tags).toEqual(expect.arrayContaining(["unix-time", "tech", "computed"]));
      expect(r.slug.endsWith(r.date.slice(0, 10))).toBe(true);
    }
    // 2,300,000,000 s is 2042-11-19: beyond now + 15 y, so not generated.
    expect(byKey["curiosities:unix:2300000000"]).toBeUndefined();
    expect(byKey["curiosities:unix:1700000000"]).toBeUndefined(); // past
  });
  it("unix: the 2038 overflow is always emitted; it carries far-future when beyond the horizon", () => {
    const early = unixMilestones(new Date("2020-01-01T00:00:00Z"));
    const y2038 = early.find((r) => r.source_key === "curiosities:unix:2147483647")!;
    expect(y2038.tags).toContain("far-future");
    expect(unixMilestones(NOW).find((r) => r.source_key === "curiosities:unix:2147483647")!.tags).not.toContain("far-future");
    expect(unixMilestones(new Date("2040-01-01T00:00:00Z")).some((r) => r.tags.includes("y2038"))).toBe(false);
  });
  it("palindrome dates: both digit orders, verified examples, at most one per format", () => {
    expect(palindromeDates(2030)).toEqual([
      { fmt: "dmy", day: { y: 2030, m: 2, d: 3 } },
      { fmt: "ymd", day: { y: 2030, m: 3, d: 2 } },
    ]);
    expect(palindromeDates(2031)).toEqual([{ fmt: "dmy", day: { y: 2031, m: 2, d: 13 } }]);
    expect(palindromeDates(2032)).toEqual([{ fmt: "dmy", day: { y: 2032, m: 2, d: 23 } }]);
    expect(palindromeDates(2033)).toEqual([]); // 33/02 is not a day; 20330302 → month 03, day 33 … no
    expect(palindromeDates(2101)).toEqual([{ fmt: "dmy", day: { y: 2101, m: 12, d: 10 } }, { fmt: "ymd", day: { y: 2101, m: 10, d: 12 } }]);
    for (let y = 2026; y <= 2100; y++) expect(palindromeDates(y).length).toBeLessThanOrEqual(2);
    const rows = calendarRows(2030, NOW).filter((r) => r.tags.includes("palindrome"));
    expect(rows.map((r) => [r.title, r.date, r.source_key])).toEqual([
      ["Palindrome date 03/02/2030 (DD/MM/YYYY)", "2030-02-03", "curiosities:palindrome:dmy:2030-02-03"],
      ["Palindrome date 2030-03-02 (YYYY-MM-DD)", "2030-03-02", "curiosities:palindrome:ymd:2030-03-02"],
    ]);
    expect(rows[0].popularity).toBe(25);
  });
  it("calendar: Friday the 13ths (≤ 3, series), leap days (series) and Public Domain Day (US + GLOBAL)", () => {
    const rows2037 = calendarRows(2037, NOW);
    const fridays = rows2037.filter((r) => r.series_slug === "friday-the-13th");
    expect(fridays.map((r) => r.date)).toEqual(["2037-02-13", "2037-03-13", "2037-11-13"]);
    expect(fridays[0]).toMatchObject({ title: "Friday the 13th", popularity: 30, timezone: null, all_day: true, date_precision: "day", status: "scheduled" });
    expect(fridays[0].tags).toEqual(expect.arrayContaining(["friday-13th", "superstition"]));
    expect(fridays[0].source_key).toBe("curiosities:friday13:2037-02-13");
    for (let y = 2026; y <= 2060; y++) expect(calendarRows(y, new Date("2020-01-01T00:00:00Z")).filter((r) => r.series_slug === "friday-the-13th").length).toBeLessThanOrEqual(3);

    const leap = calendarRows(2028, NOW).find((r) => r.series_slug === "leap-day")!;
    expect(leap).toMatchObject({ title: "Leap day", date: "2028-02-29", popularity: 45, source_key: "curiosities:leapday:2028-02-29", slug: "leap-day-2028-02-29" });
    expect(calendarRows(2029, NOW).some((r) => r.series_slug === "leap-day")).toBe(false);
    expect(calendarRows(2100, new Date("2090-01-01T00:00:00Z")).some((r) => r.series_slug === "leap-day")).toBe(false); // century rule

    const pdd = calendarRows(2028, NOW).find((r) => r.series_slug === "public-domain-day")!;
    expect(pdd).toMatchObject({
      title: "Public Domain Day",
      slug: "public-domain-day-2028-01-01",
      source_key: "curiosities:pdd:2028",
      regions: ["US", "GLOBAL"],
      popularity: 45,
      source_url: "https://web.law.duke.edu/cspd/publicdomainday/",
    });
    expect(pdd.description).toContain("first published in the United States in 1932");
  });
  it("filters: past rows and rows beyond now + 15 years are dropped", () => {
    const mid2027 = new Date("2027-06-01T00:00:00Z");
    const keys = calendarRows(2027, mid2027).map((r) => r.source_key);
    expect(keys).toContain("curiosities:friday13:2027-08-13");
    expect(keys).not.toContain("curiosities:pdd:2027");
    expect(calendarRows(2042, NOW)).toEqual([]);
    const edge = calendarRows(2041, NOW).map((r) => r.date);
    expect(edge.length).toBeGreaterThan(0);
    for (const d of edge) expect(d <= "2041-09-09").toBe(true);
  });
  it("far-future list: day/year/month precision, tentative status for coarse dates, far-future tag, confidence 0.9", () => {
    const rows = curatedRows(NOW, CURIOSITIES, log);
    const byId = Object.fromEntries(rows.map((r) => [r.source_key, r]));
    expect(byId["curiosities:curated:crypt-of-civilization"]).toMatchObject({ date: "8113-05-28", date_precision: "day", status: "scheduled", popularity: 60, confidence: 0.9 });
    expect(byId["curiosities:curated:crypt-of-civilization"].tags).toContain("far-future");
    expect(byId["curiosities:curated:westinghouse-time-capsules"]).toMatchObject({ date: "6939-01-01", date_precision: "year", status: "tentative" });
    expect(byId["curiosities:curated:leap-seconds-abolished"]).toMatchObject({ date: "2035-01-01", date_precision: "year", status: "tentative", popularity: 40 });
    expect(byId["curiosities:curated:leap-seconds-abolished"].tags).not.toContain("far-future");
    expect(byId["curiosities:curated:voyager-1-light-day"]).toMatchObject({ date: "2026-11-01", date_precision: "month", status: "tentative", all_day: true });
    expect(byId["curiosities:curated:voyager-dsn-range"]).toMatchObject({ date_precision: "year", status: "tentative", popularity: 30 });
    for (const r of rows) expect(r.source_url).toMatch(/^https:\/\//);
    // Halley 2061 is owned by `astronomy`; KEO is closed.
    expect(rows.some((r) => /halley|keo/i.test(r.title))).toBe(false);
    // A month-precision row is dropped once its month has passed; year rows survive until the year ends.
    const dec2026 = curatedRows(new Date("2026-12-15T00:00:00Z"), CURIOSITIES, log).map((r) => r.source_key);
    expect(dec2026).not.toContain("curiosities:curated:voyager-1-light-day");
    expect(curatedRows(new Date("2035-12-15T00:00:00Z"), CURIOSITIES, log).map((r) => r.source_key)).toContain("curiosities:curated:leap-seconds-abolished");
  });
  it("far-future list: an entry beyond the horizon without farFuture is dropped with a warning", () => {
    const warnings: string[] = [];
    const rows = curatedRows(
      NOW,
      [
        { id: "typo", title: "Typo year", date: "2107-01-01", datePrecision: "day", tags: [], description: "x. y.", sourceUrl: "https://example.org/", popularity: 10 },
        { id: "ok", title: "Tagged", date: "2107-01-01", datePrecision: "day", farFuture: true, tags: [], description: "x. y.", sourceUrl: "https://example.org/", popularity: 10 },
      ],
      { ...log, warn: (m: string) => warnings.push(m) },
    );
    expect(rows.map((r) => r.source_key)).toEqual(["curiosities:curated:ok"]);
    expect(warnings[0]).toMatch(/Typo year/);
  });
});

describe("curiosities plan and cursor", () => {
  it("units: unix, one calendar unit per horizon year, far-future; each unit's `after` names itself", () => {
    const units = allUnits(NOW);
    expect(units.map((u) => u.key)).toEqual(["unix", ...Array.from({ length: 16 }, (_, i) => `calendar:${2026 + i}`), "far-future"]);
    for (const u of units) expect(u.after).toEqual({ afterUnit: u.key });
    expect(units.map((u) => u.kind)).toEqual(["unix", ...Array(16).fill("calendar"), "far-future"]);
  });
  it("parseCursor ignores foreign shapes; planUnits resumes after the named unit", async () => {
    expect(parseCursor(null)).toEqual({ afterUnit: null });
    expect(parseCursor({ year: 2026, afterSlug: "x" })).toEqual({ afterUnit: null });
    expect(parseCursor([1, 2])).toEqual({ afterUnit: null });
    expect(parseCursor({ afterUnit: "calendar:2030" })).toEqual({ afterUnit: "calendar:2030" });
    expect(planUnits(NOW, "calendar:2030").map((u) => u.key)[0]).toBe("calendar:2031");
    expect(planUnits(NOW, "unix").map((u) => u.key)[0]).toBe("calendar:2026");
    expect(planUnits(NOW, "far-future")).toEqual([]);
    expect(planUnits(NOW, "calendar:1999").length).toBe(18); // unknown unit (horizon moved): start over
    const plan = await adapter.plan({ afterUnit: "calendar:2040" }, ctx);
    expect(plan.done).toBe(true);
    expect(plan.units.map((u) => u.key)).toEqual(["calendar:2041", "far-future"]);
  });
  it("adapter metadata", () => {
    expect(adapter.id).toBe("curiosities");
    expect(adapter.rank).toBe(8);
    expect(adapter.cadence).toBe("monthly");
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.limits.concurrency).toBe(1);
  });
});
