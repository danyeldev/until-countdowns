import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  adapter,
  addYears,
  ANNIVERSARY_YEARS,
  bindingsToEvents,
  bindingToEvent,
  buildAnniversaryQuery,
  commonsImage,
  gregorianToJulian,
  halveWindow,
  isSliceTooWide,
  jdnToGregorian,
  labelYearConsistent,
  nextSlice,
  ordinal,
  originalWindow,
  PAGE_LIMIT,
  parseCursor,
  parseRegions,
  sliceYears,
  type SparqlBinding,
  WD_ENDPOINT,
} from "@/lib/ingest/sources/anniversaries";
import { HttpError } from "@/lib/ingest/http";
import { IngestEventSchema, type IngestContext } from "@/lib/ingest/types";

const NOW = new Date("2026-09-09T12:00:00Z");
type Sparql = { results: { bindings: SparqlBinding[] } };
const fixture = (name: string): Sparql => JSON.parse(readFileSync(new URL(`../fixtures/anniversaries/${name}.json`, import.meta.url), "utf8"));
const SLICE_100 = fixture("p585-1926-09-07_1934-09-07");
const SLICE_500 = fixture("p585-1526-09-07_1534-09-07");

function ctxFor(body: Sparql | ((url: string) => Sparql), calls: string[] = []): IngestContext {
  return {
    http: {
      fetchJson: async <T,>(url: string) => {
        calls.push(url);
        return (typeof body === "function" ? body(url) : body) as T;
      },
      fetchText: async () => "",
    },
    log: { info() {}, warn() {}, error() {} },
    now: NOW,
    budget: { remainingMs: () => 60_000 },
    dryRun: true,
  };
}

/** The `to` of the window a query URL was built for (queries carry both bounds verbatim). */
function windowOf(url: string): { from: string; to: string } {
  const q = decodeURIComponent(url);
  const bounds = [...q.matchAll(/"(\d{4}-\d{2}-\d{2})T00:00:00Z"/g)].map((m) => m[1]);
  return { from: bounds[0], to: bounds[1] };
}

function binding(over: Record<string, string | undefined> = {}): SparqlBinding {
  const b: SparqlBinding = {
    item: { type: "uri", value: "http://www.wikidata.org/entity/Q205073" },
    itemLabel: { type: "literal", value: "Kellogg-Briand pact" },
    d: { type: "literal", value: "1928-08-27T00:00:00Z" },
    prec: { type: "literal", value: "11" },
    cal: { type: "uri", value: "http://www.wikidata.org/entity/Q1985727" },
    sl: { type: "literal", value: "62" },
    enwiki: { type: "uri", value: "https://en.wikipedia.org/wiki/Kellogg%E2%80%93Briand_Pact" },
    image: { type: "uri", value: "http://commons.wikimedia.org/wiki/Special:FilePath/Kellogg%E2%80%93Briand%20Pact%20signing.jpg" },
    isos: { type: "literal", value: "FR" },
  };
  for (const [k, v] of Object.entries(over)) b[k] = v === undefined ? undefined : { type: "literal", value: v };
  return b;
}

