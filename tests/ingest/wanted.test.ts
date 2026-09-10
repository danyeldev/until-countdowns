import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  adapter,
  aggregateQueries,
  createWantedAdapter,
  isConfigured,
  MAX_REQUESTS_PER_UNIT,
  parseCursor,
  planUnits,
  type WantedCandidate,
  type WantedUnit,
} from "@/lib/ingest/sources/wanted";
import type { WantedDb } from "@/lib/ingest/sources/wanted/db";
import {
  buildWantedEvent,
  categoryFor,
  COUNTRY_ISO,
  FALLTHROUGH_REASONS,
  futureDate,
  normalizeQuery,
  POPULARITY_CAP,
  readEntity,
  searchHash,
  topQidsFromSearch,
  wikipediaSearchUrl,
  type Resolved,
} from "@/lib/ingest/sources/wanted/resolve";
import type { WdEntity } from "@/lib/ingest/sources/wikipedia-categories/wikidata";
import { IngestEventSchema, type IngestContext, type IngestEvent } from "@/lib/ingest/types";

const NOW = new Date("2026-09-09T12:00:00Z");
const DAY = "2026-09-09";
const FIX = new URL("../fixtures/wanted/", import.meta.url);
const json = (name: string) => JSON.parse(readFileSync(new URL(name, FIX), "utf8"));
const searches: Record<string, unknown> = {
  "eurovision 2027": json("search-eurovision-2027.json"),
  "melodifestivalen 2027": json("search-melodifestivalen-2027.json"),
  "super bowl 2027": json("search-super-bowl-2027.json"),
  apophis: json("search-apophis.json"),
  "next total solar eclipse": json("search-next-total-solar-eclipse.json"),
};
const wbsearchHit = json("wbsearchentities-eurovision-2027.json");
const wbsearchMiss = json("wbsearchentities-miss.json");
const entities = json("wbgetentities.json");
const p297 = json("wbgetclaims-P297.json");

type Logged = { infos: string[]; warns: string[] };

/** Fixture-backed `ctx.http`; `wpEmpty` makes Wikipedia return no hits so the Wikibase fallback is exercised. */
function fixtureCtx(calls: string[] = [], opts: { wpEmpty?: boolean; logged?: Logged } = {}): IngestContext {
  const fetchJson = async <T,>(url: string): Promise<T> => {
    calls.push(url);
    const u = new URL(url);
    const q = u.searchParams;
    if (u.host === "en.wikipedia.org" && q.get("generator") === "search") {
      if (opts.wpEmpty) return { batchcomplete: true } as T;
      return (searches[q.get("gsrsearch")!] ?? { batchcomplete: true }) as T;
    }
    if (q.get("action") === "wbsearchentities") return (q.get("search") === "eurovision 2027" ? wbsearchHit : wbsearchMiss) as T;
    if (q.get("action") === "wbgetentities") {
      const ids = q.get("ids")!.split("|");
      return { entities: Object.fromEntries(ids.map((id) => [id, entities.entities[id] ?? { id, missing: "" }])) } as T;
    }
    if (q.get("action") === "wbgetclaims") return (p297[q.get("entity")!] ?? { claims: {} }) as T;
    throw new Error(`unexpected url ${url}`);
  };
  return {
    http: { fetchJson, fetchText: async () => "" },
    log: {
      info: (m) => opts.logged?.infos.push(m),
      warn: (m) => opts.logged?.warns.push(m),
      error() {},
    },
    now: NOW,
    budget: { remainingMs: () => 60_000 },
    dryRun: true,
  };
}

function fakeDb(opts: { rows?: string[]; found?: string[]; existing?: string[]; calls?: string[] } = {}): WantedDb {
  const found = new Set(opts.found ?? []);
  const existing = new Set(opts.existing ?? []);
  return {
    async zeroResultQueries() {
      opts.calls?.push("zeroResultQueries");
      return opts.rows ?? [];
    },
    async hasResults(q) {
      opts.calls?.push(`hasResults:${q}`);
      return found.has(q);
    },
    async existingQids(qids) {
      opts.calls?.push(`existingQids:${qids.join("|")}`);
      return new Set(qids.filter((id) => existing.has(id)));
    },
  };
}

const cand = (q: string, n: number): WantedCandidate => ({ q, n, hash: searchHash(q) });
const unitOf = (queries: WantedCandidate[], tried = {}): WantedUnit => planUnits(queries, tried, DAY, queries.length)[0];

