import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  adapter,
  authHeaders,
  checkQuota,
  confidenceFor,
  cursorJson,
  lockoutRemainingMs,
  MAX_STALL_TRIES,
  resetLockout,
  eventsToEvents,
  eventToEvent,
  imageCandidate,
  launchesToEvents,
  launchPopularity,
  launchStatus,
  launchTags,
  launchToEvent,
  ll2Date,
  Ll2QuotaError,
  offsetFromNext,
  pageUrl,
  parseCursor,
  titleYearConsistent,
  type Ll2Event,
  type Ll2Launch,
  type Ll2Page,
} from "@/lib/ingest/sources/ll2";
import { BudgetExceededError, HttpError, isBudgetExceeded } from "@/lib/ingest/http";
import { IngestEventSchema, type IngestContext } from "@/lib/ingest/types";

const NOW = new Date("2026-09-09T12:00:00Z");
const fixture = <T>(name: string): T => JSON.parse(readFileSync(new URL(`../fixtures/ll2/${name}`, import.meta.url), "utf8"));
const LAUNCHES = fixture<Ll2Page<Ll2Launch>>("launches-page.json");
const EVENTS = fixture<Ll2Page<Ll2Event>>("events-page.json");
const THROTTLE = fixture<{ your_request_limit: number; current_use: number }>("api-throttle.json");

type Responses = Record<string, unknown>;

function ctxFor(responses: Responses, calls: Array<{ url: string; headers?: Record<string, string> }> = []): IngestContext {
  return {
    http: {
      fetchJson: async <T,>(url: string, init?: { headers?: Record<string, string> }) => {
        calls.push({ url, headers: init?.headers });
        const key = Object.keys(responses).find((k) => url.startsWith(k));
        if (!key) throw new Error(`no fixture for ${url}`);
        const body = responses[key];
        if (body instanceof Error) throw body;
        return body as T;
      },
      fetchText: async () => "",
    },
    log: { info() {}, warn() {}, error() {} },
    now: NOW,
    budget: { remainingMs: () => 60_000 },
    dryRun: true,
  };
}

const THROTTLE_URL = "https://ll.thespacedevs.com/2.3.0/api-throttle/";
const byName = (name: string) => LAUNCHES.results!.find((l) => l.name === name)!;
const byEvent = (name: string) => EVENTS.results!.find((e) => e.name === name)!;