describe("anniversaries calendar helpers", () => {
  it("converts WDQS proleptic-Gregorian values of Julian-model dates back to the Julian calendar", () => {
    expect(gregorianToJulian({ y: 1582, m: 10, d: 15 })).toEqual({ y: 1582, m: 10, d: 5 });
    expect(gregorianToJulian({ y: 1527, m: 5, d: 16 })).toEqual({ y: 1527, m: 5, d: 6 }); // Sack of Rome, entered as 6 May 1527
    expect(gregorianToJulian({ y: 1700, m: 3, d: 11 })).toEqual({ y: 1700, m: 2, d: 29 }); // 1700 is a Julian leap year
  });
  it("addYears keeps month/day and folds 29 February into 28 February in common years", () => {
    expect(addYears({ y: 1904, m: 2, d: 29 }, 25)).toEqual({ y: 1929, m: 2, d: 28 });
    expect(addYears({ y: 1904, m: 2, d: 29 }, 100)).toEqual({ y: 2004, m: 2, d: 29 });
    expect(addYears({ y: 1928, m: 8, d: 27 }, 100)).toEqual({ y: 2028, m: 8, d: 27 });
  });
  it("jdnToGregorian round-trips and halveWindow bisects down to a one-year floor", () => {
    expect(jdnToGregorian(2451545)).toEqual({ y: 2000, m: 1, d: 1 });
    expect(jdnToGregorian(2460000)).toEqual({ y: 2023, m: 2, d: 24 });
    expect(halveWindow("1926-09-07", "1934-09-07")).toBe("1930-09-07");
    expect(halveWindow("1926-09-07", "1928-09-07")).toBe("1927-09-07");
    expect(halveWindow("1926-09-07", "1927-09-07")).toBeNull(); // 365 days: at the floor
    expect(halveWindow("1926-09-07", "1927-09-09")).toBe("1927-03-09"); // 367 days: one day past the floor
    expect(halveWindow("not-a-date", "1934-09-07")).toBeNull();
  });
  it("ordinals and windows", () => {
    expect([25, 50, 75, 100, 150, 200, 250, 500].map(ordinal)).toEqual(["25th", "50th", "75th", "100th", "150th", "200th", "250th", "500th"]);
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(112)).toBe("112th");
    // Originals from (today − N years − 2 days) up to (today + 15 years − N years), exclusive.
    expect(originalWindow(100, NOW)).toEqual({ from: "1926-09-07", to: "1941-09-09" });
    expect(originalWindow(25, NOW)).toEqual({ from: "2001-09-07", to: "2016-09-09" });
    expect(originalWindow(500, NOW)).toEqual({ from: "1526-09-07", to: "1541-09-09" });
  });
  it("labelYearConsistent accepts the original year and season ranges, rejects other years", () => {
    expect(labelYearConsistent("Shanghai massacre of 1927", 1927)).toBe(true);
    expect(labelYearConsistent("2022 Bosnian presidential election", 1926)).toBe(false);
    expect(labelYearConsistent("1927–28 season", 1928)).toBe(true);
    expect(labelYearConsistent("Kellogg-Briand pact", 1928)).toBe(true);
    expect(labelYearConsistent("Sack of Rome, 1527", 1527)).toBe(true);
  });
});

