import { HttpError } from "../http";
import { buildEvent, isFutureOrFar, sanitizeTitle, slugBase, slugify } from "../normalize";
import type { Adapter, IngestContext, IngestEvent, IngestLogger, Json, Plan, Unit } from "../types";

/**
 * Anime season premieres from AnimeSchedule.net API v3 (https://animeschedule.net/api/v3/documentation),
 * `GET /api/v3/anime?years=<Y>&seasons=<winter|spring|summer|fall>&page=<n>` — one row per anime
 * whose `premier` is a real, future day: "<title> premiere", category `anime`, all-day on the
 * Japanese calendar day (`timezone = 'Asia/Tokyo'`; the API only ever stores `T00:00:00Z`, so no
 * instant is emitted).
 *
 * OFF BY DEFAULT: `isConfigured()` is true only with `ANIMESCHEDULE_ENABLED=true`. The API terms
 * (docs, Introduction, read 2026-09-09) say: "Ask us for permission before using the API for
 * commercial purposes. Include a visible link or credit to AnimeSchedule.net in your app." and
 * "Cache API data only as needed". Tokenless requests hit the *public* endpoints, which the docs
 * describe as "for internal use only … far less forgiving rate limit"; an application token
 * (`ANIMESCHEDULE_TOKEN`, created in account settings) is sent as `Authorization: Bearer` when
 * present and should be used once permission is granted. The rate-limit numbers live on a
 * JS-rendered docs tab and are unverified, hence 1 request per 2 s, one at a time, 2 retries.
 * Attribution "Anime schedule data from AnimeSchedule.net" lives on `public.sources.attribution`
 * and `source_url` links every row back to its animeschedule.net page.
 *
 * Verified on the live API (2026-09-09): `?years=Y` alone returns only the *unseasoned* bucket
 * (`season.season === ''`, mostly Chinese ONA, 32 rows for 2026); seasonal anime need
 * `seasons=`; pages hold 18 rows; a page past the last one returns HTTP 500 (retryable in
 * http.ts), so paging stops from `totalAmount` and normally never probes; `premier`, `subPremier`,
 * `dubPremier` carry the sentinel `0001-01-01T00:00:00Z` when unknown (every Winter 2027 row on
 * page 1 was a sentinel). `description` is the upstream synopsis (source-credited prose, often
 * "(Source: Official site)") and is never copied: `description` here is our own two sentences.
 * Key art is studio copyright: no `image_candidate_url` (`imageVersionRoute` stays in `raw`).
 *
 * Units: one upstream page per unit, `animeschedule:<slot>:page:<n>` where `<slot>` is the
 * upstream season route (`fall-2026`) or the bare year (`2026`) for the unseasoned bucket; the
 * slots cover every season overlapping [now, now + 15 months]. The cursor `{ slot, page }` names
 * the upstream query, never an index into a computed array, and carries no derived state: the
 * end of a slot is decided from the page in hand alone (`isLastPage`) — a short page, an empty
 * page, `page * PAGE_SIZE >= totalAmount`, or the `MAX_PAGES` cap. Deriving and carrying a page
 * count instead is what an earlier revision did, and it inflated the count whenever page 1 came
 * back short, which walked the slot past its end. As belt and braces a 500 on page > 1 is taken
 * as the past-the-end signal and closes the slot (it costs `maxRetries + 1` requests, since
 * http.ts treats 500 as retryable, so it is a fallback and not the paging mechanism).
 *
 * Rejected alternatives (Phase-4 briefs, section 20): AniList GraphQL (HTTP 403 "temporarily
 * disabled"), Jikan v4 (MAL upstream 504s, unlicensed scraper) — never fall back to either.
 */

export const AS_ENDPOINT = "https://animeschedule.net/api/v3/anime";
export const AS_SITE = "https://animeschedule.net/anime/";
/** Rows per upstream page (verified 2026-09-09). */
export const PAGE_SIZE = 18;
/** Safety cap per slot (Summer 2026 = 110 rows = 7 pages at the time of writing). */
export const MAX_PAGES = 12;
/** Only premieres within this many months are kept (the season list is derived from the same horizon). */
export const HORIZON_MONTHS = 15;
const POPULARITY_BASE = 20;
const POPULARITY_CAP = 30;
const CONFIDENCE = 0.7;
const SENTINEL_YEAR = 1900;

export const SEASONS = ["winter", "spring", "summer", "fall"] as const;
export type SeasonName = (typeof SEASONS)[number];

type Named = { name?: string | null; route?: string | null };

