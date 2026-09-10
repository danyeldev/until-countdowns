import type { Adapter } from "../types";

/**
 * Source registry. Adapters are loaded lazily (dynamic import per source) so that a cron
 * invocation for one source never bundles or initialises the others (date-holidays alone is
 * several MB of data). Add a source: create `sources/<id>.ts` exporting `adapter`, register it
 * here, add a `vercel.json` cron and a row in `public.sources` (rank + licence).
 */
export type SourceEntry = {
  id: string;
  label: string;
  /** Mirrors `public.sources.rank`; 0 for jobs that emit no events. */
  rank: number;
  cadence: Adapter["cadence"];
  load: () => Promise<Adapter>;
};

export const SOURCES: Record<string, SourceEntry> = {
  // —— Phase 3: the original four plus housekeeping ——
  holidays: {
    id: "holidays",
    label: "date-holidays (offline public holidays)",
    rank: 1,
    cadence: "weekly",
    load: () => import("./holidays").then((m) => m.adapter),
  },
  curated: {
    id: "curated",
    label: "Curated one-offs and recurring series",
    rank: 9,
    cadence: "daily",
    load: () => import("./curated").then((m) => m.adapter),
  },
  wikidata: {
    id: "wikidata",
    label: "Wikidata SPARQL (precision-guarded classes)",
    rank: 2,
    cadence: "daily",
    load: () => import("./wikidata").then((m) => m.adapter),
  },
  wikipedia: {
    id: "wikipedia",
    label: "Wikipedia year pages",
    rank: 3,
    cadence: "daily",
    load: () => import("./wikipedia").then((m) => m.adapter),
  },
  housekeeping: {
    id: "housekeeping",
    label: "Popularity decay, run pruning, staleness alerts",
    rank: 0,
    cadence: "daily",
    load: () => import("./housekeeping").then((m) => m.adapter),
  },

  // —— Phase 4: computed sources (no network) ——
  astronomy: {
    id: "astronomy",
    label: "astronomy-engine + JPL CNEOS/SBDB",
    rank: 8,
    cadence: "monthly",
    load: () => import("./astronomy").then((m) => m.adapter),
  },
  curiosities: {
    id: "curiosities",
    label: "Computed calendar and clock curiosities",
    rank: 8,
    cadence: "monthly",
    load: () => import("./curiosities").then((m) => m.adapter),
  },
  hindu: {
    id: "hindu",
    label: "Computed Hindu festivals (panchang-ts)",
    rank: 6,
    cadence: "monthly",
    load: () => import("./hindu").then((m) => m.adapter),
  },

  // —— Phase 4: holidays and religious calendars ——
  openholidays: {
    id: "openholidays",
    label: "OpenHolidays API overlay",
    rank: 2,
    cadence: "weekly",
    load: () => import("./openholidays").then((m) => m.adapter),
  },
  hebcal: {
    id: "hebcal",
    label: "Hebcal (Jewish calendar)",
    rank: 5,
    cadence: "weekly",
    load: () => import("./hebcal").then((m) => m.adapter),
  },
  aladhan: {
    id: "aladhan",
    label: "AlAdhan Hijri calendar",
    rank: 5,
    cadence: "weekly",
    load: () => import("./aladhan").then((m) => m.adapter),
  },

  // —— Phase 4: Wikimedia spine ——
  observances: {
    id: "observances",
    label: "Wikidata observances (world/national/fun days)",
    rank: 6,
    cadence: "monthly",
    load: () => import("./observances").then((m) => m.adapter),
  },
  anniversaries: {
    id: "anniversaries",
    label: "Wikidata round-number anniversaries",
    rank: 2,
    cadence: "weekly",
    load: () => import("./anniversaries").then((m) => m.adapter),
  },
  "wikipedia-categories": {
    id: "wikipedia-categories",
    label: "Wikipedia scheduled-event categories + electoral calendars",
    rank: 3,
    cadence: "daily",
    load: () => import("./wikipedia-categories").then((m) => m.adapter),
  },

  // —— Phase 4: short-horizon feeds ——
  tvmaze: {
    id: "tvmaze",
    label: "TVMaze premieres",
    rank: 5,
    cadence: "daily",
    load: () => import("./tvmaze").then((m) => m.adapter),
  },
  ll2: {
    id: "ll2",
    label: "Launch Library 2 (The Space Devs)",
    rank: 7,
    cadence: "daily",
    load: () => import("./ll2").then((m) => m.adapter),
  },
  endoflife: {
    id: "endoflife",
    label: "endoflife.date lifecycle milestones",
    rank: 5,
    cadence: "daily",
    load: () => import("./endoflife").then((m) => m.adapter),
  },
  confs: {
    id: "confs",
    label: "confs.tech conference-data",
    rank: 4,
    cadence: "weekly",
    load: () => import("./confs").then((m) => m.adapter),
  },
  "football-data": {
    id: "football-data",
    label: "football-data.org v4 (free tier)",
    rank: 6,
    cadence: "daily",
    load: () => import("./football-data").then((m) => m.adapter),
  },
  espn: {
    id: "espn",
    label: "ESPN MMA scoreboard (UFC start times)",
    rank: 6,
    cadence: "daily",
    load: () => import("./espn").then((m) => m.adapter),
  },
  musicbrainz: {
    id: "musicbrainz",
    label: "MusicBrainz festival events",
    rank: 4,
    cadence: "weekly",
    load: () => import("./musicbrainz").then((m) => m.adapter),
  },
  liquipedia: {
    id: "liquipedia",
    label: "Liquipedia (tier-1 esports tournaments)",
    rank: 4,
    cadence: "daily",
    load: () => import("./liquipedia").then((m) => m.adapter),
  },

  // —— Phase 4: opt-in (terms unconfirmed; isConfigured() is false without the flag) ——
  animeschedule: {
    id: "animeschedule",
    label: "AnimeSchedule.net premieres",
    rank: 4,
    cadence: "weekly",
    load: () => import("./animeschedule").then((m) => m.adapter),
  },
  kitsu: {
    id: "kitsu",
    label: "Kitsu upcoming anime",
    rank: 4,
    cadence: "weekly",
    load: () => import("./kitsu").then((m) => m.adapter),
  },

  // —— Phase 4: demand driven ——
  wanted: {
    id: "wanted",
    label: "Search demand (Wikidata resolve)",
    rank: 1,
    cadence: "daily",
    load: () => import("./wanted").then((m) => m.adapter),
  },
};

export function listSources(): SourceEntry[] {
  return Object.values(SOURCES);
}

export function isSource(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(SOURCES, id);
}

export async function loadAdapter(id: string): Promise<Adapter> {
  const entry = isSource(id) ? SOURCES[id] : undefined;
  if (!entry) throw new Error(`unknown ingest source: ${id}`);
  const adapter = await entry.load();
  if (adapter.id !== id) throw new Error(`adapter id mismatch: ${adapter.id} registered as ${id}`);
  return adapter;
}

export const CADENCE_MS: Record<Adapter["cadence"], number> = {
  hourly: 3_600_000,
  daily: 86_400_000,
  weekly: 7 * 86_400_000,
  monthly: 30 * 86_400_000,
};
