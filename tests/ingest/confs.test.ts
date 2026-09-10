import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { HttpError } from "@/lib/ingest/http";
import { IngestEventSchema, type IngestContext } from "@/lib/ingest/types";
import { COUNTRY_NAMES } from "@/lib/regions";
import {
  acceptEntry,
  adapter,
  CONFS_MIRROR_BASE,
  CONFS_RAW_BASE,
  CONFS_TOPICS,
  type ConfsEntry,
  countryCode,
  describeConf,
  entriesToEvents,
  fetchTopicFile,
  formatSpan,
  horizonDay,
  normalizeCountry,
  planUnits,
  resetCountryWarnings,
  topicIds,
} from "@/lib/ingest/sources/confs";

/** All fixture conferences start after this day (earliest: CityJS Singapore, 2026-02-04). */
const NOW = new Date("2026-01-15T12:00:00Z");
const TODAY = "2026-01-15";

function fixture(topic: string): ConfsEntry[] {
  return JSON.parse(readFileSync(new URL(`../fixtures/confs/2026-${topic}.json`, import.meta.url), "utf8"));
}
const FIXTURES: Record<string, ConfsEntry[]> = { javascript: fixture("javascript"), typescript: fixture("typescript"), general: fixture("general") };

type Behaviour = (host: "raw" | "mirror", year: number, topic: string) => unknown;

/** A ctx whose http answers from the fixtures; `behaviour` may throw to simulate host failures. */
/** `maxRetries` / `timeoutMs` seen per request URL (the primary host must fail fast: the mirror is the retry). */
type Seen = { maxRetries?: number; timeoutMs?: number };
let RETRIES_SEEN = new Map<string, Seen>();

beforeEach(() => {
  RETRIES_SEEN = new Map();
  resetCountryWarnings();
});

function ctxFor(calls: string[] = [], behaviour?: Behaviour, now = NOW): IngestContext {
  return {
    http: {
      fetchJson: async <T,>(url: string, init?: Seen) => {
        calls.push(url);
        RETRIES_SEEN.set(url, { maxRetries: init?.maxRetries, timeoutMs: init?.timeoutMs });
        const m = /\/conferences\/(\d{4})\/([a-z]+)\.json$/.exec(url);
        if (!m) throw new HttpError(404, url);
        const host = url.startsWith(CONFS_RAW_BASE) ? "raw" : url.startsWith(CONFS_MIRROR_BASE) ? "mirror" : null;
        if (!host) throw new HttpError(404, url);
        if (behaviour) {
          const out = behaviour(host, Number(m[1]), m[2]);
          if (out !== undefined) return out as T;
        }
        const body = m[1] === "2026" ? FIXTURES[m[2]] : undefined;
        if (!body) throw new HttpError(404, url);
        return body as T;
      },
      fetchText: async () => "",
    },
    log: { info() {}, warn() {}, error() {} },
    now,
    budget: { remainingMs: () => 60_000 },
    dryRun: true,
  };
}

const entry = (over: Partial<ConfsEntry> = {}): ConfsEntry => ({
  name: "ZurichJS Conf",
  url: "https://conf.zurichjs.com",
  startDate: "2026-09-10",
  endDate: "2026-09-11",
  city: "Zurich",
  country: "Switzerland",
  online: false,
  cfpUrl: "https://conf.zurichjs.com/cfp",
  cfpEndDate: "2026-04-01",
  ...over,
});

