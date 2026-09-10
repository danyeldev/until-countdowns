import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { IngestEventSchema, type IngestContext } from "@/lib/ingest/types";
import {
  ACCEPT,
  adapter,
  animeToEvent,
  animeToEvents,
  describe as describeAnime,
  displayTitle,
  fetchUpcoming,
  HORIZON_DAYS,
  isEnabled,
  KITSU_API,
  labelYearConsistent,
  MAX_PAGES,
  MAX_ROWS,
  PAGE_LIMIT,
  pageUrl,
  parseCursor,
  planUnits,
  popularityFor,
  titleFor,
  type KitsuAnime,
  type KitsuPage,
} from "@/lib/ingest/sources/kitsu";

/** Fixture recorded 2026-09-09: earliest start 2026-09-11, latest 2026-12-01. */
const NOW = new Date("2026-09-09T12:00:00Z");
const fixture = (name: string): KitsuPage => JSON.parse(readFileSync(new URL(`../fixtures/kitsu/${name}.json`, import.meta.url), "utf8"));
const PAGE1 = fixture("upcoming-page1");
const LAST = fixture("upcoming-last");
const ALL: KitsuAnime[] = [...PAGE1.data!, ...LAST.data!];
const byId = (id: string) => ALL.find((a) => a.id === id)!;

function offsetOf(url: string): string {
  return new URL(url).searchParams.get("page[offset]") ?? "";
}

/**
 * Fake Kitsu: offset 0 → page 1; offset 20 → page 1 again (the live API applies the offset one
 * page late); offset 40 → the short last page (3 items, no `next`). `links.next` in the fixtures
 * is deliberately misleading (page 1 points at offset 20) — the adapter must not follow it.
 */
