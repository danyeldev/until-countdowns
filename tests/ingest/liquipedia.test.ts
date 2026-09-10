import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  adapter,
  cleanValue,
  describe as describeEvent,
  extractInfobox,
  isExcludedType,
  isMarquee,
  isTopTier,
  type LpQueryResponse,
  MAX_SEARCH_PAGES,
  pageToEvent,
  pagesToEvents,
  pageUrl,
  parseCursor,
  parseLpDate,
  planUnits,
  regionsFor,
  searchUrl,
  titleYearConsistent,
  umbrellaOwner,
  WIKIS,
} from "@/lib/ingest/sources/liquipedia";
import { IngestEventSchema, type IngestContext } from "@/lib/ingest/types";
import { COUNTRY_NAMES } from "@/lib/regions";

const NOW = new Date("2026-09-09T12:00:00Z");
const fixture = <T>(name: string): T => JSON.parse(readFileSync(new URL(`../fixtures/liquipedia/${name}`, import.meta.url), "utf8"));
const CS1 = fixture<LpQueryResponse>("search-counterstrike-1.json");
const CS2 = fixture<LpQueryResponse>("search-counterstrike-2.json");
const DOTA = fixture<LpQueryResponse>("search-dota2.json");
const TI = fixture<LpQueryResponse>("page-the-international-2026.json");
const CS = WIKIS.find((w) => w.id === "counterstrike")!;
const DOTA2 = WIKIS.find((w) => w.id === "dota2")!;

function ctxFor(responses: Record<string, unknown>, calls: Array<{ url: string; headers?: Record<string, string> }> = []): IngestContext {
  return {
    http: {
      fetchJson: async <T,>(url: string, init?: { headers?: Record<string, string> }) => {
        calls.push({ url, headers: init?.headers });
        const key = Object.keys(responses).find((k) => url === k);
        if (!key) throw new Error(`no fixture for ${url}`);
        return responses[key] as T;
      },
      fetchText: async () => "",
    },
    log: { info() {}, warn() {}, error() {} },
    now: NOW,
    budget: { remainingMs: () => 60_000 },
    dryRun: true,
  };
}

const csResponses = { [searchUrl("counterstrike")]: CS1, [searchUrl("counterstrike", 20)]: CS2 };

