import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  adapter,
  bindingsToEvents,
  buildObservancesQuery,
  categoryFor,
  commonsFileName,
  emptySkips,
  KINDS,
  overrideRows,
  PAGE_ITEMS,
  parseCursor,
  pickImage,
  POPULARITY_CAP,
  proseCountryName,
  resolveRule,
  groupBindings,
  type SparqlBinding,
} from "@/lib/ingest/sources/observances";
import { describeRule, occurrence, parseDayLabel, ruleKey } from "@/lib/ingest/sources/observances/rules";
import { OBSERVANCE_OVERRIDES, OVERRIDE_QIDS } from "@/lib/ingest/sources/observances/overrides";
import { IngestEventSchema, type IngestContext } from "@/lib/ingest/types";

const NOW = new Date("2026-09-09T12:00:00Z");
const YEARS = 3;

function fixture(name: string): SparqlBinding[] {
  const json = JSON.parse(readFileSync(new URL(`../fixtures/observances/${name}`, import.meta.url), "utf8")) as {
    results: { bindings: SparqlBinding[] };
  };
  return json.results.bindings;
}

describe("P837 day-label parser", () => {
  it("parses fixed days, nth weekdays, Easter offsets (incl. U+2212), seasons and Chinese lunar days", () => {
    expect(parseDayLabel("March 14")).toEqual({ kind: "fixed_day", month: 3, day: 14 });
    expect(parseDayLabel("February 29")).toEqual({ kind: "fixed_day", month: 2, day: 29 });
    expect(parseDayLabel("first Monday in August")).toEqual({ kind: "nth_weekday", n: 1, weekday: 1, month: 8 });
    expect(parseDayLabel("second Wednesday in November")).toEqual({ kind: "nth_weekday", n: 2, weekday: 3, month: 11 });
    expect(parseDayLabel("last Monday of March")).toEqual({ kind: "nth_weekday", n: -1, weekday: 1, month: 3 });
    expect(parseDayLabel("Easter + 39 days")).toEqual({ kind: "easter_offset", days: 39 });
    expect(parseDayLabel("Easter − 47 days")).toEqual({ kind: "easter_offset", days: -47 });
    expect(parseDayLabel("Good Friday")).toEqual({ kind: "easter_offset", days: -2 });
    expect(parseDayLabel("March equinox")).toEqual({ kind: "equinox", which: "march" });
    expect(parseDayLabel("June solstice")).toEqual({ kind: "solstice", which: "june" });
    expect(parseDayLabel("15th day of the 8th month of the Chinese lunisolar calendar")).toEqual({ kind: "chinese_lunar", month: 8, day: 15 });
    expect(parseDayLabel("5th day of the 5th month in the Chinese lunar calendar")).toEqual({ kind: "chinese_lunar", month: 5, day: 5 });
  });
  it("rejects non-Gregorian and vague labels", () => {
    for (const s of ["1 Farvardin", "27 Nisan", "Ashvin Shukla Dashami", "Vesak", "variable", "variable date", "August", "Sunday in June", "last day of February", "February 30", ""]) {
      expect(parseDayLabel(s), s).toBeNull();
    }
  });
  it("expands rules per year (Feb 29 only in leap years, missing 5th weekday, Easter and equinox arithmetic)", () => {
    expect(occurrence({ kind: "fixed_day", month: 2, day: 29 }, 2027)).toBeNull();
    expect(occurrence({ kind: "fixed_day", month: 2, day: 29 }, 2028)).toBe("2028-02-29");
    expect(occurrence({ kind: "nth_weekday", n: 1, weekday: 1, month: 8 }, 2027)).toBe("2027-08-02");
    expect(occurrence({ kind: "nth_weekday", n: -1, weekday: 5, month: 7 }, 2027)).toBe("2027-07-30");
    expect(occurrence({ kind: "nth_weekday", n: 5, weekday: 1, month: 2 }, 2027)).toBeNull();
    expect(occurrence({ kind: "easter_offset", days: 39 }, 2027)).toBe("2027-05-06"); // Easter 2027-03-28
    expect(occurrence({ kind: "easter_offset", days: -2 }, 2026)).toBe("2026-04-03");
    expect(occurrence({ kind: "equinox", which: "march" }, 2027)).toBe("2027-03-20");
    expect(occurrence({ kind: "solstice", which: "december" }, 2026)).toBe("2026-12-21");
    expect(occurrence({ kind: "chinese_lunar", month: 1, day: 1 }, 2027)).toBe("2027-02-06");
    expect(occurrence({ kind: "chinese_lunar", month: 8, day: 15 }, 2026)).toBe("2026-09-25");
    // Lunar months 11–12 belong to the Gregorian year they fall in, not the lunar year's number.
    expect(occurrence({ kind: "chinese_lunar", month: 12, day: 23 }, 2026)).toBe("2026-02-10"); // lunar 2025-12-23
    expect(occurrence({ kind: "chinese_lunar", month: 12, day: 23 }, 2027)).toBe("2027-01-30"); // lunar 2026-12-23
    expect(occurrence({ kind: "chinese_lunar", month: 11, day: 15 }, 2026)).toBe("2026-01-03"); // earlier of two hits
    expect(occurrence({ kind: "chinese_lunar", month: 1, day: 1 }, 2026)).toBe("2026-02-17");
  });
  it("describes rules in our own words and keys them stably", () => {
    expect(describeRule({ kind: "fixed_day", month: 3, day: 14 })).toBe("on March 14");
    expect(describeRule({ kind: "nth_weekday", n: -1, weekday: 5, month: 7 })).toBe("on the last Friday of July");
    expect(describeRule({ kind: "easter_offset", days: 39 })).toBe("39 days after Easter Sunday");
    expect(describeRule({ kind: "chinese_lunar", month: 8, day: 15 })).toBe("on the 15th day of the 8th month of the Chinese lunar calendar");
    expect(ruleKey(parseDayLabel("Easter")!)).toBe(ruleKey(parseDayLabel("date of Easter")!));
  });
});