export type AsAnime = {
  id: string;
  title: string;
  route: string;
  premier?: string | null;
  subPremier?: string | null;
  dubPremier?: string | null;
  year?: number | string | null;
  season?: { title?: string | null; year?: string | number | null; season?: string | null; route?: string | null } | null;
  delayedFrom?: string | null;
  delayedUntil?: string | null;
  genres?: Named[] | null;
  studios?: Named[] | null;
  sources?: Named[] | null;
  mediaTypes?: Named[] | null;
  episodes?: number | null;
  status?: string | null;
  updatedAt?: string | null;
  imageVersionRoute?: string | null;
  names?: { native?: string | null; synonyms?: string[] | null } | null;
  websites?: Record<string, unknown> | null;
  stats?: { trackedCount?: number | null } | null;
};

export type AsPayload = { page?: number; totalAmount?: number; anime?: AsAnime[] };

/** One upstream query: a season of a year (`fall-2026`) or the unseasoned bucket of a year (`2026`). */
export type Slot = { route: string; year: number; season: SeasonName | null };

export type Cursor = { slot: string; page: number } | { done: true };

export type AsUnit = Unit & { slot: Slot; page: number; last: boolean };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** `2026-09-30T00:00:00Z` → `2026-09-30`; null for the `0001-01-01` sentinel or anything unparsable. */
export function premiereDay(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const day = value.slice(0, 10);
  if (Number(day.slice(0, 4)) <= SENTINEL_YEAR) return null;
  if (Number.isNaN(Date.parse(`${day}T00:00:00Z`))) return null;
  return day;
}