describe("liquipedia wikitext helpers", () => {
  it("extractInfobox is brace-aware, drops comments and splits same-line parameters", () => {
    const box = extractInfobox(TI.query!.pages![0].revisions![0].slots!.main!.content!)!;
    expect(box.sdate).toBe("2026-08-13");
    expect(box.edate).toBe("2026-08-23");
    expect(box.liquipediatier).toBe("1");
    expect(box.venue1).toBe("Oriental Sports Center");
    expect(box.prizepoolusd).toBe("{{:The International/2026/prizepool}}"); // nested template kept whole
    expect(box.previous).toBe("{{BASEPAGENAME}}/2025{{!}}2025"); // `{{!}}` pipe not a separator
    const sameLine = extractInfobox("{{Infobox league\n|sdate=\n|liquipediatier=1 |liquipediatiertype=Qualifier\n}}")!;
    expect(sameLine).toEqual({ sdate: "", liquipediatier: "1", liquipediatiertype: "Qualifier" });
    const commented = extractInfobox("{{Infobox league\n|country=Mongolia|city=Ulaanbaatar<!--\n|country2=Denmark|city2=Copenhagen-->\n|venue1=[https://x.mn/ Steppe Arena]<!--|venue1desc=Playoffs\n|venue2=BLAST Studios-->\n|sdate=2027-05-10\n}}")!;
    expect(commented).toEqual({ country: "Mongolia", city: "Ulaanbaatar", venue1: "[https://x.mn/ Steppe Arena]", sdate: "2027-05-10" });
    expect(extractInfobox("no template here")).toBeNull();
  });
  it("cleanValue reduces links and templates to plain text; TBA placeholders become empty", () => {
    expect(cleanValue("[https://www.thekallang.com.sg/venues Singapore Indoor Stadium]")).toBe("Singapore Indoor Stadium");
    expect(cleanValue("[[Bucharest|PGL Studio]]")).toBe("PGL Studio");
    expect(cleanValue("{{Abbr/TBA}}")).toBe("");
    expect(cleanValue("{{:The International/2026/prizepool}}")).toBe("");
    expect(cleanValue("StarLadder StarSeries Fall&nbsp;2027")).toBe("StarLadder StarSeries Fall 2027");
    expect(cleanValue("'''Group Stage'''<br>Swiss")).toBe("Group Stage Swiss");
    expect(cleanValue(undefined)).toBe("");
  });
  it("parseLpDate: day, `??` month/year placeholders, invalid", () => {
    expect(parseLpDate("2026-11-25")).toEqual({ date: "2026-11-25", precision: "day" });
    expect(parseLpDate("2027-11-??")).toEqual({ date: "2027-11-01", precision: "month" });
    expect(parseLpDate("2027-??-??")).toEqual({ date: "2027-01-01", precision: "year" });
    expect(parseLpDate("2027-03")).toEqual({ date: "2027-03-01", precision: "month" });
    expect(parseLpDate("2027")).toEqual({ date: "2027-01-01", precision: "year" });
    expect(parseLpDate("2026-02-30")).toBeNull();
    expect(parseLpDate("")).toBeNull();
    expect(parseLpDate(undefined)).toBeNull();
  });
  it("tier and type filters", () => {
    expect(isTopTier("1")).toBe(true);
    expect(isTopTier("S-Tier")).toBe(true);
    expect(isTopTier("2")).toBe(false);
    expect(isTopTier("A-Tier")).toBe(false);
    expect(isTopTier(undefined)).toBe(false);
    expect(isExcludedType("Qualifier", "BLAST/SLAM/9/Europe")).toBe(true);
    expect(isExcludedType("National", "Esports Nations Cup/2026")).toBe(false);
    expect(isExcludedType(undefined, "The International/2026/China/Open Qualifier 2")).toBe(true);
    expect(isExcludedType(undefined, "PGL/2026/Singapore")).toBe(false);
  });
  it("regions: exact names, aliases, and non-countries → none", () => {
    expect(regionsFor("Singapore")).toEqual(["SG"]);
    expect(regionsFor("United States")).toEqual(["US"]);
    expect(regionsFor("Saudi Arabia")).toEqual(["SA"]);
    expect(regionsFor("World")).toEqual([]);
    expect(regionsFor("Europe", "Malta")).toEqual(["MT"]);
    expect(regionsFor("Southeast Asia")).toEqual([]);
    expect(regionsFor("{{Abbr/TBA}}")).toEqual([]);
  });
  it("marquee patterns, urls, label-year check", () => {
    expect(isMarquee("dota2", "The International/2027")).toEqual({ marquee: true, featured: true });
    expect(isMarquee("leagueoflegends", "World Championship/2026")).toEqual({ marquee: true, featured: true });
    expect(isMarquee("counterstrike", "Majors/2027/Winter")).toEqual({ marquee: true, featured: false });
    expect(isMarquee("counterstrike", "FiReSPORTS/Major/2027/Buenos Aires").marquee).toBe(true);
    expect(isMarquee("rocketleague", "Esports World Cup/2027").marquee).toBe(true);
    expect(isMarquee("counterstrike", "PGL/2026/Singapore").marquee).toBe(false);
    expect(isMarquee("counterstrike", "PGL/2026/Singapore", "PGL Major Singapore 2026").marquee).toBe(true); // name-based
    expect(isMarquee("counterstrike", "PGL/2026/Masters", "PGL Masters Bucharest 2026").marquee).toBe(false);
    expect(isMarquee("valorant", "World Championship/2026").marquee).toBe(false); // wiki-scoped
    expect(pageUrl("counterstrike", "PGL/2027/Łódź")).toBe("https://liquipedia.net/counterstrike/PGL/2027/%C5%81%C3%B3d%C5%BA");
    expect(pageUrl("dota2", "The International/2027")).toBe("https://liquipedia.net/dota2/The_International/2027");
    expect(titleYearConsistent("CS2 Major Championship Winter 2027", "2027-11-22")).toBe(true);
    expect(titleYearConsistent("PGL Wallachia Season 9", "2026-09-17")).toBe(true);
    expect(titleYearConsistent("World Championship 2012 Circuit Points", "2027-10-01")).toBe(false);
  });
  it("describe writes two own sentences from facts", () => {
    const d = describeEvent({ title: "PGL Singapore 2026", game: "Counter-Strike", city: "Kallang", country: "Singapore", venue: "Singapore Indoor Stadium", date: "2026-11-25", precision: "day", endDate: "2026-12-13", prize: "1,250,000" });
    expect(d).toBe("PGL Singapore 2026 is a top-tier Counter-Strike esports tournament held in Kallang, Singapore at Singapore Indoor Stadium. It runs from 25 November 2026 to 13 December 2026 with a US$1,250,000 prize pool.");
    expect(describeEvent({ title: "ENC 2026", game: "Dota 2", city: "", country: "", venue: "", date: "2027-11-01", precision: "month", endDate: null, prize: null })).toBe("ENC 2026 is a top-tier Dota 2 esports tournament. It is expected in November 2027.");
  });
});

