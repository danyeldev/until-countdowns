import { buildEvent, isFarFuture, sanitizeTitle } from "../normalize";
import type { Adapter, IngestContext, IngestEvent, IngestLogger, Json, Plan, Unit } from "../types";

/**
 * Upcoming anime premieres from the Kitsu API (https://kitsu.app, JSON:API, no key):
 * `GET /api/edge/anime?filter[status]=upcoming&sort=startDate,id&page[limit]=20` with a sparse
 * fieldset (`fields[anime]=…`, ≈ 11 KB per page instead of ≈ 96 KB). Verified 2026-09-09: 63
 * upcoming titles, nearest 2026-09-11, `userCount` present, `links.next` is an absolute URL,
 * `filter[startDate]` is rejected ("Filter not allowed"), and `page[offset]` is applied one page
 * late (offset 20 returns the same items as offset 0, offset 40 returns items 21–40, …), so the
 * response at offset 60 already omits `links.next` while the real tail (items 61–63) is only
 * reachable at offset 80. The walk therefore ignores `links.next`, requests offsets 0, 20, 40, …
 * itself, dedupes by anime id, and stops on an empty or short page or at `MAX_PAGES` — which is
 * correct whether or not the offset quirk is ever fixed upstream (5 requests today, 4 once fixed).
 *
 * One unit per pass (≈ 4–5 requests, one every second), keyed by the UTC day of `now`; the cursor
 * `{ fetchedOn }` is informational (a same-day re-run fetches again: an empty completed pass would
 * let `mark_stale_records` flag every kitsu row as unseen).
 *
 * Kept: `status === 'upcoming'`, a real `startDate` from today up to `HORIZON_DAYS` ahead (one
 * season plus slack), `nsfw !== true`. One row per title: "<title> premiere" ("<title> (anime
 * film) release" for `subtype === 'movie'`), all-day on the Japanese start date (`Asia/Tokyo`),
 * `category = 'anime'`, `regions = ['JP', 'GLOBAL']`, `confidence = 0.7`, popularity 20 or
 * `10 + 5·log10(userCount)` clamped to 20..30. The English title (`titles.en`) is preferred over
 * the romanised `canonicalTitle` so a premiere TVMaze also lists collides on the same slug and
 * the higher-ranked tvmaze row (5 > 4) wins the merge. A title whose Kitsu `tba` field is set
 * ("fall 2026", "2026") keeps its day but is stored `tentative` with `confidence = 0.5`.
 * Label-year check: a bare year in the title that differs from the start year rejects the row; a
 * parenthesised year ("Ranma 1/2 (2024) Season 3") is a remake disambiguator and is exempt.
 * Capped at `MAX_ROWS` (earliest start first).
 *
 * Licence: unverified (Apiary docs are empty; the data is community-contributed) — the adapter
 * is disabled unless `KITSU_ENABLED=true` and `sources.attribution = "Anime data via Kitsu
 * (kitsu.app)"`. `synopsis` is never requested or copied: `description` is our own two sentences
 * built from title, format, date and episode count. Posters and cover art are studio copyright:
 * no `image_candidate_url`.
 *
 * Rejected alternatives (Phase-4 briefs, section 20): AniList GraphQL (HTTP 403, "temporarily
 * disabled due to severe stability issues"), Jikan v4 (MAL upstream 504s, unlicensed scraper),
 * TMDB (revenue-generating sites need a written agreement, 6-month caching cap), Trakt (no images,
 * 33-day window), TheTVDB v4 (paid, restrictive).
 */

export const KITSU_API = "https://kitsu.app/api/edge/anime";
export const KITSU_SITE = "https://kitsu.app/anime";
export const PAGE_LIMIT = 20;
export const MAX_PAGES = 8;
export const MAX_ROWS = 100;
export const HORIZON_DAYS = 120;
export const CONFIDENCE = 0.7;
export const TBA_CONFIDENCE = 0.5;
export const POPULARITY_MIN = 20;
export const POPULARITY_CAP = 30;
export const ACCEPT = "application/vnd.api+json";

