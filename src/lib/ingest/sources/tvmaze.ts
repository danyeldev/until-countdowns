import { buildEvent, isFarFuture, sanitizeTitle, slugify } from "../normalize";
import { catalogDay } from "@/lib/time";
import type { Adapter, IngestContext, IngestEvent, IngestLogger, Json, Plan, Unit } from "../types";

/**
 * Season and series premieres from TVMaze (https://www.tvmaze.com/api), `GET /schedule/full`:
 * every future episode TVMaze knows about (≈ 6,500 episodes, 12.7 MB, `cache-control: max-age=86400`,
 * no key). One request per day is all this adapter ever makes; the body is parsed once in memory.
 *
 * Kept: `type === 'regular' && number === 1` — one row per show-season ("<show> season N premiere",
 * season 1 → "<show> series premiere", year-numbered seasons such as award shows → "<show> 2026").
 * Filtered: `show.weight < TVMAZE_MIN_WEIGHT` (default 80, ≈ 250 rows at the time of writing),
 * `show.type` in {Talk Show, News, Game Show, Sports, Variety} (daily floods), `airdate < today`,
 * specials, and a cap of 400 rows per run (highest weight first).
 *
 * Dates: TVMaze sets `airtime = ''` for about a third of the rows and then synthesises a local-
 * midnight `airstamp`. Only a real `airtime` yields an instant (`date = airstamp` in UTC,
 * `timezone` = the network's country zone); an empty one yields the all-day `airdate`.
 * An instant is kept **only when its UTC day is still the local air day**: `buildEvent` derives the
 * slug and the catalog day from `date.slice(0, 10)` in UTC and `src/lib/time.ts` renders listing
 * cards in UTC, so a 22:00 America/New_York premiere would otherwise be slugged, listed and
 * counted down one calendar day late (92 of 224 live rows on 2026-09-09). Those rows fall back to
 * the all-day `airdate` and keep the `airstamp` in `raw`. Restoring instant precision for them
 * needs a shared change (derive the day in the row's timezone in `normalize.ts` + `time.ts`).
 * All-day rows keep the network's `timezone` as provenance for that future local-day renderer —
 * nothing reads the column today, and the value is the show's real broadcast zone, not a guess.
 *
 * `description` always clears the 80-character indexability bar of `finalize_catalog` /
 * `0009_indexable_summary.sql` on its own: no tvmaze row is `featured`, none reaches
 * `popularity >= 45` (capped at 35) and `series_slug` is null, so the migration never queues a
 * `wikipedia_summary` job for this source and `summary` would stay null forever.
 *
 * Weight gate: `show.weight` is a rolling daily popularity index, so a confirmed premiere whose
 * show dips under the threshold would vanish and `mark_stale_records` would flip it to
 * `tentative` ("expected …") until it recovered. Premieres inside `NEAR_DAYS` therefore pass at
 * `threshold - NEAR_WEIGHT_SLACK`, which pins the near-term set (where the countdown is actually
 * being watched) without widening the long tail.
 *
 * The shared label-year sanity bound is deliberately narrowed to year-numbered seasons here: TV
 * titles legitimately contain years (Blade Runner 2099, 1923, Yellowstone 1944) and the strict
 * "title year must equal date year" rule would drop them. The year-edition check is kept and
 * compares the season number against the day the row actually carries.
 *
 * Licence: TVMaze data is CC BY-SA — the attribution "TV schedule data from TVmaze" lives on
 * `public.sources.attribution` and `source_url` links every row back to its tvmaze.com page.
 * `show.summary` is CC BY-SA prose and is never copied: `description` is our own sentences.
 * Posters are network copyright: no `image_candidate_url` (cards render without images).
 *
 * Rejected alternatives (Phase-4 briefs, section 20): TMDB (revenue-generating sites need a written
 * agreement, 6-month caching cap), Trakt (no images, 33-day window), TheTVDB v4 (paid, restrictive),
 * OMDb (lookup-only).
 *
 * Verified on the live payload (2026-09-09): episode `type` ∈ {regular, significant_special,
 * insignificant_special}; 1,949 rows are web-channel-only (`network == null`); `show.externals`
 * is `{ tvrage, thetvdb, imdb }` on every row. Rate limit: 20 calls / 10 s per IP (429 above).
 */