describe("liquipedia page → event", () => {
  const byTitle = (res: LpQueryResponse, title: string) => res.query!.pages!.find((p) => p.title === title)!;

  it("counterstrike page: S-Tier, day precision, venue/city/country, jsonld eligible, stable source_key", () => {
    const r = pageToEvent(byTitle(CS1, "PGL/2026/Singapore"), CS, NOW);
    if (!("event" in r)) throw new Error(`expected an event, got skip=${r.skip}`);
    const ev = r.event;
    expect(IngestEventSchema.safeParse(ev).success).toBe(true);
    expect(ev.slug).toBe("pgl-major-singapore-2026-2026-11-25");
    expect(ev.source_key).toBe("liquipedia:counterstrike:345115");
    expect(ev.title).toBe("PGL Major Singapore 2026"); // infobox `name`, not the page title
    expect(ev.date).toBe("2026-11-25");
    expect(ev.end_date).toBe("2026-12-13");
    expect(ev.all_day).toBe(true);
    expect(ev.timezone).toBeNull();
    expect(ev.date_precision).toBe("day");
    expect(ev.status).toBe("scheduled");
    expect(ev.category).toBe("esports");
    expect(ev.tags).toEqual(["esports", "counter-strike", "tier-1", "marquee"]); // a CS Major by name
    expect(ev.regions).toEqual(["SG"]);
    expect(ev.location).toEqual({ name: "Singapore Indoor Stadium", city: "Kallang", country: "Singapore" });
    expect(ev.jsonld_eligible).toBe(true);
    expect(ev.popularity).toBe(60);
    expect(ev.featured).toBe(false);
    expect(ev.confidence).toBe(0.8);
    expect(ev.source_url).toBe("https://liquipedia.net/counterstrike/PGL/2026/Singapore");
    expect(ev.external_ids).toEqual({ liquipedia_pageid: 345115, liquipedia_title: "PGL/2026/Singapore", liquipedia_wiki: "counterstrike" });
    expect(ev.image_candidate_url).toBeNull();
    expect(ev.description).toBe(
      "PGL Major Singapore 2026 is a top-tier Counter-Strike esports tournament held in Kallang, Singapore at Singapore Indoor Stadium. It runs from 25 November 2026 to 13 December 2026 with a US$1,250,000 prize pool.",
    );
    expect(ev.description.length).toBeGreaterThanOrEqual(80);
  });
  it("World/TBA pages get GLOBAL, no location, not jsonld eligible; cancelled pages skipped; html comments do not leak", () => {
    const fall = pageToEvent(byTitle(CS2, "StarLadder/StarSeries/2027/Fall"), CS, NOW); // country=World, city/venue empty
    expect("event" in fall && fall.event.regions).toEqual(["GLOBAL"]);
    expect("event" in fall && fall.event.location).toBeNull();
    expect("event" in fall && fall.event.jsonld_eligible).toBe(false);
    expect("event" in fall && fall.event.title).toBe("StarLadder StarSeries Fall 2027"); // &nbsp; decoded
    const major = pageToEvent(byTitle(CS2, "Majors/2027/Winter"), CS, NOW); // city={{Abbr/TBD}}
    expect("event" in major && major.event.location).toBeNull();
    expect("event" in major && major.event.description).toBe(
      "CS2 Major Championship Winter 2027 is a top-tier Counter-Strike esports tournament. It runs from 22 November 2027 to 12 December 2027 with a US$1,250,000 prize pool.",
    );
    expect(pageToEvent(byTitle(CS1, "PGL/2026/Fall"), CS, NOW)).toEqual({ skip: "cancelled" }); // {{Cancelled Tournament}} after the infobox
    const summer = pageToEvent(byTitle(CS1, "BLAST/Open/2027/Summer"), CS, NOW);
    expect("event" in summer && summer.event.location).toEqual({ name: "Steppe Arena", city: "Ulaanbaatar", country: "Mongolia" });
    expect("event" in summer && summer.event.regions).toEqual(["MN"]);
  });
  it("marquee: +20 popularity and the marquee tag; The International is featured", () => {
    const ewc = pageToEvent(byTitle(CS2, "Esports World Cup/2027"), CS, NOW);
    expect("event" in ewc && ewc.event.popularity).toBe(60);
    expect("event" in ewc && ewc.event.tags).toContain("marquee");
    expect("event" in ewc && ewc.event.featured).toBe(false);
    expect("event" in ewc && ewc.event.regions).toEqual(["SA"]);
    const major = pageToEvent(byTitle(CS2, "Majors/2027/Winter"), CS, NOW);
    expect("event" in major && major.event.title).toBe("CS2 Major Championship Winter 2027");
    expect("event" in major && major.event.popularity).toBe(60);
    // TI 2026 would be featured, but it is in the past for NOW → dropped
    expect(pageToEvent(byTitle(TI, "The International/2026"), DOTA2, NOW)).toEqual({ skip: "past" });
    const future = new Date("2026-06-01T00:00:00Z");
    const ti = pageToEvent(byTitle(TI, "The International/2026"), DOTA2, future);
    expect("event" in ti && ti.event.featured).toBe(true);
    expect("event" in ti && ti.event.popularity).toBe(60);
    expect("event" in ti && ti.event.location).toEqual({ name: "Oriental Sports Center", city: "Shanghai", country: "China" });
    expect("event" in ti && ti.event.regions).toEqual(["CN"]);
    expect("event" in ti && ti.event.description).toBe(
      "The International 2026 is a top-tier Dota 2 esports tournament held in Shanghai, China at Oriental Sports Center. It runs from 13 August 2026 to 23 August 2026.",
    ); // prize pool is a transclusion → omitted
  });
  it("umbrella pages belong to one wiki, so the same event is never emitted twice", () => {
    expect(umbrellaOwner("Esports World Cup/2027")).toBe("counterstrike");
    expect(umbrellaOwner("Esports Nations Cup/2026")).toBe("dota2");
    expect(umbrellaOwner("PGL/2026/Singapore")).toBeNull();
    const ewcPage = byTitle(CS2, "Esports World Cup/2027");
    const onCs = pageToEvent(ewcPage, CS, NOW); // owner wiki keeps it
    expect("event" in onCs && onCs.event.source_key).toBe("liquipedia:counterstrike:373133");
    for (const wiki of WIKIS.filter((w) => w.id !== "counterstrike")) {
      expect(pageToEvent(ewcPage, wiki, NOW), wiki.id).toEqual({ skip: "umbrella" });
    }
    // The dota2 fixture's ENC page is on its owner wiki, so it is filtered on its own merits.
    expect(pageToEvent(byTitle(DOTA, "Esports Nations Cup/2026"), CS, NOW)).toEqual({ skip: "umbrella" });
    expect(pageToEvent(byTitle(DOTA, "Esports Nations Cup/2026"), DOTA2, NOW)).not.toEqual({ skip: "umbrella" });
  });
  it("commented-out templates are inert; country names are canonical; online events are not jsonld eligible", () => {
    const wikitext = (extra: string) =>
      `{{Infobox league\n|name=Localhost Open 2027\n|country=USA\n|city=Philadelphia\n|venue=Localhost Philly\n|sdate=2027-04-02\n|edate=2027-04-04\n|liquipediatier=S-Tier\n${extra}}}\n`;
    const page = (extra: string) => ({ pageid: 999001, ns: 0, title: "Localhost/2027/Open", revisions: [{ slots: { main: { content: wikitext(extra) } } }] });
    const live = pageToEvent(page("<!-- {{Cancelled Tournament}} parked while the org confirms -->\n"), CS, NOW);
    if (!("event" in live)) throw new Error(`expected an event, got skip=${live.skip}`);
    expect(live.event.title).toBe("Localhost Open 2027"); // a commented-out template must not cancel it
    expect(live.event.location).toEqual({ name: "Localhost Philly", city: "Philadelphia", country: COUNTRY_NAMES.US });
    expect(live.event.location).not.toMatchObject({ country: "USA" }); // canonical, not the raw infobox value
    expect(live.event.regions).toEqual(["US"]);
    expect(live.event.jsonld_eligible).toBe(true);
    expect(pageToEvent(page("{{Cancelled Tournament}}\n"), CS, NOW)).toEqual({ skip: "cancelled" });
    const online = pageToEvent(page("|type=Online\n"), CS, NOW);
    expect("event" in online && online.event.jsonld_eligible).toBe(false); // studio address, not attendable
    expect("event" in online && online.event.location).toEqual({ name: "Localhost Philly", city: "Philadelphia", country: COUNTRY_NAMES.US });
    const offline = pageToEvent(page("|type=Offline\n"), CS, NOW);
    expect("event" in offline && offline.event.jsonld_eligible).toBe(true);
  });
  it("dota2 fixture: tier `1`, qualifiers/missing dates skipped, `??` month → tentative, horizon", () => {
    expect(pageToEvent(byTitle(DOTA, "G-League 2013/Western Qualifier"), DOTA2, NOW)).toEqual({ skip: "excluded-type" });
    expect(pageToEvent(byTitle(DOTA, "BLAST/SLAM/9/Europe"), DOTA2, NOW)).toEqual({ skip: "excluded-type" });
    expect(pageToEvent(byTitle(DOTA, "World Electronic Sports Games/2019"), DOTA2, NOW)).toEqual({ skip: "cancelled" });
    expect(pageToEvent(byTitle(DOTA, "PGL/Wallachia/14"), DOTA2, NOW)).toEqual({ skip: "horizon" }); // 2028-05-08 > now + 18 months
    // "Esports Nations Cup 2026" with sdate 2027-11-?? fails the label-year check (upstream inconsistency)
    expect(pageToEvent(byTitle(DOTA, "Esports Nations Cup/2026"), DOTA2, NOW)).toEqual({ skip: "year-mismatch" });
    const encPage = byTitle(DOTA, "Esports Nations Cup/2026");
    const retitled = { ...encPage, revisions: [{ slots: { main: { content: encPage.revisions![0].slots!.main!.content!.replace("|name=Esports Nations Cup 2026", "|name=Esports Nations Cup 2027") } } }] };
    const enc = pageToEvent(retitled, DOTA2, NOW);
    expect("event" in enc && enc.event.date).toBe("2027-11-01");
    expect("event" in enc && enc.event.date_precision).toBe("month");
    expect("event" in enc && enc.event.status).toBe("tentative");
    expect("event" in enc && enc.event.end_date).toBeNull();
    expect("event" in enc && enc.event.slug).toBe("esports-nations-cup-2027-2027-11-01");
    expect("event" in enc && enc.event.regions).toEqual(["SA"]);
    expect("event" in enc && enc.event.description).toBe("Esports Nations Cup 2027 is a top-tier Dota 2 esports tournament held in Riyadh, Saudi Arabia. It is expected in November 2027 with a US$1,500,000 prize pool.");
    const slam = pageToEvent(byTitle(DOTA, "BLAST/SLAM/8"), DOTA2, NOW);
    expect("event" in slam && slam.event.title).toBe("BLAST SLAM VIII");
    expect("event" in slam && slam.event.regions).toEqual(["MT"]); // country=Europe, country2=Malta
    expect("event" in slam && slam.event.tags).toEqual(["esports", "dota-2", "tier-1"]);
    const rows = pagesToEvents(DOTA.query!.pages!, DOTA2, NOW);
    expect(rows.map((r) => r.source_key)).toEqual(["liquipedia:dota2:183764", "liquipedia:dota2:175888", "liquipedia:dota2:188790"]); // date-sorted
    for (const r of rows) expect(IngestEventSchema.safeParse(r).success, r.slug).toBe(true);
  });
});

