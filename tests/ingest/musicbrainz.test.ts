import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BudgetExceededError, HttpError } from "@/lib/ingest/http";
import {
  adapter,
  collapseTitle,
  countryByName,
  countryFromArea,
  countryFromAreaLookup,
  eventToRow,
  LOOKUP_BATCH,
  LOOKUP_CAP,
  LOOKUP_PER_PAGE,
  lookupUrl,
  MAX_HIT_BYTES,
  makeCountryResolver,
  mbDate,
  mbEndDate,
  mbGet,
  packHit,
  type MbAreaLookup,
  type MbBrowse,
  type MbEvent,
  type MbSearch,
  parseCursor,
  parseEvent,
  popularityFor,
  rankCandidates,
  searchToRows,
  searchUrl,
  trimRaw,
} from "@/lib/ingest/sources/musicbrainz";
import { IngestEventSchema, type IngestContext } from "@/lib/ingest/types";

const fixture = <T>(name: string): T => JSON.parse(readFileSync(new URL(`../fixtures/musicbrainz/${name}`, import.meta.url), "utf8"));
const SEARCH = fixture<MbSearch>("search-festival.json");
const LOOKUP = fixture<MbEvent>("lookup-event.json"); // Rockharz Open Air 2027, place with city area + coordinates
const LOOKUP_AREA = fixture<MbEvent>("lookup-event-area.json"); // LOYG! Festival, `held in` area + ticketing URL
const BROWSE = fixture<MbBrowse>("browse-place.json"); // Supervue place: 2017 rows + two 2027-dated junk rows
const BALLENSTEDT = fixture<MbAreaLookup>("area-ballenstedt.json"); // city → Sachsen-Anhalt (DE-ST)
const LAYTONVILLE = fixture<MbAreaLookup>("area-laytonville.json"); // city → Mendocino County (no codes)
const MENDOCINO = fixture<MbAreaLookup>("area-mendocino.json"); // county → California (US-CA)

/** The fixture's earliest festival begins 2026-09-11. */
const NOW = new Date("2026-09-09T12:00:00Z");
const silent = { info() {}, warn() {}, error() {} };

type Route = (url: string) => unknown;
function ctxFor(route: Route, remainingMs = 120_000): IngestContext & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    http: {
      fetchJson: async <T,>(url: string) => {
        calls.push(url);
        const out = route(url);
        if (out instanceof Error) throw out;
        if (out === undefined) throw new Error(`no fixture for ${url}`);
        return out as T;
      },
      fetchText: async () => "",
    },
    log: silent,
    now: NOW,
    budget: { remainingMs: () => remainingMs },
    dryRun: true,
  };
}

const AREA_ROUTES: Record<string, MbAreaLookup> = {
  [BALLENSTEDT.id!]: BALLENSTEDT,
  [LAYTONVILLE.id!]: LAYTONVILLE,
  [MENDOCINO.id!]: MENDOCINO,
};
function routeAreas(url: string): unknown {
  const m = /\/ws\/2\/area\/([0-9a-f-]{36})\?inc=area-rels/.exec(url);
  return m ? AREA_ROUTES[m[1]] : undefined;
}
/** Like routeAreas, but any other city (Bochum …) answers like Ballenstedt so every row resolves to DE. */
function routeAreasLenient(url: string): unknown {
  const m = /\/ws\/2\/area\/([0-9a-f-]{36})\?inc=area-rels/.exec(url);
  return m ? (AREA_ROUTES[m[1]] ?? { ...BALLENSTEDT, id: m[1] }) : undefined;
}

