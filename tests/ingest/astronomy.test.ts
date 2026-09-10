import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { adapter, parseCursor, planUnits, unitList, withinHorizon } from "@/lib/ingest/sources/astronomy";
import { cometRows, displayName, parseCad, parseSbdb, sbdbDesignation, sbdbQueryUrl, selectCad, sigmaMinutes, tpCalToDay } from "@/lib/ingest/sources/astronomy/jpl";
import { eclipseRows, moonRows, planetRows, seasonRows, showerRows, sunLongitudeInstant, transitRows } from "@/lib/ingest/sources/astronomy/sky";
import { IngestEventSchema, type IngestContext, type IngestEvent } from "@/lib/ingest/types";

const NOW = new Date("2026-09-09T12:00:00Z");

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/astronomy/${name}`, import.meta.url), "utf8"));
}

function ctxWith(fetchJson: (url: string) => Promise<unknown>): IngestContext {
  return {
    http: { fetchJson: async <T,>(url: string) => (await fetchJson(url)) as T, fetchText: async () => "" },
    log: { info() {}, warn() {}, error() {} },
    now: NOW,
    budget: { remainingMs: () => 60_000 },
    dryRun: true,
  };
}

function expectValid(rows: readonly IngestEvent[]): void {
  for (const r of rows) {
    const res = IngestEventSchema.safeParse(r);
    expect(res.success, `${r.slug}: ${res.success ? "" : res.error.issues[0]?.message}`).toBe(true);
    expect(r.source).toBe("astronomy");
    expect(r.category).toBe("astronomy");
    expect(r.description.length, `${r.slug} description too short`).toBeGreaterThanOrEqual(80);
    expect(r.description.split(/\.\s/).length, `${r.slug} needs two sentences`).toBeGreaterThanOrEqual(2);
    expect(r.image_candidate_url).toBeNull();
    expect(r.jsonld_eligible).toBe(false);
  }
}

describe("computed sky events (astronomy-engine)", () => {
  it("2027 eclipses: annular 2027-02-06 and total 2027-08-02 (USNO), no lunar rows (all penumbral), partial solar skipped", () => {
    const rows = eclipseRows(2027, NOW);
    expect(rows.map((r) => r.source_key)).toEqual(["astronomy:solar-eclipse:2027-02-06", "astronomy:solar-eclipse:2027-08-02"]);
    const [annular, total] = rows;
    expect(annular.title).toBe("Annular solar eclipse");
    expect(annular.date).toBe("2027-02-06T15:59:33Z");
    expect(annular.date_precision).toBe("instant");
    expect(annular.all_day).toBe(false);
    expect(annular.timezone).toBe("UTC");
    expect(annular.status).toBe("scheduled");
    expect(annular.confidence).toBe(0.95);
    expect(annular.popularity).toBe(60);
    expect(annular.featured).toBe(false);
    expect(annular.location).toEqual({ name: "Point of greatest eclipse", lat: -31.29, lng: -48.47 });
    expect(total.slug).toBe("total-solar-eclipse-2027-08-02");
    expect(total.date.slice(0, 16)).toBe("2027-08-02T10:06");
    expect(total.popularity).toBe(80);
    expect(total.featured).toBe(true); // within 2 years of NOW
    expect(total.tags).toEqual(["eclipse", "solar-eclipse", "total", "sky", "computed"]);
    expect(eclipseRows(2030, NOW).find((r) => r.title === "Total solar eclipse")?.featured).toBe(false);
    // 2026: Feb 17 annular, Mar 3 total lunar, Aug 12 total, Aug 28 partial lunar; partial solar / penumbral never appear.
    const y2026 = eclipseRows(2026, NOW);
    expect(y2026.map((r) => r.source_key)).toEqual([
      "astronomy:solar-eclipse:2026-02-17",
      "astronomy:solar-eclipse:2026-08-12",
      "astronomy:lunar-eclipse:2026-03-03",
      "astronomy:lunar-eclipse:2026-08-28",
    ]);
    expect(y2026[2].title).toBe("Total lunar eclipse");
    expect(y2026[3].title).toBe("Partial lunar eclipse");
    expect(eclipseRows(2028, NOW).every((r) => !/penumbral|partial solar/i.test(r.title))).toBe(true);
    expectValid([...rows, ...y2026]);
  });

  it("seasons: four instants per year with stable keys", () => {
    const rows = seasonRows(2027);
    expect(rows.map((r) => r.source_key)).toEqual([
      "astronomy:season:2027:mar-equinox",
      "astronomy:season:2027:jun-solstice",
      "astronomy:season:2027:sep-equinox",
      "astronomy:season:2027:dec-solstice",
    ]);
    expect(rows[0].slug).toBe("march-equinox-2027-03-20");
    expect(rows[0].date).toBe("2027-03-20T20:24:43Z");
    expect(rows[3].title).toBe("December solstice");
    expect(rows.every((r) => r.popularity === 45 && r.date_precision === "instant")).toBe(true);
    expectValid(rows);
  });

  it("meteor showers: IMO 2026 λ☉ reproduces the calendar dates (Perseids Aug 13, Ursids Dec 22 22h UT)", () => {
    const rows = showerRows(2026);
    expect(rows).toHaveLength(10);
    const per = rows.find((r) => r.source_key === "astronomy:shower:per:2026")!;
    expect(per.slug).toBe("perseid-meteor-shower-peak-2026-08-13");
    expect(per.popularity).toBe(55);
    expect(per.description).toMatch(/ZHR of about 100/);
    expect(per.description).toMatch(/the Moon is \d+% illuminated/);
    const urs = sunLongitudeInstant(270.7, 2026)!;
    expect(Math.abs(urs.getTime() - Date.parse("2026-12-22T22:00:00Z"))).toBeLessThan(30 * 60_000);
    expect(sunLongitudeInstant(283.15, 2026)?.toISOString().slice(0, 10)).toBe("2026-01-03");
    expect(sunLongitudeInstant(262.2, 2026)?.toISOString().slice(0, 10)).toBe("2026-12-14");
    // Deterministic: a second computation yields identical rows (keys and hashes).
    const again = showerRows(2026);
    expect(again.map((r) => [r.source_key, r.content_hash])).toEqual(rows.map((r) => [r.source_key, r.content_hash]));
    expectValid(rows);
  });

  it("planets: Mars opposition 2027-02-19 confirms the relative-longitude convention; Jupiter/Saturn once a year", () => {
    const rows = planetRows(2027);
    const mars = rows.find((r) => r.source_key.startsWith("astronomy:opposition:mars"))!;
    expect(mars.source_key).toBe("astronomy:opposition:mars:2027-02-19");
    expect(mars.title).toBe("Mars at opposition");
    expect(mars.popularity).toBe(45);
    expect(mars.description).toMatch(/magnitude -1\.2/);
    expect(rows.filter((r) => r.source_key.includes(":jupiter:"))).toHaveLength(1);
    expect(rows.filter((r) => r.source_key.includes(":saturn:"))).toHaveLength(1);
    expect(planetRows(2028).some((r) => r.source_key.includes(":mars:"))).toBe(false); // Mars oppositions are 26 months apart
    expectValid(rows);
  });

  it("moon: blue moon 2026-05-31, Harvest Moon 2026-09-26, supermoon 2026-12-24; ordinary full moons skipped", () => {
    const rows = moonRows(2026);
    expect(rows.map((r) => r.source_key).sort()).toEqual([
      "astronomy:moon:blue-moon:2026-05-31",
      "astronomy:moon:harvest-moon:2026-09-26",
      "astronomy:moon:supermoon:2026-12-24",
    ]);
    expect(rows.find((r) => r.title === "Supermoon")?.description).toMatch(/within 7 hours of perigee/);
    expect(rows.every((r) => r.popularity === 40)).toBe(true);
    expectValid(rows);
  });

  it("transits: Mercury 2032 and 2039 inside the horizon; Venus 2117 tagged far-future", () => {
    const rows = transitRows(NOW);
    expect(rows.map((r) => r.source_key)).toEqual([
      "astronomy:transit:mercury:2032-11-13",
      "astronomy:transit:mercury:2039-11-07",
      "astronomy:transit:venus:2117-12-11",
    ]);
    expect(rows[0].tags).not.toContain("far-future");
    expect(rows[2].tags).toContain("far-future");
    expect(rows[2].slug).toBe("transit-of-venus-2117-12-11");
    expect(rows.every((r) => r.popularity === 60)).toBe(true);
    expect(withinHorizon(rows, NOW)).toHaveLength(3);
    expectValid(rows);
  });
});

describe("JPL cad.api", () => {
  const main = parseCad(fixture("cad-main.json"));

  it("parses fields into typed rows and maps notable approaches", () => {
    expect(main).toHaveLength(14);
    const apophis = main.find((r) => r.des === "99942")!;
    expect(apophis.cd).toBe("2029-Apr-13 21:46");
    expect(apophis.h).toBeCloseTo(19.09);
    const rows = selectCad(main);
    expect(rows).toHaveLength(14);
    const ap = rows.find((r) => r.source_key === "astronomy:cad:99942:2462240")!;
    expect(ap.slug).toBe("asteroid-apophis-close-approach-2029-04-13");
    expect(ap.date).toBe("2029-04-13T21:46:00Z");
    expect(ap.date_precision).toBe("instant");
    expect(ap.timezone).toBe("UTC");
    expect(ap.confidence).toBe(0.9);
    expect(ap.featured).toBe(true);
    expect(ap.popularity).toBe(90);
    expect(ap.external_ids).toEqual({ jpl_des: "99942" });
    expect(ap.tags).toEqual(["asteroid", "space", "near-earth", "close-approach"]);
    expect(ap.source_url).toBe("https://ssd-api.jpl.nasa.gov/cad.api?des=99942&date-min=2029-01-01&date-max=2030-01-01&dist-max=0.2&fullname=true");
    expect(ap.description).toMatch(/38,011 km from Earth \(0\.1 lunar distances\) at 21:46 UTC on 13 April 2029/);
    expect(ap.description).toMatch(/Courtesy NASA\/JPL-Caltech\.$/);
    // Allowlisted rows sort first, then by brightness.
    expect(rows.slice(0, 4).every((r) => ["99942", "137108", "153814", "35396"].includes(String(r.external_ids.jpl_des)))).toBe(true);
    expectValid(rows);
  });

  it("large time uncertainty → day precision, confidence 0.6; sigma parsing; display names", () => {
    const rows = selectCad(main);
    const tw17 = rows.find((r) => r.source_key === "astronomy:cad:2024 TW17:2461723")!;
    expect(tw17.date).toBe("2027-11-13");
    expect(tw17.date_precision).toBe("day");
    expect(tw17.all_day).toBe(true);
    expect(tw17.confidence).toBe(0.6);
    expect(tw17.title).toBe("Asteroid 2024 TW17 close approach");
    expect(tw17.description).toMatch(/uncertain by about 4\.7 days/);
    expect(sigmaMinutes("< 00:01")).toBe(1);
    expect(sigmaMinutes("00:06")).toBe(6);
    expect(sigmaMinutes("13:07")).toBe(787);
    expect(sigmaMinutes("4_17:32")).toBe(4 * 1440 + 17 * 60 + 32);
    expect(Number.isNaN(sigmaMinutes("n/a"))).toBe(true);
    expect(displayName("99942 Apophis (2004 MN4)", "99942")).toBe("Apophis");
    expect(displayName("137108 (1999 AN10)", "137108")).toBe("1999 AN10");
    expect(displayName("       (2024 YR4)", "2024 YR4")).toBe("2024 YR4");
  });

  it("notability filter: allowlisted 2024 YR4 kept despite H 23.9; faint non-allowlisted rows dropped; cap and dedupe", () => {
    const yr4 = parseCad(fixture("cad-2024-yr4.json"));
    const faint = { ...yr4[0], des: "2030 AB1", fullname: "(2030 AB1)", jd: 2463588.9 };
    const rows = selectCad([...main, ...yr4, faint, ...yr4]);
    expect(rows.some((r) => r.source_key === "astronomy:cad:2024 YR4:2463589")).toBe(true);
    expect(rows.some((r) => r.slug.startsWith("asteroid-2030-ab1"))).toBe(false);
    expect(rows.filter((r) => r.source_key.includes("2024 YR4"))).toHaveLength(1);
    expect(rows.find((r) => r.source_key.includes("2024 YR4"))?.popularity).toBe(45);
    const many = Array.from({ length: 80 }, (_, i) => ({ ...main[0], des: `2027 AA${i}`, fullname: `(2027 AA${i})`, jd: 2461624.8 + i, h: 18 }));
    expect(selectCad(many)).toHaveLength(50);
  });
});

describe("JPL SBDB comets", () => {
  const sbdb = parseSbdb(fixture("sbdb-comets.json"));

  it("parses designations and refreshes only allowlisted comets with a future tp_cal", () => {
    expect(sbdb).toHaveLength(5);
    expect(sbdb.map((r) => r.des)).toEqual(["450P", "C/2014 UN271", "C/2023 RS61", "C/2024 D1", "C/2024 J3"]);
    expect(sbdbDesignation("  1P/Halley")).toBe("1P");
    expect(sbdbDesignation("P/2025 D2 (PANSTARRS)")).toBe("P/2025 D2");
    expect(tpCalToDay("2027-01-21.2")).toBe("2027-01-21");
    expect(sbdbQueryUrl(NOW, new Date("2041-09-09T12:00:00Z"))).toContain(encodeURIComponent('{"AND":["tp|GT|2461293.0","tp|LT|2466772.0"]}'));

    const rows = cometRows(sbdb, NOW);
    expect(rows).toHaveLength(10); // survey comets in the response are never emitted
    const encke = rows.find((r) => r.source_key === "astronomy:comet:2P:2027")!;
    expect(encke.date).toBe("2027-02-01");
    expect(encke.date_precision).toBe("month");
    expect(encke.status).toBe("tentative");
    expect(encke.confidence).toBe(0.5);
    expect(encke.source_url).toBe("https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=2P");
    const halley = rows.find((r) => r.source_key === "astronomy:comet:1P:2061")!;
    expect(halley.slug).toBe("halley-s-comet-perihelion-2061-07-28"); // same slug as the curated one-off → one row after merge
    expect(halley.tags).toContain("far-future");
    expect(halley.date_precision).toBe("day");
    expect(rows.filter((r) => r.date_precision === "year").every((r) => r.status === "tentative")).toBe(true);

    const refreshed = cometRows([...sbdb, { full_name: "2P/Encke", des: "2P", tp: 2461468.3, tp_cal: "2027-02-19.3", per_y: 3.3, q: 0.34 }], NOW);
    const encke2 = refreshed.find((r) => r.source_key === "astronomy:comet:2P:2027")!;
    expect(encke2.date).toBe("2027-02-19");
    expect(encke2.date_precision).toBe("day");
    expect(encke2.status).toBe("scheduled");
    expect(encke2.confidence).toBe(0.8);
    expect(encke2.description).toMatch(/on 19 February 2027/);
    const stale = cometRows([{ full_name: "2P/Encke", des: "2P", tp: 2460239.9, tp_cal: "2023-10-22.4", per_y: 3.3, q: 0.34 }], NOW);
    expect(stale.find((r) => r.source_key === "astronomy:comet:2P:2027")?.date).toBe("2027-02-01");
    expectValid([...rows, ...refreshed]);
  });
});

describe("astronomy adapter: units, cursor, run", () => {
  it("plans 16 years × 5 sky kinds + transits, cad, comets with content-addressed cursors", async () => {
    const units = unitList(NOW);
    expect(units).toHaveLength(16 * 5 + 3);
    expect(units[0]).toMatchObject({ key: "astronomy:eclipses:2026", kind: "eclipses", year: 2026, after: { afterKey: "eclipses:2026" } });
    expect(units.at(-1)).toMatchObject({ key: "astronomy:comets", kind: "comets", after: { afterKey: "comets" } });
    const plan = await adapter.plan(null, ctxWith(async () => ({})));
    expect(plan.done).toBe(true);
    expect(plan.units).toHaveLength(83);
    expect(parseCursor({ afterKey: "showers:2040" })).toBe("showers:2040");
    expect(parseCursor({ i: 3 })).toBeNull();
    expect(parseCursor([1])).toBeNull();
    const resumed = planUnits(NOW, "showers:2040");
    expect(resumed.map((u) => u.key)).toEqual([
      "astronomy:eclipses:2041",
      "astronomy:seasons:2041",
      "astronomy:moon:2041",
      "astronomy:planets:2041",
      "astronomy:showers:2041",
      "astronomy:transits",
      "astronomy:cad",
      "astronomy:comets",
    ]);
    expect(planUnits(NOW, "cad").map((u) => u.key)).toEqual(["astronomy:comets"]);
    expect(planUnits(NOW, "comets")).toEqual([]);
    expect(planUnits(NOW, "unknown:key")).toHaveLength(83); // foreign cursor → restart
    expect(adapter.limits).toEqual({ concurrency: 1, minIntervalMs: 2000, timeoutMs: 30_000, maxRetries: 2 });
    expect(adapter.cadence).toBe("monthly");
    expect(adapter.isConfigured()).toBe(true);
  });

  it("cad unit: one main request, `des=` lookups only for allowlisted objects the main query missed, horizon applied", async () => {
    const urls: string[] = [];
    const ctx = ctxWith(async (url) => {
      urls.push(url);
      if (url.includes("des=2024%20YR4")) return fixture("cad-2024-yr4.json");
      if (url.includes("des=99942")) return fixture("cad-apophis.json");
      if (url.includes("des=")) return { count: 0, fields: [], data: [] };
      return fixture("cad-main.json");
    });
    const unit = unitList(NOW).find((u) => u.kind === "cad")!;
    const rows = await adapter.run(unit, ctx);
    expect(urls[0]).toBe("https://ssd-api.jpl.nasa.gov/cad.api?date-min=2026-09-09&date-max=2041-09-09&dist-max=0.01&h-max=22&sort=date&fullname=true");
    expect(urls).toHaveLength(2); // main + 2024 YR4 (Apophis, 1999 AN10, 2001 WN5, 1997 XF11 were in the main response)
    expect(urls[1]).toBe("https://ssd-api.jpl.nasa.gov/cad.api?des=2024%20YR4&date-min=2026-09-09&date-max=2041-09-09&dist-max=0.05&fullname=true");
    expect(rows).toHaveLength(15);
    expect(rows.map((r) => r.source_key)).toContain("astronomy:cad:2024 YR4:2463589");
    expectValid(rows);
    // A response containing approaches beyond now + 15 y (Apophis 2044/2051) loses them to the horizon.
    const far = selectCad(parseCad(fixture("cad-apophis.json")));
    expect(far).toHaveLength(3);
    expect(withinHorizon(far, NOW).map((r) => r.slug)).toEqual(["asteroid-apophis-close-approach-2029-04-13"]);
    // A failed lookup is logged, not fatal.
    const flaky = ctxWith(async (url) => {
      if (url.includes("des=")) throw new Error("HTTP 503");
      return fixture("cad-main.json");
    });
    expect(await adapter.run(unit, flaky)).toHaveLength(14);
  });

  it("comets unit: SBDB refresh is best-effort (curated dates stand when the query fails)", async () => {
    const unit = unitList(NOW).find((u) => u.kind === "comets")!;
    const ok = await adapter.run(unit, ctxWith(async () => fixture("sbdb-comets.json")));
    const failed = await adapter.run(unit, ctxWith(async () => { throw new Error("HTTP 502"); }));
    expect(ok.map((r) => r.source_key)).toEqual(failed.map((r) => r.source_key));
    expect(ok).toHaveLength(10);
    expect(ok.filter((r) => r.tags.includes("far-future")).map((r) => r.source_key)).toEqual([
      "astronomy:comet:1P:2061",
      "astronomy:comet:12P:2095",
      "astronomy:comet:109P:2126",
    ]);
  });

  it("a full offline pass validates, has unique source_keys, no year-placeholder without tentative, and is identical when repeated", async () => {
    const ctx = ctxWith(async () => ({}));
    const offline = unitList(NOW).filter((u) => u.kind !== "cad" && u.kind !== "comets");
    const pass = async () => {
      const out: IngestEvent[] = [];
      for (const u of offline) out.push(...(await adapter.run(u, ctx)));
      return out;
    };
    const a = await pass();
    const b = await pass();
    expect(a.length).toBeGreaterThan(300);
    expect(new Set(a.map((r) => r.source_key)).size).toBe(a.length);
    expect(a.map((r) => [r.source_key, r.content_hash])).toEqual(b.map((r) => [r.source_key, r.content_hash]));
    expect(a.every((r) => r.date_precision !== "year" || r.status === "tentative")).toBe(true);
    expect(a.every((r) => !r.slug.startsWith("mine-") && !r.slug.startsWith("share-"))).toBe(true);
    expect(a.filter((r) => r.date > "2041-09-09" && !r.tags.includes("far-future"))).toEqual([]);
    expect(a.filter((r) => r.date < "2026-09-07")).toEqual([]);
    expectValid(a);
  }, 30_000);
});
