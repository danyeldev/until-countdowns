import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { IngestContext } from "@/lib/ingest/types";
import { IngestEventSchema } from "@/lib/ingest/types";
import { P31_CATEGORY } from "@/lib/ingest/sources/wanted/resolve";
import {
  adapter,
  bindingToEvent,
  bindingsToEvents,
  buildWikidataQuery,
  categoryFor,
  labelYearConsistent,
  type SparqlBinding,
  VARIANTS,
  WD_PAGE,
  WIKIDATA_CLASSES,
} from "@/lib/ingest/sources/wikidata";
import {
  applyEnrichment,
  awardCategory,
  buildEnrichQuery,
  buildMoreQuery,
  commonsImage,
  familyById,
  firstSlice,
  indexEnrichment,
  isMoreCursor,
  MORE_DONE,
  MORE_FAMILIES,
  MORE_PAGE,
  moreAfter,
  moreBindingsToEvents,
  moreStart,
  nextSlice,
  officeTag,
} from "@/lib/ingest/sources/wikidata/more";

const NOW = new Date("2026-09-09T12:00:00Z");
const GAME = WIKIDATA_CLASSES.find((c) => c.qid === "Q7889")!;
const OCCURRENCE = WIKIDATA_CLASSES.find((c) => c.qid === "Q1190554")!;
const ELECTION = WIKIDATA_CLASSES.find((c) => c.qid === "Q40231")!;
const TOUR = WIKIDATA_CLASSES.find((c) => c.qid === "Q1573906")!;
const CONCERT = WIKIDATA_CLASSES.find((c) => c.qid === "Q182832")!;

function binding(over: Record<string, string | undefined>) {
  const b: Record<string, { type: string; value: string } | undefined> = {
    item: { type: "uri", value: "http://www.wikidata.org/entity/Q123" },
    itemLabel: { type: "literal", value: "The Legend of Heroes: Trails to Azure" },
    date: { type: "literal", value: "2026-09-10T00:00:00Z" },
    prec: { type: "literal", value: "11" },
    article: { type: "uri", value: "https://en.wikipedia.org/wiki/The_Legend_of_Heroes:_Trails_to_Azure" },
  };
  for (const [k, v] of Object.entries(over)) b[k] = v === undefined ? undefined : { type: "literal", value: v };
  return b;
}