describe("q2558684 (world days) fixture → rows", () => {
  const bindings = fixture("q2558684-sample.json");
  const skips = emptySkips();
  const rows = bindingsToEvents(bindings, "q2558684", NOW, skips, YEARS);
  const keys = rows.map((r) => r.source_key);

  it("emits valid, unique rows with stable source_keys across two runs", () => {
    expect(rows.length).toBeGreaterThan(10);
    for (const r of rows) expect(IngestEventSchema.safeParse(r).success, r.source_key).toBe(true);
    expect(new Set(keys).size).toBe(keys.length);
    const again = bindingsToEvents(bindings, "q2558684", NOW, undefined, YEARS);
    expect(again.map((r) => r.source_key)).toEqual(keys);
    expect(again.map((r) => r.content_hash)).toEqual(rows.map((r) => r.content_hash));
    for (const r of rows) expect(r.source).toBe("observances");
  });
  it("World Hearing Day: 3 rows, png image chosen over the pdf, awareness category, international-day tag", () => {
    const whd = rows.filter((r) => r.external_ids.qid === "Q5815639");
    expect(whd.map((r) => r.source_key)).toEqual(["observances:Q5815639:2027", "observances:Q5815639:2028"]); // 2026-03-03 is past
    expect(whd[0].slug).toBe("world-hearing-day-2027-03-03");
    expect(whd[0].category).toBe("awareness");
    expect(whd[0].tags).toEqual(["awareness-day", "observance", "wikidata", "international-day"]);
    expect(whd[0].image_candidate_url).toBe("https://commons.wikimedia.org/wiki/Special:FilePath/WHO-world-hearing-day-2023_with_text.png");
    expect(whd[0].image_candidate_meta).toEqual({ provider: "commons", pageUrl: "https://commons.wikimedia.org/wiki/File:WHO-world-hearing-day-2023_with_text.png" });
    expect(whd[0].source_url).toBe("https://en.wikipedia.org/wiki/World_Hearing_Day");
    expect(whd[0].external_ids).toEqual({ enwiki: "World Hearing Day", qid: "Q5815639" });
    expect(whd[0].date_precision).toBe("day");
    expect(whd[0].status).toBe("scheduled");
    expect(whd[0].all_day).toBe(true);
    expect(whd[0].timezone).toBeNull();
    expect(whd[0].confidence).toBe(0.9);
    expect(whd[0].jsonld_eligible).toBe(false);
    expect(whd[0].featured).toBe(false);
    expect(whd[0].description).toBe("World Hearing Day is observed every year on March 3. In 2027 it falls on Wednesday, 3 March 2027.");
  });
  it("skips multi-country conflicts, unparsable-only items, missing labels; keeps parseable statement of a mixed item; preferred rank wins", () => {
    expect(keys.some((k) => k.startsWith("observances:Q10265910:"))).toBe(false); // 4 distinct days across countries
    expect(keys.some((k) => k.startsWith("observances:Q4898140:"))).toBe(false); // "last day of February"
    expect(keys.some((k) => k.startsWith("observances:Q123574163:"))).toBe(false); // no English label
    expect(keys.some((k) => k.startsWith("observances:Q125484261:"))).toBe(false); // day item without label
    expect(skips.conflict.length).toBe(1);
    expect(skips.unparsable.length).toBe(2);
    expect(skips.noLabel).toBe(1);
    const vesak = rows.find((r) => r.external_ids.qid === "Q30325108")!; // "May 7" + "variable date"
    expect(vesak.date).toBe("2027-05-07");
    const animal = rows.find((r) => r.external_ids.qid === "Q167888")!; // preferred October 4 over AR-only April 29
    expect(animal.date).toBe("2026-10-04");
    expect(animal.regions).toEqual(["GLOBAL"]);
  });
  it("rule-based days: nth weekday expansion, confidence 0.8, raw.recurrence kept; svg images are not candidates", () => {
    const bullying = rows.filter((r) => r.external_ids.qid === "Q101026979");
    expect(bullying.map((r) => r.date)).toEqual(["2026-11-05", "2027-11-04", "2028-11-02"]);
    expect(bullying[0].confidence).toBe(0.8);
    expect((bullying[0].raw as { recurrence: unknown }).recurrence).toEqual({ kind: "nth_weekday", n: 1, weekday: 4, month: 11 });
    const romani = rows.find((r) => r.external_ids.qid === "Q102347972")!;
    expect(romani.image_candidate_url).toBeNull();
    expect(romani.regions).toEqual(["ES"]);
    const maths = rows.find((r) => r.external_ids.qid === "Q1065466")!;
    expect(maths.date).toBe("2026-09-18");
  });
  it("popularity = min(35, 30 + min(20, floor(sitelinks/5))) — the §0 high-volume cap", () => {
    expect(POPULARITY_CAP).toBe(35);
    const whd = rows.find((r) => r.external_ids.qid === "Q5815639")!; // sitelinks in fixture
    const sl = Number(bindings.find((b) => b.item?.value.endsWith("/Q5815639"))!.sl!.value);
    expect(whd.popularity).toBe(Math.min(35, 30 + Math.min(20, Math.floor(sl / 5))));
    const down = rows.find((r) => r.external_ids.qid === "Q240491")!;
    expect(down.popularity).toBe(35); // 39 sitelinks → 37 uncapped
    expect(rows.every((r) => r.popularity <= 35)).toBe(true);
    expect(rows.some((r) => r.popularity < 35)).toBe(true); // low-sitelink items keep the graded score
  });
});

