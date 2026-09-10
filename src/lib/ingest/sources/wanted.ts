import type { WdEntitiesResponse, WdEntity } from "./wikipedia-categories/wikidata";
import type { Adapter, IngestContext, IngestEvent, Json, Plan, Unit } from "../types";
import { supabaseWantedDb, type WantedDb } from "./wanted/db";
import {
  buildWantedEvent,
  COUNTRY_ISO,
  FALLTHROUGH_REASONS,
  isoFromClaims,
  normalizeQuery,
  readEntity,
  searchHash,
  topQidsFromSearch,
  topQidFromWbSearch,
  wbClaimsUrl,
  wbEntitiesUrl,
  wbSearchUrl,
  wikipediaSearchUrl,
  type Resolved,
  type WbClaimsResponse,
  type WbSearchResponse,
  type WpSearchResponse,
} from "./wanted/resolve";

/**
 * Search-demand driven discovery (source `wanted`, rank 1). Zero-result site searches
 * (`search_log`, written by the anon-callable `log_search()`) are grouped, and the queries asked
 * at least 3 times in 30 days are resolved to a Wikidata item with a future date:
 *
 *   1. English Wikipedia `generator=search` + `prop=pageprops` → the top 3 non-disambiguation hits'
 *      QIDs (fallback: `wbsearchentities` top hit when Wikipedia has no article at all);
 *   2. `wbgetentities` (claims, English label, enwiki sitelink) for the unit's QIDs in one call;
 *   3. first future claim among P585 / P580 / P577 / P619 with precision ≥ 9 → `date` + precision;
 *      P17 → ISO code (seed map, else one `wbgetclaims` P297 lookup per country, cached per run).
 *
 * Step 2/3 walk the hits in search-rank order and take the first that resolves, because the vague
 * queries this adapter exists for often rank stale siblings first ("next total solar eclipse" put
 * two past eclipses above the next one on 2026-09-09). The walk stops — it does not fall through —
 * on a `label-year` or `bare-qid` rejection, which mean the right item was found but its label is
 * inconsistent; falling through there would pick a sibling (hit 2 for "eurovision 2027" is
 * "Melodifestivalen 2027"). See `FALLTHROUGH_REASONS`.
 *
 * Rows are `status = 'tentative'`, `confidence = 0.5` (never indexable, by design — a real adapter
 * or curation has to confirm them), popularity `min(35, 25 + min(20, n))` (the §0 cap; see
 * `buildWantedEvent` for why the brief's uncapped 45 is not used), `source_key = wanted:<QID>`,
 * provenance tag `wanted`. The query text is potential PII: only `sha1(normalised query)` is
 * stored (`external_ids.search_hash` and the cursor's `tried` map), never the text. (The raw query
 * does still travel in the request URL and can land in a retry log line — see the doc comment on
 * `wanted/resolve.ts`.)
 *
 * Filters: query length 3–80; queries that now return results (`search_events`) are skipped;
 * QIDs already present in `events.external_ids->>'qid'` (any source) are skipped; an enwiki
 * sitelink is required; label-year check; dates inside [now − 2 d, now + 15 y].
 *
 * Units: ≤ 25 candidates per pass split into units of 5 queries; the unit key is content-addressed
 * (`wanted:<day>:<sha1 prefix of its first query>`) and `after` is the cumulative `tried` map
 * (`{ tried: { <sha1>: 'YYYY-MM-DD' } }`). Requests: ≤ 16 per unit (≤ 80 per pass) — worst case
 * 5×2 resolves + 1 `wbgetentities` + 5 country lookups; a unit that needs more region lookups than
 * that logs a warning rather than silently emitting `GLOBAL`.
 *
 * CAVEAT — the 30-day no-retry is aspirational in production today. The brief asks for misses to
 * be remembered in the cursor and not retried for 30 days; `parseCursor` / `planUnits` implement
 * exactly that and it works across a budget-cut (`partial`) pass, but `src/lib/ingest/run.ts` sets
 * `cursor = null` whenever a pass ends `ok` and persists that, so on the normal daily path the
 * `tried` map is discarded and every candidate query is re-resolved from scratch: ~25
 * `search_events` RPCs plus up to ~50 Wikimedia requests per day spent re-confirming permanent
 * misses. Fixing it needs an orchestrator change (an opt-in `persistentCursor` flag on the Adapter
 * contract, or an `ingest_state.memory` column) — see the adapter's report.
 *
 * Wikimedia etiquette: one request at a time, 500 ms spacing, descriptive User-Agent (`ctx.http`).
 * WDQS is deliberately not used here. No third-party trend or search-suggest API feeds this
 * adapter — the only demand signal is the site's own `search_log` (see the Phase 4 brief §20 for
 * the rejected external sources).
 */