describe("wikidata binding → event", () => {
  it("day precision: scheduled, confidence 0.7, class category, qid source_key", () => {
    const ev = bindingToEvent(binding({}), GAME, NOW)!;
    expect(ev.slug).toBe("the-legend-of-heroes-trails-to-azure-2026-09-10");
    expect(ev.source_key).toBe("wikidata:Q123");
    expect(ev.category).toBe("games");
    expect(ev.date_precision).toBe("day");
    expect(ev.status).toBe("scheduled");
    expect(ev.confidence).toBe(0.7);
    expect(ev.external_ids).toEqual({ enwiki: "The Legend of Heroes: Trails to Azure", qid: "Q123" });
    expect(ev.tags).toContain("wikidata");
    expect(ev.description).toBe("Scheduled event from Wikidata.");
  });
  it("month/year precision: tentative, confidence 0.6, placeholder date kept", () => {
    const m = bindingToEvent(binding({ date: "2027-03-01T00:00:00Z", prec: "10" }), GAME, NOW)!;
    expect(m.date).toBe("2027-03-01");
    expect(m.date_precision).toBe("month");
    expect(m.status).toBe("tentative");
    expect(m.confidence).toBe(0.6);
    const y = bindingToEvent(binding({ date: "2028-01-01T00:00:00Z", prec: "9" }), GAME, NOW)!;
    expect(y.date_precision).toBe("year");
    expect(bindingToEvent(binding({ prec: "8" }), GAME, NOW)).toBeNull();
    expect(bindingToEvent(binding({ prec: "7" }), GAME, NOW)).toBeNull();
  });
  it("guards: missing enwiki, Q-label, label-year mismatch, past dates", () => {
    expect(bindingToEvent(binding({ article: undefined }), GAME, NOW)).toBeNull();
    expect(bindingToEvent(binding({ itemLabel: "Q123" }), GAME, NOW)).toBeNull();
    expect(bindingToEvent(binding({ itemLabel: "Expo 2030", date: "2027-05-01T00:00:00Z" }), OCCURRENCE, NOW)).toBeNull();
    expect(bindingToEvent(binding({ date: "2025-01-01T00:00:00Z" }), GAME, NOW)).toBeNull();
    expect(labelYearConsistent("2026–27 season", 2027)).toBe(true);
    expect(labelYearConsistent("2026 World Cup", 2027)).toBe(false);
    expect(labelYearConsistent("No year here", 2027)).toBe(true);
  });
  it("category: class fallback wins; generic classes may move to sports/politics/astronomy/space", () => {
    expect(categoryFor("Christmas special edition", GAME).category).toBe("games");
    expect(categoryFor("Independence Day parade", ELECTION).category).toBe("politics");
    expect(categoryFor("Total solar eclipse of 2027", OCCURRENCE).category).toBe("astronomy");
    expect(categoryFor("FIFA World Cup qualifier", OCCURRENCE).category).toBe("sports");
    expect(categoryFor("Christmas market", OCCURRENCE).category).toBe("culture");
    expect(categoryFor("Christmas market", OCCURRENCE).tags).toEqual(["christmas", "religious"]);
  });
  it("keeps end dates and dedupes by QID within a page (earliest date wins)", () => {
    const rows = bindingsToEvents(
      [
        binding({ date: "2027-06-15T00:00:00Z", end: "2027-07-10T00:00:00Z" }),
        binding({ date: "2027-06-11T00:00:00Z" }),
      ],
      OCCURRENCE,
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2027-06-11");
    expect(rows[0].end_date).toBe("2027-07-10");
  });
  it("query has the precision guard, the enwiki sitelink and the range variant", () => {
    const q = buildWikidataQuery(VARIANTS[0], 2026);
    expect(q).toContain("wikibase:timePrecision ?prec");
    expect(q).toContain("?prec >= 9");
    expect(q).toContain("hint:Prior hint:rangeSafe true");
    expect(q).toContain('"2026-01-01T00:00:00Z"^^xsd:dateTime');
    expect(q).toContain('"2041-01-01T00:00:00Z"^^xsd:dateTime');
    expect(q).toContain("schema:isPartOf <https://en.wikipedia.org/>");
    const range = VARIANTS.find((v) => v.withEnd)!;
    expect(range.prop).toBe("P580");
    expect(buildWikidataQuery(range, 2026)).toContain("wdt:P582 ?end");
    const rangeP585 = VARIANTS.find((v) => v.cls.range && !v.withEnd)!;
    expect(buildWikidataQuery(rangeP585, 2026)).toContain("FILTER NOT EXISTS { ?item wdt:P580 [] }");
    expect(buildWikidataQuery(VARIANTS[0], 2026)).not.toContain("FILTER NOT EXISTS");
    const film = VARIANTS.find((v) => v.cls.qid === "Q11424")!;
    expect(buildWikidataQuery(film, 2026)).toContain("wdt:P577 ?date");
  });
});

/**
 * Music classes. Both QIDs are the ones `wanted/resolve.ts` already maps to `music`; the tour is
 * `range` (P580 + P582) and the concert is one night (P585 only). No fixture: WDQS was not
 * reachable when these were written, so the bindings are hand-built in the documented shape.
 */
describe("wikidata music classes", () => {
  it("concert tour: music, P582 end date kept, popularity on the enrichment gate", () => {
    const ev = bindingToEvent(
      binding({
        itemLabel: "Music of the Spheres World Tour",
        article: "https://en.wikipedia.org/wiki/Music_of_the_Spheres_World_Tour",
        date: "2027-05-14T00:00:00Z",
        end: "2027-11-20T00:00:00Z",
      }),
      TOUR,
      NOW,
    )!;
    expect(ev.category).toBe("music");
    expect(ev.slug).toBe("music-of-the-spheres-world-tour-2027-05-14");
    expect(ev.source_key).toBe("wikidata:Q123");
    expect(ev.date).toBe("2027-05-14");
    expect(ev.end_date).toBe("2027-11-20");
    expect(ev.date_precision).toBe("day");
    expect(ev.status).toBe("scheduled");
    expect(ev.confidence).toBe(0.7);
    // 45 is exactly `finalize_catalog`'s `popularity >= 45` branch: every kept row queues a
    // wikipedia_summary and an image job (supabase/migrations/0009_indexable_summary.sql).
    expect(ev.popularity).toBe(45);
    expect(ev.tags).toContain("wikidata");
    expect(ev.external_ids).toEqual({ enwiki: "Music of the Spheres World Tour", qid: "Q123" });
    expect(IngestEventSchema.safeParse(ev).success).toBe(true);
  });
  it("concert tour: an end date that is not after the start is dropped, not stored as a zero-length range", () => {
    const same = bindingToEvent(
      binding({ itemLabel: "Farewell Tour", article: "https://en.wikipedia.org/wiki/Farewell_Tour", date: "2027-05-14T00:00:00Z", end: "2027-05-14T00:00:00Z" }),
      TOUR,
      NOW,
    )!;
    expect(same.end_date).toBeNull();
    const noEnd = bindingToEvent(binding({ itemLabel: "Farewell Tour", article: "https://en.wikipedia.org/wiki/Farewell_Tour" }), TOUR, NOW)!;
    expect(noEnd.end_date).toBeNull();
    expect(noEnd.category).toBe("music");
  });
  it("concert: music, one night (no end date), enwiki gate still required", () => {
    const b = {
      itemLabel: "Live Aid 2 Wembley",
      article: "https://en.wikipedia.org/wiki/Live_Aid_2_Wembley",
      date: "2027-07-13T00:00:00Z",
    };
    const ev = bindingToEvent(binding(b), CONCERT, NOW)!;
    expect(ev.category).toBe("music");
    expect(ev.slug).toBe("live-aid-2-wembley-2027-07-13");
    expect(ev.end_date).toBeNull();
    expect(ev.popularity).toBe(45);
    expect(ev.confidence).toBe(0.7);
    expect(IngestEventSchema.safeParse(ev).success).toBe(true);
    // the notability gate this class is bought for: no Wikipedia article, no row
    expect(bindingToEvent(binding({ ...b, article: undefined }), CONCERT, NOW)).toBeNull();
    // historical one-offs are excluded by the query window, and the past filter catches any that slip through
    expect(bindingToEvent(binding({ ...b, date: "1985-07-13T00:00:00Z" }), CONCERT, NOW)).toBeNull();
  });
  it("music is not generic: a TAG_RULES hit adds tags but never moves the category", () => {
    expect(categoryFor("The Christmas Tour", TOUR).category).toBe("music");
    expect(categoryFor("The Christmas Tour", TOUR).tags).toEqual(["christmas", "religious"]);
    expect(categoryFor("Benefit concert for the World Cup", CONCERT).category).toBe("music");
  });
  it("variants: the tour is queried twice (P585 without P580, then P580 + P582), the concert once", () => {
    const tourVariants = VARIANTS.filter((v) => v.cls.qid === "Q1573906");
    expect(tourVariants.map((v) => [v.prop, v.withEnd])).toEqual([
      ["P585", false],
      ["P580", true],
    ]);
    const [point, range] = tourVariants.map((v) => buildWikidataQuery(v, 2026));
    expect(point).toContain("wdt:P585 ?date");
    expect(point).toContain("FILTER NOT EXISTS { ?item wdt:P580 [] }");
    expect(point).not.toContain("?end");
    expect(range).toContain("wdt:P580 ?date");
    expect(range).toContain("OPTIONAL { ?item wdt:P582 ?end . }");
    for (const q of [point, range]) expect(q).toContain("?item wdt:P31 wd:Q1573906 .");

    const concertVariants = VARIANTS.filter((v) => v.cls.qid === "Q182832");
    expect(concertVariants.map((v) => [v.prop, v.withEnd])).toEqual([["P585", false]]);
    const concert = buildWikidataQuery(concertVariants[0], 2026);
    expect(concert).toContain("?item wdt:P31 wd:Q182832 .");
    expect(concert).not.toContain("?end");
    expect(concert).not.toContain("FILTER NOT EXISTS");
    expect(concert).toContain("schema:isPartOf <https://en.wikipedia.org/>");
  });
  it("through the adapter: the P580 tour variant maps a page of bindings to music rows", async () => {
    const i = VARIANTS.findIndex((v) => v.cls.qid === "Q1573906" && v.withEnd);
    const queries: string[] = [];
    const page = [
      binding({
        itemLabel: "Music of the Spheres World Tour",
        article: "https://en.wikipedia.org/wiki/Music_of_the_Spheres_World_Tour",
        date: "2027-05-14T00:00:00Z",
        end: "2027-11-20T00:00:00Z",
      }),
    ];
    const ctx: IngestContext = {
      http: {
        fetchJson: async <T,>(url: string) => {
          queries.push(decodeURIComponent(url.split("?query=")[1] ?? ""));
          return { results: { bindings: page } } as T;
        },
        fetchText: async () => "",
      },
      log: { info() {}, warn() {}, error() {} },
      now: NOW,
      budget: { remainingMs: () => 60_000 },
      dryRun: true,
    };
    const plan = await adapter.plan({ i, page: 0 }, ctx);
    expect(plan.units[0].key).toBe("wikidata:Q1573906:P580:0");
    expect(plan.units[0].label).toBe("Q1573906 concert tour [P580] page 1");
    const rows = await adapter.run(plan.units[0], ctx);
    expect(queries[0]).toContain("?item wdt:P31 wd:Q1573906 .");
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe("music");
    expect(rows[0].end_date).toBe("2027-11-20");
    expect(rows[0].popularity).toBe(45);
    expect(rows[0].confidence).toBe(0.7);
    expect(IngestEventSchema.safeParse(rows[0]).success).toBe(true);
  });
  it("both music classes agree with the on-demand `wanted` path and are appended last", () => {
    expect(P31_CATEGORY.Q1573906).toBe("music");
    expect(P31_CATEGORY.Q182832).toBe("music");
    // appended, never inserted: a stored `{ i, page }` cursor indexes into VARIANTS
    expect(WIKIDATA_CLASSES.slice(-2).map((c) => c.qid)).toEqual(["Q1573906", "Q182832"]);
  });
});

describe("wikidata paging cursor", () => {
  it("`after` moves to the next page while pages are full and to the next variant on the last page", async () => {
    const ctxFor = (bindings: number): IngestContext => ({
      http: {
        fetchJson: async <T,>() => ({ results: { bindings: Array.from({ length: bindings }, () => ({})) } }) as T,
        fetchText: async () => "",
      },
      log: { info() {}, warn() {}, error() {} },
      now: NOW,
      budget: { remainingMs: () => 60_000 },
      dryRun: true,
    });
    const full = await adapter.plan({ i: 2, page: 0 }, ctxFor(WD_PAGE));
    await adapter.run(full.units[0], ctxFor(WD_PAGE));
    expect(full.units[0].after).toEqual({ i: 2, page: 1 });
    expect(full.nextCursor).toEqual({ i: 2, page: 1 });
    const last = await adapter.plan({ i: 2, page: 1 }, ctxFor(5));
    await adapter.run(last.units[0], ctxFor(5));
    expect(last.units[0].after).toEqual({ i: 3, page: 0 });
    expect(last.nextCursor).toEqual({ i: 3, page: 0 });
    // A fresh plan for the same page (new invocation, empty module state) is not skipped.
    const again = await adapter.plan({ i: 2, page: 1 }, ctxFor(5));
    expect(again.units[0].page).toBe(1);
    expect(again.units[0].i).toBe(2);
  });
});

/**
 * Phase-2 ("wikidata-more") families. Fixtures under tests/fixtures/wikidata/ were recorded on
 * 2026-09-09 through the adapter's own query builders (trimmed, no PII); `enrich.json` is the
 * VALUES-bound second-pass answer for the QIDs in the harvest fixtures.
 */
type Fixture = { results: { bindings: SparqlBinding[] } };
const fixture = (name: string): Fixture => JSON.parse(readFileSync(new URL(`../fixtures/wikidata/${name}.json`, import.meta.url), "utf8"));
const ELECTIONS = familyById("elections")!;
const AWARDS = familyById("awards")!;
const LAUNCHES = familyById("launches")!;
const EXPOS = familyById("expos")!;
const FILMS = familyById("films")!;
const OPENINGS = familyById("openings")!;

/** Fake http: harvest queries answer with `harvest`, VALUES (enrichment) queries with enrich.json. */
function ctxFor(harvest: Fixture, opts: { enrichFails?: boolean; calls?: string[] } = {}): IngestContext {
  return {
    http: {
      fetchJson: async <T,>(url: string) => {
        opts.calls?.push(url);
        const q = decodeURIComponent(url.split("?query=")[1] ?? "");
        if (q.includes("VALUES ?item")) {
          if (opts.enrichFails) throw new Error("HTTP 504");
          return fixture("enrich") as T;
        }
        return harvest as T;
      },
      fetchText: async () => "",
    },
    log: { info() {}, warn() {}, error() {} },
    now: NOW,
    budget: { remainingMs: () => 120_000 },
    dryRun: true,
  };
}

function bind(over: Record<string, string | undefined>): SparqlBinding {
  const b: SparqlBinding = {
    item: { type: "uri", value: "http://www.wikidata.org/entity/Q999" },
    itemLabel: { type: "literal", value: "2027 Example presidential election" },
    d: { type: "literal", value: "2027-04-18T00:00:00Z" },
    prec: { type: "literal", value: "11" },
    rank: { type: "uri", value: "http://wikiba.se/ontology#NormalRank" },
    sl: { type: "literal", value: "12" },
    enwiki: { type: "uri", value: "https://en.wikipedia.org/wiki/2027_Example_presidential_election" },
    iso: { type: "literal", value: "FR" },
  };
  for (const [k, v] of Object.entries(over)) b[k] = v === undefined ? undefined : { type: "literal", value: v };
  return b;
}

describe("wikidata-more: fixture → rows", () => {
  it("elections: one row per QID, earliest round, ISO regions, politics, source_key by QID, stable across runs", async () => {
    const start = moreStart(NOW);
    const a = await adapter.plan(start, ctxFor(fixture("elections")));
    const rowsA = await adapter.run(a.units[0], ctxFor(fixture("elections")));
    const b = await adapter.plan(start, ctxFor(fixture("elections")));
    const rowsB = await adapter.run(b.units[0], ctxFor(fixture("elections")));
    expect(rowsA.map((r) => r.source_key)).toEqual(rowsB.map((r) => r.source_key));
    expect(rowsA.map((r) => r.content_hash)).toEqual(rowsB.map((r) => r.content_hash));
    expect(a.units[0].key).toBe("wikidata:more:elections:2026-09-09:0");
    for (const r of rowsA) expect(IngestEventSchema.safeParse(r).success, r.slug).toBe(true);
    const keys = rowsA.map((r) => r.source_key);
    expect(new Set(keys).size).toBe(keys.length); // 20 bindings, duplicates collapsed
    expect(rowsA.length).toBe(14);
    const brazil = rowsA.find((r) => r.source_key === "wikidata:Q115632178")!;
    expect(brazil.date).toBe("2026-10-04"); // first round, not the 10-25 run-off
    expect(brazil.slug).toBe("2026-brazilian-general-election-2026-10-04");
    expect(brazil.regions).toEqual(["BR"]);
    expect(brazil.category).toBe("politics");
    expect(brazil.tags).toEqual(expect.arrayContaining(["election", "elections", "general", "wikidata"]));
    expect(brazil.popularity).toBe(35 + 12 + 10);
    expect(brazil.description).toBe("Election in Brazil, as scheduled on Wikidata.");
    expect(brazil.source_url).toBe("https://www.wikidata.org/wiki/Q115632178");
    expect(brazil.external_ids).toEqual({ enwiki: "2026 Brazilian general election", qid: "Q115632178" });
    expect(brazil.jsonld_eligible).toBe(false);
    // flag fallback from the second pass (P18 coverage is 0% for elections)
    expect(brazil.image_candidate_url).toBe("https://commons.wikimedia.org/wiki/Special:FilePath/Flag_of_Brazil.svg");
    expect(brazil.image_candidate_meta).toEqual({
      provider: "commons",
      kind: "flag",
      file: "Flag of Brazil.svg",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Flag_of_Brazil.svg",
    });
    // year placeholder: tentative, confidence 0.6, kept
    const german = rowsA.find((r) => r.source_key === "wikidata:Q132731902")!;
    expect(german.date).toBe("2029-01-01");
    expect(german.date_precision).toBe("year");
    expect(german.status).toBe("tentative");
    expect(german.confidence).toBe(0.6);
    expect(brazil.status).toBe("scheduled");
    expect(brazil.confidence).toBe(0.7);
    expect(brazil.raw).toEqual({ family: "elections", d: "2026-10-04T00:00:00Z", prec: 11, rank: "NormalRank", sl: 12 });
  });
  it("launches: space category, P18 image (raster only), month/year placeholders tentative", async () => {
    const c = { ...moreStart(NOW), family: "launches" };
    const plan = await adapter.plan(c, ctxFor(fixture("launches")));
    const rows = await adapter.run(plan.units[0], ctxFor(fixture("launches")));
    expect(rows.length).toBe(12);
    for (const r of rows) {
      expect(IngestEventSchema.safeParse(r).success, r.slug).toBe(true);
      expect(r.category).toBe("space");
      expect(r.tags).toEqual(expect.arrayContaining(["launch", "mission", "wikidata"]));
      if (r.date_precision !== "day") expect(r.status).toBe("tentative");
    }
    const artemis3 = rows.find((r) => r.source_key === "wikidata:Q21028127")!;
    expect(artemis3.date_precision).toBe("year");
    expect(artemis3.popularity).toBe(70);
    expect(artemis3.image_candidate_url).toBe("https://commons.wikimedia.org/wiki/Special:FilePath/Sls_block1_noeas_afterburner_engmarkings_sm.jpg");
    expect(artemis3.image_candidate_meta?.kind).toBe("p18");
    // no P18 and the launch chain never falls back to a flag
    const luna28 = rows.find((r) => r.source_key === "wikidata:Q24936156")!;
    expect(luna28.image_candidate_url).toBeNull();
    const soyuz = rows.find((r) => r.source_key === "wikidata:Q134960598")!;
    expect(soyuz.date).toBe("2027-03-01");
    expect(soyuz.date_precision).toBe("month");
  });
  it("awards: Emmys → tv, Oscars → film; expos: end date, venue location, coordinates, jsonld", async () => {
    const awards = moreBindingsToEvents(fixture("awards").results.bindings, AWARDS, NOW);
    expect(awards.map((r) => [r.title, r.category, r.popularity])).toEqual([
      ["78th Primetime Emmy Awards", "tv", 43],
      ["99th Academy Awards", "film", 45],
    ]);
    expect(awards[0].tags).toEqual(["awards", "ceremony", "wikidata"]);
    const c = { ...moreStart(NOW), family: "expos" };
    const plan = await adapter.plan(c, ctxFor(fixture("expos")));
    const [expo] = await adapter.run(plan.units[0], ctxFor(fixture("expos")));
    expect(expo.slug).toBe("expo-2030-2030-10-01");
    expect(expo.end_date).toBe("2031-03-31");
    expect(expo.category).toBe("festivals");
    expect(expo.regions).toEqual(["SA"]);
    expect(expo.location).toEqual({ name: "Riyadh", country: "SA", lat: 24.65, lng: 46.71, url: "https://www.wikidata.org/wiki/Q3692" });
    expect(expo.jsonld_eligible).toBe(true);
    expect(expo.image_candidate_meta?.kind).toBe("venue"); // no own P18 → venue's P18 before the flag
    expect(expo.image_candidate_url).toBe("https://commons.wikimedia.org/wiki/Special:FilePath/Riyadh_Skyline.jpg");
    expect(IngestEventSchema.safeParse(expo).success).toBe(true);
  });
  it("films: earliest of several release dates, no image candidate, no enrichment query", async () => {
    const calls: string[] = [];
    const c = { ...moreStart(NOW), family: "films" };
    const ctx = ctxFor(fixture("films"), { calls });
    const plan = await adapter.plan(c, ctx);
    const rows = await adapter.run(plan.units[0], ctx);
    expect(calls.length).toBe(1);
    const re = rows.find((r) => r.source_key === "wikidata:Q136565785")!;
    expect(re.date).toBe("2026-09-17");
    expect(re.category).toBe("film");
    expect(re.image_candidate_url).toBeNull();
    expect(re.popularity).toBe(30 + 22);
    expect(new Set(rows.map((r) => r.source_key)).size).toBe(rows.length);
    expect(rows.length).toBe(15);
  });
  it("openings: month precision kept (min 10), culture, popularity 30, own P18 wins over the flag", async () => {
    const c = { ...moreStart(NOW), family: "openings" };
    const plan = await adapter.plan(c, ctxFor(fixture("openings")));
    const rows = await adapter.run(plan.units[0], ctxFor(fixture("openings")));
    expect(rows.map((r) => [r.slug, r.date_precision, r.category, r.popularity, r.regions[0]])).toEqual([
      ["guggenheim-abu-dhabi-2026-12-11", "day", "culture", 30, "AE"],
      ["mutiara-line-2031-12-01", "month", "culture", 30, "MY"],
    ]);
    expect(rows[0].image_candidate_meta?.kind).toBe("p18");
    expect(rows[1].image_candidate_meta?.kind).toBe("flag");
  });
  it("a failed enrichment batch keeps the rows (and their hashes) without images or locations", async () => {
    const c = { ...moreStart(NOW), family: "expos" };
    const ok = await adapter.run((await adapter.plan(c, ctxFor(fixture("expos")))).units[0], ctxFor(fixture("expos")));
    const degraded = await adapter.run((await adapter.plan(c, ctxFor(fixture("expos")))).units[0], ctxFor(fixture("expos"), { enrichFails: true }));
    expect(degraded.length).toBe(1);
    expect(degraded[0].image_candidate_url).toBeNull();
    expect(degraded[0].location).toBeNull();
    expect(degraded[0].jsonld_eligible).toBe(false);
    expect(degraded[0].content_hash).toBe(ok[0].content_hash);
  });
});

describe("wikidata-more: guards", () => {
  it("drops bare Q labels, low sitelinks, label-year mismatches, past dates, far-future dates and coarse precision", () => {
    const keep = moreBindingsToEvents([bind({})], ELECTIONS, NOW);
    expect(keep).toHaveLength(1);
    expect(moreBindingsToEvents([bind({ itemLabel: "Q999" })], ELECTIONS, NOW)).toHaveLength(0);
    expect(moreBindingsToEvents([bind({ sl: "4" })], ELECTIONS, NOW)).toHaveLength(0);
    expect(moreBindingsToEvents([bind({ itemLabel: "2022 Bosnian presidential election", d: "2026-10-04T00:00:00Z" })], ELECTIONS, NOW)).toHaveLength(0);
    expect(moreBindingsToEvents([bind({ d: "2026-09-01T00:00:00Z" })], ELECTIONS, NOW)).toHaveLength(0);
    expect(moreBindingsToEvents([bind({ itemLabel: "Golden Shoe", d: "2067-01-01T00:00:00Z", prec: "9" })], ELECTIONS, NOW)).toHaveLength(0);
    expect(moreBindingsToEvents([bind({ d: "2030-01-01T00:00:00Z", prec: "8" })], ELECTIONS, NOW)).toHaveLength(0);
    // openings require month precision or better; year placeholders are dropped there but kept for elections
    expect(moreBindingsToEvents([bind({ d: "2028-01-01T00:00:00Z", prec: "9", itemLabel: "New museum" })], OPENINGS, NOW)).toHaveLength(0);
    expect(moreBindingsToEvents([bind({ d: "2028-01-01T00:00:00Z", prec: "9", itemLabel: "Next election" })], ELECTIONS, NOW)).toHaveLength(1);
    // enwiki is optional in phase 2 (sitelink floor is the junk filter)
    const noWiki = moreBindingsToEvents([bind({ enwiki: undefined })], ELECTIONS, NOW)[0];
    expect(noWiki.external_ids).toEqual({ qid: "Q999" });
  });
  it("merges multi-valued P17 into sorted regions, prefers PreferredRank, then finer precision, then earliest", () => {
    const rows = moreBindingsToEvents(
      [
        bind({ iso: "DE" }),
        bind({ iso: "AT", d: "2027-05-02T00:00:00Z" }),
        bind({ iso: "DE", d: "2027-06-01T00:00:00Z", prec: "10" }),
      ],
      ELECTIONS,
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].regions).toEqual(["AT", "DE"]);
    expect(rows[0].date).toBe("2027-04-18");
    const preferred = moreBindingsToEvents(
      [bind({}), bind({ d: "2027-09-01T00:00:00Z", rank: "http://wikiba.se/ontology#PreferredRank" })],
      ELECTIONS,
      NOW,
    );
    expect(preferred[0].date).toBe("2027-09-01");
    const fine = moreBindingsToEvents([bind({ d: "2027-01-01T00:00:00Z", prec: "9" }), bind({ d: "2027-06-15T00:00:00Z" })], ELECTIONS, NOW);
    expect(fine[0].date).toBe("2027-06-15");
    expect(fine[0].date_precision).toBe("day");
  });
  it("no region: GLOBAL and a country-less description; office tag and award category maps", () => {
    const [row] = moreBindingsToEvents([bind({ iso: undefined })], ELECTIONS, NOW);
    expect(row.regions).toEqual(["GLOBAL"]);
    expect(row.description).toBe("Election, as scheduled on Wikidata.");
    expect(officeTag("2027 Finnish parliamentary election")).toBe("parliamentary");
    expect(officeTag("2026 Taiwanese local elections")).toBe("local");
    expect(officeTag("Election of the Doge")).toBeNull();
    expect(awardCategory("68th Grammy Awards")).toBe("music");
    expect(awardCategory("2026 Booker Prize")).toBe("culture");
    expect(awardCategory("The Game Awards 2026")).toBe("games");
    expect(awardCategory("68th Ariel Awards")).toBe("entertainment");
  });
  it("commons image URLs: https + underscores, raster only unless SVG is allowed, non-FilePath rejected", () => {
    expect(commonsImage("http://commons.wikimedia.org/wiki/Special:FilePath/Riyadh%20Skyline.jpg")).toEqual({
      url: "https://commons.wikimedia.org/wiki/Special:FilePath/Riyadh_Skyline.jpg",
      file: "Riyadh Skyline.jpg",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Riyadh_Skyline.jpg",
    });
    expect(commonsImage("http://commons.wikimedia.org/wiki/Special:FilePath/Flag%20of%20Brazil.svg")).toBeNull();
    expect(commonsImage("http://commons.wikimedia.org/wiki/Special:FilePath/Flag%20of%20Brazil.svg", true)?.file).toBe("Flag of Brazil.svg");
    expect(commonsImage("http://commons.wikimedia.org/wiki/Special:FilePath/Logo.pdf")).toBeNull();
    expect(commonsImage("https://example.com/x.jpg")).toBeNull();
    expect(commonsImage(undefined)).toBeNull();
  });
  it("applyEnrichment: venue without coordinates, Q-id venue labels ignored, jsonld only with a country", () => {
    const base = () => moreBindingsToEvents([bind({ iso: undefined })], EXPOS, NOW)[0];
    const index = indexEnrichment([
      { item: { type: "uri", value: "http://www.wikidata.org/entity/Q999" }, venue: { type: "uri", value: "http://www.wikidata.org/entity/Q1" }, venueLabel: { type: "literal", value: "Q1" } },
    ]);
    const ignored = applyEnrichment(base(), EXPOS, index.get("Q999"));
    expect(ignored.location).toBeNull();
    expect(ignored.jsonld_eligible).toBe(false);
    const named = applyEnrichment(base(), EXPOS, { venue: "http://www.wikidata.org/entity/Q2", venueLabel: "Some Hall" });
    expect(named.location).toEqual({ name: "Some Hall", url: "https://www.wikidata.org/wiki/Q2" });
    expect(named.jsonld_eligible).toBe(false);
    const withCountry = applyEnrichment(base(), EXPOS, { venueLabel: "Some Hall", iso: "JP", venueCoord: "Point(139.6 35.7)" });
    expect(withCountry.location).toEqual({ name: "Some Hall", country: "JP", lat: 35.7, lng: 139.6 });
    expect(withCountry.jsonld_eligible).toBe(true);
    const awardRow = applyEnrichment(moreBindingsToEvents([bind({})], AWARDS, NOW)[0], AWARDS, { venueLabel: "Dolby Theatre", iso: "US" });
    expect(awardRow.jsonld_eligible).toBe(false); // invitation-only
    expect(awardRow.location?.name).toBe("Dolby Theatre");
  });
});

