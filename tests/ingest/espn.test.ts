/*
 * The fixture `tests/fixtures/espn/scoreboard.json` is HAND-AUTHORED from the documented ESPN MMA
 * scoreboard shape. It was NOT recorded from a live response: the machine this adapter was written
 * on has no outbound network access, so no call to site.api.espn.com was ever made and nothing in
 * the fixture has been verified against the real endpoint. Ids, card numbers, matchups and venues
 * are invented. The first real run of this source MUST replace the fixture with a recorded
 * response (`curl "$ESPN_BASE?dates=YYYYMMDD-YYYYMMDD" > tests/fixtures/espn/scoreboard.json`) and
 * these expectations re-checked against it — most of all the nesting of `events`, the exact
 * `status.type.name` strings and whether `date` really omits seconds.
 *
 * Because the shape is a guess, the tests below deliberately spend as much effort on TOLERANCE
 * (alternative nestings, missing fields, unknown statuses) as on the happy path: the failure this
 * adapter must never have is silently producing zero rows.
 *
 * These tests exercise the mapper only — nothing here touches the network (see football-data.test.ts).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  adapter,
  cardNumber,
  describeEvent,
  ESPN_BASE,
  espnEventToRow,
  extractEvents,
  fightcenterUrl,
  firstCompetition,
  isFightNight,
  iso2,
  locationOf,
  looksLikeEvent,
  MIN_DESCRIPTION,
  parseCursor,
  planUnits,
  popularityFor,
  rawDateOf,
  scoreboardToEvents,
  scoreboardUrl,
  sourceUrlOf,
  statusOf,
  titleOf,
  toEventDate,
  WINDOW_COUNT,
  windowsFor,
  type EspnEvent,
  type EspnScoreboard,
} from "@/lib/ingest/sources/espn";
import { IngestEventSchema, type IngestContext } from "@/lib/ingest/types";

const NOW = new Date("2026-09-10T12:00:00Z");
const SCOREBOARD = JSON.parse(readFileSync(new URL("../fixtures/espn/scoreboard.json", import.meta.url), "utf8")) as EspnScoreboard;
const events = (): EspnEvent[] => (SCOREBOARD.events ?? []).map((e) => structuredClone(e));
const byId = (id: string): EspnEvent => events().find((e) => String(e.id) === id)!;
const rows = (now = NOW) => scoreboardToEvents(structuredClone(SCOREBOARD), now);
const rowFor = (id: string) => rows().find((r) => r.source_key === `espn:mma:${id}`)!;

function ctxFor(responses: Record<string, unknown>, calls: string[] = [], now = NOW): IngestContext {
  return {
    http: {
      fetchJson: async <T,>(url: string) => {
        calls.push(url);
        if (!(url in responses)) throw new Error(`no fixture for ${url}`);
        return responses[url] as T;
      },
      fetchText: async () => "",
    },
    log: { info() {}, warn() {}, error() {} },
    now,
    budget: { remainingMs: () => 60_000 },
    dryRun: true,
  };
}

describe("espn: date normalisation", () => {
  it("fills in the seconds ESPN omits and keeps the instant in UTC", () => {
    expect(toEventDate("2026-09-12T22:00Z")).toEqual({ date: "2026-09-12T22:00:00Z", instant: true });
    expect(toEventDate("2026-09-12T22:00:00Z")).toEqual({ date: "2026-09-12T22:00:00Z", instant: true });
    expect(toEventDate("2026-09-12T22:00:00.000Z")).toEqual({ date: "2026-09-12T22:00:00Z", instant: true });
    // An offset stamp (not what ESPN sends today) is converted rather than trusted as written.
    expect(toEventDate("2026-09-12T18:00:00-04:00")).toEqual({ date: "2026-09-12T22:00:00Z", instant: true });
    expect(toEventDate("  2026-09-12T22:00Z  ")).toEqual({ date: "2026-09-12T22:00:00Z", instant: true });
  });
  it("a suspect stamp becomes an all-day date, never a synthesised midnight", () => {
    // No time component at all.
    expect(toEventDate("2026-09-12")).toEqual({ date: "2026-09-12", instant: false });
    // Exactly midnight UTC: ESPN's placeholder for a card with no broadcast slot yet.
    expect(toEventDate("2026-09-12T00:00Z")).toEqual({ date: "2026-09-12", instant: false });
    expect(toEventDate("2026-09-12T00:00:00.000Z")).toEqual({ date: "2026-09-12", instant: false });
    // A time-bearing stamp that will not parse still yields its day.
    expect(toEventDate("2026-09-12Tnonsense")).toEqual({ date: "2026-09-12", instant: false });
    // One minute past midnight is a real time and is kept.
    expect(toEventDate("2026-09-12T00:01Z")).toEqual({ date: "2026-09-12T00:01:00Z", instant: true });
  });
  it("ESPN's own timeValid flag outranks the midnight heuristic in both directions", () => {
    // A perfectly good-looking stamp that ESPN says is not a real slot.
    expect(toEventDate("2026-09-12T22:00Z", false)).toEqual({ date: "2026-09-12", instant: false });
    expect(toEventDate("2026-09-12T22:00Z", true)).toEqual({ date: "2026-09-12T22:00:00Z", instant: true });
    // The flag is absent on plenty of payloads; the midnight backstop still catches the placeholder.
    expect(toEventDate("2026-09-12T00:00Z", null)).toEqual({ date: "2026-09-12", instant: false });
    // timeValid: true does NOT rescue an exact midnight — it is still indistinguishable from the
    // placeholder, and a wrong hour is worse than a right day.
    expect(toEventDate("2026-09-12T00:00Z", true)).toEqual({ date: "2026-09-12", instant: false });
  });
  it("nothing usable at all", () => {
    for (const bad of [null, undefined, "", "soon", "12/09/2026", "2026-13-45T22:00Z", 20260912 as unknown as string]) {
      expect(toEventDate(bad as string | null)).toBeNull();
    }
  });
  it("reads the date from whichever path carries one", () => {
    expect(rawDateOf({ date: "2026-09-12T22:00Z" })).toBe("2026-09-12T22:00Z");
    expect(rawDateOf({ competitions: [{ date: "2026-09-12T22:00Z" }] })).toBe("2026-09-12T22:00Z");
    expect(rawDateOf({ competitions: [null, { startDate: "2026-09-12T22:00Z" }] })).toBe("2026-09-12T22:00Z");
    expect(rawDateOf({ startDate: "2026-09-12T22:00Z" })).toBe("2026-09-12T22:00Z");
    expect(rawDateOf({ id: "1" })).toBeNull();
  });
});

describe("espn: envelope tolerance", () => {
  const one = { id: "401612345", date: "2026-09-12T22:00Z", name: "UFC Fight Night: Silva vs. Delgado" };
  it("finds events in the flat envelope, in the sports/leagues envelope and in a bare array", () => {
    expect(extractEvents({ events: [one] }).map((e) => e.id)).toEqual(["401612345"]);
    expect(extractEvents({ sports: [{ leagues: [{ events: [one] }] }] }).map((e) => e.id)).toEqual(["401612345"]);
    expect(extractEvents({ leagues: [{ events: [one] }] }).map((e) => e.id)).toEqual(["401612345"]);
    expect(extractEvents([one]).map((e) => e.id)).toEqual(["401612345"]);
  });
  it("the same event at two depths is returned once", () => {
    expect(extractEvents({ events: [one], sports: [{ leagues: [{ events: [one] }] }] })).toHaveLength(1);
  });
  it("ignores everything that is not an event", () => {
    expect(extractEvents(null)).toEqual([]);
    expect(extractEvents("")).toEqual([]);
    expect(extractEvents({ leagues: [{ id: "26", name: "Ultimate Fighting Championship" }] })).toEqual([]);
    // Competitors carry ids too; they are not events.
    expect(extractEvents({ events: [{ id: "x", athlete: { displayName: "A" } }] })).toEqual([]);
    expect(looksLikeEvent({ id: "x", date: "2026-09-12T22:00Z" })).toBe(true);
    expect(looksLikeEvent({ date: "2026-09-12T22:00Z" })).toBe(false);
    expect(looksLikeEvent([1, 2])).toBe(false);
  });
  it("the fixture parses through the same walk", () => {
    expect(extractEvents(SCOREBOARD)).toHaveLength(9);
  });
});

describe("espn: status, titles, popularity, venue", () => {
  it("maps the statuses that matter and keeps an unknown one schedulable", () => {
    expect(statusOf({ status: { type: { name: "STATUS_SCHEDULED", state: "pre" } } })).toBe("scheduled");
    expect(statusOf({ competitions: [{ status: { type: { name: "STATUS_SCHEDULED", state: "pre" } } }] })).toBe("scheduled");
    expect(statusOf({ status: { type: { name: "STATUS_POSTPONED", state: "pre" } } })).toBe("postponed");
    expect(statusOf({ status: { type: { name: "STATUS_DELAYED", state: "pre" } } })).toBe("postponed");
    expect(statusOf({ status: { type: { name: "STATUS_CANCELED", state: "post" } } })).toBe("cancelled");
    expect(statusOf({ status: { type: { name: "STATUS_FINAL", state: "post", completed: true } } })).toBeNull();
    expect(statusOf({ status: { type: { name: "STATUS_IN_PROGRESS", state: "in" } } })).toBeNull();
    // Neither recognised nor terminal: a future card from a schedule feed is still a card.
    expect(statusOf({ status: { type: { name: "STATUS_SOMETHING_NEW" } } })).toBe("scheduled");
    expect(statusOf({ id: "1" })).toBe("scheduled");
  });
  it("titles fall back rather than dropping the card, and are empty only when nothing is usable", () => {
    expect(titleOf(byId("401612345"))).toBe("UFC Fight Night: Silva vs. Delgado");
    expect(titleOf({ shortName: "Silva vs. Delgado" })).toBe("Silva vs. Delgado");
    expect(titleOf({ competitions: [{ name: "UFC 349" }] })).toBe("UFC 349");
    expect(titleOf({ id: "1" })).toBe("");
    expect(titleOf({ name: "  " })).toBe("");
  });
  it("numbered cards, Fight Nights and the modest popularity ladder", () => {
    expect(cardNumber("UFC 349: Ferreira vs. Whitlock")).toBe(349);
    expect(cardNumber("UFC 350: Okafor vs. Rahimov")).toBe(350);
    expect(cardNumber("UFC Fight Night: Silva vs. Delgado")).toBeNull();
    // Numbered Fight Nights and network cards are not pay-per-views.
    expect(cardNumber("UFC Fight Night 250: Silva vs. Delgado")).toBeNull();
    expect(cardNumber("UFC on ABC 8: Silva vs. Delgado")).toBeNull();
    expect(isFightNight("UFC Fight Night: Silva vs. Delgado")).toBe(true);
    expect(isFightNight("UFC 349: Ferreira vs. Whitlock")).toBe(false);
    expect(popularityFor("UFC 349: Ferreira vs. Whitlock")).toBe(45);
    expect(popularityFor("UFC 350: Okafor vs. Rahimov")).toBe(55); // landmark card
    expect(popularityFor("UFC Fight Night: Silva vs. Delgado")).toBe(30);
    expect(popularityFor("The Ultimate Fighter Finale")).toBe(30);
  });
  it("venue is read from the competition or the event, and country codes are normalised", () => {
    expect(locationOf(byId("401612345"))).toEqual({ name: "UFC APEX", city: "Las Vegas", country: "US" });
    expect(locationOf(byId("401612350"))).toEqual({ name: "Etihad Arena", city: "Abu Dhabi", country: "AE" });
    // No venue published yet (common for a card months out).
    expect(locationOf(byId("401612377"))).toBeNull();
    expect(locationOf({ venue: { name: "Accor Arena", address: { city: "Paris", country: "FRA" } } })).toEqual({
      name: "Accor Arena",
      city: "Paris",
      country: "FR",
    });
    // An unrecognised country is left off rather than stored in a second format.
    expect(locationOf({ venue: { fullName: "Somewhere", address: { city: "Nowhere", country: "Atlantis" } } })).toEqual({
      name: "Somewhere",
      city: "Nowhere",
    });
    expect(iso2("USA")).toBe("US");
    expect(iso2("BR")).toBe("BR");
    expect(iso2("")).toBeNull();
    expect(iso2(undefined)).toBeNull();
    expect(firstCompetition({ competitions: [null, { id: "c" }] })).toEqual({ id: "c" });
    expect(firstCompetition({ id: "1" })).toBeNull();
  });
  it("source_url prefers the published /mma/ link and falls back to the fightcenter id", () => {
    expect(sourceUrlOf(byId("401612345"), "401612345")).toBe("https://www.espn.com/mma/fightcenter/_/id/401612345");
    expect(sourceUrlOf({ links: [{ href: "https://www.espn.com/watch/x" }, { href: "https://www.espn.com/mma/story/x" }] }, "9")).toBe(
      "https://www.espn.com/mma/story/x",
    );
    expect(sourceUrlOf({ links: [{ href: "not-a-url" }] }, "9")).toBe(fightcenterUrl("9"));
    expect(sourceUrlOf({}, "9")).toBe("https://www.espn.com/mma/fightcenter/_/id/9");
  });
});

describe("espn: mapping the fixture", () => {
  it("keeps the six schedulable cards, in payload order", () => {
    expect(rows().map((r) => r.source_key)).toEqual([
      "espn:mma:401612345",
      "espn:mma:401612349",
      "espn:mma:401612350",
      "espn:mma:401612377",
      "espn:mma:401612351",
      "espn:mma:401612390",
    ]);
  });
  it("every row validates against the ingest schema", () => {
    for (const row of rows()) expect(IngestEventSchema.safeParse(row).success).toBe(true);
  });
  it("a card with a real time becomes an instant filed on its UTC day", () => {
    const row = rowFor("401612345");
    expect(row.date).toBe("2026-09-12T22:00:00Z");
    expect(row.all_day).toBe(false);
    expect(row.date_precision).toBe("instant");
    expect(row.timezone).toBe("UTC");
    expect(row.slug).toBe("ufc-fight-night-silva-vs-delgado-2026-09-12");
    expect(row.title).toBe("UFC Fight Night: Silva vs. Delgado");
    expect(row.status).toBe("scheduled");
    expect(row.confidence).toBe(0.9);
    expect(row.popularity).toBe(30);
    expect(row.category).toBe("sports");
    expect(row.tags).toEqual(["mma", "ufc", "sports", "fight-night"]);
    expect(row.regions).toEqual(["GLOBAL"]);
    expect(row.external_ids).toEqual({ espn_event: "401612345" });
    expect(row.source_url).toBe("https://www.espn.com/mma/fightcenter/_/id/401612345");
    expect(row.location).toEqual({ name: "UFC APEX", city: "Las Vegas", country: "US" });
    expect(row.jsonld_eligible).toBe(true);
    expect(row.description).toBe(
      "UFC Fight Night: Silva vs. Delgado is a UFC Fight Night card at UFC APEX in Las Vegas on 12 September 2026. ESPN lists the card as starting at 22:00 UTC.",
    );
  });
  it("a numbered card is tagged and ranked above a Fight Night", () => {
    const numbered = rowFor("401612349");
    expect(numbered.tags).toEqual(["mma", "ufc", "sports", "numbered-card"]);
    expect(numbered.popularity).toBe(45);
    expect(numbered.date).toBe("2026-10-03T02:00:00Z");
    expect(numbered.slug).toBe("ufc-349-ferreira-vs-whitlock-2026-10-03");
    expect(rowFor("401612350").popularity).toBe(55);
  });
  it("a midnight-UTC date comes out all-day, not as a fake 00:00 instant", () => {
    const row = rowFor("401612351");
    // Strip the flag: the midnight backstop alone must reach the same answer, because plenty of
    // payloads omit `timeValid`.
    const unflagged = structuredClone(byId("401612351"));
    delete unflagged.competitions![0]!.timeValid;
    const result = espnEventToRow(unflagged, NOW);
    expect("event" in result && result.event.date).toBe("2026-12-05");
    expect(row.date).toBe("2026-12-05");
    expect(row.all_day).toBe(true);
    expect(row.date_precision).toBe("day");
    expect(row.timezone).toBeNull();
    expect(row.confidence).toBe(0.8);
    expect(row.slug).toBe("ufc-351-ivanova-vs-bright-2026-12-05");
    expect(row.description).toContain("ESPN lists the date but no start time yet");
  });
  it("a card with no venue keeps its time and loses only the place", () => {
    const row = rowFor("401612377");
    expect(row.location).toBeNull();
    expect(row.jsonld_eligible).toBe(false);
    expect(row.date).toBe("2026-11-21T21:30:00Z");
    expect(row.popularity).toBe(30);
    expect(row.description).toBe(
      "UFC Fight Night: Novak vs. Ellery is a UFC Fight Night card on 21 November 2026. ESPN lists the card as starting at 21:30 UTC.",
    );
  });
  it("timeValid: false makes a card all-day however plausible its stamp looks", () => {
    // A 19:00 stamp is exactly the case the midnight backstop would miss.
    const row = rowFor("401612390");
    expect(row.date).toBe("2026-12-19");
    expect(row.all_day).toBe(true);
    expect(row.date_precision).toBe("day");
    expect(row.timezone).toBeNull();
    expect(row.confidence).toBe(0.8);
    expect(row.slug).toBe("ufc-fight-night-brandt-vs-osei-2026-12-19");
    expect(row.description).toBe(
      "UFC Fight Night: Brandt vs. Osei is a UFC Fight Night card at UFC APEX in Las Vegas on 19 December 2026. ESPN lists the date but no start time yet, so this countdown runs to the day itself.",
    );
    // The flag that caused it is kept on the row's raw payload.
    expect((row.raw as { timeValid: boolean | null }).timeValid).toBe(false);
    // Same card with the flag flipped: the time comes back.
    const timed = structuredClone(byId("401612390"));
    timed.competitions![0]!.timeValid = true;
    const result = espnEventToRow(timed, NOW);
    expect("event" in result && result.event.date).toBe("2026-12-19T19:00:00Z");
  });
  it("descriptions always clear the indexability bar", () => {
    for (const row of rows()) expect(row.description.length).toBeGreaterThanOrEqual(MIN_DESCRIPTION);
    // The shortest text this can produce (a two-sentence instant row with no venue and a bare
    // title) is padded until it clears the bar.
    const bare = describeEvent("UFC", { date: "2027-05-01T22:00:00Z", instant: true }, "scheduled", null);
    expect(bare).toContain("The countdown on this page tracks the time left until the card begins.");
    expect(bare.length).toBeGreaterThanOrEqual(MIN_DESCRIPTION);
  });
  it("never sets an image candidate", () => {
    for (const row of rows()) expect(row.image_candidate_url).toBeNull();
  });
  it("is stable across runs: same keys, same slugs, same hashes", () => {
    const a = rows();
    const b = rows();
    expect(b.map((r) => [r.source_key, r.slug, r.content_hash])).toEqual(a.map((r) => [r.source_key, r.slug, r.content_hash]));
  });
});

describe("espn: what is dropped", () => {
  it("the finished card is dropped and the two malformed entries are skipped without throwing", () => {
    expect(rows().some((r) => r.source_key === "espn:mma:401612300")).toBe(false);
    expect(espnEventToRow(byId("401612300"), NOW)).toEqual({ reject: "status" });
    // Entry with a name but no date anywhere.
    expect(espnEventToRow(byId("401612907"), NOW)).toEqual({ reject: "bad-date" });
    // Entry with a date but no name, shortName or competition name.
    expect(espnEventToRow(byId("401612908"), NOW)).toEqual({ reject: "no-title" });
  });
  it("a past card is dropped even when its status has not flipped yet", () => {
    const past: EspnEvent = { ...byId("401612300"), status: { type: { name: "STATUS_SCHEDULED", state: "pre", completed: false } } };
    expect(past.date).toBe("2026-09-10T02:00Z"); // ten hours before NOW
    expect(espnEventToRow(past, NOW)).toEqual({ reject: "past" });
    // An all-day card yesterday still counts as current (precision-aware, like football-data).
    const yesterday: EspnEvent = { ...past, date: "2026-09-09" };
    expect("event" in espnEventToRow(yesterday, NOW)).toBe(true);
    const lastMonth: EspnEvent = { ...past, date: "2026-08-09" };
    expect(espnEventToRow(lastMonth, NOW)).toEqual({ reject: "past" });
  });
  it("a card beyond the far-future guard is dropped", () => {
    const far: EspnEvent = { ...byId("401612345"), id: "999", date: "2045-09-12T22:00Z" };
    expect(espnEventToRow(far, NOW)).toEqual({ reject: "far-future" });
  });
  it("junk never throws", () => {
    for (const junk of [null, undefined, {}, { id: null }, { id: "1" }, [] as unknown]) {
      expect(() => espnEventToRow(junk as EspnEvent, NOW)).not.toThrow();
      expect("event" in espnEventToRow(junk as EspnEvent, NOW)).toBe(false);
    }
    expect(scoreboardToEvents(null, NOW)).toEqual([]);
    expect(scoreboardToEvents({ events: "nope" }, NOW)).toEqual([]);
  });
  it("an empty or unrecognised payload is warned about, not passed off as a quiet week", () => {
    const warnings: string[] = [];
    const log = { info() {}, warn: (m: string) => void warnings.push(m), error() {} };
    expect(scoreboardToEvents({ somethingElse: [] }, NOW, log, "window")).toEqual([]);
    expect(warnings.join(" ")).toContain("no events found");
  });
  it("the same event twice in one payload yields one row", () => {
    const dup = { events: [byId("401612345"), byId("401612345")] };
    expect(scoreboardToEvents(dup, NOW)).toHaveLength(1);
  });
});

describe("espn: plan and run", () => {
  it("windows are consecutive, non-overlapping and start today", () => {
    const windows = windowsFor(NOW);
    expect(windows).toHaveLength(WINDOW_COUNT);
    expect(windows).toEqual([
      { start: "20260910", end: "20261208" },
      { start: "20261209", end: "20270308" },
      { start: "20270309", end: "20270606" },
      { start: "20270607", end: "20270904" },
    ]);
    expect(scoreboardUrl(windows[0])).toBe(`${ESPN_BASE}?dates=20260910-20261208`);
  });
  it("the cursor is a window start, and a stale one replans the whole pass", () => {
    expect(parseCursor(null)).toEqual({ afterStart: null });
    expect(parseCursor({ afterStart: "20260910" })).toEqual({ afterStart: "20260910" });
    expect(parseCursor({ afterStart: "nonsense" })).toEqual({ afterStart: null });
    expect(parseCursor(["20260910"])).toEqual({ afterStart: null });
    expect(planUnits(NOW, null)).toHaveLength(WINDOW_COUNT);
    expect(planUnits(NOW, "20260910").map((u) => u.window.start)).toEqual(["20261209", "20270309", "20270607"]);
    // Yesterday's cursor: every window of today's pass is later, so the pass runs in full.
    expect(planUnits(NOW, "20260909")).toHaveLength(WINDOW_COUNT);
    expect(planUnits(NOW, "20270607")).toEqual([]);
    const [first] = planUnits(NOW, null);
    expect(first.key).toBe("espn:mma:20260910-20261208");
    expect(first.after).toEqual({ afterStart: "20260910" });
  });
  it("plan() makes no request and run() maps one window", async () => {
    const calls: string[] = [];
    const ctx = ctxFor({ [`${ESPN_BASE}?dates=20260910-20261208`]: SCOREBOARD }, calls);
    const plan = await adapter.plan(null, ctx);
    expect(plan.done).toBe(true);
    expect(plan.units).toHaveLength(WINDOW_COUNT);
    expect(calls).toEqual([]);
    const out = await adapter.run(plan.units[0], ctx);
    expect(calls).toEqual([`${ESPN_BASE}?dates=20260910-20261208`]);
    expect(out.map((r) => r.source_key)).toEqual(rows().map((r) => r.source_key));
  });
  it("run() survives the sports/leagues envelope with no change in output", async () => {
    const nested = { sports: [{ id: "3300", leagues: [{ id: "26", events: events() }] }] };
    const ctx = ctxFor({ [`${ESPN_BASE}?dates=20260910-20261208`]: nested });
    const out = await adapter.run(planUnits(NOW, null)[0], ctx);
    expect(out.map((r) => r.source_key)).toEqual(rows().map((r) => r.source_key));
  });
  it("adapter contract", () => {
    expect(adapter.id).toBe("espn");
    expect(adapter.rank).toBe(6);
    expect(adapter.cadence).toBe("daily");
    expect(adapter.isConfigured()).toBe(true); // keyless
    expect(adapter.limits.concurrency).toBe(1);
    expect(adapter.limits.minIntervalMs).toBeGreaterThanOrEqual(1000);
  });
});