describe("q57598 (national days) fixture → rows", () => {
  const bindings = fixture("q57598-sample.json");
  const skips = emptySkips();
  const rows = bindingsToEvents(bindings, "q57598", NOW, skips, YEARS);
  const byQid = (q: string) => rows.filter((r) => r.external_ids.qid === q);

  it("national category, base popularity 45, regions from the item's country; duplicates collapse", () => {
    for (const r of rows) expect(IngestEventSchema.safeParse(r).success, r.source_key).toBe(true);
    const jp = byQid("Q1059995");
    expect(jp.map((r) => r.source_key)).toEqual(["observances:Q1059995:2027", "observances:Q1059995:2028"]);
    expect(jp[0].category).toBe("national");
    expect(jp[0].regions).toEqual(["JP"]);
    expect(jp[0].popularity).toBe(45 + Math.min(20, Math.floor(24 / 5))); // national days keep the §7 base (§22: observances wins them)
    expect(jp[0].tags).toContain("national-day");
    expect(jp[0].description).toBe("National Foundation Day is a national day observed in Japan every year on February 11. In 2027 it falls on Thursday, 11 February 2027.");
    expect(byQid("Q156397").map((r) => r.date)).toEqual(["2026-09-11", "2027-09-11", "2028-09-11"]); // 2 identical bindings → 1 row per year
    expect(byQid("Q21588246")[0].regions).toEqual(["AR", "CL"]);
  });
  it("skips national days without an ISO country, non-Gregorian days (27 Nisan), unresolvable conflicts (Nowruz) and unparsable rules", () => {
    expect(byQid("Q110192210")).toHaveLength(0);
    expect(byQid("Q309530")).toHaveLength(0); // Yom HaShoah
    expect(byQid("Q483236")).toHaveLength(0); // Nowruz: March 21 vs March equinox
    expect(byQid("Q13470307")).toHaveLength(0); // "Sunday in June"
    expect(byQid("Q112678738")).toHaveLength(0); // no English label
    expect(skips.noRegion).toBe(1);
    expect(skips.conflict).toHaveLength(1);
    expect(skips.unparsable).toHaveLength(2);
    expect(skips.noLabel).toBe(1);
  });
});

