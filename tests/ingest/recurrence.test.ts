import { describe, expect, it } from "vitest";
import { CURATED } from "@/data/curated";
import { SERIES } from "@/data/series";
import { slugify } from "@/lib/ingest/normalize";
import { chineseLunarToSolar, easterSunday, nthWeekday, orthodoxEaster, toIso } from "@/lib/ingest/recurrence";
import { aliasRows, computeCuratedRows, expandCurated, expandSeries, occurrencesIn } from "@/lib/ingest/sources/curated";
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

describe("music series", () => {
  // The `music` hub had one published future row and an empty "Every year" rail; the MUSIC block in
  // src/data/series.ts explains why nothing else in the pipeline could fill it. These pin what each
  // new rule actually computes — a rule nobody can check against a fixed date should not ship.
  it("computes the dates its comments claim", () => {
    expect(occurrencesIn(bySlug("grammy-awards").recurrence, 2027).map(toIso)).toEqual(["2027-02-07"]); // 1st Sunday of Feb
    expect(occurrencesIn(bySlug("grammy-awards").recurrence, 2028).map(toIso)).toEqual(["2028-02-06"]);
    expect(occurrencesIn(bySlug("last-night-of-the-proms").recurrence, 2026).map(toIso)).toEqual(["2026-09-12"]); // 2nd Saturday of Sep
    expect(occurrencesIn(bySlug("last-night-of-the-proms").recurrence, 2027).map(toIso)).toEqual(["2027-09-11"]);
    expect(occurrencesIn(bySlug("fete-de-la-musique").recurrence, 2027).map(toIso)).toEqual(["2027-06-21"]);
    expect(occurrencesIn(bySlug("international-jazz-day").recurrence, 2027).map(toIso)).toEqual(["2027-04-30"]);
    expect(occurrencesIn(bySlug("vienna-new-year-s-concert").recurrence, 2027).map(toIso)).toEqual(["2027-01-01"]);
  });
  it("rolls forward past this year's occurrence", () => {
    // NOW is 9 September 2026: February is gone, so the Grammy series' next row is 2027's.
    expect(expandSeries(bySlug("grammy-awards"), [2026, 2027], NOW).map((r) => r.date)).toEqual(["2027-02-07"]);
    const proms = expandSeries(bySlug("last-night-of-the-proms"), [2026, 2027], NOW);
    expect(proms.map((r) => r.date)).toEqual(["2026-09-12", "2027-09-11"]);
    expect(proms[0].series_slug).toBe("last-night-of-the-proms");
    expect(proms[0].slug).toBe("last-night-of-the-proms-2026-09-12");
    expect(proms[0].regions).toEqual(["GB"]);
  });
  it("lands in `music`, which is the whole point", () => {
    // A ceremony that arrives as `entertainment` (as Wikidata's award-ceremony class does) does not
    // help the music hub: the category on the SeriesRule is what /category/music reads, through
    // `series_next.category` (seriesInCategory in src/lib/catalog.ts).
    const music = SERIES.filter((s) => s.category === "music");
    expect(music.map((s) => s.slug).sort()).toEqual([
      "fete-de-la-musique",
      "grammy-awards",
      "international-jazz-day",
      "last-night-of-the-proms",
      "vienna-new-year-s-concert",
    ]);
    for (const s of music) expect(occurrencesIn(s.recurrence, 2027).length, s.slug).toBe(1);
    const rows = computeCuratedRows(NOW).filter((r) => r.category === "music");
    for (const r of rows.filter((r) => r.series_slug)) expect(music.some((s) => s.slug === r.series_slug), r.slug).toBe(true);
    // Exact, not `toBeGreaterThan`: the MUSIC docblock prices this change at 71 series rows = 142
    // enrichment jobs, so the number has to fail here rather than drift silently. 5 rules x 15
    // expanded years, less the four occurrences already past on 9 Sep 2026 (only the Proms is left).
    expect(rows.filter((r) => r.series_slug).length).toBe(71);
    // And the single music row the hub had before this block: one curated one-off, no series link.
    expect(rows.filter((r) => !r.series_slug).map((r) => r.slug)).toEqual(["60th-anniversary-of-woodstock-2029-08-15"]);
  });
  it("the expired Eurovision one-off is dead and stays out of the series table", () => {
    // Verifying the prior report: a year-titled one-off dated 2026-05-16 stopped being emitted on
    // 18 May 2026 and cannot regenerate — the date is fixed, and expandCurated keeps only rows
    // dated after now - 2 days.
    const eurovision = CURATED.find((e) => e.title === "Eurovision Song Contest 2026")!;
    expect(eurovision.date).toBe("2026-05-16");
    expect(eurovision.skip).toBe(true);
    expect(expandCurated([{ ...eurovision, skip: false }], NOW)).toEqual([]);
    expect(computeCuratedRows(NOW).some((r) => r.slug.startsWith("eurovision"))).toBe(false);
    // And it is NOT replaced by a series: the grand final is a Saturday the EBU picks with the host
    // broadcaster (2nd, 3rd, 4th and 5th Saturdays of May all occur), so no Recurrence kind states
    // it truthfully. This assertion is the reminder — see the comment on the curated entry.
    expect(SERIES.some((s) => s.slug.includes("eurovision") || s.tags.includes("eurovision"))).toBe(false);
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
