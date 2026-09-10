export const CATEGORIES = [
  "holidays",
  "national",
  "religion",
  "awareness",
  "fun",
  "culture",
  "festivals",
  "sports",
  "esports",
  "games",
  "film",
  "tv",
  "anime",
  "music",
  "entertainment",
  "politics",
  "tech",
  "science",
  "space",
  "astronomy",
  "nature",
  "history",
  "curiosities",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Source ids known today (mirrors the `sources` table). Any string is accepted so new adapters need no type change. */
export type KnownSource =
  | "curated"
  | "user"
  | "holidays"
  | "openholidays"
  | "wikipedia"
  | "wikidata"
  | "astronomy"
  | "curiosities"
  | "observances"
  | "ll2"
  | "football-data"
  | "hebcal"
  | "aladhan"
  | "tvmaze"
  | "kitsu"
  | "endoflife"
  | "confs"
  | "liquipedia"
  | "hindu"
  | "animeschedule"
  | "musicbrainz"
  | "wanted"
  | "wikipedia-categories"
  | "anniversaries"
  | "espn";

export type EventSource = KnownSource | (string & {});

export type EventStatus = "scheduled" | "tentative" | "postponed" | "cancelled" | "done" | "retired";

export type DatePrecision = "instant" | "day" | "month" | "quarter" | "year" | "decade";

export type EventImage = {
  url: string;
  width: number;
  height: number;
  thumbhash?: string;
  color?: string;
  credit?: string;
  author?: string;
  license?: string;
  licenseUrl?: string;
  originPage?: string;
  provider?: string;
};

export type EventLocation = {
  name?: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  url?: string;
};

export type CountdownEvent = {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  endDate?: string;
  allDay: boolean;
  /**
   * IANA zone of a timed event (`events.timezone`). It is what makes the date a *place's* date: a
   * 22:00 premiere in New York is on the 12th wherever you read about it, though its instant is the
   * 13th in UTC. Undefined for all-day dates, which belong to no zone in particular.
   */
  timezone?: string;
  category: Category;
  tags: string[];
  regions: string[];
  source: EventSource;
  sourceUrl?: string;
  featured: boolean;
  popularity: number;
  /** Optional fields populated from `events_public`. Personal countdowns leave them undefined. */
  status?: EventStatus;
  datePrecision?: DatePrecision;
  /**
   * Whole days until the event, computed in SQL at read time (negative once it has passed).
   * Left undefined for coarse precisions (month/quarter/year/decade): the placeholder
   * date would make it meaningless. Use `periodEnd` / `status` for those instead.
   */
  daysUntil?: number;
  /** Last day the event can still happen (`events_public.period_end`), `YYYY-MM-DD`. */
  periodEnd?: string;
  seriesSlug?: string;
  seriesTitle?: string;
  summary?: string;
  image?: EventImage;
  location?: EventLocation;
  jsonldEligible?: boolean;
  indexable?: boolean;
  updatedAt?: string;
  sourceLabel?: string;
  lastVerifiedAt?: string;
  /** Earlier dates this event carried (`events.date_history`), oldest first. Only set by `getEvent*`. */
  dateHistory?: DateChange[];
};

export type DateChange = {
  date: string;
  changedAt?: string;
  source?: string;
  note?: string;
};

export type SeriesFaq = { question: string; answer: string };

/**
 * Recurrence rule of a curated series (`series.recurrence`, mirrors `Recurrence` in
 * src/data/series.ts). Auto-linked series carry none.
 */
export type SeriesRecurrence =
  | { kind: "fixed"; month: number; day: number; offsetDays?: number }
  | { kind: "nth-weekday"; month: number; weekday: number; n: number; offsetDays?: number }
  | { kind: "easter-offset"; days: number }
  | { kind: "orthodox-easter-offset"; days: number }
  | { kind: "lunar-chinese"; month: number; day: number }
  | { kind: "custom"; rule: string };

/** A recurring series (`public.series`) plus its next occurrence from the `series_next` view. */
export type Series = {
  slug: string;
  title: string;
  category: Category;
  description: string;
  summary?: string;
  tags: string[];
  regions: string[];
  popularity: number;
  featured: boolean;
  faq: SeriesFaq[];
  wikidataQid?: string;
  updatedAt?: string;
  /** Curated recurrence rule, when the series has one (used to reject mis-linked occurrences). */
  recurrence?: SeriesRecurrence;
  /**
   * Next occurrence (undefined when the series has no future dates). Derived from the linked rows
   * that pass the recurrence/region guard (see `catalog.ts`), not blindly from `series_next`.
   */
  nextSlug?: string;
  nextDate?: string;
  nextAllDay?: boolean;
  nextPrecision?: DatePrecision;
  /** Whole days until the next occurrence, computed in SQL at read time. */
  daysUntil?: number;
};

export type SourceInfo = {
  id: string;
  label: string;
  homepage?: string;
  license?: string;
  attribution?: string;
};

export type SearchParams = {
  q?: string;
  category?: Category | "all";
  tag?: string;
  region?: string;
  sort?: "soonest" | "latest" | "popular";
  featured?: boolean;
  minPopularity?: number;
  page?: number;
  pageSize?: number;
};

export type SearchResult = {
  items: CountdownEvent[];
  total: number;
  page: number;
  pageSize: number;
};

export type CatalogMeta = {
  generatedAt: string;
  count: number;
  stats: {
    byCat: Record<string, number>;
    bySrc: Record<string, number>;
    featured: number;
  };
  sources: string[];
  /** `sources.label` keyed by source id, for footer/About display. */
  sourceLabels: Record<string, string>;
};
