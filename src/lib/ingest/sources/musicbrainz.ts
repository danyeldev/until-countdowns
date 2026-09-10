import { COUNTRY_NAMES } from "@/lib/regions";
import type { Category } from "@/lib/types";
import { HttpError, isBudgetExceeded, sleep } from "../http";
import { buildEvent, clamp, isFarFuture, isFutureOrFar, periodEnd, sanitizeTitle } from "../normalize";
import type { Adapter, IngestContext, IngestEvent, IngestPrecision, IngestStatus, Json, Plan, Unit } from "../types";
import { labelYearConsistent } from "./wikidata/common";

/**
 * Festival editions from MusicBrainz (https://musicbrainz.org/doc/MusicBrainz_API), `/ws/2/event`.
 *
 * Coverage (verified 2026-09-09): `type:Festival AND begin:[today TO today+2y]` returns ≈ 130 events,
 * almost all within the next 12 months; marquee festivals (Glastonbury, Tomorrowland, Coachella)
 * are absent and 2028+ is effectively empty. Category `festivals` (`music` for any non-festival
 * type that ever reaches the row builder).
 *
 * Two stages, one request per step, 3 s apart. **Every event is emitted at most once per pass** —
 * a second row with the same `source_key` would be merged by `upsert_events` with `coalesce`/`or`/
 * `array_agg(distinct …)`, which keeps the *first* location, unions the regions (a search-stage
 * `GLOBAL` would stick next to the looked-up `FR`) and can never turn `jsonld_eligible` off again:
 *   1. `search:festival:<offset>` — Lucene search, 100 per page, ≤ 3 pages. Search hits carry the
 *      relations inline (`held at` place {id, name} — no area/coordinates —, `held in` area
 *      {id, name}, artist rels) but no `cancelled` flag and no country. The best LOOKUP_PER_PAGE
 *      hits of the page are *withheld* (no row) and queued for stage 2 with their trimmed payload;
 *      every other hit not already handled by an earlier page (search paging overlaps: 9 of the 13
 *      rows of page 2 repeated page 1 — hence the `seen` id list in the cursor) is emitted right
 *      here at confidence 0.6, with `location: null` and
 *      `jsonld_eligible: false` — a `{name, url}` location with no address is worse than none once
 *      `coalesce` has locked it in, and eligibility must not be decided without `cancelled`.
 *   2. `lookup:<mbid…>` — `GET /event/<mbid>?inc=place-rels+artist-rels+url-rels+area-rels`
 *      (`+` is the separator; `,` answers HTTP 400 — verified) adds `cancelled`, the place's area
 *      and coordinates, ticketing URLs. The queued event is emitted here, once, at confidence 0.75
 *      with `location`, `regions`, `status` and `jsonld_eligible` from the lookup. LOOKUP_BATCH
 *      events per unit; when a lookup still fails after the HTTP retries the cached search payload
 *      is emitted instead (search quality, so the event is not lost for the pass) and the unit only
 *      fails when every lookup failed and nothing could be emitted.
 *
 * Regions: a place's `area` is a city, never a country (`iso-3166-1-codes` is absent there —
 * verified), so the country comes from walking `part of` area relations: city → subdivision
 * (`iso-3166-2-codes` "DE-ST" ⇒ DE) or city → county → subdivision ("US-CA" ⇒ US), at most
 * AREA_HOPS lookups per area. Resolved (and unresolved) area ids are cached in the cursor so a
 * resumed pass never re-fetches them. Without a resolvable area the row is `GLOBAL`.
 *
 * Fragments: MusicBrainz models multi-day festivals as "<name>, Day N[: Stage]" events. Within a
 * page they collapse to the parent name; when the parent event itself is in the page it wins,
 * otherwise the earliest fragment stands in and takes the latest sibling end date.
 *
 * Quality guards: title-year check (verified junk: "Supervue Festival 2017, Day 1" dated
 * 2027-07-28), `begin` from yesterday to +2 years, ≤ 300 rows per pass, ≤ 30 lookups per pass.
 *
 * Coarse `begin`: a year/month-only life-span becomes the first day of the period + `tentative` +
 * `date_precision` year/month, exactly like wikidata.ts. Deliberate: `isFutureOrFar()` keeps such a
 * row until the period ends, so "Audiofeed Music Festival 2026" is stored as 2026-01-01 even in
 * September 2026. The catalog treats coarse precisions as "expected in <period>" (COARSE_PRECISIONS
 * in src/lib/catalog.ts) rather than as a live countdown, so the placeholder day is never shown as
 * a date; dropping those rows would lose ~3 % of the corpus for no gain.
 *
 * Rate limit: documented 1 req/s; in practice 1.05 s spacing returned 503 "server busy" on every
 * request while 3 s was clean, and the first request of a session may hang or drop the connection
 * ("Empty reply from server"), hence `minIntervalMs: 3000`, plus one extra 30 s pause in `mbGet()`
 * when a 503 survives the HTTP layer's retries. A descriptive User-Agent is mandatory (requests
 * without one hang). `timeoutMs: 15000` × `maxRetries: 2` × LOOKUP_BATCH 2 (≤ 6 requests) bounds a
 * stalled lookup unit to ~90 s, inside the 240 s INGEST_BUDGET_MS: a unit that eats the whole
 * budget is skipped by the runner, and its events would lose the pass.
 *
 * Licence: core data (events, places, areas, artists, relationships) is CC0 — the courtesy line
 * "Event data from MusicBrainz (CC0)" lives on `public.sources.attribution`. Tags, ratings,
 * annotations and edit history are CC BY-NC-SA 3.0 and are never stored: `raw` is a whitelist of
 * the core fields. No images (Cover Art Archive is release-level): cards render without one.
 *
 * Solr search upgrade announced for 2026-11-30 (breaking: relation objects lose `target`, tag ids
 * dropped): the search parser reads only `id/type/name/life-span/relations[].{type,place,artist,
 * area}` and should survive, but re-validate against `tests/fixtures/musicbrainz` then. Lookups and
 * browses are unaffected.
 *
 * Rejected alternatives (Phase-4 briefs §20): Songkick public API (gone), Bandsintown (artist-keyed,
 * written consent), Setlist.fm (past only), Ticketmaster Discovery (no caching beyond "reasonable
 * periods", no revenue), Eventbrite public search (shut down).
 */