describe("confs fixture → rows", () => {
  it("run(year unit) merges topic files, keys rows by confs:<year>:<slug>:<start>, and is stable across two calls", async () => {
    const calls: string[] = [];
    const ctx = ctxFor(calls);
    const rows = await adapter.run((await adapter.plan(null, ctx)).units[0], ctx);
    const again = await adapter.run((await adapter.plan(null, ctx)).units[0], ctx);
    expect(rows.map((r) => r.source_key)).toEqual([
      "confs:2026:ai-coding-summit:2026-02-26",
      "confs:2026:cityjs-singapore:2026-02-04",
      "confs:2026:developerweek:2026-02-18",
      "confs:2026:zurichjs-conf:2026-09-10",
    ]);
    expect(again.map((r) => r.source_key)).toEqual(rows.map((r) => r.source_key));
    expect(again.map((r) => r.content_hash)).toEqual(rows.map((r) => r.content_hash));
    // 30 topic files per year, every one asked from the primary host once (404s are not retried on the mirror).
    expect(calls.filter((u) => u.startsWith(CONFS_RAW_BASE)).length).toBe(CONFS_TOPICS.length * 2);
    expect(calls.some((u) => u.startsWith(CONFS_MIRROR_BASE))).toBe(false);
    for (const row of rows) {
      const parsed = IngestEventSchema.safeParse(row);
      expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
      expect(row.source).toBe("confs");
      expect(row.category).toBe("tech");
      expect(row.date_precision).toBe("day");
      expect(row.status).toBe("scheduled");
      expect(row.all_day).toBe(true);
      expect(row.timezone).toBeNull();
      expect(row.confidence).toBe(0.8);
      expect(row.featured).toBe(false);
      expect(row.image_candidate_url).toBeNull();
      expect(row.external_ids).toEqual({});
      expect(row.popularity).toBeLessThanOrEqual(30);
    }
  });

  it("in-person row: title gets the year, regions from the country, location + jsonld, cfp tag, own description", async () => {
    const ctx = ctxFor();
    const rows = await adapter.run((await adapter.plan(null, ctx)).units[0], ctx);
    const zurich = rows.find((r) => r.source_key === "confs:2026:zurichjs-conf:2026-09-10")!;
    expect(zurich.title).toBe("ZurichJS Conf 2026");
    expect(zurich.slug).toBe("zurichjs-conf-2026-2026-09-10");
    expect(zurich.date).toBe("2026-09-10");
    expect(zurich.end_date).toBe("2026-09-11");
    expect(zurich.regions).toEqual(["CH"]);
    expect(zurich.tags).toEqual(["conference", "javascript", "cfp"]);
    expect(zurich.location).toEqual({ city: "Zurich", country: "CH" });
    expect(zurich.jsonld_eligible).toBe(true);
    expect(zurich.source_url).toBe("https://conf.zurichjs.com");
    expect(zurich.popularity).toBe(20);
    expect(zurich.description).toBe(
      "ZurichJS Conf is a JavaScript conference held in Zurich, Switzerland. It runs from September 10 to September 11, 2026. The call for papers closes on April 1, 2026.",
    );
    // A CFP that already closed is not mentioned, but the cfp tag (cfpUrl) stays.
    const cityjs = rows.find((r) => r.source_key === "confs:2026:cityjs-singapore:2026-02-04")!;
    // City-state: "Singapore, Singapore" collapses to one mention.
    expect(cityjs.description).toBe("CityJS Singapore is a JavaScript conference held in Singapore. It runs from February 4 to February 6, 2026.");
    expect(cityjs.tags).toContain("cfp");
    expect(cityjs.regions).toEqual(["SG"]);
  });

  it("online row listed in two topic files: topics merged into tags, GLOBAL region, no location, not jsonld", async () => {
    const ctx = ctxFor();
    const rows = await adapter.run((await adapter.plan(null, ctx)).units[0], ctx);
    const summit = rows.find((r) => r.source_key === "confs:2026:ai-coding-summit:2026-02-26")!;
    expect(summit.tags).toEqual(["conference", "javascript", "typescript", "cfp", "online"]);
    expect(summit.regions).toEqual(["GLOBAL"]);
    expect(summit.location).toBeNull();
    expect(summit.jsonld_eligible).toBe(false);
    expect(summit.description).toBe(
      "AI Coding Summit is a JavaScript and TypeScript conference held online. It runs from February 26 to February 27, 2026. The call for papers closes on January 26, 2026.",
    );
    expect((summit.raw as { topics: string[]; files: string[] }).files).toEqual(["2026/javascript", "2026/typescript"]);
  });

  it("general.json rows: popularity 25, 'developer' wording, U.S.A. resolved to US", async () => {
    const ctx = ctxFor();
    const rows = await adapter.run((await adapter.plan(null, ctx)).units[0], ctx);
    const dw = rows.find((r) => r.source_key === "confs:2026:developerweek:2026-02-18")!;
    expect(dw.popularity).toBe(25);
    expect(dw.regions).toEqual(["US"]);
    expect(dw.location).toEqual({ city: "San Jose, CA", country: "US" });
    // The ISO English name, not whatever label src/data/countries.json currently carries.
    expect(dw.description).toBe("DeveloperWeek is a developer conference held in San Jose, CA, United States. It runs from February 18 to February 20, 2026.");
  });
});

