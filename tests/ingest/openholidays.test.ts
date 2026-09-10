import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  adapter,
  categoryFor,
  fetchCountries,
  holidayToEvent,
  holidaysToEvents,
  OPENHOLIDAYS_COUNTRIES,
  parseCursor,
  pickName,
  planUnits,
  publicHolidaysUrl,
  WINDOW_DAYS,
  windowFor,
  yearSourceUrl,
  type OpenHolidayRow,
} from "@/lib/ingest/sources/openholidays";
import { IngestEventSchema, type IngestContext, type IngestEvent } from "@/lib/ingest/types";

const NOW = new Date("2026-09-09T12:00:00Z");
const fixture = JSON.parse(readFileSync(new URL("../fixtures/openholidays/de-2027.json", import.meta.url), "utf8")) as OpenHolidayRow[];
const countriesFixture = JSON.parse(readFileSync(new URL("../fixtures/openholidays/countries.json", import.meta.url), "utf8")) as unknown[];

const log = { info() {}, warn() {}, error() {} };

/** ctx whose http serves the fixtures (Countries → countries.json, PublicHolidays → de-2027.json). */
function fakeCtx(overrides: { countries?: unknown; holidays?: unknown; fail?: boolean } = {}): IngestContext & { urls: string[] } {
  const urls: string[] = [];
  return {
    urls,
    http: {
      async fetchJson<T>(url: string): Promise<T> {
        urls.push(url);
        if (overrides.fail) throw new Error("boom");
        if (url.includes("/Countries")) return (overrides.countries ?? countriesFixture) as T;
        return (overrides.holidays ?? fixture) as T;
      },
      async fetchText(): Promise<string> {
        throw new Error("not used");
      },
    },
    log,
    now: NOW,
    budget: { remainingMs: () => 120_000 },
    dryRun: true,
  };
}

const opts = { country: "DE", now: NOW };
const YEAR_URL_RE = /validFrom=(\d{4})-01-01&validTo=\1-12-31$/;
const byTitle = (rows: IngestEvent[], title: string) => rows.find((r) => r.title === title);