describe("wikidata-more: queries", () => {
  it("harvest query uses the statement path, rank/precision guards, the slice window, subtree + MINUS, optional end/iso", () => {
    const q = buildMoreQuery(ELECTIONS, firstSlice(NOW), 500);
    expect(q).toContain("?item p:P585 ?st . ?st psv:P585 ?v ; wikibase:rank ?rank .");
    expect(q).toContain("FILTER(?rank != wikibase:DeprecatedRank)");
    expect(q).toContain('?d >= "2026-09-09T00:00:00Z"^^xsd:dateTime && ?d < "2029-01-01T00:00:00Z"^^xsd:dateTime && ?prec >= 9');
    expect(q).toContain("FILTER(?sl >= 5)");
    expect(q).toContain("?item wdt:P31/wdt:P279* wd:Q40231 .");
    expect(q).toContain("MINUS { ?item wdt:P31 wd:Q40231 }");
    expect(q).toContain("OPTIONAL { ?item wdt:P17 ?c . ?c wdt:P297 ?iso }");
    expect(q).not.toContain("?end");
    expect(q).toContain("ORDER BY ?d ?item LIMIT 500 OFFSET 500");
    const e = buildMoreQuery(EXPOS, { from: "2029-01-01T00:00:00Z", to: "2032-01-01T00:00:00Z" });
    expect(e).toContain("p:P580");
    expect(e).toContain("OPTIONAL { ?item wdt:P582 ?end }");
    expect(e).toContain("FILTER(?sl >= 3)");
    expect(e).not.toContain("MINUS");
    expect(buildMoreQuery(LAUNCHES, firstSlice(NOW))).not.toContain("wdt:P31");
    expect(buildMoreQuery(OPENINGS, firstSlice(NOW))).toContain("?prec >= 10");
    expect(buildMoreQuery(FILMS, firstSlice(NOW))).toContain("MINUS { ?item wdt:P31 wd:Q11424 }");
    expect(buildEnrichQuery(["Q1", "Q2"])).toContain("VALUES ?item { wd:Q1 wd:Q2 }");
    expect(buildEnrichQuery(["Q1"])).toContain("wdt:P41 ?flag");
  });
  it("every family is unique, has a category and a description, and albums are not queried", () => {
    expect(new Set(MORE_FAMILIES.map((f) => f.id)).size).toBe(MORE_FAMILIES.length);
    for (const f of MORE_FAMILIES) {
      expect(f.description("X", ["GLOBAL"]).length).toBeGreaterThan(10);
      expect(f.popularity(100, "presidential election")).toBeLessThanOrEqual(100);
    }
    expect(MORE_FAMILIES.some((f) => f.root === "Q482994")).toBe(false);
  });
});

