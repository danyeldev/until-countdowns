import { categories } from "./i18n/messages/en/categories";
import type { Category } from "./types";

/**
 * English category labels and blurbs.
 *
 * They live in the English message catalogue now — one copy, translated fifteen ways — and are
 * re-exported here for the surfaces that are English by design: the OG cards (Latin-only font
 * subsets) and anything outside the localized app tree. A page renders `L.m.categories.labels`
 * instead, so a Spanish reader gets "Días festivos".
 *
 * The import reaches into `messages/en/` rather than `messages/` on purpose: the registry is
 * `server-only`, and these constants are used from Client Components too.
 */
export const CATEGORY_LABELS: Record<Category, string> = categories.labels;

export const CATEGORY_BLURB: Record<Category, string> = categories.blurbs;

/**
 * Fallback display names for source ids. The database is the authority
 * (`sources.label`, surfaced as `events_public.source_label` and `catalogMeta().sourceLabels`);
 * this map only covers ids the app knows before a row exists, so a new adapter
 * shows its DB label without a code change.
 *
 * Not translated: they are proper names ("Wikidata", "TVMaze", "football-data.org").
 */
export const SOURCE_LABELS: Record<string, string> = {
  curated: "Curated",
  user: "You",
  holidays: "date-holidays",
  openholidays: "OpenHolidays",
  wikipedia: "Wikipedia",
  wikidata: "Wikidata",
  astronomy: "Computed astronomy",
  curiosities: "Computed curiosities",
  observances: "Observance rules",
  ll2: "Launch Library 2",
  "football-data": "football-data.org",
  hebcal: "Hebcal",
  aladhan: "Aladhan",
  tvmaze: "TVMaze",
  kitsu: "Kitsu",
  endoflife: "endoflife.date",
  confs: "confs.tech",
  liquipedia: "Liquipedia",
  espn: "ESPN",
};

/** Display name for a source id: DB label first, then the static fallback, then the raw id. */
export function sourceLabel(id: string, fromDb?: Record<string, string>): string {
  return fromDb?.[id] || SOURCE_LABELS[id] || id;
}