describe("p837 (fun/holiday long tail) fixture → rows", () => {
  const bindings = fixture("p837-rules.json");
  const skips = emptySkips();
  const rows = bindingsToEvents(bindings, "p837", NOW, skips, YEARS);
  const byQid = (q: string) => rows.filter((r) => r.external_ids.qid === q);

  it("Pi Day and Star Wars Day are fun, awareness-day items tagged, nth-weekday rules expanded", () => {
    for (const r of rows) expect(IngestEventSchema.safeParse(r).success, r.source_key).toBe(true);
    const pi = byQid("Q179736");
    expect(pi[0].category).toBe("fun");
    expect(pi[0].tags).toEqual(["awareness-day", "observance", "wikidata"]);
    expect(pi.map((r) => r.date)).toEqual(["2027-03-14", "2028-03-14"]);
    const sw = byQid("Q2603175")[0];
    expect(sw.category).toBe("fun");
    expect(sw.tags).toEqual(["observance", "wikidata"]);
    expect(sw.regions).toEqual(["GLOBAL"]);
    expect(byQid("Q1189072").map((r) => r.date)).toEqual(["2027-04-09", "2028-04-14"]); // second Friday in April
    expect(byQid("Q1376652")[0].regions).toEqual(["CZ", "DE"]);
    expect(rows.every((r) => r.popularity <= 35)).toBe(true);
    expect(byQid("Q1376652")[0].description).toContain("observed in the Czech Republic, Germany every year");
  });
  it("leaves public holidays and Christmas/Easter-family titles to the holiday adapters; remembrance days become culture", () => {
    expect(byQid("Q51638")).toHaveLength(0); // Feast of the Ascension (public holiday class)
    expect(byQid("Q1254268")).toHaveLength(0); // Duanwu Festival (public holiday class)
    expect(byQid("Q1009535")).toHaveLength(0); // Culture Day (JP public holiday)
    expect(byQid("Q31600")).toHaveLength(0); // "Christmas in Poland"
    expect(byQid("Q11590237")).toHaveLength(0); // "Wikipedia:Justin Knapp Day"
    expect(skips.holidayOwned).toBe(4);
    expect(skips.noLabel).toBe(1);
    const roma = byQid("Q4025954")[0];
    expect(roma.category).toBe("culture");
    expect(roma.tags).toEqual(["remembrance", "observance", "wikidata"]);
    expect(byQid("Q1050292")).toHaveLength(0); // tsukimi: lunar rule vs two fixed days → conflict
    expect(skips.conflict).toHaveLength(1);
  });
  it("categoryFor: public-holiday class → null even for fun labels; holiday family → null; remembrance → culture", () => {
    expect(categoryFor("p837", "Some Fun Day", new Set(["Q1197685"]))).toBeNull();
    expect(categoryFor("p837", "Christmas Eve", new Set(["Q1445650"]))).toBeNull();
    expect(categoryFor("p837", "Armistice Day", new Set(["Q1445650"]))?.category).toBe("culture");
    expect(categoryFor("p837", "World Backup Day", new Set(["Q422695"]))).toEqual({ category: "fun", tags: ["awareness-day"] });
    expect(categoryFor("q2558684", "World Oceans Day", new Set())?.category).toBe("nature");
    expect(categoryFor("q2558684", "World Wildlife Day", new Set())?.category).toBe("nature");
    expect(categoryFor("q57598", "Bastille Day", new Set())?.category).toBe("national");
  });
});

