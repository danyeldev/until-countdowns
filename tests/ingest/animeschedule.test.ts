import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { IngestEventSchema, type IngestContext, type Json } from "@/lib/ingest/types";
import {
  adapter,
  animeToEvent,
  AS_ENDPOINT,
  describe as describeAnime,
  externalIdsFor,
  horizonEnd,
  isLastPage,
  makeUnit,
  MAX_PAGES,
  mediaKind,
  PAGE_SIZE,
  pageToEvents,
  parseCursor,
  planFrom,
  planSlots,
  popularityFor,
  premiereDay,
  queryUrl,
  requestHeaders,
  seasonLabel,
  seasonStart,
  type AsAnime,
  type AsPayload,
} from "@/lib/ingest/sources/animeschedule";

/** Fall 2026 page 1 was recorded 2026-09-09; `NOW` sits on that day so every real premiere is future. */
const NOW = new Date("2026-09-09T12:00:00Z");
/** The summer rows premiered in July 2026; this "now" precedes them. */
const NOW_SUMMER = new Date("2026-07-01T00:00:00Z");
const load = (name: string): AsPayload => JSON.parse(readFileSync(new URL(`../fixtures/animeschedule/${name}.json`, import.meta.url), "utf8"));
const FALL = load("fall-2026-page1");
const SUMMER = load("summer-2026-page1");
const UNSEASONED = load("2026-page1");

const byId = (payload: AsPayload, id: string): AsAnime => payload.anime!.find((a) => a.id === id)!;

function ctxFor(bodies: Record<string, unknown> | unknown, calls: Array<{ url: string; headers?: Record<string, string> }> = [], now = NOW): IngestContext {
  return {
    http: {
      fetchJson: async <T,>(url: string, init?: { headers?: Record<string, string> }) => {
        calls.push({ url, headers: init?.headers });
        const table = bodies as Record<string, unknown>;
        if (table && typeof table === "object" && !Array.isArray(table) && url in table) return table[url] as T;
        return bodies as T;
      },
      fetchText: async () => "",
    },
    log: { info() {}, warn() {}, error() {} },
    now,
    budget: { remainingMs: () => 60_000 },
    dryRun: true,
  };
}

afterEach(() => {
  delete process.env.ANIMESCHEDULE_ENABLED;
  delete process.env.ANIMESCHEDULE_TOKEN;
});