const FIELDS = ["slug", "canonicalTitle", "titles", "startDate", "endDate", "status", "subtype", "episodeCount", "userCount", "favoritesCount", "popularityRank", "nsfw", "tba"];

export type KitsuAttributes = {
  slug?: string | null;
  canonicalTitle?: string | null;
  titles?: Record<string, string | null | undefined> | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  subtype?: string | null;
  episodeCount?: number | null;
  userCount?: number | null;
  favoritesCount?: number | null;
  popularityRank?: number | null;
  nsfw?: boolean | null;
  tba?: string | null;
};

export type KitsuAnime = {
  id: string;
  type?: string;
  links?: { self?: string };
  attributes?: KitsuAttributes | null;
};

export type KitsuPage = {
  data?: KitsuAnime[] | null;
  meta?: { count?: number } | null;
  links?: { first?: string; next?: string | null; last?: string } | null;
};

export type KitsuUnit = Unit & { day: string };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Page URL: status filter, deterministic sort (start date, then id), sparse fieldset, explicit offset. */
export function pageUrl(offset: number): string {
  const q = new URLSearchParams();
  q.set("fields[anime]", FIELDS.join(","));
  q.set("filter[status]", "upcoming");
  q.set("page[limit]", String(PAGE_LIMIT));
  q.set("page[offset]", String(offset));
  q.set("sort", "startDate,id");
  return `${KITSU_API}?${q.toString()}`;
}

const KINDS: Record<string, string> = {
  tv: "TV anime series",
  movie: "anime film",
  ova: "original video animation (OVA)",
  ona: "web-released anime (ONA)",
  special: "anime special",
  music: "anime music video",
};

/** English title when Kitsu has one, else the romanised canonical title. */
export function displayTitle(a: KitsuAttributes): string {
  const titles = a.titles ?? {};
  for (const key of ["en", "en_us"]) {
    const t = titles[key];
    if (typeof t === "string" && t.trim()) return sanitizeTitle(t);
  }
  return sanitizeTitle(typeof a.canonicalTitle === "string" ? a.canonicalTitle : "");
}

export function titleFor(a: KitsuAttributes): string {
  const name = displayTitle(a);
  if (!name) return "";
  return subtypeOf(a) === "movie" ? `${name} (anime film) release` : `${name} premiere`;
}

export function subtypeOf(a: KitsuAttributes): string {
  return typeof a.subtype === "string" && a.subtype.trim() ? a.subtype.trim().toLowerCase() : "anime";
}

/** `10 + 5·log10(userCount)` clamped to 20..30; 20 without a user count. */
export function popularityFor(userCount: unknown): number {
  const n = typeof userCount === "number" && Number.isFinite(userCount) ? userCount : 0;
  if (n < 1) return POPULARITY_MIN;
  return Math.max(POPULARITY_MIN, Math.min(POPULARITY_CAP, Math.round(10 + Math.log10(n) * 5)));
}

/** A bare 19xx/20xx in the title must be the start year; "(2024)" remake markers are exempt. */
export function labelYearConsistent(title: string, year: string): boolean {
  const stripped = title.replace(/\((?:19|20)\d{2}\)/g, " ");
  const years = stripped.match(/\b(?:19|20)\d{2}\b/g) ?? [];
  return years.every((y) => y === year);
}