describe("overrides, images and helpers", () => {
  it("override rows carry their QID key, curated sentence + computed sentence, and never collide with harvested items", () => {
    const rows = overrideRows(NOW, YEARS);
    for (const r of rows) expect(IngestEventSchema.safeParse(r).success, r.source_key).toBe(true);
    const saad = rows.filter((r) => r.source_key.startsWith("observances:Q310776:"));
    expect(saad.map((r) => r.date)).toEqual(["2027-07-30", "2028-07-28"]); // last Friday in July
    expect(saad[0].description.startsWith("A day to thank the people")).toBe(true);
    expect(saad[0].description.endsWith("In 2027 it falls on Friday, 30 July 2027.")).toBe(true);
    const pizza = rows.find((r) => r.title === "National Pizza Day")!;
    expect(pizza.source_key).toBe("observances:x-national-pizza-day:2027");
    expect(pizza.regions).toEqual(["US"]);
    expect(pizza.external_ids).toEqual({});
    expect(pizza.description).toContain("National Pizza Day is observed in the United States every year on February 9.");
    expect(rows.every((r) => r.popularity <= 35)).toBe(true);
    // Items with a usable P837 are harvested, never overridden (Talk Like a Pirate Day Q37669 has P837 = Q2896).
    expect(OVERRIDE_QIDS.has("Q37669")).toBe(false);
    expect(rows.some((r) => r.title === "International Talk Like a Pirate Day")).toBe(false);
    // A harvested binding for an override QID is dropped (the override wins).
    const b: SparqlBinding = {
      item: { type: "uri", value: "http://www.wikidata.org/entity/Q310776" },
      itemLabel: { type: "literal", value: "System Administrator Appreciation Day" },
      day: { type: "uri", value: "http://www.wikidata.org/entity/Q1" },
      dayLabel: { type: "literal", value: "July 31" },
      rank: { type: "uri", value: "http://wikiba.se/ontology#NormalRank" },
    };
    const skips = emptySkips();
    expect(bindingsToEvents([b], "p837", NOW, skips, YEARS)).toHaveLength(0);
    expect(skips.overridden).toBe(1);
    // One-off editions with a P837 date are not recurring observances.
    const oneOff: SparqlBinding = { ...b, item: { type: "uri", value: "http://www.wikidata.org/entity/Q77" }, itemLabel: { type: "literal", value: "100th Anniversary of the Republic of Turkey" } };
    expect(bindingsToEvents([oneOff], "p837", NOW, skips, YEARS)).toHaveLength(0);
    expect(skips.noLabel).toBe(1);
    expect(OBSERVANCE_OVERRIDES.every((o) => o.qid || o.key)).toBe(true);
  });
  it("image candidates: raster only, alphabetically first, Special:FilePath + File: page", () => {
    expect(commonsFileName("http://commons.wikimedia.org/wiki/Special:FilePath/Whd-poster-final-a1.png")).toBe("Whd-poster-final-a1.png");
    expect(pickImage(["http://commons.wikimedia.org/wiki/Special:FilePath/x.pdf", "http://commons.wikimedia.org/wiki/Special:FilePath/y.svg"])).toBeNull();
    expect(pickImage(["http://commons.wikimedia.org/wiki/Special:FilePath/b%20c.JPG", "http://commons.wikimedia.org/wiki/Special:FilePath/a.webp"])).toEqual({
      url: "https://commons.wikimedia.org/wiki/Special:FilePath/a.webp",
      meta: { provider: "commons", pageUrl: "https://commons.wikimedia.org/wiki/File:a.webp" },
    });
  });
  it("proseCountryName: article for the countries that take one, plain names otherwise", () => {
    expect(proseCountryName("US")).toBe("the United States");
    expect(proseCountryName("GB")).toBe("the United Kingdom");
    expect(proseCountryName("NL")).toBe("the Netherlands");
    expect(proseCountryName("PH")).toBe("the Philippines");
    expect(proseCountryName("AE")).toBe("the United Arab Emirates");
    expect(proseCountryName("CZ")).toBe("the Czech Republic");
    expect(proseCountryName("KY")).toBe("the Cayman Islands");
    expect(proseCountryName("CD")).toBe("the Democratic Republic of the Congo");
    expect(proseCountryName("JP")).toBe("Japan");
    expect(proseCountryName("VA")).toBe("Vatican City");
    expect(proseCountryName("ZZ")).toBe("ZZ");
  });
  it("resolveRule: same rule from several country statements unions the codes", () => {
    const mk = (label: string, iso: string): SparqlBinding => ({
      item: { type: "uri", value: "http://www.wikidata.org/entity/Q9" },
      itemLabel: { type: "literal", value: "Twin Day" },
      day: { type: "uri", value: `http://www.wikidata.org/entity/Q${iso.charCodeAt(0)}` },
      dayLabel: { type: "literal", value: label },
      rank: { type: "uri", value: "http://wikiba.se/ontology#NormalRank" },
      stIso: { type: "literal", value: iso },
    });
    const item = groupBindings([mk("May 1", "FR"), mk("May 1", "DE")]).get("Q9")!;
    const res = resolveRule(item);
    expect(res.ok && [...res.value.stIsos].sort()).toEqual(["DE", "FR"]);
  });
});