describe("confs entry rules", () => {
  const horizon = horizonDay(NOW);

  it("filters: past start, beyond 18 months, short name, missing/invalid url, bad dates, label-year mismatch", () => {
    expect(horizon).toBe("2027-07-15");
    expect(acceptEntry(entry(), TODAY, horizon)).not.toBeNull();
    expect(acceptEntry(entry({ startDate: "2026-01-14" }), TODAY, horizon)).toBeNull();
    expect(acceptEntry(entry({ startDate: "2026-01-15" }), TODAY, horizon)).not.toBeNull();
    expect(acceptEntry(entry({ startDate: "2027-07-16", endDate: "2027-07-17" }), TODAY, horizon)).toBeNull();
    expect(acceptEntry(entry({ name: "JS" }), TODAY, horizon)).toBeNull();
    expect(acceptEntry(entry({ url: null }), TODAY, horizon)).toBeNull();
    expect(acceptEntry(entry({ url: "conf.zurichjs.com" }), TODAY, horizon)).toBeNull();
    expect(acceptEntry(entry({ startDate: "2026-9-10" }), TODAY, horizon)).toBeNull();
    expect(acceptEntry(entry({ startDate: "2026-02-30" }), TODAY, horizon)).toBeNull();
    expect(acceptEntry(entry({ name: "ZurichJS Conf 2025" }), TODAY, horizon)).toBeNull();
    expect(acceptEntry(entry({ name: "ZurichJS Conf 2026" }), TODAY, horizon)).not.toBeNull();
    // An end before the start is dropped, not the row.
    expect(acceptEntry(entry({ endDate: "2026-09-01" }), TODAY, horizon)?.endDate).toBeNull();
    expect(acceptEntry(entry({ endDate: null }), TODAY, horizon)?.endDate).toBeNull();
  });

  it("a name that already carries the year is not suffixed; the year in source_key is the start year, not the file year", () => {
    const rows = entriesToEvents(
      [
        { topic: "rust", year: 2026, entries: [entry({ name: "RustConf 2026" })] },
        { topic: "general", year: 2026, entries: [entry({ name: "New Year Dev Days", startDate: "2027-01-08", endDate: "2027-01-09" })] },
      ],
      NOW,
    );
    expect(rows.map((r) => [r.title, r.source_key, r.slug])).toEqual([
      ["RustConf 2026", "confs:2026:rustconf-2026:2026-09-10", "rustconf-2026-2026-09-10"],
      ["New Year Dev Days 2027", "confs:2027:new-year-dev-days:2027-01-08", "new-year-dev-days-2027-2027-01-08"],
    ]);
  });

  it("unknown country: GLOBAL region, location without a country code, not jsonld; hybrid online keeps the city in the text only", () => {
    const [unknown] = entriesToEvents([{ topic: "php", year: 2026, entries: [entry({ country: "Atlantis" })] }], NOW);
    expect(unknown.regions).toEqual(["GLOBAL"]);
    expect(unknown.location).toEqual({ city: "Zurich" });
    expect(unknown.jsonld_eligible).toBe(false);
    expect(unknown.description.startsWith("ZurichJS Conf is a PHP conference held in Zurich, Atlantis.")).toBe(true);
    const [hybrid] = entriesToEvents([{ topic: "php", year: 2026, entries: [entry({ online: true })] }], NOW);
    expect(hybrid.regions).toEqual(["GLOBAL"]);
    expect(hybrid.location).toBeNull();
    expect(hybrid.tags).toContain("online");
    expect(hybrid.description.startsWith("ZurichJS Conf is a PHP conference held online and in Zurich, Switzerland.")).toBe(true);
  });

  it("merging keeps the richer copy: city/country and CFP from whichever file has them", () => {
    const rows = entriesToEvents(
      [
        { topic: "javascript", year: 2026, entries: [entry({ city: null, country: null, cfpUrl: null, cfpEndDate: null })] },
        { topic: "css", year: 2026, entries: [entry()] },
      ],
      NOW,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].regions).toEqual(["CH"]);
    expect(rows[0].tags).toEqual(["conference", "css", "javascript", "cfp"]);
    expect(rows[0].description).toContain("The call for papers closes on April 1, 2026.");
  });

  it("wording helpers: articles, general dropped next to a specific topic, single-day and cross-year spans", () => {
    expect(topicIds(["general", "typescript", "api"])).toEqual(["api", "typescript"]);
    expect(topicIds(["general"])).toEqual(["general"]);
    expect(topicIds(["nonsense"])).toEqual([]);
    const d = { ...acceptEntry(entry({ endDate: null }), TODAY, horizon)!, topics: new Set(["api"]), files: new Set(["2026/api"]) };
    expect(describeConf(d, TODAY)).toBe(
      "ZurichJS Conf is an API conference held in Zurich, Switzerland. It runs on September 10, 2026. The call for papers closes on April 1, 2026.",
    );
    expect(formatSpan("2026-12-30", "2027-01-02")).toBe("from December 30, 2026 to January 2, 2027");
    expect(formatSpan("2026-09-10", "2026-09-10")).toBe("on September 10, 2026");
  });

  it("country names: exact English names and dataset aliases, never substring matches", () => {
    expect(countryCode("Germany")).toBe("DE");
    expect(countryCode("U.S.A.")).toBe("US");
    expect(countryCode("U.K.")).toBe("GB");
    expect(countryCode("Czech Republic")).toBe("CZ");
    expect(countryCode("czechia")).toBe("CZ");
    expect(countryCode("Netherlands")).toBe("NL");
    expect(countryCode("United Arab Emirates")).toBe("AE");
    expect(countryCode("Ireland")).toBe("IE");
    expect(countryCode("Italy")).toBe("IT");
    expect(countryCode("Ger")).toBeNull();
    expect(countryCode("Republic")).toBeNull();
    expect(countryCode("")).toBeNull();
    expect(countryCode(undefined)).toBeNull();
  });

  it("resolves every ISO English name, independently of what src/data/countries.json currently says", () => {
    // countries.json is shared (date-holidays-derived labels, other agents edit it). The resolver
    // must not depend on its wording: if this ever fails, confs rows silently fall back to GLOBAL.
    const display = new Intl.DisplayNames(["en"], { type: "region" });
    const unresolved: string[] = [];
    for (const code of Object.keys(COUNTRY_NAMES)) {
      if (code === "GLOBAL") continue;
      const english = display.of(code);
      if (!english || english === code) continue;
      if (countryCode(english) !== code) unresolved.push(`${code}: ${english}`);
    }
    expect(unresolved).toEqual([]);
    // Long-form and locally spelled labels resolve through the same normalisation.
    expect(countryCode("Kingdom of Morocco")).toBe("MA");
    expect(countryCode("People's Republic of Bangladesh")).toBe("BD");
    expect(countryCode("Bosnia & Herzegovina")).toBe("BA");
    expect(countryCode("Bosnia and Herzegovina")).toBe("BA");
    expect(countryCode("Côte d\u2019Ivoire")).toBe("CI"); // curly apostrophe (the ISO spelling)
    expect(countryCode("Cote d'Ivoire")).toBe("CI");
    expect(countryCode("The Gambia")).toBe("GM");
    expect(countryCode("Hong Kong")).toBe("HK");
    expect(normalizeCountry("  St.\u00a0Barth\u00e9lemy ")).toBe("st barthelemy");
    expect(normalizeCountry("Republic of Türkiye")).toBe("turkiye");
  });

  it("logs an unrecognised country name once and keeps the row GLOBAL", () => {
    const warnings: string[] = [];
    const log = { warn: (m: string) => warnings.push(m) };
    expect(countryCode("Atlantis", log)).toBeNull();
    expect(countryCode("atlantis", log)).toBeNull();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Atlantis");
  });

  it("markup and entities in city/country are sanitized out of the description and location", () => {
    const [row] = entriesToEvents(
      [{ topic: "php", year: 2026, entries: [entry({ city: "Z\u00fcrich <b>[old]</b>", country: "Switzerland&nbsp;" })] }],
      NOW,
    );
    expect(row.location).toEqual({ city: "Zürich", country: "CH" });
    expect(row.description.startsWith("ZurichJS Conf is a PHP conference held in Zürich, Switzerland.")).toBe(true);
  });
});