describe("musicbrainz dates and titles", () => {
  it("life-span begin → day / month / year placeholders; end → last covered day", () => {
    expect(mbDate("2027-07-07")).toEqual({ date: "2027-07-07", precision: "day" });
    expect(mbDate("2027-07")).toEqual({ date: "2027-07-01", precision: "month" });
    expect(mbDate("2027")).toEqual({ date: "2027-01-01", precision: "year" });
    expect(mbDate("")).toBeNull();
    expect(mbDate(undefined)).toBeNull();
    expect(mbDate("07/2027")).toBeNull();
    expect(mbEndDate("2027-07-10")).toBe("2027-07-10");
    expect(mbEndDate("2027-02")).toBe("2027-02-28");
    expect(mbEndDate("2028")).toBe("2028-12-31");
    expect(mbEndDate(null)).toBeNull();
  });
  it("collapses ', Day N[: Stage]' fragments to the parent name", () => {
    expect(collapseTitle("Rock in Rio 11, Day 5: Highway Stage")).toEqual({ title: "Rock in Rio 11", fragment: true });
    expect(collapseTitle("Flyover Fest 2026 Day 1")).toEqual({ title: "Flyover Fest 2026", fragment: true });
    expect(collapseTitle("Boston Freedom Rally 2026, Day 1: 21+ Stage")).toEqual({ title: "Boston Freedom Rally 2026", fragment: true });
    expect(collapseTitle("Nova Rock 2027")).toEqual({ title: "Nova Rock 2027", fragment: false });
    expect(collapseTitle("Fest, Day 10")).toEqual({ title: "Fest", fragment: true });
    expect(collapseTitle("Day 1")).toEqual({ title: "Day 1", fragment: false });
    expect(collapseTitle("A Day to Remember Festival")).toEqual({ title: "A Day to Remember Festival", fragment: false });
  });
  it("a trailing year is not a day number: '<name> Day <year>' survives intact", () => {
    // `\d{1,2}`, not `\d+`: Field Day (London) is a real type:Festival name.
    expect(collapseTitle("Field Day 2027")).toEqual({ title: "Field Day 2027", fragment: false });
    expect(collapseTitle("Canada Day 2027")).toEqual({ title: "Canada Day 2027", fragment: false });
    expect(collapseTitle("May Day 2027")).toEqual({ title: "May Day 2027", fragment: false });
    expect(collapseTitle("Independence Day 2027 Festival")).toEqual({ title: "Independence Day 2027 Festival", fragment: false });
    const parsed = parseEvent({ id: "39aa7c23-a621-4a07-86b0-7c12d692ac97", type: "Festival", name: "Field Day 2027", "life-span": { begin: "2027-06-05" } }, NOW)!;
    expect(parsed.title).toBe("Field Day 2027");
    expect(parsed.fragment).toBe(false);
  });
  it("parseEvent guards: bad id, title-year mismatch, past, beyond the horizon, no begin", () => {
    const base: MbEvent = { id: "39aa7c23-a621-4a07-86b0-7c12d692ac97", type: "Festival", name: "Nova Rock 2027", "life-span": { begin: "2027-06-10", end: "2027-06-12" } };
    expect(parseEvent(base, NOW)?.title).toBe("Nova Rock 2027");
    expect(parseEvent({ ...base, id: "not-a-uuid" }, NOW)).toBeNull();
    expect(parseEvent({ ...base, name: "Supervue Festival 2017, Day 1", "life-span": { begin: "2027-07-28" } }, NOW)).toBeNull();
    expect(parseEvent({ ...base, name: "Festival 2026–27 Season", "life-span": { begin: "2027-01-05" } }, NOW)?.title).toBe("Festival 2026–27 Season");
    expect(parseEvent({ ...base, name: "Old Fest", "life-span": { begin: "2026-09-01" } }, NOW)).toBeNull();
    expect(parseEvent({ ...base, name: "Far Fest", "life-span": { begin: "2028-10-01" } }, NOW)).toBeNull();
    expect(parseEvent({ ...base, name: "Year Fest", "life-span": { begin: "2026" } }, NOW)?.begin).toEqual({ date: "2026-01-01", precision: "year" });
    expect(parseEvent({ ...base, "life-span": { begin: null } }, NOW)).toBeNull();
    expect(parseEvent({ ...base, "life-span": null }, NOW)).toBeNull();
  });
  it("popularity: festival 30 / other 20, +10 for a line-up of ≥ 2, capped at 35", () => {
    expect(popularityFor("Festival", 0)).toBe(30);
    expect(popularityFor("Festival", 1)).toBe(30);
    expect(popularityFor("Festival", 2)).toBe(35);
    expect(popularityFor("Concert", 0)).toBe(20);
    expect(popularityFor("Concert", 5)).toBe(30);
  });
});