describe("query and cursor", () => {
  it("query is keyset-paged on STR(?item), label-service free, and excludes public holidays from the long tail", () => {
    const q = buildObservancesQuery("q2558684", null);
    expect(q).toContain("wdt:P31 wd:Q2558684");
    expect(q).toContain("ORDER BY STR(?item)");
    expect(q).toContain(`LIMIT ${PAGE_ITEMS}`);
    expect(q).not.toContain("SERVICE wikibase:label");
    expect(q).toContain('FILTER(LANG(?itemLabel) = "en")');
    expect(q).not.toContain("FILTER(STR(?item) >");
    expect(buildObservancesQuery("q57598", "Q123")).toContain('FILTER(STR(?item) > "http://www.wikidata.org/entity/Q123")');
    expect(buildObservancesQuery("q57598", null)).toContain("wdt:P31/wdt:P279* wd:Q57598");
    const fun = buildObservancesQuery("p837", null);
    expect(fun).toContain("VALUES ?t { wd:Q422695 wd:Q1445650 wd:Q136624236 }");
    expect(fun).toContain("FILTER NOT EXISTS { ?item wdt:P31 wd:Q1197685 }");
    expect(fun).toContain("FILTER NOT EXISTS { ?item wdt:P31 wd:Q2558684 }");
    expect(fun).toContain("schema:isPartOf <https://en.wikipedia.org/>");
    expect(fun).toContain("?item wdt:P31 ?type");
  });
  it("parseCursor tolerates foreign shapes", () => {
    expect(parseCursor(null)).toEqual({ kind: "overrides", afterQid: null, page: 0 });
    expect(parseCursor({ i: 2, page: 1 })).toEqual({ kind: "overrides", afterQid: null, page: 0 });
    expect(parseCursor({ kind: "p837", afterQid: "Q42", page: 3 })).toEqual({ kind: "p837", afterQid: "Q42", page: 3 });
    expect(parseCursor({ kind: "p837", afterQid: "not-a-qid" })).toEqual({ kind: "p837", afterQid: null, page: 0 });
    expect(parseCursor({ kind: "end" })).toBe("end");
    expect(KINDS[0]).toBe("overrides");
  });
  it("`after` is content-addressed: last QID of a full page, next kind on a short page, end after p837", async () => {
    const ctxFor = (items: number): IngestContext => ({
      http: {
        fetchJson: async <T,>() =>
          ({
            results: {
              bindings: Array.from({ length: items }, (_, i) => ({
                item: { type: "uri", value: `http://www.wikidata.org/entity/Q${String(1000 + i)}` },
              })),
            },
          }) as T,
        fetchText: async () => "",
      },
      log: { info() {}, warn() {}, error() {} },
      now: NOW,
      budget: { remainingMs: () => 60_000 },
      dryRun: true,
    });
    const first = await adapter.plan(null, ctxFor(0));
    expect(first.units[0].kind).toBe("overrides");
    expect(first.units[0].key).toBe("observances:overrides:start");
    const overrides = await adapter.run(first.units[0], ctxFor(0));
    expect(overrides.length).toBeGreaterThan(5);
    expect(first.units[0].after).toEqual({ kind: "q2558684", afterQid: null, page: 0 });

    const full = await adapter.plan({ kind: "q2558684", afterQid: null, page: 0 }, ctxFor(PAGE_ITEMS));
    expect(full.units[0].key).toBe("observances:q2558684:start");
    await adapter.run(full.units[0], ctxFor(PAGE_ITEMS));
    expect(full.units[0].after).toEqual({ kind: "q2558684", afterQid: `Q${1000 + PAGE_ITEMS - 1}`, page: 1 });
    expect(full.nextCursor).toEqual(full.units[0].after);

    const short = await adapter.plan({ kind: "q2558684", afterQid: "Q1249", page: 1 }, ctxFor(5));
    expect(short.units[0].key).toBe("observances:q2558684:Q1249");
    await adapter.run(short.units[0], ctxFor(5));
    expect(short.units[0].after).toEqual({ kind: "q57598", afterQid: null, page: 0 });

    const last = await adapter.plan({ kind: "p837", afterQid: "Q7", page: 3 }, ctxFor(0));
    await adapter.run(last.units[0], ctxFor(0));
    expect(last.units[0].after).toEqual({ kind: "end" });
    const done = await adapter.plan({ kind: "end" }, ctxFor(0));
    expect(done).toEqual({ units: [], done: true });
    // Page cap: a runaway kind moves on instead of looping.
    const capped = await adapter.plan({ kind: "q57598", afterQid: "Q1", page: 99 }, ctxFor(0));
    expect(capped.units[0].kind).toBe("p837");
  });
  it("a unit whose fetch fails reports its own cursor as `after` (the runner re-plans the same page)", async () => {
    const failing: IngestContext = {
      http: {
        fetchJson: async () => {
          throw new Error("WDQS 504");
        },
        fetchText: async () => "",
      },
      log: { info() {}, warn() {}, error() {} },
      now: NOW,
      budget: { remainingMs: () => 60_000 },
      dryRun: true,
    };
    const input = { kind: "q2558684", afterQid: "Q210016", page: 1 } as const;
    const plan = await adapter.plan(input, failing);
    expect(plan.units[0].after).toEqual(input); // before run(): nothing fetched yet
    await expect(adapter.run(plan.units[0], failing)).rejects.toThrow("WDQS 504");
    expect(plan.units[0].after).toEqual(input);
    expect(plan.nextCursor).toEqual(input);
    // A fresh first page that fails resumes at the same first page, not at the next kind.
    const first = await adapter.plan({ kind: "p837", afterQid: null, page: 0 }, failing);
    await expect(adapter.run(first.units[0], failing)).rejects.toThrow();
    expect(first.units[0].after).toEqual({ kind: "p837", afterQid: null, page: 0 });
  });
  it("adapter metadata matches the brief", () => {
    expect(adapter.id).toBe("observances");
    expect(adapter.rank).toBe(6);
    expect(adapter.cadence).toBe("monthly");
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.limits).toEqual({ concurrency: 1, minIntervalMs: 5000, timeoutMs: 65_000, maxRetries: 3 });
  });
});
