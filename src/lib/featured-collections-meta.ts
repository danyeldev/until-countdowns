export const FEATURED_COLLECTION_SLUGS = [
  "scream-this-month",
  "get-drunk-this-week",
  "movies-this-week",
  "new-seasons-same-couch",
  "weekend-ruining-games",
  "holidays-nobody-asked-for",
] as const;

export type FeaturedCollectionSlug = (typeof FEATURED_COLLECTION_SLUGS)[number];

export type FeaturedCollection = {
  slug: FeaturedCollectionSlug;
  title: string;
  description: string;
  keywords: string[];
};

export const FEATURED_COLLECTIONS: FeaturedCollection[] = [
  {
    slug: "scream-this-month",
    title: "The best horror this month",
    description:
      "Premieres, Halloween, and whatever will make you check the closet. Lights on is allowed.",
    keywords: ["horror", "halloween", "scream", "slasher", "haunted", "friday the 13th"],
  },
  {
    slug: "get-drunk-this-week",
    title: "Festivals to get drunk this week",
    description:
      "Oktoberfest, chug fests, and weekends that start on a Wednesday. Hydrate, then don't.",
    keywords: ["drunk", "festival", "festivals", "oktoberfest", "beer", "chug"],
  },
  {
    slug: "movies-this-week",
    title: "Movies dropping this week",
    description: "New films in the next seven days. See one so you have an opinion by Monday.",
    keywords: ["movie", "movies", "film", "films", "cinema"],
  },
  {
    slug: "new-seasons-same-couch",
    title: "New seasons, same couch",
    description: "TV premieres landing this week. Your plans were a rumor.",
    keywords: ["tv", "television", "premiere", "premieres", "season", "seasons"],
  },
  {
    slug: "weekend-ruining-games",
    title: "Games that will eat your weekend",
    description: "Releases close enough that you should hide your login from your boss.",
    keywords: ["game", "games", "gaming", "weekend"],
  },
  {
    slug: "holidays-nobody-asked-for",
    title: "Holidays nobody asked for",
    description:
      "Batman Day, Talk Like a Pirate Day, Ask a Stupid Question Day — official excuses to be weird.",
    keywords: ["holiday", "holidays", "pirate", "batman", "fun"],
  },
];

const FEATURED_SLUG_SET = new Set<string>(FEATURED_COLLECTION_SLUGS);

export function parseFeaturedCollectionSlug(value: unknown): FeaturedCollectionSlug | null {
  return typeof value === "string" && FEATURED_SLUG_SET.has(value)
    ? (value as FeaturedCollectionSlug)
    : null;
}

export function featuredCollectionHref(slug: FeaturedCollectionSlug | string): string {
  return `/collections/featured/${slug}`;
}

export function featuredCollectionIcsPath(slug: FeaturedCollectionSlug | string): string {
  return `/api/ics/featured/${slug}`;
}
