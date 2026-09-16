import type { CountdownEvent } from "./types";

/** Soonness half-life, in days. ~31 days scores half of “today.” */
export const HEAT_SOON_TAU = 45;
/** Hype points that count as a full social score. */
export const HEAT_HYPE_REF = 80;
export const HEAT_SOON_WEIGHT = 38;
export const HEAT_QUALITY_WEIGHT = 34;
export const HEAT_HYPE_WEIGHT = 28;
export const HEAT_FEATURED_BONUS = 0.25;
export const HEAT_QUALITY_CAP = 1.15;
/** Coarse dates have no day count; treat them as mid-horizon. */
export const HEAT_UNKNOWN_DAYS = 120;

export type HeatInput = {
  popularity: number;
  featured: boolean;
  daysUntil?: number | null;
  hype?: number | null;
};

export type HeatEvent = Pick<
  CountdownEvent,
  "id" | "date" | "title" | "category" | "popularity" | "featured"
> & {
  daysUntil?: number;
  hype?: number;
  seriesSlug?: string;
};

/**
 * One number for “show this now”: approaching dates, editorial quality,
 * and live hype. Hype is log-scaled so one viral row cannot bury the catalog.
 * Keep in lockstep with `public.event_heat`.
 */
export function eventHeat(input: HeatInput): number {
  const days =
    typeof input.daysUntil === "number" && Number.isFinite(input.daysUntil)
      ? Math.max(0, input.daysUntil)
      : HEAT_UNKNOWN_DAYS;
  const soonness = Math.exp(-days / HEAT_SOON_TAU);
  const quality = Math.min(
    HEAT_QUALITY_CAP,
    Math.max(0, input.popularity) / 100 + (input.featured ? HEAT_FEATURED_BONUS : 0),
  );
  const social = Math.min(
    HEAT_QUALITY_CAP,
    Math.log(1 + Math.max(0, input.hype ?? 0)) / Math.log(1 + HEAT_HYPE_REF),
  );
  return HEAT_SOON_WEIGHT * soonness + HEAT_QUALITY_WEIGHT * quality + HEAT_HYPE_WEIGHT * social;
}

export function heatOf(event: HeatEvent): number {
  return eventHeat({
    popularity: event.popularity,
    featured: event.featured,
    daysUntil: event.daysUntil,
    hype: event.hype,
  });
}

export function sortByHeat<T extends HeatEvent>(events: readonly T[]): T[] {
  return [...events].sort(
    (a, b) => heatOf(b) - heatOf(a) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
}

export function pickHottest<T extends HeatEvent>(events: readonly T[], limit: number): T[] {
  return sortByHeat(events).slice(0, Math.max(0, limit));
}

/** Hottest rows, one per series or title — for a week table that should not be four Independence Days. */
export function pickHottestFamilies<T extends HeatEvent>(events: readonly T[], limit: number): T[] {
  const cap = Math.max(0, limit);
  const seen = new Set<string>();
  const out: T[] = [];
  for (const event of sortByHeat(events)) {
    const key = event.seriesSlug || event.title.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(event);
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * Featured rail: hottest first, then spread across series and category
 * so the home hero is not four Independence Days.
 */
export function pickHomeHighlights<T extends HeatEvent>(events: readonly T[], limit: number): T[] {
  const cap = Math.max(0, limit);
  const ranked = sortByHeat(events);
  const picked: T[] = [];
  const seen = new Set<string>();
  const categories = new Set<string>();
  const series = new Set<string>();

  const seriesKey = (event: T) => event.seriesSlug || event.title.trim().toLowerCase();

  const take = (ok: (event: T) => boolean) => {
    for (const event of ranked) {
      if (picked.length >= cap) return;
      if (seen.has(event.id) || !ok(event)) continue;
      picked.push(event);
      seen.add(event.id);
      categories.add(event.category);
      series.add(seriesKey(event));
    }
  };

  take((event) => !series.has(seriesKey(event)) && !categories.has(event.category));
  take((event) => !series.has(seriesKey(event)));
  take(() => true);
  return picked;
}
