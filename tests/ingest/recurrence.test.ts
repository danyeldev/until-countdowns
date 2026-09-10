import { describe, expect, it } from "vitest";
import { CURATED } from "@/data/curated";
import { SERIES } from "@/data/series";
import { slugify } from "@/lib/ingest/normalize";
import { chineseLunarToSolar, easterSunday, nthWeekday, orthodoxEaster, toIso } from "@/lib/ingest/recurrence";
import { aliasRows, computeCuratedRows, expandSeries, occurrencesIn } from "@/lib/ingest/sources/curated";
import { IngestEventSchema } from "@/lib/ingest/types";
import { CURATED as LEGACY_CURATED } from "../../scripts/curated.mjs";

const NOW = new Date("2026-09-09T12:00:00Z");

function bySlug(slug: string) {
  return SERIES.find((s) => s.slug === slug)!;
}

describe("computus", () => {
  it("Gregorian Easter 2026–2030", () => {
    expect(toIso(easterSunday(2026))).toBe("2026-04-05");
    expect(toIso(easterSunday(2027))).toBe("2027-03-28");
    expect(toIso(easterSunday(2028))).toBe("2028-04-16");
    expect(toIso(easterSunday(2029))).toBe("2029-04-01");
    expect(toIso(easterSunday(2030))).toBe("2030-04-21");
  });
  it("Orthodox Easter (Meeus Julian + 13 days)", () => {
    expect(toIso(orthodoxEaster(2026))).toBe("2026-04-12");
    expect(toIso(orthodoxEaster(2027))).toBe("2027-05-02");
    expect(toIso(orthodoxEaster(2028))).toBe("2028-04-16");
  });
});

describe("weekday rules", () => {
  it("nth and last weekday", () => {
    expect(toIso(nthWeekday(2026, 11, 4, 4)!)).toBe("2026-11-26"); // Thanksgiving
    expect(toIso(nthWeekday(2027, 2, 0, 2)!)).toBe("2027-02-14"); // Super Bowl
    expect(toIso(nthWeekday(2026, 9, 0, -1)!)).toBe("2026-09-27"); // Berlin Marathon
    expect(nthWeekday(2026, 2, 0, 5)).toBeNull();
  });
  it("Chinese New Year", () => {
    expect(toIso(chineseLunarToSolar(2027, 1, 1))).toBe("2027-02-06");
    expect(toIso(chineseLunarToSolar(2026, 1, 1))).toBe("2026-02-17");
  });
});