describe("anniversaries query and parsing helpers", () => {
  it("pins the join order, selects the earliest value per item and excludes editions, sub-events and minor air crashes", () => {
    const q = buildAnniversaryQuery("1926-09-07", "1934-09-07");
    // The selective half runs first, inside a sub-SELECT, with the plan pinned around it: the
    // unpinned form dies on the WDQS 60 s kill for dense windows.
    expect(q).toContain('hint:Group hint:optimizer "None" .');
    expect(q).toContain("SELECT ?item ?dv ?sl ?enwiki WHERE {");
    expect(q).toContain("?item wdt:P585 ?dv . hint:Prior hint:rangeSafe true .");
    expect(q).toContain('"1926-09-07T00:00:00Z"^^xsd:dateTime');
    expect(q).toContain('"1934-09-07T00:00:00Z"^^xsd:dateTime');
    expect(q).toContain("(MIN(?dv) AS ?d)"); // one date per item: two-round elections cannot collide
    expect(q).toContain("GROUP BY ?item ?itemLabel ?prec ?cal ?sl ?enwiki");
    expect(q).toContain("FILTER(?prec = 11)");
    expect(q).toContain("FILTER(?sl > 20)");
    expect(q).toContain("MINUS { ?item wdt:P31 wd:Q5 }");
    expect(q).toContain("MINUS { ?item wdt:P31 wd:Q577 }");
    expect(q).toContain("MINUS { ?item wdt:P31 wd:Q114609228 }"); // recurring sporting event edition
    expect(q).toContain("MINUS { ?item wdt:P31 wd:Q27968055 }"); // recurring event edition
    expect(q).toContain("MINUS { ?item wdt:P361 ?whole . ?whole wdt:P585 ?dv }"); // sub-events of a same-day parent
    expect(q).toContain("FILTER NOT EXISTS { ?item wdt:P31 wd:Q744913 . FILTER(?sl < 40) }");
    expect(q).toContain("wikibase:timeCalendarModel ?cal");
    expect(q).toContain("?c wdt:P297 ?iso");
    expect(q).toContain("schema:isPartOf <https://en.wikipedia.org/>");
    expect(q).toContain(`LIMIT ${PAGE_LIMIT}`);
    expect(q).not.toContain("SERVICE wikibase:label");
  });
  it("commonsImage keeps raster files only and yields https FilePath + file page", () => {
    expect(commonsImage("http://commons.wikimedia.org/wiki/Special:FilePath/Sacvan.jpg")).toEqual({
      url: "https://commons.wikimedia.org/wiki/Special:FilePath/Sacvan.jpg",
      pageUrl: "https://commons.wikimedia.org/wiki/File:Sacvan.jpg",
    });
    expect(commonsImage("http://commons.wikimedia.org/wiki/Special:FilePath/Firma%20dei%20Patti.jpg")?.url).toBe(
      "https://commons.wikimedia.org/wiki/Special:FilePath/Firma_dei_Patti.jpg",
    );
    expect(commonsImage("http://commons.wikimedia.org/wiki/Special:FilePath/ElectoralCollege1928.svg")).toBeNull();
    expect(commonsImage("https://upload.wikimedia.org/x.jpg")).toBeNull();
    expect(commonsImage(undefined)).toBeNull();
    expect(parseRegions("IT,VA")).toEqual(["IT", "VA"]);
    expect(parseRegions("us,fr,GB,xyz,")).toEqual(["FR", "GB", "US"]);
    expect(parseRegions("")).toEqual([]);
  });
  it("isSliceTooWide separates 'query cannot finish' from budget and other failures", () => {
    expect(isSliceTooWide(new HttpError(504, WD_ENDPOINT))).toBe(true);
    expect(isSliceTooWide(new HttpError(502, WD_ENDPOINT))).toBe(true);
    expect(isSliceTooWide(new HttpError(429, WD_ENDPOINT))).toBe(false);
    expect(isSliceTooWide(Object.assign(new Error("aborted"), { name: "TimeoutError" }))).toBe(true);
    expect(isSliceTooWide(Object.assign(new Error("no budget"), { name: "BudgetExceededError" }))).toBe(false);
    expect(isSliceTooWide("504")).toBe(false);
  });
});

