import type { Category } from "./types";

export const CATEGORY_LABELS: Record<Category, string> = {
  holidays: "Holidays",
  sports: "Sports",
  astronomy: "Astronomy",
  space: "Space",
  science: "Science",
  tech: "Tech",
  culture: "Culture",
  entertainment: "Entertainment",
  film: "Film",
  music: "Music",
  games: "Games",
  politics: "Politics",
  nature: "Nature",
  history: "History",
};

export const CATEGORY_BLURB: Record<Category, string> = {
  holidays: "National days, new years, and the rituals we keep.",
  sports: "Finals, opening ceremonies, and the next World Cup.",
  astronomy: "Eclipses, showers, solstices — appointments with the sky.",
  space: "Launches, landings, and the long way back to the Moon.",
  science: "Dates for the curious.",
  tech: "Conferences, anniversaries, and the clocks computers keep.",
  culture: "Festivals, feast days, and the civic calendar.",
  entertainment: "Fandom dates and pop-culture holy days.",
  film: "Awards nights and premieres.",
  music: "Contests, anniversaries, three days of peace and music.",
  games: "Releases and championships.",
  politics: "Elections and the dates that steer countries.",
  nature: "Earth, oceans, and the living year.",
  history: "Anniversaries of things that already happened — still ticking.",
};
