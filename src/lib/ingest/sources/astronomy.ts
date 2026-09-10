import { isBudgetExceeded } from "../http";
import { isFarFuture, isFutureOrFar } from "../normalize";
import type { Adapter, IngestContext, IngestEvent, Json, Plan, Unit } from "../types";
import {
  ASTEROID_ALLOWLIST,
  cadLookupUrl,
  cadMainUrl,
  cometRows,
  parseCad,
  parseSbdb,
  sbdbQueryUrl,
  selectCad,
  type CadRow,
  type SbdbRow,
} from "./astronomy/jpl";
import { eclipseRows, moonRows, planetRows, seasonRows, showerRows, transitRows } from "./astronomy/sky";

/**
 * Astronomy source (rank 8): deterministic sky events computed in-process with astronomy-engine
 * (eclipses, seasons, supermoons/blue/Harvest Moons, oppositions, transits, meteor-shower peaks
 * from the IMO 2026 working list) plus asteroid close approaches from JPL CNEOS `cad.api` and a
 * curated comet allowlist refreshed against JPL SBDB.
 *
 * Licence: astronomy-engine is MIT (notice only) and computed facts are not copyrightable; JPL
 * data is a US Government work with no data-licence page (jpl.nasa.gov/copyrights 404) —
 * credited "Courtesy NASA/JPL-Caltech" with no implied endorsement, so
 * `sources.attribution = "Asteroid and comet data courtesy NASA/JPL-Caltech (CNEOS, SBDB)"`.
 * IMO peak values are facts (cited on the methodology page). No source images:
 * `image_candidate_url` stays null (enrichment uses NASA images-api by keyword).
 *
 * Rejected for this source (never add): timeanddate.com, EclipseWise, in-the-sky.org and
 * astronomyapi.com (paid/proprietary/403/bot-blocked — everything is computable or public
 * domain via NASA GSFC); NASA NeoWs (7-day window, redundant with cad.api); the live imo.net
 * (offline after a cyberattack, HTML error pages served with HTTP 200 — Wayback capture only);
 * the IAU MDC list as a peak source (no ZHR, mean longitude ≠ peak, conflicting solutions).
 *
 * Units: `eclipses|seasons|moon|planets|showers:<year>` for now .. now+15 (no network, each
 * well under a second), then `transits`, `cad` (1 request + ≤ 5 `des=` lookups, serial) and
 * `comets` (1 SBDB request); ≤ 8 JPL requests per pass, one at a time with 2 s spacing (JPL Fair
 * Use Policy; browser calls are forbidden by CORS, so this only ever runs server-side). The
 * cursor is content-addressed: `{ afterKey }` names the last unit upserted, never an index, so a
 * pass resumed after the year rolls over continues at the right unit.
 */

export const YEARS_AHEAD = 16; // this year .. +15; rows past now + 15 y are dropped unless tagged far-future

const SKY_KINDS = ["eclipses", "seasons", "moon", "planets", "showers"] as const;
type SkyKind = (typeof SKY_KINDS)[number];

export type AstronomyUnit = Unit & ({ kind: SkyKind; year: number } | { kind: "transits" | "cad" | "comets"; year?: undefined });
type Cursor = { afterKey: string };

export function unitList(now: Date): AstronomyUnit[] {
  const startYear = now.getUTCFullYear();
  const units: AstronomyUnit[] = [];
  for (let i = 0; i < YEARS_AHEAD; i++) {
    const year = startYear + i;
    for (const kind of SKY_KINDS) {
      const key = `${kind}:${year}`;
      units.push({ key: `astronomy:${key}`, label: `${kind} ${year}`, after: { afterKey: key }, kind, year });
    }
  }
  for (const kind of ["transits", "cad", "comets"] as const) {
    units.push({ key: `astronomy:${kind}`, label: kind, after: { afterKey: kind }, kind });
  }
  return units;
}

export function parseCursor(cursor: Json | null): string | null {
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    const c = cursor as { afterKey?: unknown };
    if (typeof c.afterKey === "string" && c.afterKey) return c.afterKey;
  }
  return null;
}

