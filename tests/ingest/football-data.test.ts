import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  adapter,
  authHeaders,
  COMPETITIONS,
  describeMatch,
  endedCodes,
  FD_BASE,
  MAIN_PHASE_STAGES,
  matchesToEvents,
  matchStatus,
  matchToEvent,
  isPlaceholder,
  parseCursor,
  planUnits,
  popularityFor,
  seasonLabel,
  selectMatches,
  SKIPPABLE,
  stageLabel,
  teamName,
  titleFor,
  type FdCompetitionsResponse,
  type FdMatch,
  type FdMatchesResponse,
} from "@/lib/ingest/sources/football-data";
import { HttpError } from "@/lib/ingest/http";
import { IngestEventSchema, type IngestContext } from "@/lib/ingest/types";

const NOW = new Date("2026-09-09T12:00:00Z");
/** Before the 2026-27 league openers, so the PL fixture's first kick-off is still future. */
const PRESEASON = new Date("2026-08-01T12:00:00Z");
const fixture = <T>(name: string): T => JSON.parse(readFileSync(new URL(`../fixtures/football-data/${name}`, import.meta.url), "utf8"));
const CL = fixture<FdMatchesResponse>("cl-scheduled.json");
const PL = fixture<FdMatchesResponse>("pl-season.json");
const CATALOGUE = fixture<FdCompetitionsResponse>("competitions.json");
const CUP_CL = COMPETITIONS.find((c) => c.code === "CL")!;
const LEAGUE_PL = COMPETITIONS.find((c) => c.code === "PL")!;
const byId = (id: number): FdMatch => CL.matches!.find((m) => m.id === id)!;

