import type { Category } from "./types";

/** Path-paginated hubs (`/category/[c]`, `/tag/[t]`): rows per page and the deepest page served. */
export const HUB_PAGE_SIZE = { category: 24, tag: 48 } as const;
export const HUB_MAX_PAGE = { category: 500, tag: 200 } as const;

export type CategoryGroup = {
  id: string;
  label: string;
  tagline: string;
  categories: Category[];
};

/** Home-page grouping of the 23 categories. Order is editorial, not alphabetical. */
export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: "celebrate",
    label: "Celebrate",
    tagline: "Holidays, feast days and the excuses we keep.",
    categories: ["holidays", "national", "religion", "awareness", "fun", "culture", "festivals"],
  },
  {
    id: "watch",
    label: "Watch",
    tagline: "Finals, premieres, tours and the next big drop.",
    categories: ["sports", "esports", "film", "tv", "anime", "music", "entertainment"],
  },
  {
    id: "play",
    label: "Play",
    tagline: "Release dates and showcases.",
    categories: ["games"],
  },
  {
    id: "look-up",
    label: "Look up",
    tagline: "Launches, eclipses and the living year.",
    categories: ["space", "astronomy", "science", "nature"],
  },
  {
    id: "vote",
    label: "Vote",
    tagline: "Elections, conferences and the clocks computers keep.",
    categories: ["politics", "tech"],
  },
  {
    id: "wonder",
    label: "Wonder",
    tagline: "Anniversaries and calendar oddities.",
    categories: ["history", "curiosities"],
  },
];

export function groupOf(category: Category): CategoryGroup | undefined {
  return CATEGORY_GROUPS.find((g) => g.categories.includes(category));
}
