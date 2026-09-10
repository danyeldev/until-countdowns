/*
 * Every fixture in `tests/fixtures/espn/` is HAND-AUTHORED and NONE of them was recorded: the
 * machine this adapter was written on has no outbound network, so no call to ESPN was ever made.
 * `scoreboard.json` follows the documented shape of the JSON API this source used to read, and
 * still exercises `extractEvents` / `scoreboardToEvents` — the mapping layer is unchanged and the
 * shapes it accepts are worth keeping under test. The four `schedule-*.html` files are a bigger
 * guess again: there is no published description of ESPN's markup, so the `__espnfitt__`
 * assignment, the ld+json block and the schedule table are invented to look plausible and are not
 * evidence of anything. Ids, card numbers, matchups and venues are fictional throughout.
 *
 * The first real run MUST replace these with a recorded page (`curl -sS
 * https://www.espn.com/mma/schedule/_/league/ufc`) and re-check the expectations below — most of
 * all which strategy the run reports, the nesting of `events` inside the page state, and whether
 * the schedule table looks anything like `schedule-markup.html`.
 *
 * Because the shapes are guesses, these tests spend as much effort on TOLERANCE and on the
 * FALLBACK ORDER as on the happy path: the failure this adapter must never have is silently
 * producing zero rows.
 *
 * These tests exercise the scraper and the mapper only — nothing here touches the network (see
 * football-data.test.ts).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  absoluteEspnUrl,
  adapter,
  balancedJson,
  cardNumber,
  describeEvent,
  espnEventToRow,
  eventsFromAppState,
  eventsFromJsonLd,
  eventsFromMarkup,
  extractEvents,
  fightcenterUrl,
  firstCompetition,
  hashId,
  idFromHref,
  isEventNode,
  isFightNight,
  iso2,
  jsonLdNodes,
  jsonLdToEspnEvent,
  locationOf,
  looksLikeEvent,
  markerReport,
  markupDate,
  markupRowToEvent,
  MIN_DESCRIPTION,
  parseCursor,
  planUnits,
  popularityFor,
  rawDateOf,
  SCHEDULE_UNIT_KEY,
  scoreboardToEvents,
  scrapeSchedule,
  SOURCE_URL,
  sourceUrlOf,
  stateBlobs,
  statusOf,
  titleOf,
  toEventDate,
  type EspnEvent,
  type EspnScoreboard,
  type StrategyImpl,
} from "@/lib/ingest/sources/espn";
import { decodeEntities } from "@/lib/ingest/normalize";
import { IngestEventSchema, type IngestContext, type IngestEvent } from "@/lib/ingest/types";

const NOW = new Date("2026-09-10T12:00:00Z");
const SCOREBOARD = JSON.parse(readFileSync(new URL("../fixtures/espn/scoreboard.json", import.meta.url), "utf8")) as EspnScoreboard;
const events = (): EspnEvent[] => (SCOREBOARD.events ?? []).map((e) => structuredClone(e));
const byId = (id: string): EspnEvent => events().find((e) => String(e.id) === id)!;
const rows = (now = NOW) => scoreboardToEvents(structuredClone(SCOREBOARD), now);
const rowFor = (id: string) => rows().find((r) => r.source_key === `espn:mma:${id}`)!;

const page = (name: string): string => readFileSync(new URL(`../fixtures/espn/${name}`, import.meta.url), "utf8");
const STATE_PAGE = page("schedule-state.html");
const JSONLD_PAGE = page("schedule-jsonld.html");
const MARKUP_PAGE = page("schedule-markup.html");
const CHALLENGE_PAGE = page("schedule-challenge.html");

/** The three cards every schedule fixture describes, in page order. */
const FIXTURE_IDS = ["401612345", "401612349", "401612351"];

type Logged = { info: string[]; warn: string[] };
function recorder(): { log: IngestContext["log"]; lines: Logged } {
  const lines: Logged = { info: [], warn: [] };
  return {
    lines,
    log: { info: (m: string) => void lines.info.push(m), warn: (m: string) => void lines.warn.push(m), error() {} },
  };
}

/** `raw` differs by construction between strategies (it echoes the fields each one carried). */
const stripRaw = (r: IngestEvent): Record<string, unknown> => ({ ...r, raw: null });