export const TVMAZE_ENDPOINT = "https://api.tvmaze.com/schedule/full";
export const DEFAULT_MIN_WEIGHT = 80;
export const MAX_ROWS = 400;
const POPULARITY_CAP = 35;
const CONFIDENCE = 0.9;
/** Premieres this close pass the weight gate at a lower floor (see the docblock: anti-flap). */
export const NEAR_DAYS = 45;
export const NEAR_WEIGHT_SLACK = 15;
/** `indexable` in `0009_indexable_summary.sql` needs `length(description) >= 80`. */
export const MIN_DESCRIPTION = 80;

/** Show formats that premiere a "season" every day or week and would flood the catalog. */
export const SKIPPED_SHOW_TYPES = new Set(["Talk Show", "News", "Game Show", "Sports", "Variety"]);

export type TvmazeCountry = { name?: string | null; code?: string | null; timezone?: string | null } | null;
export type TvmazeChannel = { id?: number; name?: string | null; country?: TvmazeCountry } | null;

export type TvmazeShow = {
  id: number;
  url?: string | null;
  name: string;
  type?: string | null;
  language?: string | null;
  genres?: string[] | null;
  status?: string | null;
  premiered?: string | null;
  weight?: number | null;
  network?: TvmazeChannel;
  webChannel?: TvmazeChannel;
  externals?: { tvrage?: number | null; thetvdb?: number | null; imdb?: string | null } | null;
  image?: { medium?: string; original?: string } | null;
  summary?: string | null;
};

export type TvmazeEpisode = {
  id: number;
  url?: string | null;
  name?: string | null;
  season: number;
  number: number | null;
  type?: string | null;
  airdate: string;
  airtime?: string | null;
  airstamp?: string | null;
  runtime?: number | null;
  _embedded?: { show?: TvmazeShow | null } | null;
};

export type TvmazeUnit = Unit & { day: string };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function isoDaysFromNow(now: Date, days: number): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

/** `TVMAZE_MIN_WEIGHT` (0..100) or the default. Read at run time so tests and ops can tune it without a redeploy. */
export function minWeight(): number {
  const n = Number(process.env.TVMAZE_MIN_WEIGHT);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : DEFAULT_MIN_WEIGHT;
}

/** The channel a show airs on: the broadcast network first, else the streaming/web channel. */
export function channelOf(show: TvmazeShow): { name: string; country: TvmazeCountry; kind: "network" | "web" } | null {
  const net = show.network;
  if (net && typeof net.name === "string" && net.name.trim()) return { name: net.name.trim(), country: net.country ?? null, kind: "network" };
  const web = show.webChannel;
  if (web && typeof web.name === "string" && web.name.trim()) return { name: web.name.trim(), country: web.country ?? null, kind: "web" };
  return null;
}

function countryCode(country: TvmazeCountry): string | null {
  const code = country?.code;
  return typeof code === "string" && /^[A-Z]{2}$/.test(code) ? code : null;
}

function timezoneOf(country: TvmazeCountry): string | null {
  const tz = country?.timezone;
  return typeof tz === "string" && /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+$/.test(tz) ? tz : null;
}

/** Seasons numbered by year ("The Emmy Awards" season 2026) are editions, not seasons. */
export function isYearSeason(season: number): boolean {
  return Number.isInteger(season) && season >= 1900 && season <= 2200;
}

export function titleFor(show: TvmazeShow, season: number): string {
  const name = sanitizeTitle(show.name);
  if (isYearSeason(season)) return `${name} ${season}`;
  if (season === 1) return `${name} series premiere`;
  return `${name} season ${season} premiere`;
}

export type DescribeDetail = { countryName?: string | null; airtime?: string | null; runtime?: number | null };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "United States" → "the United States"; plain names are left alone. */
export function withArticle(country: string): string {
  return /^(United |Republic )|\b(Kingdom|Republic|Islands|Netherlands|Philippines|Emirates|Federation|Bahamas|Maldives|Gambia)\b/.test(country) ? `the ${country}` : country;
}

function weekdayOf(iso: string): string | null {
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(t) ? null : WEEKDAYS[new Date(t).getUTCDay()];
}

