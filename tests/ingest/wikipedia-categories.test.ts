import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  adapter,
  categoryMeta,
  commonsImage,
  electionToEvent,
  INDEX_TITLE_RE,
  memberToEvent,
  parseCursor,
  planUnits,
  titleYearConsistent,
  type WcUnit,
} from "@/lib/ingest/sources/wikipedia-categories";
import { countryCode, normalizeCountryName } from "@/lib/ingest/sources/wikipedia-categories/countries";
import { electionTitle, parseElectoralCalendar, stripMarkup } from "@/lib/ingest/sources/wikipedia-categories/electoral";
import { eventDates, parseWdTime } from "@/lib/ingest/sources/wikipedia-categories/wikidata";
import { IngestEventSchema, type IngestContext, type IngestEvent } from "@/lib/ingest/types";

const NOW = new Date("2026-09-09T12:00:00Z");
const FIX = new URL("../fixtures/wikipedia-categories/", import.meta.url);
const json = (name: string) => JSON.parse(readFileSync(new URL(name, FIX), "utf8"));
const members = json("multisport-members.json");
const pageprops = json("pageprops-batch.json");
const entities = json("wbgetentities-dates.json");
const p297 = json("wbgetclaims-P297.json");
const labels = json("labels.json");
const ppElections = json("pageprops-elections.json");
const wikitext = readFileSync(new URL("electoral-2027.wikitext.txt", FIX), "utf8");

/** Fixture-backed `ctx.http`: routes each API URL to the recorded payload it would have produced. */
function fixtureCtx(calls: string[] = []): IngestContext {
  const fetchJson = async <T,>(url: string): Promise<T> => {
    calls.push(url);
    const u = new URL(url);
    const q = u.searchParams;
    if (q.get("list") === "categorymembers") {
      if (q.get("cmtype") === "subcat") return { query: { categorymembers: [{ pageid: 1, ns: 14, title: "Category:Scheduled multi-sport events" }] } } as T;
      return members as T;
    }
    if (q.get("action") === "parse") {
      if (q.get("page") === "2027 national electoral calendar") return { parse: { title: q.get("page"), wikitext } } as T;
      return { error: { code: "missingtitle", info: "The page you specified doesn't exist." } } as T;
    }
    if (q.get("prop")?.startsWith("pageprops")) return (q.has("pageids") ? pageprops : ppElections) as T;
    if (q.get("action") === "wbgetclaims") return (p297[q.get("entity")!] ?? { claims: {} }) as T;
    if (q.get("action") === "wbgetentities") {
      const src = q.get("props") === "labels" ? labels : entities;
      const ids = q.get("ids")!.split("|");
      return { entities: Object.fromEntries(ids.map((id) => [id, src.entities[id] ?? { id, missing: "" }])) } as T;
    }
    throw new Error(`unexpected url ${url}`);
  };
  return {
    http: { fetchJson, fetchText: async () => "" },
    log: { info() {}, warn() {}, error() {} },
    now: NOW,
    budget: { remainingMs: () => 60_000 },
    dryRun: true,
  };
}

const multisportUnit = (): WcUnit => ({
  kind: "cat",
  key: "cat:Scheduled_multi-sport_events",
  label: "Category:Scheduled multi-sport events",
  category: "Category:Scheduled multi-sport events",
  after: { phase: "cat", after: "Category:Scheduled multi-sport events" },
});
const electoralUnit = (year: number): WcUnit => ({ kind: "electoral", key: `electoral:${year}`, label: `${year}`, year, after: { phase: "electoral", after: year } });

const brief = (r: IngestEvent) => ({
  source_key: r.source_key,
  slug: r.slug,
  date: r.date,
  end_date: r.end_date,
  date_precision: r.date_precision,
  status: r.status,
  category: r.category,
  regions: r.regions,
  popularity: r.popularity,
  featured: r.featured,
  jsonld: r.jsonld_eligible,
  image: r.image_candidate_url,
});