describe("ll2 date and precision mapping", () => {
  it("instants (Second/Minute/Hour) keep the T-0; coarse periods store their FIRST day (LL2 stores the last)", () => {
    expect(ll2Date("2026-09-10T15:37:00Z", "Minute")).toEqual({ date: "2026-09-10T15:37:00Z", precision: "instant", label: "10 September 2026 at 15:37 UTC", source: "minute" });
    expect(ll2Date("2026-09-15T01:21:07Z", "Second")!.date).toBe("2026-09-15T01:21:07Z");
    // Hour: still an instant, but the wording is "around" and the source is kept for the softer sentence / confidence.
    expect(ll2Date("2026-09-10T09:00:00Z", "Hour")).toEqual({ date: "2026-09-10T09:00:00Z", precision: "instant", label: "around 09:00 UTC on 10 September 2026", source: "hour" });
    expect(confidenceFor(ll2Date("2026-09-10T09:00:00Z", "Hour")!)).toBe(0.8);
    expect(confidenceFor(ll2Date("2026-09-10T09:00:00Z", "Minute")!)).toBe(0.9);
    expect(ll2Date("2026-09-15T00:00:00Z", "Day")).toEqual({ date: "2026-09-15", precision: "day", label: "15 September 2026", source: "day" });
    expect(ll2Date("2026-09-30T00:00:00Z", "Month")).toEqual({ date: "2026-09-01", precision: "month", label: "September 2026", source: "month" });
    expect(ll2Date("2026-09-30T00:00:00Z", "Quarter 3")).toEqual({ date: "2026-07-01", precision: "quarter", label: "Q3 2026", source: "quarter 3" });
    expect(ll2Date("2026-10-31T00:00:00Z", "Quarter 4")).toEqual({ date: "2026-10-01", precision: "quarter", label: "Q4 2026", source: "quarter 4" });
    expect(ll2Date("2026-05-31T00:00:00Z", "Quarter")!.date).toBe("2026-04-01"); // plain "Quarter": derived from the month
    expect(ll2Date("2026-12-31T00:00:00Z", "Year Half 2")).toEqual({ date: "2026-01-01", precision: "year", label: "the second half of 2026", source: "year half 2" });
    expect(ll2Date("2027-06-30T00:00:00Z", "Year Half 1")!.label).toBe("the first half of 2027");
    expect(ll2Date("2026-12-31T00:00:00Z", "Year")).toEqual({ date: "2026-01-01", precision: "year", label: "2026", source: "year" });
    expect(ll2Date("2029-12-31T00:00:00Z", "Decade")).toEqual({ date: "2020-01-01", precision: "decade", label: "the 2020s", source: "decade" });
    expect(ll2Date("2027-06-30T00:00:00Z", "Fiscal Year")).toEqual({ date: "2027-01-01", precision: "year", label: "fiscal year 2027", source: "fiscal year" }); // seen live on USSF/NRO launches
    expect(ll2Date("2028-12-31T00:00:00Z", "Year Something New")).toEqual({ date: "2028-01-01", precision: "year", label: "2028", source: "year something new" });
    expect(ll2Date("2026-09-10T15:37:00Z", "Fortnight")).toBeNull();
    expect(ll2Date("not a date", "Day")).toBeNull();
    expect(ll2Date(null, "Day")).toBeNull();
  });
  it("status: Go → scheduled, TBD/TBC → tentative, Hold → postponed, coarse precision always tentative, finished launches dropped", () => {
    expect(launchStatus({ name: "Go for Launch", abbrev: "Go" }, "instant")).toBe("scheduled");
    expect(launchStatus({ name: "Go for Launch", abbrev: "Go" }, "day")).toBe("scheduled");
    expect(launchStatus({ name: "Go for Launch", abbrev: "Go" }, "month")).toBe("tentative");
    expect(launchStatus({ name: "To Be Determined", abbrev: "TBD" }, "instant")).toBe("tentative");
    expect(launchStatus({ name: "To Be Confirmed", abbrev: "TBC" }, "day")).toBe("tentative");
    expect(launchStatus({ name: "On Hold", abbrev: "Hold" }, "instant")).toBe("postponed");
    expect(launchStatus({ name: "Launch Successful", abbrev: "Success" }, "instant")).toBeNull();
    expect(launchStatus({ name: "Launch Failure", abbrev: "Failure" }, "instant")).toBeNull();
    expect(launchStatus(null, "instant")).toBe("tentative");
  });
  it("label-year check", () => {
    expect(titleYearConsistent("Starship: Flight 14", 2026)).toBe(true);
    expect(titleYearConsistent("Kosmos 2586", 2026)).toBe(true);
    expect(titleYearConsistent("Demo 2027 mission", 2026)).toBe(false);
    expect(titleYearConsistent("Demo 2027 mission", 2027)).toBe(true);
    // Asteroid provisional designations are not years (seen live: "Hayabusa2 Asteroid 1998 KY26 Rendezvous", 2031).
    expect(titleYearConsistent("Hayabusa2 Asteroid 1998 KY26 Rendezvous", 2031)).toBe(true);
    expect(titleYearConsistent("2024 YR4 Lunar Impact Watch", 2032)).toBe(true);
    expect(titleYearConsistent("2024 YR4 flyby of 2032", 2031)).toBe(false);
  });
});

