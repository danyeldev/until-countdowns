export const CATEGORIES = [
  "holidays",
  "sports",
  "astronomy",
  "space",
  "science",
  "tech",
  "culture",
  "entertainment",
  "film",
  "music",
  "games",
  "politics",
  "nature",
  "history",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type EventSource = "nager" | "curated" | "wikipedia" | "wikidata" | "user";

export type CountdownEvent = {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: string;
  endDate?: string;
  allDay: boolean;
  category: Category;
  tags: string[];
  regions: string[];
  source: EventSource;
  sourceUrl?: string;
  featured: boolean;
  popularity: number;
};

export type CatalogFile = {
  generatedAt: string;
  count: number;
  sources: string[];
  stats: {
    byCat: Record<string, number>;
    bySrc: Record<string, number>;
    featured: number;
  };
  events: CountdownEvent[];
};

export type SearchParams = {
  q?: string;
  category?: Category | "all";
  tag?: string;
  region?: string;
  sort?: "soonest" | "latest" | "popular";
  featured?: boolean;
  page?: number;
  pageSize?: number;
};
