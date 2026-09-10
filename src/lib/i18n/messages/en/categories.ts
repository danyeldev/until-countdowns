/**
 * The 23 category names and their one-line blurbs, plus the six editorial groups the home page
 * arranges them in.
 *
 * Category *slugs* are database keys and stay English in the URL (`/es/categoria/sports`); only the
 * label a reader sees is translated. Keeping the slug means a hub that ranks today keeps its URL,
 * and a mistranslated word can never 404 a page.
 */
export const categories = {
  labels: {
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
  },

  blurbs: {
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
  },

  /** Home-page grouping (`CATEGORY_GROUPS` in src/lib/taxonomy.ts owns which categories go where). */
  groups: {
    celebrate: { label: "Celebrate", tagline: "Holidays, feast days and the excuses we keep." },
    watch: { label: "Watch", tagline: "Finals, premieres, tours and the next big drop." },
    play: { label: "Play", tagline: "Release dates and showcases." },
    "look-up": { label: "Look up", tagline: "Launches, eclipses and the living year." },
    vote: { label: "Vote", tagline: "Elections, conferences and the clocks computers keep." },
    wonder: { label: "Wonder", tagline: "Anniversaries and calendar oddities." },
  },
};