describe("confs hosts and plan", () => {
  it("falls back to the jsDelivr mirror on a non-404 failure and skips the topic on 404 without touching the mirror", async () => {
    const calls: string[] = [];
    const ctx = ctxFor(calls, (host, year, topic) => {
      if (year === 2026 && topic === "javascript" && host === "raw") throw new HttpError(503, "raw");
      if (year === 2026 && topic === "typescript" && host === "raw") return { not: "an array" };
      return undefined;
    });
    expect(await fetchTopicFile(ctx, 2026, "javascript")).toEqual(FIXTURES.javascript);
    expect(await fetchTopicFile(ctx, 2026, "typescript")).toEqual(FIXTURES.typescript);
    // A 404 from the primary is authoritative: the file does not exist this year, mirror untouched.
    expect(await fetchTopicFile(ctx, 2026, "rust")).toBeNull();
    expect(await fetchTopicFile(ctx, 2027, "javascript")).toBeNull();
    expect(calls).toEqual([
      `${CONFS_RAW_BASE}/2026/javascript.json`,
      `${CONFS_MIRROR_BASE}/2026/javascript.json`,
      `${CONFS_RAW_BASE}/2026/typescript.json`,
      `${CONFS_MIRROR_BASE}/2026/typescript.json`,
      `${CONFS_RAW_BASE}/2026/rust.json`,
      `${CONFS_RAW_BASE}/2027/javascript.json`,
    ]);
    expect(RETRIES_SEEN.get(`${CONFS_RAW_BASE}/2026/javascript.json`)).toEqual({ maxRetries: 0, timeoutMs: 8_000 });
    expect(RETRIES_SEEN.get(`${CONFS_MIRROR_BASE}/2026/javascript.json`)).toEqual({ maxRetries: undefined, timeoutMs: undefined });
  });

  it("a 404 from the mirror after a non-404 primary failure is not proof of absence: it fails the unit", async () => {
    // raw 503s (its Fastly edge does this in bursts) and jsDelivr answers 404 for a cold path.
    // Returning null here would drop a whole topic and let mark_stale_records demote its rows.
    const ctx = ctxFor([], (host, _year, topic) => {
      if (topic !== "javascript") return undefined;
      throw new HttpError(host === "raw" ? 503 : 404, host);
    });
    await expect(fetchTopicFile(ctx, 2026, "javascript")).rejects.toMatchObject({ status: 404 });
  });

  it("a mixed year (genuine 404s on the primary plus one mirror fallback) still returns every merged row", async () => {
    const calls: string[] = [];
    const ctx = ctxFor(calls, (host, _year, topic) => {
      if (topic === "general" && host === "raw") throw new HttpError(503, "raw");
      return undefined;
    });
    const rows = await adapter.run((await adapter.plan(null, ctx)).units[0], ctx);
    // 28 topic files legitimately 404 on the primary, general falls back to the mirror.
    expect(calls.filter((u) => u.startsWith(CONFS_MIRROR_BASE))).toEqual([`${CONFS_MIRROR_BASE}/2026/general.json`]);
    expect(rows.map((r) => r.source_key)).toContain("confs:2026:developerweek:2026-02-18");
    expect(rows).toHaveLength(4);
  });

  it("a 429 from the primary is retried once with backoff before the mirror is asked", async () => {
    const calls: string[] = [];
    let throttled = 0;
    const ctx = ctxFor(calls, (host, _year, topic) => {
      if (topic === "javascript" && host === "raw" && throttled++ === 0) throw new HttpError(429, "raw");
      return undefined;
    });
    expect(await fetchTopicFile(ctx, 2026, "javascript")).toEqual(FIXTURES.javascript);
    expect(calls).toEqual([`${CONFS_RAW_BASE}/2026/javascript.json`, `${CONFS_RAW_BASE}/2026/javascript.json`]);
    // The second primary attempt lets ctx.http honour Retry-After instead of hitting a second host.
    expect(RETRIES_SEEN.get(`${CONFS_RAW_BASE}/2026/javascript.json`)).toEqual({ maxRetries: 1, timeoutMs: 8_000 });
  });

  it("a unit whose remaining budget cannot cover another topic file throws instead of returning a short year", async () => {
    const ctx = { ...ctxFor(), budget: { remainingMs: () => 5_000 } };
    await expect(adapter.run((await adapter.plan(null, ctx)).units[0], ctx)).rejects.toMatchObject({ name: "BudgetExceededError" });
  });

  it("fails the unit when both hosts fail for a topic (so the runner keeps the cursor)", async () => {
    const ctx = ctxFor([], (host, _year, topic) => {
      if (topic === "css") throw new HttpError(host === "raw" ? 503 : 500, host);
      return undefined;
    });
    await expect(adapter.run((await adapter.plan(null, ctx)).units[0], ctx)).rejects.toBeInstanceOf(HttpError);
  });

  it("plans two year units with content-addressed cursors; a mid-pass cursor skips upserted years; a stale one restarts", async () => {
    const ctx = ctxFor();
    const plan = await adapter.plan(null, ctx);
    expect(plan.done).toBe(true);
    expect(plan.units.map((u) => [u.key, u.year, u.after])).toEqual([
      ["confs:year:2026", 2026, { afterYear: 2026, fetchedOn: TODAY }],
      ["confs:year:2027", 2027, { afterYear: 2027, fetchedOn: TODAY }],
    ]);
    expect(planUnits(NOW, { afterYear: 2026, fetchedOn: TODAY }).map((u) => u.year)).toEqual([2027]);
    expect(planUnits(NOW, { afterYear: 2027, fetchedOn: TODAY }).map((u) => u.year)).toEqual([2026, 2027]);
    expect(planUnits(NOW, { afterYear: 2020 }).map((u) => u.year)).toEqual([2026, 2027]);
    expect(planUnits(NOW, [1, 2]).map((u) => u.year)).toEqual([2026, 2027]);
    expect(adapter.id).toBe("confs");
    expect(adapter.rank).toBe(4);
    expect(adapter.cadence).toBe("weekly");
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.limits).toEqual({ concurrency: 1, minIntervalMs: 500, timeoutMs: 20_000, maxRetries: 2 });
  });
});