export const WINDOW_DAYS = 30;
export const MIN_HITS = 3;
export const MAX_CANDIDATES = 25;
export const UNIT_SIZE = 5;
/**
 * Worst case for one production unit: `UNIT_SIZE`×2 resolve requests (Wikipedia search + the
 * Wikibase fallback) + 1 `wbgetentities` + `UNIT_SIZE` P297 lookups for rows whose country is not
 * in the seed map = 5×2 + 1 + 5. Sized so a full unit can never be forced to drop a region.
 */
export const MAX_REQUESTS_PER_UNIT = UNIT_SIZE * 2 + 1 + UNIT_SIZE;
const LOG_ROWS_LIMIT = 5000;
/** `wbgetentities` accepts 50 ids; one unit resolves at most `UNIT_SIZE * SEARCH_HITS` = 15. */
const ENTITY_BATCH = 50;
const QUERY_MIN = 3;
const QUERY_MAX = 80;

export type Tried = Record<string, string>;
export type WantedCandidate = { q: string; n: number; hash: string };
export type WantedUnit = Unit & {
  queries: WantedCandidate[];
  /** Hashes actually attempted by `run()` (a query left behind by the request cap is not one of them). */
  attempted: string[];
};

const HASH_RE = /^[0-9a-f]{40}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function dayOf(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function daysAgoIso(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

/** `{ tried }` from the persisted cursor, entries older than `WINDOW_DAYS` pruned; anything else → empty. */
export function parseCursor(cursor: Json | null, now: Date): Tried {
  const out: Tried = {};
  if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return out;
  const tried = (cursor as { tried?: unknown }).tried;
  if (!tried || typeof tried !== "object" || Array.isArray(tried)) return out;
  const cutoff = daysAgoIso(now, WINDOW_DAYS).slice(0, 10);
  for (const [hash, day] of Object.entries(tried as Record<string, unknown>)) {
    if (HASH_RE.test(hash) && typeof day === "string" && DAY_RE.test(day) && day >= cutoff) out[hash] = day;
  }
  return out;
}

/**
 * Group zero-result queries by their normalised text, keep those asked ≥ `MIN_HITS` times, 3–80
 * characters long and not in `tried`; most-asked first (ties by hash so the order is stable).
 */
export function aggregateQueries(rows: readonly string[], tried: Tried, max = MAX_CANDIDATES): WantedCandidate[] {
  const counts = new Map<string, { q: string; n: number }>();
  for (const raw of rows) {
    const q = normalizeQuery(raw);
    if (q.length < QUERY_MIN || q.length > QUERY_MAX) continue;
    const entry = counts.get(q);
    if (entry) entry.n++;
    else counts.set(q, { q, n: 1 });
  }
  const out: WantedCandidate[] = [];
  for (const { q, n } of counts.values()) {
    if (n < MIN_HITS) continue;
    const hash = searchHash(q);
    if (tried[hash]) continue;
    out.push({ q, n, hash });
  }
  out.sort((a, b) => b.n - a.n || (a.hash < b.hash ? -1 : 1));
  return out.slice(0, max);
}

/** Units of `size` candidates; `after` of unit k = `tried` ∪ everything attempted by units 0..k, dated `day`. */
export function planUnits(candidates: readonly WantedCandidate[], tried: Tried, day: string, size = UNIT_SIZE): WantedUnit[] {
  const units: WantedUnit[] = [];
  for (let start = 0; start < candidates.length; start += size) {
    const queries = candidates.slice(start, start + size);
    const index = units.length;
    units.push({
      key: `wanted:${day}:${queries[0].hash.slice(0, 12)}`,
      label: `queries ${start + 1}–${start + queries.length} of ${candidates.length}`,
      queries,
      attempted: [],
      get after(): Json {
        const next: Tried = { ...tried };
        for (let i = 0; i <= index; i++) for (const h of units[i].attempted) next[h] = day;
        return { tried: next };
      },
    });
  }
  return units;
}

/** Per-unit request counter; `take()` is false once the cap is reached. */
class RequestBudget {
  used = 0;
  constructor(private readonly cap: number) {}
  take(): boolean {
    if (this.used >= this.cap) return false;
    this.used++;
    return true;
  }
  get left(): number {
    return this.cap - this.used;
  }
}

/** Country QID → ISO, memoised for the life of the process (a Wikidata country's P297 does not change). */
const countryCache = new Map<string, string | null>(Object.entries(COUNTRY_ISO));

/** `{ ok: false }` means the request cap stopped the lookup — NOT that the country has no P297. */
type IsoLookup = { ok: true; iso: string | null } | { ok: false };

async function countryIso(qid: string, ctx: IngestContext, budget: RequestBudget): Promise<IsoLookup> {
  const cached = countryCache.get(qid);
  if (cached !== undefined) return { ok: true, iso: cached };
  if (!budget.take()) return { ok: false };
  const res = await ctx.http.fetchJson<WbClaimsResponse>(wbClaimsUrl(qid, "P297"));
  const iso = isoFromClaims(res);
  countryCache.set(qid, iso);
  return { ok: true, iso };
}

/** Candidate QIDs for one query, best search hit first (see `topQidsFromSearch`). */
async function resolveQids(q: string, ctx: IngestContext, budget: RequestBudget): Promise<string[]> {
  if (!budget.take()) return [];
  const wp = await ctx.http.fetchJson<WpSearchResponse>(wikipediaSearchUrl(q));
  if (wp.error) throw new Error(`enwiki search error: ${wp.error.code ?? "?"} ${wp.error.info ?? ""}`.trim());
  const hits = topQidsFromSearch(wp);
  if (hits.length) return hits.map((h) => h.qid);
  // No article at all (or no hit carries an item): try the Wikibase label/alias search.
  if ((wp.query?.pages?.length ?? 0) > 0 || !budget.take()) return [];
  const wd = await ctx.http.fetchJson<WbSearchResponse>(wbSearchUrl(q));
  if (wd.error) throw new Error(`wbsearchentities error: ${wd.error.code ?? "?"} ${wd.error.info ?? ""}`.trim());
  const qid = topQidFromWbSearch(wd);
  return qid ? [qid] : [];
}

async function fetchEntities(qids: readonly string[], ctx: IngestContext, budget: RequestBudget): Promise<Map<string, WdEntity>> {
  const out = new Map<string, WdEntity>();
  for (let i = 0; i < qids.length; i += ENTITY_BATCH) {
    const batch = qids.slice(i, i + ENTITY_BATCH);
    if (!budget.take()) {
      ctx.log.warn(`request cap reached; ${qids.length - i} entities not fetched`);
      break;
    }
    const res = await ctx.http.fetchJson<WdEntitiesResponse>(wbEntitiesUrl(batch));
    if (res.error) throw new Error(`wbgetentities error: ${res.error.code ?? "?"} ${res.error.info ?? ""}`.trim());
    for (const [id, e] of Object.entries(res.entities ?? {})) out.set(id, e);
  }
  return out;
}

export function isConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY));
}