/** First day of a season quarter: winter = Jan, spring = Apr, summer = Jul, fall = Oct. */
export function seasonStart(year: number, season: SeasonName): string {
  const month = SEASONS.indexOf(season) * 3 + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function addMonths(day: string, months: number): string {
  const [y, m] = day.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/** The last calendar day inside the horizon: `now + HORIZON_MONTHS` (UTC day arithmetic). */
export function horizonEnd(now: Date, months = HORIZON_MONTHS): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, now.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

/**
 * Slots in chronological order: for each year touched by [now, now + horizon], the unseasoned
 * bucket first, then every season whose quarter ends after `now` and starts inside the horizon.
 * A season is kept while its quarter is still running (Fall 2026 lists late-September premieres
 * and the seasonal anime that start mid-quarter).
 */
export function planSlots(now: Date, months = HORIZON_MONTHS): Slot[] {
  const today = now.toISOString().slice(0, 10);
  const end = horizonEnd(now, months);
  const firstYear = Number(today.slice(0, 4));
  const lastYear = Number(end.slice(0, 4));
  const slots: Slot[] = [];
  for (let year = firstYear; year <= lastYear; year++) {
    slots.push({ route: String(year), year, season: null });
    for (const season of SEASONS) {
      const start = seasonStart(year, season);
      const quarterEnd = addMonths(start, 3); // exclusive
      if (quarterEnd <= today || start > end) continue;
      slots.push({ route: `${season}-${year}`, year, season });
    }
  }
  return slots;
}

export function parseCursor(cursor: Json | null): Cursor | null {
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    const c = cursor as { slot?: unknown; page?: unknown; done?: unknown };
    if (c.done === true) return { done: true };
    if (typeof c.slot === "string" && /^(?:\d{4}|(?:winter|spring|summer|fall)-\d{4})$/.test(c.slot) && typeof c.page === "number" && Number.isInteger(c.page) && c.page >= 1) {
      return { slot: c.slot, page: c.page };
    }
  }
  return null;
}

export function queryUrl(slot: Slot, page: number): string {
  const params = new URLSearchParams({ years: String(slot.year) });
  if (slot.season) params.set("seasons", slot.season);
  params.set("page", String(page));
  return `${AS_ENDPOINT}?${params.toString()}`;
}

/** Request headers: the application token when configured (private endpoints), none otherwise. */
export function requestHeaders(env: Record<string, string | undefined> = process.env): Record<string, string> {
  const token = (env.ANIMESCHEDULE_TOKEN ?? "").trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Whether `page` was the last one, decided from the page in hand alone: an empty page, a short
 * page, the `MAX_PAGES` cap, or `page * PAGE_SIZE >= totalAmount`. Nothing derived here is
 * carried in the cursor, so a short page can never inflate an estimate that outlives it.
 */
export function isLastPage(page: number, count: number, totalAmount?: number): boolean {
  if (count === 0 || page >= MAX_PAGES || count < PAGE_SIZE) return true;
  return typeof totalAmount === "number" && Number.isFinite(totalAmount) && page * PAGE_SIZE >= totalAmount;
}

const idFrom = (url: unknown, re: RegExp): number | undefined => {
  if (typeof url !== "string") return undefined;
  const m = re.exec(url);
  return m ? Number(m[1]) : undefined;
};

/** Cross-source ids from `websites` (MAL, AniList, AniDB numeric ids; Kitsu slug). */
export function externalIdsFor(a: AsAnime): Record<string, unknown> {
  const ids: Record<string, unknown> = { animeschedule: a.id, route: a.route };
  const w = a.websites ?? {};
  const mal = idFrom(w.mal, /myanimelist\.net\/anime\/(\d+)/);
  const anilist = idFrom(w.aniList, /anilist\.co\/anime\/(\d+)/);
  const anidb = idFrom(w.anidb, /anidb\.net\/anime\/(\d+)/);
  if (mal) ids.mal = mal;
  if (anilist) ids.anilist = anilist;
  if (anidb) ids.anidb = anidb;
  const kitsu = typeof w.kitsu === "string" ? /kitsu\.(?:app|io)\/anime\/([^/?#]+)/.exec(w.kitsu)?.[1] : undefined;
  if (kitsu) ids.kitsu = kitsu;
  return ids;
}

function names(list: Named[] | null | undefined): string[] {
  return (list ?? []).map((x) => (typeof x?.name === "string" ? x.name.trim() : "")).filter(Boolean);
}

function routes(list: Named[] | null | undefined): string[] {
  return (list ?? []).map((x) => (typeof x?.route === "string" ? slugify(x.route) : "")).filter(Boolean);
}

/** Season label of a row: "Fall 2026" from `season`, else the bare year. */
export function seasonLabel(a: AsAnime): { label: string; season: SeasonName | null; year: number | null } {
  const raw = typeof a.season?.season === "string" ? a.season.season.trim().toLowerCase() : "";
  const season = (SEASONS as readonly string[]).includes(raw) ? (raw as SeasonName) : null;
  const yearNum = Number(a.season?.year ?? a.year);
  const year = Number.isInteger(yearNum) && yearNum > SENTINEL_YEAR ? yearNum : null;
  const label = season && year ? `${cap(season)} ${year}` : year ? String(year) : "";
  return { label, season, year };
}

const MEDIA_KINDS: Record<string, string> = {
  tv: "TV anime",
  movie: "anime film",
  ona: "original net animation (ONA)",
  "ona-chinese": "Chinese donghua (ONA)",
  ova: "original video animation (OVA)",
  special: "anime special",
};

/** "TV anime", "anime film", … from the first media type; plain "anime" when unknown. */
export function mediaKind(a: AsAnime): string {
  const route = routes(a.mediaTypes)[0];
  if (!route) return "anime";
  const name = names(a.mediaTypes)[0];
  return MEDIA_KINDS[route] ?? (name ? `${name} anime` : "anime");
}

/**
 * Own wording (never the upstream synopsis): what premieres when, then format, studio, genres and
 * length. A row with no studio, genres or episode count would otherwise get a ~40-character stub,
 * below the indexability bar, so it falls back to a sentence about the listing itself.
 */
export function describe(a: AsAnime, day: string, dubDay: string | null): string {
  const title = sanitizeTitle(a.title);
  const { label } = seasonLabel(a);
  const kind = mediaKind(a);
  const first = `${title}${label ? ` (${label})` : ""} premieres on ${fmtDay(day)}.`;
  const dub = dubDay ? ` English dub premiere: ${fmtDay(dubDay)}.` : "";
  const studios = names(a.studios);
  const genres = names(a.genres).map((g) => g.toLowerCase());
  const by = studios.length ? ` by ${studios.slice(0, 3).join(", ")}` : "";
  const of = genres.length ? ` in the ${genres.slice(0, 4).join(", ")} genre${genres.length > 1 ? "s" : ""}` : "";
  const eps = typeof a.episodes === "number" && a.episodes > 1 ? `, planned for ${a.episodes} episodes` : "";
  const article = /^[aeiou]/i.test(kind) ? "An" : "A";
  const second =
    by || of || eps
      ? `${article} ${kind}${by}${of}${eps}.`
      : `${article} ${kind} listed on AnimeSchedule; the premiere day is tracked from the announced broadcast schedule and updates here if it moves.`;
  return `${first}${dub} ${second}`;
}

/** Popularity from tracker counts: 20 base, +5 at 500 trackers, +10 at 1,500; capped at 30. */
export function popularityFor(a: AsAnime): number {
  const tracked = typeof a.stats?.trackedCount === "number" ? a.stats.trackedCount : 0;
  return Math.min(POPULARITY_CAP, POPULARITY_BASE + (tracked >= 1500 ? 10 : tracked >= 500 ? 5 : 0));
}

export type Reject = "no-id" | "no-title" | "no-route" | "no-premiere" | "past" | "horizon" | "label-year";

/** One upstream anime → premiere row, or a rejection reason. */
export function animeToEvent(a: AsAnime, now: Date): { event: IngestEvent } | { reject: Reject } {
  if (typeof a?.id !== "string" || !a.id.trim()) return { reject: "no-id" };
  const title = sanitizeTitle(typeof a.title === "string" ? a.title : "");
  if (title.length < 2) return { reject: "no-title" };
  if (typeof a.route !== "string" || !/^[A-Za-z0-9._~-]+$/.test(a.route)) return { reject: "no-route" };
  const day = premiereDay(a.premier);
  if (!day) return { reject: "no-premiere" };
  // Same "yesterday onward" boundary the rest of the catalog uses, so a premiere does not vanish
  // from this feed a day before it would from holidays or launches.
  if (!isFutureOrFar(day, "day", now)) return { reject: "past" };
  if (day > horizonEnd(now)) return { reject: "horizon" }; // also covers isFarFuture(): HORIZON_MONTHS is far below the 15-year cutoff
  // Label-year sanity check, on a *trailing* year only: a remake disambiguator mid-title
  // ("Ranma ½ (2024) 3rd Season", live on Fall 2026 page 2) is part of the name, not an edition
  // label. Of the trailing years, two shapes are dropped as drift rather than naming:
  //   · a year later than the premiere ("Mang Huang Ji (2027)" premiering 2026) — an announcement
  //     label that the premiere date has since moved away from;
  //   · a bare (unparenthesised) earlier year ("Ranma ½ 2024" premiering 2026) — a trailing year
  //     with no brackets reads as this edition's own year, so a mismatch is drift.
  // A parenthesised earlier year ("Ranma ½ (2024)" premiering 2026) is the standard remake
  // disambiguator and is kept.
  const label = /(\(|\b)((?:19|20)\d{2})\)?\s*$/.exec(title);
  if (label && label[2] !== day.slice(0, 4) && (Number(label[2]) > Number(day.slice(0, 4)) || !label[1])) {
    return { reject: "label-year" };
  }

  const dubDay = premiereDay(a.dubPremier);
  const subDay = premiereDay(a.subPremier);
  const { season, year } = seasonLabel(a);
  const media = routes(a.mediaTypes);
  const chinese = media.includes("ona-chinese") || media.includes("chinese");
  const tags = ["anime", "premiere", ...(season ? [season] : []), ...media, ...routes(a.genres), ...(dubDay ? ["dub"] : [])];

  const event = buildEvent({
    title: `${title} premiere`,
    date: day,
    category: "anime",
    tags,
    regions: chinese ? ["CN", "GLOBAL"] : ["JP", "GLOBAL"],
    description: describe(a, day, dubDay),
    source: "animeschedule",
    sourceUrl: `${AS_SITE}${a.route}`,
    sourceKey: `animeschedule:${a.id}`,
    featured: false,
    popularity: popularityFor(a),
    allDay: true,
    timezone: chinese ? "Asia/Shanghai" : "Asia/Tokyo",
    datePrecision: "day",
    status: "scheduled",
    confidence: CONFIDENCE,
    externalIds: externalIdsFor(a),
    seriesSlug: null,
    location: null,
    raw: {
      id: a.id,
      title: a.title,
      route: a.route,
      premier: a.premier ?? null,
      subPremier: subDay,
      dubPremier: dubDay,
      year: year,
      season: a.season?.route ?? null,
      status: a.status ?? null,
      episodes: typeof a.episodes === "number" ? a.episodes : null,
      mediaTypes: media,
      studios: names(a.studios),
      genres: routes(a.genres),
      imageVersionRoute: a.imageVersionRoute ?? null,
      updatedAt: a.updatedAt ?? null,
    },
  });
  // buildEvent slugs `"<title> premiere"`, so slugBase() always sees the Latin word "premiere" and
  // never reaches its digest fallback: two kana/hanzi-only titles premiering on the same day would
  // both slug to `premiere-YYYY-MM-DD` and upsert.ts merges by slug. Give those rows the digest
  // base of their own title instead. `slug` is not part of contentHash, so no rehash is needed.
  if (!slugify(title)) event.slug = `${slugBase(title, "anime")}-premiere-${day}`;
  return { event };
}

/** Rows of one page: valid future premieres, deduped by `source_key`, in upstream order. */
export function pageToEvents(anime: readonly AsAnime[], now: Date, log?: IngestLogger, label = "animeschedule"): IngestEvent[] {
  const rejects: Partial<Record<Reject, number>> = {};
  const seen = new Set<string>();
  const rows: IngestEvent[] = [];
  for (const a of anime) {
    const r = animeToEvent(a, now);
    if ("reject" in r) {
      rejects[r.reject] = (rejects[r.reject] ?? 0) + 1;
      continue;
    }
    if (seen.has(r.event.source_key)) continue;
    seen.add(r.event.source_key);
    rows.push(r.event);
  }
  log?.info(
    `${label}: ${anime.length} anime → ${rows.length} premieres` +
      (Object.keys(rejects).length
        ? ` · rejected ${Object.entries(rejects)
            .map(([k, v]) => `${k}=${v}`)
            .join(" ")}`
        : ""),
  );
  return rows;
}

/** The unit for (slot, page) with an `after` getter that reads `last` once run() has set it. */
export function makeUnit(slots: readonly Slot[], index: number, page: number): AsUnit {
  const slot = slots[index];
  const next = slots[index + 1];
  return {
    key: `animeschedule:${slot.route}:page:${page}`,
    label: `AnimeSchedule ${slot.route} page ${page}`,
    slot,
    page,
    last: false,
    get after(): Json {
      if (this.last) return next ? { slot: next.route, page: 1 } : { done: true };
      return { slot: slot.route, page: page + 1 };
    },
  };
}

/**
 * One unit per call. A cursor naming a slot outside the current horizon (a pass resumed months
 * later) restarts from the first slot; a page beyond `MAX_PAGES` moves on to the next slot.
 */
export function planFrom(cursor: Json | null, now: Date, log?: IngestLogger): Plan<AsUnit> {
  const slots = planSlots(now);
  const c = parseCursor(cursor);
  if (c && "done" in c) return { units: [], done: true };
  let index = 0;
  let page = 1;
  if (c) {
    const i = slots.findIndex((s) => s.route === c.slot);
    if (i < 0) log?.warn(`cursor slot ${c.slot} is outside the current horizon; restarting the pass`);
    else {
      index = i;
      page = c.page;
    }
  }
  if (page > MAX_PAGES) {
    index++;
    page = 1;
  }
  if (index >= slots.length) return { units: [], done: true };
  const unit = makeUnit(slots, index, page);
  return {
    units: [unit],
    done: false,
    get nextCursor(): Json {
      return unit.after;
    },
  };
}

export const adapter: Adapter<AsUnit> = {
  id: "animeschedule",
  label: "AnimeSchedule.net premieres",
  rank: 4,
  cadence: "weekly",
  /** Terms unconfirmed (commercial use needs permission): opt in explicitly, a token alone is not enough. */
  isConfigured: () => process.env.ANIMESCHEDULE_ENABLED === "true",
  limits: { concurrency: 1, minIntervalMs: 2000, timeoutMs: 20_000, maxRetries: 2 },

  async plan(cursor, ctx): Promise<Plan<AsUnit>> {
    return planFrom(cursor, ctx.now, ctx.log);
  },

  async run(unit, ctx: IngestContext) {
    let body: AsPayload;
    try {
      body = await ctx.http.fetchJson<AsPayload>(queryUrl(unit.slot, unit.page), { headers: requestHeaders() });
    } catch (err) {
      // A page past the last one answers HTTP 500 (verified upstream). isLastPage should have closed
      // the slot before we ever ask for it — 500 is retryable in http.ts, so getting here costs
      // maxRetries + 1 requests — but close the slot rather than failing the unit if it happens.
      if (err instanceof HttpError && err.status === 500 && unit.page > 1) {
        ctx.log.warn(`${unit.label}: HTTP 500 on page ${unit.page}; taken as past the end of the slot`);
        unit.last = true;
        return [];
      }
      throw err;
    }
    const anime = Array.isArray(body?.anime) ? body.anime : null;
    if (!anime) {
      ctx.log.warn(`${unit.label}: response has no anime array`);
      unit.last = true;
      return [];
    }
    unit.last = isLastPage(unit.page, anime.length, body.totalAmount);
    const rows = pageToEvents(anime, ctx.now, ctx.log, unit.label);
    ctx.log.info(`${unit.label}: ${anime.length} of ${body.totalAmount ?? "?"} anime, ${rows.length} rows${unit.last ? " (last page)" : ""}`);
    return rows;
  },
};