describe("ll2 launch → event", () => {
  it("Minute precision, Go: instant row in UTC, launch tags, pad country region and location, uuid source_key", () => {
    const ev = launchToEvent(byName("Falcon 9 Block 5 | USSF-153"), NOW)!;
    expect(ev.title).toBe("Falcon 9 Block 5: USSF-153");
    expect(ev.slug).toBe("falcon-9-block-5-ussf-153-2026-09-10");
    expect(ev.source_key).toBe("ll2:launch:3e0456da-14b1-4ac3-b59e-35fefb1d1530");
    expect(ev.date).toBe("2026-09-10T15:37:00Z");
    expect(ev.all_day).toBe(false);
    expect(ev.date_precision).toBe("instant");
    expect(ev.timezone).toBe("UTC");
    expect(ev.status).toBe("scheduled");
    expect(ev.confidence).toBe(0.9);
    expect(ev.category).toBe("space");
    expect(ev.regions).toEqual(["US"]);
    expect(ev.tags).toEqual(["launch", "spacex", "falcon-9", "low-earth-orbit"]); // configuration.name, not full_name
    expect(ev.location).toMatchObject({ name: "Vandenberg SFB, CA, USA", pad: "Space Launch Complex 4E", country: "US", url: "https://ll.thespacedevs.com/2.3.0/pads/16/" });
    expect(typeof (ev.location as { lat: unknown }).lat).toBe("number");
    expect(ev.external_ids).toEqual({ ll2: "3e0456da-14b1-4ac3-b59e-35fefb1d1530", ll2_slug: "falcon-9-block-5-ussf-153" });
    expect(ev.source_url).toBe("https://ll.thespacedevs.com/2.3.0/launches/3e0456da-14b1-4ac3-b59e-35fefb1d1530/");
    expect(ev.jsonld_eligible).toBe(false);
    expect(ev.popularity).toBe(30);
    expect(ev.description).toContain("SpaceX is preparing to launch USSF-153 on a Falcon 9 Block 5 from Vandenberg SFB, CA, USA.");
    expect(ev.description).toContain("Liftoff is targeted for 10 September 2026 at 15:37 UTC. The launch is go for that time.");
    expect(ev.description.length).toBeGreaterThanOrEqual(80);
    // Image licence "Unknown" (credit SpaceX): no candidate.
    expect(ev.image_candidate_url).toBeNull();
    expect(ev.image_candidate_meta).toBeNull();
    const raw = ev.raw as { net: string; net_precision: string; updates: Array<Record<string, unknown>>; vid_urls: unknown[] };
    expect(raw.net).toBe("2026-09-10T15:37:00Z");
    expect(raw.net_precision).toBe("Minute");
    expect(raw.vid_urls.length).toBeGreaterThan(0);
    for (const u of raw.updates) expect(Object.keys(u).sort()).toEqual(["comment", "created_on", "info_url"]);
  });
  it("Day precision TBD (Starship Flight 14): all-day, tentative, program tag, Starship provider bonus", () => {
    const ev = launchToEvent(byName("Starship | Flight 14"), NOW)!;
    expect(ev.date).toBe("2026-09-15");
    expect(ev.all_day).toBe(true);
    expect(ev.date_precision).toBe("day");
    expect(ev.timezone).toBeNull(); // all-day rows are per-viewer local dates, as in football-data
    expect(ev.status).toBe("tentative");
    expect(ev.confidence).toBe(0.9);
    expect(ev.tags).toContain("spacex-starship");
    expect(ev.tags).toContain("starship");
    expect(ev.popularity).toBe(40);
    expect(ev.description).toContain("Launch is planned for 15 September 2026, subject to confirmation.");
  });
  it("Month precision crewed (Crew-13): first day of the month, tentative, crewed tag, +25; CC BY-NC image rejected", () => {
    const ev = launchToEvent(byName("Falcon 9 Block 5 | Crew-13"), NOW)!;
    expect(ev.date).toBe("2026-09-01"); // net 2026-09-30 (LL2 period end) → first day of September
    expect(ev.date_precision).toBe("month");
    expect(ev.status).toBe("tentative");
    expect(ev.confidence).toBe(0.7);
    expect(ev.tags).toContain("crewed");
    expect(ev.tags).toContain("commercial-crew-program");
    expect(ev.popularity).toBe(55);
    expect(ev.featured).toBe(false);
    expect(ev.timezone).toBeNull();
    expect(ev.image_candidate_url).toBeNull();
    expect(ev.description).toContain("Launch is expected in September 2026 and no firm date has been announced yet.");
  });
  it("Hour precision, Go (CASC Unknown Payload): instant in UTC, confidence 0.8, 'around HH:00' wording and never 'go for that time'", () => {
    const ev = launchToEvent(byName("Long March 2D/YZ-3 | Unknown Payload"), NOW)!;
    expect(ev.date).toBe("2026-09-10T09:00:00Z");
    expect(ev.date_precision).toBe("instant");
    expect(ev.all_day).toBe(false);
    expect(ev.timezone).toBe("UTC");
    expect(ev.status).toBe("scheduled");
    expect(ev.confidence).toBe(0.8);
    expect(ev.description).toContain("Liftoff is targeted for around 09:00 UTC on 10 September 2026. The launch is go for that day; the exact liftoff time has not been announced.");
    expect(ev.description).not.toContain("go for that time");
    const tbd = launchToEvent({ ...byName("Long March 2D/YZ-3 | Unknown Payload"), status: { name: "To Be Determined", abbrev: "TBD" } }, NOW)!;
    expect(tbd.status).toBe("tentative");
    expect(tbd.description).toContain("Liftoff is targeted for around 09:00 UTC on 10 September 2026. The exact liftoff time is still to be determined.");
    const hourEvent = eventToEvent({ ...byEvent("Progress MS-35 Docking"), date_precision: { name: "Hour" } }, NOW)!;
    expect(hourEvent.confidence).toBe(0.8);
    expect(hourEvent.description).toContain("This docking at International Space Station is expected around 13:46 UTC on 19 September 2026.");
  });
  it("Quarter N / Year Half N / Year: first month of the quarter, half-years at year precision with the half in the wording", () => {
    const q4 = launchToEvent(byName("Falcon Heavy | NROL-97"), NOW)!;
    expect(q4.date).toBe("2026-10-01");
    expect(q4.date_precision).toBe("quarter");
    expect(q4.confidence).toBe(0.5);
    expect(q4.slug).toBe("falcon-heavy-nrol-97-2026-10-01");
    const q3 = launchToEvent(byName("Electron | 6x HawkEye 360"), NOW)!;
    expect(q3.date).toBe("2026-07-01"); // Q3 started before "now" but is still running: kept
    expect(q3.date_precision).toBe("quarter");
    const h2 = launchToEvent(byName("Long March 2F/G | Shenzhou 24"), NOW)!;
    expect(h2.date).toBe("2026-01-01");
    expect(h2.date_precision).toBe("year");
    expect(h2.status).toBe("tentative");
    expect(h2.description).toContain("Launch is expected in the second half of 2026");
    expect(h2.tags).toContain("crewed");
    expect(h2.regions).toEqual(["CN"]);
    const y = launchToEvent(byName("Atlas V N22 | Starliner-1"), NOW)!;
    expect(y.date).toBe("2026-01-01");
    expect(y.date_precision).toBe("year");
    expect(y.status).toBe("tentative");
    expect(y.confidence).toBe(0.5);
  });
  it("popularity rules: Unknown Payload 10, Starlink 15 (+ starlink tag), Artemis crewed 90 + featured, marquee providers +10", () => {
    const unknown = launchToEvent(byName("Long March 2D/YZ-3 | Unknown Payload"), NOW)!;
    expect(unknown.popularity).toBe(10);
    expect(unknown.description).toContain("launch an undisclosed payload");
    const starlink = launchToEvent(byName("Falcon 9 Block 5 | Starlink Group 15-27"), NOW)!;
    expect(starlink.popularity).toBe(15);
    expect(starlink.tags).toContain("starlink");
    const artemis: Ll2Launch = {
      ...byName("Atlas V N22 | Starliner-1"),
      id: "11111111-2222-4333-8444-555555555555",
      name: "SLS Block 1 | Artemis III",
      launch_service_provider: { name: "National Aeronautics and Space Administration", abbrev: "NASA" },
      program: [{ name: "Artemis" }],
      mission: { name: "Artemis III", type: "Human Exploration", description: "Crewed lunar landing.", orbit: { name: "Lunar Orbit" } },
    };
    expect(launchPopularity(artemis)).toEqual({ popularity: 90, featured: true });
    const row = launchToEvent(artemis, NOW)!;
    expect(row.featured).toBe(true);
    expect(row.popularity).toBe(90);
    expect(row.tags).toEqual(["launch", "national-aeronautics-and-space-administration", "atlas-v-n22", "artemis", "lunar-orbit", "crewed"]);
    expect(launchPopularity({ ...artemis, mission: { ...artemis.mission, type: "Test Flight" } })).toEqual({ popularity: 55, featured: false }); // 30 + 15 artemis + 10 NASA
    expect(launchPopularity({ ...artemis, program: [], mission: { ...artemis.mission, type: "Test Flight" } }).popularity).toBe(55); // the name still says Artemis
    expect(launchPopularity({ ...artemis, name: "SLS Block 1 | Demo", program: [], mission: { ...artemis.mission, type: "Test Flight" } }).popularity).toBe(40); // 30 + 10 NASA
    expect(launchTags({ ...artemis, mission: { name: "X", type: "Test", orbit: { name: "Unknown" } }, program: [] })).toEqual(["launch", "national-aeronautics-and-space-administration", "atlas-v-n22"]);
  });
  it("handles a missing image / mission and never emits image candidates for non-allowlisted licences", () => {
    const ev = launchToEvent(byName("Vulcan VC4L | Dream Chaser CRS 2 Flight 1"), NOW)!;
    expect(ev.image_candidate_url).toBeNull();
    const esa = launchToEvent(byName("Vega-C | Sentinel-3C & FLEX"), NOW)!;
    expect(esa.image_candidate_url).toBeNull(); // ESA Standard Licence is non-commercial
    expect(esa.date).toBe("2026-09-15T01:21:07Z");
    expect(esa.regions).toEqual(["GF"]);
    const noMission = launchToEvent({ ...byName("Electron | LOXSAT 1"), mission: null }, NOW)!;
    expect(noMission.description).toContain("Rocket Lab is preparing to launch an undisclosed payload on an Electron");
    expect(imageCandidate({ image_url: "https://x.test/a.jpg", credit: "NASA", license: { name: "NASA Image and Media Guidelines", link: "https://www.nasa.gov/x" } }, "https://p")).toEqual({
      url: "https://x.test/a.jpg",
      meta: { provider: "launchlibrary", pageUrl: "https://p", license: "NASA Image and Media Guidelines", licenseUrl: "https://www.nasa.gov/x", author: "NASA" },
    });
    expect(imageCandidate({ image_url: "https://x.test/a.jpg", license: { name: "CC BY 4.0" } }, "https://p")!.meta.author).toBeNull();
    expect(imageCandidate({ image_url: "https://x.test/a.jpg", license: { name: "CC BY-NC 2.0" } }, "https://p")).toBeNull();
    expect(imageCandidate({ image_url: "https://x.test/a.jpg", license: { name: "Unknown" } }, "https://p")).toBeNull();
    expect(imageCandidate({ image_url: "https://x.test/a.jpg", license: { name: "ESA Standard Licence" } }, "https://p")).toBeNull();
    expect(imageCandidate({ image_url: "http://x.test/a.jpg", license: { name: "CC0 1.0" } }, "https://p")).toBeNull();
    expect(imageCandidate(null, "https://p")).toBeNull();
  });
  it("filters: past launches, finished statuses, far-future dates, title-year mismatch, bad ids; dedupes by source_key", () => {
    const base = byName("Falcon 9 Block 5 | USSF-153");
    expect(launchToEvent({ ...base, net: "2026-09-01T00:00:00Z" }, NOW)).toBeNull();
    expect(launchToEvent({ ...base, net: "2026-09-08T00:00:00Z", net_precision: { name: "Day" } }, NOW)).not.toBeNull(); // 2-day grace
    expect(launchToEvent({ ...base, status: { name: "Launch Successful", abbrev: "Success" } }, NOW)).toBeNull();
    expect(launchToEvent({ ...base, net: "2045-12-31T00:00:00Z", net_precision: { name: "Year" } }, NOW)).toBeNull();
    expect(launchToEvent({ ...base, name: "Falcon 9 | Demo 2028" }, NOW)).toBeNull();
    expect(launchToEvent({ ...base, id: "42" }, NOW)).toBeNull();
    expect(launchToEvent({ ...base, net_precision: { name: "Fortnight" } }, NOW)).toBeNull();
    const rows = launchesToEvents([base, base, byName("Starship | Flight 14")], NOW);
    expect(rows.map((r) => r.source_key)).toEqual(["ll2:launch:3e0456da-14b1-4ac3-b59e-35fefb1d1530", "ll2:launch:7d1afb26-6f9c-429b-9ccf-29012fd1e519"]);
  });
});