/**
 * Own wording (no `show.summary`): what premieres, where, when — then genres and format, then the
 * broadcast facts. Sentences are appended until the text clears `MIN_DESCRIPTION`, because nothing
 * downstream will ever fill `summary` for this source (see the docblock), so a short description
 * would leave the row permanently non-indexable. Every clause is a fact from the schedule payload.
 */
export function describe(show: TvmazeShow, season: number, airdate: string, channel: string | null, detail: DescribeDetail = {}): string {
  const name = sanitizeTitle(show.name);
  const where = channel ? ` on ${channel}` : "";
  const when = fmtDay(airdate);
  let first: string;
  if (isYearSeason(season)) first = `The ${season} edition of ${name} airs${where} on ${when}.`;
  else if (season === 1) first = `${name} premieres${where} on ${when}.`;
  else first = `Season ${season} of ${name} premieres${where} on ${when}.`;
  const genres = (show.genres ?? []).filter((g) => typeof g === "string" && g.trim()).map((g) => g.trim());
  const format = typeof show.type === "string" && show.type.trim() ? show.type.trim() : "";
  const language = typeof show.language === "string" && show.language.trim() && show.language !== "English" ? `${show.language.trim()}-language ` : "";
  const parts = [genres.join(", "), format ? `${language}${format}` : ""].filter(Boolean);
  const sentences = [first];
  if (parts.length) sentences.push(`${parts.join(" · ")}.`);

  // Broadcast facts. The channel alone is skipped — the first sentence already names it.
  const country = typeof detail.countryName === "string" && detail.countryName.trim() ? detail.countryName.trim() : "";
  const airtime = typeof detail.airtime === "string" && /^\d{1,2}:\d{2}/.test(detail.airtime) ? detail.airtime.slice(0, 5) : "";
  const runtime = typeof detail.runtime === "number" && detail.runtime > 0 ? Math.round(detail.runtime) : 0;
  const at = airtime ? ` at ${airtime} local time` : "";
  if (country) sentences.push(`It airs in ${withArticle(country)}${at}.`);
  else if (at) sentences.push(`It airs${at}.`);
  if (runtime) sentences.push(`Episodes run about ${runtime} minutes.`);

  const text = () => sentences.join(" ");
  const weekday = weekdayOf(airdate);
  if (text().length < MIN_DESCRIPTION && weekday) sentences.push(`${when} falls on a ${weekday}.`);
  if (text().length < MIN_DESCRIPTION) sentences.push("The countdown on this page tracks the time left until it airs.");
  return text();
}

/** `2026-09-17T20:00:00+00:00` → `2026-09-17T20:00:00Z`; null for anything unparsable. */
export function toUtcInstant(airstamp: string | null | undefined): string | null {
  if (typeof airstamp !== "string" || !airstamp.includes("T")) return null;
  const t = Date.parse(airstamp);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().replace(/\.000Z$/, "Z");
}

export type Reject =
  | "no-show"
  | "not-premiere"
  | "show-type"
  | "weight"
  | "bad-date"
  | "past"
  | "far-future"
  | "label-year"
  | "empty-title";

