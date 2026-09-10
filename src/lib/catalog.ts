/**
 * Catalog read path. Every export keeps its pre-Supabase name and call shape but is async.
 *
 * - No `Date.now()` / `new Date()` here: every time comparison happens in SQL
 *   (`events_public.days_until`, the `search_events` window, ...).
 * - Cached reads go through `cached()` with the `events` tag (stats: `stats`);
 *   free-text search and `/api/events` are uncached.
 * - Every read is wrapped in `safe()` so a missing env var or a network error
 *   degrades to an empty catalog instead of failing the build.
 */
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { cached, eventTag, TAG_EVENTS, TAG_STATS } from "./cache";
import { anonClient, supabaseEnv } from "./db/client";
import type { Database } from "./db/database.types";
import { jsonToEvent, rowToEvent, toCategory } from "./db/mappers";
import {
  addDays,
  chineseLunarToSolar,
  dayOfYear,
  easterSunday,
  fridays13,
  isLeapYear,
  nextWeekdayAfter,
  nthWeekday,
  orthodoxEaster,
  toIso,
  type Ymd,
} from "./ingest/recurrence";
import { regionCodesMatching } from "./regions";
import type {
  CatalogMeta,
  Category,
  CountdownEvent,
  DateChange,
  DatePrecision,
  SearchParams,
  SearchResult,
  Series,
  SeriesFaq,
  SeriesRecurrence,
  SourceInfo,
} from "./types";
import { CATEGORIES } from "./types";

export { COUNTRY_NAMES, regionLabel, regionSummary } from "./regions";

const REVALIDATE_EVENTS = 3600;
// Same TTL as events until the finalize cron (Phase 3) invalidates the `stats` tag after each run:
// a wrong footer/About count must not outlive the event cache.
const REVALIDATE_STATS = 3600;

/**
 * Shape guard for slugs coming straight from the URL. Catalog slugs are `slugify(title)-YYYY-MM-DD`
 * (lowercase ASCII; a few rows have an empty title part and start with `-`). Anything else is
 * rejected before it can touch the Data Cache or the database (junk URLs otherwise cost two cache
 * writes plus an ISR 404 entry each).
 */
const SLUG_RE = /^[a-z0-9-]{1,200}$/;

function isCatalogSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !slug.startsWith("mine-") && !slug.startsWith("share-");
}

/** Thrown by the strict readers when the database could not be read (as opposed to a genuine miss). */
export class CatalogReadError extends Error {
  constructor(name: string, cause: unknown) {
    super(`[catalog] ${name} failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "CatalogReadError";
  }
}

const warned = new Set<string>();

async function safe<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!warned.has(name)) {
      warned.add(name);
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[catalog] ${name} failed, using fallback: ${message}`);
    }
    return fallback;
  }
}

function unwrap<T>(res: PostgrestSingleResponse<T>): T | null {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const EMPTY_META: CatalogMeta = {
  generatedAt: "",
  count: 0,
  stats: { byCat: {}, bySrc: {}, featured: 0 },
  sources: [],
  sourceLabels: {},
};

function asCounts(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Search (shared by the cached list, the live search and /api/events)
// ---------------------------------------------------------------------------

type SearchArgs = {
  q?: string;
  category?: string;
  tag?: string;
  region?: string;
  featured?: boolean;
  sort: "soonest" | "latest" | "popular";
  minPopularity: number;
  page: number;
  pageSize: number;
};

function normalizeParams(params: SearchParams): SearchArgs {
  const q = params.q?.trim() || undefined;
  return {
    q,
    category: params.category && params.category !== "all" ? params.category : undefined,
    tag: params.tag?.trim() || undefined,
    region: params.region?.trim() || undefined,
    featured: params.featured ? true : undefined,
    sort: params.sort ?? "soonest",
    minPopularity: params.minPopularity ?? 0,
    page: Math.max(1, Math.floor(params.page ?? 1) || 1),
    pageSize: Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 24) || 24)),
  };
}

async function runSearch(args: SearchArgs): Promise<SearchResult> {
  const rows = unwrap(
    await anonClient().rpc("search_events", {
      p_q: args.q,
      p_category: args.category,
      p_tag: args.tag,
      p_region: args.region,
      p_featured: args.featured ?? false,
      p_region_codes: args.q ? regionCodesMatching(args.q) : [],
      p_sort: args.sort,
      p_min_popularity: args.minPopularity,
      p_page: args.page,
      p_page_size: args.pageSize,
    }),
  );
  const list = rows ?? [];
  return {
    items: list.map((r) => jsonToEvent(r.event)),
    total: list.length > 0 ? Number(list[0].total) || 0 : 0,
    page: args.page,
    pageSize: args.pageSize,
  };
}