describe("animeschedule helpers", () => {
  it("premiereDay: real days pass, the 0001-01-01 sentinel and garbage do not", () => {
    expect(premiereDay("2026-09-30T00:00:00Z")).toBe("2026-09-30");
    expect(premiereDay("0001-01-01T00:00:00Z")).toBeNull();
    expect(premiereDay("1900-12-31T00:00:00Z")).toBeNull();
    expect(premiereDay("2026-13-40T00:00:00Z")).toBeNull();
    expect(premiereDay("")).toBeNull();
    expect(premiereDay(null)).toBeNull();
    expect(premiereDay(12)).toBeNull();
  });
  it("seasons: quarter starts, labels, the 15-month horizon and the chronological slot list", () => {
    expect(seasonStart(2027, "winter")).toBe("2027-01-01");
    expect(seasonStart(2026, "fall")).toBe("2026-10-01");
    expect(horizonEnd(NOW)).toBe("2027-12-09");
    expect(horizonEnd(new Date("2026-11-30T00:00:00Z"))).toBe("2028-03-01"); // Feb 30 → Mar 1 (UTC overflow)
    expect(planSlots(NOW).map((s) => s.route)).toEqual(["2026", "summer-2026", "fall-2026", "2027", "winter-2027", "spring-2027", "summer-2027", "fall-2027"]);
    expect(planSlots(new Date("2026-11-15T00:00:00Z")).map((s) => s.route)).toEqual([
      "2026",
      "fall-2026",
      "2027",
      "winter-2027",
      "spring-2027",
      "summer-2027",
      "fall-2027",
      "2028",
      "winter-2028",
    ]);
    expect(seasonLabel(byId(FALL, "CvsP"))).toEqual({ label: "Fall 2026", season: "fall", year: 2026 });
    expect(seasonLabel(byId(UNSEASONED, "IyNV"))).toEqual({ label: "2026", season: null, year: 2026 });
    expect(seasonLabel({ id: "x", title: "x", route: "x", season: { season: "Autumn", year: "abc" } })).toEqual({ label: "", season: null, year: null });
  });
  it("queryUrl carries years/seasons/page; the token header is sent only when configured", () => {
    expect(queryUrl({ route: "fall-2026", year: 2026, season: "fall" }, 3)).toBe(`${AS_ENDPOINT}?years=2026&seasons=fall&page=3`);
    expect(queryUrl({ route: "2027", year: 2027, season: null }, 1)).toBe(`${AS_ENDPOINT}?years=2027&page=1`);
    expect(requestHeaders({})).toEqual({});
    expect(requestHeaders({ ANIMESCHEDULE_TOKEN: "  " })).toEqual({});
    expect(requestHeaders({ ANIMESCHEDULE_TOKEN: "abc" })).toEqual({ Authorization: "Bearer abc" });
  });
  it("isLastPage stops from totalAmount, short pages and the page cap — never by probing a 500ing page", () => {
    expect(isLastPage(1, PAGE_SIZE, 88)).toBe(false);
    expect(isLastPage(4, PAGE_SIZE, 88)).toBe(false);
    expect(isLastPage(5, 16, 88)).toBe(true);
    expect(isLastPage(2, 14, 32)).toBe(true);
    expect(isLastPage(2, PAGE_SIZE, 36)).toBe(true);
    expect(isLastPage(1, 0, 0)).toBe(true);
    expect(isLastPage(1, PAGE_SIZE, undefined)).toBe(false);
    expect(isLastPage(MAX_PAGES, PAGE_SIZE, undefined)).toBe(true);
  });
  it("externalIdsFor extracts MAL/AniList/AniDB ids and the Kitsu slug from websites", () => {
    expect(externalIdsFor(byId(FALL, "CvsP"))).toEqual({
      anidb: 17789,
      anilist: 159042,
      animeschedule: "CvsP",
      kitsu: "tensei-shitara-ken-deshita-2nd-season",
      mal: 53913,
      route: "tensei-shitara-ken-deshita-2",
    });
    expect(externalIdsFor(byId(FALL, "9n6q"))).not.toHaveProperty("kitsu"); // no kitsu link upstream
    expect(externalIdsFor(byId(FALL, "Qa3q")).kitsu).toBe("mahoutsukai-no-yoru"); // legacy kitsu.io host
    expect(externalIdsFor({ id: "z", title: "z", route: "z", websites: null })).toEqual({ animeschedule: "z", route: "z" });
  });
  it("description is own wording with season, day, optional dub day, format, studio, genres, episodes", () => {
    expect(describeAnime(byId(FALL, "i245"), "2026-10-20", null)).toBe(
      "Cyberpunk: Edgerunners II (Fall 2026) premieres on October 20, 2026. An original net animation (ONA) by Trigger in the action, drama, sci-fi genres, planned for 10 episodes.",
    );
    expect(describeAnime(byId(SUMMER, "9vIs"), "2026-07-08", "2026-09-09")).toBe(
      "Youjo Senki II (Summer 2026) premieres on July 8, 2026. English dub premiere: September 9, 2026. A TV anime by NUT in the action, isekai, magic, military genres, planned for 12 episodes.",
    );
    expect(describeAnime(byId(FALL, "9n6q"), "2026-12-11", null)).toBe(
      "Kusuriya no Hitorigoto Movie: Bouhi no Hihou (Fall 2026) premieres on December 11, 2026. An anime film by TOHO animation STUDIO in the drama, historical, mystery genres.",
    );
    // No studio, genres or episode count: the second sentence describes the listing rather than
    // degenerating into a ~40-character stub below the indexability bar.
    const bare = describeAnime({ id: "x", title: "Bare", route: "bare" }, "2027-01-05", null);
    expect(bare).toBe(
      "Bare premieres on January 5, 2027. An anime listed on AnimeSchedule; the premiere day is tracked from the announced broadcast schedule and updates here if it moves.",
    );
    expect(bare.length).toBeGreaterThanOrEqual(80);
    expect(mediaKind(byId(UNSEASONED, "PLvy"))).toBe("Chinese donghua (ONA)");
    expect(mediaKind({ id: "x", title: "x", route: "x", mediaTypes: [{ name: "Music", route: "music" }] })).toBe("Music anime");
    expect(popularityFor(byId(SUMMER, "6Tzq"))).toBe(30); // 2,449 trackers
    expect(popularityFor(byId(FALL, "CvsP"))).toBe(25); // 1,391
    expect(popularityFor(byId(FALL, "Qa3q"))).toBe(20); // 319
  });
});

