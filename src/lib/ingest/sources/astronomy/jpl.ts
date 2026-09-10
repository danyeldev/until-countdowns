import { buildEvent } from "../../normalize";
import type { IngestEvent } from "../../types";
import { COMETS, type CuratedComet } from "./comets";
import { diameterFromH, fmtDiameter, fmtInt, isoDay, isoInstant, julianDate, KM_PER_AU, LUNAR_DISTANCE_KM, utcParts, whenPhrase } from "./format";

/**
 * JPL SSD/CNEOS parsing: the close-approach API (`cad.api`) for asteroids and the SBDB query
 * API for comet perihelia. JPL data is a US Government work — no data-licence page exists —
 * credited "Courtesy NASA/JPL-Caltech" with no implied endorsement (`sources.attribution`).
 * Fair Use Policy: one request at a time, only what is needed, back off on errors, server-side
 * only (CORS forbidden). Docs: https://ssd-api.jpl.nasa.gov/doc/cad.html,
 * https://ssd-api.jpl.nasa.gov/doc/sbdb_query.html
 */

export const CAD_API = "https://ssd-api.jpl.nasa.gov/cad.api";
export const SBDB_QUERY_API = "https://ssd-api.jpl.nasa.gov/sbdb_query.api";
export const SBDB_LOOKUP = "https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=";
/** Verified 2026-09-09: `h-max` is accepted (dist ≤ 0.01 au, H ≤ 22 → 14 rows over 15 years). */
export const CAD_DIST_MAX_AU = 0.01;
export const CAD_H_MAX = 22;
export const CAD_ALLOWLIST_DIST_MAX_AU = 0.05;
export const CAD_CAP = 50;
/** Approaches with a 3-sigma time uncertainty up to this many minutes are stored as instants. */
export const CAD_SIGMA_INSTANT_MIN = 30;

export type AllowEntry = { name?: string; popularity: number; featured?: boolean; note?: string };

/**
 * Named or notable near-Earth objects always kept (and looked up by `des=` when the main query
 * misses them, e.g. 2024 YR4 with H ≈ 23.9). Keys are `des` exactly as cad.api prints them.
 */
export const ASTEROID_ALLOWLIST: Record<string, AllowEntry> = {
  "99942": { name: "Apophis", popularity: 90, featured: true, note: "Closer than geostationary satellites, and visible to the naked eye from Europe, Africa and western Asia." },
  "2024 YR4": { popularity: 45, note: "Briefly the highest-rated impact risk on record in early 2025; Earth impact was ruled out, but a lunar impact remains possible." },
  "137108": { name: "1999 AN10", popularity: 35 },
  "153814": { name: "2001 WN5", popularity: 35 },
  "35396": { name: "1997 XF11", popularity: 35 },
};

export type CadRow = {
  des: string;
  orbit_id: string;
  jd: number;
  cd: string;
  dist: number;
  dist_min: number;
  dist_max: number;
  v_rel: number;
  v_inf: number;
  t_sigma_f: string;
  h: number | null;
  fullname: string;
};

type CadJson = { count?: number | string; fields?: string[]; data?: Array<Array<string | null>> };

const NUMERIC = new Set(["jd", "dist", "dist_min", "dist_max", "v_rel", "v_inf", "h"]);

/** `{ fields, data }` → typed rows (the API may return `count` as a string and omit `data` when 0). */
export function parseCad(json: unknown): CadRow[] {
  const j = json as CadJson;
  const fields = j?.fields ?? [];
  const out: CadRow[] = [];
  for (const arr of j?.data ?? []) {
    const rec: Record<string, unknown> = {};
    fields.forEach((f, i) => {
      const v = arr[i];
      rec[f] = NUMERIC.has(f) ? (v === null || v === undefined || v === "" ? null : Number(v)) : String(v ?? "");
    });
    if (typeof rec.des !== "string" || !rec.des || typeof rec.cd !== "string") continue;
    if (typeof rec.jd !== "number" || !Number.isFinite(rec.jd)) continue;
    out.push({
      des: rec.des,
      orbit_id: String(rec.orbit_id ?? ""),
      jd: rec.jd,
      cd: rec.cd,
      dist: Number(rec.dist),
      dist_min: Number(rec.dist_min),
      dist_max: Number(rec.dist_max),
      v_rel: Number(rec.v_rel),
      v_inf: Number(rec.v_inf),
      t_sigma_f: String(rec.t_sigma_f ?? ""),
      h: typeof rec.h === "number" && Number.isFinite(rec.h) ? rec.h : null,
      fullname: String(rec.fullname ?? "").trim(),
    });
  }
  return out;
}

const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

