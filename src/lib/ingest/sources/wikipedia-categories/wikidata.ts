import { precisionFromWikidata } from "../../normalize";
import type { IngestPrecision } from "../../types";

/**
 * Minimal `wbgetentities` / `wbgetclaims` shapes and precision-guarded claim readers. Only
 * non-deprecated claims are read; when an item has preferred-rank statements for a property
 * (a rescheduled event keeps the old date at normal rank) only those are used.
 */

export type WdSnak = { snaktype: string; property?: string; datavalue?: { type: string; value: unknown } };
export type WdClaim = { mainsnak: WdSnak; rank?: "preferred" | "normal" | "deprecated"; type?: string };
export type WdEntity = {
  id: string;
  missing?: string;
  labels?: Record<string, { language: string; value: string }>;
  sitelinks?: Record<string, { site: string; title: string }>;
  claims?: Record<string, WdClaim[]>;
};
export type WdEntitiesResponse = { entities?: Record<string, WdEntity>; error?: { code?: string; info?: string } };
export type WdClaimsResponse = { claims?: Record<string, WdClaim[]>; error?: { code?: string; info?: string } };

export type WdTime = { day: string; precision: IngestPrecision };

export function bestClaims(entity: WdEntity | undefined, prop: string): WdClaim[] {
  const all = (entity?.claims?.[prop] ?? []).filter((c) => c.rank !== "deprecated" && c.mainsnak?.snaktype === "value");
  const preferred = all.filter((c) => c.rank === "preferred");
  return preferred.length ? preferred : all;
}

/**
 * Wikidata time value → catalog day + precision. `+2026-00-00T00:00:00Z` at precision 9 becomes
 * `2026-01-01` / `year`; anything coarser than a decade, negative or non-Gregorian is rejected.
 */
export function parseWdTime(value: unknown): WdTime | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { time?: unknown; precision?: unknown; calendarmodel?: unknown };
  if (typeof v.time !== "string") return null;
  const m = /^\+(\d{4})-(\d{2})-(\d{2})T/.exec(v.time);
  if (!m) return null;
  const precision = precisionFromWikidata(Number(v.precision));
  if (!precision || precision === "decade") return null;
  if (typeof v.calendarmodel === "string" && !v.calendarmodel.endsWith("/Q1985727")) return null; // proleptic Gregorian only
  const y = Number(m[1]);
  const mo = precision === "year" ? 1 : Math.max(1, Number(m[2]));
  const d = precision === "day" ? Number(m[3]) : 1;
  if (mo > 12 || d < 1 || d > 31) return null;
  const day = `${m[1]}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const t = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).getUTCDate() !== d || y < 1900) return null;
  return { day, precision };
}

/** Earliest usable time value of `prop` (an item may carry several, e.g. per-phase start dates). */
export function firstTime(entity: WdEntity | undefined, prop: string): WdTime | null {
  const times = bestClaims(entity, prop)
    .map((c) => parseWdTime(c.mainsnak.datavalue?.value))
    .filter((t): t is WdTime => t !== null)
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  return times[0] ?? null;
}

/** Latest usable time value of `prop` (end dates). */
export function lastTime(entity: WdEntity | undefined, prop: string): WdTime | null {
  const times = bestClaims(entity, prop)
    .map((c) => parseWdTime(c.mainsnak.datavalue?.value))
    .filter((t): t is WdTime => t !== null)
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  return times[0] ?? null;
}

export function itemIds(entity: WdEntity | undefined, prop: string): string[] {
  const out: string[] = [];
  for (const c of bestClaims(entity, prop)) {
    const v = c.mainsnak.datavalue?.value as { id?: unknown } | undefined;
    if (v && typeof v.id === "string" && /^Q\d+$/.test(v.id) && !out.includes(v.id)) out.push(v.id);
  }
  return out;
}

export function stringValues(claims: WdClaim[] | undefined): string[] {
  const out: string[] = [];
  for (const c of claims ?? []) {
    if (c.rank === "deprecated" || c.mainsnak?.snaktype !== "value") continue;
    const v = c.mainsnak.datavalue?.value;
    if (typeof v === "string" && !out.includes(v)) out.push(v);
  }
  return out;
}

export function coordinates(entity: WdEntity | undefined): { lat: number; lng: number } | null {
  for (const c of bestClaims(entity, "P625")) {
    const v = c.mainsnak.datavalue?.value as { latitude?: unknown; longitude?: unknown; globe?: unknown } | undefined;
    if (!v || typeof v.latitude !== "number" || typeof v.longitude !== "number") continue;
    if (typeof v.globe === "string" && !v.globe.endsWith("/Q2")) continue;
    return { lat: Math.round(v.latitude * 1e4) / 1e4, lng: Math.round(v.longitude * 1e4) / 1e4 };
  }
  return null;
}

export function enLabel(entity: WdEntity | undefined): string | null {
  const v = entity?.labels?.en?.value;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Event dates: P580 start (fallback P585 point in time) with precision, day-precision P582 end. */
export function eventDates(entity: WdEntity | undefined): { start: WdTime; end: string | null } | null {
  const start = firstTime(entity, "P580") ?? firstTime(entity, "P585");
  if (!start) return null;
  const end = lastTime(entity, "P582");
  const endDay = end && end.precision === "day" && end.day >= start.day ? end.day : null;
  return { start, end: endDay };
}