describe("openholidays adapter", () => {
  it("run(unit) over the fixture keeps nationwide public holidays with stable source_keys across two calls", async () => {
    const ctx = fakeCtx();
    const unit = planUnits(["DE"], null, NOW)[0];
    const a = await adapter.run(unit, ctx);
    const b = await adapter.run(unit, ctx);
    expect(a.map((r) => r.source_key)).toEqual(b.map((r) => r.source_key));
    expect(a.map((r) => r.content_hash)).toEqual(b.map((r) => r.content_hash));
    expect(a.map((r) => r.title).sort()).toEqual(["Christmas Day", "Day of German Unity", "Easter Monday", "New Year's Day"]);
    for (const r of a) {
      const parsed = IngestEventSchema.safeParse(r);
      expect(parsed.success, `${r.slug}: ${JSON.stringify(parsed.success ? null : parsed.error.issues)}`).toBe(true);
    }
    expect(ctx.urls.at(-1)).toBe(publicHolidaysUrl("DE", "2026-09-08", "2029-09-06"));
  });

  it("content_hash does not drift with `now`: the same rows a week later hash identically and source_url is year-scoped", async () => {
    const later = new Date(NOW.getTime() + 7 * 86_400_000);
    const a = await adapter.run(planUnits(["DE"], null, NOW)[0], fakeCtx());
    const ctxLater = fakeCtx();
    ctxLater.now = later;
    const b = await adapter.run(planUnits(["DE"], null, later)[0], ctxLater);
    expect(a).toHaveLength(4);
    expect(a.map((r) => r.source_key)).toEqual(b.map((r) => r.source_key));
    expect(a.map((r) => r.content_hash)).toEqual(b.map((r) => r.content_hash));
    expect(a.map((r) => r.source_url)).toEqual(b.map((r) => r.source_url));
    expect(ctxLater.urls.at(-1)).toBe(publicHolidaysUrl("DE", "2026-09-15", "2029-09-13")); // the request window did slide
    for (const r of [...a, ...b]) expect(r.source_url, r.slug).toMatch(YEAR_URL_RE);
    // a row sliding from window 1 into window 0 keeps its hash too
    const w1 = await adapter.run(planUnits(["DE"], null, NOW)[1], fakeCtx());
    expect(w1.map((r) => r.content_hash)).toEqual(a.map((r) => r.content_hash));
  });

  it("maps fields: day precision, scheduled, all-day, no timezone, regions=[CC], deterministic key, year-scoped source_url", () => {
    const rows = holidaysToEvents(fixture, opts);
    const ny = byTitle(rows, "New Year's Day")!;
    expect(ny.slug).toBe("new-year-s-day-2027-01-01");
    expect(ny.source).toBe("openholidays");
    // source_key scheme: openholidays:<CC>:<startDate>:<slugify(title)> — never the upstream UUID,
    // so an upstream data reload with fresh ids cannot orphan the keys (mark_stale_records would
    // otherwise flip the merged marquee rows to `tentative`). The UUID lives in external_ids only.
    expect(ny.source_key).toBe("openholidays:DE:2027-01-01:new-year-s-day");
    expect(ny.source_key).not.toContain("a9951b88");
    expect(ny.external_ids).toEqual({ openholidays: "a9951b88-fbfa-4634-8b80-39c60abb2a0c" });
    expect(holidayToEvent({ ...fixture[0], id: "00000000-0000-4000-8000-000000000000" }, opts)?.source_key).toBe(ny.source_key); // id change: same key
    expect(ny.source_url).toBe(publicHolidaysUrl("DE", "2027-01-01", "2027-12-31"));
    expect(yearSourceUrl("de", "2027-12-25")).toBe(ny.source_url);
    expect(ny.date).toBe("2027-01-01");
    expect(ny.end_date).toBeNull();
    expect(ny.all_day).toBe(true);
    expect(ny.timezone).toBeNull();
    expect(ny.date_precision).toBe("day");
    expect(ny.status).toBe("scheduled");
    expect(ny.confidence).toBe(0.95);
    expect(ny.featured).toBe(false);
    expect(ny.popularity).toBe(30);
    expect(ny.regions).toEqual(["DE"]);
    expect(ny.series_slug).toBeNull();
    expect(ny.location).toBeNull();
    expect(ny.jsonld_eligible).toBe(false);
    expect(ny.image_candidate_url).toBeNull();
    expect(ny.tags).toEqual(expect.arrayContaining(["new-year", "public-holiday", "openholidays", "public"]));
    // Nationwide prose is country-neutral: it wins the slug merge with the multi-country `holidays` row.
    expect(ny.description).toBe(
      "New Year's Day is an official public holiday that falls on Friday, 1 January 2027. Government offices, schools and most businesses close for the day.",
    );
    expect(ny.description).not.toMatch(/Germany|nationwide/);
    expect(ny.description.length).toBeGreaterThanOrEqual(80);
    expect((ny.raw as OpenHolidayRow).name?.[0]?.text).toBe("New Year's Day");
  });

  it("categories: national day → national, religious feast → religion, marquee names stay holidays", () => {
    const rows = holidaysToEvents(fixture, opts);
    expect(byTitle(rows, "Day of German Unity")?.category).toBe("national");
    expect(byTitle(rows, "Easter Monday")?.category).toBe("religion");
    expect(byTitle(rows, "Christmas Day")?.category).toBe("holidays");
    expect(byTitle(rows, "New Year's Day")?.category).toBe("holidays");
    expect(categoryFor("Epiphany")).toEqual({ category: "religion", tags: ["religious", "christian"] });
    expect(categoryFor("Corpus Christi").category).toBe("religion");
    expect(categoryFor("International Women's Day").category).toBe("culture");
    expect(categoryFor("2nd Day of Christmas").category).toBe("holidays");
    expect(categoryFor("Swiss National Day")).toEqual({ category: "national", tags: ["national"] });
    expect(categoryFor("Freedom Day").tags).toContain("national");
    expect(categoryFor("Independence Day").category).toBe("national");
  });

  it('categories: the word "Holiday" is not a religious feast (shared /holi/ rule must not fire)', () => {
    expect(categoryFor("June Holiday")).toEqual({ category: "holidays", tags: [] });
    expect(categoryFor("August Holiday")).toEqual({ category: "holidays", tags: [] });
    expect(categoryFor("Bank Holiday")).toEqual({ category: "holidays", tags: [] });
    expect(categoryFor("Public Holidays")).toEqual({ category: "holidays", tags: [] });
    expect(categoryFor("National Holiday")).toEqual({ category: "national", tags: ["national"] });
    expect(categoryFor("National Holiday").tags).not.toContain("religious");
    expect(categoryFor("Holi").category).toBe("religion"); // the real festival still classifies
    expect(categoryFor("Easter Monday").category).toBe("religion");
    expect(categoryFor("Day of German Unity")).toEqual({ category: "national", tags: ["national"] });
    const june = holidayToEvent({ ...fixture[0], name: [{ language: "EN", text: "June Holiday" }], startDate: "2027-06-07", endDate: "2027-06-07" }, { ...opts, country: "IE" })!;
    expect(june.category).toBe("holidays");
    expect(june.tags).not.toContain("religious");
    expect(june.tags).toEqual(["public-holiday", "openholidays", "public"]);
  });

  it("half-day rows get the half-day tag and prose that does not claim a full-day closure", () => {
    const half = holidayToEvent({ ...fixture[0], temporalScope: "HalfDay" }, opts)!;
    expect(half.tags).toContain("half-day");
    expect(half.description).toBe(
      "New Year's Day is an official public holiday that falls on Friday, 1 January 2027. Offices and many businesses close for part of the day.",
    );
    expect(half.description).not.toContain("close for the day");
    const full = holidayToEvent({ ...fixture[0], temporalScope: "FullDay" }, opts)!;
    expect(full.tags).not.toContain("half-day");
    expect(full.description).toContain("Government offices, schools and most businesses close for the day.");
  });

  it("subdivision-scoped rows are dropped by default and kept with sub- tags and popularity 15 when enabled", () => {
    const off = holidaysToEvents(fixture, opts);
    expect(byTitle(off, "Epiphany")).toBeUndefined();
    expect(byTitle(off, "International Women's Day")).toBeUndefined();
    const on = holidaysToEvents(fixture, { ...opts, includeSubdivisions: true });
    expect(on).toHaveLength(6);
    const epi = byTitle(on, "Epiphany")!;
    expect(epi.popularity).toBe(15);
    expect(epi.category).toBe("religion");
    expect(epi.tags).toEqual(expect.arrayContaining(["sub-de-st", "sub-de-bw", "sub-de-by", "religious", "christian"]));
    // Country-neutral like the nationwide prose: the slug carries no country, so this text can land on
    // a merged row whose regions[] spans several countries.
    expect(epi.description).toBe(
      "Epiphany is a regional public holiday that falls on Wednesday, 6 January 2027. It is observed in 3 regions rather than nationwide. Government offices, schools and most businesses close for the day.",
    );
    expect(epi.description).not.toMatch(/Germany|\bDE\b|ST, BW/);
    expect(epi.source_key).toBe("openholidays:DE:2027-01-06:epiphany");
    for (const r of on) expect(r.description, r.slug).not.toMatch(/Germany/);
    for (const r of on) expect(IngestEventSchema.safeParse(r).success, r.slug).toBe(true);
  });

  it("filters: non-public type, past rows, far future, bad ranges, empty names, label-year mismatch", () => {
    const base: OpenHolidayRow = { ...fixture[0] };
    expect(holidayToEvent({ ...base, type: "Bank" }, opts)).toBeNull();
    expect(holidayToEvent({ ...base, type: "School" }, opts)).toBeNull();
    expect(holidayToEvent(base, { ...opts, now: new Date("2027-01-03T00:00:00Z") })).toBeNull(); // start < today − 1
    expect(holidayToEvent(base, { ...opts, now: new Date("2027-01-02T00:00:00Z") })).not.toBeNull(); // yesterday still kept
    expect(holidayToEvent({ ...base, startDate: "2045-01-01", endDate: "2045-01-01" }, opts)).toBeNull();
    expect(holidayToEvent({ ...base, endDate: "2026-12-31" }, opts)).toBeNull(); // endDate < startDate
    expect(holidayToEvent({ ...base, startDate: "bogus" }, opts)).toBeNull();
    expect(holidayToEvent({ ...base, name: [] }, opts)).toBeNull();
    expect(holidayToEvent({ ...base, name: [{ language: "EN", text: "  " }] }, opts)).toBeNull();
    expect(holidayToEvent({ ...base, name: [{ language: "EN", text: "Jubilee 2030" }] }, opts)).toBeNull();
    expect(holidayToEvent({ ...base, name: [{ language: "EN", text: "Jubilee 2027" }] }, opts)?.title).toBe("Jubilee 2027");
    expect(holidayToEvent({ ...base, nationwide: false, subdivisions: [] }, opts)).toBeNull();
  });

  it("multi-day rows get end_date; a missing id yields the same CC:date:slug key and empty external_ids; non-EN names are used when EN is absent", () => {
    const multi = holidayToEvent({ ...fixture[0], id: undefined, startDate: "2027-04-02", endDate: "2027-04-05" }, opts)!;
    expect(multi.date).toBe("2027-04-02");
    expect(multi.end_date).toBe("2027-04-05");
    expect(multi.source_key).toBe("openholidays:DE:2027-04-02:new-year-s-day");
    expect(multi.external_ids).toEqual({});
    expect(multi.description).toContain("that runs from Friday, 2 April 2027 to Monday, 5 April 2027.");
    expect(multi.source_url).toBe(publicHolidaysUrl("DE", "2027-01-01", "2027-12-31"));
    expect(pickName([{ language: "ES", text: "Nuestra Señora de la Peña" }])).toBe("Nuestra Señora de la Peña");
    expect(pickName([{ language: "DE", text: "Neujahr" }, { language: "EN", text: "New Year's Day" }])).toBe("New Year's Day");
    expect(pickName([{ language: "EN", text: "New Year\u2019s Day" }])).toBe("New Year's Day"); // typographic apostrophe (live ZA rows)
    expect(pickName([{ language: "EN", text: "\u201cSaint\u201d Day" }])).toBe('"Saint" Day');
    expect(holidayToEvent({ ...fixture[0], name: [{ language: "EN", text: "New Year\u2019s Day" }] }, opts)?.slug).toBe("new-year-s-day-2027-01-01");
    const es = holidayToEvent(
      { ...fixture[0], name: [{ language: "ES", text: "Nuestra Señora de la Peña" }] },
      { ...opts, country: "ES" },
    )!;
    expect(es.slug).toBe("nuestra-senora-de-la-pena-2027-01-01");
    expect(es.regions).toEqual(["ES"]);
    expect(es.description.startsWith("Nuestra Señora de la Peña is an official public holiday that falls on")).toBe(true);
    expect(es.source_url).toBe(publicHolidaysUrl("ES", "2027-01-01", "2027-12-31"));
    expect(es.source_key).toBe("openholidays:ES:2027-01-01:nuestra-senora-de-la-pena");
  });

  it("dedupes by source_key within one response (same country, date and title — regardless of id)", () => {
    const rows = holidaysToEvents([fixture[0], { ...fixture[0] }, { ...fixture[0], id: "other-id" }, fixture[3]], opts);
    expect(rows).toHaveLength(2);
    expect(rows[0].external_ids).toEqual({ openholidays: fixture[0].id }); // first wins
  });

  it("windows: two 1095-day windows starting the day before now, within the API cap", () => {
    // 2028 is a leap year, so +1094 days from 2026-09-08 is 2029-09-06 (the API's cap is a day count, not "3 years").
    expect(windowFor(NOW, 0)).toEqual({ from: "2026-09-08", to: "2029-09-06" });
    expect(windowFor(NOW, 1)).toEqual({ from: "2029-09-07", to: "2032-09-05" });
    for (const win of [0, 1]) {
      const w = windowFor(NOW, win);
      expect((Date.parse(w.to) - Date.parse(w.from)) / 86_400_000).toBe(WINDOW_DAYS - 1);
    }
    expect((Date.parse(windowFor(NOW, 1).from) - Date.parse(windowFor(NOW, 0).to)) / 86_400_000).toBe(1); // contiguous
    expect(publicHolidaysUrl("DE", "2026-09-08", "2029-09-06")).toBe(
      "https://openholidaysapi.org/PublicHolidays?countryIsoCode=DE&languageIsoCode=EN&validFrom=2026-09-08&validTo=2029-09-06",
    );
  });

  it("plan: full pass is country × window in list order; the cursor is the last completed {country, win}", async () => {
    const ctx = fakeCtx();
    const plan = await adapter.plan(null, ctx);
    expect(plan.done).toBe(true);
    expect(plan.units).toHaveLength(OPENHOLIDAYS_COUNTRIES.length * 2);
    expect(plan.units[0].key).toBe("openholidays:AD:0");
    expect(plan.units[1].key).toBe("openholidays:AD:1");
    expect(plan.units[0].after).toEqual({ countries: [...OPENHOLIDAYS_COUNTRIES], after: { country: "AD", win: 0 } });
    expect(ctx.urls).toEqual(["https://openholidaysapi.org/Countries?languageIsoCode=EN"]);

    expect(plan.units[18].key).toBe("openholidays:DE:0");
    const resumed = await adapter.plan(plan.units[18].after, fakeCtx());
    expect(resumed.units[0].key).toBe("openholidays:DE:1"); // AD..CZ done, DE window 0 done
    expect(resumed.units).toHaveLength(OPENHOLIDAYS_COUNTRIES.length * 2 - 19);
    const last = await adapter.plan(plan.units.at(-1)!.after, fakeCtx());
    expect(last.units).toHaveLength(0);
  });

  it("plan: a resume does not refetch /Countries, foreign cursors restart, an unknown country restarts", async () => {
    const ctx = fakeCtx();
    await adapter.plan({ countries: ["DE", "FR"], after: { country: "DE", win: 1 } }, ctx);
    expect(ctx.urls).toEqual([]);
    expect(planUnits(["DE", "FR"], { country: "DE", win: 1 }, NOW).map((u) => u.key)).toEqual(["openholidays:FR:0", "openholidays:FR:1"]);
    expect(planUnits(["DE", "FR"], { country: "XX", win: 0 }, NOW)).toHaveLength(4);
    expect(parseCursor({ year: 2026, afterSlug: "x" })).toBeNull();
    expect(parseCursor({ countries: ["de"], after: null })).toBeNull();
    expect(parseCursor({ countries: ["DE"], after: null })).toEqual({ countries: ["DE"], after: null });
    expect(parseCursor({ countries: ["DE"], after: { country: "DE", win: "0" } })).toBeNull();
    const fresh = await adapter.plan({ year: 2026 }, fakeCtx());
    expect(fresh.units).toHaveLength(OPENHOLIDAYS_COUNTRIES.length * 2);
  });

  it("fetchCountries falls back to the built-in list when the request fails or is malformed", async () => {
    expect(await fetchCountries(fakeCtx({ fail: true }))).toEqual([...OPENHOLIDAYS_COUNTRIES]);
    expect(await fetchCountries(fakeCtx({ countries: [{ isoCode: "DE" }] }))).toEqual([...OPENHOLIDAYS_COUNTRIES]);
    expect(await fetchCountries(fakeCtx({ countries: { error: true } }))).toEqual([...OPENHOLIDAYS_COUNTRIES]);
    expect(await fetchCountries(fakeCtx())).toEqual([...OPENHOLIDAYS_COUNTRIES]); // the fixture matches the constant
  });

  it("run tolerates an empty or non-array response", async () => {
    const unit = planUnits(["ES"], null, NOW)[1];
    expect(await adapter.run(unit, fakeCtx({ holidays: [] }))).toEqual([]);
    expect(await adapter.run(unit, fakeCtx({ holidays: { title: "Bad Request" } }))).toEqual([]);
  });
});