function ctxFor(html: string, calls: string[] = [], now = NOW, log: IngestContext["log"] = { info() {}, warn() {}, error() {} }): IngestContext {
  return {
    http: {
      fetchJson: async <T,>() => ({}) as T,
      fetchText: async (url: string) => {
        calls.push(url);
        return html;
      },
    },
    log,
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
  it("a time that names no zone is a day, because it means a different instant on every machine", () => {
    // `Date.parse` reads a zoneless stamp in the RUNNER's local zone: the cron box and a laptop
    // would file the same card at different instants, sometimes on different days. ESPN's JSON
    // never sent this shape; schema.org `startDate` and a `<time datetime>` attribute both allow
    // it, so the scraper reaches it and it must not become a confident wrong hour.
    expect(toEventDate("2026-09-12T19:00:00")).toEqual({ date: "2026-09-12", instant: false });
    expect(toEventDate("2026-09-12T19:00")).toEqual({ date: "2026-09-12", instant: false });
    expect(toEventDate("2026-09-12T19:00:00.500")).toEqual({ date: "2026-09-12", instant: false });
    // An explicit offset is unambiguous and is converted, not discarded.
    expect(toEventDate("2026-09-12T19:00:00+02:00")).toEqual({ date: "2026-09-12T17:00:00Z", instant: true });
    // And the whole point of the guard: the row is the same wherever the test runs.
    const flag = toEventDate("2026-09-12T19:00:00");
    expect(flag?.instant).toBe(false);
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

describe("espn: strategy 1 — the embedded app state", () => {
  it("balance-matches the object, counting braces and ignoring the ones inside strings", () => {
    const src = String.raw`window['__espnfitt__'] = {"name":"a } b","nested":{"k":"\"}\""},"n":1};</script>`;
    const open = src.indexOf("{");
    const json = balancedJson(src, open)!;
    // A greedy /\{[\s\S]*\}/ would have run to the end of the file; this stops at the real close.
    expect(json.endsWith('"n":1}')).toBe(true);
    expect(JSON.parse(json)).toEqual({ name: "a } b", nested: { k: '"}"' }, n: 1 });
  });
  it("an unterminated object yields null rather than a truncated parse", () => {
    expect(balancedJson('{"a":{"b":1}', 0)).toBeNull();
    // A brace that only closes inside a string literal never closes at all.
    expect(balancedJson('{"a":"}"', 0)).toBeNull();
    expect(balancedJson("not an object", 0)).toBeNull();
    expect(balancedJson('x = {"a":1}', 0)).toBeNull();
    // A trailing backslash inside the string: the escape must not swallow the closing quote and
    // leave the rest of the page inside a string literal.
    expect(balancedJson(String.raw`{"a":"c:\\"}` + " tail", 0)).toBe(String.raw`{"a":"c:\\"}`);
  });
  it("a blob that is an array is matched too, and mismatched nesting is refused", () => {
    // Nothing says a page state must be an object; a bracket-blind matcher would stop at the first
    // `}` inside one and hand JSON.parse a fragment.
    expect(balancedJson('[{"a":1},{"b":2}] rest of the bundle', 0)).toBe('[{"a":1},{"b":2}]');
    expect(balancedJson('{"a":[1,2],"b":{"c":[3]}} tail', 0)).toBe('{"a":[1,2],"b":{"c":[3]}}');
    expect(balancedJson("[1,2", 0)).toBeNull();
    // Balanced by count, not by kind: not JSON, and never worth handing on.
    expect(balancedJson('{"a":1]', 0)).toBeNull();
    expect(balancedJson('[{"a":1]}', 0)).toBeNull();
    const arrayState = '<script>window["__espnfitt__"] = [{"id":"5","name":"UFC 5: Roe vs. Doe","date":"2026-11-12T22:00Z"}];</script>';
    expect(eventsFromAppState(arrayState).map((e) => e.id)).toEqual(["5"]);
  });
  it("finds the blob in the fixture and hands the events to the existing walk", () => {
    const blobs = stateBlobs(STATE_PAGE);
    expect(blobs).toHaveLength(1);
    const state = JSON.parse(blobs[0]) as Record<string, unknown>;
    // The fixture hides a `}` and escaped quotes inside a string; the matcher kept the blob whole.
    expect(JSON.stringify(state)).toContain('{\\"league\\":\\"ufc\\"');
    expect(eventsFromAppState(STATE_PAGE).map((e) => String(e.id))).toEqual(FIXTURE_IDS);
    // The schedule sits eight levels down — deeper than the API envelope ever nested it.
    expect(extractEvents(state)).toHaveLength(3);
  });
  it("accepts the assignment forms a rename could plausibly take", () => {
    const one = '{"events":[{"id":"1","name":"UFC 1: Gracie vs. Gordeau","date":"2026-11-12T22:00Z"}]}';
    for (const assignment of [
      `<script>window['__espnfitt__'] = ${one};</script>`,
      `<script>window["__espnfitt__"]=${one};</script>`,
      `<script>window.__espnfitt__ = ${one};</script>`,
      `<script>window['__espnDataFitt__'] = ${one};</script>`,
      `<script id="__NEXT_DATA__" type="application/json">${one}</script>`,
    ]) {
      expect(eventsFromAppState(assignment).map((e) => e.name)).toEqual(["UFC 1: Gracie vs. Gordeau"]);
    }
  });
  it("a blob that will not parse, or holds no events, is passed over for the next candidate", () => {
    const broken = '<script>window["__espnfitt__"] = {"page":{"broken":,}};</script>';
    const empty = '<script>window["__adsFitt__"] = {"ads":{"slots":[]}};</script>';
    const good = '<script>window["__espnfitt__"] = {"events":[{"id":"7","name":"UFC 7","date":"2026-11-12T22:00Z"}]};</script>';
    expect(eventsFromAppState(broken)).toEqual([]);
    expect(eventsFromAppState(broken + good).map((e) => e.id)).toEqual(["7"]);
    expect(eventsFromAppState(empty + good).map((e) => e.id)).toEqual(["7"]);
    expect(eventsFromAppState("")).toEqual([]);
  });
});

describe("espn: strategy 2 — JSON-LD", () => {
  it("maps schema.org events onto the shape the mapping layer already reads", () => {
    const found = eventsFromJsonLd(JSONLD_PAGE);
    expect(found.map((e) => String(e.id))).toEqual(FIXTURE_IDS);
    const [first] = found;
    expect(first.name).toBe("UFC Fight Night: Silva vs. Delgado");
    // `startDate` is handed to toEventDate untouched — bare day or full instant, it decides.
    expect(first.date).toBe("2026-09-12T22:00Z");
    expect(firstCompetition(first)?.venue).toEqual({
      fullName: "UFC APEX",
      address: { city: "Las Vegas", state: "NV", country: "USA" },
    });
    expect(sourceUrlOf(first, "401612345")).toBe("https://www.espn.com/mma/fightcenter/_/id/401612345");
    // addressCountry as a Country node rather than a string.
    expect(locationOf(found[1])).toEqual({ name: "T-Mobile Arena", city: "Las Vegas", country: "US" });
  });
  it("one malformed ld+json block does not cost the events in another", () => {
    // The fixture carries a deliberately truncated second block.
    expect(JSONLD_PAGE.match(/application\/ld\+json/g)).toHaveLength(2);
    expect(eventsFromJsonLd(JSONLD_PAGE)).toHaveLength(3);
  });
  it("accepts a bare object, an array, an @graph and an ItemList", () => {
    const ev = { "@type": "SportsEvent", name: "UFC 400: Doe vs. Roe", startDate: "2026-10-31", url: "/mma/fightcenter/_/id/555" };
    const wrap = (body: unknown) => `<script type="application/ld+json">${JSON.stringify(body)}</script>`;
    for (const body of [ev, [ev], { "@graph": [ev] }, { "@type": "ItemList", itemListElement: [{ "@type": "ListItem", item: ev }] }]) {
      const [found] = eventsFromJsonLd(wrap(body));
      expect(found?.id).toBe("555");
      expect(found?.date).toBe("2026-10-31");
      // A relative url is absolutised, so `source_url` stays a URL the schema will accept.
      expect(sourceUrlOf(found, "555")).toBe("https://www.espn.com/mma/fightcenter/_/id/555");
      // A bare schema.org day survives toEventDate as a day and reaches a valid row.
      const result = espnEventToRow(found, NOW);
      expect("event" in result && result.event.date).toBe("2026-10-31");
      expect("event" in result && result.event.all_day).toBe(true);
      expect("event" in result && IngestEventSchema.safeParse(result.event).success).toBe(true);
    }
  });
  it("ignores nodes that are not events and blocks that are not ld+json", () => {
    expect(jsonLdNodes(JSONLD_PAGE).length).toBeGreaterThan(3); // the WebSite node is read, then dropped
    expect(isEventNode({ "@type": "SportsEvent" })).toBe(true);
    expect(isEventNode({ "@type": ["Thing", "Event"] })).toBe(true);
    expect(isEventNode({ "@type": "WebSite" })).toBe(false);
    expect(isEventNode({ name: "no type" })).toBe(false);
    expect(jsonLdToEspnEvent({ "@type": "SportsEvent", name: "UFC 400" })).toBeNull(); // no startDate
    expect(jsonLdToEspnEvent({ "@type": "SportsEvent", startDate: "2026-10-31" })).toBeNull(); // no name
    expect(eventsFromJsonLd('<script type="application/json">{"@type":"SportsEvent"}</script>')).toEqual([]);
    expect(eventsFromJsonLd(STATE_PAGE)).toEqual([]);
  });
  it("carries schema.org status and a location given as a bare string", () => {
    const node = {
      "@type": "Event",
      name: "UFC Fight Night: Cancelled vs. Card",
      startDate: "2026-10-31T22:00Z",
      eventStatus: "https://schema.org/EventCancelled",
      location: "T-Mobile Arena",
    };
    const ev = jsonLdToEspnEvent(node)!;
    expect(statusOf(ev)).toBe("cancelled");
    expect(locationOf(ev)).toEqual({ name: "T-Mobile Arena" });
    expect(statusOf(jsonLdToEspnEvent({ ...node, eventStatus: "https://schema.org/EventPostponed" })!)).toBe("postponed");
    expect(statusOf(jsonLdToEspnEvent({ ...node, eventStatus: "https://schema.org/EventScheduled" })!)).toBe("scheduled");
    // No id in the url: a hash of name+day, stable and recognisable as derived.
    const hashed = jsonLdToEspnEvent({ ...node, url: "https://www.espn.com/mma/" })!;
    expect(hashed.id).toBe(hashId("UFC Fight Night: Cancelled vs. Card", "2026-10-31"));
    expect(String(hashed.id)).toMatch(/^h[0-9a-f]{8}$/);
    expect(idFromHref("/mma/fightcenter/_/id/401612345")).toBe("401612345");
    expect(idFromHref("/mma/schedule/_/date/20261205")).toBeNull();
    expect(absoluteEspnUrl("mma/schedule")).toBe("https://www.espn.com/mma/schedule");
  });
  it("reads the url in the other two shapes JSON-LD writes it, so the row keeps ESPN's own id", () => {
    const base = { "@type": "SportsEvent", name: "UFC 400: Doe vs. Roe", startDate: "2026-10-31T22:00Z" };
    // A node reference and a one-element array are both ordinary schema.org; falling back to a
    // hash here would key the row differently from the layer above it for no reason.
    expect(jsonLdToEspnEvent({ ...base, url: { "@id": "/mma/fightcenter/_/id/777" } })?.id).toBe("777");
    expect(jsonLdToEspnEvent({ ...base, url: ["/mma/fightcenter/_/id/777"] })?.id).toBe("777");
    expect(jsonLdToEspnEvent({ ...base, url: 7 as unknown as string })?.id).toBe(hashId(base.name, "2026-10-31"));
  });
  it("a scheme-relative href becomes a real URL, not the origin glued to another origin", () => {
    expect(absoluteEspnUrl("//www.espn.com/mma/fightcenter/_/id/7")).toBe("https://www.espn.com/mma/fightcenter/_/id/7");
    const ev = jsonLdToEspnEvent({
      "@type": "SportsEvent",
      name: "UFC 400: Doe vs. Roe",
      startDate: "2026-10-31T22:00Z",
      url: "//www.espn.com/mma/fightcenter/_/id/777",
    })!;
    expect(sourceUrlOf(ev, "777")).toBe("https://www.espn.com/mma/fightcenter/_/id/777");
    const result = espnEventToRow(ev, NOW);
    expect("event" in result && IngestEventSchema.safeParse(result.event).success).toBe(true);
  });
  it("a schema.org startDate with no zone comes out all-day rather than in the runner's zone", () => {
    const ev = jsonLdToEspnEvent({
      "@type": "SportsEvent",
      name: "UFC 400: Doe vs. Roe",
      // Perfectly legal schema.org, and a stamp ESPN's JSON never produced.
      startDate: "2026-10-31T19:00:00",
      url: "/mma/fightcenter/_/id/777",
    })!;
    // The mapper is handed the string as written; toEventDate is the one place that decides.
    expect(ev.date).toBe("2026-10-31T19:00:00");
    const result = espnEventToRow(ev, NOW);
    expect("event" in result && result.event.date).toBe("2026-10-31");
    expect("event" in result && result.event.all_day).toBe(true);
    expect("event" in result && result.event.timezone).toBeNull();
  });
});

describe("espn: strategy 3 — the schedule table", () => {
  it("reads a day, a name and an id out of the table and skips everything else", () => {
    const found = eventsFromMarkup(MARKUP_PAGE, NOW);
    expect(found.map((e) => e.name)).toEqual([
      "UFC Fight Night: Silva vs. Delgado",
      "UFC 349: Ferreira vs. Whitlock",
      "UFC 351: Ivanova vs. Bright",
    ]);
    // Header row, the row with no event name and the promo row are all dropped.
    expect(found).toHaveLength(3);
    expect(found.map((e) => e.date)).toEqual(["2026-09-12", "2026-10-02", "2026-12-05"]);
    expect(found[0].id).toBe("401612345");
    // Linked without an id: the row keeps a stable identity of its own.
    expect(found[2].id).toBe(hashId("UFC 351: Ivanova vs. Bright", "2026-12-05"));
  });
  it("its rows are all-day by design, and it claims no venue", () => {
    const mapped = scoreboardToEvents(eventsFromMarkup(MARKUP_PAGE, NOW), NOW);
    expect(mapped).toHaveLength(3);
    for (const row of mapped) {
      expect(row.all_day).toBe(true);
      expect(row.date_precision).toBe("day");
      expect(row.timezone).toBeNull();
      expect(row.location).toBeNull();
      expect(IngestEventSchema.safeParse(row).success).toBe(true);
    }
    expect(mapped[0].source_url).toBe("https://www.espn.com/mma/fightcenter/_/id/401612345");
    // The table prints ESPN's local day, not the UTC one the state blob carries (2026-10-03T02:00Z):
    // one more reason this layer is last.
    expect(mapped[1].slug).toBe("ufc-349-ferreira-vs-whitlock-2026-10-02");
  });
  it("dates: an ISO stamp is passed through, a printed date gets the year the page omits", () => {
    expect(markupDate("Sat, Sep 12", NOW)).toBe("2026-09-12");
    expect(markupDate("September 12", NOW)).toBe("2026-09-12");
    expect(markupDate("Sept. 12", NOW)).toBe("2026-09-12");
    expect(markupDate("Dec 5, 2027", NOW)).toBe("2027-12-05");
    // Already well past: the schedule means next year's card, not last month's.
    expect(markupDate("Jan 3", NOW)).toBe("2027-01-03");
    // Just past: still this year, and the mapper drops it as past if it really is over.
    expect(markupDate("Sep 5", NOW)).toBe("2026-09-05");
    expect(markupDate("2026-09-12T22:00Z", NOW)).toBe("2026-09-12T22:00Z");
    expect(markupDate("2026-09-12", NOW)).toBe("2026-09-12");
    // Not dates: an unreal day, a card number, a bare word.
    expect(markupDate("Feb 30", NOW)).toBeNull();
    expect(markupDate("UFC 349", NOW)).toBeNull();
    expect(markupDate("TBD", NOW)).toBeNull();
    expect(markupDate("", NOW)).toBeNull();
  });
  it("a cell that leads with something number-shaped still gives up its date", () => {
    // One cell holding both the card and the day is exactly the layout a responsive table
    // collapses to. Stopping at the first `<word> <number>` would throw the date away.
    expect(markupDate("UFC 349 · Sat, Oct 2", NOW)).toBe("2026-10-02");
    expect(markupDate("Round 1 begins Sep 12", NOW)).toBe("2026-09-12");
    expect(markupDate("UFC 349 vs UFC 350", NOW)).toBeNull();
    expect(markupRowToEvent('<tr><td>UFC 349 · Sat, Oct 2</td><td><a href="/mma/fightcenter/_/id/9">UFC 349: Ferreira vs. Whitlock</a></td></tr>', NOW)?.date).toBe(
      "2026-10-02",
    );
  });
  it("a row needs a date and a name, and an unlinked row must at least read like a card", () => {
    const row = (html: string) => markupRowToEvent(`<tr>${html}</tr>`, NOW);
    expect(row("<td>Sat, Sep 12</td><td>UFC 349: Ferreira vs. Whitlock</td>")?.id).toBe(hashId("UFC 349: Ferreira vs. Whitlock", "2026-09-12"));
    // A date attribute is preferred over the printed cell, and keeps its time.
    expect(row('<td data-date="2026-09-12T22:00Z">Sat, Sep 12</td><td>UFC 349: Ferreira vs. Whitlock</td>')?.date).toBe("2026-09-12T22:00Z");
    expect(row("<td>Sat, Sep 12</td><td>Season pass on sale</td>")).toBeNull();
    expect(row("<td>TBD</td><td>UFC 349: Ferreira vs. Whitlock</td>")).toBeNull();
    expect(row("<th>DATE</th><th>EVENT</th>")).toBeNull();
    expect(markupRowToEvent("<tr></tr>", NOW)).toBeNull();
    expect(eventsFromMarkup(CHALLENGE_PAGE, NOW)).toEqual([]);
  });
  it("only a fightcenter link is conclusive; any other /mma/ anchor still has to read like a card", () => {
    const row = (html: string) => markupRowToEvent(`<tr>${html}</tr>`, NOW);
    // A schedule page is full of /mma/ links that are navigation. Treating a linked row as a card
    // on the strength of the link alone is how a rankings widget becomes a countdown.
    expect(row('<td>Sat, Sep 12</td><td><a href="/mma/rankings">Divisional rankings update</a></td>')).toBeNull();
    expect(row('<td>Sat, Sep 12</td><td><a href="/mma/story/_/id/44">Ranking the ten best finishes</a></td>')).toBeNull();
    // A fightcenter link is evidence in itself, whatever the anchor happens to say.
    expect(row('<td>Sat, Sep 12</td><td><a href="/mma/fightcenter/_/id/9">Silva vs. Delgado</a></td>')?.id).toBe("9");
    // And a /mma/ link that does read like a card is still kept (the third fixture row).
    expect(row('<td>Sat, Dec 5</td><td><a href="/mma/schedule/_/date/20261205">UFC 351: Ivanova vs. Bright</a></td>')?.name).toBe(
      "UFC 351: Ivanova vs. Bright",
    );
  });
  it("a row that cannot be decoded costs one row, not the whole table", () => {
    // `decodeEntities` throws RangeError on a numeric entity outside Unicode, and `sanitizeTitle`
    // calls it on every cell — so one of these anywhere on the page used to empty layer 3.
    expect(() => decodeEntities("&#x110000;")).toThrow();
    const bad = '<tr><td>Sat, Sep 12</td><td><a href="/mma/fightcenter/_/id/1">UFC 340&#x110000;: A vs. B</a></td></tr>';
    const good = '<tr><td>Sat, Oct 3</td><td><a href="/mma/fightcenter/_/id/2">UFC 341: C vs. D</a></td></tr>';
    expect(() => eventsFromMarkup(bad + good, NOW)).not.toThrow();
    expect(eventsFromMarkup(bad + good, NOW).map((e) => e.id)).toEqual(["2"]);
  });
});

describe("espn: which strategy fired", () => {
  it("each page is read by the layer it is a fixture for, and the run says which", () => {
    for (const [html, strategy] of [
      [STATE_PAGE, "app-state"],
      [JSONLD_PAGE, "json-ld"],
      [MARKUP_PAGE, "markup"],
    ] as const) {
      const { log, lines } = recorder();
      const scrape = scrapeSchedule(html, NOW, log, "espn");
      expect(scrape.strategy).toBe(strategy);
      expect(scrape.events).toHaveLength(3);
      // The info line is the only record of what ESPN actually served: it is logged every run.
      expect(lines.info).toHaveLength(1);
      expect(lines.info[0]).toContain(`strategy=${strategy}`);
      expect(lines.info[0]).toContain(`${html.length} bytes`);
      expect(lines.warn).toEqual([]);
    }
  });
  it("the first strategy that yields anything wins", () => {
    expect(scrapeSchedule(STATE_PAGE + JSONLD_PAGE + MARKUP_PAGE, NOW).strategy).toBe("app-state");
    expect(scrapeSchedule(JSONLD_PAGE + MARKUP_PAGE, NOW).strategy).toBe("json-ld");
    expect(scrapeSchedule(MARKUP_PAGE, NOW).strategy).toBe("markup");
    // A state blob that is present but useless is not allowed to shadow the layers below it.
    const emptyState = '<script>window["__espnfitt__"] = {"page":{"content":{}}};</script>';
    expect(scrapeSchedule(emptyState + MARKUP_PAGE, NOW).strategy).toBe("markup");
  });
  it("the app state and the JSON-LD describe the same three cards as the same three rows", () => {
    const fromState = scoreboardToEvents(eventsFromAppState(STATE_PAGE), NOW);
    const fromJsonLd = scoreboardToEvents(eventsFromJsonLd(JSONLD_PAGE), NOW);
    expect(fromState).toHaveLength(3);
    // Layer 2 builds the EspnEvent shape by hand: the check that matters is that what it builds
    // clears the same schema the upsert will, field for field, not merely that it has rows.
    for (const row of [...fromState, ...fromJsonLd]) expect(IngestEventSchema.safeParse(row).success).toBe(true);
    expect(fromJsonLd.map(stripRaw)).toEqual(fromState.map(stripRaw));
    // Including the hash the upsert uses to decide a row is unchanged.
    expect(fromJsonLd.map((r) => r.content_hash)).toEqual(fromState.map((r) => r.content_hash));
    // And the ordinary expectations of the mapping layer still hold on a scraped row.
    expect(fromState[0].date).toBe("2026-09-12T22:00:00Z");
    expect(fromState[0].location).toEqual({ name: "UFC APEX", city: "Las Vegas", country: "US" });
    expect(fromState[2].date).toBe("2026-12-05"); // midnight placeholder → all-day, from both layers
    expect(fromJsonLd[2].all_day).toBe(true);
  });
  it("a challenge page yields no rows and a warning that names the page and every marker", () => {
    const { log, lines } = recorder();
    const scrape = scrapeSchedule(CHALLENGE_PAGE, NOW, log, "espn");
    expect(scrape).toEqual({ strategy: null, events: [] });
    expect(scoreboardToEvents(scrape.events, NOW, log, "espn")).toEqual([]);
    expect(lines.info).toEqual([]);
    const warned = lines.warn.join("\n");
    expect(warned).toContain("strategy=none");
    expect(warned).toContain(`${CHALLENGE_PAGE.length} bytes`);
    expect(warned).toContain("app-state=no ld+json=no fightcenter-href=no");
    expect(warned).toContain("challenge page");
    expect(markerReport(STATE_PAGE)).toBe("app-state=yes ld+json=no fightcenter-href=no");
    expect(markerReport(JSONLD_PAGE)).toBe("app-state=no ld+json=yes fightcenter-href=yes");
    expect(markerReport(MARKUP_PAGE)).toBe("app-state=no ld+json=no fightcenter-href=yes");
  });
  it("junk in, no throw out", () => {
    expect(() => scrapeSchedule("", NOW)).not.toThrow();
    expect(() => scrapeSchedule(null as unknown as string, NOW)).not.toThrow();
    expect(scrapeSchedule("<html><body>nothing here</body></html>", NOW).events).toEqual([]);
    expect(scrapeSchedule(null as unknown as string, NOW).strategy).toBeNull();
  });
  it("a strategy that throws is warned about and the next one is still tried", () => {
    // The real readings are hard to make throw on demand, which is why the strategy list is a
    // parameter: the guarantee under test is the fall-through itself, not any one regex.
    const boom = (name: StrategyImpl["name"]): StrategyImpl => ({
      name,
      extract: () => {
        throw new Error(`${name} hit a shape it could not read`);
      },
    });
    const { log, lines } = recorder();
    const found: StrategyImpl = { name: "markup", extract: () => [{ id: "9", name: "UFC 9: Roe vs. Doe", date: "2026-11-01" }] };
    const scrape = scrapeSchedule(MARKUP_PAGE, NOW, log, "espn", [boom("app-state"), found]);
    expect(scrape.strategy).toBe("markup");
    expect(scrape.events).toHaveLength(1);
    expect(lines.warn.join("\n")).toContain("strategy app-state threw");
    expect(lines.warn.join("\n")).toContain("could not read");
    expect(lines.info[0]).toContain("strategy=markup");
  });
  it("every strategy throwing is a diagnosable warning, never an exception out of the run", () => {
    const { log, lines } = recorder();
    const boom = (name: StrategyImpl["name"]): StrategyImpl => ({
      name,
      extract: () => {
        throw new Error("nope");
      },
    });
    const strategies = [boom("app-state"), boom("json-ld"), boom("markup")];
    expect(() => scrapeSchedule(STATE_PAGE, NOW, log, "espn", strategies)).not.toThrow();
    expect(scrapeSchedule(STATE_PAGE, NOW, log, "espn", strategies)).toEqual({ strategy: null, events: [] });
    expect(lines.info).toEqual([]);
    // Three per pass for the readings, one for the verdict — and the verdict still names the
    // markers, so the log alone says whether the page was a challenge or a shape change.
    expect(lines.warn).toHaveLength(8);
    expect(lines.warn[3]).toContain("strategy=none");
    expect(lines.warn[3]).toContain("app-state=yes");
  });
  it("checking the markers does not disturb the blob scan that comes after it", () => {
    // `markerReport` and `stateBlobs` share module-level /g regexes, whose lastIndex survives a
    // `.test()`. Dot notation is the case that exposes it: exactly one pattern matches it (the
    // bracket patterns do not), so a marker check that leaves that pattern parked past the
    // assignment makes the blob vanish from the scan that follows. The bracket fixture cannot
    // show this — two patterns match it and either one alone finds the blob.
    const dotted = '<script>window.__espnfitt__ = {"events":[{"id":"8","name":"UFC 8: Roe vs. Doe","date":"2026-11-12T22:00Z"}]};</script>';
    expect(markerReport(dotted)).toBe("app-state=yes ld+json=no fightcenter-href=no");
    expect(stateBlobs(dotted)).toHaveLength(1);
    expect(eventsFromAppState(dotted).map((e) => e.id)).toEqual(["8"]);
    expect(markerReport(STATE_PAGE)).toBe("app-state=yes ld+json=no fightcenter-href=no");
    expect(eventsFromAppState(STATE_PAGE)).toHaveLength(3);
  });
  it("events that are all rejected are a warning, not a pass that looks ordinary", () => {
    const { log, lines } = recorder();
    // The page parsed, the cards are real, every one of them is over: zero rows either way, and
    // an info line here would read exactly like a quiet week.
    const stale: EspnEvent[] = [{ id: "1", name: "UFC 300: Old vs. Older", date: "2024-01-06T22:00Z" }];
    expect(scoreboardToEvents(stale, NOW, log, "espn [markup]")).toEqual([]);
    expect(lines.info).toEqual([]);
    expect(lines.warn.join("\n")).toContain("1 events → 0 kept");
    expect(lines.warn.join("\n")).toContain("skipped past=1");
  });
});

describe("espn: plan and run", () => {
  it("one page, one unit, and a cursor that only skips a unit already upserted", () => {
    expect(planUnits(null)).toHaveLength(1);
    const [unit] = planUnits(null);
    expect(unit.key).toBe(SCHEDULE_UNIT_KEY);
    expect(unit.url).toBe(SOURCE_URL);
    expect(unit.after).toEqual({ afterKey: SCHEDULE_UNIT_KEY });
    expect(planUnits(SCHEDULE_UNIT_KEY)).toEqual([]);
    expect(planUnits("espn:mma:20260910-20261208")).toHaveLength(1); // a cursor from the old shape
    expect(parseCursor(null)).toEqual({ afterKey: null });
    expect(parseCursor({ afterKey: SCHEDULE_UNIT_KEY })).toEqual({ afterKey: SCHEDULE_UNIT_KEY });
    expect(parseCursor({ afterStart: "20260910" })).toEqual({ afterKey: null });
    expect(parseCursor(["x"])).toEqual({ afterKey: null });
  });
  it("plan() makes no request and run() fetches the page as text, once", async () => {
    const calls: string[] = [];
    const { log, lines } = recorder();
    const ctx = ctxFor(STATE_PAGE, calls, NOW, log);
    const plan = await adapter.plan(null, ctx);
    expect(plan.done).toBe(true);
    expect(plan.units).toHaveLength(1);
    expect(calls).toEqual([]);
    const out = await adapter.run(plan.units[0], ctx);
    expect(calls).toEqual(["https://www.espn.com/mma/schedule/_/league/ufc"]);
    expect(out.map((r) => r.source_key)).toEqual(FIXTURE_IDS.map((id) => `espn:mma:${id}`));
    // Which layer produced the rows is on both log lines, not just the scraper's.
    expect(lines.info[0]).toContain("strategy=app-state");
    expect(lines.info[1]).toContain("[app-state]");
  });
  it("run() reports a challenge page as zero rows and a warning, never as a quiet week", async () => {
    const { log, lines } = recorder();
    const out = await adapter.run(planUnits(null)[0], ctxFor(CHALLENGE_PAGE, [], NOW, log));
    expect(out).toEqual([]);
    expect(lines.warn.join("\n")).toContain("strategy=none");
    expect(lines.warn.join("\n")).toContain("no events found"); // the mapping layer's own warning
  });
  it("run() falls all the way to the table when that is all the page has", async () => {
    const out = await adapter.run(planUnits(null)[0], ctxFor(MARKUP_PAGE));
    expect(out.map((r) => r.title)).toEqual([
      "UFC Fight Night: Silva vs. Delgado",
      "UFC 349: Ferreira vs. Whitlock",
      "UFC 351: Ivanova vs. Bright",
    ]);
    expect(out.every((r) => r.all_day)).toBe(true);
  });
  it("adapter contract", () => {
    expect(adapter.id).toBe("espn");
    expect(adapter.rank).toBe(6);
    expect(adapter.cadence).toBe("daily");
    expect(adapter.isConfigured()).toBe(true); // keyless
    expect(adapter.limits.concurrency).toBe(1);
    expect(adapter.limits.minIntervalMs).toBeGreaterThanOrEqual(1000);
    expect(SOURCE_URL).toBe("https://www.espn.com/mma/schedule/_/league/ufc");
  });
});
