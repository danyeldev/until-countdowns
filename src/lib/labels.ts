import type { Category } from "./types";

export const CATEGORY_LABELS: Record<Category, string> = {
  holidays: "Holidays",
  national: "National days",
  religion: "Religious",
  awareness: "Awareness days",
  fun: "Fun days",
  culture: "Culture",
  festivals: "Festivals",
  sports: "Sports",
  esports: "Esports",
  games: "Games",
  film: "Film",
  tv: "TV",
  anime: "Anime",
  music: "Music",
  entertainment: "Entertainment",
  politics: "Politics",
  tech: "Tech",
  science: "Science",
  space: "Space",
  astronomy: "Astronomy",
  nature: "Nature",
  history: "History",
  curiosities: "Curiosities",
};

export const CATEGORY_BLURB: Record<Category, string> = {
  holidays: "Public holidays and the rituals we keep.",
  national: "Independence days, republic days, national festivities.",
  religion: "Feasts, fasts, and holy days across faiths.",
  awareness: "UN observances and international days.",
  fun: "Pizza Day, Talk Like a Pirate Day, and other excuses.",
  culture: "Festivals, feast days, and the civic calendar.",
  festivals: "Carnivals, fairs, and gatherings.",
  sports: "Finals, opening ceremonies, and the next World Cup.",
  esports: "Worlds, Majors, and The International.",
  games: "Release dates and showcases.",
  film: "Premieres and awards nights.",
  tv: "Season premieres and finales.",
  anime: "Season starts and film releases.",
  music: "Contests, tours, and anniversaries.",
  entertainment: "Fandom dates and pop-culture holy days.",
  politics: "Elections and the dates that steer countries.",
  tech: "Conferences, end-of-life dates, and the clocks computers keep.",
  science: "Dates for the curious.",
  space: "Launches, landings, and the long way back to the Moon.",
  astronomy: "Eclipses, showers, solstices — appointments with the sky.",
  nature: "Earth, oceans, and the living year.",
  history: "Anniversaries of things that already happened — still ticking.",
  curiosities: "Unix milestones, palindrome dates, Friday the 13ths.",
};

/**
 * Fallback display names for source ids. The database is the authority
 * (`sources.label`, surfaced as `events_public.source_label` and `catalogMeta().sourceLabels`);
 * this map only covers ids the app knows before a row exists, so a new adapter
 * shows its DB label without a code change.
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
};

/** Display name for a source id: DB label first, then the static fallback, then the raw id. */
export function sourceLabel(id: string, fromDb?: Record<string, string>): string {
  return fromDb?.[id] || SOURCE_LABELS[id] || id;
}