/** Units after `afterKey` (all of them when the key is unknown, e.g. a cursor from an older unit scheme). */
export function planUnits(now: Date, afterKey: string | null): AstronomyUnit[] {
  const all = unitList(now);
  if (!afterKey) return all;
  const idx = all.findIndex((u) => (u.after as Cursor).afterKey === afterKey);
  return idx < 0 ? all : all.slice(idx + 1);
}

/** Horizon filter shared by every unit: nothing older than two days, nothing past now + 15 y unless tagged `far-future`. */
export function withinHorizon(rows: readonly IngestEvent[], now: Date): IngestEvent[] {
  const out: IngestEvent[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!isFutureOrFar(r.date, r.date_precision, now)) continue;
    if (isFarFuture(r.date, r.tags, now)) continue;
    if (seen.has(r.source_key)) continue;
    seen.add(r.source_key);
    out.push(r);
  }
  return out;
}

function horizonEnd(now: Date): Date {
  const d = new Date(now.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + 15);
  return d;
}

async function fetchCad(ctx: IngestContext): Promise<IngestEvent[]> {
  const to = horizonEnd(ctx.now);
  const main = parseCad(await ctx.http.fetchJson(cadMainUrl(ctx.now, to)));
  const rows: CadRow[] = [...main];
  const seen = new Set(main.map((r) => r.des));
  let lookups = 0;
  for (const des of Object.keys(ASTEROID_ALLOWLIST)) {
    if (seen.has(des)) continue;
    lookups++;
    try {
      rows.push(...parseCad(await ctx.http.fetchJson(cadLookupUrl(des, ctx.now, to))));
    } catch (err) {
      if (isBudgetExceeded(err)) throw err;
      ctx.log.warn(`cad lookup ${des} failed: ${(err as Error)?.message ?? err}`);
    }
  }
  const out = selectCad(rows);
  ctx.log.info(`cad: ${main.length} candidates + ${lookups} allowlist lookup(s) → ${out.length} rows`);
  return out;
}

async function fetchComets(ctx: IngestContext): Promise<IngestEvent[]> {
  let sbdb: SbdbRow[] = [];
  try {
    sbdb = parseSbdb(await ctx.http.fetchJson(sbdbQueryUrl(ctx.now, horizonEnd(ctx.now))));
  } catch (err) {
    // SBDB is best-effort: the curated dates stand when the refresh query is unavailable.
    if (isBudgetExceeded(err)) throw err;
    ctx.log.warn(`sbdb refresh failed, using curated comet dates: ${(err as Error)?.message ?? err}`);
  }
  const rows = cometRows(sbdb, ctx.now);
  ctx.log.info(`comets: ${sbdb.length} SBDB rows with a future perihelion → ${rows.length} curated rows`);
  return rows;
}

export const adapter: Adapter<AstronomyUnit> = {
  id: "astronomy",
  label: "astronomy-engine + JPL CNEOS/SBDB",
  rank: 8,
  cadence: "monthly",
  isConfigured: () => true,
  limits: { concurrency: 1, minIntervalMs: 2000, timeoutMs: 30_000, maxRetries: 2 },

  async plan(cursor, ctx): Promise<Plan<AstronomyUnit>> {
    return { units: planUnits(ctx.now, parseCursor(cursor)), done: true };
  },

  async run(unit, ctx) {
    let rows: IngestEvent[];
    switch (unit.kind) {
      case "eclipses":
        rows = eclipseRows(unit.year, ctx.now);
        break;
      case "seasons":
        rows = seasonRows(unit.year);
        break;
      case "moon":
        rows = moonRows(unit.year);
        break;
      case "planets":
        rows = planetRows(unit.year);
        break;
      case "showers":
        rows = showerRows(unit.year);
        break;
      case "transits":
        rows = transitRows(ctx.now);
        break;
      case "cad":
        rows = await fetchCad(ctx);
        break;
      case "comets":
        rows = await fetchComets(ctx);
        break;
    }
    const kept = withinHorizon(rows, ctx.now);
    if (kept.length !== rows.length) ctx.log.info(`${unit.label}: ${rows.length} computed, ${kept.length} inside the horizon`);
    return kept;
  },
};