const listEventsCached = cached(
  async (
    category: string | undefined,
    tag: string | undefined,
    region: string | undefined,
    featured: boolean | undefined,
    sort: SearchArgs["sort"],
    minPopularity: number,
    page: number,
    pageSize: number,
  ) => runSearch({ category, tag, region, featured, sort, minPopularity, page, pageSize }),
  ["catalog", "list-events"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

/** Filtered listing without free text — cached, keyed by every parameter value. */
export async function listEvents(params: SearchParams = {}): Promise<SearchResult> {
  const a = normalizeParams({ ...params, q: undefined });
  return safe(
    "listEvents",
    () => listEventsCached(a.category, a.tag, a.region, a.featured, a.sort, a.minPopularity, a.page, a.pageSize),
    { items: [], total: 0, page: a.page, pageSize: a.pageSize },
  );
}

/** Free-text search — uncached (the query space is unbounded). */
export async function searchEventsLive(params: SearchParams = {}): Promise<SearchResult> {
  const a = normalizeParams(params);
  return safe("searchEventsLive", () => runSearch(a), {
    items: [],
    total: 0,
    page: a.page,
    pageSize: a.pageSize,
  });
}

/** Same signature as before: delegates to the live search when `q` is present, else the cached list. */
export async function searchEvents(params: SearchParams = {}): Promise<SearchResult> {
  return params.q && params.q.trim() ? searchEventsLive(params) : listEvents(params);
}

/** Uncached query for `/api/events` (the route sets its own CDN cache headers). */
export async function queryEvents(params: SearchParams = {}): Promise<SearchResult> {
  const a = normalizeParams(params);
  return safe("queryEvents", () => runSearch(a), {
    items: [],
    total: 0,
    page: a.page,
    pageSize: a.pageSize,
  });
}

// ---------------------------------------------------------------------------
// Single events
// ---------------------------------------------------------------------------

function parseDateHistory(value: unknown): DateChange[] {
  if (!Array.isArray(value)) return [];
  const out: DateChange[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.date !== "string" || rec.date.length < 10) continue;
    out.push({
      date: rec.date,
      changedAt: typeof rec.changed_at === "string" ? rec.changed_at : undefined,
      source: typeof rec.source === "string" ? rec.source : undefined,
      note: typeof rec.note === "string" ? rec.note : undefined,
    });
  }
  return out;
}

async function fetchEvent(slug: string): Promise<CountdownEvent | null> {
  const row = unwrap(await anonClient().from("events_public").select("*").eq("slug", slug).maybeSingle());
  if (!row) return null;
  const event = rowToEvent(row);
  const dateHistory = parseDateHistory(row.date_history);
  return dateHistory.length > 0 ? { ...event, dateHistory } : event;
}

function cachedEvent(slug: string) {
  return cached(() => fetchEvent(slug), ["catalog", "event", slug], {
    tags: [TAG_EVENTS, eventTag(slug)],
    revalidate: REVALIDATE_EVENTS,
  });
}

/** One event by its current slug. Cached per slug with both the `events` and the `event:<slug>` tags. */
export async function getEvent(slug: string): Promise<CountdownEvent | undefined> {
  if (!isCatalogSlug(slug)) return undefined;
  const event = await safe("getEvent", () => cachedEvent(slug)(), null);
  return event ?? undefined;
}

/**
 * Like `getEvent`, but a read failure throws `CatalogReadError` instead of looking like a miss,
 * so an ISR page can answer 500 (uncached) rather than caching a 404 for an existing slug.
 * With no Supabase env at all it resolves to `undefined`, keeping the env-less build green.
 */
export async function getEventStrict(slug: string): Promise<CountdownEvent | undefined> {
  if (!isCatalogSlug(slug) || supabaseEnv() === null) return undefined;
  try {
    return (await cachedEvent(slug)()) ?? undefined;
  } catch (err) {
    throw new CatalogReadError("getEvent", err);
  }
}

/** One row of the licence table on `/attributions`. */
export type ImageLicenseCount = { provider: string; license: string; count: number };

const IMAGE_LICENSE_SCAN = 5000;

const imageLicensesCached = cached(
  async () => {
    const rows = unwrap(await anonClient().from("images").select("provider, license").limit(IMAGE_LICENSE_SCAN)) ?? [];
    const tally = new Map<string, ImageLicenseCount>();
    for (const row of rows) {
      const provider = row.provider ?? "unknown";
      const license = row.license ?? "unknown";
      const key = `${provider}\u0000${license}`;
      const hit = tally.get(key);
      if (hit) hit.count++;
      else tally.set(key, { provider, license, count: 1 });
    }
    return [...tally.values()].sort((a, b) => b.count - a.count || a.provider.localeCompare(b.provider));
  },
  ["catalog", "image-licenses"],
  // Also tagged `events`: every enrichment run that stores an image invalidates that tag, so the
  // table on /attributions is never a stale count of a library that just grew.
  { tags: [TAG_STATS, TAG_EVENTS], revalidate: REVALIDATE_STATS },
);

/**
 * Providers and licences actually present in the re-hosted image library, for `/attributions`.
 * Grouping happens here rather than in SQL: PostgREST has no GROUP BY, and the table is small.
 */
export async function imageLicenses(): Promise<ImageLicenseCount[]> {
  return safe("imageLicenses", () => imageLicensesCached(), []);
}

const summaryCitationCached = cached(
  async (slug: string) => {
    const row = unwrap(await anonClient().from("events_public").select("external_ids").eq("slug", slug).maybeSingle());
    const ids = row?.external_ids;
    if (!ids || typeof ids !== "object" || Array.isArray(ids)) return null;
    const bag = ids as Record<string, unknown>;
    if (bag.summary_source !== "wikipedia" || typeof bag.enwiki !== "string" || bag.enwiki.length === 0) return null;
    return { enwiki: bag.enwiki };
  },
  ["catalog", "summary-citation"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

/**
 * The English Wikipedia article an event's `summary` was taken from, when it was.
 *
 * `events_public` carries `external_ids` but `CountdownEvent` deliberately does not, and the
 * CC BY-SA 4.0 licence on Wikipedia prose obliges the page to name and link the article — so the
 * event page reads just this one field, cached under the same tags as the event itself.
 */
export async function summaryCitation(slug: string): Promise<{ enwiki: string } | null> {
  if (!isCatalogSlug(slug)) return null;
  return safe("summaryCitation", () => summaryCitationCached(slug), null);
}

const resolveSlugAliasCached = cached(
  async (slug: string) => {
    const alias = unwrap(await anonClient().from("event_slugs").select("event_id").eq("slug", slug).maybeSingle());
    if (!alias) return null;
    const row = unwrap(
      await anonClient().from("events_public").select("slug").eq("id", alias.event_id).maybeSingle(),
    );
    return row?.slug ?? null;
  },
  ["catalog", "slug-alias"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

/** Old slug (after a date slip or rename) -> current slug, or null. */
export async function resolveSlugAlias(slug: string): Promise<string | null> {
  if (!isCatalogSlug(slug)) return null;
  const current = await safe("resolveSlugAlias", () => resolveSlugAliasCached(slug), null);
  return current && current !== slug ? current : null;
}

/** `resolveSlugAlias` that throws `CatalogReadError` on a read failure (see `getEventStrict`). */
export async function resolveSlugAliasStrict(slug: string): Promise<string | null> {
  if (!isCatalogSlug(slug) || supabaseEnv() === null) return null;
  let current: string | null;
  try {
    current = await resolveSlugAliasCached(slug);
  } catch (err) {
    throw new CatalogReadError("resolveSlugAlias", err);
  }
  return current && current !== slug ? current : null;
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

const featuredUpcomingCached = cached(
  async (limit: number) => (unwrap(await anonClient().rpc("featured_upcoming", { p_limit: limit })) ?? []).map(rowToEvent),
  ["catalog", "featured-upcoming"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

export async function featuredUpcoming(limit = 1): Promise<CountdownEvent[]> {
  return safe("featuredUpcoming", () => featuredUpcomingCached(limit), []);
}

const soonestUpcomingCached = cached(
  async (limit: number) => (unwrap(await anonClient().rpc("soonest_upcoming", { p_limit: limit })) ?? []).map(rowToEvent),
  ["catalog", "soonest-upcoming"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

export async function soonestUpcoming(limit = 8): Promise<CountdownEvent[]> {
  return safe("soonestUpcoming", () => soonestUpcomingCached(limit), []);
}

const relatedEventsCached = cached(
  async (id: string, limit: number) =>
    (unwrap(await anonClient().rpc("related_events", { p_id: id, p_limit: limit })) ?? []).map(rowToEvent),
  ["catalog", "related-events"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

export async function relatedEvents(event: CountdownEvent, limit = 6): Promise<CountdownEvent[]> {
  if (!event.id || event.source === "user") return [];
  return safe("relatedEvents", () => relatedEventsCached(event.id, limit), []);
}

/** Bounded listing kept for API compatibility; prefer `searchEvents`. */
export async function allEvents(limit = 1000): Promise<CountdownEvent[]> {
  const result = await listEvents({ sort: "soonest", page: 1, pageSize: Math.min(100, limit) });
  return result.items;
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

const categoryCountsCached = cached(
  async () => {
    const rows = unwrap(await anonClient().rpc("category_counts")) ?? [];
    const counts = {} as Record<Category, number>;
    for (const row of rows) counts[row.category as Category] = Number(row.n) || 0;
    return counts;
  },
  ["catalog", "category-counts"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

export async function categoryCounts(): Promise<Record<Category, number>> {
  return safe("categoryCounts", () => categoryCountsCached(), {} as Record<Category, number>);
}

const popularTagsCached = cached(
  async (limit: number) =>
    (unwrap(await anonClient().rpc("popular_tags", { p_limit: limit })) ?? []).map((row) => ({
      tag: row.tag,
      count: Number(row.n) || 0,
    })),
  ["catalog", "popular-tags"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

export async function popularTags(limit = 18): Promise<{ tag: string; count: number }[]> {
  return safe("popularTags", () => popularTagsCached(limit), []);
}

const topSlugsCached = cached(
  async (limit: number) =>
    (unwrap(await anonClient().rpc("top_slugs", { p_limit: limit })) ?? []).map((row) => row.slug).filter(Boolean),
  ["catalog", "top-slugs"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

/** Most popular upcoming slugs — used by `generateStaticParams`. */
export async function topSlugs(limit = 500): Promise<string[]> {
  return safe("topSlugs", () => topSlugsCached(limit), []);
}

const catalogMetaCached = cached(
  async (): Promise<CatalogMeta> => {
    const [statsRes, sourcesRes] = await Promise.all([
      anonClient().from("catalog_stats").select("*").eq("id", true).maybeSingle(),
      anonClient().from("sources").select("id, label"),
    ]);
    const row = unwrap(statsRes);
    const sourceLabels: Record<string, string> = {};
    for (const s of unwrap(sourcesRes) ?? []) if (s.label) sourceLabels[s.id] = s.label;
    if (!row) return { ...EMPTY_META, sourceLabels };
    const bySrc = asCounts(row.by_src);
    return {
      generatedAt: row.generated_at ?? "",
      count: row.count ?? 0,
      stats: { byCat: asCounts(row.by_cat), bySrc, featured: row.featured ?? 0 },
      sources: Object.keys(bySrc),
      sourceLabels,
    };
  },
  ["catalog", "meta"],
  { tags: [TAG_STATS], revalidate: REVALIDATE_STATS },
);

export async function catalogMeta(): Promise<CatalogMeta> {
  return safe("catalogMeta", () => catalogMetaCached(), EMPTY_META);
}

// ---------------------------------------------------------------------------
// Writes allowed to the anonymous role
// ---------------------------------------------------------------------------

/** Records a free-text query and its hit count (anon-callable SECURITY DEFINER rpc). */
export async function logSearch(q: string, results: number): Promise<void> {
  await safe(
    "logSearch",
    async () => {
      unwrap(await anonClient().rpc("log_search", { p_q: q, p_results: results }));
    },
    undefined,
  );
}

// ---------------------------------------------------------------------------
// Series (evergreen "days until" pages)
// ---------------------------------------------------------------------------

type SeriesRow = Database["public"]["Views"]["series_next"]["Row"];

const PRECISIONS: ReadonlySet<string> = new Set(["instant", "day", "month", "quarter", "year", "decade"]);
const COARSE_PRECISIONS: ReadonlySet<string> = new Set(["month", "quarter", "year", "decade"]);
/** PostgREST value literals that Postgres resolves at query time (`'now'::timestamptz`, `'today'::date`). */
const SQL_NOW = "now";
const SQL_TODAY = "today";
/** Supabase caps a single response at 1000 rows; larger reads page with `.range()`. */
const PAGE_ROWS = 1000;
const SITEMAP_MAX_URLS = 50_000;

function isSeriesSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

function toPrecisionValue(value: string | null | undefined): DatePrecision | undefined {
  return value && PRECISIONS.has(value) ? (value as DatePrecision) : undefined;
}

function parseFaq(value: unknown): SeriesFaq[] {
  if (!Array.isArray(value)) return [];
  const out: SeriesFaq[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const question = rec.question ?? rec.q;
    const answer = rec.answer ?? rec.a;
    if (typeof question === "string" && typeof answer === "string" && question.trim() && answer.trim()) {
      out.push({ question: question.trim(), answer: answer.trim() });
    }
  }
  return out;
}

function isFiniteInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

/** `series.recurrence` jsonb -> typed rule, or undefined when absent or malformed. */
function parseRecurrence(value: unknown): SeriesRecurrence | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const rec = value as Record<string, unknown>;
  const offsetDays = isFiniteInt(rec.offsetDays) ? rec.offsetDays : undefined;
  switch (rec.kind) {
    case "fixed":
      return isFiniteInt(rec.month) && isFiniteInt(rec.day)
        ? { kind: "fixed", month: rec.month, day: rec.day, ...(offsetDays !== undefined ? { offsetDays } : {}) }
        : undefined;
    case "nth-weekday":
      return isFiniteInt(rec.month) && isFiniteInt(rec.weekday) && isFiniteInt(rec.n)
        ? { kind: "nth-weekday", month: rec.month, weekday: rec.weekday, n: rec.n, ...(offsetDays !== undefined ? { offsetDays } : {}) }
        : undefined;
    case "easter-offset":
    case "orthodox-easter-offset":
      return isFiniteInt(rec.days) ? { kind: rec.kind, days: rec.days } : undefined;
    case "lunar-chinese":
      return isFiniteInt(rec.month) && isFiniteInt(rec.day) ? { kind: "lunar-chinese", month: rec.month, day: rec.day } : undefined;
    case "custom":
      return typeof rec.rule === "string" ? { kind: "custom", rule: rec.rule } : undefined;
    default:
      return undefined;
  }
}

/**
 * Dates a rule produces in a calendar year (mirrors `occurrencesIn` in the curated adapter), or
 * null when the rule cannot be evaluated here (unknown custom rule) and must not filter anything.
 */
function ruleDatesInYear(rule: SeriesRecurrence, year: number): Ymd[] | null {
  try {
    switch (rule.kind) {
      case "fixed":
        return [addDays({ y: year, m: rule.month, d: rule.day }, rule.offsetDays ?? 0)];
      case "nth-weekday": {
        const d = nthWeekday(year, rule.month, rule.weekday, rule.n);
        return d ? [addDays(d, rule.offsetDays ?? 0)] : [];
      }
      case "easter-offset":
        return [addDays(easterSunday(year), rule.days)];
      case "orthodox-easter-offset":
        return [addDays(orthodoxEaster(year), rule.days)];
      case "lunar-chinese":
        return [chineseLunarToSolar(year, rule.month, rule.day)];
      case "custom":
        switch (rule.rule) {
          case "programmers-day":
            return [dayOfYear(year, 256)];
          case "leap-day":
            return isLeapYear(year) ? [{ y: year, m: 2, d: 29 }] : [];
          case "friday-13th":
            return fridays13(year);
          case "oktoberfest-start":
            return [nextWeekdayAfter({ y: year, m: 9, d: 15 }, 6)];
          default:
            return null;
        }
    }
  } catch {
    return null;
  }
}

/** Whether `date` (`YYYY-MM-DD…`) is one the rule produces (offsets may cross a year boundary). */
function matchesRecurrence(rule: SeriesRecurrence, date: string): boolean | null {
  const iso = date.slice(0, 10);
  const year = Number(iso.slice(0, 4));
  if (!Number.isFinite(year)) return null;
  for (const y of [year - 1, year, year + 1]) {
    const dates = ruleDatesInYear(rule, y);
    if (dates === null) return null;
    if (dates.some((d) => toIso(d) === iso)) return true;
  }
  return false;
}

type OccurrenceLike = Pick<CountdownEvent, "date" | "regions" | "source">;

/**
 * Guard against the finalize linker, which attaches every published row whose slug base equals
 * the series slug: "Christmas Day" on 7 January (Orthodox), "New Year's Day" on 11 September
 * (Ethiopia), "Labour Day" on the fourth Monday of October (New Zealand) all end up in the series.
 * Until the linker checks dates, a linked row counts as canonical when
 *  - it matches the curated recurrence rule (when the series has one that can be evaluated), and
 *  - it is a curated/worldwide row, or at least half as many countries observe it as the most
 *    widely observed linked row (regional variants of a holiday carry a handful of regions).
 */
function isCanonicalOccurrence(rule: SeriesRecurrence | undefined, maxRegions: number, o: OccurrenceLike): boolean {
  if (rule && matchesRecurrence(rule, o.date) === false) return false;
  if (o.source === "curated" || o.regions.includes("GLOBAL")) return true;
  return o.regions.length * 2 >= maxRegions;
}

function maxRegionCount(rows: readonly OccurrenceLike[]): number {
  let max = 0;
  for (const o of rows) if (!o.regions.includes("GLOBAL")) max = Math.max(max, o.regions.length);
  return max;
}

/** Splits linked occurrences (any order preserved) into canonical rows and regional variants. */
function splitOccurrences<T extends OccurrenceLike>(rule: SeriesRecurrence | undefined, rows: T[]): { canonical: T[]; variants: T[] } {
  const max = maxRegionCount(rows);
  const canonical: T[] = [];
  const variants: T[] = [];
  for (const o of rows) (isCanonicalOccurrence(rule, max, o) ? canonical : variants).push(o);
  return { canonical, variants };
}

function seriesRowToSeries(row: SeriesRow): Series {
  const nextPrecision = toPrecisionValue(row.next_precision);
  const coarse = nextPrecision !== undefined && COARSE_PRECISIONS.has(nextPrecision);
  const recurrence = parseRecurrence(row.recurrence);
  return {
    slug: row.slug ?? "",
    title: row.title ?? "",
    category: toCategory(row.category),
    description: row.description ?? "",
    summary: row.summary ?? undefined,
    tags: row.tags ?? [],
    regions: row.regions && row.regions.length > 0 ? row.regions : ["GLOBAL"],
    popularity: row.popularity ?? 0,
    featured: row.featured ?? false,
    faq: parseFaq(row.faq),
    wikidataQid: row.wikidata_qid ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    ...(recurrence ? { recurrence } : {}),
    nextSlug: row.next_slug ?? undefined,
    nextDate: row.next_date ?? undefined,
    nextAllDay: row.next_all_day ?? undefined,
    nextPrecision,
    daysUntil: coarse ? undefined : (row.days_until ?? undefined),
  };
}

type NextLike = Pick<CountdownEvent, "slug" | "date" | "allDay" | "datePrecision" | "daysUntil">;

/** `series` with its next occurrence taken from `next` (the first canonical linked row). */
function withNext(series: Series, next: NextLike | undefined): Series {
  if (!next) return series;
  const coarse = next.datePrecision !== undefined && COARSE_PRECISIONS.has(next.datePrecision);
  return {
    ...series,
    nextSlug: next.slug,
    nextDate: next.date,
    nextAllDay: next.allDay,
    nextPrecision: next.datePrecision,
    daysUntil: coarse ? undefined : next.daysUntil,
  };
}

/** Future linked rows of one series, soonest first (raw, before the canonical guard). */
async function fetchLinkedOccurrences(slug: string, limit: number): Promise<CountdownEvent[]> {
  return (
    unwrap(
      await anonClient()
        .from("events_public")
        .select("*")
        .eq("series_slug", slug)
        .gte("sort_at", SQL_NOW)
        .order("starts_on", { ascending: true })
        .limit(limit),
    ) ?? []
  ).map(rowToEvent);
}

/** Variants can outnumber canonical rows 3:1 (Labour Day), so over-fetch before filtering. */
const OCCURRENCE_OVERFETCH = 4;

async function fetchSeries(slug: string): Promise<Series | null> {
  const row = unwrap(await anonClient().from("series_next").select("*").eq("slug", slug).maybeSingle());
  if (!row) return null;
  const series = seriesRowToSeries(row);
  if (!series.nextSlug) return series;
  const rows = await fetchLinkedOccurrences(series.slug, Math.min(PAGE_ROWS, 8 * OCCURRENCE_OVERFETCH));
  const { canonical } = splitOccurrences(series.recurrence, rows);
  // No canonical row among the soonest linked ones: keep the view's answer rather than none.
  return withNext(series, canonical[0]);
}

function cachedSeries(slug: string) {
  return cached(() => fetchSeries(slug), ["catalog", "series", slug], {
    tags: [TAG_EVENTS, `series:${slug}`],
    revalidate: REVALIDATE_EVENTS,
  });
}

/** One published series with its next occurrence, by canonical slug. */
export async function getSeries(slug: string): Promise<Series | undefined> {
  if (!isSeriesSlug(slug)) return undefined;
  return (await safe("getSeries", () => cachedSeries(slug)(), null)) ?? undefined;
}

/** `getSeries` that throws `CatalogReadError` on a read failure (see `getEventStrict`). */
export async function getSeriesStrict(slug: string): Promise<Series | undefined> {
  if (!isSeriesSlug(slug) || supabaseEnv() === null) return undefined;
  try {
    return (await cachedSeries(slug)()) ?? undefined;
  } catch (err) {
    throw new CatalogReadError("getSeries", err);
  }
}

const resolveSeriesAliasCached = cached(
  async (alias: string) => {
    const row = unwrap(await anonClient().from("series_aliases").select("series_slug").eq("alias", alias).maybeSingle());
    return row?.series_slug ?? null;
  },
  ["catalog", "series-alias"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

/** Series alias (`series_aliases.alias`) -> canonical series slug, or null. */
export async function resolveSeriesAlias(alias: string): Promise<string | null> {
  if (!isSeriesSlug(alias)) return null;
  const slug = await safe("resolveSeriesAlias", () => resolveSeriesAliasCached(alias), null);
  return slug && slug !== alias ? slug : null;
}

export async function resolveSeriesAliasStrict(alias: string): Promise<string | null> {
  if (!isSeriesSlug(alias) || supabaseEnv() === null) return null;
  let slug: string | null;
  try {
    slug = await resolveSeriesAliasCached(alias);
  } catch (err) {
    throw new CatalogReadError("resolveSeriesAlias", err);
  }
  return slug && slug !== alias ? slug : null;
}

export type SeriesOccurrences = { canonical: CountdownEvent[]; variants: CountdownEvent[] };

const seriesOccurrencesCached = cached(
  async (slug: string, limit: number): Promise<SeriesOccurrences> => {
    const [seriesRow, rows] = await Promise.all([
      anonClient().from("series").select("recurrence").eq("slug", slug).maybeSingle(),
      fetchLinkedOccurrences(slug, Math.min(PAGE_ROWS, limit * OCCURRENCE_OVERFETCH)),
    ]);
    const rule = parseRecurrence(unwrap(seriesRow)?.recurrence);
    const { canonical, variants } = splitOccurrences(rule, rows);
    return { canonical: canonical.slice(0, limit), variants: variants.slice(0, limit) };
  },
  ["catalog", "series-occurrences"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

/**
 * Future occurrences of a series, soonest first, split into the canonical dates and the regional
 * variants the linker attached by title (see `isCanonicalOccurrence`).
 */
export async function seriesOccurrencesSplit(slug: string, limit = 60): Promise<SeriesOccurrences> {
  if (!isSeriesSlug(slug)) return { canonical: [], variants: [] };
  return safe("seriesOccurrences", () => seriesOccurrencesCached(slug, Math.max(1, Math.min(PAGE_ROWS, limit))), {
    canonical: [],
    variants: [],
  });
}

/** Canonical future occurrences of a series, soonest first (the curated expansion covers ~14 years). */
export async function seriesOccurrences(slug: string, limit = 60): Promise<CountdownEvent[]> {
  return (await seriesOccurrencesSplit(slug, limit)).canonical;
}

/** Linked rows within this many days feed the corrected `next` of series lists (covers every annual rule). */
const NEXT_INDEX_HORIZON_DAYS = 800;
const NEXT_INDEX_MAX_ROWS = 20_000;

type NextIndexRow = Pick<
  Database["public"]["Views"]["events_public"]["Row"],
  "slug" | "series_slug" | "date" | "all_day" | "date_precision" | "days_until" | "regions" | "source" | "starts_on"
>;

const NEXT_INDEX_COLUMNS = "slug, series_slug, date, all_day, date_precision, days_until, regions, source, starts_on";

/**
 * Soonest linked rows of every series inside the horizon, keyed by series slug, soonest first.
 * One paged read shared by every series list so their `next` can pass the canonical guard
 * without a query per series.
 */
const seriesNextIndexCached = cached(
  async (): Promise<Record<string, NextIndexRow[]>> => {
    const index: Record<string, NextIndexRow[]> = {};
    for (let offset = 0; offset < NEXT_INDEX_MAX_ROWS; offset += PAGE_ROWS) {
      const rows =
        unwrap(
          await anonClient()
            .from("events_public")
            .select(NEXT_INDEX_COLUMNS)
            .not("series_slug", "is", null)
            .gte("days_until", 0)
            .lte("days_until", NEXT_INDEX_HORIZON_DAYS)
            .order("starts_on", { ascending: true })
            .order("slug", { ascending: true })
            .range(offset, offset + PAGE_ROWS - 1),
        ) ?? [];
      for (const r of rows) {
        if (!r.series_slug || !r.slug) continue;
        (index[r.series_slug] ??= []).push(r);
      }
      if (rows.length < PAGE_ROWS) break;
    }
    return index;
  },
  ["catalog", "series-next-index"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

function indexRowToOccurrence(r: NextIndexRow): OccurrenceLike & NextLike {
  return {
    slug: r.slug ?? "",
    date: r.date ?? "",
    allDay: r.all_day ?? true,
    regions: r.regions && r.regions.length > 0 ? r.regions : ["GLOBAL"],
    source: r.source ?? "curated",
    datePrecision: toPrecisionValue(r.date_precision),
    daysUntil: r.days_until ?? undefined,
  };
}

/** Replaces each series' view-derived `next` with its first canonical linked row (when one is in the horizon). */
async function withCanonicalNext(list: Series[]): Promise<Series[]> {
  if (list.length === 0) return list;
  const index = await seriesNextIndexCached();
  return list.map((series) => {
    const rows = (index[series.slug] ?? []).map(indexRowToOccurrence);
    const { canonical } = splitOccurrences(series.recurrence, rows);
    const next = canonical[0];
    if (!next || next.slug === series.nextSlug) return series;
    return withNext(series, next);
  });
}

const topSeriesCached = cached(
  async (limit: number) =>
    withCanonicalNext(
      (
        unwrap(
          await anonClient()
            .from("series_next")
            .select("*")
            .not("next_slug", "is", null)
            .order("popularity", { ascending: false })
            .order("title", { ascending: true })
            .limit(limit),
        ) ?? []
      ).map(seriesRowToSeries),
    ),
  ["catalog", "top-series"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

/** Most popular series that still have a future occurrence. */
export async function topSeries(limit = 24): Promise<Series[]> {
  return safe("topSeries", () => topSeriesCached(Math.min(PAGE_ROWS, limit)), []);
}

const allSeriesCached = cached(
  async () =>
    withCanonicalNext(
      (
        unwrap(
          await anonClient()
            .from("series_next")
            .select("*")
            .not("next_slug", "is", null)
            .order("category", { ascending: true })
            .order("popularity", { ascending: false })
            .order("title", { ascending: true })
            .limit(PAGE_ROWS),
        ) ?? []
      ).map(seriesRowToSeries),
    ),
  ["catalog", "all-series"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

/** Every published series with a next occurrence (bounded by the 1000-row response cap). */
export async function allSeries(): Promise<Series[]> {
  return safe("allSeries", () => allSeriesCached(), []);
}

const seriesInCategoryCached = cached(
  async (category: string, limit: number) =>
    withCanonicalNext(
      (
        unwrap(
          await anonClient()
            .from("series_next")
            .select("*")
            .eq("category", category)
            .not("next_slug", "is", null)
            .order("popularity", { ascending: false })
            .order("title", { ascending: true })
            .limit(limit),
        ) ?? []
      ).map(seriesRowToSeries),
    ),
  ["catalog", "series-in-category"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

export async function seriesInCategory(category: Category, limit = 12): Promise<Series[]> {
  return safe("seriesInCategory", () => seriesInCategoryCached(category, Math.min(PAGE_ROWS, limit)), []);
}

// ---------------------------------------------------------------------------
// Hub reads (home, category, country, calendar)
// ---------------------------------------------------------------------------

const eventsWithinDaysCached = cached(
  async (category: string | undefined, minDays: number, maxDays: number, sort: "soonest" | "popular", limit: number) => {
    let query = anonClient()
      .from("events_public")
      .select("*")
      .gte("days_until", minDays)
      .lte("days_until", maxDays)
      .in("date_precision", ["instant", "day"]);
    if (category) query = query.eq("category", category);
    query =
      sort === "popular"
        ? query.order("popularity", { ascending: false }).order("starts_on", { ascending: true })
        : query.order("starts_on", { ascending: true }).order("popularity", { ascending: false });
    return (unwrap(await query.limit(limit)) ?? []).map(rowToEvent);
  },
  ["catalog", "events-within-days"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

/** Dated (day/instant precision) events whose SQL `days_until` lies in `[minDays, maxDays]`. */
export async function eventsWithinDays(options: {
  category?: Category;
  minDays?: number;
  maxDays: number;
  sort?: "soonest" | "popular";
  limit?: number;
}): Promise<CountdownEvent[]> {
  const { category, minDays = 0, maxDays, sort = "soonest", limit = 24 } = options;
  return safe(
    "eventsWithinDays",
    () => eventsWithinDaysCached(category, minDays, maxDays, sort, Math.min(PAGE_ROWS, limit)),
    [],
  );
}

function monthBounds(year: number, month: number): { from: string; to: string } {
  const mm = String(month).padStart(2, "0");
  const next = month >= 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return { from: `${year}-${mm}-01`, to: `${next.y}-${String(next.m).padStart(2, "0")}-01` };
}

const eventsInMonthCached = cached(
  async (year: number, month: number, limit: number) => {
    const { from, to } = monthBounds(year, month);
    return (
      unwrap(
        await anonClient()
          .from("events_public")
          .select("*")
          .gte("starts_on", from)
          .lt("starts_on", to)
          .gte("starts_on", SQL_TODAY)
          .order("starts_on", { ascending: true })
          .order("popularity", { ascending: false })
          .limit(limit),
      ) ?? []
    ).map(rowToEvent);
  },
  ["catalog", "events-in-month"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

/** Upcoming events starting in a calendar month (past days of the current month are excluded). */
export async function eventsInMonth(year: number, month: number, limit = PAGE_ROWS): Promise<CountdownEvent[]> {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return [];
  return safe("eventsInMonth", () => eventsInMonthCached(year, month, Math.min(PAGE_ROWS, limit)), []);
}

const countryEventsCached = cached(
  async (code: string, limit: number) =>
    (
      unwrap(
        await anonClient()
          .from("events_public")
          .select("*")
          .contains("regions", [code])
          .gte("sort_at", SQL_NOW)
          .order("starts_on", { ascending: true })
          .order("popularity", { ascending: false })
          .limit(limit),
      ) ?? []
    ).map(rowToEvent),
  ["catalog", "country-events"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

/** Upcoming events tagged with one ISO-3166 alpha-2 region (uppercase), soonest first. */
export async function countryEvents(code: string, limit = 400): Promise<CountdownEvent[]> {
  const cc = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return [];
  return safe("countryEvents", () => countryEventsCached(cc, Math.min(PAGE_ROWS, limit)), []);
}

const worldwideUpcomingCached = cached(
  async (limit: number) =>
    (
      unwrap(
        await anonClient()
          .from("events_public")
          .select("*")
          .contains("regions", ["GLOBAL"])
          .gte("sort_at", SQL_NOW)
          .order("sort_at", { ascending: true })
          .order("popularity", { ascending: false })
          .limit(limit),
      ) ?? []
    ).map(rowToEvent),
  ["catalog", "worldwide-upcoming"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

export async function worldwideUpcoming(limit = 12): Promise<CountdownEvent[]> {
  return safe("worldwideUpcoming", () => worldwideUpcomingCached(Math.min(PAGE_ROWS, limit)), []);
}

const countryCountsCached = cached(
  async () => {
    const row = unwrap(await anonClient().from("catalog_stats").select("by_country").eq("id", true).maybeSingle());
    const counts = asCounts(row?.by_country);
    delete counts.GLOBAL;
    return counts;
  },
  ["catalog", "country-counts"],
  { tags: [TAG_STATS], revalidate: REVALIDATE_STATS },
);

/** Upcoming-event counts per ISO region code (from `catalog_stats.by_country`, `GLOBAL` removed). */
export async function countryCounts(): Promise<Record<string, number>> {
  return safe("countryCounts", () => countryCountsCached(), {});
}

const sourcesListCached = cached(
  async (): Promise<SourceInfo[]> =>
    (
      unwrap(
        await anonClient()
          .from("sources")
          .select("id, label, homepage, license, attribution, enabled, rank")
          .eq("enabled", true)
          .order("rank", { ascending: false })
          .order("label", { ascending: true }),
      ) ?? []
    ).map((s) => ({
      id: s.id,
      label: s.label,
      homepage: s.homepage ?? undefined,
      license: s.license ?? undefined,
      attribution: s.attribution ?? undefined,
    })),
  ["catalog", "sources-list"],
  { tags: [TAG_STATS], revalidate: REVALIDATE_STATS },
);

/** Enabled data sources with licence and attribution text, for `/attributions`. */
export async function sourcesList(): Promise<SourceInfo[]> {
  return safe("sourcesList", () => sourcesListCached(), []);
}

/** Tags with at least `min` upcoming events (from the `popular_tags` rpc). */
export async function tagsWithAtLeast(min = 8, limit = 400): Promise<{ tag: string; count: number }[]> {
  const tags = await popularTags(limit);
  return tags.filter((t) => t.count >= min);
}

/** `listEvents` that throws `CatalogReadError` on a read failure instead of returning an empty page. */
export async function listEventsStrict(params: SearchParams = {}): Promise<SearchResult> {
  const a = normalizeParams({ ...params, q: undefined });
  if (supabaseEnv() === null) return { items: [], total: 0, page: a.page, pageSize: a.pageSize };
  try {
    return await listEventsCached(a.category, a.tag, a.region, a.featured, a.sort, a.minPopularity, a.page, a.pageSize);
  } catch (err) {
    throw new CatalogReadError("listEvents", err);
  }
}

export function isCategory(value: string | undefined | null): value is Category {
  return CATEGORIES.includes(value as Category);
}

// ---------------------------------------------------------------------------
// Sitemap reads
// ---------------------------------------------------------------------------

export type SitemapEntry = { slug: string; updatedAt?: string };

const sitemapSeriesCached = cached(
  async (): Promise<SitemapEntry[]> => {
    const out: SitemapEntry[] = [];
    for (let offset = 0; offset < SITEMAP_MAX_URLS; offset += PAGE_ROWS) {
      const rows =
        unwrap(
          await anonClient()
            .from("series_next")
            .select("slug, updated_at")
            .not("next_slug", "is", null)
            .order("slug", { ascending: true })
            .range(offset, offset + PAGE_ROWS - 1),
        ) ?? [];
      for (const r of rows) {
        if (typeof r.slug === "string" && r.slug.length > 0) out.push({ slug: r.slug, updatedAt: r.updated_at ?? undefined });
      }
      if (rows.length < PAGE_ROWS) break;
    }
    return out.slice(0, SITEMAP_MAX_URLS);
  },
  ["catalog", "sitemap-series"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

export async function sitemapSeries(): Promise<SitemapEntry[]> {
  return safe("sitemapSeries", () => sitemapSeriesCached(), []);
}

async function countIndexable(from: string, to: string): Promise<number> {
  const res = await anonClient()
    .from("events_public")
    .select("slug", { count: "exact", head: true })
    .eq("indexable", true)
    .is("series_slug", null)
    .gte("sort_at", SQL_NOW)
    .gte("starts_on", from)
    .lt("starts_on", to);
  if (res.error) throw new Error(res.error.message);
  return res.count ?? 0;
}

const indexableYearsCached = cached(
  async (): Promise<{ year: number; count: number }[]> => {
    const base = () =>
      anonClient().from("events_public").select("starts_on").eq("indexable", true).is("series_slug", null).gte("sort_at", SQL_NOW);
    const [first, last] = await Promise.all([
      base().order("starts_on", { ascending: true }).limit(1).maybeSingle(),
      base().order("starts_on", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const start = unwrap(first)?.starts_on;
    const end = unwrap(last)?.starts_on;
    if (!start || !end) return [];
    const y0 = Number(start.slice(0, 4));
    const y1 = Math.min(Number(end.slice(0, 4)), y0 + 30);
    const years: { year: number; count: number }[] = [];
    for (let y = y0; y <= y1; y++) {
      const count = await countIndexable(`${y}-01-01`, `${y + 1}-01-01`);
      if (count > 0) years.push({ year: y, count });
    }
    return years;
  },
  ["catalog", "indexable-years"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

/**
 * Calendar years that have indexable upcoming events, with counts (drives the sitemap shards).
 * Series members are excluded explicitly (not only via `indexable`, which the nightly finalize
 * flips): a member upserted during the day must never sit in a sitemap while its page is noindex.
 */
export async function indexableYears(): Promise<{ year: number; count: number }[]> {
  return safe("indexableYears", () => indexableYearsCached(), []);
}

const indexableEventsCached = cached(
  async (year: number, half: 0 | 1 | 2): Promise<SitemapEntry[]> => {
    const from = half === 2 ? `${year}-07-01` : `${year}-01-01`;
    const to = half === 1 ? `${year}-07-01` : `${year + 1}-01-01`;
    const out: SitemapEntry[] = [];
    for (let offset = 0; offset < SITEMAP_MAX_URLS; offset += PAGE_ROWS) {
      const rows =
        unwrap(
          await anonClient()
            .from("events_public")
            .select("slug, updated_at")
            .eq("indexable", true)
            .is("series_slug", null)
            .gte("sort_at", SQL_NOW)
            .gte("starts_on", from)
            .lt("starts_on", to)
            .order("starts_on", { ascending: true })
            .order("slug", { ascending: true })
            .range(offset, offset + PAGE_ROWS - 1),
        ) ?? [];
      for (const r of rows) {
        if (r.slug) out.push({ slug: r.slug, updatedAt: r.updated_at ?? undefined });
      }
      if (rows.length < PAGE_ROWS) break;
    }
    return out.slice(0, SITEMAP_MAX_URLS);
  },
  ["catalog", "indexable-events"],
  { tags: [TAG_EVENTS], revalidate: REVALIDATE_EVENTS },
);

/** Indexable upcoming event slugs starting in `year` (`half` 1 = Jan–Jun, 2 = Jul–Dec, 0 = whole year). */
export async function indexableEvents(year: number, half: 0 | 1 | 2 = 0): Promise<SitemapEntry[]> {
  if (!Number.isInteger(year) || year < 2000 || year > 2200) return [];
  return safe("indexableEvents", () => indexableEventsCached(year, half), []);
}

/** Split threshold: a year with more indexable events than this gets `-h1` / `-h2` shards. */
const SITEMAP_SPLIT_AT = 40_000;

/**
 * Stable sitemap shard ids: `hubs`, `series`, then `events-<year>` (or `events-<year>-h1/h2`
 * above 40k URLs) for each year with indexable upcoming events. Shared by `app/sitemap.ts`
 * (`generateSitemaps`) and the hand-written `/sitemap-index.xml`.
 */
export async function sitemapShardIds(): Promise<string[]> {
  const ids = ["hubs", "series"];
  for (const { year, count } of await indexableYears()) {
    if (count > SITEMAP_SPLIT_AT) ids.push(`events-${year}-h1`, `events-${year}-h2`);
    else ids.push(`events-${year}`);
  }
  return ids;
}