describe("ll2 space event → event", () => {
  it("Minute-precision docking: instant, NASA image allowed, type/program/agency tags, integer source_key", () => {
    const ev = eventToEvent(byEvent("Progress MS-35 Docking"), NOW)!;
    expect(ev.source_key).toBe("ll2:event:1513");
    expect(ev.slug).toBe("progress-ms-35-docking-2026-09-19");
    expect(ev.date).toBe("2026-09-19T13:46:00Z");
    expect(ev.date_precision).toBe("instant");
    expect(ev.status).toBe("scheduled");
    expect(ev.timezone).toBe("UTC");
    expect(ev.category).toBe("space");
    expect(ev.regions).toEqual(["GLOBAL"]);
    expect(ev.tags).toEqual(["space-event", "docking", "international-space-station", "russian-federal-space-agency-roscosmos"]);
    expect(ev.location).toEqual({ name: "International Space Station" });
    expect(ev.external_ids).toEqual({ ll2_event: 1513, ll2_slug: "progress-ms-35-docking" });
    expect(ev.popularity).toBe(30);
    expect(ev.image_candidate_url).toBe("https://thespacedevs-prod.nyc3.digitaloceanspaces.com/media/images/progress2520ms-112520docking_image_20190318202147.jpeg");
    expect(ev.image_candidate_meta).toEqual({
      provider: "launchlibrary",
      pageUrl: "https://ll.thespacedevs.com/2.3.0/events/1513/",
      license: "NASA Image and Media Guidelines",
      licenseUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
      author: "NASA",
    });
    expect(ev.description).toBe(
      "The Progress MS-35 spacecraft is scheduled to autonomously dock to the Poisk module of the ISS. This docking at International Space Station is scheduled for 19 September 2026 at 13:46 UTC.",
    );
  });
  it("Month / Day / Year precision events: placeholder dates, tentative when coarse, ESA images rejected, 2035 kept (inside 15 y)", () => {
    const juice = eventToEvent(byEvent("Juice Earth Flyby"), NOW)!;
    expect(juice.date).toBe("2026-09-01");
    expect(juice.date_precision).toBe("month");
    expect(juice.status).toBe("tentative");
    expect(juice.image_candidate_url).toBeNull();
    expect(juice.description).toContain("This flyby at Earth is expected in September 2026; no exact date has been set.");
    const bepi = eventToEvent(byEvent("BepiColombo Mercury Orbit Insertion"), NOW)!;
    expect(bepi.date).toBe("2026-11-01");
    expect(bepi.tags).toContain("orbital-insertion");
    expect(bepi.description).toContain("This insertion at Mercury is expected in November 2026");
    const solo = eventToEvent(byEvent("Solar Orbiter Venus Flyby"), NOW)!;
    expect(solo.date).toBe("2026-12-24");
    expect(solo.date_precision).toBe("day");
    expect(solo.status).toBe("scheduled");
    expect(solo.all_day).toBe(true);
    expect(solo.timezone).toBeNull();
    const starliner = eventToEvent(byEvent("Boeing Starliner-1 Docking"), NOW)!;
    expect(starliner.date).toBe("2026-01-01");
    expect(starliner.date_precision).toBe("year");
    expect(starliner.image_candidate_url).not.toBeNull(); // NASA guidelines
    const ganymede = eventToEvent(byEvent("Juice Ganymede Impact"), NOW)!;
    expect(ganymede.date).toBe("2035-01-01");
    expect(ganymede.date_precision).toBe("year");
    expect(eventToEvent({ ...byEvent("Juice Ganymede Impact"), date: "2045-12-31T00:00:00Z" }, NOW)).toBeNull();
    expect(eventToEvent({ ...byEvent("Juice Ganymede Impact"), id: 0 }, NOW)).toBeNull();
  });
  it("crewed / Artemis events get the bonus", () => {
    const base = byEvent("Progress MS-35 Docking");
    const crew = eventToEvent({ ...base, id: 99, astronauts: [{ name: "A" }] }, NOW)!;
    expect(crew.popularity).toBe(40);
    expect(crew.tags).toContain("crewed");
    const artemis = eventToEvent({ ...base, id: 98, name: "Artemis III Lunar Landing", program: [{ name: "Artemis" }], astronauts: [{ name: "A" }] }, NOW)!;
    expect(artemis.popularity).toBe(90);
    expect(artemis.featured).toBe(true);
  });
});