export type WantedDeps = { db: WantedDb };

export function createWantedAdapter(deps: WantedDeps): Adapter<WantedUnit> {
  return {
    id: "wanted",
    label: "Search demand (Wikidata resolve)",
    rank: 1,
    cadence: "daily",
    isConfigured: () => isConfigured(),
    limits: { concurrency: 1, minIntervalMs: 500, timeoutMs: 20_000, maxRetries: 2 },

    async plan(cursor, ctx): Promise<Plan<WantedUnit>> {
      const tried = parseCursor(cursor, ctx.now);
      const rows = await deps.db.zeroResultQueries(daysAgoIso(ctx.now, WINDOW_DAYS), LOG_ROWS_LIMIT);
      const candidates = aggregateQueries(rows, tried);
      const units = planUnits(candidates, tried, dayOf(ctx.now));
      ctx.log.info(
        `search_log: ${rows.length} zero-result searches in ${WINDOW_DAYS} d → ${candidates.length} candidate quer${candidates.length === 1 ? "y" : "ies"}` +
          ` (${Object.keys(tried).length} already tried), ${units.length} unit(s)`,
      );
      return { units, done: true };
    },

    async run(unit, ctx) {
      const budget = new RequestBudget(MAX_REQUESTS_PER_UNIT);
      const resolved: Array<{ cand: WantedCandidate; qids: string[] }> = [];
      let nowFound = 0;
      let misses = 0;
      for (const cand of unit.queries) {
        if (budget.left < 1) {
          ctx.log.warn(`request cap (${MAX_REQUESTS_PER_UNIT}) reached; ${unit.queries.length - unit.attempted.length} quer(y/ies) left for the next pass`);
          break;
        }
        if (await deps.db.hasResults(cand.q)) {
          unit.attempted.push(cand.hash);
          nowFound++;
          continue;
        }
        unit.attempted.push(cand.hash);
        const qids = await resolveQids(cand.q, ctx, budget);
        if (!qids.length) {
          misses++;
          continue;
        }
        resolved.push({ cand, qids });
      }

      const qids = [...new Set(resolved.flatMap((r) => r.qids))];
      const existing = qids.length ? await deps.db.existingQids(qids) : new Set<string>();
      // Only hits the walk below can actually reach: an already-catalogued hit ends its query.
      const needed = new Set<string>();
      for (const { qids: hits } of resolved) {
        for (const qid of hits) {
          if (existing.has(qid)) break;
          needed.add(qid);
        }
      }
      const entities = needed.size ? await fetchEntities([...needed], ctx, budget) : new Map<string, WdEntity>();

      const bySourceKey = new Map<string, IngestEvent>();
      const rejected: Record<string, number> = {};
      let catalogued = 0;
      let regionSkips = 0;
      for (const { cand, qids: hits } of resolved) {
        // Walk the search hits in rank order; stop at the first that resolves, and stop rather than
        // fall through when the rejection means "right item, unusable label" (FALLTHROUGH_REASONS).
        let picked: Resolved | null = null;
        for (const qid of hits) {
          if (existing.has(qid)) {
            catalogued++;
            break;
          }
          const read = readEntity(entities.get(qid), ctx.now);
          if (read.ok) {
            picked = read.value;
            break;
          }
          rejected[read.reason] = (rejected[read.reason] ?? 0) + 1;
          if (!FALLTHROUGH_REASONS.has(read.reason)) break;
        }
        if (!picked) continue;
        const regions: string[] = [];
        for (const country of picked.p17) {
          const iso = await countryIso(country, ctx, budget);
          if (!iso.ok) {
            regionSkips++;
            continue;
          }
          if (iso.iso && !regions.includes(iso.iso)) regions.push(iso.iso);
        }
        const row = buildWantedEvent(picked, { n: cand.n, hash: cand.hash, regions });
        const prev = bySourceKey.get(row.source_key);
        // Two queries resolving to one item: keep the more-asked one (it carries the higher popularity).
        if (!prev || row.popularity > prev.popularity) bySourceKey.set(row.source_key, row);
      }
      if (regionSkips) {
        ctx.log.warn(`request cap (${MAX_REQUESTS_PER_UNIT}) reached; ${regionSkips} country lookup(s) skipped — affected row(s) fall back to GLOBAL`);
      }
      const rows = [...bySourceKey.values()];
      const rejectedNote = Object.entries(rejected)
        .map(([k, v]) => `${v} ${k}`)
        .join(", ");
      ctx.log.info(
        `${unit.label}: ${unit.attempted.length} attempted, ${nowFound} now found, ${misses} unresolved, ${catalogued} already catalogued, ` +
          `${rows.length} row(s)${rejectedNote ? ` (rejected: ${rejectedNote})` : ""}, ${budget.used} request(s)`,
      );
      return rows;
    },
  };
}

export const adapter: Adapter<WantedUnit> = createWantedAdapter({ db: supabaseWantedDb() });