const brief = (r: IngestEvent) => ({
  source_key: r.source_key,
  slug: r.slug,
  title: r.title,
  date: r.date,
  date_precision: r.date_precision,
  status: r.status,
  category: r.category,
  tags: r.tags,
  regions: r.regions,
  popularity: r.popularity,
  confidence: r.confidence,
  external_ids: r.external_ids,
});

describe("wanted adapter", () => {
  it("is registered with the fixed id, rank 1 and Wikimedia-friendly limits", () => {
    expect(adapter.id).toBe("wanted");
    expect(adapter.rank).toBe(1);
    expect(adapter.cadence).toBe("daily");
    expect(adapter.limits).toEqual({ concurrency: 1, minIntervalMs: 500, timeoutMs: 20_000, maxRetries: 2 });
    expect(isConfigured({})).toBe(false);
    expect(isConfigured({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", SUPABASE_SECRET_KEY: "k" })).toBe(true);
  });

  it("aggregateQueries: groups normalised text, applies the ≥ 3 threshold, length bounds and the tried map", () => {
    const rows = [
      "Eurovision 2027",
      "eurovision  2027 ",
      "EUROVISION 2027",
      "super bowl 2027",
      "super bowl 2027",
      "super bowl 2027",
      "super bowl 2027",
      "apophis",
      "apophis",
      "ab", // too short
      "ab",
      "ab",
      "x".repeat(81), // too long
      "x".repeat(81),
      "x".repeat(81),
      "olympics 2028",
      "olympics 2028",
      "olympics 2028",
    ];
    const tried = { [searchHash("olympics 2028")]: DAY };
    const out = aggregateQueries(rows, tried);
    expect(out.map((c) => [c.q, c.n])).toEqual([
      ["super bowl 2027", 4],
      ["eurovision 2027", 3],
    ]);
    expect(out[0].hash).toMatch(/^[0-9a-f]{40}$/);
    expect(normalizeQuery("  Eurovision\t2027 ")).toBe("eurovision 2027");
    expect(aggregateQueries(Array(30).fill("a"), {}, 1)).toHaveLength(0);
  });

  it("planUnits: content-addressed keys and a cumulative `after` built from what was attempted", () => {
    const cands = Array.from({ length: 12 }, (_, i) => cand(`query number ${i}`, 12 - i));
    const tried = { [searchHash("older miss")]: "2026-08-20" };
    const units = planUnits(cands, tried, DAY);
    expect(units).toHaveLength(3);
    expect(units.map((u) => u.queries.length)).toEqual([5, 5, 2]);
    expect(units[0].key).toBe(`wanted:${DAY}:${cands[0].hash.slice(0, 12)}`);
    expect(units[1].key).toBe(`wanted:${DAY}:${cands[5].hash.slice(0, 12)}`);
    expect(units[0].key).not.toMatch(/:\d+$/); // never a bare index
    // Nothing attempted yet: the cursor only carries the inherited map.
    expect(units[1].after).toEqual({ tried });
    units[0].attempted.push(cands[0].hash, cands[1].hash);
    units[1].attempted.push(cands[5].hash);
    expect(units[1].after).toEqual({ tried: { ...tried, [cands[0].hash]: DAY, [cands[1].hash]: DAY, [cands[5].hash]: DAY } });
    expect(units[0].after).toEqual({ tried: { ...tried, [cands[0].hash]: DAY, [cands[1].hash]: DAY } });
  });

  it("parseCursor: keeps hashes tried within 30 days, drops older ones and junk", () => {
    const fresh = searchHash("fresh");
    const stale = searchHash("stale");
    const cursor = { tried: { [fresh]: "2026-08-15", [stale]: "2026-08-01", "not-a-hash": DAY, [searchHash("x")]: 42 } };
    expect(parseCursor(cursor, NOW)).toEqual({ [fresh]: "2026-08-15" });
    expect(parseCursor(null, NOW)).toEqual({});
    expect(parseCursor([1, 2], NOW)).toEqual({});
    expect(parseCursor({ i: 3 }, NOW)).toEqual({});
  });

  it("plan(): reads search_log and returns one done plan of ≤ 25 candidates in units of 5", async () => {
    const rows = [...Array(4).fill("super bowl 2027"), ...Array(3).fill("eurovision 2027"), ...Array(2).fill("apophis")];
    const calls: string[] = [];
    const a = createWantedAdapter({ db: fakeDb({ rows, calls }) });
    const logged: Logged = { infos: [], warns: [] };
    const plan = await a.plan(null, fixtureCtx([], { logged }));
    expect(calls).toEqual(["zeroResultQueries"]);
    expect(plan.done).toBe(true);
    expect(plan.units).toHaveLength(1);
    expect(plan.units[0].queries.map((c) => [c.q, c.n])).toEqual([
      ["super bowl 2027", 4],
      ["eurovision 2027", 3],
    ]);
    expect(logged.infos[0]).toContain("2 candidate queries");
    const again = await a.plan({ tried: { [searchHash("super bowl 2027")]: DAY } }, fixtureCtx());
    expect(again.units[0].queries.map((c) => c.q)).toEqual(["eurovision 2027"]);
  });

  it("run(): resolves fixtures into tentative 0.5-confidence rows, stable across two calls", async () => {
    const queries = [cand("eurovision 2027", 5), cand("melodifestivalen 2027", 4), cand("super bowl 2027", 3), cand("apophis", 3), cand("no such thing xyz", 3)];
    const a = createWantedAdapter({ db: fakeDb() });
    const calls: string[] = [];
    const logged: Logged = { infos: [], warns: [] };
    const unit = unitOf(queries);
    const rows = await a.run(unit, fixtureCtx(calls, { logged }));

    for (const r of rows) expect(IngestEventSchema.safeParse(r).success, JSON.stringify(IngestEventSchema.safeParse(r))).toBe(true);
    expect(rows.map(brief)).toEqual([
      {
        source_key: "wanted:Q140349740",
        slug: "melodifestivalen-2027-2027-01-01",
        title: "Melodifestivalen 2027",
        date: "2027-01-01",
        date_precision: "year",
        status: "tentative",
        category: "culture",
        tags: ["wanted"],
        regions: ["SE"],
        popularity: 29,
        confidence: 0.5,
        external_ids: { enwiki: "Melodifestivalen 2027", qid: "Q140349740", search_hash: searchHash("melodifestivalen 2027") },
      },
      {
        source_key: "wanted:Q123819436",
        slug: "super-bowl-lxi-2027-02-14",
        title: "Super Bowl LXI",
        date: "2027-02-14",
        date_precision: "day",
        status: "tentative",
        category: "sports",
        tags: ["sports", "wanted"],
        regions: ["US"],
        popularity: 28,
        confidence: 0.5,
        external_ids: { enwiki: "Super Bowl LXI", qid: "Q123819436", search_hash: searchHash("super bowl 2027") },
      },
    ]);
    for (const r of rows) {
      expect(r.featured).toBe(false);
      expect(r.jsonld_eligible).toBe(false);
      expect(r.image_candidate_url).toBeNull();
      expect(r.description).toBe("");
      expect(r.source_url).toBe(`https://www.wikidata.org/wiki/${r.external_ids.qid}`);
      expect(r.all_day).toBe(true);
      expect(r.timezone).toBeNull();
      // The query text never reaches the row.
      expect(JSON.stringify(r)).not.toMatch(/super bowl 2027|melodifestivalen 2027/);
    }
    // Every query was attempted (the Eurovision item fails the label-year check, both Apophis hits
    // have no future date, the last one resolves nowhere) and the cursor remembers all five.
    expect(unit.attempted).toEqual(queries.map((c) => c.hash));
    expect(unit.after).toEqual({ tried: Object.fromEntries(queries.map((c) => [c.hash, DAY])) });
    expect(logged.infos.at(-1)).toContain("rejected: 1 label-year, 2 no-future-date");
    expect(logged.infos.at(-1)).toContain("1 unresolved");

    // Requests: 5 searches + 1 Wikibase fallback (no article for the last query) + 1 wbgetentities
    // carrying every candidate hit (3 per query); both countries come from the seed map, so no
    // wbgetclaims. 7 requests, well under the 16-request cap.
    const actions = calls.map((u) => new URL(u).searchParams.get(new URL(u).host.startsWith("en.") ? "generator" : "action"));
    expect(actions).toEqual(["search", "search", "search", "search", "search", "wbsearchentities", "wbgetentities"]);
    expect(calls[0]).toBe(wikipediaSearchUrl("eurovision 2027"));
    const entityCall = new URL(calls.at(-1)!).searchParams;
    expect(entityCall.get("ids")!.split("|").sort()).toEqual([
      "Q118931",
      "Q123819436",
      "Q124526678",
      "Q132877730",
      "Q140349740",
      "Q190511",
      "Q37276325",
      "Q72986",
      "Q909800",
    ]);
    expect(calls).toHaveLength(7);
    expect(entityCall.get("sitefilter")).toBe("enwiki");

    const second = await a.run(unitOf(queries), fixtureCtx());
    expect(second.map((r) => r.source_key)).toEqual(rows.map((r) => r.source_key));
    expect(second.map((r) => r.content_hash)).toEqual(rows.map((r) => r.content_hash));
  });

  it("run(): skips queries that now return results and QIDs already catalogued", async () => {
    const queries = [cand("super bowl 2027", 3), cand("melodifestivalen 2027", 3)];
    const dbCalls: string[] = [];
    const calls: string[] = [];
    const a = createWantedAdapter({ db: fakeDb({ found: ["super bowl 2027"], existing: ["Q140349740"], calls: dbCalls }) });
    const unit = unitOf(queries);
    const rows = await a.run(unit, fixtureCtx(calls));
    expect(rows).toEqual([]);
    expect(unit.attempted).toEqual(queries.map((c) => c.hash)); // both are settled for 30 days
    expect(dbCalls).toEqual([
      "hasResults:super bowl 2027",
      "hasResults:melodifestivalen 2027",
      "existingQids:Q140349740|Q132877730|Q72986",
    ]);
    // One search only: the catalogued hit ends the walk, so the lower hits are never fetched.
    expect(calls).toEqual([wikipediaSearchUrl("melodifestivalen 2027")]);
  });

  it("run(): falls back to wbsearchentities when Wikipedia has no article, and the label-year check still guards", async () => {
    const calls: string[] = [];
    const logged: Logged = { infos: [], warns: [] };
    const a = createWantedAdapter({ db: fakeDb() });
    const rows = await a.run(unitOf([cand("eurovision 2027", 6)]), fixtureCtx(calls, { wpEmpty: true, logged }));
    expect(rows).toEqual([]);
    expect(calls.map((u) => new URL(u).searchParams.get("action"))).toEqual(["query", "wbsearchentities", "wbgetentities"]);
    expect(new URL(calls[2]).searchParams.get("ids")).toBe("Q132877730");
    expect(logged.infos.at(-1)).toContain("rejected: 1 label-year");
  });

  it("run(): stops at the per-unit request cap and leaves the rest untried", async () => {
    // 10 queries; the first now returns results (0 requests), the next 8 cost 2 requests each
    // (Wikipedia search + Wikibase fallback) and exhaust the 16-request cap, so 1 is left over.
    const queries = Array.from({ length: 10 }, (_, i) => cand(`unknown thing ${i}`, 3));
    const calls: string[] = [];
    const logged: Logged = { infos: [], warns: [] };
    const a = createWantedAdapter({ db: fakeDb({ found: [queries[0].q] }) });
    const unit = unitOf(queries);
    const rows = await a.run(unit, fixtureCtx(calls, { wpEmpty: true, logged }));
    expect(rows).toEqual([]);
    expect(MAX_REQUESTS_PER_UNIT).toBe(16);
    expect(calls).toHaveLength(MAX_REQUESTS_PER_UNIT);
    expect(unit.attempted).toHaveLength(9);
    expect((unit.after as { tried: Record<string, string> }).tried).not.toHaveProperty(queries[9].hash);
    // The "left for the next pass" count must not double-subtract the now-found query.
    expect(logged.warns.find((w) => w.includes("request cap"))).toContain("1 quer(y/ies) left");
    expect(logged.infos.at(-1)).toContain("1 now found");
  });

  it("topQidsFromSearch: rank order, disambiguation and item-less pages skipped, capped at 3", () => {
    // Apophis: hit 3 is the disambiguation page and is dropped, so only two candidates survive.
    expect(topQidsFromSearch(searches.apophis as never)).toEqual([
      { qid: "Q190511", title: "Apophis" },
      { qid: "Q118931", title: "99942 Apophis" },
    ]);
    expect(topQidsFromSearch(searches["eurovision 2027"] as never).map((h) => h.qid)).toEqual(["Q132877730", "Q140349740", "Q37276325"]);
    expect(topQidsFromSearch(searches["eurovision 2027"] as never, 1).map((h) => h.qid)).toEqual(["Q132877730"]);
    expect(
      topQidsFromSearch({ query: { pages: [{ title: "No item", index: 1 }, { title: "Has item", index: 2, pageprops: { wikibase_item: "Q1" } }] } }),
    ).toEqual([{ qid: "Q1", title: "Has item" }]);
    expect(topQidsFromSearch({})).toEqual([]);
  });

  it("run(): walks lower search hits when the top ones are stale, but never past a label-year rejection", async () => {
    const a = createWantedAdapter({ db: fakeDb() });
    // "next total solar eclipse" ranks two PAST eclipses above the next one (live, 2026-09-09).
    // Hits 1 and 2 are rejected `no-future-date`, so hit 3 is taken.
    const logged: Logged = { infos: [], warns: [] };
    const calls: string[] = [];
    const rows = await a.run(unitOf([cand("next total solar eclipse", 7)]), fixtureCtx(calls, { logged }));
    expect(rows.map(brief)).toEqual([
      {
        source_key: "wanted:Q3577554",
        slug: "solar-eclipse-of-august-2-2027-2027-08-02",
        title: "solar eclipse of August 2, 2027",
        date: "2027-08-02",
        date_precision: "day",
        status: "tentative",
        category: "astronomy",
        tags: ["sky", "wanted"],
        regions: ["EG"],
        popularity: 32,
        confidence: 0.5,
        external_ids: { enwiki: "Solar eclipse of August 2, 2027", qid: "Q3577554", search_hash: searchHash("next total solar eclipse") },
      },
    ]);
    expect(IngestEventSchema.safeParse(rows[0]).success).toBe(true);
    expect(logged.infos.at(-1)).toContain("rejected: 2 no-future-date");
    // Still one Wikipedia search + one wbgetentities: the extra hits cost no extra requests.
    expect(calls).toHaveLength(2);

    // "eurovision 2027": hit 1 is the right item with an inconsistent label (label-year). Hit 2 is
    // "Melodifestivalen 2027", which WOULD resolve — the walk must stop rather than take it.
    const logged2: Logged = { infos: [], warns: [] };
    const wrong = await a.run(unitOf([cand("eurovision 2027", 7)]), fixtureCtx([], { logged: logged2 }));
    expect(wrong).toEqual([]);
    expect(logged2.infos.at(-1)).toContain("rejected: 1 label-year");
    expect(logged2.infos.at(-1)).not.toContain("no-future-date");
    expect([...FALLTHROUGH_REASONS].sort()).toEqual(["missing", "no-enwiki", "no-future-date", "no-label"]);
  });

  it("popularity is clamped to the §0 cap of 35 even though the brief's formula reaches 45", () => {
    const r: Resolved = {
      qid: "Q1",
      label: "Some Thing 2027",
      enwiki: "Some Thing 2027",
      prop: "P585",
      time: { day: "2027-05-05", precision: "day" },
      rawTime: "+2027-05-05T00:00:00Z",
      p31: [],
      p17: [],
    };
    const pop = (n: number) => buildWantedEvent(r, { n, hash: searchHash("x"), regions: [] }).popularity;
    expect(POPULARITY_CAP).toBe(35);
    expect(pop(3)).toBe(28);
    expect(pop(10)).toBe(35);
    expect(pop(20)).toBe(35); // the brief's 25 + min(20, n) would be 45 and would queue enrichment
    expect(pop(5000)).toBe(35);
    // No region resolved → GLOBAL, and the provenance tag is always present.
    expect(buildWantedEvent(r, { n: 3, hash: searchHash("x"), regions: [] }).regions).toEqual(["GLOBAL"]);
    expect(buildWantedEvent(r, { n: 3, hash: searchHash("x"), regions: [] }).tags).toEqual(["wanted"]);
    // classify() disagrees with the P31-resolved category (a "memorial" launch) → its tags are dropped.
    const space: Resolved = { ...r, label: "Memorial Spaceflight 2027", prop: "P619" };
    expect(buildWantedEvent(space, { n: 3, hash: "h", regions: [] }).category).toBe("space");
    expect(buildWantedEvent(space, { n: 3, hash: "h", regions: [] }).tags).toEqual(["wanted"]);
  });

  it("COUNTRY_ISO: 186 verified sovereign-state entries, all well-formed and unique", () => {
    const entries = Object.entries(COUNTRY_ISO);
    expect(entries).toHaveLength(186);
    for (const [qid, iso] of entries) {
      expect(qid).toMatch(/^Q\d+$/);
      expect(iso).toMatch(/^[A-Z]{2}$/);
    }
    expect(new Set(Object.values(COUNTRY_ISO)).size).toBe(186);
    expect(COUNTRY_ISO.Q30).toBe("US");
    expect(COUNTRY_ISO.Q79).toBe("EG");
  });

  it("readEntity / futureDate: precision, rank and horizon rules", () => {
    const e = (claims: Record<string, unknown[]>, label = "Thing 2027"): WdEntity =>
      ({ id: "Q1", labels: { en: { language: "en", value: label } }, sitelinks: { enwiki: { site: "enwiki", title: label } }, claims }) as WdEntity;
    const time = (t: string, precision: number, rank = "normal") => ({
      mainsnak: { snaktype: "value", property: "P585", datavalue: { type: "time", value: { time: t, precision, calendarmodel: "http://www.wikidata.org/entity/Q1985727" } } },
      rank,
      type: "statement",
    });
    // Preferred rank wins over an older normal-rank date.
    const r = readEntity(e({ P585: [time("+2027-03-01T00:00:00Z", 11), time("+2027-06-10T00:00:00Z", 11, "preferred")] }), NOW);
    expect(r.ok && r.value.time).toEqual({ day: "2027-06-10", precision: "day" });
    // Past → no-future-date; decade → rejected; year placeholder of the current year is still live.
    expect(readEntity(e({ P585: [time("+2020-01-01T00:00:00Z", 11)] }), NOW)).toEqual({ ok: false, reason: "no-future-date" });
    expect(readEntity(e({ P585: [time("+2030-00-00T00:00:00Z", 8)] }), NOW)).toEqual({ ok: false, reason: "no-future-date" });
    expect(futureDate(e({ P577: [time("+2026-00-00T00:00:00Z", 9)] }), NOW)).toMatchObject({ prop: "P577", time: { day: "2026-01-01", precision: "year" } });
    // Beyond 15 years → dropped; P619 launch date → space.
    expect(futureDate(e({ P619: [time("+2045-01-01T00:00:00Z", 11)] }), NOW)).toBeNull();
    expect(categoryFor("Europa Clipper", [], "P619")).toBe("space");
    expect(categoryFor("Some election", [], "P585")).toBe("politics");
    expect(categoryFor("Whatever", ["Q7889"], "P577")).toBe("games");
    // Guards on identity.
    expect(readEntity(undefined, NOW)).toEqual({ ok: false, reason: "missing" });
    expect(readEntity({ ...e({ P585: [time("+2027-06-10T00:00:00Z", 11)] }), sitelinks: {} }, NOW)).toEqual({ ok: false, reason: "no-enwiki" });
    expect(readEntity(e({ P585: [time("+2027-06-10T00:00:00Z", 11)] }, "Q99"), NOW)).toEqual({ ok: false, reason: "bare-qid" });
    expect(readEntity(e({ P585: [time("+2027-06-10T00:00:00Z", 11)] }, "Thing 2028"), NOW)).toEqual({ ok: false, reason: "label-year" });
    // The recorded Eurovision item: label says 2028, sitelink and P585 say 2027.
    expect(readEntity(entities.entities.Q132877730, NOW)).toEqual({ ok: false, reason: "label-year" });
  });

  it("regions: P17 outside the seed map is resolved through one cached wbgetclaims call", async () => {
    const bermuda: WdEntity = {
      ...entities.entities.Q123819436,
      claims: {
        ...entities.entities.Q123819436.claims,
        P17: [{ mainsnak: { snaktype: "value", property: "P17", datavalue: { type: "wikibase-entityid", value: { id: "Q23635" } } }, rank: "normal", type: "statement" }],
      },
    };
    const calls: string[] = [];
    const ctx = fixtureCtx(calls);
    ctx.http.fetchJson = (async (url: string) => {
      if (url.includes("wbgetentities")) {
        calls.push(url);
        return { entities: { Q123819436: bermuda } };
      }
      return fixtureCtx(calls).http.fetchJson(url);
    }) as IngestContext["http"]["fetchJson"];
    const a = createWantedAdapter({ db: fakeDb() });
    const rows = await a.run(unitOf([cand("super bowl 2027", 3)]), ctx);
    expect(rows.map((r) => r.regions)).toEqual([["BM"]]);
    expect(calls.filter((u) => u.includes("wbgetclaims"))).toHaveLength(1);
    // Second run: the P297 lookup is memoised.
    const calls2: string[] = [];
    const ctx2 = fixtureCtx(calls2);
    ctx2.http.fetchJson = ctx.http.fetchJson;
    await a.run(unitOf([cand("super bowl 2027", 3)]), ctx2);
    expect(calls.filter((u) => u.includes("wbgetclaims"))).toHaveLength(1);
  });
});