describe("ll2 fixture rows validate and are stable", () => {
  it("every fixture row passes IngestEventSchema; two runs give identical rows and source_keys", () => {
    const a = [...launchesToEvents(LAUNCHES.results!, NOW), ...eventsToEvents(EVENTS.results!, NOW)];
    const b = [...launchesToEvents(LAUNCHES.results!, NOW), ...eventsToEvents(EVENTS.results!, NOW)];
    expect(a.length).toBe(LAUNCHES.results!.length + EVENTS.results!.length);
    expect(a).toEqual(b);
    expect(a.map((r) => r.source_key)).toEqual(b.map((r) => r.source_key));
    expect(new Set(a.map((r) => r.source_key)).size).toBe(a.length);
    for (const r of a) {
      const parsed = IngestEventSchema.safeParse(r);
      expect(parsed.success, `${r.source_key}: ${JSON.stringify(parsed.success ? null : parsed.error.issues)}`).toBe(true);
      expect(r.source).toBe("ll2");
      expect(r.category).toBe("space");
      if (r.date_precision !== "instant" && r.date_precision !== "day") expect(r.status).toBe("tentative");
      if (r.image_candidate_url) expect((r.image_candidate_meta as { license: string }).license).toBe("NASA Image and Media Guidelines");
    }
    expect(a.map((r) => r.source_key)).toMatchInlineSnapshot(`
      [
        "ll2:launch:95eb9265-bdbe-43ad-b08c-6be7eb4e58f4",
        "ll2:launch:3e0456da-14b1-4ac3-b59e-35fefb1d1530",
        "ll2:launch:7d1afb26-6f9c-429b-9ccf-29012fd1e519",
        "ll2:launch:18441371-8b2e-457c-afb5-1ec1b11ab630",
        "ll2:launch:4651fd8a-43de-4166-bf8f-c168b3bd1d2c",
        "ll2:launch:c9605b67-8a53-4239-a8ae-577fe3b79799",
        "ll2:launch:07e945c1-2ec6-4d29-a500-1afbe920440f",
        "ll2:launch:a67b40f9-cfcc-4614-a355-a156280b4bb3",
        "ll2:launch:8effc13a-c658-4d2e-9f15-8dba4d7fe2dd",
        "ll2:launch:d1471f9d-e9d0-4146-8e97-90863e48bfc8",
        "ll2:launch:7766f3bb-674c-4c71-b986-963bd633fcfe",
        "ll2:launch:599ba2df-7483-4b2f-a083-2b5ddc06e069",
        "ll2:event:1513",
        "ll2:event:1017",
        "ll2:event:394",
        "ll2:event:384",
        "ll2:event:365",
        "ll2:event:1282",
      ]
    `);
  });
});