describe("wikidata-more: cursor and plan", () => {
  it("phase 1 hands over to the first family after its last variant", async () => {
    const ctx = ctxFor(fixture("elections"));
    const plan = await adapter.plan({ i: VARIANTS.length, page: 0 }, ctx);
    expect(plan.done).toBe(false);
    expect(plan.units[0].more).toEqual({ phase: "more", family: "elections", from: "2026-09-09T00:00:00Z", to: "2029-01-01T00:00:00Z", offset: 0 });
    expect(plan.units[0].key).toBe("wikidata:more:elections:2026-09-09:0");
    expect(isMoreCursor(plan.units[0].after)).toBe(true);
  });
  it("`after`: next page while full, next slice on the last page, next family after the horizon, then done", async () => {
    const ctx = ctxFor(fixture("elections"));
    const start = moreStart(NOW);
    const full = { results: { bindings: Array.from({ length: MORE_PAGE }, () => ({})) } };
    const fullPlan = await adapter.plan(start, ctxFor(full));
    await adapter.run(fullPlan.units[0], ctxFor(full));
    expect(fullPlan.units[0].after).toEqual({ ...start, offset: MORE_PAGE });
    expect(fullPlan.nextCursor).toEqual({ ...start, offset: MORE_PAGE });
    const lastPlan = await adapter.plan({ ...start, offset: MORE_PAGE }, ctx);
    await adapter.run(lastPlan.units[0], ctx);
    expect(lastPlan.units[0].after).toEqual({ phase: "more", family: "elections", from: "2029-01-01T00:00:00Z", to: "2032-01-01T00:00:00Z", offset: 0 });
    expect(moreAfter({ ...start, from: "2029-01-01T00:00:00Z", to: "2032-01-01T00:00:00Z" }, true, NOW)).toEqual({
      phase: "more",
      family: "elections",
      from: "2032-01-01T00:00:00Z",
      to: "2041-01-01T00:00:00Z",
      offset: 0,
    });
    expect(moreAfter({ ...start, from: "2032-01-01T00:00:00Z", to: "2041-01-01T00:00:00Z" }, true, NOW)).toEqual({ ...start, family: "awards" });
    const lastFamily = MORE_FAMILIES[MORE_FAMILIES.length - 1].id;
    expect(moreAfter({ ...start, family: lastFamily, from: "2032-01-01T00:00:00Z", to: "2041-01-01T00:00:00Z" }, true, NOW)).toEqual(MORE_DONE);
    // the page cap moves on even when pages keep coming back full
    expect(moreAfter({ ...start, offset: MORE_PAGE * 9 }, false, NOW).from).toBe("2029-01-01T00:00:00Z");
    const done = await adapter.plan(MORE_DONE, ctx);
    expect(done).toEqual({ units: [], done: true });
  });
  it("slices are content-addressed: a pass resumed after New Year continues from the stored `to`", () => {
    const later = new Date("2027-01-05T00:00:00Z");
    expect(nextSlice({ from: "2026-09-09T00:00:00Z", to: "2029-01-01T00:00:00Z" }, later)).toEqual({ from: "2029-01-01T00:00:00Z", to: "2030-01-01T00:00:00Z" });
    expect(nextSlice({ from: "2033-01-01T00:00:00Z", to: "2042-01-01T00:00:00Z" }, later)).toBeNull();
    expect(firstSlice(later)).toEqual({ from: "2027-01-05T00:00:00Z", to: "2030-01-01T00:00:00Z" });
    expect(isMoreCursor({ i: 2, page: 1 })).toBe(false);
    expect(isMoreCursor({ phase: "more", family: "x" })).toBe(false);
    expect(isMoreCursor(MORE_DONE)).toBe(true);
  });
  it("an unknown family (renamed between deploys) fails the unit instead of looping", async () => {
    const ctx = ctxFor(fixture("elections"));
    const plan = await adapter.plan({ ...moreStart(NOW), family: "albums" }, ctx);
    await expect(adapter.run(plan.units[0], ctx)).rejects.toThrow(/unknown wikidata family/);
    expect(plan.units[0].after).toEqual({ ...moreStart(NOW), family: "albums", offset: MORE_PAGE });
  });
});