describe("musicbrainz search fixture → rows", () => {
  const first = searchToRows(SEARCH.events!, NOW, silent);
  const rows = first.rows;
  const byKey = new Map(rows.map((r) => [r.source_key, r]));

  it("every row validates: source musicbrainz, festivals category, confidence 0.6, popularity ≤ 35, no image, raw without tags", () => {
    expect(rows.length).toBeGreaterThanOrEqual(8);
    for (const r of rows) {
      const parsed = IngestEventSchema.safeParse(r);
      expect(parsed.success, `${r.slug}: ${JSON.stringify(parsed.success ? null : parsed.error.issues)}`).toBe(true);
      expect(r.source).toBe("musicbrainz");
      expect(r.source_key).toMatch(/^musicbrainz:event:[0-9a-f-]{36}$/);
      expect(r.source_url).toBe(`https://musicbrainz.org/event/${r.external_ids.mbid}`);
      expect(r.category).toBe("festivals");
      expect(r.confidence).toBe(0.6);
      expect(r.featured).toBe(false);
      expect(r.popularity).toBeGreaterThanOrEqual(30);
      expect(r.popularity).toBeLessThanOrEqual(35);
      expect(r.image_candidate_url).toBeNull();
      expect(r.all_day).toBe(true);
      expect(r.timezone).toBeNull();
      expect(r.tags).toEqual(expect.arrayContaining(["music", "festival", "musicbrainz"]));
      expect(r.description.length).toBeGreaterThanOrEqual(60);
      expect(r.description.split(/[.!?]\s/).length).toBeGreaterThanOrEqual(2);
      expect(r.description.startsWith(`${r.title} is a music festival`)).toBe(true);
      expect(r.raw).not.toHaveProperty("tags");
      expect(r.raw).not.toHaveProperty("rating");
      expect(r.slug.startsWith("mine-") || r.slug.startsWith("share-")).toBe(false);
      if (r.date_precision === "year" || r.date_precision === "month") expect(r.status).toBe("tentative");
      else expect(r.status).toBe("scheduled");
    }
    expect(new Set(rows.map((r) => r.source_key)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(rows.length);
  });
  it("is deterministic across two calls (same rows, same source_keys, same candidates)", () => {
    const again = searchToRows(SEARCH.events!, NOW, silent);
    expect(again.rows).toEqual(rows);
    expect(again.candidates).toEqual(first.candidates);
    expect(rows.map((r) => [r.source_key, r.slug, r.date, r.end_date, r.date_precision, r.regions.join("+"), r.popularity])).toMatchSnapshot();
  });
  it("drops the title-year junk row (Supervue Festival 2017 dated 2027)", () => {
    expect(byKey.has("musicbrainz:event:9ec29cfd-f8e7-4b75-a2e1-47e8221d2835")).toBe(false);
    expect(rows.some((r) => /supervue/i.test(r.title))).toBe(false);
  });
  it("collapses 'Rock in Rio 11, Day N' fragments to one row: earliest day, latest sibling end, parent title", () => {
    const rio = rows.filter((r) => r.title === "Rock in Rio 11");
    expect(rio).toHaveLength(1);
    expect(rio[0].date).toBe("2026-09-11");
    expect(rio[0].end_date).toBe("2026-09-13");
    expect(rio[0].slug).toBe("rock-in-rio-11-2026-09-11");
    expect(rio[0].source_key).toBe("musicbrainz:event:7e99bfc4-bef6-48ec-b633-66c8388faab9");
    const cand = first.candidates.find((c) => c.id === "7e99bfc4-bef6-48ec-b633-66c8388faab9")!;
    expect(cand.end).toBe("2026-09-13");
  });
  it("prefers the parent event when the page has it (Nova Rock 2027, Tyrant Fest 2026) and drops the fragments", () => {
    const nova = rows.filter((r) => r.title === "Nova Rock 2027");
    expect(nova).toHaveLength(1);
    const parent = SEARCH.events!.find((e) => e.name === "Nova Rock 2027")!;
    expect(nova[0].external_ids.mbid).toBe(parent.id);
    expect(nova[0].end_date).toBe("2027-06-12");
    expect(rows.filter((r) => /^Nova Rock 2027, Day/.test(r.title))).toHaveLength(0);
    expect(nova[0].external_ids.artist_mbids).toBeDefined();
    const tyrant = rows.filter((r) => r.title === "Tyrant Fest 2026");
    expect(tyrant).toHaveLength(1);
    expect(tyrant[0].date).toBe("2026-10-24");
  });
  it("year-only begin → year precision, placeholder date, tentative status, 'expected in' wording", () => {
    const yearly = rows.filter((r) => r.date_precision === "year");
    expect(yearly.length).toBeGreaterThanOrEqual(2);
    for (const r of yearly) {
      expect(r.date).toBe("2026-01-01");
      expect(r.status).toBe("tentative");
      expect(r.description).toMatch(/expected in 2026/);
      expect(r.slug.endsWith("-2026-01-01")).toBe(true);
    }
  });
  it("search-stage rows carry no location and are never jsonld-eligible (the merge would lock both in)", async () => {
    const rockharz = byKey.get("musicbrainz:event:39aa7c23-a621-4a07-86b0-7c12d692ac97")!;
    // A `{name, url}` location with no address/geo would win `coalesce(events.location, excluded.location)`
    // for good, and `cancelled` is unknowable from a search hit, so both wait for the lookup.
    expect(rockharz.location).toBeNull();
    expect(rockharz.jsonld_eligible).toBe(false);
    for (const r of rows) expect(r.location).toBeNull();
    expect(rows.some((r) => r.jsonld_eligible)).toBe(false);
    const enriched = (await eventToRow(LOOKUP, { now: NOW, stage: "lookup", countryFor: makeCountryResolver(ctxFor(routeAreas), {}) }))!;
    expect(enriched.source_key).toBe(rockharz.source_key);
    expect(enriched.jsonld_eligible).toBe(true);
    expect(enriched.location).toMatchObject({ city: "Ballenstedt", country: "DE" });
    expect(rockharz.regions).toEqual(["GLOBAL"]);
    expect(rockharz.popularity).toBe(35);
    expect(rockharz.tags.slice(0, 3)).toEqual(["music", "festival", "musicbrainz"]);
    expect(rockharz.tags.length).toBeLessThanOrEqual(8);
    expect(rockharz.external_ids.place_mbid).toBe("ae184b49-342c-44ca-9881-a18b23e71a62");
    expect(rockharz.description).toMatch(/^Rockharz Open Air 2027 is a music festival at Rockharz Open Air Festival Grounds\. It runs from 7–10 July 2027\. The line-up includes /);
    const noPlace = rows.find((r) => !r.external_ids.place_mbid)!;
    expect(noPlace.jsonld_eligible).toBe(false);
  });
  it("single-day events get no end_date; multi-day runs keep theirs", () => {
    const loyg = byKey.get("musicbrainz:event:bbf52fae-0c92-430b-b8b1-52bb74dad1cf")!;
    expect(loyg.date).toBe("2026-09-12");
    expect(loyg.end_date).toBeNull();
    for (const r of rows) expect(r.end_date === null || r.end_date > r.date).toBe(true);
    expect(rows.find((r) => r.title === "Nova Rock 2027")!.end_date).toBe("2027-06-12");
    expect(rows.filter((r) => r.end_date === null).length).toBeGreaterThanOrEqual(3);
  });
  it("candidates are the surviving rows, ranked by popularity then date and capped", () => {
    expect(first.candidates.map((c) => c.id).sort()).toEqual(rows.map((r) => String(r.external_ids.mbid)).sort());
    const dates = new Map(rows.map((r) => [String(r.external_ids.mbid), r.date]));
    const ranked = rankCandidates([...first.candidates, ...first.candidates], dates);
    expect(ranked.length).toBe(Math.min(LOOKUP_CAP, first.candidates.length));
    for (let i = 1; i < ranked.length; i++) {
      const a = ranked[i - 1];
      const b = ranked[i];
      expect(a.rank >= b.rank).toBe(true);
      if (a.rank === b.rank) expect((dates.get(a.id) ?? "") <= (dates.get(b.id) ?? "")).toBe(true);
    }
  });
});

describe("musicbrainz lookup → row", () => {
  it("lookup stage: confidence 0.75, city + coordinates, country via the area walk, artist ids sorted, jsonld eligible", async () => {
    const ctx = ctxFor(routeAreas);
    const areas = {};
    const row = (await eventToRow(LOOKUP, { now: NOW, stage: "lookup", countryFor: makeCountryResolver(ctx, areas) }))!;
    expect(IngestEventSchema.safeParse(row).success).toBe(true);
    expect(row.confidence).toBe(0.75);
    expect(row.status).toBe("scheduled");
    expect(row.regions).toEqual(["DE"]);
    expect(row.location).toEqual({
      name: "Rockharz Open Air Festival Grounds",
      city: "Ballenstedt",
      country: "DE",
      lat: 51.742067,
      lng: 11.232683,
      url: "https://musicbrainz.org/place/ae184b49-342c-44ca-9881-a18b23e71a62",
    });
    expect(row.jsonld_eligible).toBe(true);
    expect(row.description).toContain("at Rockharz Open Air Festival Grounds in Ballenstedt, Germany.");
    const ids = row.external_ids.artist_mbids as string[];
    expect(ids).toEqual([...ids].sort());
    expect(ids.length).toBeLessThanOrEqual(20);
    expect(ctx.calls).toEqual([`https://musicbrainz.org/ws/2/area/${BALLENSTEDT.id}?inc=area-rels&fmt=json`]);
    expect(areas).toEqual({ [BALLENSTEDT.id!]: "DE" });
    expect(row.raw).not.toHaveProperty("tags");
    expect(row.raw).toMatchObject({ id: LOOKUP.id, cancelled: false });
  });
  it("cancelled → status cancelled, jsonld off, sentence appended; same source_key and slug as the live row", async () => {
    const live = (await eventToRow(LOOKUP, { now: NOW, stage: "lookup" }))!;
    const cancelled = (await eventToRow({ ...LOOKUP, cancelled: true }, { now: NOW, stage: "lookup" }))!;
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.jsonld_eligible).toBe(false);
    expect(cancelled.description).toMatch(/This edition has been cancelled\.$/);
    expect(cancelled.source_key).toBe(live.source_key);
    expect(cancelled.slug).toBe(live.slug);
    expect(cancelled.content_hash).not.toBe(live.content_hash);
    expect(live.regions).toEqual(["GLOBAL"]); // no resolver → no country
  });
  it("a fragment's end override extends the lookup row; `held in` gives city, country and the ticketing URL", async () => {
    const extended = (await eventToRow(LOOKUP, { now: NOW, stage: "lookup", endOverride: "2027-07-12" }))!;
    expect(extended.end_date).toBe("2027-07-12");
    const shorter = (await eventToRow(LOOKUP, { now: NOW, stage: "lookup", endOverride: "2027-07-08" }))!;
    expect(shorter.end_date).toBe("2027-07-10");
    const loyg = (await eventToRow(LOOKUP_AREA, { now: NOW, stage: "lookup", countryFor: async () => "DE" }))!;
    expect(loyg.regions).toEqual(["DE"]);
    expect(loyg.location).toMatchObject({ name: "Bochumer Eventcenter (BEC)", city: "Bochum", country: "DE", tickets: "https://loyg.ticket.io/mNNafOoh/?lang=de" });
    expect(loyg.external_ids).toEqual({ mbid: LOOKUP_AREA.id, place_mbid: "6593ecff-670e-4338-9ccb-bc44cd36561a" });
    expect(loyg.popularity).toBe(30);
    expect(trimRaw(LOOKUP_AREA).relations).toEqual(expect.arrayContaining([expect.objectContaining({ type: "ticketing", url: { resource: "https://loyg.ticket.io/mNNafOoh/?lang=de" } })]));
  });
  it("browse-by-place items parse with the same reader: `cancelled` is read, 2017 rows are past, 2027-dated junk is dropped", async () => {
    const items = BROWSE.events!;
    expect(items.every((e) => typeof e.cancelled === "boolean")).toBe(true);
    const rows = (await Promise.all(items.map((e) => eventToRow(e, { now: NOW, stage: "lookup" })))).filter(Boolean);
    expect(rows).toHaveLength(0);
    const future = items.filter((e) => e["life-span"]?.begin?.startsWith("2027"));
    expect(future.length).toBe(2);
    for (const e of future) expect(parseEvent(e, NOW)).toBeNull();
  });
});

describe("musicbrainz areas → countries", () => {
  it("ISO 3166-1 wins, a 3166-2 subdivision code gives its prefix, exact country names resolve", () => {
    expect(countryFromArea({ "iso-3166-1-codes": ["DE"] })).toBe("DE");
    expect(countryFromArea({ "iso-3166-2-codes": ["US-CA"] })).toBe("US");
    expect(countryFromArea({ name: "Ballenstedt", type: "City" })).toBeNull();
    expect(countryFromArea(null)).toBeNull();
    expect(countryByName("Germany")).toBe("DE");
    expect(countryByName("germany")).toBe("DE");
    expect(countryByName("Georgia")).toBe("GE");
    expect(countryByName("Berlin")).toBeNull();
    expect(countryByName("")).toBeNull();
  });
  it("area lookups: one hop for a German city, two for a US city, cache filled for every visited id", async () => {
    expect(countryFromAreaLookup(BALLENSTEDT)).toEqual({ country: "DE", parentId: "f58905b4-f974-4292-a259-befaf8a4e957" });
    expect(countryFromAreaLookup(LAYTONVILLE)).toEqual({ country: null, parentId: MENDOCINO.id });
    expect(countryFromAreaLookup(MENDOCINO)).toEqual({ country: "US", parentId: "ae0110b6-13d4-4998-9116-5b926287aa23" });
    const ctx = ctxFor(routeAreas);
    const cache: Record<string, string> = {};
    const resolve = makeCountryResolver(ctx, cache);
    expect(await resolve({ id: LAYTONVILLE.id, name: "Laytonville", type: "City" })).toBe("US");
    expect(ctx.calls).toHaveLength(2);
    expect(cache).toEqual({ [LAYTONVILLE.id!]: "US", [MENDOCINO.id!]: "US" });
    // Cached ids are never fetched again; an unknown id past the hop limit is remembered as unresolved.
    expect(await resolve({ id: MENDOCINO.id, name: "Mendocino County" })).toBe("US");
    expect(ctx.calls).toHaveLength(2);
    const dead = "00000000-0000-4000-8000-000000000000";
    const ctx2 = ctxFor((url) => (url.includes(dead) ? { id: dead, name: "Nowhere", relations: [{ type: "part of", direction: "backward", area: { id: "11111111-1111-4111-8111-111111111111", name: "Limbo" } }] } : { id: "11111111-1111-4111-8111-111111111111", name: "Limbo", relations: [] }));
    const cache2: Record<string, string> = {};
    expect(await makeCountryResolver(ctx2, cache2)({ id: dead, name: "Nowhere" })).toBeNull();
    expect(ctx2.calls).toHaveLength(2);
    expect(cache2).toEqual({ [dead]: "", "11111111-1111-4111-8111-111111111111": "" });
    expect(await makeCountryResolver(ctx2, cache2)({ id: dead, name: "Nowhere" })).toBeNull();
    expect(ctx2.calls).toHaveLength(2);
  });
});

describe("musicbrainz http", () => {
  it("404 → null, 503 → one extra attempt after the busy pause, other errors propagate", async () => {
    const notFound = ctxFor(() => new HttpError(404, "u"));
    expect(await mbGet(notFound, "https://musicbrainz.org/ws/2/event/x?fmt=json", 1)).toBeNull();
    let n = 0;
    const busyThenOk = ctxFor(() => (n++ === 0 ? new HttpError(503, "u") : { ok: true }));
    expect(await mbGet(busyThenOk, "https://musicbrainz.org/ws/2/event/y?fmt=json", 1)).toEqual({ ok: true });
    expect(busyThenOk.calls).toHaveLength(2);
    const alwaysBusy = ctxFor(() => new HttpError(503, "u"));
    await expect(mbGet(alwaysBusy, "https://musicbrainz.org/ws/2/event/z?fmt=json", 1)).rejects.toMatchObject({ status: 503 });
    expect(alwaysBusy.calls).toHaveLength(2);
    const noBudget = ctxFor(() => new HttpError(503, "u"), 10_000);
    await expect(mbGet(noBudget, "https://musicbrainz.org/ws/2/event/w?fmt=json", 1)).rejects.toMatchObject({ status: 503 });
    expect(noBudget.calls).toHaveLength(1);
    const server = ctxFor(() => new HttpError(500, "u"));
    await expect(mbGet(server, "https://musicbrainz.org/ws/2/event/v?fmt=json", 1)).rejects.toMatchObject({ status: 500 });
  });
  it("urls: Lucene festival window from today to +2 years, lookup inc joined with '+'", () => {
    const url = searchUrl(NOW, 100);
    expect(url).toBe(
      `https://musicbrainz.org/ws/2/event/?query=${encodeURIComponent("type:Festival AND begin:[2026-09-09 TO 2028-09-09]")}&fmt=json&limit=100&offset=100`,
    );
    expect(lookupUrl("39aa7c23-a621-4a07-86b0-7c12d692ac97")).toBe(
      "https://musicbrainz.org/ws/2/event/39aa7c23-a621-4a07-86b0-7c12d692ac97?inc=place-rels+artist-rels+url-rels+area-rels&fmt=json",
    );
  });
});

describe("musicbrainz plan / cursor", () => {
  it("parseCursor ignores foreign shapes and keeps only well-formed candidates", () => {
    expect(parseCursor(null)).toEqual({ stage: "search", offset: 0, queue: [], seen: [] });
    expect(parseCursor({ i: 2, page: 1 })).toEqual({ stage: "search", offset: 0, queue: [], seen: [] });
    expect(parseCursor(["x"])).toEqual({ stage: "search", offset: 0, queue: [], seen: [] });
    expect(
      parseCursor({ stage: "search", offset: 200, queue: [{ id: "bad", rank: 1 }, { id: LOOKUP.id, rank: 35, end: "2027-07-12" }], seen: [LOOKUP_AREA.id!, "nope", 7] }),
    ).toEqual({
      stage: "search",
      offset: 200,
      queue: [{ id: LOOKUP.id, rank: 35, end: "2027-07-12" }],
      seen: [LOOKUP_AREA.id],
    });
    expect(parseCursor({ stage: "lookup", queue: [{ id: LOOKUP.id, rank: 30 }], areas: { a: "DE", b: 3 } })).toEqual({
      stage: "lookup",
      queue: [{ id: LOOKUP.id, rank: 30 }],
      areas: { a: "DE" },
    });
    // A cached search hit rides along; anything that is not an object with an id is dropped.
    const hit = { id: LOOKUP.id, name: "Rockharz Open Air 2027", "life-span": { begin: "2027-07-07" } };
    expect(parseCursor({ stage: "lookup", queue: [{ id: LOOKUP.id, rank: 30, hit }], areas: {} }).queue[0].hit).toEqual(hit);
    expect(parseCursor({ stage: "lookup", queue: [{ id: LOOKUP.id, rank: 30, hit: "nope" }], areas: {} }).queue).toEqual([]);
  });
  it("search page → lookup queue → lookup batches → done; the cursor is content-addressed (mbids + area cache)", async () => {
    const route = (url: string) => {
      if (url.includes("/ws/2/event/?query=")) return SEARCH;
      const ev = /\/ws\/2\/event\/([0-9a-f-]{36})\?inc=/.exec(url);
      if (ev) return ev[1] === LOOKUP.id ? LOOKUP : ev[1] === LOOKUP_AREA.id ? LOOKUP_AREA : { ...LOOKUP, id: ev[1], name: `Stub ${ev[1].slice(0, 4)}` };
      return routeAreasLenient(url);
    };
    const ctx = ctxFor(route);
    const allRows = searchToRows(SEARCH.events!, NOW, silent).rows;
    const search = await adapter.plan(null, ctx);
    expect(search.units).toHaveLength(1);
    expect(search.units[0].key).toBe("musicbrainz:search:festival:0");
    expect(search.units[0].allowance).toBe(LOOKUP_PER_PAGE);
    const rows = await adapter.run(search.units[0], ctx);
    expect(ctx.calls).toHaveLength(1);
    // The fixture is a last page (23 hits of 23): `after` switches to the lookup stage with a ranked queue.
    const after = search.units[0].after as { stage: string; queue: Array<{ id: string; rank: number; hit?: MbEvent }>; areas: Record<string, string> };
    expect(after.stage).toBe("lookup");
    expect(after.queue).toHaveLength(LOOKUP_PER_PAGE);
    expect(after.queue[0].rank).toBe(35);
    expect(after.areas).toEqual({});
    expect(search.nextCursor).toEqual(after);
    expect(after.queue.every((c) => /^[0-9a-f-]{36}$/.test(c.id))).toBe(true);
    // One row per event per pass: the page's rows are split between "emitted now" and "queued for
    // stage 2", never both, so `upsert_events` never merges two rows with the same source_key.
    const emittedIds = rows.map((r) => String(r.external_ids.mbid));
    const queuedIds = after.queue.map((c) => c.id);
    expect(emittedIds.filter((id) => queuedIds.includes(id))).toEqual([]);
    expect([...emittedIds, ...queuedIds].sort()).toEqual(allRows.map((r) => String(r.external_ids.mbid)).sort());
    expect(rows.length).toBe(allRows.length - LOOKUP_PER_PAGE);
    // Each queued candidate carries its trimmed hit (the stage-2 fallback) and stays small.
    expect(after.queue.every((c) => c.hit?.id === c.id)).toBe(true);
    expect(after.queue.every((c) => JSON.stringify(c.hit).length <= MAX_HIT_BYTES)).toBe(true);
    expect(JSON.stringify(after.queue).length).toBeLessThan(60_000);

    const lookup = await adapter.plan(after as never, ctx);
    expect(lookup.done).toBe(false);
    expect(lookup.units).toHaveLength(1);
    expect(lookup.units[0].batch).toHaveLength(LOOKUP_BATCH);
    expect(lookup.units[0].key).toMatch(new RegExp(`^musicbrainz:lookup:[0-9a-f]{8}(\\+[0-9a-f]{8}){${LOOKUP_BATCH - 1}}$`));
    const lrows = await adapter.run(lookup.units[0], ctx);
    expect(lrows.length).toBe(LOOKUP_BATCH);
    for (const r of lrows) {
      expect(IngestEventSchema.safeParse(r).success).toBe(true);
      expect(r.confidence).toBe(0.75);
      expect(r.regions).toEqual(["DE"]);
    }
    const after2 = lookup.units[0].after as { stage: string; queue: unknown[]; areas: Record<string, string> };
    expect(after2.stage).toBe("lookup");
    expect(after2.queue).toEqual(after.queue.slice(LOOKUP_BATCH));
    expect(after2.areas).toMatchObject({ [BALLENSTEDT.id!]: "DE" });
    // Area lookups happen once per distinct city (cache), never once per event.
    const areaCalls = ctx.calls.filter((u) => u.includes("/ws/2/area/"));
    expect(areaCalls.length).toBeGreaterThanOrEqual(1);
    expect(areaCalls.length).toBeLessThan(LOOKUP_BATCH);
    expect(new Set(areaCalls).size).toBe(areaCalls.length);

    // Resuming from the persisted (JSON round-tripped) cursor: cached areas are not fetched again.
    const resumed = await adapter.plan(JSON.parse(JSON.stringify(after2)), ctx);
    expect(resumed.units[0].batch!.map((c) => c.id)).toEqual(after2.queue.slice(0, LOOKUP_BATCH).map((c) => (c as { id: string }).id));
    const before = ctx.calls.length;
    const rrows = await adapter.run(resumed.units[0], ctx);
    expect(rrows.length).toBe(resumed.units[0].batch!.length);
    const laterAreaCalls = ctx.calls.slice(before).filter((u) => u.includes("/ws/2/area/"));
    expect(laterAreaCalls.some((u) => u.includes(BALLENSTEDT.id!))).toBe(false);
    const allAreaCalls = ctx.calls.filter((u) => u.includes("/ws/2/area/"));
    expect(new Set(allAreaCalls).size).toBe(allAreaCalls.length);
    const after3 = resumed.units[0].after as { areas: Record<string, string> };
    expect(Object.keys(after3.areas).length).toBeGreaterThanOrEqual(Object.keys(after2.areas).length);

    const done = await adapter.plan({ stage: "lookup", queue: [], areas: {} }, ctx);
    expect(done).toEqual({ units: [], done: true });
  });
  it("a stuck lookup falls back to the cached hit (or is skipped), a stuck area walk yields GLOBAL uncached; all-failed or budget-out propagate", async () => {
    const stuck = "d8cc4a45-5457-4e0e-8505-4a16f198cc1e";
    const queue = [
      { id: LOOKUP.id, rank: 35 },
      { id: stuck, rank: 35 },
      { id: LOOKUP_AREA.id, rank: 30 },
    ];
    const timeout = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    const route = (url: string) => {
      if (url.includes(stuck)) return timeout; // event lookup stalls
      if (url.includes(`/event/${LOOKUP.id}`)) return LOOKUP;
      if (url.includes(`/event/${LOOKUP_AREA.id}`)) return LOOKUP_AREA;
      if (url.includes("/ws/2/area/154ef74f")) return timeout; // Bochum area stalls
      return routeAreas(url);
    };
    const ctx = ctxFor(route);
    const plan = await adapter.plan({ stage: "lookup", queue: [queue[0], queue[2]], areas: {} }, ctx);
    const rows = await adapter.run(plan.units[0], ctx);
    expect(rows.map((r) => r.external_ids.mbid)).toEqual([LOOKUP.id, LOOKUP_AREA.id]);
    expect(rows[0].regions).toEqual(["DE"]);
    expect(rows[1].regions).toEqual(["GLOBAL"]);
    const after = plan.units[0].after as { queue: unknown[]; areas: Record<string, string> };
    expect(after.queue).toEqual([]);
    expect(after.areas).toEqual({ [BALLENSTEDT.id!]: "DE" }); // the stalled Bochum area is not cached as unresolved

    // A stalled lookup whose candidate carries the search hit still emits a row — at search quality,
    // so the event is not lost for the pass; without a hit it is simply skipped.
    const hit = packHit(SEARCH.events!.find((e) => e.id === LOOKUP.id)!)!;
    const ctx2 = ctxFor(route);
    const withHit = await adapter.plan({ stage: "lookup", queue: [{ id: stuck, rank: 35, hit: { ...hit, id: stuck } }, queue[2]], areas: {} }, ctx2);
    const rows2 = await adapter.run(withHit.units[0], ctx2);
    expect(rows2.map((r) => r.external_ids.mbid)).toEqual([stuck, LOOKUP_AREA.id]);
    expect(rows2[0].confidence).toBe(0.6);
    expect(rows2[0].location).toBeNull();
    expect(rows2[0].jsonld_eligible).toBe(false);

    const allDown = ctxFor(() => timeout);
    const p2 = await adapter.plan({ stage: "lookup", queue: queue.slice(0, 2), areas: {} }, allDown);
    await expect(adapter.run(p2.units[0], allDown)).rejects.toThrow(/timeout/);

    const budget = ctxFor(() => new BudgetExceededError("u", 0));
    const p3 = await adapter.plan({ stage: "lookup", queue, areas: {} }, budget);
    await expect(adapter.run(p3.units[0], budget)).rejects.toBeInstanceOf(BudgetExceededError);
    expect(budget.calls).toHaveLength(1);
  });
  it("a full search page advances the offset and carries the queue; page 3 always ends the search stage", async () => {
    const template = SEARCH.events!.find((e) => e.name === "Rockharz Open Air 2027")!;
    const full = { ...SEARCH, count: 250, events: Array.from({ length: 100 }, (_, i) => ({ ...template, id: `39aa7c23-a621-4a07-86b0-${String(i).padStart(12, "0")}`, name: `Stub Fest ${i}` })) };
    const ctx = ctxFor(() => full);
    const p0 = await adapter.plan(null, ctx);
    const emitted0 = await adapter.run(p0.units[0], ctx);
    const c1 = p0.units[0].after as { stage: string; offset: number; queue: Array<{ id: string }>; seen: string[] };
    expect(c1.stage).toBe("search");
    expect(c1.offset).toBe(100);
    // 100 hits: LOOKUP_PER_PAGE withheld for stage 2, the rest emitted here — never both.
    expect(c1.queue).toHaveLength(LOOKUP_PER_PAGE);
    expect(emitted0).toHaveLength(100 - LOOKUP_PER_PAGE);
    expect(emitted0.some((r) => c1.queue.some((c) => c.id === r.external_ids.mbid))).toBe(false);
    expect(new Set(c1.seen).size).toBe(100);
    const p2 = await adapter.plan({ stage: "search", offset: 200, queue: c1.queue as never, seen: c1.seen }, ctx);
    expect(p2.units[0].key).toBe("musicbrainz:search:festival:200");
    expect(p2.units[0].allowance).toBe(Math.min(LOOKUP_PER_PAGE, LOOKUP_CAP - LOOKUP_PER_PAGE));
    // MusicBrainz search paging overlaps: the same 100 hits again must produce no second row and
    // must not be withheld either — the pass already handled every one of them.
    const emitted2 = await adapter.run(p2.units[0], ctx);
    expect(emitted2).toEqual([]);
    const c3 = p2.units[0].after as { stage: string; queue: unknown[] };
    expect(c3.stage).toBe("lookup");
    expect(c3.queue).toHaveLength(LOOKUP_PER_PAGE);
    expect(c3.queue.length).toBeLessThanOrEqual(LOOKUP_CAP);
  });
});