describe("anniversaries binding → row", () => {
  it("builds the 100-year row: title, own description, key scheme, ids, image, popularity bonus", () => {
    const ev = bindingToEvent(binding(), 100, NOW)!;
    expect(IngestEventSchema.safeParse(ev).success).toBe(true);
    expect(ev.title).toBe("100th anniversary of Kellogg-Briand pact");
    expect(ev.slug).toBe("100th-anniversary-of-kellogg-briand-pact-2028-08-27");
    expect(ev.date).toBe("2028-08-27");
    expect(ev.source).toBe("anniversaries");
    expect(ev.source_key).toBe("anniversaries:Q205073:2028");
    expect(ev.source_url).toBe("https://www.wikidata.org/wiki/Q205073");
    expect(ev.category).toBe("history");
    expect(ev.tags).toEqual(["anniversary", "anniversary-100"]);
    expect(ev.regions).toEqual(["FR"]);
    expect(ev.date_precision).toBe("day");
    expect(ev.status).toBe("scheduled");
    expect(ev.all_day).toBe(true);
    expect(ev.confidence).toBe(0.85);
    expect(ev.jsonld_eligible).toBe(false);
    expect(ev.popularity).toBe(31 + 10); // floor(62 / 2) + marquee bonus
    expect(ev.external_ids).toEqual({ anniversary_years: 100, enwiki: "Kellogg–Briand Pact", original_date: "1928-08-27", qid: "Q205073" });
    expect(ev.description).toBe(
      "100 years since Kellogg-Briand pact (27 August 1928). The 100th anniversary falls on 27 August 2028. " +
        "The date comes from the Wikidata record for the original event.",
    );
    expect(ev.image_candidate_url).toBe("https://commons.wikimedia.org/wiki/Special:FilePath/Kellogg%E2%80%93Briand_Pact_signing.jpg");
    expect(ev.image_candidate_meta).toEqual({ provider: "commons", pageUrl: "https://commons.wikimedia.org/wiki/File:Kellogg%E2%80%93Briand_Pact_signing.jpg" });
  });
  it("even the shortest label clears the 80-character, two-sentence indexability bar", () => {
    // "25 years since Live 8 (2 July 2005). The 25th anniversary falls on 2 July 2030." is 79.
    const ev = bindingToEvent(
      binding({ item: "http://www.wikidata.org/entity/Q192368", itemLabel: "Live 8", d: "2005-07-02T00:00:00Z", sl: "42" }),
      25,
      NOW,
    )!;
    expect(ev.description.startsWith("25 years since Live 8 (2 July 2005).")).toBe(true);
    expect(ev.description.length).toBeGreaterThanOrEqual(80);
    expect(ev.description.split(". ").length).toBeGreaterThanOrEqual(3);
  });
  it("popularity is clamp(floor(sl/2), 20, 70) with +10 only for 100/250/500; classify adds tags", () => {
    expect(bindingToEvent(binding({ sl: "21" }), 100, NOW)!.popularity).toBe(30);
    expect(bindingToEvent(binding({ sl: "21", d: "1978-08-27T00:00:00Z" }), 50, NOW)!.popularity).toBe(20);
    expect(bindingToEvent(binding({ sl: "194", d: "1978-08-27T00:00:00Z" }), 50, NOW)!.popularity).toBe(70);
    expect(bindingToEvent(binding({ sl: "194", d: "1778-08-27T00:00:00Z" }), 250, NOW)!.popularity).toBe(80);
    const election = bindingToEvent(binding({ itemLabel: "1928 United States presidential election", d: "1928-11-06T00:00:00Z" }), 100, NOW)!;
    expect(election.tags).toEqual(["anniversary", "anniversary-100", "elections"]);
    expect(election.category).toBe("history");
  });
  it("guards: precision, Q-id label, label-year mismatch, sitelink floor, missing enwiki, horizon, past", () => {
    expect(bindingToEvent(binding({ prec: "10" }), 100, NOW)).toBeNull();
    expect(bindingToEvent(binding({ prec: "9", d: "1928-01-01T00:00:00Z" }), 100, NOW)).toBeNull();
    expect(bindingToEvent(binding({ itemLabel: "Q205073" }), 100, NOW)).toBeNull();
    expect(bindingToEvent(binding({ itemLabel: "2022 Bosnian presidential election" }), 100, NOW)).toBeNull();
    expect(bindingToEvent(binding({ sl: "20" }), 100, NOW)).toBeNull();
    expect(bindingToEvent(binding({ enwiki: undefined }), 100, NOW)).toBeNull();
    expect(bindingToEvent(binding({ d: "2020-03-01T00:00:00Z" }), 25, NOW)).toBeNull(); // 2045 > now + 15 y
    expect(bindingToEvent(binding({ d: "1920-03-01T00:00:00Z" }), 100, NOW)).toBeNull(); // 2020 is past
    expect(bindingToEvent(binding({ d: "1926-09-08T00:00:00Z" }), 100, NOW)).not.toBeNull(); // yesterday survives
    expect(bindingToEvent(binding({ d: "1926-09-06T00:00:00Z" }), 100, NOW)).toBeNull();
  });
  it("Julian-model values keep the historical day and say so", () => {
    const ev = bindingToEvent(
      binding({
        item: "http://www.wikidata.org/entity/Q465627",
        itemLabel: "Sack of Rome, 1527",
        d: "1527-05-16T00:00:00Z",
        cal: "http://www.wikidata.org/entity/Q1985786",
        sl: "37",
        enwiki: "https://en.wikipedia.org/wiki/Sack_of_Rome_(1527)",
        isos: undefined,
        image: undefined,
      }),
      500,
      NOW,
    )!;
    expect(ev.date).toBe("2027-05-06");
    expect(ev.source_key).toBe("anniversaries:Q465627:2027");
    expect(ev.external_ids).toEqual({ anniversary_years: 500, calendar: "julian", enwiki: "Sack of Rome (1527)", original_date: "1527-05-06", qid: "Q465627" });
    expect(ev.description).toContain("(6 May 1527)");
    expect(ev.description).toContain("Julian-calendar");
    expect(ev.regions).toEqual(["GLOBAL"]);
    expect(ev.image_candidate_url).toBeNull();
  });
  it("dedupes by QID keeping the earliest date (bindings are date-ordered)", () => {
    const rows = bindingsToEvents([binding({ d: "1928-08-27T00:00:00Z" }), binding({ d: "1928-09-01T00:00:00Z" })], 100, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2028-08-27");
    expect(rows[0].source_key).toBe("anniversaries:Q205073:2028");
  });
});

describe("anniversaries fixture → run(unit)", () => {
  it("100-year slice: every row validates, keys are stable across two runs, images/regions/rejects as recorded", async () => {
    const calls: string[] = [];
    const ctx = ctxFor(SLICE_100, calls);
    const plan = await adapter.plan({ n: 100, from: "1926-09-07" }, ctx);
    expect(plan.done).toBe(false);
    expect(plan.units).toHaveLength(1);
    const unit = plan.units[0];
    expect(unit.key).toBe("anniversaries:100:1926-09-07");
    expect(unit.to).toBe("1934-09-07"); // 8-year slice for N > 50
    const rows = await adapter.run(unit, ctx);
    const again = await adapter.run(unit, ctx);
    expect(calls).toHaveLength(2);
    expect(calls[0].startsWith(`${WD_ENDPOINT}?query=`)).toBe(true);
    expect(windowOf(calls[0])).toEqual({ from: "1926-09-07", to: "1934-09-07" });
    expect(rows).toEqual(again);
    expect(rows).toHaveLength(41);
    expect(new Set(rows.map((r) => r.source_key)).size).toBe(41);
    for (const r of rows) {
      const parsed = IngestEventSchema.safeParse(r);
      expect(parsed.success, `${r.source_key}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
      expect(r.source).toBe("anniversaries");
      expect(r.category).toBe("history");
      expect(r.date_precision).toBe("day");
      expect(r.status).toBe("scheduled");
      expect(r.tags).toContain("anniversary");
      expect(r.tags).toContain("anniversary-100");
      expect(r.source_key).toMatch(/^anniversaries:Q\d+:\d{4}$/);
      expect(r.date.slice(0, 4)).toBe(r.source_key.split(":")[2]);
      expect(r.date >= "2026-09-07" && r.date < "2041-09-09").toBe(true);
      expect(r.title.startsWith("100th anniversary of ")).toBe(true);
      expect(r.description.length).toBeGreaterThanOrEqual(80);
    }
    expect(rows.slice(0, 8).map((r) => r.source_key)).toEqual([
      "anniversaries:Q740162:2027",
      "anniversaries:Q1195058:2027",
      "anniversaries:Q476634:2027",
      "anniversaries:Q833926:2027",
      "anniversaries:Q992318:2027",
      "anniversaries:Q205073:2028",
      "anniversaries:Q699380:2028",
      "anniversaries:Q1073476:2028",
    ]);
    expect(rows.slice(-2).map((r) => r.source_key)).toEqual(["anniversaries:Q3182543:2034", "anniversaries:Q945608:2034"]);
    const byKey = new Map(rows.map((r) => [r.source_key, r]));
    const lateran = byKey.get("anniversaries:Q193270:2029")!;
    expect(lateran.title).toBe("100th anniversary of Lateran Treaty");
    expect(lateran.date).toBe("2029-02-11");
    expect(lateran.regions).toEqual(["IT", "VA"]);
    expect(lateran.popularity).toBe(34 + 10);
    expect(lateran.image_candidate_meta).toEqual({ provider: "commons", pageUrl: expect.stringMatching(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/) });
    const election = byKey.get("anniversaries:Q699380:2028")!;
    expect(election.image_candidate_url).toBeNull(); // .svg is not re-hosted
    expect(election.tags).toContain("elections");
    const naval = byKey.get("anniversaries:Q704536:2030")!;
    expect(naval.regions).toEqual(["FR", "GB", "US"]);
    expect(naval.image_candidate_url).toBeNull(); // no P18
    const worldCup = byKey.get("anniversaries:Q63843:2030")!;
    expect(worldCup.title).toBe("100th anniversary of 1930 FIFA World Cup Final");
    expect(worldCup.tags).toContain("sports");
    // Non-full, non-narrowed page: the cursor advances to the next slice of the same window.
    expect(unit.after).toEqual({ n: 100, from: "1934-09-07" });
    expect(plan.nextCursor).toEqual({ n: 100, from: "1934-09-07" });
  });
  it("500-year window: Julian rows use the historical day; Gregorian rows are untouched", async () => {
    const ctx = ctxFor(SLICE_500);
    const plan = await adapter.plan({ n: 500, from: "1526-09-07" }, ctx);
    const unit = plan.units[0];
    expect(unit.to).toBe("1534-09-07");
    const rows = await adapter.run(unit, ctx);
    expect(rows.map((r) => [r.source_key, r.date, r.external_ids.calendar ?? "gregorian"])).toEqual([
      ["anniversaries:Q465627:2027", "2027-05-06", "julian"],
      ["anniversaries:Q1147471:2029", "2029-04-22", "julian"],
      ["anniversaries:Q14043328:2029", "2029-08-05", "julian"],
      ["anniversaries:Q1425362:2032", "2032-11-16", "gregorian"],
    ]);
    for (const r of rows) expect(IngestEventSchema.safeParse(r).success, r.source_key).toBe(true);
    expect(rows[0].title).toBe("500th anniversary of Sack of Rome, 1527");
    expect(rows[0].popularity).toBe(20 + 10); // floor(37/2)=18 → clamped to 20, +10 marquee
    expect(unit.after).toEqual({ n: 500, from: "1534-09-07" });
    // The last slice of the last N ends the pass.
    const last = await adapter.plan({ n: 500, from: "1541-09-09" }, ctx);
    expect(last.done).toBe(true);
    expect(last.units).toEqual([]);
  });
  it("a slice that WDQS cannot answer is halved instead of re-sent, and resumes at the half it covered", async () => {
    const calls: string[] = [];
    // 504 for anything wider than four years — the shape of the dense 19th-century bands.
    const ctx: IngestContext = {
      ...ctxFor(SLICE_100, calls),
      http: {
        fetchJson: async <T,>(url: string) => {
          calls.push(url);
          const { to } = windowOf(url);
          if (to > "1930-09-07") throw new HttpError(504, url);
          return SLICE_100 as T;
        },
        fetchText: async () => "",
      },
    };
    const plan = await adapter.plan({ n: 100, from: "1926-09-07" }, ctx);
    const unit = plan.units[0];
    const rows = await adapter.run(unit, ctx);
    expect(calls.map((c) => windowOf(c).to)).toEqual(["1934-09-07", "1930-09-07"]); // one halving, no repeat of the wide query
    expect(rows.length).toBeGreaterThan(0);
    expect(unit.after).toEqual({ n: 100, from: "1930-09-07" }); // the rest of the slice is re-planned, not skipped
    expect(plan.nextCursor).toEqual({ n: 100, from: "1930-09-07" });
  });
  it("narrowing stops at the one-year floor and the unit is reported failed", async () => {
    const calls: string[] = [];
    const ctx: IngestContext = {
      ...ctxFor(SLICE_100, calls),
      http: {
        fetchJson: async <T,>(url: string): Promise<T> => {
          calls.push(url);
          throw new HttpError(504, url);
        },
        fetchText: async () => "",
      },
    };
    const plan = await adapter.plan({ n: 100, from: "1926-09-07" }, ctx);
    await expect(adapter.run(plan.units[0], ctx)).rejects.toThrow(/504/);
    // 8 y → 4 y → 2 y → 1 y, then it stops rather than looping on ever-smaller windows.
    expect(calls.map((c) => windowOf(c).to)).toEqual(["1934-09-07", "1930-09-07", "1928-09-06", "1927-09-07"]);
  });
});

describe("anniversaries cursor", () => {
  it("parseCursor ignores foreign shapes and starts at the 25-year window", () => {
    const start = { n: 25, from: "2001-09-07" };
    expect(parseCursor(null, NOW)).toEqual(start);
    expect(parseCursor({ i: 3, page: 2 }, NOW)).toEqual(start);
    expect(parseCursor({ n: 30, from: "2001-09-07" }, NOW)).toEqual(start);
    expect(parseCursor({ n: 100, from: "not-a-date" }, NOW)).toEqual(start);
    expect(parseCursor({ n: 100, from: "1930-09-07" }, NOW)).toEqual({ n: 100, from: "1930-09-07" });
  });
  it("nextSlice sizes slices by N, clips to the window and skips exhausted windows", () => {
    expect([25, 50, 75, 100, 150, 500].map(sliceYears)).toEqual([4, 4, 8, 8, 8, 8]);
    expect(nextSlice({ n: 25, from: "2001-09-07" }, NOW)).toEqual({ n: 25, from: "2001-09-07", to: "2005-09-07" });
    expect(nextSlice({ n: 25, from: "2015-09-07" }, NOW)).toEqual({ n: 25, from: "2015-09-07", to: "2016-09-09" });
    expect(nextSlice({ n: 25, from: "2016-09-09" }, NOW)).toEqual({ n: 50, from: "1976-09-07", to: "1980-09-07" });
    expect(nextSlice({ n: 75, from: "1951-09-07" }, NOW)).toEqual({ n: 75, from: "1951-09-07", to: "1959-09-07" });
    expect(nextSlice({ n: 150, from: "1876-09-07" }, NOW)).toEqual({ n: 150, from: "1876-09-07", to: "1884-09-07" });
    expect(nextSlice({ n: 500, from: "1541-09-09" }, NOW)).toBeNull();
    // A cursor from an earlier day (window has since moved on) is pulled up to the window start.
    expect(nextSlice({ n: 100, from: "1926-09-01" }, NOW)?.from).toBe("1926-09-07");
    expect(ANNIVERSARY_YEARS).toEqual([25, 50, 75, 100, 150, 200, 250, 500]);
  });
  it("a full page resumes from the last date returned instead of skipping the rest of the slice", async () => {
    // Date-ordered like WDQS output: months 1..9 of 1927, the last binding on 1927-09-15.
    const page: Sparql = {
      results: { bindings: Array.from({ length: PAGE_LIMIT }, (_, i) => binding({ d: `1927-0${1 + Math.floor((i * 9) / PAGE_LIMIT)}-15T00:00:00Z` })) },
    };
    const ctx = ctxFor(page);
    const plan = await adapter.plan({ n: 100, from: "1926-09-07" }, ctx);
    const unit = plan.units[0];
    await adapter.run(unit, ctx);
    expect(unit.after).toEqual({ n: 100, from: "1927-09-15" });
    expect(plan.nextCursor).toEqual({ n: 100, from: "1927-09-15" });
    // A fresh plan for the same cursor (new invocation, empty module state) is not skipped.
    const again = await adapter.plan({ n: 100, from: "1927-09-15" }, ctxFor(SLICE_100));
    expect(again.units[0].from).toBe("1927-09-15");
    expect(again.units[0].to).toBe("1935-09-15");
  });
});