/** One schedule episode → premiere row, or a rejection reason. */
export function episodeToEvent(ep: TvmazeEpisode, now: Date, threshold = minWeight()): { event: IngestEvent } | { reject: Reject } {
  const show = ep?._embedded?.show;
  if (!show || typeof show.id !== "number" || typeof show.name !== "string") return { reject: "no-show" };
  if (ep.type !== "regular" || ep.number !== 1 || !Number.isInteger(ep.season)) return { reject: "not-premiere" };
  const showType = typeof show.type === "string" ? show.type : "";
  if (SKIPPED_SHOW_TYPES.has(showType)) return { reject: "show-type" };
  const weight = typeof show.weight === "number" ? show.weight : 0;
  const airdate = typeof ep.airdate === "string" ? ep.airdate.slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(airdate) || Number.isNaN(Date.parse(`${airdate}T00:00:00Z`))) return { reject: "bad-date" };
  const today = now.toISOString().slice(0, 10);
  if (airdate < today) return { reject: "past" };
  // Anti-flap: `weight` moves daily, so premieres in the near window (the ones actually being
  // counted down) pass at a lower floor rather than dropping in and out of the catalog.
  const near = airdate <= isoDaysFromNow(now, NEAR_DAYS);
  if (weight < (near ? Math.max(0, threshold - NEAR_WEIGHT_SLACK) : threshold)) return { reject: "weight" };
  const title = titleFor(show, ep.season);
  if (title.length < 2) return { reject: "empty-title" };

  const channel = channelOf(show);
  const country = channel?.country ?? null;
  const code = countryCode(country);
  const tz = timezoneOf(country);
  const hasAirtime = typeof ep.airtime === "string" && /^\d{2}:\d{2}/.test(ep.airtime);
  // `airstamp` is on every episode, but only an explicit `airtime` proves the hour is real rather
  // than a midnight placeholder — so the airstamp is trusted exactly as far as the airtime is.
  const instant = hasAirtime ? toUtcInstant(ep.airstamp) : null;
  // The instant is kept even when it lands on the next UTC day. `buildEvent` now files a row under
  // its own zone's day, so a 22:00 ET premiere keeps its time AND still lists on the 12th; before
  // that, keeping it would have slugged and listed the row a day late, so the time was dropped.
  const day = catalogDay(instant ?? airdate, instant ? (tz ?? "UTC") : tz);
  // Label-year check: a year-numbered edition must air in the year it is named after ("Grammy
  // Awards 2027" in 2027), measured on the day the row actually carries, not on the raw airdate.
  if (isYearSeason(ep.season) && String(ep.season) !== day.slice(0, 4)) return { reject: "label-year" };
  const genres = (show.genres ?? []).filter((g): g is string => typeof g === "string" && g.trim().length > 0);
  const isAnime = genres.some((g) => g.trim().toLowerCase() === "anime");
  // A bare numeric channel slug ("5" for UK Channel 5) is a useless facet and a `/tag/5` page.
  const channelSlug = channel ? slugify(channel.name) : "";
  const channelTags = !channelSlug ? [] : /^\d+$/.test(channelSlug) ? [`channel-${channelSlug}`] : [channelSlug];
  const tags = ["tv", "premiere", `season-${ep.season}`, ...channelTags, ...genres.map((g) => g.toLowerCase())];
  if (ep.season === 1 && !isYearSeason(ep.season)) tags.push("series-premiere");
  if (isFarFuture(day, tags, now)) return { reject: "far-future" };

  const externalIds: Record<string, unknown> = { tvmaze_episode: ep.id, tvmaze_show: show.id };
  if (typeof show.externals?.imdb === "string" && show.externals.imdb) externalIds.imdb = show.externals.imdb;
  if (typeof show.externals?.thetvdb === "number") externalIds.thetvdb = show.externals.thetvdb;

  const event = buildEvent({
    title,
    date: instant ?? airdate,
    category: isAnime ? "anime" : "tv",
    tags,
    regions: code ? [code] : ["GLOBAL"],
    description: describe(show, ep.season, airdate, channel?.name ?? null, {
      countryName: typeof country?.name === "string" ? country.name : null,
      airtime: hasAirtime ? ep.airtime : null,
      runtime: ep.runtime ?? null,
    }),
    source: "tvmaze",
    sourceUrl: typeof ep.url === "string" && /^https?:\/\//.test(ep.url) ? ep.url : (show.url ?? null),
    sourceKey: `tvmaze:ep:${ep.id}`,
    featured: false,
    popularity: Math.min(POPULARITY_CAP, Math.round(weight / 3)),
    allDay: !instant,
    timezone: instant ? (tz ?? "UTC") : tz,
    datePrecision: instant ? "instant" : "day",
    status: "scheduled",
    confidence: CONFIDENCE,
    externalIds,
    seriesSlug: null,
    location: null,
    raw: {
      id: ep.id,
      name: ep.name ?? null,
      season: ep.season,
      number: ep.number,
      type: ep.type ?? null,
      airdate,
      airtime: ep.airtime ?? "",
      airstamp: ep.airstamp ?? null,
      runtime: ep.runtime ?? null,
      show: {
        id: show.id,
        name: show.name,
        type: showType || null,
        language: show.language ?? null,
        genres,
        status: show.status ?? null,
        premiered: show.premiered ?? null,
        weight,
        network: show.network ? { name: show.network.name ?? null, country: show.network.country ?? null } : null,
        webChannel: show.webChannel ? { name: show.webChannel.name ?? null, country: show.webChannel.country ?? null } : null,
      },
    },
  });
  return { event };
}