export const MB_BASE = "https://musicbrainz.org/ws/2";
export const MB_WEB = "https://musicbrainz.org";
export const SEARCH_PAGE = 100;
/** ≤ 300 search rows per pass. */
export const MAX_SEARCH_PAGES = 3;
export const HORIZON_YEARS = 2;
/** Lookups per pass (each ≤ 1 event + AREA_HOPS area requests). */
export const LOOKUP_CAP = 30;
/** Hits withheld from a search page for stage 2; LOOKUP_CAP spread over the pages. */
export const LOOKUP_PER_PAGE = Math.ceil(LOOKUP_CAP / MAX_SEARCH_PAGES);
/** Events per lookup unit: ≤ 6 requests ≈ 18 s at 3 s spacing, ≤ 90 s when MusicBrainz stalls. */
export const LOOKUP_BATCH = 2;
/** A queued candidate carries its trimmed search hit as a stage-2 fallback; bigger ones travel without. */
export const MAX_HIT_BYTES = 4000;
/** Ids remembered across the search pages of one pass (≈ 38 B each); ≥ SEARCH_PAGE × MAX_SEARCH_PAGES. */
export const SEEN_MAX = 400;
export const AREA_HOPS = 2;
export const AREA_CACHE_MAX = 300;
export const LOOKUP_INC = "place-rels+artist-rels+url-rels+area-rels";
/** Extra pause when a 503 "server busy" survives the HTTP layer's own retries. */
export const MB_BUSY_BACKOFF_MS = 30_000;

const SOURCE = "musicbrainz" as const;
const CONFIDENCE_SEARCH = 0.6;
const CONFIDENCE_LOOKUP = 0.75;
const POPULARITY_CAP = 35;
const LINEUP_BONUS_MIN_ARTISTS = 2;
const MAX_ARTIST_TAGS = 5;
const MAX_ARTIST_IDS = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------------------------
// Upstream shapes (the subset read here)

export type MbArea = {
  id?: string;
  name?: string | null;
  type?: string | null;
  "iso-3166-1-codes"?: string[] | null;
  "iso-3166-2-codes"?: string[] | null;
};
export type MbAreaLookup = MbArea & { relations?: MbRelation[] | null };
export type MbPlace = {
  id?: string;
  name?: string | null;
  type?: string | null;
  address?: string | null;
  area?: MbArea | null;
  coordinates?: { latitude?: number | string | null; longitude?: number | string | null } | null;
};
export type MbArtist = { id?: string; name?: string | null; type?: string | null; country?: string | null };
export type MbRelation = {
  type?: string | null;
  "target-type"?: string | null;
  direction?: string | null;
  place?: MbPlace | null;
  artist?: MbArtist | null;
  area?: MbArea | null;
  url?: { id?: string; resource?: string | null } | null;
};
export type MbEvent = {
  id: string;
  type?: string | null;
  name?: string | null;
  disambiguation?: string | null;
  "life-span"?: { begin?: string | null; end?: string | null; ended?: boolean | null } | null;
  time?: string | null;
  cancelled?: boolean | null;
  relations?: MbRelation[] | null;
  score?: number;
  setlist?: string | null;
};
export type MbSearch = { created?: string; count?: number; offset?: number; events?: MbEvent[] };
export type MbBrowse = { "event-count"?: number; "event-offset"?: number; events?: MbEvent[] };

// ---------------------------------------------------------------------------------------------
// Dates

export type MbDate = { date: string; precision: IngestPrecision };