describe("wikipedia-categories: category unit over fixtures", () => {
  it("emits validated rows with stable source_keys across two runs", async () => {
    const a = await adapter.run(multisportUnit(), fixtureCtx());
    const b = await adapter.run(multisportUnit(), fixtureCtx());
    expect(a.map((r) => r.source_key)).toEqual(b.map((r) => r.source_key));
    expect(a.map((r) => r.content_hash)).toEqual(b.map((r) => r.content_hash));
    for (const r of a) {
      const parsed = IngestEventSchema.safeParse(r);
      expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
      expect(r.source).toBe("wikipedia-categories");
      expect(r.tags).toContain("wikipedia-category");
    }
    expect(a.map(brief)).toMatchSnapshot();
  });

  it("maps P580/P582 day precision, hosts, venue, Commons image and marquee popularity", async () => {
    const rows = await adapter.run(multisportUnit(), fixtureCtx());
    const la = rows.find((r) => r.source_key === "wikipedia-categories:12695048")!;
    expect(la.title).toBe("2028 Summer Olympics");
    expect(la.slug).toBe("2028-summer-olympics-2028-07-14");
    expect(la.date).toBe("2028-07-14");
    expect(la.end_date).toBe("2028-07-30");
    expect(la.date_precision).toBe("day");
    expect(la.status).toBe("scheduled");
    expect(la.regions).toEqual(["US"]);
    expect(la.location).toEqual({ name: "Los Angeles", country: "United States", lat: 34.1, lng: -118.2 }); // Wikidata label of P17, not the date-holidays spelling
    expect(la.jsonld_eligible).toBe(true);
    expect(la.featured).toBe(true);
    expect(la.popularity).toBe(85);
    expect(la.confidence).toBe(0.85);
    expect(la.category).toBe("sports");
    expect(la.tags).toEqual(expect.arrayContaining(["sports", "wikipedia-category", "multi-sport"]));
    expect(la.external_ids).toEqual({ enwiki: "2028 Summer Olympics", enwiki_pageid: 12695048, qid: "Q1451505" });
    expect(la.source_url).toBe("https://en.wikipedia.org/wiki/2028_Summer_Olympics");
    expect(la.image_candidate_url).toBe("https://upload.wikimedia.org/wikipedia/commons/e/e8/2028_Summer_Olympics_Logo.svg");
    expect(la.image_candidate_meta).toEqual({ provider: "wikipedia", pageUrl: la.source_url, file: "2028_Summer_Olympics_Logo.svg" });
    expect(la.description.length).toBeGreaterThan(80);
    expect(la.description).toContain("in the United States");
    expect(la.description).not.toMatch(/\{\{|\[\[/);
    // a qualifier that carries the marquee name is not marquee
    const qual = memberToEvent(
      { page: { ...pageprops.query.pages[0], title: "2027 Rugby World Cup – Final Qualification Tournament" }, entity: entities.entities.Q55602686, regions: [], venueName: null, locationName: null, countryNames: [] },
      "Category:Scheduled sports events",
      NOW,
    )!;
    expect(qual.featured).toBe(false);
    expect(qual.popularity).toBe(40);
    expect(qual.regions).toEqual(["GLOBAL"]);
  });

  it("drops /wikipedia/en/ fair-use logos, bid pages and members without a resolvable date", async () => {
    const rows = await adapter.run(multisportUnit(), fixtureCtx());
    const asian = rows.find((r) => r.source_key === "wikipedia-categories:51790406")!; // 2026 Asian Games
    expect(asian.image_candidate_url).toBeNull();
    expect(asian.regions).toEqual(["JP"]);
    expect(asian.location).toEqual({ name: "Aichi Prefecture", country: "Japan" });
    expect(asian.end_date).toBe("2026-10-04");
    expect(rows.find((r) => /bids for/i.test(r.title))).toBeUndefined();
    expect(rows.find((r) => r.source_key === "wikipedia-categories:73463336")).toBeUndefined(); // Asian Para Games: no P580/P585
    const rugby = rows.find((r) => r.source_key === "wikipedia-categories:57615977")!;
    expect(rugby.location).toEqual({ name: "Australia", country: "Australia" });
    expect(rugby.regions).toEqual(["AU"]);
    expect(rugby.popularity).toBe(85);
    expect(rugby.jsonld_eligible).toBe(false); // location.name is the host-country fallback, not a P276 venue
  });

  it("keeps year-precision placeholders as tentative first-of-year rows; Youth Olympics are not marquee", async () => {
    const rows = await adapter.run(multisportUnit(), fixtureCtx());
    const youth = rows.find((r) => r.source_key === "wikipedia-categories:64557687")!;
    expect(youth.date).toBe("2026-01-01");
    expect(youth.date_precision).toBe("year");
    expect(youth.status).toBe("tentative");
    expect(youth.featured).toBe(false);
    expect(youth.popularity).toBe(40);
    expect(youth.regions).toEqual(["SN"]);
    const worldGames = rows.find((r) => r.source_key === "wikipedia-categories:83046654")!;
    expect(worldGames.date).toBe("2029-01-01");
    expect(worldGames.regions).toEqual(["DE"]);
    expect(worldGames.status).toBe("tentative");
    expect(worldGames.jsonld_eligible).toBe(false); // year-precision placeholder: no bookable date, no venue
    // every jsonld-eligible row is a day-precision, venue-bearing, scheduled event
    for (const r of rows.filter((x) => x.jsonld_eligible)) {
      expect(r.date_precision, r.source_key).toBe("day");
      expect(r.status, r.source_key).toBe("scheduled");
      expect(r.location?.name, r.source_key).toBeTruthy();
      expect(r.location?.name, r.source_key).not.toBe(r.location?.country);
    }
  });

  it("memberToEvent guards: label-year mismatch, past dates, missing QID", () => {
    const page = pageprops.query.pages.find((p: { title: string }) => p.title === "2028 Summer Olympics");
    const entity = entities.entities.Q1451505;
    const base = { page, entity, regions: ["US"], venueName: "Los Angeles", locationName: "Los Angeles", countryNames: ["United States"] };
    expect(memberToEvent(base, "Category:Scheduled multi-sport events", NOW)).not.toBeNull();
    expect(memberToEvent({ ...base, page: { ...page, title: "2027 Summer Olympics" } }, "Category:Scheduled multi-sport events", NOW)).toBeNull();
    expect(memberToEvent({ ...base, page: { ...page, pageprops: {} } }, "Category:Scheduled multi-sport events", NOW)).toBeNull();
    expect(memberToEvent(base, "Category:Scheduled multi-sport events", new Date("2028-08-15T00:00:00Z"))).toBeNull();
    const esports = memberToEvent(base, "Category:Scheduled esports events", NOW)!;
    expect(esports.category).toBe("esports");
    expect(esports.tags).toContain("esports");
  });
});

describe("wikipedia-categories: electoral calendar", () => {
  it("parses day-precision entries only, splits multi-election days and skips month-only/unknown lines", () => {
    const entries = parseElectoralCalendar(wikitext, 2027);
    const by = (a: string) => entries.find((e) => e.article === a);
    expect(by("2027 Nigerian general election")).toMatchObject({ date: "2027-01-16", country: "Nigeria", office: "President, Senate and House of Representatives" });
    expect(by("2027 Kyrgyz presidential election")).toMatchObject({ date: "2027-01-27", country: "Kyrgyzstan" });
    expect(by("2027 Salvadoran presidential election")?.date).toBe("2027-02-28");
    expect(by("2027 Salvadoran legislative election")?.date).toBe("2027-02-28");
    expect(by("2027 Micronesian general election")).toMatchObject({ date: "2027-03-02", country: "Micronesia" });
    expect(by("2027 Gambian parliamentary election")).toMatchObject({ date: "2027-04-10", country: "Gambia" });
    // "* 18 April:" followed by "** …" sub-items
    expect(by("2027 French presidential election")).toMatchObject({ date: "2027-04-18", country: "France", office: "President" });
    expect(by("2027 Finnish parliamentary election")).toMatchObject({ date: "2027-04-18", country: "Finland" });
    expect(by("2027 German presidential election")).toMatchObject({ date: "2027-01-30", country: "Germany" });
    // month-only and unknown-date entries carry no day
    expect(by("Next Estonian parliamentary election")).toBeUndefined();
    expect(by("2027 Somaliland parliamentary election")).toBeUndefined();
    expect(by("2027 Andorran parliamentary election")).toBeUndefined();
    expect(by("2027 Tajik presidential election")).toBeUndefined();
    expect(by("2026 Cameroonian parliamentary election")).toBeUndefined();
    expect(entries.every((e) => !/<ref|\{\{/.test(e.office))).toBe(true);
  });

  it("strips refs and templates; normalises 'Next …' titles and rejects foreign years", () => {
    expect(stripMarkup("[[A|B]]<ref>{{cite web|url=x}}</ref> and {{efn|note}} c")).toBe("[[A|B]] and c");
    expect(electionTitle("Next Swiss federal election", 2027)).toBe("2027 Swiss federal election");
    expect(electionTitle("2027 French presidential election", 2027)).toBe("2027 French presidential election");
    expect(electionTitle("2026 Cameroonian parliamentary election", 2027)).toBeNull();
    expect(countryCode("the Gambia")).toBe("GM");
    expect(countryCode("Niger")).toBe("NE");
    expect(countryCode("Nigeria")).toBe("NG");
    expect(countryCode("Oman")).toBe("OM");
    expect(countryCode("Micronesia")).toBe("FM");
    expect(countryCode("Republic of the Congo")).toBe("CG");
    expect(countryCode("Morocco")).toBe("MA");
    expect(countryCode("St. Kitts & Nevis")).toBe("KN");
    expect(countryCode("Atlantis")).toBeNull();
    expect(normalizeCountryName("Côte d’Ivoire")).toBe("cote d'ivoire");
  });

  it("runs the 2027 unit: politics rows, country regions, G20/presidential popularity, ids only for year-prefixed articles", async () => {
    const calls: string[] = [];
    const rows = await adapter.run(electoralUnit(2027), fixtureCtx(calls));
    for (const r of rows) expect(IngestEventSchema.safeParse(r).success).toBe(true);
    const again = await adapter.run(electoralUnit(2027), fixtureCtx());
    expect(rows.map((r) => r.source_key)).toEqual(again.map((r) => r.source_key));
    const fr = rows.find((r) => r.title === "2027 French presidential election")!;
    expect(fr.source_key).toBe("wikipedia-categories:elections:2027:2027-french-presidential-election");
    expect(fr.slug).toBe("2027-french-presidential-election-2027-04-18");
    expect(fr.category).toBe("politics");
    expect(fr.regions).toEqual(["FR"]);
    expect(fr.popularity).toBe(70);
    expect(fr.tags).toEqual(expect.arrayContaining(["elections", "election", "presidential", "wikipedia-category"]));
    expect(fr.external_ids).toEqual({ enwiki: "2027 French presidential election", enwiki_pageid: 72162761, qid: "Q111594692" });
    expect(fr.jsonld_eligible).toBe(false);
    expect(fr.date_precision).toBe("day");
    expect(fr.status).toBe("scheduled");
    const fi = rows.find((r) => r.title === "2027 Finnish parliamentary election")!;
    expect(fi.popularity).toBe(45);
    const ng = rows.find((r) => r.title === "2027 Nigerian general election")!;
    expect(ng.popularity).toBe(60);
    expect(ng.regions).toEqual(["NG"]);
    const de = rows.find((r) => r.title === "2027 German presidential election")!;
    expect(de.popularity).toBe(70);
    // pageprops lookup is only issued for year-prefixed titles (never "Next …", which redirects to the previous election)
    const pp = calls.filter((u) => u.includes("prop=pageprops"));
    expect(pp).toHaveLength(1);
    expect(decodeURIComponent(pp[0])).not.toContain("Next ");
    expect(rows.map(brief)).toMatchSnapshot();
  });

  it("links 'Next …' entries to the calendar, not to the previous election's article, and keeps multi-day spans", () => {
    // "Next Swiss federal election" redirects to the 2023 article, so it must not be the source_url
    const next = electionToEvent({ date: "2027-10-24", country: "Switzerland", article: "Next Swiss federal election", office: "Federal Assembly", italic: false }, 2027, NOW)!;
    expect(next.title).toBe("2027 Swiss federal election");
    expect(next.source_url).toBe("https://en.wikipedia.org/wiki/2027_national_electoral_calendar");
    expect(next.external_ids).toEqual({});
    expect(next.regions).toEqual(["CH"]);
    // a year-prefixed article still links itself
    const dated = electionToEvent({ date: "2027-04-18", country: "France", article: "2027 French presidential election", office: "President", italic: false }, 2027, NOW)!;
    expect(dated.source_url).toBe("https://en.wikipedia.org/wiki/2027_French_presidential_election");
    expect(dated.external_ids).toMatchObject({ enwiki: "2027 French presidential election" });
    // multi-day votes keep their span (parsed by electoral.ts, previously dropped on the way out)
    const multi = electionToEvent({ date: "2027-09-18", endDate: "2027-09-20", country: "India", article: "2027 Indian presidential election", office: "President", italic: false }, 2027, NOW)!;
    expect(multi.end_date).toBe("2027-09-20");
    expect(multi.date).toBe("2027-09-18");
    expect(IngestEventSchema.safeParse(multi).success).toBe(true);
    expect(dated.end_date).toBeNull();
  });

  it("tolerates a missing calendar page and rejects entries from other years", async () => {
    expect(await adapter.run(electoralUnit(2028), fixtureCtx())).toEqual([]);
    const e = { date: "2027-04-18", country: "France", article: "2027 French presidential election", office: "President", italic: false };
    expect(electionToEvent(e, 2026, NOW)).toBeNull();
    expect(electionToEvent({ ...e, date: "2026-04-18" }, 2026, NOW)).toBeNull();
    expect(electionToEvent({ ...e, country: "Atlantis" }, 2027, NOW)?.regions).toEqual(["GLOBAL"]);
  });
});

describe("wikipedia-categories: plan and cursor", () => {
  it("cursor is content-addressed: resumes after the named category, then the electoral years", () => {
    const cats = ["Category:Scheduled sports events", "Category:Scheduled basketball competitions", "Category:Scheduled multi-sport events"];
    const all = planUnits(cats, NOW, null);
    expect(all.map((u) => u.key)).toEqual([
      "cat:Scheduled_basketball_competitions",
      "cat:Scheduled_multi-sport_events",
      "cat:Scheduled_sports_events",
      "electoral:2026",
      "electoral:2027",
      "electoral:2028",
    ]);
    expect(all[0].after).toEqual({ phase: "cat", after: "Category:Scheduled basketball competitions" });
    const resumed = planUnits(cats, NOW, parseCursor({ phase: "cat", after: "Category:Scheduled multi-sport events" }));
    expect(resumed.map((u) => u.key)).toEqual(["cat:Scheduled_sports_events", "electoral:2026", "electoral:2027", "electoral:2028"]);
    const late = planUnits(cats, NOW, parseCursor({ phase: "electoral", after: 2027 }));
    expect(late.map((u) => u.key)).toEqual(["electoral:2028"]);
    expect(parseCursor({ i: 3 })).toBeNull();
    expect(parseCursor([1])).toBeNull();
  });

  it("plan() discovers subcategories, dedupes them against the roots and is done in one pass", async () => {
    const plan = await adapter.plan(null, fixtureCtx());
    expect(plan.done).toBe(true);
    const keys = plan.units.map((u) => u.key);
    expect(keys.filter((k) => k === "cat:Scheduled_multi-sport_events")).toHaveLength(1);
    expect(keys).toContain("cat:Scheduled_esports_events");
    expect(keys.slice(-3)).toEqual(["electoral:2026", "electoral:2027", "electoral:2028"]);
    expect(adapter.id).toBe("wikipedia-categories");
    expect(adapter.limits).toEqual({ concurrency: 1, minIntervalMs: 400, timeoutMs: 30_000, maxRetries: 3 });
  });
});

describe("wikipedia-categories: redirects and truncation", () => {
  it("follows the redirect map so a year-prefixed article that is itself a redirect keeps its ids", async () => {
    const base = fixtureCtx();
    const ctx: IngestContext = {
      ...base,
      http: {
        ...base.http,
        fetchJson: async <T,>(url: string): Promise<T> => {
          const q = new URL(url).searchParams;
          if (q.get("action") === "parse") {
            return { parse: { title: "2027 national electoral calendar", wikitext: "==January==\n* 16 January: [[Elections in Poland|Poland]], [[2027 Polish parliamentary election|Sejm]]\n" } } as T;
          }
          if (q.get("prop")?.startsWith("pageprops")) {
            return {
              query: {
                redirects: [{ from: "2027 Polish parliamentary election", to: "2027 Polish Sejm election" }],
                pages: [{ pageid: 999, ns: 0, title: "2027 Polish Sejm election", pageprops: { wikibase_item: "Q999" } }],
              },
            } as T;
          }
          return base.http.fetchJson<T>(url);
        },
      },
    };
    const rows = await adapter.run(electoralUnit(2027), ctx);
    expect(rows).toHaveLength(1);
    // the API answers under the RESOLVED title; keying by it alone would silently lose qid/pageid
    expect(rows[0].external_ids).toEqual({ enwiki: "2027 Polish parliamentary election", enwiki_pageid: 999, qid: "Q999" });
    expect(rows[0].regions).toEqual(["PL"]);
  });

  it("warns when a category outgrows the page cap instead of dropping members silently", async () => {
    const warnings: string[] = [];
    const base = fixtureCtx();
    const page = (n: number) =>
      Array.from({ length: 500 }, (_, i) => ({ pageid: n * 500 + i, ns: 0, title: `Placeholder ${n * 500 + i}` }));
    const ctx: IngestContext = {
      ...base,
      log: { info() {}, warn: (m: string) => void warnings.push(m), error() {} },
      http: {
        ...base.http,
        fetchJson: async <T,>(url: string): Promise<T> => {
          const q = new URL(url).searchParams;
          if (q.get("list") === "categorymembers") {
            return { query: { categorymembers: page(0) }, continue: { cmcontinue: "more" } } as T;
          }
          if (q.get("prop")?.startsWith("pageprops")) return { query: { pages: [] } } as T;
          return base.http.fetchJson<T>(url);
        },
      },
    };
    await adapter.run(multisportUnit(), ctx);
    expect(warnings.some((w) => /truncated/.test(w))).toBe(true);
    expect(warnings.some((w) => /2000 page members/.test(w))).toBe(true);
  });
});

describe("wikipedia-categories: plan never completes a pass on partial input", () => {
  it("propagates a failed subcategory discovery instead of returning done with the roots only", async () => {
    const ctx = fixtureCtx();
    const broken: IngestContext = {
      ...ctx,
      http: {
        ...ctx.http,
        fetchJson: async <T,>(url: string): Promise<T> => {
          if (new URL(url).searchParams.get("cmtype") === "subcat") throw new Error("HTTP 503");
          return ctx.http.fetchJson<T>(url);
        },
      },
    };
    // A silent fallback here would hand the runner a `done` pass built from 3 of 25 categories, and
    // mark_stale_records would tentative-ise every subcategory row.
    await expect(adapter.plan(null, broken)).rejects.toThrow(/503/);
  });
});

describe("wikipedia-categories: helpers", () => {
  it("Wikidata time → precision-guarded day; P580 beats P585; day-precision end only", () => {
    expect(parseWdTime({ time: "+2026-09-19T00:00:00Z", precision: 11, calendarmodel: "http://www.wikidata.org/entity/Q1985727" })).toEqual({ day: "2026-09-19", precision: "day" });
    expect(parseWdTime({ time: "+2030-02-00T00:00:00Z", precision: 10 })).toEqual({ day: "2030-02-01", precision: "month" });
    expect(parseWdTime({ time: "+2026-00-00T00:00:00Z", precision: 9 })).toEqual({ day: "2026-01-01", precision: "year" });
    expect(parseWdTime({ time: "+2020-00-00T00:00:00Z", precision: 8 })).toBeNull();
    expect(parseWdTime({ time: "+2026-09-19T00:00:00Z", precision: 11, calendarmodel: "http://www.wikidata.org/entity/Q1985786" })).toBeNull();
    expect(parseWdTime({ time: "+2026-02-30T00:00:00Z", precision: 11 })).toBeNull();
    expect(eventDates(entities.entities.Q27016751)).toEqual({ start: { day: "2026-09-19", precision: "day" }, end: "2026-10-04" });
    expect(eventDates(entities.entities.Q139569350)).toEqual({ start: { day: "2029-01-01", precision: "year" }, end: null });
    expect(eventDates(entities.entities.Q61091458)).toBeNull();
    const deprecated = { id: "Q1", claims: { P580: [{ rank: "deprecated" as const, mainsnak: { snaktype: "value", datavalue: { type: "time", value: { time: "+2027-01-01T00:00:00Z", precision: 11 } } } }] } };
    expect(eventDates(deprecated)).toBeNull();
  });

  it("index-page filter, title-year check, category meta and Commons-only images", () => {
    for (const t of ["Bids for the 2036 Summer Olympics", "2026 in sports", "2026 in sumo", "International cricket in 2026–27", "List of 2027 events"]) {
      expect(INDEX_TITLE_RE.test(t), t).toBe(true);
    }
    for (const t of ["2027 Indianapolis 500", "Super Bowl LXI", "2027 WBSC Premier12 qualification", "2026–27 Formula E World Championship"]) {
      expect(INDEX_TITLE_RE.test(t), t).toBe(false);
    }
    expect(titleYearConsistent("2026–27 Formula E World Championship", 2027)).toBe(true);
    expect(titleYearConsistent("2026 World Cup", 2027)).toBe(false);
    expect(titleYearConsistent("Super Bowl LXI", 2027)).toBe(true);
    expect(categoryMeta("Category:Scheduled ice hockey competitions")).toEqual({ category: "sports", tag: "ice-hockey" });
    expect(categoryMeta("Category:Scheduled esports events")).toEqual({ category: "esports", tag: "esports" });
    expect(categoryMeta("Category:Scheduled sports events")).toEqual({ category: "sports", tag: null });
    expect(categoryMeta("Category:2027 in sports")).toEqual({ category: "sports", tag: null });
    expect(commonsImage({ title: "x", pageimage: "a.svg", original: { source: "https://upload.wikimedia.org/wikipedia/commons/a/ab/a.svg?utm_source=en.wikipedia.org" } })).toEqual({
      url: "https://upload.wikimedia.org/wikipedia/commons/a/ab/a.svg",
      file: "a.svg",
    });
    expect(commonsImage({ title: "x", pageimage: "a.svg", original: { source: "https://upload.wikimedia.org/wikipedia/en/a/ab/a.svg" } })).toBeNull();
    expect(commonsImage({ title: "x" })).toBeNull();
  });
});