describe("series occurrences", () => {
  it("known dates from the rule table", () => {
    expect(occurrencesIn(bySlug("thanksgiving-day").recurrence, 2026).map(toIso)).toEqual(["2026-11-26"]);
    expect(occurrencesIn(bySlug("super-bowl").recurrence, 2027).map(toIso)).toEqual(["2027-02-14"]);
    expect(occurrencesIn(bySlug("chinese-new-year").recurrence, 2027).map(toIso)).toEqual(["2027-02-06"]);
    expect(occurrencesIn(bySlug("black-friday").recurrence, 2026).map(toIso)).toEqual(["2026-11-27"]);
    expect(occurrencesIn(bySlug("cyber-monday").recurrence, 2026).map(toIso)).toEqual(["2026-11-30"]);
    expect(occurrencesIn(bySlug("mardi-gras").recurrence, 2027).map(toIso)).toEqual(["2027-02-09"]);
    expect(occurrencesIn(bySlug("ash-wednesday").recurrence, 2027).map(toIso)).toEqual(["2027-02-10"]);
    expect(occurrencesIn(bySlug("good-friday").recurrence, 2027).map(toIso)).toEqual(["2027-03-26"]);
    expect(occurrencesIn(bySlug("pentecost").recurrence, 2027).map(toIso)).toEqual(["2027-05-16"]);
    expect(occurrencesIn(bySlug("oktoberfest").recurrence, 2026).map(toIso)).toEqual(["2026-09-19"]);
    expect(occurrencesIn(bySlug("wimbledon").recurrence, 2026).map(toIso)).toEqual(["2026-06-29"]);
    expect(occurrencesIn(bySlug("us-open-tennis").recurrence, 2026).map(toIso)).toEqual(["2026-08-31"]);
    expect(occurrencesIn(bySlug("boston-marathon").recurrence, 2026).map(toIso)).toEqual(["2026-04-20"]);
    expect(occurrencesIn(bySlug("programmers-day").recurrence, 2027).map(toIso)).toEqual(["2027-09-13"]);
    expect(occurrencesIn(bySlug("programmers-day").recurrence, 2028).map(toIso)).toEqual(["2028-09-12"]);
    expect(occurrencesIn(bySlug("leap-day").recurrence, 2027)).toEqual([]);
    expect(occurrencesIn(bySlug("leap-day").recurrence, 2028).map(toIso)).toEqual(["2028-02-29"]);
    expect(occurrencesIn(bySlug("friday-the-13th").recurrence, 2026).map(toIso)).toEqual(["2026-02-13", "2026-03-13", "2026-11-13"]);
    expect(occurrencesIn(bySlug("summer-time-begins-europe").recurrence, 2027).map(toIso)).toEqual(["2027-03-28"]);
    expect(occurrencesIn(bySlug("daylight-saving-time-ends-us").recurrence, 2027).map(toIso)).toEqual(["2027-11-07"]);
  });
  it("series slugs equal slugify(title) and are unique", () => {
    const slugs = new Set<string>();
    for (const s of SERIES) {
      expect(s.slug, s.title).toBe(slugify(s.title));
      expect(slugs.has(s.slug)).toBe(false);
      slugs.add(s.slug);
    }
    const aliases = aliasRows();
    expect(new Set(aliases.map((a) => a.alias)).size).toBe(aliases.length);
    for (const a of aliases) expect(slugs.has(a.alias)).toBe(false);
  });
  it("expands with series_slug, end dates, featured horizon and future-only", () => {
    const rows = expandSeries(bySlug("carnival"), [2026, 2027, 2029], NOW);
    expect(rows.map((r) => r.date)).toEqual(["2027-02-05", "2029-02-09"]);
    expect(rows[0].end_date).toBe("2027-02-10");
    expect(rows[0].series_slug).toBe("carnival");
    expect(rows[0].featured).toBe(true);
    expect(rows[1].featured).toBe(false);
    expect(rows[0].slug).toBe("carnival-2027-02-05");
    expect(rows[0].source_key).toBe("curated:carnival-2027-02-05");
  });
});

describe("curated catalog", () => {
  const rows = computeCuratedRows(NOW);
  it("emits > 300 valid rows, no far-future untagged, no duplicate source keys after slug dedupe", () => {
    expect(rows.length).toBeGreaterThan(300);
    for (const r of rows) expect(IngestEventSchema.safeParse(r).success, r.slug).toBe(true);
    const far = rows.filter((r) => r.date > "2041-09-09" && !r.tags.includes("far-future"));
    expect(far).toEqual([]);
  });
  it("uses the linked one-off instead of the series occurrence for the same year", () => {
    const sb = rows.filter((r) => r.series_slug === "super-bowl" && r.date.startsWith("2027"));
    expect(sb.map((r) => r.slug)).toEqual(["super-bowl-lxi-2027-02-14"]);
    const sb2031 = rows.filter((r) => r.series_slug === "super-bowl" && r.date.startsWith("2031"));
    expect(sb2031.map((r) => r.slug)).toEqual(["super-bowl-2031-02-09"]);
  });
  it("Artemis III is a tentative year-precision row", () => {
    const a = rows.find((r) => r.slug.startsWith("artemis-iii"));
    expect(a?.date).toBe("2027-01-01");
    expect(a?.date_precision).toBe("year");
    expect(a?.status).toBe("tentative");
  });
  it("stays in sync with scripts/curated.mjs (legacy copy used by push-catalog)", () => {
    const legacy = (LEGACY_CURATED as Array<{ title: string; date: string; skip?: boolean }>).filter((e) => !e.skip && !e.date.includes("mid"));
    const ours = new Map(CURATED.map((e) => [`${e.title}|${e.date}`, e]));
    for (const e of legacy) expect(ours.has(`${e.title}|${e.date}`), `${e.title} ${e.date} missing from src/data/curated.ts`).toBe(true);
  });
});