/** `life-span.begin` (`YYYY-MM-DD` | `YYYY-MM` | `YYYY`) → catalog date (first day of the period) + precision. */
export function mbDate(s: string | null | undefined): MbDate | null {
  const v = String(s ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return { date: v, precision: "day" };
  if (/^\d{4}-\d{2}$/.test(v)) return { date: `${v}-01`, precision: "month" };
  if (/^\d{4}$/.test(v)) return { date: `${v}-01-01`, precision: "year" };
  return null;
}

/** `life-span.end` → last calendar day it covers, or null. */
export function mbEndDate(s: string | null | undefined): string | null {
  const d = mbDate(s);
  if (!d) return null;
  return periodEnd(d.date, d.precision);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function fmtRange(start: string, end: string): string {
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  if (y1 === y2 && m1 === m2) return `${d1}–${d2} ${MONTHS[m1 - 1]} ${y1}`;
  if (y1 === y2) return `${d1} ${MONTHS[m1 - 1]} to ${d2} ${MONTHS[m2 - 1]} ${y1}`;
  return `${fmtDay(start)} to ${fmtDay(end)}`;
}

/** Latest of two `YYYY-MM-DD` strings (either may be null). */
function laterDay(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

// ---------------------------------------------------------------------------------------------
// Titles

/** `\d{1,2}`, never `\d+`: "Field Day 2027" / "Canada Day 2027" are names, not fragments of a multi-day run. */
const FRAGMENT_RE = /(?:\s*[,:;–—-])?\s+day\s*\d{1,2}\b.*$/i;

/** "Rock in Rio 11, Day 5: Highway Stage" → { title: "Rock in Rio 11", fragment: true }. */
export function collapseTitle(name: string): { title: string; fragment: boolean } {
  const clean = sanitizeTitle(name);
  const collapsed = clean.replace(FRAGMENT_RE, "").trim();
  if (collapsed !== clean && collapsed.length >= 2) return { title: collapsed, fragment: true };
  return { title: clean, fragment: false };
}

// ---------------------------------------------------------------------------------------------
// Areas → countries

function alpha2(code: unknown): string | null {
  const c = String(code ?? "")
    .trim()
    .toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : null;
}

/** Country from an area's own ISO codes: 3166-1 directly, or the prefix of a 3166-2 subdivision code. */
export function countryFromArea(area: MbArea | null | undefined): string | null {
  if (!area) return null;
  for (const c of area["iso-3166-1-codes"] ?? []) {
    const cc = alpha2(c);
    if (cc) return cc;
  }
  for (const c of area["iso-3166-2-codes"] ?? []) {
    const cc = alpha2(String(c ?? "").split("-")[0]);
    if (cc) return cc;
  }
  return null;
}

/** ISO code of the country whose English name equals `name` (case-insensitive), else null. */
export function countryByName(name: string | null | undefined): string | null {
  const needle = String(name ?? "")
    .trim()
    .toLowerCase();
  if (needle.length < 3) return null;
  for (const [code, label] of Object.entries(COUNTRY_NAMES)) {
    if (code !== "GLOBAL" && label.toLowerCase() === needle) return code;
  }
  return null;
}

/** An area lookup with `inc=area-rels`: its own country, or the parent's, plus the parent id to walk further. */
export function countryFromAreaLookup(lookup: MbAreaLookup): { country: string | null; parentId: string | null } {
  const own = countryFromArea(lookup) ?? countryByName(lookup.name);
  if (own) return { country: own, parentId: null };
  const parents = (lookup.relations ?? []).filter((r) => r?.type === "part of" && r.direction === "backward" && r.area?.id);
  for (const p of parents) {
    const cc = countryFromArea(p.area) ?? countryByName(p.area?.name);
    if (cc) return { country: cc, parentId: p.area!.id! };
  }
  return { country: null, parentId: parents[0]?.area?.id ?? null };
}

/** Area id → ISO country ('' = looked up, unresolved). Persisted in the lookup-stage cursor. */
export type AreaCache = Record<string, string>;

export type CountryResolver = (area: MbArea | null | undefined) => Promise<string | null>;

/** Walks `part of` up to AREA_HOPS times through `ctx.http`, reading and filling `cache`. */
export function makeCountryResolver(ctx: IngestContext, cache: AreaCache): CountryResolver {
  const remember = (id: string, cc: string | null) => {
    if (id in cache || Object.keys(cache).length >= AREA_CACHE_MAX) return;
    cache[id] = cc ?? "";
  };
  return async (area) => {
    const direct = countryFromArea(area) ?? countryByName(area?.name);
    if (direct) return direct;
    let id = area?.id;
    const visited: string[] = [];
    for (let hop = 0; hop < AREA_HOPS && id && UUID_RE.test(id); hop++) {
      if (id in cache) {
        const cc = cache[id] || null;
        for (const v of visited) remember(v, cc);
        return cc;
      }
      visited.push(id);
      let lookup: MbAreaLookup | null;
      try {
        lookup = await mbGet<MbAreaLookup>(ctx, `${MB_BASE}/area/${id}?inc=area-rels&fmt=json`);
      } catch (err) {
        if (isBudgetExceeded(err)) throw err;
        // A stuck area request must not cost the event its row: fall back to GLOBAL, cache nothing.
        ctx.log.warn(`area ${id}: ${(err as Error)?.message ?? err}; region left unresolved`);
        return null;
      }
      if (!lookup) break;
      const { country, parentId } = countryFromAreaLookup(lookup);
      if (country) {
        for (const v of visited) remember(v, country);
        return country;
      }
      id = parentId ?? undefined;
    }
    for (const v of visited) remember(v, null);
    return null;
  };
}

// ---------------------------------------------------------------------------------------------
// HTTP

/**
 * `ctx.http.fetchJson` with two MusicBrainz specifics: a 404 (deleted/merged event) yields null
 * instead of failing the unit, and a 503 "server busy" that survived the HTTP layer's retries gets
 * one more attempt after `busyBackoffMs` when the budget allows it.
 */
export async function mbGet<T>(ctx: IngestContext, url: string, busyBackoffMs = MB_BUSY_BACKOFF_MS): Promise<T | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await ctx.http.fetchJson<T>(url);
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) {
        ctx.log.warn(`404 from MusicBrainz: ${url}`);
        return null;
      }
      const busy = err instanceof HttpError && err.status === 503;
      if (!busy || attempt > 0 || ctx.budget.remainingMs() < busyBackoffMs + 25_000) throw err;
      ctx.log.warn(`MusicBrainz busy (503); pausing ${Math.round(busyBackoffMs / 1000)} s before one more attempt`, { url });
      await sleep(busyBackoffMs);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Rows

export type Stage = "search" | "lookup";

export type RowOptions = {
  now: Date;
  stage: Stage;
  /** Latest sibling end date when the event stands in for a fragment group. */
  endOverride?: string | null;
  /** Async country resolution (lookup stage); the search stage has no area to resolve. */
  countryFor?: CountryResolver;
  log?: IngestContext["log"];
};

type Parsed = {
  id: string;
  title: string;
  fragment: boolean;
  type: string;
  begin: MbDate;
  end: string | null;
  places: MbPlace[];
  heldIn: MbArea | null;
  artists: MbArtist[];
  ticketUrl: string | null;
};

const MAIN_ROLES = new Set(["main performer", "headliner"]);

function artistOrder(rels: MbRelation[]): MbArtist[] {
  const main: MbArtist[] = [];
  const other: MbArtist[] = [];
  const seen = new Set<string>();
  for (const r of rels) {
    const a = r.artist;
    const id = a?.id;
    if (!a || !id || !UUID_RE.test(id) || seen.has(id) || !String(a.name ?? "").trim()) continue;
    seen.add(id);
    (MAIN_ROLES.has(String(r.type ?? "").toLowerCase()) ? main : other).push(a);
  }
  const byName = (x: MbArtist, y: MbArtist) => String(x.name).localeCompare(String(y.name)) || String(x.id).localeCompare(String(y.id));
  return [...main.sort(byName), ...other.sort(byName)];
}

/**
 * Validates and reads the fields every row needs. Null when the event is unusable or filtered:
 * bad id/name, unparseable `begin`, past, beyond the horizon, or a title naming another year.
 */
export function parseEvent(ev: MbEvent, now: Date, log?: IngestContext["log"]): Parsed | null {
  const id = String(ev?.id ?? "").trim();
  if (!UUID_RE.test(id)) return null;
  const rawName = String(ev.name ?? "").trim();
  const { title, fragment } = collapseTitle(rawName);
  if (title.length < 2 || UUID_RE.test(title)) return null;
  const begin = mbDate(ev["life-span"]?.begin);
  if (!begin) {
    log?.info(`${id} (${title}): no usable begin date`);
    return null;
  }
  const year = Number(begin.date.slice(0, 4));
  if (!labelYearConsistent(rawName, year)) {
    log?.info(`${id} (${rawName}): title year ≠ ${year}; dropped`);
    return null;
  }
  if (!isFutureOrFar(begin.date, begin.precision, now)) return null;
  const horizon = new Date(now.getTime());
  horizon.setUTCFullYear(horizon.getUTCFullYear() + HORIZON_YEARS);
  if (Date.parse(`${begin.date}T00:00:00Z`) > horizon.getTime()) return null;
  const rels = (ev.relations ?? []).filter((r): r is MbRelation => Boolean(r && typeof r === "object"));
  const places = rels.filter((r) => String(r.type ?? "").toLowerCase() === "held at" && r.place?.id && UUID_RE.test(r.place.id)).map((r) => r.place!);
  const heldIn = rels.find((r) => String(r.type ?? "").toLowerCase() === "held in" && r.area?.id)?.area ?? null;
  const ticket = rels.find((r) => String(r.type ?? "").toLowerCase() === "ticketing" && /^https?:\/\//.test(String(r.url?.resource ?? "")));
  return {
    id,
    title,
    fragment,
    type: String(ev.type ?? "").trim() || "Event",
    begin,
    end: mbEndDate(ev["life-span"]?.end),
    places,
    heldIn,
    artists: artistOrder(rels),
    ticketUrl: ticket?.url?.resource ?? null,
  };
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function compact(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined && v !== ""));
}

function trimArea(a: MbArea | null | undefined): Record<string, unknown> | undefined {
  if (!a) return undefined;
  return compact({ id: a.id, name: a.name, type: a.type, "iso-3166-1-codes": a["iso-3166-1-codes"] ?? undefined, "iso-3166-2-codes": a["iso-3166-2-codes"] ?? undefined });
}

/** Whitelist of CC0 core fields: never tags, ratings, aliases, genres or annotations. */
export function trimRaw(ev: MbEvent): Record<string, unknown> {
  return compact({
    id: ev.id,
    type: ev.type,
    name: ev.name,
    disambiguation: ev.disambiguation,
    "life-span": ev["life-span"],
    time: ev.time,
    cancelled: typeof ev.cancelled === "boolean" ? ev.cancelled : undefined,
    relations: (ev.relations ?? []).map((r) =>
      compact({
        type: r.type,
        direction: r.direction,
        place: r.place
          ? compact({ id: r.place.id, name: r.place.name, type: r.place.type, address: r.place.address, area: trimArea(r.place.area), coordinates: r.place.coordinates ?? undefined })
          : undefined,
        artist: r.artist ? compact({ id: r.artist.id, name: r.artist.name, type: r.artist.type }) : undefined,
        area: trimArea(r.area),
        url: r.url?.resource ? { resource: r.url.resource } : undefined,
      }),
    ),
  });
}

/** Festival 30, anything else 20, +10 with a line-up of ≥ 2 artists; capped at 35 (home listing floor is 30). */
export function popularityFor(type: string, artists: number): number {
  let p = type.toLowerCase() === "festival" ? 30 : 20;
  if (artists >= LINEUP_BONUS_MIN_ARTISTS) p += 10;
  return clamp(p, 0, POPULARITY_CAP);
}

function describe(p: Parsed, place: MbPlace | null, city: string | null, country: string | null, cancelled: boolean, end: string | null): string {
  const kind = p.type.toLowerCase() === "festival" ? "music festival" : `${p.type.toLowerCase()} event`;
  const countryName = country ? COUNTRY_NAMES[country] : null;
  const placeName = sanitizeTitle(place?.name ?? "");
  const where = placeName
    ? ` at ${placeName}${city && city !== placeName ? ` in ${city}` : ""}${countryName ? `, ${countryName}` : ""}`
    : city
      ? ` in ${city}${countryName ? `, ${countryName}` : ""}`
      : countryName
        ? ` in ${countryName}`
        : "";
  const lead = `${p.title} is a ${kind}${where}.`;
  let when: string;
  if (p.begin.precision === "day") {
    when = end && end > p.begin.date ? `It runs from ${fmtRange(p.begin.date, end)}.` : `It takes place on ${fmtDay(p.begin.date)}.`;
  } else if (p.begin.precision === "month") {
    const [y, m] = p.begin.date.split("-").map(Number);
    when = `It is expected in ${MONTHS[m - 1]} ${y}; the exact dates have not been announced yet.`;
  } else {
    when = `It is expected in ${p.begin.date.slice(0, 4)}; no exact date has been announced yet.`;
  }
  const names = p.artists.map((a) => sanitizeTitle(String(a.name))).filter(Boolean);
  let lineup = "";
  if (names.length) {
    const shown = names.slice(0, 3);
    const more = names.length - shown.length;
    const list = shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}` : shown[0];
    lineup = more > 0 ? ` The line-up includes ${list} and ${more} more act${more > 1 ? "s" : ""}.` : ` The line-up includes ${list}.`;
  }
  const status = cancelled ? " This edition has been cancelled." : "";
  return `${lead} ${when}${lineup}${status}`;
}

/** Country readable from the event itself (ISO codes or an exact country name on the place/held-in area). */
function directCountry(p: Parsed): string | null {
  const place = p.places[0] ?? null;
  const area = place?.area ?? p.heldIn;
  return countryFromArea(place?.area) ?? countryFromArea(p.heldIn) ?? countryByName(area?.name);
}

/** One catalog row from a search hit or a lookup, resolving the country through `opts.countryFor` when needed. */
export async function eventToRow(ev: MbEvent, opts: RowOptions): Promise<IngestEvent | null> {
  const p = parseEvent(ev, opts.now, opts.log);
  if (!p) return null;
  let country = directCountry(p);
  if (!country && opts.countryFor) country = (await opts.countryFor(p.places[0]?.area)) ?? (await opts.countryFor(p.heldIn));
  return eventRow(ev, { ...opts, country });
}

/** Synchronous row builder; `country` is the resolved ISO code (null → GLOBAL). Null when `parseEvent` rejects the event. */
export function eventRow(ev: MbEvent, opts: Omit<RowOptions, "countryFor"> & { country?: string | null }): IngestEvent | null {
  const p = parseEvent(ev, opts.now, opts.log);
  if (!p) return null;
  const place = p.places[0] ?? null;
  const area = place?.area ?? p.heldIn;
  const country = opts.country ?? directCountry(p);
  const city = sanitizeTitle(area?.name ?? "") || null;
  const cancelled = ev.cancelled === true;
  const end = laterDay(p.end, opts.endOverride ?? null);
  const category: Category = p.type.toLowerCase() === "festival" ? "festivals" : "music";
  const tags = ["music", p.type.toLowerCase(), "musicbrainz", ...p.artists.slice(0, MAX_ARTIST_TAGS).map((a) => String(a.name))];
  if (isFarFuture(p.begin.date, tags, opts.now)) return null;
  const status: IngestStatus | undefined = cancelled ? "cancelled" : undefined;
  const location = place
    ? compact({
        name: sanitizeTitle(place.name ?? "") || null,
        city,
        country,
        lat: num(place.coordinates?.latitude),
        lng: num(place.coordinates?.longitude),
        url: `${MB_WEB}/place/${place.id}`,
        tickets: p.ticketUrl,
      })
    : city
      ? compact({ city, country, tickets: p.ticketUrl })
      : null;
  const row = buildEvent({
    title: p.title,
    date: p.begin.date,
    // A single-day event gets no end_date (house convention): it would only pad content_hash, the
    // schema.org endDate and the calendar builders with the start date.
    endDate: end && end > p.begin.date ? end : null,
    category,
    tags,
    regions: country ? [country] : ["GLOBAL"],
    description: describe(p, place, city, country, cancelled, end),
    source: SOURCE,
    sourceUrl: `${MB_WEB}/event/${p.id}`,
    sourceKey: `${SOURCE}:event:${p.id}`,
    popularity: popularityFor(p.type, p.artists.length),
    datePrecision: p.begin.precision,
    status,
    confidence: opts.stage === "lookup" ? CONFIDENCE_LOOKUP : CONFIDENCE_SEARCH,
    externalIds: compact({
      mbid: p.id,
      place_mbid: place?.id,
      artist_mbids: p.artists.length ? p.artists.map((a) => String(a.id)).sort().slice(0, MAX_ARTIST_IDS) : undefined,
    }),
    // Search stage: a `{name, url}` location without address or geo is worse than none — the SQL
    // merge keeps the first non-null one, so it would block the enriched location for good.
    location: opts.stage === "lookup" && location && Object.keys(location).length ? location : null,
    timezone: null,
    raw: trimRaw(ev),
  });
  // `jsonld_eligible` is a sticky OR in the merge and `cancelled` only exists on a lookup, so a
  // search hit is never eligible; a lookup needs a place, a country (schema.org address) and no
  // cancellation. Matches confs.ts / wikipedia-categories.ts.
  row.jsonld_eligible = opts.stage === "lookup" && Boolean(place) && Boolean(country) && !cancelled;
  return row;
}

/** A queued event: `hit` is the trimmed search payload, the stage-2 fallback when the lookup fails. */
export type Candidate = { id: string; end?: string; rank: number; hit?: MbEvent };

/** The core fields of a search hit, small enough to ride in the cursor; undefined when it is not. */
export function packHit(ev: MbEvent): MbEvent | undefined {
  const trimmed = trimRaw(ev) as MbEvent;
  return JSON.stringify(trimmed).length <= MAX_HIT_BYTES ? trimmed : undefined;
}

/**
 * Rows for one search page: fragments ("<name>, Day N") collapse to their parent — the parent
 * event when the page has it, else the earliest fragment with the latest sibling end — and the
 * lookup candidates are the surviving rows, ranked by popularity then date. The caller withholds
 * the rows of the candidates it queues for stage 2 (`emitOnly`), so no event is emitted twice.
 */
export function searchToRows(events: MbEvent[], now: Date, log?: IngestContext["log"]): { rows: IngestEvent[]; candidates: Candidate[] } {
  type Group = { parents: MbEvent[]; fragments: Array<{ ev: MbEvent; p: Parsed }> };
  const groups = new Map<string, Group>();
  for (const ev of events) {
    const p = parseEvent(ev, now, log);
    if (!p) continue;
    // Title + year: two editions of a festival without a year in its name stay apart.
    const key = `${p.title.toLowerCase()}|${p.begin.date.slice(0, 4)}`;
    const g = groups.get(key) ?? { parents: [], fragments: [] };
    if (p.fragment) g.fragments.push({ ev, p });
    else g.parents.push(ev);
    groups.set(key, g);
  }
  const picks: Array<{ ev: MbEvent; endOverride: string | null }> = [];
  for (const g of groups.values()) {
    if (g.parents.length) {
      for (const ev of g.parents) picks.push({ ev, endOverride: null });
      continue;
    }
    const sorted = [...g.fragments].sort((a, b) => a.p.begin.date.localeCompare(b.p.begin.date) || a.ev.id.localeCompare(b.ev.id));
    let endOverride: string | null = null;
    for (const f of sorted) endOverride = laterDay(endOverride, f.p.end ?? f.p.begin.date);
    picks.push({ ev: sorted[0].ev, endOverride });
  }
  const rows: IngestEvent[] = [];
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  for (const { ev, endOverride } of picks) {
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    const row = eventRow(ev, { now, stage: "search", endOverride, log });
    if (!row) continue;
    rows.push(row);
    const hit = packHit(ev);
    candidates.push({ id: ev.id, ...(endOverride && endOverride > row.date ? { end: endOverride } : {}), rank: row.popularity, ...(hit ? { hit } : {}) });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.source_key.localeCompare(b.source_key));
  return { rows, candidates };
}

/** Highest popularity first, then soonest; ties by mbid. Capped at `cap` (LOOKUP_CAP by default). */
export function rankCandidates(all: Candidate[], rowDates?: Map<string, string>, cap = LOOKUP_CAP): Candidate[] {
  const seen = new Set<string>();
  const uniq = all.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  return uniq
    .sort((a, b) => b.rank - a.rank || (rowDates?.get(a.id) ?? "").localeCompare(rowDates?.get(b.id) ?? "") || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, cap));
}

// ---------------------------------------------------------------------------------------------
// Plan / cursor

export function searchUrl(now: Date, offset: number): string {
  const from = now.toISOString().slice(0, 10);
  const to = new Date(now.getTime());
  to.setUTCFullYear(to.getUTCFullYear() + HORIZON_YEARS);
  const q = `type:Festival AND begin:[${from} TO ${to.toISOString().slice(0, 10)}]`;
  return `${MB_BASE}/event/?query=${encodeURIComponent(q)}&fmt=json&limit=${SEARCH_PAGE}&offset=${offset}`;
}

export function lookupUrl(mbid: string): string {
  return `${MB_BASE}/event/${mbid}?inc=${LOOKUP_INC}&fmt=json`;
}

export type Cursor =
  /** `seen`: mbids already emitted or queued by an earlier page of this pass (search paging overlaps). */
  | { stage: "search"; offset: number; queue: Candidate[]; seen: string[] }
  | { stage: "lookup"; queue: Candidate[]; areas: AreaCache };

function isCandidate(v: unknown): v is Candidate {
  const c = v as Candidate;
  if (!c || typeof c !== "object" || typeof c.id !== "string" || !UUID_RE.test(c.id) || typeof c.rank !== "number") return false;
  if (c.end !== undefined && typeof c.end !== "string") return false;
  return c.hit === undefined || (typeof c.hit === "object" && c.hit !== null && !Array.isArray(c.hit) && typeof (c.hit as MbEvent).id === "string");
}

function stringMap(v: unknown): Record<string, string> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => typeof x === "string")) as Record<string, string>;
}

export function parseCursor(cursor: Json | null): Cursor {
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    const c = cursor as Record<string, unknown>;
    const queue = Array.isArray(c.queue) ? c.queue.filter(isCandidate) : [];
    if (c.stage === "lookup") return { stage: "lookup", queue, areas: stringMap(c.areas) };
    if (c.stage === "search" && typeof c.offset === "number" && c.offset >= 0 && Number.isInteger(c.offset)) {
      const seen = Array.isArray(c.seen) ? c.seen.filter((s): s is string => typeof s === "string" && UUID_RE.test(s)) : [];
      return { stage: "search", offset: c.offset, queue, seen };
    }
  }
  return { stage: "search", offset: 0, queue: [], seen: [] };
}

export type MbUnit = Unit & {
  stage: Stage;
  /** search: this page's offset. */
  offset?: number;
  /** search: how many hits of this page may be withheld for stage 2 (LOOKUP_CAP minus what is queued). */
  allowance?: number;
  /** search: mbids handled by an earlier page of this pass — MusicBrainz search paging overlaps. */
  seen?: string[];
  /** Set by run(): search → mbids emitted by this unit (added to `seen`). */
  emitted?: string[];
  /** lookup: the events of this unit. */
  batch?: Candidate[];
  /** Set by run(): search → last page seen + the withheld candidates; lookup → area cache after this unit. */
  last?: boolean;
  found?: Candidate[];
  areasOut?: AreaCache;
};

function lookupCursor(queue: Candidate[], areas: AreaCache): Json {
  return { stage: "lookup", queue: queue as unknown as Json, areas };
}

export const adapter: Adapter<MbUnit> = {
  id: SOURCE,
  label: "MusicBrainz festival events",
  rank: 4,
  cadence: "weekly",
  isConfigured: () => true,
  limits: { concurrency: 1, minIntervalMs: 3000, timeoutMs: 15_000, maxRetries: 2 },

  async plan(cursor): Promise<Plan<MbUnit>> {
    const c = parseCursor(cursor);
    if (c.stage === "search") {
      const { offset, queue, seen } = c;
      const unit: MbUnit = {
        key: `musicbrainz:search:festival:${offset}`,
        label: `festival search offset ${offset}`,
        stage: "search",
        offset,
        allowance: Math.min(LOOKUP_PER_PAGE, Math.max(0, LOOKUP_CAP - queue.length)),
        seen,
        last: false,
        found: [],
        emitted: [],
        // Read by the runner after run(): next page, or the lookup queue when this page was the last.
        get after(): Json {
          const all = [...queue, ...(this.found ?? [])];
          const nextOffset = offset + SEARCH_PAGE;
          if (this.last || nextOffset >= SEARCH_PAGE * MAX_SEARCH_PAGES) return lookupCursor(all, {});
          const nextSeen = [...seen, ...(this.emitted ?? []), ...(this.found ?? []).map((c) => c.id)].slice(-SEEN_MAX);
          return { stage: "search", offset: nextOffset, queue: all as unknown as Json, seen: nextSeen };
        },
      };
      return {
        units: [unit],
        done: false,
        get nextCursor(): Json {
          return unit.after;
        },
      };
    }
    const { queue, areas } = c;
    if (queue.length === 0) return { units: [], done: true };
    const batch = queue.slice(0, LOOKUP_BATCH);
    const rest = queue.slice(batch.length);
    const unit: MbUnit = {
      key: `musicbrainz:lookup:${batch.map((b) => b.id.slice(0, 8)).join("+")}`,
      label: `lookup ${batch.length} event(s) (${rest.length} queued after)`,
      stage: "lookup",
      batch,
      areasOut: { ...areas },
      get after(): Json {
        return lookupCursor(rest, this.areasOut ?? areas);
      },
    };
    return {
      units: [unit],
      done: false,
      get nextCursor(): Json {
        return unit.after;
      },
    };
  },

  async run(unit, ctx) {
    if (unit.stage === "search") {
      const offset = unit.offset ?? 0;
      const page = (await mbGet<MbSearch>(ctx, searchUrl(ctx.now, offset))) ?? {};
      const events = Array.isArray(page.events) ? page.events : [];
      const count = typeof page.count === "number" ? page.count : 0;
      unit.last = events.length < SEARCH_PAGE || offset + events.length >= count;
      const all = searchToRows(events, ctx.now, ctx.log);
      // Verified live: MusicBrainz search paging overlaps (9 of the 13 rows of page 2 repeated
      // page 1), so a hit an earlier page already handled is dropped here — re-emitting it would
      // be harmless, but re-*withholding* one that was already emitted would give the pass two
      // rows for one source_key, and the SQL merge would union their regions.
      const seen = new Set(unit.seen ?? []);
      const rows = all.rows.filter((r) => !seen.has(String(r.external_ids.mbid)));
      const candidates = all.candidates.filter((c) => !seen.has(c.id));
      // The best remaining hits are withheld: stage 2 emits them once, enriched. Everything else is
      // emitted now — one row per event per pass, so the merge never sees two of our rows.
      const dates = new Map(rows.map((r) => [String(r.external_ids.mbid), r.date]));
      const withheld = rankCandidates(candidates, dates, unit.allowance ?? 0);
      const queued = new Set(withheld.map((c) => c.id));
      unit.found = withheld;
      const emitted = rows.filter((r) => !queued.has(String(r.external_ids.mbid)));
      unit.emitted = emitted.map((r) => String(r.external_ids.mbid));
      ctx.log.info(
        `${unit.label}: ${events.length} hits of ${count}, ${emitted.length} rows emitted, ${withheld.length} withheld for lookup` +
          (all.rows.length - rows.length > 0 ? `, ${all.rows.length - rows.length} already seen this pass` : ""),
      );
      return emitted;
    }
    const areas: AreaCache = unit.areasOut ?? {};
    const countryFor = makeCountryResolver(ctx, areas);
    const rows: IngestEvent[] = [];
    let failures = 0;
    let fallbacks = 0;
    let lastError: unknown = null;
    const batch = unit.batch ?? [];
    for (const cand of batch) {
      let ev: MbEvent | null;
      try {
        ev = await mbGet<MbEvent>(ctx, lookupUrl(cand.id));
      } catch (err) {
        if (isBudgetExceeded(err)) throw err;
        // MusicBrainz stalls on single requests when busy. The search stage withheld this event's
        // row, so fall back to the cached hit (search quality, no location/eligibility) instead of
        // losing it for the pass; one stuck lookup never fails the other events of the unit.
        failures++;
        lastError = err;
        const fallback = cand.hit ? eventRow(cand.hit, { now: ctx.now, stage: "search", endOverride: cand.end ?? null, log: ctx.log }) : null;
        if (fallback) {
          rows.push(fallback);
          fallbacks++;
        }
        ctx.log.warn(`${cand.id}: lookup failed (${(err as Error)?.message ?? err}); ${fallback ? "emitting the cached search hit" : "no cached hit, skipped"}`);
        continue;
      }
      if (!ev) continue; // 404: deleted or merged upstream — nothing to emit.
      const row = await eventToRow(ev, { now: ctx.now, stage: "lookup", endOverride: cand.end ?? null, countryFor, log: ctx.log });
      if (row) rows.push(row);
      else ctx.log.info(`${cand.id}: dropped after lookup`);
    }
    unit.areasOut = areas;
    if (failures > 0 && failures === batch.length && rows.length === 0) {
      // Every lookup failed and nothing could be emitted: surface it so the runner retries the unit.
      throw lastError instanceof Error ? lastError : new Error(`all ${failures} lookups failed`);
    }
    ctx.log.info(
      `${unit.label}: ${rows.length} rows (${fallbacks} from cached hits), ${failures} lookup failure(s), ${Object.keys(areas).length} area(s) cached`,
    );
    return rows;
  },
};