/** `2029-Apr-13 21:46` (UTC, TDB−UTC ignored: ≈ 69 s) → Date. */
export function parseCd(cd: string): Date | null {
  const m = /^(\d{4})-([A-Z][a-z]{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?$/.exec(cd.trim());
  if (!m) return null;
  const mon = MONTHS[m[2]];
  if (mon === undefined) return null;
  return new Date(Date.UTC(Number(m[1]), mon, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0)));
}

/** `t_sigma_f` ("< 00:01", "00:06", "13:07", "4_17:32" = days_hh:mm) → minutes; NaN when unparsable. */
export function sigmaMinutes(t: string): number {
  const m = /^\s*<?\s*(?:(\d+)_)?(\d{1,2}):(\d{2})\s*$/.exec(t);
  if (!m) return Number.NaN;
  return Number(m[1] ?? 0) * 1440 + Number(m[2]) * 60 + Number(m[3]);
}

/**
 * Display name: "99942 Apophis (2004 MN4)" → "Apophis"; "137108 (1999 AN10)" → "1999 AN10";
 * "(2024 YR4)" → "2024 YR4". The allowlist may override.
 */
export function displayName(fullname: string, des: string, allow?: AllowEntry): string {
  if (allow?.name) return allow.name;
  const s = fullname.trim();
  const named = /^\d+\s+([^()]+?)\s*(?:\(.*\))?$/.exec(s);
  if (named) return named[1].trim();
  const prov = /\(([^()]+)\)/.exec(s);
  if (prov) return prov[1].trim();
  return s || des;
}

/** CNEOS-style size range for an absolute magnitude: albedo 0.25 (bright) to 0.05 (dark). */
export function diameterRange(h: number): string {
  return `${fmtDiameter(diameterFromH(h, 0.25)).replace(/^about /, "")} to ${fmtDiameter(diameterFromH(h, 0.05)).replace(/^about /, "")}`;
}

export function cadSourceUrl(des: string, year: number): string {
  return `${CAD_API}?des=${encodeURIComponent(des)}&date-min=${year}-01-01&date-max=${year + 1}-01-01&dist-max=0.2&fullname=true`;
}

/** One close approach → row (instant when the time uncertainty is ≤ 30 min, else the UTC day). */
export function cadRow(r: CadRow, allow?: AllowEntry): IngestEvent | null {
  const at = parseCd(r.cd);
  if (!at) return null;
  const sigma = sigmaMinutes(r.t_sigma_f);
  const precise = Number.isFinite(sigma) && sigma <= CAD_SIGMA_INSTANT_MIN;
  const name = displayName(r.fullname, r.des, allow);
  const km = r.dist * KM_PER_AU;
  const ld = km / LUNAR_DISTANCE_KM;
  const p = utcParts(at);
  const when = precise ? `at ${p.time} UTC on ${p.day}` : `on ${p.day} (the time is uncertain by about ${sigma >= 1440 ? `${(sigma / 1440).toFixed(1)} days` : `${Math.round(sigma)} minutes`})`;
  const size = r.h !== null ? ` and has an absolute magnitude of ${r.h.toFixed(1)}, which suggests a diameter of ${diameterRange(r.h)}` : "";
  const description =
    `Asteroid ${name} passes about ${fmtInt(km)} km from Earth (${ld < 10 ? ld.toFixed(1) : Math.round(ld)} lunar distances) ${when}, according to JPL CNEOS close-approach data. ` +
    `It approaches at ${r.v_rel.toFixed(1)} km/s relative to Earth${size}. ${allow?.note ? `${allow.note} ` : ""}Courtesy NASA/JPL-Caltech.`;
  const year = at.getUTCFullYear();
  return buildEvent({
    title: `Asteroid ${name} close approach`,
    date: precise ? isoInstant(at) : isoDay(at),
    category: "astronomy",
    tags: ["asteroid", "space", "near-earth", "close-approach"],
    regions: ["GLOBAL"],
    description,
    source: "astronomy",
    sourceUrl: cadSourceUrl(r.des, year),
    sourceKey: `astronomy:cad:${r.des}:${Math.round(r.jd)}`,
    featured: Boolean(allow?.featured),
    popularity: allow?.popularity ?? 30,
    datePrecision: precise ? "instant" : "day",
    status: "scheduled",
    confidence: precise ? 0.9 : 0.6,
    timezone: "UTC",
    externalIds: { jpl_des: r.des },
    raw: { des: r.des, orbit_id: r.orbit_id, jd: r.jd, cd: r.cd, dist: r.dist, v_rel: r.v_rel, t_sigma_f: r.t_sigma_f, h: r.h, fullname: r.fullname },
  });
}

/** Notability filter (dist ≤ 0.01 au and H < 22, or allowlisted), allowlist first then brightest, cap 50, one row per source_key. */
export function selectCad(rows: readonly CadRow[]): IngestEvent[] {
  const kept = rows.filter((r) => ASTEROID_ALLOWLIST[r.des] || (r.dist <= CAD_DIST_MAX_AU && r.h !== null && r.h < CAD_H_MAX));
  kept.sort((a, b) => {
    const aa = ASTEROID_ALLOWLIST[a.des] ? 0 : 1;
    const bb = ASTEROID_ALLOWLIST[b.des] ? 0 : 1;
    if (aa !== bb) return aa - bb;
    const ah = a.h ?? 99;
    const bh = b.h ?? 99;
    if (ah !== bh) return ah - bh;
    return a.jd - b.jd;
  });
  const out: IngestEvent[] = [];
  const seen = new Set<string>();
  for (const r of kept) {
    const ev = cadRow(r, ASTEROID_ALLOWLIST[r.des]);
    if (!ev || seen.has(ev.source_key)) continue;
    seen.add(ev.source_key);
    out.push(ev);
    if (out.length >= CAD_CAP) break;
  }
  return out;
}

export function cadMainUrl(from: Date, to: Date): string {
  return `${CAD_API}?date-min=${isoDay(from)}&date-max=${isoDay(to)}&dist-max=${CAD_DIST_MAX_AU}&h-max=${CAD_H_MAX}&sort=date&fullname=true`;
}

export function cadLookupUrl(des: string, from: Date, to: Date): string {
  return `${CAD_API}?des=${encodeURIComponent(des)}&date-min=${isoDay(from)}&date-max=${isoDay(to)}&dist-max=${CAD_ALLOWLIST_DIST_MAX_AU}&fullname=true`;
}

// ---- SBDB comets ----

export type SbdbRow = { full_name: string; des: string; tp: number | null; tp_cal: string; per_y: number | null; q: number | null };

/** Comets with a perihelion (`tp`, JD TDB) between now and now + 15 years. */
export function sbdbQueryUrl(from: Date, to: Date): string {
  const cdata = JSON.stringify({ AND: [`tp|GT|${julianDate(from).toFixed(1)}`, `tp|LT|${julianDate(to).toFixed(1)}`] });
  return `${SBDB_QUERY_API}?fields=full_name,tp,tp_cal,per_y,q&sb-kind=c&sb-cdata=${encodeURIComponent(cdata)}&limit=200`;
}

/** "  1P/Halley" → "1P"; "C/2024 J3 (ATLAS)" → "C/2024 J3"; "P/2025 D2 (PANSTARRS)" → "P/2025 D2". */
export function sbdbDesignation(fullName: string): string {
  const s = fullName.trim();
  const periodic = /^(\d+[PDI])\b/.exec(s);
  if (periodic) return periodic[1];
  const prov = /^([CPDAIX]\/\d{4}\s+[A-Z]+\d*)/.exec(s);
  if (prov) return prov[1];
  return s.replace(/\s*\(.*$/, "");
}

export function parseSbdb(json: unknown): SbdbRow[] {
  const j = json as { fields?: string[]; data?: Array<Array<string | null>> };
  const fields = j?.fields ?? [];
  const out: SbdbRow[] = [];
  for (const arr of j?.data ?? []) {
    const rec: Record<string, string | null> = {};
    fields.forEach((f, i) => (rec[f] = arr[i] ?? null));
    const fullName = rec.full_name ?? "";
    if (!fullName) continue;
    const num = (v: string | null) => (v === null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
    out.push({ full_name: fullName.trim(), des: sbdbDesignation(fullName), tp: num(rec.tp), tp_cal: rec.tp_cal ?? "", per_y: num(rec.per_y), q: num(rec.q) });
  }
  return out;
}

/** `2027-01-21.2` → `2027-01-21`. */
export function tpCalToDay(tpCal: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(tpCal.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Curated comet rows; a future SBDB `tp_cal` for the same designation replaces the seed date at day precision. */
export function cometRows(sbdb: readonly SbdbRow[], now: Date, table: readonly CuratedComet[] = COMETS): IngestEvent[] {
  const byDes = new Map(sbdb.map((r) => [r.des, r]));
  const today = isoDay(now);
  return table.map((c) => {
    const hit = byDes.get(c.des);
    const refreshed = hit ? tpCalToDay(hit.tp_cal) : null;
    const useSbdb = Boolean(refreshed && refreshed > today);
    const date = useSbdb ? (refreshed as string) : c.date;
    const precision = useSbdb ? "day" : c.precision;
    const q = hit?.q ?? c.q;
    const year = Number(date.slice(0, 4));
    const description =
      `${c.name} reaches perihelion, its closest point to the Sun at about ${q.toFixed(2)} au, ${whenPhrase(date, precision)}. ${c.note} ` +
      (useSbdb ? "Date from the current JPL SBDB orbit solution; courtesy NASA/JPL-Caltech." : precision === "day" ? "Orbital data courtesy NASA/JPL-Caltech (SBDB)." : "The date is an estimate until JPL publishes an orbit solution for this return; courtesy NASA/JPL-Caltech (SBDB).");
    return buildEvent({
      title: c.title,
      date,
      category: "astronomy",
      tags: ["comet", "space", "perihelion", ...(c.tags ?? [])],
      regions: ["GLOBAL"],
      description,
      source: "astronomy",
      sourceUrl: `${SBDB_LOOKUP}${encodeURIComponent(c.des)}`,
      sourceKey: `astronomy:comet:${c.des}:${year}`,
      popularity: c.popularity,
      datePrecision: precision,
      confidence: useSbdb ? 0.8 : precision === "day" ? 0.7 : 0.5,
      externalIds: { jpl_des: c.des },
      raw: hit ? { full_name: hit.full_name, tp: hit.tp, tp_cal: hit.tp_cal, per_y: hit.per_y, q: hit.q } : { seed: c.date, precision: c.precision },
    });
  });
}
