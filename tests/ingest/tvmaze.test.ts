import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { IngestEventSchema, type IngestContext } from "@/lib/ingest/types";
import { catalogDay } from "@/lib/time";
import {
  adapter,
  channelOf,
  describe as describeShow,
  DEFAULT_MIN_WEIGHT,
  episodeToEvent,
  isYearSeason,
  MAX_ROWS,
  minWeight,
  NEAR_DAYS,
  parseCursor,
  planUnits,
  scheduleToEvents,
  titleFor,
  toUtcInstant,
  TVMAZE_ENDPOINT,
  withArticle,
  type TvmazeEpisode,
} from "@/lib/ingest/sources/tvmaze";

/** The fixture's earliest premiere airs 2026-09-08; `NOW` sits on that day so it counts as future. */
const NOW = new Date("2026-09-08T12:00:00Z");
const LATER = new Date("2026-09-09T12:00:00Z");
const FIXTURE: TvmazeEpisode[] = JSON.parse(readFileSync(new URL("../fixtures/tvmaze/schedule-full-sample.json", import.meta.url), "utf8"));

function ctxFor(body: unknown, calls: string[] = [], now = NOW): IngestContext {
  return {
    http: {
      fetchJson: async <T,>(url: string) => {
        calls.push(url);
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

const byId = (id: number) => FIXTURE.find((e) => e.id === id)!;

afterEach(() => {
  delete process.env.TVMAZE_MIN_WEIGHT;
});

describe("tvmaze helpers", () => {
  it("titles: series premiere for season 1, season N premiere otherwise, '<show> <year>' for year-numbered editions", () => {
    const show = byId(3717627)._embedded!.show!;
    expect(titleFor(show, 1)).toBe("All Creatures Great and Small series premiere");
    expect(titleFor(show, 7)).toBe("All Creatures Great and Small season 7 premiere");
    expect(titleFor(byId(3444239)._embedded!.show!, 2026)).toBe("The Emmy Awards 2026");
    expect(isYearSeason(2026)).toBe(true);
    expect(isYearSeason(35)).toBe(false);
    expect(isYearSeason(1899)).toBe(false);
  });
  it("description is own wording (never show.summary): channel, local airdate, genres, format, broadcast facts", () => {
    const show = byId(3726131)._embedded!.show!;
    const text = describeShow(show, 3, "2026-09-28", "CBC", { countryName: "Japan", airtime: "23:30", runtime: 30 });
    expect(text).toBe(
      "Season 3 of As a Reincarnated Aristocrat I'll Use My Appraisal Skill to Rise in the New World premieres on CBC on September 28, 2026. Adventure, Anime, Fantasy · Japanese-language Animation. It airs in Japan at 23:30 local time. Episodes run about 30 minutes.",
    );
    expect(describeShow(byId(3444239)._embedded!.show!, 2026, "2026-09-14", "NBC", { countryName: "United States", airtime: "20:00", runtime: 180 })).toBe(
      "The 2026 edition of The Emmy Awards airs on NBC on September 14, 2026. Award Show. It airs in the United States at 20:00 local time. Episodes run about 180 minutes.",
    );
    expect(withArticle("United States")).toBe("the United States");
    expect(withArticle("Netherlands")).toBe("the Netherlands");
    expect(withArticle("Japan")).toBe("Japan");
  });
  it("description always clears the 80-char indexability bar with facts, never with upstream prose", () => {
    // 0009_indexable_summary.sql gates `indexable` on length(description) >= 80 and only queues a
    // wikipedia_summary job for featured / popularity >= 45 / series rows — no tvmaze row qualifies,
    // so `summary` stays null forever and the description has to clear the bar by itself.
    const short = describeShow(byId(3693908)._embedded!.show!, 1, "2026-10-01", "HBO");
    expect(short).toBe("War premieres on HBO on October 1, 2026. Thriller, Legal · Scripted. October 1, 2026 falls on a Thursday.");
    const bare = describeShow({ id: 1, name: "X", genres: [], type: null }, 2, "2027-01-05", null);
    expect(bare).toBe("Season 2 of X premieres on January 5, 2027. January 5, 2027 falls on a Tuesday. The countdown on this page tracks the time left until it airs.");
    expect(bare.length).toBeGreaterThanOrEqual(80);
    expect(short.length).toBeGreaterThanOrEqual(80);
  });
  it("channelOf prefers the broadcast network and falls back to the web channel; toUtcInstant normalises offsets", () => {
    expect(channelOf(byId(3717627)._embedded!.show!)).toEqual({ name: "5", country: { name: "United Kingdom", code: "GB", timezone: "Europe/London" }, kind: "network" });
    expect(channelOf(byId(3599814)._embedded!.show!)).toEqual({ name: "Disney+", country: null, kind: "web" });
    expect(channelOf({ id: 1, name: "x", network: null, webChannel: null })).toBeNull();
    expect(toUtcInstant("2026-09-17T20:00:00+00:00")).toBe("2026-09-17T20:00:00Z");
    expect(toUtcInstant("2026-09-28T23:30:00+09:00")).toBe("2026-09-28T14:30:00Z");
    expect(toUtcInstant("2026-09-28")).toBeNull();
    expect(toUtcInstant("garbage")).toBeNull();
    expect(toUtcInstant(null)).toBeNull();
  });
  it("minWeight reads TVMAZE_MIN_WEIGHT and ignores nonsense", () => {
    expect(minWeight()).toBe(DEFAULT_MIN_WEIGHT);
    process.env.TVMAZE_MIN_WEIGHT = "95";
    expect(minWeight()).toBe(95);
    process.env.TVMAZE_MIN_WEIGHT = "abc";
    expect(minWeight()).toBe(DEFAULT_MIN_WEIGHT);
    process.env.TVMAZE_MIN_WEIGHT = "150";
    expect(minWeight()).toBe(DEFAULT_MIN_WEIGHT);
  });
});

describe("tvmaze fixture → rows", () => {
  const rows = scheduleToEvents(FIXTURE, NOW);
  const byKey = new Map(rows.map((r) => [r.source_key, r]));

  it("every row validates: source tvmaze, scheduled, confidence 0.9, popularity ≤ 35, no image, no jsonld, stable keys", () => {
    expect(rows.length).toBe(8);
    for (const r of rows) {
      const parsed = IngestEventSchema.safeParse(r);
      expect(parsed.success, `${r.slug}: ${JSON.stringify(parsed.success ? null : parsed.error.issues)}`).toBe(true);
      expect(r.source).toBe("tvmaze");
      expect(r.source_key).toMatch(/^tvmaze:ep:\d+$/);
      expect(r.source_url).toMatch(/^https:\/\/www\.tvmaze\.com\/episodes\/\d+\//);
      expect(r.status).toBe("scheduled");
      expect(r.confidence).toBe(0.9);
      expect(r.featured).toBe(false);
      expect(r.popularity).toBeLessThanOrEqual(35);
      expect(r.popularity).toBeGreaterThanOrEqual(23);
      expect(r.image_candidate_url).toBeNull();
      expect(r.jsonld_eligible).toBe(false);
      expect(r.series_slug).toBeNull();
      expect(r.location).toBeNull();
      expect(r.tags).toEqual(expect.arrayContaining(["tv", "premiere"]));
      expect(r.description.length).toBeGreaterThanOrEqual(80); // the indexable bar of 0009_indexable_summary.sql
      expect(r.tags.some((t) => /^\d+$/.test(t))).toBe(false); // a bare numeric channel tag ("5") is a useless facet
      expect(r.description).not.toMatch(/<p>|<b>/);
      expect(typeof r.external_ids.tvmaze_episode).toBe("number");
      expect(typeof r.external_ids.tvmaze_show).toBe("number");
    }
    expect(new Set(rows.map((r) => r.source_key)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(rows.length);
  });
  it("is deterministic across two calls; sorted by weight desc", () => {
    const again = scheduleToEvents(FIXTURE, NOW);
    expect(again).toEqual(rows);
    expect(again.map((r) => r.source_key)).toEqual(rows.map((r) => r.source_key));
    expect(rows.map((r) => r.popularity)).toEqual([...rows.map((r) => r.popularity)].sort((a, b) => b - a));
    expect(rows.map((r) => [r.source_key, r.slug, r.date, r.date_precision, r.timezone, r.regions.join("+"), r.category])).toMatchSnapshot();
  });
  it("network show with a real airtime → instant in UTC, network timezone, country region, season tag, imdb/thetvdb ids", () => {
    const r = byKey.get("tvmaze:ep:3717627")!;
    expect(r.title).toBe("All Creatures Great and Small season 7 premiere");
    expect(r.slug).toBe("all-creatures-great-and-small-season-7-premiere-2026-09-17");
    expect(r.date).toBe("2026-09-17T20:00:00Z");
    expect(r.all_day).toBe(false);
    expect(r.date_precision).toBe("instant");
    expect(r.timezone).toBe("Europe/London");
    expect(r.regions).toEqual(["GB"]);
    expect(r.category).toBe("tv");
    expect(r.tags).toEqual(["tv", "premiere", "season-7", "channel-5", "drama"]); // UK Channel 5, namespaced
    expect(r.popularity).toBe(33); // weight 99 / 3
    expect(r.external_ids).toEqual({ imdb: "tt10590066", thetvdb: 378982, tvmaze_episode: 3717627, tvmaze_show: 42836 });
    expect(r.source_url).toBe("https://www.tvmaze.com/episodes/3717627/all-creatures-great-and-small-7x01-back-to-school");
    expect(r.description).toBe(
      "Season 7 of All Creatures Great and Small premieres on 5 on September 17, 2026. Drama · Scripted. It airs in the United Kingdom at 21:00 local time. Episodes run about 60 minutes.",
    );
    expect(r.raw).toMatchObject({ id: 3717627, season: 7, number: 1, airtime: "21:00", show: { id: 42836, weight: 99 } });
    expect(JSON.stringify(r.raw)).not.toContain("summary");
  });
  it("empty airtime → all-day airdate (never the synthesised midnight airstamp), network timezone kept, series premiere", () => {
    const r = byKey.get("tvmaze:ep:3693908")!;
    expect(r.title).toBe("War series premiere");
    expect(r.date).toBe("2026-10-01");
    expect(r.all_day).toBe(true);
    expect(r.date_precision).toBe("day");
    expect(r.timezone).toBe("America/New_York");
    expect(r.regions).toEqual(["US"]);
    expect(r.tags).toContain("series-premiere");
    expect(r.tags).toContain("hbo");
    expect(r.popularity).toBe(33);
  });
  it("web-channel-only shows: GLOBAL region and null timezone without a country; the channel country when present", () => {
    const disney = byKey.get("tvmaze:ep:3599814")!;
    expect(disney.title).toBe("City of Blood series premiere");
    expect(disney.regions).toEqual(["GLOBAL"]);
    expect(disney.timezone).toBeNull();
    expect(disney.date).toBe("2026-09-16");
    expect(disney.tags).toContain("disney");
    expect(disney.description).toContain("German-language Scripted");
    const binge = byKey.get("tvmaze:ep:3717241")!;
    expect(binge.regions).toEqual(["AU"]);
    expect(binge.timezone).toBe("Australia/Sydney");
    expect(binge.all_day).toBe(true);
  });
  it("anime genre → category anime; an instant that stays inside the local air day keeps instant precision", () => {
    const anime = byKey.get("tvmaze:ep:3726131")!;
    expect(anime.category).toBe("anime");
    expect(anime.date).toBe("2026-09-28T14:30:00Z"); // 23:30 Asia/Tokyo, still the 28th in UTC
    expect(anime.date.slice(0, 10)).toBe((anime.raw as { airdate: string }).airdate);
    expect(anime.date_precision).toBe("instant");
    expect(anime.timezone).toBe("Asia/Tokyo");
    expect(anime.regions).toEqual(["JP"]);
    expect(anime.tags).toEqual(expect.arrayContaining(["anime", "adventure", "fantasy", "season-3", "cbc"]));
  });
  it("an instant whose UTC day runs past the local air day keeps its time and is still filed on the local day", () => {
    // 20:00 America/New_York is 00:00Z the next day. The row keeps the instant and is slugged and
    // filed by `catalogDay()` in the show's own zone, so the countdown ticks to 20:00 on the 14th
    // and every listing still says the 14th. Before the local-day derivation the adapter had to
    // choose, and chose the day — dropping the time from 95 of its 199 all-day rows.
    const emmy = byKey.get("tvmaze:ep:3444239")!;
    expect(emmy.title).toBe("The Emmy Awards 2026");
    expect((emmy.raw as { airstamp: string }).airstamp).toBe("2026-09-15T00:00:00+00:00");
    expect(emmy.date).toBe("2026-09-15T00:00:00Z");
    expect(emmy.slug).toBe("the-emmy-awards-2026-2026-09-14");
    expect(emmy.all_day).toBe(false);
    expect(emmy.date_precision).toBe("instant");
    expect(emmy.timezone).toBe("America/New_York");
    expect(emmy.description).toContain("on September 14, 2026"); // the day the row carries
    expect(emmy.description).toContain("at 20:00 local time");
    expect(emmy.tags).toContain("season-2026");
    expect(emmy.tags).not.toContain("series-premiere");
    expect(emmy.external_ids).toEqual({ thetvdb: 115021, tvmaze_episode: 3444239, tvmaze_show: 6755 }); // imdb null → omitted
    // Every row is filed under the day it airs locally, whatever its instant does in UTC.
    for (const r of rows) expect(catalogDay(r.date, r.timezone)).toBe((r.raw as { airdate: string }).airdate);
  });
  it("filters: talk shows, low weight, specials, non-first episodes, past airdates, year-season mismatch", () => {
    expect(byKey.has("tvmaze:ep:3717920")).toBe(false); // The View: Talk Show
    expect(byKey.has("tvmaze:ep:3729571")).toBe(false); // significant_special, number null
    expect(byKey.has("tvmaze:ep:3747248")).toBe(false); // DANG! 1x02, same-day multi-episode drop
    expect(byKey.has("tvmaze:ep:3696904")).toBe(true); // DANG! 1x01 kept
    expect(episodeToEvent(byId(3717920), NOW)).toEqual({ reject: "show-type" });
    expect(episodeToEvent({ ...byId(3717627), _embedded: { show: { ...byId(3717627)._embedded!.show!, weight: 40 } } }, NOW)).toEqual({ reject: "weight" });
    expect(episodeToEvent(byId(3729571), NOW)).toEqual({ reject: "not-premiere" });
    expect(episodeToEvent(byId(3747248), NOW)).toEqual({ reject: "not-premiere" });
    expect(episodeToEvent(byId(3696904), LATER)).toEqual({ reject: "past" });
    expect(scheduleToEvents(FIXTURE, LATER).some((r) => r.source_key === "tvmaze:ep:3696904")).toBe(false);
    expect(episodeToEvent({ ...byId(3444239), airdate: "2027-01-10", airstamp: "2027-01-10T01:00:00+00:00" }, NOW)).toEqual({ reject: "label-year" });
    expect(episodeToEvent({ ...byId(3717627), airdate: "not-a-date" }, NOW)).toEqual({ reject: "bad-date" });
    expect(episodeToEvent({ ...byId(3717627), _embedded: { show: null } }, NOW)).toEqual({ reject: "no-show" });
    expect(episodeToEvent({ ...byId(3717627), airdate: "2045-09-17", airstamp: "2045-09-17T20:00:00+00:00" }, NOW)).toEqual({ reject: "far-future" });
    // The weight threshold is tunable through the environment (near-term rows keep the slack).
    process.env.TVMAZE_MIN_WEIGHT = "98";
    expect(scheduleToEvents(FIXTURE, NOW).map((r) => r.source_key).sort()).toEqual([
      "tvmaze:ep:3444239",
      "tvmaze:ep:3599814",
      "tvmaze:ep:3693908",
      "tvmaze:ep:3696904",
      "tvmaze:ep:3717241",
      "tvmaze:ep:3717627",
      "tvmaze:ep:3726131",
    ]); // floor 98 - 15 inside the near window
  });
  it("weight hysteresis: a near premiere passes at threshold - 15, the same show further out does not", () => {
    // show.weight is a rolling daily index; without the slack a premiere whose show dips a couple of
    // points would vanish and mark_stale_records would flip it to 'tentative' until it recovered.
    const near = byId(3694402); // weight 69, airdate 2026-09-16 — 8 days out
    expect(near._embedded!.show!.weight).toBe(69);
    expect(episodeToEvent(near, NOW)).toHaveProperty("event");
    expect(byKey.get("tvmaze:ep:3694402")!.popularity).toBe(23);
    const far = { ...near, airdate: "2027-03-01", airstamp: "2027-03-01T00:00:00+00:00" };
    expect(episodeToEvent(far, NOW)).toEqual({ reject: "weight" });
    const edge = { ...near, airdate: new Date(NOW.getTime() + NEAR_DAYS * 86_400_000).toISOString().slice(0, 10) };
    expect(episodeToEvent(edge, NOW)).toHaveProperty("event"); // the boundary day is still "near"
    const past = { ...near, airdate: new Date(NOW.getTime() + (NEAR_DAYS + 1) * 86_400_000).toISOString().slice(0, 10) };
    expect(episodeToEvent(past, NOW)).toEqual({ reject: "weight" });
  });
  it("collapses duplicate show-seasons to the earliest airdate and caps the run at MAX_ROWS", () => {
    const base = byId(3717627);
    const dup = { ...base, id: 9_000_001, airdate: "2026-09-10", airtime: "21:00", airstamp: "2026-09-10T20:00:00+00:00" };
    const rows2 = scheduleToEvents([base, dup], NOW);
    expect(rows2).toHaveLength(1);
    expect(rows2[0].source_key).toBe("tvmaze:ep:9000001");
    const many: TvmazeEpisode[] = Array.from({ length: MAX_ROWS + 25 }, (_, i) => ({
      ...base,
      id: 10_000_000 + i,
      _embedded: { show: { ...base._embedded!.show!, id: 20_000_000 + i, name: `Show ${i}` } },
    }));
    expect(scheduleToEvents(many, NOW)).toHaveLength(MAX_ROWS);
  });
});

describe("tvmaze adapter plan/run", () => {
  it("plans exactly one unit per pass with a day-addressed cursor; parseCursor accepts only that shape", async () => {
    const units = planUnits(NOW);
    expect(units).toEqual([{ key: "tvmaze:schedule-full:2026-09-08", label: "TVMaze full schedule (2026-09-08)", after: { fetchedOn: "2026-09-08" }, day: "2026-09-08" }]);
    expect(parseCursor({ fetchedOn: "2026-09-08" })).toEqual({ fetchedOn: "2026-09-08" });
    expect(parseCursor({ fetchedOn: "yesterday" })).toBeNull();
    expect(parseCursor([1])).toBeNull();
    expect(parseCursor(null)).toBeNull();
    const plan = await adapter.plan({ fetchedOn: "2026-09-08" }, ctxFor(FIXTURE));
    expect(plan.done).toBe(true);
    expect(plan.units).toHaveLength(1); // a same-day re-run still fetches: an empty pass would mark every row stale
  });
  it("run() fetches the endpoint once and returns identical rows across two calls; non-array bodies yield no rows", async () => {
    const calls: string[] = [];
    const ctx = ctxFor(FIXTURE, calls);
    const [unit] = planUnits(NOW);
    const a = await adapter.run(unit, ctx);
    const b = await adapter.run(unit, ctx);
    expect(calls).toEqual([TVMAZE_ENDPOINT, TVMAZE_ENDPOINT]);
    expect(a).toEqual(b);
    expect(a.map((r) => r.source_key)).toEqual(scheduleToEvents(FIXTURE, NOW).map((r) => r.source_key));
    expect(await adapter.run(unit, ctxFor({ error: "nope" }))).toEqual([]);
    expect(adapter.id).toBe("tvmaze");
    expect(adapter.rank).toBe(5);
    expect(adapter.cadence).toBe("daily");
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.limits).toEqual({ concurrency: 1, minIntervalMs: 1000, timeoutMs: 90_000, maxRetries: 2 });
  });
});