/** Own wording (never `synopsis`): what, format, where and when — then the romanised title and episode count. */
export function describe(a: KitsuAttributes, name: string, date: string): string {
  const subtype = subtypeOf(a);
  const kind = KINDS[subtype] ?? "anime";
  const verb = subtype === "movie" ? "opens" : "premieres";
  const first = `${name}, ${/^[aeiou]/i.test(kind) ? "an" : "a"} ${kind}, ${verb} in Japan on ${fmtDay(date)}.`;
  const canonical = sanitizeTitle(typeof a.canonicalTitle === "string" ? a.canonicalTitle : "");
  const romaji = canonical && canonical !== name ? ` (romanised title: ${canonical})` : "";
  const n = typeof a.episodeCount === "number" && a.episodeCount > 1 ? a.episodeCount : 0;
  const episodes = n ? ` with ${n} planned episodes` : "";
  const second = `Kitsu lists the title as upcoming${romaji}${episodes}.`;
  const tba = typeof a.tba === "string" && a.tba.trim() ? ` The exact date is still to be announced (${sanitizeTitle(a.tba)}).` : "";
  return `${first} ${second}${tba}`;
}

export type Reject = "no-attributes" | "not-upcoming" | "nsfw" | "no-date" | "bad-date" | "past" | "horizon" | "far-future" | "empty-title" | "label-year";

/** One Kitsu anime → premiere row, or a rejection reason. */
export function animeToEvent(item: KitsuAnime, now: Date): { event: IngestEvent } | { reject: Reject } {
  const a = item?.attributes;
  if (!a || typeof item.id !== "string" || !/^\d+$/.test(item.id)) return { reject: "no-attributes" };
  if (a.status !== "upcoming") return { reject: "not-upcoming" };
  if (a.nsfw === true) return { reject: "nsfw" };
  if (typeof a.startDate !== "string" || !a.startDate) return { reject: "no-date" };
  const date = a.startDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return { reject: "bad-date" };
  const today = now.toISOString().slice(0, 10);
  if (date < today) return { reject: "past" };
  if (date > addDays(today, HORIZON_DAYS)) return { reject: "horizon" };
  const title = titleFor(a);
  if (title.length < 2 || !displayTitle(a)) return { reject: "empty-title" };
  if (!labelYearConsistent(displayTitle(a), date.slice(0, 4))) return { reject: "label-year" };
  const subtype = subtypeOf(a);
  const tags = ["anime", subtype, "premiere"];
  if (isFarFuture(date, tags, now)) return { reject: "far-future" };
  const tba = typeof a.tba === "string" && a.tba.trim().length > 0;
  const slug = typeof a.slug === "string" && a.slug.trim() ? a.slug.trim() : item.id;
  const userCount = typeof a.userCount === "number" ? a.userCount : null;
  const event = buildEvent({
    title,
    date,
    category: "anime",
    tags,
    regions: ["JP", "GLOBAL"],
    description: describe(a, displayTitle(a), date),
    source: "kitsu",
    sourceUrl: `${KITSU_SITE}/${encodeURIComponent(slug)}`,
    sourceKey: `kitsu:anime:${item.id}`,
    featured: false,
    popularity: popularityFor(userCount),
    allDay: true,
    timezone: "Asia/Tokyo",
    datePrecision: "day",
    status: tba ? "tentative" : "scheduled",
    confidence: tba ? TBA_CONFIDENCE : CONFIDENCE,
    externalIds: { kitsu: Number(item.id), kitsu_slug: slug },
    seriesSlug: null,
    location: null,
    raw: {
      id: item.id,
      slug,
      canonicalTitle: a.canonicalTitle ?? null,
      titles: a.titles ?? null,
      startDate: date,
      endDate: a.endDate ?? null,
      status: a.status,
      subtype: a.subtype ?? null,
      episodeCount: a.episodeCount ?? null,
      userCount,
      favoritesCount: a.favoritesCount ?? null,
      popularityRank: a.popularityRank ?? null,
      tba: a.tba ?? null,
    },
  });
  return { event };
}