describe("animeschedule fixture → rows", () => {
  const rows = pageToEvents(FALL.anime!, NOW);
  const byKey = new Map(rows.map((r) => [r.source_key, r]));

  it("every row validates: source animeschedule, all-day Asia/Tokyo day, scheduled, 0.7, popularity ≤ 30, no image, no jsonld", () => {
    expect(rows.length).toBe(5); // 6 rows, one sentinel premiere
    for (const r of rows) {
      const parsed = IngestEventSchema.safeParse(r);
      expect(parsed.success, `${r.slug}: ${JSON.stringify(parsed.success ? null : parsed.error.issues)}`).toBe(true);
      expect(r.source).toBe("animeschedule");
      expect(r.source_key).toMatch(/^animeschedule:[A-Za-z0-9]+$/);
      expect(r.source_url).toMatch(/^https:\/\/animeschedule\.net\/anime\/[a-z0-9-]+$/);
      expect(r.category).toBe("anime");
      expect(r.title.endsWith(" premiere")).toBe(true);
      expect(r.all_day).toBe(true);
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.date_precision).toBe("day");
      expect(r.timezone).toBe("Asia/Tokyo");
      expect(r.regions).toEqual(["JP", "GLOBAL"]);
      expect(r.status).toBe("scheduled");
      expect(r.confidence).toBe(0.7);
      expect(r.featured).toBe(false);
      expect(r.popularity).toBeGreaterThanOrEqual(20);
      expect(r.popularity).toBeLessThanOrEqual(30);
      expect(r.image_candidate_url).toBeNull();
      expect(r.image_candidate_meta).toBeNull();
      expect(r.jsonld_eligible).toBe(false);
      expect(r.series_slug).toBeNull();
      expect(r.location).toBeNull();
      expect(r.tags).toEqual(expect.arrayContaining(["anime", "premiere", "fall"]));
      expect(r.description.length).toBeGreaterThanOrEqual(80);
      expect(r.description.split(". ").length).toBeGreaterThanOrEqual(2);
      expect(typeof r.external_ids.animeschedule).toBe("string");
      expect(typeof r.external_ids.mal).toBe("number");
      expect(JSON.stringify(r.raw)).not.toContain("description"); // the upstream synopsis is never stored
    }
    expect(new Set(rows.map((r) => r.source_key)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(rows.length);
  });
  it("is deterministic across two calls and keeps upstream order", () => {
    const again = pageToEvents(FALL.anime!, NOW);
    expect(again).toEqual(rows);
    expect(again.map((r) => r.source_key)).toEqual(["animeschedule:CvsP", "animeschedule:BXez", "animeschedule:9n6q", "animeschedule:i245", "animeschedule:Qa3q"]);
    expect(rows.map((r) => [r.source_key, r.slug, r.date, r.popularity, r.tags.join("+")])).toMatchSnapshot();
  });
  it("TV premiere row: title, slug, tags (season, media type, genres), ids, raw trimmed", () => {
    const r = byKey.get("animeschedule:CvsP")!;
    expect(r.title).toBe("Tensei shitara Ken deshita 2 premiere");
    expect(r.slug).toBe("tensei-shitara-ken-deshita-2-premiere-2026-09-30");
    expect(r.date).toBe("2026-09-30");
    expect(r.tags).toEqual(["anime", "premiere", "fall", "tv", "action", "adventure", "fantasy", "isekai", "magic"]);
    expect(r.popularity).toBe(25);
    expect(r.source_url).toBe("https://animeschedule.net/anime/tensei-shitara-ken-deshita-2");
    expect(r.external_ids).toEqual({
      anidb: 17789,
      anilist: 159042,
      animeschedule: "CvsP",
      kitsu: "tensei-shitara-ken-deshita-2nd-season",
      mal: 53913,
      route: "tensei-shitara-ken-deshita-2",
    });
    expect(r.description).toBe(
      "Tensei shitara Ken deshita 2 (Fall 2026) premieres on September 30, 2026. A TV anime by C2C in the action, adventure, fantasy, isekai genres.",
    );
    expect(r.raw).toMatchObject({ id: "CvsP", premier: "2026-09-30T00:00:00Z", subPremier: null, dubPremier: null, season: "fall-2026", mediaTypes: ["tv"], studios: ["C2C"] });
  });
  it("movie and ONA rows carry their media-type tag; a valid dubPremier adds the dub tag and sentence", () => {
    expect(byKey.get("animeschedule:9n6q")!.tags).toContain("movie");
    expect(byKey.get("animeschedule:i245")!.tags).toContain("ona");
    expect(byKey.get("animeschedule:9n6q")!.tags).not.toContain("dub");
    const summer = pageToEvents(SUMMER.anime!, NOW_SUMMER);
    expect(summer.map((r) => r.source_key)).toEqual(["animeschedule:6Tzq", "animeschedule:9vIs", "animeschedule:bfzU"]);
    for (const r of summer) {
      expect(IngestEventSchema.safeParse(r).success).toBe(true);
      expect(r.tags).toContain("dub");
      expect(r.tags).toContain("summer");
      expect(r.description).toContain("English dub premiere:");
      expect(r.description.length >= 80 || r.description === "").toBe(true);
    }
    expect(summer[1].raw).toMatchObject({ dubPremier: "2026-09-09" });
    expect(summer[0].popularity).toBe(30);
  });
  it("filters: sentinel premiere, past, beyond the 15-month horizon, far future, label-year, missing id/title/route, dedupe", () => {
    expect(byKey.has("animeschedule:uoGC")).toBe(false);
    expect(animeToEvent(byId(FALL, "uoGC"), NOW)).toEqual({ reject: "no-premiere" });
    expect(animeToEvent(byId(SUMMER, "9vIs"), NOW)).toEqual({ reject: "past" }); // premiered 2026-07-08, dub still future
    // The past boundary is the shared isFutureOrFar() one (now − 2 d), not "before today".
    const yesterday = byId(FALL, "CvsP");
    expect(animeToEvent({ ...yesterday, premier: "2026-09-08T00:00:00Z" }, NOW)).toHaveProperty("event");
    expect(animeToEvent({ ...yesterday, premier: "2026-09-07T00:00:00Z" }, NOW)).toEqual({ reject: "past" });
    expect(pageToEvents(SUMMER.anime!, NOW)).toEqual([]);
    expect(pageToEvents(UNSEASONED.anime!, NOW)).toEqual([]); // every unseasoned row is a sentinel
    const base = byId(FALL, "CvsP");
    expect(animeToEvent({ ...base, premier: "2027-12-10T00:00:00Z" }, NOW)).toEqual({ reject: "horizon" });
    expect(animeToEvent({ ...base, premier: "2027-12-09T00:00:00Z" }, NOW)).toHaveProperty("event");
    expect(animeToEvent({ ...base, premier: "2045-01-01T00:00:00Z" }, NOW)).toEqual({ reject: "horizon" });
    expect(animeToEvent({ ...base, title: "Mang Huang Ji (2027)" }, NOW)).toEqual({ reject: "label-year" });
    expect(animeToEvent({ ...base, title: "Mang Huang Ji (2026)" }, NOW)).toHaveProperty("event");
    expect(animeToEvent({ ...base, title: "Ranma ½ (2024) 3rd Season" }, NOW)).toHaveProperty("event"); // remake year mid-title is a name
    expect(animeToEvent({ ...base, title: "Ranma ½ (2024)" }, NOW)).toHaveProperty("event"); // …and so is a bracketed trailing remake year
    expect(animeToEvent({ ...base, title: "Ranma ½ 2024" }, NOW)).toEqual({ reject: "label-year" }); // a bare trailing year is this edition's own
    expect(animeToEvent({ ...base, id: "" }, NOW)).toEqual({ reject: "no-id" });
    expect(animeToEvent({ ...base, title: " " }, NOW)).toEqual({ reject: "no-title" });
    expect(animeToEvent({ ...base, route: "bad route/../x" }, NOW)).toEqual({ reject: "no-route" });
    expect(pageToEvents([base, { ...base, title: "Duplicate" }], NOW)).toHaveLength(1);
    // Chinese ONA → CN region and Shanghai zone (upstream rows so far only carry sentinels, so the date is synthesised).
    const cn = animeToEvent({ ...byId(UNSEASONED, "PLvy"), premier: "2026-10-01T00:00:00Z" }, NOW);
    expect("event" in cn && cn.event.regions).toEqual(["CN", "GLOBAL"]);
    expect("event" in cn && cn.event.timezone).toBe("Asia/Shanghai");
    expect("event" in cn && cn.event.tags).toContain("ona-chinese");
    expect("event" in cn && IngestEventSchema.safeParse(cn.event).success).toBe(true);
    expect("event" in cn && (cn.event.description.length >= 80 || cn.event.description === "")).toBe(true);
  });
  it("a title with no Latin letters gets a digest slug base instead of colliding on premiere-<day>", () => {
    const base = byId(FALL, "CvsP");
    const kana = (id: string, title: string) => {
      const r = animeToEvent({ ...base, id, title, names: null }, NOW);
      expect(r, `${title} was rejected`).toHaveProperty("event");
      return (r as { event: (typeof rows)[number] }).event;
    };
    const a = kana("kana1", "ぼっち・ざ・ろっく");
    const b = kana("kana2", "よふかしのうた");
    // Both premiere on the same day; without the fallback both would slug to "premiere-2026-09-30"
    // and upsert.ts, which merges by slug, would collapse the two shows into one row.
    expect(a.date).toBe(b.date);
    expect(a.slug).not.toBe(b.slug);
    expect(a.slug).toMatch(/^anime-[0-9a-f]{8}-premiere-2026-09-30$/);
    expect(b.slug).toMatch(/^anime-[0-9a-f]{8}-premiere-2026-09-30$/);
    expect(kana("kana1", "ぼっち・ざ・ろっく").slug).toBe(a.slug); // deterministic per title
    for (const r of [a, b]) expect(IngestEventSchema.safeParse(r).success).toBe(true);
    // A title that does slugify keeps the plain title-derived slug.
    expect(byKey.get("animeschedule:CvsP")!.slug).toBe("tensei-shitara-ken-deshita-2-premiere-2026-09-30");
  });
});

describe("animeschedule adapter plan/run", () => {
  it("cursor: {slot, page} names the upstream query; {done} ends the pass; foreign shapes restart", () => {
    expect(parseCursor({ slot: "fall-2026", page: 3 })).toEqual({ slot: "fall-2026", page: 3 });
    expect(parseCursor({ slot: "2027", page: 1 })).toEqual({ slot: "2027", page: 1 });
    expect(parseCursor({ done: true })).toEqual({ done: true });
    expect(parseCursor({ slot: "autumn-2026", page: 1 })).toBeNull();
    expect(parseCursor({ slot: "fall-2026", page: 0 })).toBeNull();
    expect(parseCursor({ i: 2, page: 1 })).toBeNull();
    expect(parseCursor([3])).toBeNull();
    expect(parseCursor(null)).toBeNull();
  });
  it("plan: one unit per call, starting at the first slot; resumes at the cursor; page cap moves on; done after the last slot", () => {
    const first = planFrom(null, NOW);
    expect(first.done).toBe(false);
    expect(first.units.map((u) => u.key)).toEqual(["animeschedule:2026:page:1"]);
    expect(first.units[0].after).toEqual({ slot: "2026", page: 2 }); // not last until run() says so
    const resumed = planFrom({ slot: "fall-2026", page: 3 }, NOW);
    expect(resumed.units[0].key).toBe("animeschedule:fall-2026:page:3");
    expect(resumed.units[0].slot).toEqual({ route: "fall-2026", year: 2026, season: "fall" });
    const capped = planFrom({ slot: "fall-2026", page: MAX_PAGES + 1 }, NOW);
    expect(capped.units[0].key).toBe("animeschedule:2027:page:1");
    const lastSlot = planFrom({ slot: "fall-2027", page: MAX_PAGES + 1 }, NOW);
    expect(lastSlot).toEqual({ units: [], done: true });
    expect(planFrom({ done: true }, NOW)).toEqual({ units: [], done: true });
    // A cursor from a pass months ago names a slot outside the horizon: restart rather than skip.
    const warned: string[] = [];
    const stale = planFrom({ slot: "spring-2026", page: 2 }, NOW, { info() {}, warn: (m) => warned.push(m), error() {} });
    expect(stale.units[0].key).toBe("animeschedule:2026:page:1");
    expect(warned).toHaveLength(1);
  });
  it("after: next page while pages remain, next slot on the last page, {done} after the last slot's last page", () => {
    const slots = planSlots(NOW);
    const u = makeUnit(slots, 2, 4); // fall-2026 page 4
    expect(u.after).toEqual({ slot: "fall-2026", page: 5 });
    u.last = true;
    expect(u.after).toEqual({ slot: "2027", page: 1 });
    const tail = makeUnit(slots, slots.length - 1, 1);
    tail.last = true;
    expect(tail.after).toEqual({ done: true });
    expect(JSON.parse(JSON.stringify(tail.after as Json))).toEqual({ done: true }); // serialisable
  });
  it("run() fetches exactly the unit's page, sets last from the payload, and returns identical rows across two calls", async () => {
    const calls: Array<{ url: string; headers?: Record<string, string> }> = [];
    const ctx = ctxFor(FALL, calls);
    const [unit] = planFrom({ slot: "fall-2026", page: 1 }, NOW).units;
    const a = await adapter.run(unit, ctx);
    const b = await adapter.run(unit, ctx);
    expect(calls.map((c) => c.url)).toEqual([`${AS_ENDPOINT}?years=2026&seasons=fall&page=1`, `${AS_ENDPOINT}?years=2026&seasons=fall&page=1`]);
    expect(calls[0].headers).toEqual({});
    expect(a).toEqual(b);
    expect(a.map((r) => r.source_key)).toEqual(pageToEvents(FALL.anime!, NOW).map((r) => r.source_key));
    expect(unit.last).toBe(true); // 6 rows < PAGE_SIZE: the trimmed fixture is a short page
    expect(unit.after).toEqual({ slot: "2027", page: 1 });
    // A full page of a larger total continues to the next page.
    const full = { page: 1, totalAmount: 88, anime: Array.from({ length: PAGE_SIZE }, (_, i) => ({ ...byId(FALL, "CvsP"), id: `id${i}` })) };
    const [u2] = planFrom({ slot: "fall-2026", page: 1 }, NOW).units;
    expect(await adapter.run(u2, ctxFor(full))).toHaveLength(PAGE_SIZE);
    expect(u2.last).toBe(false);
    expect(u2.after).toEqual({ slot: "fall-2026", page: 2 });
    // A body without an anime array yields no rows and ends the slot.
    const [u3] = planFrom({ slot: "2027", page: 1 }, NOW).units;
    expect(await adapter.run(u3, ctxFor({ error: "nope" }))).toEqual([]);
    expect(u3.last).toBe(true);
  });
  it("sends the application token as a Bearer header when configured", async () => {
    process.env.ANIMESCHEDULE_TOKEN = "secret-token";
    const calls: Array<{ url: string; headers?: Record<string, string> }> = [];
    const [unit] = planFrom(null, NOW).units;
    await adapter.run(unit, ctxFor(UNSEASONED, calls));
    expect(calls[0].headers).toEqual({ Authorization: "Bearer secret-token" });
    expect(calls[0].url).toBe(`${AS_ENDPOINT}?years=2026&page=1`);
  });
  it("walks a whole pass through plan()/run()/after like the runner does, one request per page, no page past the end", async () => {
    const pages: Record<string, unknown> = {};
    const mk = (n: number, total: number, page: number) => ({ page, totalAmount: total, anime: Array.from({ length: n }, (_, i) => ({ ...byId(FALL, "CvsP"), id: `p${page}i${i}` })) });
    for (const slot of planSlots(NOW)) {
      const q = slot.season ? `years=${slot.year}&seasons=${slot.season}` : `years=${slot.year}`;
      if (slot.route === "fall-2026") {
        pages[`${AS_ENDPOINT}?${q}&page=1`] = mk(PAGE_SIZE, 20, 1);
        pages[`${AS_ENDPOINT}?${q}&page=2`] = mk(2, 20, 2);
      } else if (slot.route === "2026") {
        pages[`${AS_ENDPOINT}?${q}&page=1`] = mk(PAGE_SIZE, 36, 1);
        pages[`${AS_ENDPOINT}?${q}&page=2`] = mk(PAGE_SIZE, 36, 2); // exactly two full pages: no third request
      } else pages[`${AS_ENDPOINT}?${q}&page=1`] = mk(3, 3, 1);
    }
    const calls: Array<{ url: string }> = [];
    const ctx = ctxFor(pages, calls);
    let cursor: Json | null = null;
    let units = 0;
    let rows = 0;
    for (;;) {
      const plan = await adapter.plan(cursor, ctx);
      for (const unit of plan.units) {
        rows += (await adapter.run(unit, ctx)).length;
        units++;
        cursor = unit.after;
      }
      if (plan.done) break;
      cursor = plan.nextCursor ?? null;
    }
    expect(units).toBe(8 + 2); // 8 slots, two of them with a second page
    expect(calls).toHaveLength(units);
    expect(new Set(calls.map((c) => c.url)).size).toBe(units);
    expect(calls.every((c) => c.url in pages)).toBe(true);
    expect(rows).toBe(PAGE_SIZE + 2 + PAGE_SIZE * 2 + 3 * 6);
    expect(cursor).toEqual({ done: true });
  });
  it("adapter metadata; isConfigured only with ANIMESCHEDULE_ENABLED=true (a token alone is not consent)", () => {
    expect(adapter.id).toBe("animeschedule");
    expect(adapter.rank).toBe(4);
    expect(adapter.cadence).toBe("weekly");
    expect(adapter.limits).toEqual({ concurrency: 1, minIntervalMs: 2000, timeoutMs: 20_000, maxRetries: 2 });
    expect(adapter.isConfigured()).toBe(false);
    process.env.ANIMESCHEDULE_TOKEN = "abc";
    expect(adapter.isConfigured()).toBe(false);
    process.env.ANIMESCHEDULE_ENABLED = "1";
    expect(adapter.isConfigured()).toBe(false);
    process.env.ANIMESCHEDULE_ENABLED = "true";
    expect(adapter.isConfigured()).toBe(true);
  });
});