/**
 * Rows for one schedule payload: premieres only, one per show-season (earliest airdate, then the
 * lowest episode id, wins), deduped by `source_key`, highest weight first, capped at `MAX_ROWS`.
 */
export function scheduleToEvents(episodes: readonly TvmazeEpisode[], now: Date, log?: IngestLogger, threshold = minWeight()): IngestEvent[] {
  const rejects: Partial<Record<Reject, number>> = {};
  const byShowSeason = new Map<string, { ep: TvmazeEpisode; event: IngestEvent; weight: number }>();
  for (const ep of episodes) {
    const r = episodeToEvent(ep, now, threshold);
    if ("reject" in r) {
      rejects[r.reject] = (rejects[r.reject] ?? 0) + 1;
      continue;
    }
    const show = ep._embedded!.show!;
    const key = `${show.id}:${ep.season}`;
    const prev = byShowSeason.get(key);
    const weight = typeof show.weight === "number" ? show.weight : 0;
    if (!prev || ep.airdate < prev.ep.airdate || (ep.airdate === prev.ep.airdate && ep.id < prev.ep.id)) byShowSeason.set(key, { ep, event: r.event, weight });
  }
  const seen = new Set<string>();
  const rows = [...byShowSeason.values()]
    .sort((a, b) => b.weight - a.weight || (a.ep.airdate < b.ep.airdate ? -1 : a.ep.airdate > b.ep.airdate ? 1 : a.ep.id - b.ep.id))
    .map(({ event }) => event)
    .filter((event) => (seen.has(event.source_key) ? false : (seen.add(event.source_key), true)));
  const capped = rows.slice(0, MAX_ROWS);
  log?.info(
    `tvmaze: ${episodes.length} episodes → ${rows.length} premieres (weight ≥ ${threshold}, ≥ ${Math.max(0, threshold - NEAR_WEIGHT_SLACK)} within ${NEAR_DAYS} days)` +
      (rows.length > MAX_ROWS ? `, capped at ${MAX_ROWS}` : "") +
      ` · rejected ${Object.entries(rejects)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ")}`,
  );
  return capped;
}

export function parseCursor(cursor: Json | null): { fetchedOn: string } | null {
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    const c = cursor as { fetchedOn?: unknown };
    if (typeof c.fetchedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.fetchedOn)) return { fetchedOn: c.fetchedOn };
  }
  return null;
}

/**
 * One unit per pass, keyed by the UTC day of `now`. The cursor (`{ fetchedOn }`) records which
 * day's payload was upserted; it is informational only — a same-day re-run fetches again rather
 * than returning an empty plan, because an empty completed pass would let `mark_stale_records`
 * flag every tvmaze row as unseen.
 */
export function planUnits(now: Date): TvmazeUnit[] {
  const day = now.toISOString().slice(0, 10);
  return [{ key: `tvmaze:schedule-full:${day}`, label: `TVMaze full schedule (${day})`, after: { fetchedOn: day }, day }];
}

export const adapter: Adapter<TvmazeUnit> = {
  id: "tvmaze",
  label: "TVMaze premieres",
  rank: 5,
  cadence: "daily",
  isConfigured: () => true,
  limits: { concurrency: 1, minIntervalMs: 1000, timeoutMs: 90_000, maxRetries: 2 },

  async plan(_cursor, ctx): Promise<Plan<TvmazeUnit>> {
    return { units: planUnits(ctx.now), done: true };
  },

  async run(unit, ctx: IngestContext) {
    const body = await ctx.http.fetchJson<unknown>(TVMAZE_ENDPOINT);
    if (!Array.isArray(body)) {
      ctx.log.warn(`${unit.label}: response is not an array`);
      return [];
    }
    const rows = scheduleToEvents(body as TvmazeEpisode[], ctx.now, ctx.log);
    ctx.log.info(`${unit.label}: ${rows.length} rows`);
    return rows;
  },
};