describe("ll2 plan/run", () => {
  afterEach(() => {
    delete process.env.LL2_API_TOKEN;
    resetLockout();
  });
  it("cursor: {stage, offset, tries}; foreign shapes restart at launches:0", () => {
    expect(parseCursor(null)).toEqual({ stage: "launches", offset: 0, tries: 0 });
    expect(parseCursor({ stage: "launches", offset: 200 })).toEqual({ stage: "launches", offset: 200, tries: 0 });
    expect(parseCursor({ stage: "events", offset: 0 })).toEqual({ stage: "events", offset: 0, tries: 0 });
    expect(parseCursor({ stage: "done", offset: 0 })).toEqual({ stage: "done", offset: 0, tries: 0 });
    expect(parseCursor({ i: 2, page: 1 })).toEqual({ stage: "launches", offset: 0, tries: 0 });
    expect(parseCursor({ stage: "launches", offset: -5 })).toEqual({ stage: "launches", offset: 0, tries: 0 });
    expect(parseCursor({ stage: "launches", offset: 100, tries: 1 })).toEqual({ stage: "launches", offset: 100, tries: 1 });
    expect(parseCursor({ stage: "launches", offset: 100, tries: "x" })).toEqual({ stage: "launches", offset: 100, tries: 0 });
    // `tries` stays out of the persisted cursor while it is 0.
    expect(cursorJson("launches", 100)).toEqual({ stage: "launches", offset: 100 });
    expect(cursorJson("launches", 100, 1)).toEqual({ stage: "launches", offset: 100, tries: 1 });
    expect(pageUrl("launches", 100)).toBe("https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=100&mode=detailed&offset=100");
    expect(offsetFromNext("https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=100&mode=detailed&offset=100")).toBe(100);
    expect(offsetFromNext(null)).toBeNull();
    expect(offsetFromNext("nope")).toBeNull();
  });
  it("one unit per plan(): next page while `next` is set, then events, then done; a unit that never ran resumes in place", async () => {
    const calls: Array<{ url: string; headers?: Record<string, string> }> = [];
    const ctx = ctxFor(
      {
        [THROTTLE_URL]: THROTTLE,
        [pageUrl("launches", 0)]: LAUNCHES,
        [pageUrl("launches", 100)]: { ...LAUNCHES, next: null, results: LAUNCHES.results!.slice(0, 2) },
        [pageUrl("events", 0)]: EVENTS,
      },
      calls,
    );
    const p0 = await adapter.plan(null, ctx);
    expect(p0.done).toBe(false);
    expect(p0.units).toHaveLength(1);
    expect(p0.units[0].key).toBe("ll2:launches:0");
    expect(p0.units[0].after).toEqual({ stage: "launches", offset: 0 }); // not run yet: same cursor, nothing skipped
    const rows0 = await adapter.run(p0.units[0], ctx);
    expect(rows0).toHaveLength(LAUNCHES.results!.length);
    expect(p0.units[0].after).toEqual({ stage: "launches", offset: 100 }); // from the page's `next` link
    expect(p0.nextCursor).toEqual({ stage: "launches", offset: 100 });

    const p1 = await adapter.plan(p0.nextCursor!, ctx);
    expect(p1.units[0].key).toBe("ll2:launches:100");
    const rows1 = await adapter.run(p1.units[0], ctx);
    expect(rows1).toHaveLength(2);
    expect(p1.units[0].after).toEqual({ stage: "events", offset: 0 }); // last page → events

    const p2 = await adapter.plan(p1.nextCursor!, ctx);
    expect(p2.units[0].key).toBe("ll2:events:0");
    const rows2 = await adapter.run(p2.units[0], ctx);
    expect(rows2.map((r) => r.source_key)).toEqual(eventsToEvents(EVENTS.results!, NOW).map((r) => r.source_key));
    expect(p2.units[0].after).toEqual({ stage: "done", offset: 0 });

    const p3 = await adapter.plan(p2.nextCursor!, ctx);
    expect(p3).toEqual({ units: [], done: true });

    // Requests: throttle + page for each of the three units; nothing for the final plan().
    expect(calls.map((c) => c.url)).toEqual([THROTTLE_URL, pageUrl("launches", 0), THROTTLE_URL, pageUrl("launches", 100), THROTTLE_URL, pageUrl("events", 0)]);
    expect(calls.every((c) => !c.headers?.Authorization)).toBe(true);
    // Same unit run twice → identical rows.
    const again = await adapter.run((await adapter.plan(null, ctx)).units[0], ctx);
    expect(again).toEqual(rows0);
  });
  it("a page whose run() throws (429, timeout) keeps the same cursor so the next run retries it instead of skipping it", async () => {
    const calls: Array<{ url: string; headers?: Record<string, string> }> = [];
    const ctx = ctxFor({ [THROTTLE_URL]: THROTTLE, [pageUrl("launches", 100)]: new HttpError(429, pageUrl("launches", 100)) }, calls);
    const plan = await adapter.plan({ stage: "launches", offset: 100 }, ctx);
    expect(plan.units[0].key).toBe("ll2:launches:100");
    await expect(adapter.run(plan.units[0], ctx)).rejects.toBeInstanceOf(HttpError);
    expect(plan.units[0].ran).toBe(false);
    expect(plan.units[0].after).toEqual({ stage: "launches", offset: 100 }); // the runner persists `after` on the failed path too
    expect(plan.nextCursor).toEqual({ stage: "launches", offset: 100 });

    // The 429 locked the egress out: the runner's second unit attempt must not spend a request.
    expect(lockoutRemainingMs()).toBeGreaterThan(0);
    const before = calls.length;
    await expect(adapter.run(plan.units[0], ctx)).rejects.toThrow(/lock-out/);
    expect(isBudgetExceeded(await adapter.run(plan.units[0], ctx).catch((e: unknown) => e))).toBe(true); // partial, not an outage
    expect(calls.length).toBe(before); // no throttle call, no page call
    expect(plan.units[0].after).toEqual({ stage: "launches", offset: 100 });

    resetLockout();
    const timeout = ctxFor({ [THROTTLE_URL]: THROTTLE, [pageUrl("events", 0)]: new Error("timeout after 60000 ms") });
    const p = await adapter.plan({ stage: "events", offset: 0 }, timeout);
    await expect(adapter.run(p.units[0], timeout)).rejects.toThrow(/timeout/);
    expect(p.units[0].after).toEqual({ stage: "events", offset: 0 });
  });
  it("quota: the gate lives in run(), needs one free request, and stops the pass as `budget` (partial), not as an error", async () => {
    const short = { your_request_limit: 15, limit_frequency_secs: 3600, current_use: 15, next_use_secs: 900 };
    const calls: Array<{ url: string; headers?: Record<string, string> }> = [];
    const ctx = ctxFor({ [THROTTLE_URL]: short, [pageUrl("launches", 0)]: LAUNCHES }, calls);
    // plan() makes no request at all, so a quota stop can never be a systemic (planning) failure.
    const plan = await adapter.plan(null, ctx);
    expect(calls).toHaveLength(0);
    expect(plan.units[0].key).toBe("ll2:launches:0");
    const err = await adapter.run(plan.units[0], ctx).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Ll2QuotaError);
    expect(isBudgetExceeded(err)).toBe(true); // run.ts → kind:"budget" → partial, cursor kept, no backoff
    expect((err as Error).message).toMatch(/15\/15 requests used/);
    expect(calls.map((c) => c.url)).toEqual([THROTTLE_URL]); // gate ran before the page request
    expect(plan.units[0].ran).toBe(false);
    expect(plan.units[0].after).toEqual({ stage: "launches", offset: 0 }); // resumes exactly here

    // One free slot is enough to start (or continue) a pass; a pass may span several crons.
    await expect(checkQuota(ctxFor({ [THROTTLE_URL]: { your_request_limit: 15, current_use: 14 } }))).resolves.toBeUndefined();
    await expect(checkQuota(ctxFor({ [THROTTLE_URL]: { your_request_limit: 15, current_use: 15, next_use_secs: 60 } }))).rejects.toThrow(/15\/15/);
    // A throttle call that fails or answers garbage never blocks the page request.
    await expect(checkQuota(ctxFor({ [THROTTLE_URL]: new Error("boom") }))).resolves.toBeUndefined();
    await expect(checkQuota(ctxFor({ [THROTTLE_URL]: {} }))).resolves.toBeUndefined();
  });
  it("anti-stall: a page that eats the whole budget twice is stepped over instead of stalling the pass", async () => {
    const budgetOut = new BudgetExceededError(pageUrl("launches", 100), 0);
    const ctx = ctxFor({ [THROTTLE_URL]: THROTTLE, [pageUrl("launches", 100)]: budgetOut, [pageUrl("events", 0)]: budgetOut });
    expect(MAX_STALL_TRIES).toBe(2);

    const first = await adapter.plan({ stage: "launches", offset: 100 }, ctx);
    await expect(adapter.run(first.units[0], ctx)).rejects.toBeInstanceOf(BudgetExceededError);
    expect(first.units[0].stalled).toBe(true);
    expect(first.units[0].after).toEqual({ stage: "launches", offset: 100, tries: 1 }); // retry the same page once

    const second = await adapter.plan(first.units[0].after, ctx);
    expect(second.units[0].key).toBe("ll2:launches:100");
    await expect(adapter.run(second.units[0], ctx)).rejects.toBeInstanceOf(BudgetExceededError);
    expect(second.units[0].after).toEqual({ stage: "launches", offset: 200 }); // stepped over, tries reset

    const events = await adapter.plan({ stage: "events", offset: 0, tries: 1 }, ctx);
    await expect(adapter.run(events.units[0], ctx)).rejects.toBeInstanceOf(BudgetExceededError);
    expect(events.units[0].after).toEqual({ stage: "done", offset: 0 }); // last stage: end the pass
  });
  it("adapter metadata and the optional token header", () => {
    expect(adapter.id).toBe("ll2");
    expect(adapter.rank).toBe(7);
    expect(adapter.cadence).toBe("daily"); // 6-hourly cron; STALE only after 48 h without an ok run
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.limits).toEqual({ concurrency: 1, minIntervalMs: 3000, timeoutMs: 60_000, maxRetries: 0 });
    expect(authHeaders()).toEqual({});
    process.env.LL2_API_TOKEN = "abc";
    expect(authHeaders()).toEqual({ Authorization: "Token abc" });
    expect(adapter.isConfigured()).toBe(true);
  });
});