describe("liquipedia adapter plan/run", () => {
  it("plan: one unit per wiki, content-addressed cursor, resume after a wiki", async () => {
    const plan = await adapter.plan(null, ctxFor({}));
    expect(plan.done).toBe(true);
    expect(plan.units.map((u) => u.wiki)).toEqual(WIKIS.map((w) => w.id));
    expect(plan.units[0]).toMatchObject({ key: "liquipedia:leagueoflegends", after: { afterWiki: "leagueoflegends" } });
    expect(planUnits("counterstrike").map((u) => u.wiki)).toEqual(["valorant", "rocketleague", "overwatch", "rainbowsix", "starcraft2", "mobilelegends"]);
    expect(planUnits("mobilelegends")).toEqual([]);
    expect(parseCursor({ afterWiki: "dota2" })).toEqual({ afterWiki: "dota2" });
    expect(parseCursor({ afterWiki: "nope" })).toEqual({ afterWiki: null });
    expect(parseCursor(3)).toEqual({ afterWiki: null });
    expect(parseCursor(null)).toEqual({ afterWiki: null });
  });
  it("run follows gsroffset continuation, dedupes by source_key, emits only valid rows; stable across two runs", async () => {
    const calls: Array<{ url: string; headers?: Record<string, string> }> = [];
    const ctx = ctxFor(csResponses, calls);
    const unit = planUnits("dota2")[0];
    expect(unit.wiki).toBe("counterstrike");
    const a = await adapter.run(unit, ctx);
    const b = await adapter.run(unit, ctx);
    expect(calls.length).toBe(4);
    expect(calls[0].url).toBe(searchUrl("counterstrike"));
    expect(calls[1].url).toBe(searchUrl("counterstrike", 20));
    expect(calls[0].headers).toEqual({ "Accept-Encoding": "gzip" });
    expect(calls[0].url).toContain("generator=search");
    expect(calls[0].url).not.toContain("action=parse");
    expect(a.map((r) => r.source_key)).toEqual(b.map((r) => r.source_key));
    expect(a.map((r) => r.content_hash)).toEqual(b.map((r) => r.content_hash));
    expect(new Set(a.map((r) => r.source_key)).size).toBe(a.length);
    for (const r of a) expect(IngestEventSchema.safeParse(r).success, r.slug).toBe(true);
    // 8 + 7 fixture pages minus PGL/2026/Fall (cancelled) and FISSURE #11 (2028-03-25, beyond the 18-month horizon)
    expect(a.length).toBe(13);
    expect(a.map((r) => r.slug)).toMatchSnapshot();
    expect(a.every((r) => r.source === "liquipedia" && r.category === "esports")).toBe(true);
    expect(a.every((r) => r.date_precision !== "year" || r.status === "tentative")).toBe(true);
    expect(a[0].date <= a[a.length - 1].date).toBe(true);
    expect(MAX_SEARCH_PAGES).toBe(3);
  });
  it("run surfaces an API error object", async () => {
    const ctx = ctxFor({ [searchUrl("valorant")]: { error: { code: "badvalue", info: "Unrecognized value" } } });
    await expect(adapter.run(planUnits("counterstrike")[0], ctx)).rejects.toThrow(/badvalue/);
  });
});