/** Rows for a list of anime (already deduped by id): earliest start first, then id, capped at `MAX_ROWS`. */
export function animeToEvents(items: readonly KitsuAnime[], now: Date, log?: IngestLogger): IngestEvent[] {
  const rejects: Partial<Record<Reject, number>> = {};
  const seen = new Set<string>();
  const kept: Array<{ id: number; event: IngestEvent }> = [];
  for (const item of items) {
    const r = animeToEvent(item, now);
    if ("reject" in r) {
      rejects[r.reject] = (rejects[r.reject] ?? 0) + 1;
      continue;
    }
    if (seen.has(r.event.source_key)) continue;
    seen.add(r.event.source_key);
    kept.push({ id: Number(item.id), event: r.event });
  }
  kept.sort((x, y) => (x.event.date < y.event.date ? -1 : x.event.date > y.event.date ? 1 : x.id - y.id));
  const rows = kept.map(({ event }) => event).slice(0, MAX_ROWS);
  log?.info(
    `kitsu: ${items.length} titles → ${kept.length} premieres` +
      (kept.length > MAX_ROWS ? `, capped at ${MAX_ROWS}` : "") +
      ` · rejected ${Object.entries(rejects)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ")}`,
  );
  return rows;
}

/**
 * Walk the upcoming list at offsets 0, 20, 40, … (never `links.next`, which disappears one page
 * early under the offset quirk). Items are deduped by id (the live API repeats page 0 at offset
 * 20); the walk stops on an empty or short page, on a body without a data array, or after
 * `MAX_PAGES` requests.
 */
export async function fetchUpcoming(ctx: IngestContext, label = "kitsu"): Promise<KitsuAnime[]> {
  const byId = new Map<string, KitsuAnime>();
  for (let pages = 0; pages < MAX_PAGES; pages++) {
    const offset = pages * PAGE_LIMIT;
    const page = await ctx.http.fetchJson<KitsuPage>(pageUrl(offset), { headers: { Accept: ACCEPT } });
    const data = Array.isArray(page?.data) ? page.data : null;
    if (!data) {
      ctx.log.warn(`${label}: offset ${offset} has no data array`);
      break;
    }
    let fresh = 0;
    for (const item of data) {
      if (!item || typeof item.id !== "string") continue;
      if (!byId.has(item.id)) {
        byId.set(item.id, item);
        fresh++;
      }
    }
    ctx.log.info(`${label}: offset ${offset}: ${data.length} items, ${fresh} new (count ${page.meta?.count ?? "?"})`);
    if (data.length < PAGE_LIMIT) break;
  }
  return [...byId.values()];
}

export function parseCursor(cursor: Json | null): { fetchedOn: string } | null {
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    const c = cursor as { fetchedOn?: unknown };
    if (typeof c.fetchedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.fetchedOn)) return { fetchedOn: c.fetchedOn };
  }
  return null;
}

/** One unit per pass, keyed by the UTC day of `now` (see the module docs on why a same-day re-run still fetches). */
export function planUnits(now: Date): KitsuUnit[] {
  const day = now.toISOString().slice(0, 10);
  return [{ key: `kitsu:upcoming:${day}`, label: `Kitsu upcoming anime (${day})`, after: { fetchedOn: day }, day }];
}

/** Terms are unconfirmed: the adapter runs only when `KITSU_ENABLED=true`. */
export function isEnabled(): boolean {
  return String(process.env.KITSU_ENABLED ?? "").trim().toLowerCase() === "true";
}

export const adapter: Adapter<KitsuUnit> = {
  id: "kitsu",
  label: "Kitsu upcoming anime",
  rank: 4,
  cadence: "weekly",
  isConfigured: isEnabled,
  limits: { concurrency: 1, minIntervalMs: 1000, timeoutMs: 20_000, maxRetries: 2 },

  async plan(_cursor, ctx): Promise<Plan<KitsuUnit>> {
    return { units: planUnits(ctx.now), done: true };
  },

  async run(unit, ctx: IngestContext) {
    const items = await fetchUpcoming(ctx, unit.label);
    const rows = animeToEvents(items, ctx.now, ctx.log);
    ctx.log.info(`${unit.label}: ${rows.length} rows`);
    return rows;
  },
};