type Responses = Record<string, unknown>;
function ctxFor(responses: Responses, calls: Array<{ url: string; headers?: Record<string, string> }> = [], now = NOW): IngestContext {
  return {
    http: {
      fetchJson: async <T,>(url: string, init?: { headers?: Record<string, string> }) => {
        calls.push({ url, headers: init?.headers });
        const key = Object.keys(responses).find((k) => url === k) ?? Object.keys(responses).find((k) => url.startsWith(k));
        if (!key) throw new Error(`no fixture for ${url}`);
        const body = responses[key];
        if (body instanceof Error) throw body;
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

/** Tests run without the key; a developer's exported key is restored afterwards, never wiped. */
let savedKey: string | undefined;
beforeEach(() => {
  savedKey = process.env.FOOTBALL_DATA_API_KEY;
  delete process.env.FOOTBALL_DATA_API_KEY;
});
afterEach(() => {
  if (savedKey === undefined) delete process.env.FOOTBALL_DATA_API_KEY;
  else process.env.FOOTBALL_DATA_API_KEY = savedKey;
});

describe("football-data helpers", () => {
  it("season and stage labels, status mapping, popularity table", () => {
    expect(seasonLabel({ startDate: "2026-09-08", endDate: "2027-05-29" })).toBe("2026–27");
    expect(seasonLabel({ startDate: "2026-06-11", endDate: "2026-07-19" })).toBe("2026");
    expect(seasonLabel(null)).toBe("");
    expect(stageLabel("SEMI_FINALS")).toBe("semi-final");
    expect(stageLabel("LEAGUE_STAGE")).toBe("league phase");
    expect(stageLabel("SOME_NEW_STAGE")).toBe("some new stage");
    expect(matchStatus("TIMED")).toBe("scheduled");
    expect(matchStatus("SCHEDULED")).toBe("scheduled");
    expect(matchStatus("POSTPONED")).toBe("postponed");
    expect(matchStatus("SUSPENDED")).toBe("postponed");
    expect(matchStatus("CANCELLED")).toBe("cancelled");
    expect(matchStatus("FINISHED")).toBeNull();
    expect(matchStatus("IN_PLAY")).toBeNull();
    expect(matchStatus(undefined)).toBeNull();
    expect(popularityFor("WC", "final")).toBe(90);
    expect(popularityFor("EC", "final")).toBe(80);
    expect(popularityFor("CL", "final")).toBe(75);
    expect(popularityFor("CL", "semi")).toBe(55);
    expect(popularityFor("CL", "quarter")).toBe(45);
    expect(popularityFor("WC", "opener")).toBe(60);
    expect(popularityFor("PL", "opener")).toBe(35);
  });
  it("selection: cups keep the opener plus QF/SF/F in kick-off order; league phase is not selected", () => {
    const sel = selectMatches(CL.matches!, CUP_CL);
    expect(sel.map((s) => [s.match.id, s.kind])).toEqual([
      [555001, "opener"],
      [555003, "quarter"],
      [555004, "quarter"],
      [555005, "quarter"],
      [555006, "semi"],
      [555007, "final"],
    ]);
    // Leagues: only the season's first kick-off, whatever the array order.
    expect(selectMatches(PL.matches!, LEAGUE_PL).map((s) => [s.match.id, s.kind])).toEqual([[556001, "opener"]]);
    expect(selectMatches([], CUP_CL)).toEqual([]);
  });
  it("opener: the earliest main-phase match, not a qualifying tie played weeks earlier; no opener at all when the season has none", () => {
    const qualifier = byId(555000);
    expect(qualifier.stage).toBe("FIRST_QUALIFYING_ROUND");
    expect(qualifier.utcDate! < byId(555001).utcDate!).toBe(true);
    expect(MAIN_PHASE_STAGES.has(qualifier.stage!)).toBe(false);
    const sel = selectMatches(CL.matches!, CUP_CL);
    expect(sel.find((s) => s.kind === "opener")!.match.id).toBe(555001);
    expect(sel.some((s) => s.match.id === 555000)).toBe(false);
    // Only qualifiers/knockouts published so far (WC/EC between editions): no opening match is
    // invented, and the qualifier is not swallowed by an opener row either.
    const early = CL.matches!.filter((m) => m.id === 555000 || m.id === 555003);
    expect(selectMatches(early, CUP_CL).map((s) => [s.match.id, s.kind])).toEqual([[555003, "quarter"]]);
    const semisOnly: FdMatch[] = [
      { ...byId(555006), id: 900001, utcDate: "2027-05-01T19:00:00Z" },
      { ...byId(555006), id: 900002, utcDate: "2027-05-02T19:00:00Z" },
    ];
    expect(selectMatches(semisOnly, CUP_CL).map((s) => s.kind)).toEqual(["semi"]);
    expect(matchesToEvents(semisOnly, CUP_CL, NOW).map((r) => r.title)).toEqual(["UEFA Champions League semi-final"]);
    // Leagues use the same rule (REGULAR_SEASON is a main-phase stage).
    expect(MAIN_PHASE_STAGES.has("REGULAR_SEASON")).toBe(true);
  });
  it("titles: finals never carry teams, undecided ties are unnumbered, openers carry the season", () => {
    expect(titleFor(byId(555007), "final")).toBe("UEFA Champions League final");
    expect(titleFor(byId(555003), "quarter")).toBe("Arsenal v Bayern (quarter-final)");
    expect(titleFor(byId(555004), "quarter")).toBe("UEFA Champions League quarter-final");
    expect(titleFor(byId(555006), "semi")).toBe("UEFA Champions League semi-final");
    expect(titleFor(byId(555001), "opener")).toBe("UEFA Champions League 2026–27 opening match");
    expect(titleFor(PL.matches![1], "opener")).toBe("Premier League 2026–27 opening match");
  });
  it("teams: a named team without an id is still a team; only a fully blank side is a placeholder", () => {
    expect(teamName({ name: "Arsenal FC", shortName: "Arsenal" })).toBe("Arsenal");
    expect(teamName({ id: 57, name: "Arsenal FC" })).toBe("Arsenal FC");
    expect(teamName({ id: null, name: null, shortName: null })).toBeNull();
    expect(teamName(null)).toBeNull();
    expect(isPlaceholder(byId(555004))).toBe(true);
    expect(isPlaceholder(byId(555003))).toBe(false);
    // Same match with the ids stripped: still a real fixture, same title and slug.
    const idless: FdMatch = { ...byId(555003), homeTeam: { name: "Arsenal FC", shortName: "Arsenal" }, awayTeam: { name: "FC Bayern München", shortName: "Bayern" } };
    expect(isPlaceholder(idless)).toBe(false);
    expect(matchToEvent(idless, "quarter", CUP_CL, NOW)!.slug).toBe("arsenal-v-bayern-quarter-final-2027-04-06");
  });
  it("undecided two-legged ties collapse to one row per stage instead of counting legs", () => {
    const legs: FdMatch[] = Array.from({ length: 8 }, (_, i) => ({
      ...byId(555004),
      id: 910000 + i,
      utcDate: `2027-04-${String(6 + (i < 4 ? 0 : 7) + (i % 2)).padStart(2, "0")}T19:00:00Z`,
    }));
    const sel = selectMatches(legs, CUP_CL);
    expect(sel).toHaveLength(1);
    expect(sel[0].match.id).toBe(910000);
    const rows = matchesToEvents(legs, CUP_CL, NOW);
    expect(rows.map((r) => r.title)).toEqual(["UEFA Champions League quarter-final"]);
    expect(rows[0].source_key).toBe("football-data:match:910000");
    // A drawn tie is never collapsed: both legs stand, with their own titles.
    const drawn: FdMatch[] = [byId(555003), { ...byId(555003), id: 910100, utcDate: "2027-04-13T19:00:00Z", homeTeam: byId(555003).awayTeam, awayTeam: byId(555003).homeTeam }];
    expect(matchesToEvents(drawn, CUP_CL, NOW).map((r) => r.title)).toEqual(["Arsenal v Bayern (quarter-final)", "Bayern v Arsenal (quarter-final)"]);
  });
  it("descriptions are own wording with the stage, season, kick-off and teams", () => {
    expect(describeMatch(byId(555003), "quarter", "TIMED", CUP_CL)).toBe(
      "Quarter-final of the 2026–27 UEFA Champions League. Kick-off 6 April 2027 at 19:00 UTC, Arsenal against Bayern.",
    );
    expect(describeMatch(byId(555007), "final", "SCHEDULED", CUP_CL)).toBe(
      "Final of the 2026–27 UEFA Champions League. Scheduled for 29 May 2027; the kick-off time has not been confirmed. The teams have not been decided yet.",
    );
    expect(describeMatch(PL.matches![1], "opener", "TIMED", LEAGUE_PL)).toBe(
      "Opening match of the 2026–27 Premier League season. Kick-off 21 August 2026 at 19:00 UTC, Liverpool against Bournemouth.",
    );
    expect(describeMatch(byId(555005), "quarter", "POSTPONED", CUP_CL)).toContain("has been postponed");
  });
});

describe("football-data match → event", () => {
  it("TIMED knockout: instant in UTC, scheduled, quarter-final popularity, match-id source_key, no image", () => {
    const ev = matchToEvent(byId(555003), "quarter", CUP_CL, NOW)!;
    expect(ev.slug).toBe("arsenal-v-bayern-quarter-final-2027-04-06");
    expect(ev.source_key).toBe("football-data:match:555003");
    expect(ev.date).toBe("2027-04-06T19:00:00Z");
    expect(ev.all_day).toBe(false);
    expect(ev.timezone).toBe("UTC");
    expect(ev.date_precision).toBe("instant");
    expect(ev.status).toBe("scheduled");
    expect(ev.category).toBe("sports");
    expect(ev.regions).toEqual(["GLOBAL"]);
    expect(ev.popularity).toBe(45);
    expect(ev.featured).toBe(false);
    expect(ev.confidence).toBe(0.9);
    expect(ev.source).toBe("football-data");
    expect(ev.source_url).toBe("https://www.football-data.org/");
    expect(ev.tags).toEqual(["football", "soccer", "sports", "cl", "quarter-finals", "knockout"]);
    expect(ev.external_ids).toEqual({ football_data_competition: 2001, football_data_match: 555003, football_data_season: 2557 });
    expect(ev.image_candidate_url).toBeNull();
    expect(ev.location).toBeNull();
    expect(ev.jsonld_eligible).toBe(false);
    const raw = ev.raw as Record<string, unknown>;
    expect(Object.keys(raw).sort()).toEqual(["area", "awayTeam", "competition", "group", "homeTeam", "id", "lastUpdated", "matchday", "season", "stage", "status", "utcDate", "venue"]);
    expect(raw).not.toHaveProperty("score");
  });
  it("SCHEDULED final with TBD teams: day precision, all-day, stable title, 75 popularity, indexable description", () => {
    const ev = matchToEvent(byId(555007), "final", CUP_CL, NOW)!;
    expect(ev.title).toBe("UEFA Champions League final");
    expect(ev.slug).toBe("uefa-champions-league-final-2027-05-29");
    expect(ev.date).toBe("2027-05-29");
    expect(ev.all_day).toBe(true);
    expect(ev.timezone).toBeNull();
    expect(ev.date_precision).toBe("day");
    expect(ev.status).toBe("scheduled");
    expect(ev.popularity).toBe(75);
    expect(ev.featured).toBe(false);
    expect(ev.description.length).toBeGreaterThanOrEqual(80);
    expect(ev.tags).toContain("final");
  });
  it("POSTPONED keeps the last known kick-off with status postponed; FINISHED/past and league-phase rows are dropped", () => {
    const ev = matchToEvent(byId(555005), "quarter", CUP_CL, NOW)!;
    expect(ev.status).toBe("postponed");
    expect(ev.date).toBe("2027-04-14T19:00:00Z");
    expect(ev.title).toBe("Liverpool v Inter (quarter-final)");
    expect(matchToEvent(byId(555001), "opener", CUP_CL, NOW)).toBeNull(); // FINISHED
    expect(matchToEvent({ ...byId(555003), status: "IN_PLAY" }, "quarter", CUP_CL, NOW)).toBeNull();
    expect(matchToEvent({ ...byId(555003), utcDate: "2026-09-09T11:00:00Z" }, "quarter", CUP_CL, NOW)).toBeNull(); // kicked off an hour ago
    expect(matchToEvent({ ...byId(555003), status: "CANCELLED" }, "quarter", CUP_CL, NOW)!.status).toBe("cancelled");
    expect(matchToEvent({ ...byId(555003), utcDate: null }, "quarter", CUP_CL, NOW)).toBeNull();
    // Upstream placeholder dates far in the future are rejected by the far-future guard.
    expect(matchToEvent({ ...byId(555007), utcDate: "2099-05-29T00:00:00Z" }, "final", CUP_CL, NOW)).toBeNull();
    expect(matchToEvent({ ...byId(555003), utcDate: "2099-04-06T19:00:00Z" }, "quarter", CUP_CL, NOW)).toBeNull();
  });
  it("every competition row carries the sports tag, not only those matching a TAG_RULE", () => {
    const bundesliga: FdMatch = {
      ...PL.matches![1],
      id: 800001,
      competition: { id: 2002, name: "Bundesliga", code: "BL1" },
      season: { id: 3, startDate: "2026-08-21", endDate: "2027-05-22" },
    };
    const bl1 = COMPETITIONS.find((c) => c.code === "BL1")!;
    const ev = matchToEvent(bundesliga, "opener", bl1, PRESEASON)!;
    expect(ev.tags).toEqual(["football", "soccer", "sports", "bl1", "regular-season", "season-opener"]);
    expect(ev.regions).toEqual(["DE"]);
    expect(ev.title).toBe("Bundesliga 2026–27 opening match");
  });
  it("WC/EC finals are featured with the marquee popularity; the label-year guard rejects drifted titles", () => {
    const wc = COMPETITIONS.find((c) => c.code === "WC")!;
    const final: FdMatch = {
      ...byId(555007),
      id: 700001,
      utcDate: "2030-07-21T18:00:00Z",
      status: "TIMED",
      competition: { id: 2000, name: "FIFA World Cup", code: "WC" },
      season: { id: 9999, startDate: "2030-06-13", endDate: "2030-07-21" },
    };
    const ev = matchToEvent(final, "final", wc, NOW)!;
    expect(ev.title).toBe("FIFA World Cup final");
    expect(ev.popularity).toBe(90);
    expect(ev.featured).toBe(true);
    expect(ev.regions).toEqual(["GLOBAL"]);
    expect(ev.tags).toContain("sports");
    // An opener whose season label disagrees with the kick-off year is dropped.
    const drifted: FdMatch = { ...final, id: 700002, stage: "GROUP_STAGE", season: { id: 1, startDate: "2028-06-01", endDate: "2028-07-01" } };
    expect(matchToEvent(drifted, "opener", wc, NOW)).toBeNull();
  });
  it("league opener: one row with the country region, season-opener tag, venue → location + jsonld; none once it kicked off", () => {
    const rows = matchesToEvents(PL.matches!, LEAGUE_PL, PRESEASON);
    expect(rows).toHaveLength(1);
    const ev = rows[0];
    expect(ev.title).toBe("Premier League 2026–27 opening match");
    expect(ev.slug).toBe("premier-league-2026-27-opening-match-2026-08-21");
    expect(ev.source_key).toBe("football-data:match:556001");
    expect(ev.regions).toEqual(["GB"]);
    expect(ev.popularity).toBe(35);
    expect(ev.tags).toContain("season-opener");
    expect(ev.location).toEqual({ name: "Anfield" });
    expect(ev.jsonld_eligible).toBe(true);
    expect(matchesToEvents(PL.matches!, LEAGUE_PL, NOW)).toEqual([]);
  });
  it("fixture → rows: stable source_keys and identical rows across two calls, every row valid, cap respected", () => {
    const a = matchesToEvents(CL.matches!, CUP_CL, NOW);
    const b = matchesToEvents(CL.matches!, CUP_CL, NOW);
    expect(a.map((r) => r.source_key)).toEqual([
      "football-data:match:555003",
      "football-data:match:555004",
      "football-data:match:555005",
      "football-data:match:555006",
      "football-data:match:555007",
    ]);
    expect(a).toEqual(b);
    expect(new Set(a.map((r) => r.slug)).size).toBe(a.length);
    for (const r of a) {
      const parsed = IngestEventSchema.safeParse(r);
      expect(parsed.success, `${r.slug}: ${JSON.stringify(parsed.success ? null : parsed.error.issues)}`).toBe(true);
      expect(r.source).toBe("football-data");
      expect(r.date_precision === "instant" ? r.timezone : null).toBe(r.date_precision === "instant" ? "UTC" : null);
      expect(r.description.length).toBeGreaterThanOrEqual(80);
    }
    expect(a.find((r) => r.source_key.endsWith("555004"))!.title).toBe("UEFA Champions League quarter-final");
    expect(a.find((r) => r.source_key.endsWith("555006"))!.date).toBe("2027-04-27");
  });
});

describe("football-data plan / run", () => {
  it("cursor is the last completed code; foreign shapes restart; ended seasons from the catalogue are skipped", () => {
    expect(parseCursor(null)).toEqual({ afterCode: null });
    expect(parseCursor({ afterCode: "CL" })).toEqual({ afterCode: "CL" });
    expect(parseCursor({ afterCode: "XX" })).toEqual({ afterCode: null });
    expect(parseCursor({ i: 3 })).toEqual({ afterCode: null });
    expect(planUnits(null).map((u) => u.code)).toEqual(COMPETITIONS.map((c) => c.code));
    expect(planUnits("CL").map((u) => u.code)).toEqual(["PL", "ELC", "BL1", "SA", "PD", "FL1", "DED", "PPL", "BSA"]);
    expect(planUnits("BSA")).toEqual([]);
    expect(planUnits(null)[0]).toMatchObject({ key: "football-data:WC", after: { afterCode: "WC" } });
    // Recorded catalogue (2026-09-09): the 2026 World Cup and Euro 2024 are over, the rest are live.
    expect([...endedCodes(CATALOGUE, NOW)].sort()).toEqual(["EC", "WC"]);
    expect(endedCodes(null, NOW).size).toBe(0);
    expect(planUnits("CL", endedCodes(CATALOGUE, NOW)).map((u) => u.code)).toContain("PL");
    expect(planUnits(null, endedCodes(CATALOGUE, NOW)).map((u) => u.code)).toEqual(["CL", "PL", "ELC", "BL1", "SA", "PD", "FL1", "DED", "PPL", "BSA"]);
  });
  it("only WC/EC are ever skipped: a CL catalogue season that ended (league phase only) still runs", () => {
    expect([...SKIPPABLE].sort()).toEqual(["EC", "WC"]);
    // Recorded catalogue: CL currentSeason.endDate is 2027-01-27 (league phase). In February–May the
    // knockout rounds are scheduled while that date is past; the CL unit must still be planned.
    const cl = CATALOGUE.competitions!.find((c) => c.code === "CL")!;
    expect(cl.currentSeason!.endDate).toBe("2027-01-27");
    const feb = new Date("2027-02-15T12:00:00Z");
    expect(endedCodes(CATALOGUE, feb).has("CL")).toBe(false);
    expect([...endedCodes(CATALOGUE, feb)].sort()).toEqual(["EC", "WC"]);
    // Explicitly ended CL and PL seasons are not skipped either; an ended WC is.
    const ended: FdCompetitionsResponse = {
      competitions: [
        { id: 2001, code: "CL", currentSeason: { id: 1, startDate: "2026-09-08", endDate: "2026-09-01" } },
        { id: 2021, code: "PL", currentSeason: { id: 2, startDate: "2025-08-15", endDate: "2026-05-24" } },
        { id: 2000, code: "WC", currentSeason: { id: 3, startDate: "2026-06-11", endDate: "2026-07-19" } },
        { id: 2018, code: "EC", currentSeason: { id: 4, startDate: "2028-06-09", endDate: "2028-07-09" } },
      ],
    };
    expect([...endedCodes(ended, NOW)]).toEqual(["WC"]);
    expect(planUnits(null, endedCodes(ended, NOW)).map((u) => u.code)).toContain("CL");
    expect(planUnits(null, endedCodes(ended, NOW)).map((u) => u.code)).toContain("PL");
  });
  it("isConfigured needs FOOTBALL_DATA_API_KEY; the key travels as X-Auth-Token on match requests only", async () => {
    expect(adapter.isConfigured()).toBe(false);
    expect(authHeaders()).toEqual({});
    process.env.FOOTBALL_DATA_API_KEY = " test-key ";
    expect(adapter.isConfigured()).toBe(true);
    expect(authHeaders()).toEqual({ "X-Auth-Token": "test-key" });
    const calls: Array<{ url: string; headers?: Record<string, string> }> = [];
    const ctx = ctxFor({ [`${FD_BASE}/competitions/CL/matches`]: CL, [`${FD_BASE}/competitions`]: CATALOGUE }, calls);
    const plan = await adapter.plan(null, ctx);
    expect(plan.done).toBe(true);
    expect(plan.units.map((u) => u.code)).toEqual(["CL", "PL", "ELC", "BL1", "SA", "PD", "FL1", "DED", "PPL", "BSA"]);
    expect(calls[0]).toEqual({ url: `${FD_BASE}/competitions`, headers: undefined });
    const rows = await adapter.run(plan.units[0], ctx);
    expect(calls[1]).toEqual({ url: `${FD_BASE}/competitions/CL/matches`, headers: { "X-Auth-Token": "test-key" } });
    expect(rows.map((r) => r.source_key)).toEqual(matchesToEvents(CL.matches!, CUP_CL, NOW).map((r) => r.source_key));
    expect(adapter.id).toBe("football-data");
    expect(adapter.rank).toBe(6);
    expect(adapter.limits.minIntervalMs).toBe(7000);
  });
  it("a 403/404 for one competition completes the unit empty instead of failing the whole source", async () => {
    const calls: Array<{ url: string }> = [];
    const warned: string[] = [];
    const ctx = ctxFor({ [`${FD_BASE}/competitions/WC/matches`]: new HttpError(403, `${FD_BASE}/competitions/WC/matches`) }, calls);
    ctx.log.warn = (m: string) => void warned.push(m);
    const unit = planUnits(null)[0];
    expect(unit.code).toBe("WC");
    await expect(adapter.run(unit, ctx)).resolves.toEqual([]);
    expect(calls.map((c) => c.url)).toEqual([`${FD_BASE}/competitions/WC/matches`]); // no ?status retry on 403
    expect(warned.join(" ")).toContain("HTTP 403");
    const notFound = ctxFor({ [`${FD_BASE}/competitions/EC/matches`]: new HttpError(404, "x") });
    await expect(adapter.run(planUnits("WC")[0], notFound)).resolves.toEqual([]);
  });
  it("any other failure of the whole-season request is retried once as ?status=SCHEDULED", async () => {
    const calls: Array<{ url: string }> = [];
    const ctx = ctxFor(
      {
        [`${FD_BASE}/competitions/CL/matches?status=SCHEDULED`]: CL,
        [`${FD_BASE}/competitions/CL/matches`]: new HttpError(400, "bad filter"),
      },
      calls,
    );
    const rows = await adapter.run(planUnits("EC")[0], ctx);
    expect(calls.map((c) => c.url)).toEqual([`${FD_BASE}/competitions/CL/matches`, `${FD_BASE}/competitions/CL/matches?status=SCHEDULED`]);
    expect(rows.map((r) => r.source_key)).toEqual(matchesToEvents(CL.matches!, CUP_CL, NOW).map((r) => r.source_key));
    // When the fallback fails too, the unit fails: the runner retries and eventually backs off.
    const both = ctxFor({ [`${FD_BASE}/competitions/CL/matches`]: new HttpError(500, "boom") });
    await expect(adapter.run(planUnits("EC")[0], both)).rejects.toThrow();
  });
  it("a failed catalogue call falls back to every code; the pass resumes after the cursor", async () => {
    const ctx = ctxFor({ [`${FD_BASE}/competitions`]: new Error("HTTP 503") });
    const plan = await adapter.plan({ afterCode: "PL" }, ctx);
    expect(plan.done).toBe(true);
    expect(plan.units.map((u) => u.code)).toEqual(["ELC", "BL1", "SA", "PD", "FL1", "DED", "PPL", "BSA"]);
    expect(plan.units.at(-1)!.after).toEqual({ afterCode: "BSA" });
  });
});