function ctxFor(calls: Array<{ url: string; accept?: string }> = [], now = NOW, pages: Record<string, unknown> = {}): IngestContext {
  const routes: Record<string, unknown> = { "0": PAGE1, "20": PAGE1, "40": LAST, ...pages };
  return {
    http: {
      fetchJson: async <T,>(url: string, init?: { headers?: Record<string, string> }) => {
        calls.push({ url, accept: init?.headers?.Accept });
        const body = routes[offsetOf(url)];
        if (body === undefined) throw new Error(`unexpected offset in ${url}`);
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

afterEach(() => {
  delete process.env.KITSU_ENABLED;
});

describe("kitsu helpers", () => {
  it("prefers the English title, falls back to canonicalTitle; movies get '(anime film) release', everything else 'premiere'", () => {
    expect(displayTitle(byId("50021").attributes!)).toBe("The Apothecary Diaries Season 3");
    expect(displayTitle(byId("51000").attributes!)).toBe("Meitantei Precure! Fushigi na Niwa to Futari no Himitsu");
    expect(displayTitle({ titles: { en: "  ", en_us: "US Title" }, canonicalTitle: "Canon" })).toBe("US Title");
    expect(titleFor(byId("49971").attributes!)).toBe("Sound! Euphonium, The Final Movie Part 2 (anime film) release");
    expect(titleFor(byId("50021").attributes!)).toBe("The Apothecary Diaries Season 3 premiere");
    expect(titleFor({ titles: {}, canonicalTitle: "" })).toBe("");
  });
  it("popularity: 20 without users, 10 + 5·log10(userCount) clamped to 20..30", () => {
    expect(popularityFor(0)).toBe(20);
    expect(popularityFor(null)).toBe(20);
    expect(popularityFor(77)).toBe(20); // 19.4 → floor 20
    expect(popularityFor(782)).toBe(24);
    expect(popularityFor(1869)).toBe(26);
    expect(popularityFor(1_000_000)).toBe(30);
  });
  it("label-year: a bare year must match the start year; parenthesised remake years are exempt", () => {
    expect(labelYearConsistent("Ranma1/2 (2024) Season 3", "2026")).toBe(true);
    expect(labelYearConsistent("Magical Knight Rayearth (2026)", "2026")).toBe(true);
    expect(labelYearConsistent("Winter 2027 Special", "2026")).toBe(false);
    expect(labelYearConsistent("Anime Expo 2026 Stage", "2026")).toBe(true);
    expect(labelYearConsistent("No year here", "2026")).toBe(true);
  });
  it("description is own wording (never synopsis): format, Japan, date, romanised title, episodes, TBA note", () => {
    expect(describeAnime(byId("50021").attributes!, "The Apothecary Diaries Season 3", "2026-10-02")).toBe(
      "The Apothecary Diaries Season 3, a TV anime series, premieres in Japan on October 2, 2026. Kitsu lists the title as upcoming (romanised title: Kusuriya no Hitorigoto 3rd Season).",
    );
    expect(describeAnime(byId("49971").attributes!, "Sound! Euphonium, The Final Movie Part 2", "2026-09-11")).toBe(
      "Sound! Euphonium, The Final Movie Part 2, an anime film, opens in Japan on September 11, 2026. Kitsu lists the title as upcoming (romanised title: Saishuu Gakushou Hibike! Euphonium - Kouhen).",
    );
    expect(describeAnime(byId("50743").attributes!, "Temppal: Item no Chikara", "2026-10-02")).toBe(
      "Temppal: Item no Chikara, a TV anime series, premieres in Japan on October 2, 2026. Kitsu lists the title as upcoming. The exact date is still to be announced (fall 2026).",
    );
    expect(describeAnime(byId("50656").attributes!, "LEGO ONE PIECE", "2026-09-29")).toBe(
      "LEGO ONE PIECE, a web-released anime (ONA), premieres in Japan on September 29, 2026. Kitsu lists the title as upcoming with 2 planned episodes.",
    );
  });
  it("page URL carries the status filter, sparse fieldset (no synopsis), deterministic sort and the explicit offset", () => {
    const u = new URL(pageUrl(0));
    expect(u.origin + u.pathname).toBe(KITSU_API);
    expect(u.searchParams.get("filter[status]")).toBe("upcoming");
    expect(u.searchParams.get("sort")).toBe("startDate,id");
    expect(u.searchParams.get("page[limit]")).toBe(String(PAGE_LIMIT));
    expect(u.searchParams.get("page[offset]")).toBe("0");
    expect(u.searchParams.get("fields[anime]")).toContain("startDate");
    expect(u.searchParams.get("fields[anime]")).not.toContain("synopsis");
    expect(new URL(pageUrl(40)).searchParams.get("page[offset]")).toBe("40");
  });
  it("isConfigured only with KITSU_ENABLED=true (terms unconfirmed)", () => {
    expect(isEnabled()).toBe(false);
    expect(adapter.isConfigured()).toBe(false);
    process.env.KITSU_ENABLED = "1";
    expect(adapter.isConfigured()).toBe(false);
    process.env.KITSU_ENABLED = " TRUE ";
    expect(adapter.isConfigured()).toBe(true);
    process.env.KITSU_ENABLED = "true";
    expect(isEnabled()).toBe(true);
  });
});

describe("kitsu fixture → rows", () => {
  const rows = animeToEvents(ALL, NOW);
  const byKey = new Map(rows.map((r) => [r.source_key, r]));

  it("every row validates: source kitsu, anime, all-day in Asia/Tokyo, JP+GLOBAL, popularity 20..30, no image, no jsonld, unique keys", () => {
    expect(rows.length).toBe(23);
    for (const r of rows) {
      const parsed = IngestEventSchema.safeParse(r);
      expect(parsed.success, `${r.slug}: ${JSON.stringify(parsed.success ? null : parsed.error.issues)}`).toBe(true);
      expect(r.source).toBe("kitsu");
      expect(r.source_key).toMatch(/^kitsu:anime:\d+$/);
      expect(r.source_url).toMatch(/^https:\/\/kitsu\.app\/anime\/[A-Za-z0-9._~%-]+$/);
      expect(r.category).toBe("anime");
      expect(r.all_day).toBe(true);
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.date_precision).toBe("day");
      expect(r.timezone).toBe("Asia/Tokyo");
      expect(r.regions).toEqual(["JP", "GLOBAL"]);
      expect(r.tags).toEqual(expect.arrayContaining(["anime", "premiere"]));
      expect(r.popularity).toBeGreaterThanOrEqual(20);
      expect(r.popularity).toBeLessThanOrEqual(30);
      expect(r.featured).toBe(false);
      expect(r.image_candidate_url).toBeNull();
      expect(r.jsonld_eligible).toBe(false);
      expect(r.series_slug).toBeNull();
      expect(r.location).toBeNull();
      expect(r.description.length).toBeGreaterThanOrEqual(80);
      expect(r.description.split(". ").length).toBeGreaterThanOrEqual(2);
      expect(JSON.stringify(r.raw)).not.toContain("synopsis");
      expect(typeof r.external_ids.kitsu).toBe("number");
      expect(typeof r.external_ids.kitsu_slug).toBe("string");
      expect(r.confidence).toBe(r.status === "tentative" ? 0.5 : 0.7);
    }
    expect(new Set(rows.map((r) => r.source_key)).size).toBe(rows.length);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(rows.length);
  });
  it("is deterministic across two calls; sorted by start date then id", () => {
    const again = animeToEvents(ALL, NOW);
    expect(again).toEqual(rows);
    expect(again.map((r) => r.source_key)).toEqual(rows.map((r) => r.source_key));
    expect(rows.map((r) => r.date)).toEqual([...rows.map((r) => r.date)].sort());
    expect(rows.map((r) => [r.source_key, r.slug, r.date, r.status, r.popularity])).toMatchSnapshot();
  });
  it("TV series: English title, premiere suffix, popularity from userCount, romanised title in the text, ids and trimmed raw", () => {
    const r = byKey.get("kitsu:anime:50021")!;
    expect(r.title).toBe("The Apothecary Diaries Season 3 premiere");
    expect(r.slug).toBe("the-apothecary-diaries-season-3-premiere-2026-10-02");
    expect(r.date).toBe("2026-10-02");
    expect(r.end_date).toBeNull();
    expect(r.status).toBe("scheduled");
    expect(r.confidence).toBe(0.7);
    expect(r.popularity).toBe(24); // userCount 782
    expect(r.tags).toEqual(["anime", "tv", "premiere"]);
    expect(r.external_ids).toEqual({ kitsu: 50021, kitsu_slug: "Kusuriya-no-Hitorigoto-3rd-season" });
    expect(r.source_url).toBe("https://kitsu.app/anime/Kusuriya-no-Hitorigoto-3rd-season");
    expect(r.description).toContain("romanised title: Kusuriya no Hitorigoto 3rd Season");
    expect(r.raw).toMatchObject({ id: "50021", subtype: "TV", startDate: "2026-10-02", userCount: 782, tba: null });
  });
  it("movie: '(anime film) release' title, 'opens' wording, popularity floor 20 for few users, canonical title when no English one", () => {
    const eupho = byKey.get("kitsu:anime:49971")!;
    expect(eupho.title).toBe("Sound! Euphonium, The Final Movie Part 2 (anime film) release");
    expect(eupho.slug).toBe("sound-euphonium-the-final-movie-part-2-anime-film-release-2026-09-11");
    expect(eupho.tags).toEqual(["anime", "movie", "premiere"]);
    expect(eupho.popularity).toBe(20); // userCount 77 → 19.4 → floor
    expect(eupho.description).toMatch(/^Sound! Euphonium, The Final Movie Part 2, an anime film, opens in Japan on September 11, 2026\./);
    const precure = byKey.get("kitsu:anime:51000")!;
    expect(precure.title).toBe("Meitantei Precure! Fushigi na Niwa to Futari no Himitsu (anime film) release");
    expect(precure.popularity).toBe(20); // userCount 0
    expect(precure.description).not.toContain("romanised");
    expect(byKey.get("kitsu:anime:45666")!.popularity).toBe(26); // userCount 1869
  });
  it("tba set → tentative with confidence 0.5 and a TBA sentence; parenthesised remake year is kept", () => {
    const temppal = byKey.get("kitsu:anime:50743")!;
    expect(temppal.status).toBe("tentative");
    expect(temppal.confidence).toBe(0.5);
    expect(temppal.date_precision).toBe("day");
    expect(temppal.description).toContain("still to be announced (fall 2026)");
    const killtube = byKey.get("kitsu:anime:48708")!;
    expect(killtube.status).toBe("tentative");
    expect(killtube.date).toBe("2026-12-01");
    const ranma = byKey.get("kitsu:anime:50626")!;
    expect(ranma.title).toBe("Ranma1/2 (2024) Season 3 premiere");
    expect(ranma.status).toBe("scheduled");
  });
  it("filters: non-upcoming, nsfw, missing/bad/past dates, beyond the season horizon, far future, empty title, label-year", () => {
    const base = byId("50021");
    const attrs = base.attributes!;
    expect(animeToEvent({ ...base, attributes: { ...attrs, status: "current" } }, NOW)).toEqual({ reject: "not-upcoming" });
    expect(animeToEvent({ ...base, attributes: { ...attrs, nsfw: true } }, NOW)).toEqual({ reject: "nsfw" });
    expect(animeToEvent({ ...base, attributes: { ...attrs, startDate: null } }, NOW)).toEqual({ reject: "no-date" });
    expect(animeToEvent({ ...base, attributes: { ...attrs, startDate: "soon" } }, NOW)).toEqual({ reject: "bad-date" });
    expect(animeToEvent({ ...base, attributes: { ...attrs, startDate: "2026-09-08" } }, NOW)).toEqual({ reject: "past" });
    expect(animeToEvent({ ...base, attributes: { ...attrs, startDate: "2026-09-09" } }, NOW)).toMatchObject({ event: { date: "2026-09-09" } });
    expect(animeToEvent({ ...base, attributes: { ...attrs, startDate: "2027-01-08" } }, NOW)).toEqual({ reject: "horizon" });
    expect(animeToEvent({ ...base, attributes: { ...attrs, startDate: "2027-01-07" } }, NOW)).toMatchObject({ event: { date: "2027-01-07" } });
    expect(animeToEvent({ ...base, attributes: { ...attrs, startDate: "2045-01-01" } }, NOW)).toEqual({ reject: "horizon" });
    expect(animeToEvent({ ...base, attributes: { ...attrs, titles: {}, canonicalTitle: "" } }, NOW)).toEqual({ reject: "empty-title" });
    expect(animeToEvent({ ...base, attributes: { ...attrs, titles: { en: "Winter 2027 Collection" } } }, NOW)).toEqual({ reject: "label-year" });
    expect(animeToEvent({ ...base, attributes: null }, NOW)).toEqual({ reject: "no-attributes" });
    expect(animeToEvent({ ...base, id: "abc" }, NOW)).toEqual({ reject: "no-attributes" });
    expect(HORIZON_DAYS).toBe(120);
    // A later "now" drops the titles that have already started.
    const later = animeToEvents(ALL, new Date("2026-10-01T00:00:00Z"));
    expect(later.some((r) => r.source_key === "kitsu:anime:49971")).toBe(false);
    expect(later.some((r) => r.source_key === "kitsu:anime:50021")).toBe(true);
  });
  it("dedupes repeated ids and caps the run at MAX_ROWS, earliest start first", () => {
    expect(animeToEvents([...ALL, ...ALL], NOW)).toHaveLength(23);
    const base = byId("50021");
    const many: KitsuAnime[] = Array.from({ length: MAX_ROWS + 30 }, (_, i) => ({
      ...base,
      id: String(900_000 + i),
      attributes: { ...base.attributes!, titles: { en: `Show ${i}` }, startDate: i % 2 ? "2026-11-01" : "2026-10-15" },
    }));
    const capped = animeToEvents(many, NOW);
    expect(capped).toHaveLength(MAX_ROWS);
    // 65 titles start 2026-10-15 and 65 start 2026-11-01: the cap keeps every earlier one first.
    expect(capped.filter((r) => r.date === "2026-10-15")).toHaveLength(65);
    expect(capped.slice(65).every((r) => r.date === "2026-11-01")).toBe(true);
  });
});

describe("kitsu adapter plan/run", () => {
  it("plans one unit per pass with a day-addressed cursor; parseCursor accepts only that shape", async () => {
    expect(planUnits(NOW)).toEqual([{ key: "kitsu:upcoming:2026-09-09", label: "Kitsu upcoming anime (2026-09-09)", after: { fetchedOn: "2026-09-09" }, day: "2026-09-09" }]);
    expect(parseCursor({ fetchedOn: "2026-09-09" })).toEqual({ fetchedOn: "2026-09-09" });
    expect(parseCursor({ fetchedOn: "today" })).toBeNull();
    expect(parseCursor([0])).toBeNull();
    expect(parseCursor(null)).toBeNull();
    const plan = await adapter.plan({ fetchedOn: "2026-09-09" }, ctxFor());
    expect(plan.done).toBe(true);
    expect(plan.units).toHaveLength(1);
    expect(adapter.id).toBe("kitsu");
    expect(adapter.rank).toBe(4);
    expect(adapter.cadence).toBe("weekly");
    expect(adapter.limits).toEqual({ concurrency: 1, minIntervalMs: 1000, timeoutMs: 20_000, maxRetries: 2 });
  });
  it("walks explicit offsets with the JSON:API Accept header, ignores links.next, dedupes the repeated page, stops on the short page", async () => {
    const calls: Array<{ url: string; accept?: string }> = [];
    const items = await fetchUpcoming(ctxFor(calls));
    expect(calls.map((c) => offsetOf(c.url))).toEqual(["0", "20", "40"]);
    expect(calls.every((c) => c.accept === ACCEPT)).toBe(true);
    expect(calls.every((c) => c.url.startsWith(`${KITSU_API}?`))).toBe(true);
    expect(items).toHaveLength(23);
    expect(new Set(items.map((i) => i.id)).size).toBe(23);
    // A full page without `links.next` (the live offset-60 response) is still followed by the next offset.
    const noNext: Array<{ url: string }> = [];
    const got = await fetchUpcoming(ctxFor(noNext, NOW, { "0": { ...PAGE1, links: {} }, "20": LAST }));
    expect(noNext.map((c) => offsetOf(c.url))).toEqual(["0", "20"]);
    expect(got).toHaveLength(23);
  });
  it("stops on a missing data array and after MAX_PAGES", async () => {
    const bad: Array<{ url: string }> = [];
    expect(await fetchUpcoming(ctxFor(bad, NOW, { "0": { errors: [{ title: "nope" }] } }))).toEqual([]);
    expect(bad).toHaveLength(1);
    // Every page full: the walk is bounded by MAX_PAGES.
    const loop: Record<string, unknown> = {};
    for (let i = 0; i < MAX_PAGES + 2; i++) {
      const offset = i * PAGE_LIMIT;
      loop[String(offset)] = { data: PAGE1.data!.map((a, j) => ({ ...a, id: String(offset * 10 + j) })), links: {} };
    }
    const many: Array<{ url: string }> = [];
    const got = await fetchUpcoming(ctxFor(many, NOW, loop));
    expect(many).toHaveLength(MAX_PAGES);
    expect(got).toHaveLength(MAX_PAGES * PAGE_LIMIT);
  });
  it("run() returns identical rows across two calls with stable source_keys", async () => {
    const calls: Array<{ url: string }> = [];
    const ctx = ctxFor(calls);
    const [unit] = planUnits(NOW);
    const a = await adapter.run(unit, ctx);
    const b = await adapter.run(unit, ctx);
    expect(calls).toHaveLength(6);
    expect(a).toEqual(b);
    expect(a.map((r) => r.source_key)).toEqual(animeToEvents(ALL, NOW).map((r) => r.source_key));
    expect(a[0].source_key).toBe("kitsu:anime:49971");
    expect(a[a.length - 1].source_key).toBe("kitsu:anime:48708");
  });
});
