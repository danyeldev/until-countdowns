import type { Category, EventStatus } from "@/lib/types";

/**
 * Recurring series: one row per series in `public.series`, expanded into dated events by the
 * curated adapter (src/lib/ingest/sources/curated.ts) for now..now+14 years.
 *
 * Invariant (tested): `slug === slugify(title)`, so the expanded event slugs
 * (`slugify(title)-YYYY-MM-DD`) share the base that `finalize_catalog()` derives when it links
 * events to series, and the rows written by the old push script line up with these series.
 */
export type Recurrence =
  | { kind: "fixed"; month: number; day: number; offsetDays?: number }
  /** `weekday`: 0 = Sunday … 6 = Saturday; `n`: 1..5, or -1 for the last one. */
  | { kind: "nth-weekday"; month: number; weekday: number; n: number; offsetDays?: number }
  | { kind: "easter-offset"; days: number }
  | { kind: "orthodox-easter-offset"; days: number }
  | { kind: "lunar-chinese"; month: number; day: number }
  | {
      kind: "custom";
      rule: "programmers-day" | "leap-day" | "friday-13th" | "oktoberfest-start";
    };

export type SeriesRule = {
  slug: string;
  title: string;
  category: Category;
  tags: string[];
  regions?: string[];
  recurrence: Recurrence;
  description: string;
  popularity: number;
  featured?: boolean;
  aliases?: string[];
  /** Multi-day events: `end_date = date + durationDays - 1`. */
  durationDays?: number;
  /** Defaults to 1 for computed rules; lower it for rules that are only approximately right. */
  confidence?: number;
  status?: EventStatus;
  sourceUrl?: string;
};

const SUN = 0;
const MON = 1;
const TUE = 2;
const WED = 3;
const THU = 4;
const SAT = 6;

/** Former RECURRING_ASTRONOMY: fixed calendar dates (mean peaks; exact times vary by a day). */
const ASTRONOMY: SeriesRule[] = [
  ["Perseid meteor shower peak", 8, 12, ["meteors", "perseids"], "Swift–Tuttle debris. Best after midnight, away from city lights.", true],
  ["Geminid meteor shower peak", 12, 14, ["meteors", "geminids"], "Often the richest shower of the year — bright, slow meteors from 3200 Phaethon.", true],
  ["Quadrantid meteor shower peak", 1, 3, ["meteors", "quadrantids"], "A sharp January peak. Bundle up.", false],
  ["Lyrid meteor shower peak", 4, 22, ["meteors", "lyrids"], "One of the oldest recorded showers, from comet Thatcher.", false],
  ["Orionid meteor shower peak", 10, 21, ["meteors", "orionids"], "Halley's Comet dust, radiating from Orion.", false],
  ["Leonid meteor shower peak", 11, 17, ["meteors", "leonids"], "Famous for historic storms. Usually modest, occasionally unforgettable.", false],
  ["Ursid meteor shower peak", 12, 22, ["meteors", "ursids"], "A quiet December shower from Ursa Minor.", false],
  ["Eta Aquariid meteor shower peak", 5, 6, ["meteors", "eta-aquariids"], "Another Halley stream — better in the Southern Hemisphere.", false],
  ["Northern Hemisphere summer solstice", 6, 21, ["solstice", "seasons"], "Longest day north of the equator.", true],
  ["Northern Hemisphere winter solstice", 12, 21, ["solstice", "seasons"], "Shortest day north of the equator — and the light begins to return.", true],
  ["March equinox", 3, 20, ["equinox", "seasons"], "Sun over the equator. Spring in the north, autumn in the south.", true],
  ["September equinox", 9, 22, ["equinox", "seasons"], "Sun over the equator again. Harvest in the north.", true],
].map(([title, month, day, tags, description, featured]) => ({
  slug: slugOf(title as string),
  title: title as string,
  category: "astronomy" as const,
  tags: tags as string[],
  recurrence: { kind: "fixed" as const, month: month as number, day: day as number },
  description: description as string,
  popularity: 58,
  featured: featured as boolean,
  confidence: 0.9,
}));

/** Former RECURRING_CULTURE (Programmers' Day and Ada Lovelace Day now use their real rules). */
const CULTURE: SeriesRule[] = [
  fixed("New Year's Day", 1, 1, "holidays", ["new-year"], "The calendar flips.", 95, true, ["new-year", "new-years"]),
  fixed("New Year's Eve", 12, 31, "holidays", ["new-year"], "The last night of the year.", 94, true, ["nye"]),
  fixed("Halloween", 10, 31, "culture", ["halloween"], "Costumes, gourds, and a thin place in the year.", 88, true),
  fixed("Valentine's Day", 2, 14, "culture", ["romance"], "A feast of saints that became a feast of notes and flowers.", 50, false, ["valentines"]),
  fixed("International Women's Day", 3, 8, "culture", ["social"], "A day for women's rights and remembrance.", 50),
  fixed("Pi Day", 3, 14, "science", ["math", "pi"], "3.14. Pie optional, encouraged.", 50),
  fixed("Earth Day", 4, 22, "nature", ["earth-day"], "A global reminder that the only habitable planet we have is this one.", 50),
  fixed("May the Fourth (Star Wars Day)", 5, 4, "entertainment", ["star-wars"], "Be with you.", 50, false, ["star-wars-day"]),
  fixed("World Environment Day", 6, 5, "nature", ["environment"], "UN day for environmental action.", 50),
  fixed("World UFO Day", 7, 2, "culture", ["ufo"], "Anniversary of the 1947 Roswell announcement.", 50),
  fixed("International Friendship Day", 7, 30, "culture", ["friendship"], "UN International Day of Friendship.", 50),
  fixed("International Literacy Day", 9, 8, "culture", ["books"], "UNESCO's day for the written word.", 50),
  {
    slug: "ada-lovelace-day",
    title: "Ada Lovelace Day",
    category: "tech",
    tags: ["ada", "women-in-stem"],
    recurrence: { kind: "nth-weekday", month: 10, weekday: TUE, n: 2 },
    description: "Celebrating women in science and computing, on the second Tuesday of October.",
    popularity: 50,
  },
  {
    slug: "programmers-day",
    title: "Programmers' Day",
    category: "tech",
    tags: ["programming"],
    recurrence: { kind: "custom", rule: "programmers-day" },
    description: "The 256th day of the year — a full 8-bit byte. 13 September, or the 12th in leap years.",
    popularity: 50,
    aliases: ["day-of-the-programmer"],
  },
  fixed("World Space Week begins", 10, 4, "space", ["space"], "Anniversary of Sputnik 1 (4 October 1957).", 50),
  fixed("Carl Sagan Day", 11, 9, "science", ["sagan"], "Birthday of Carl Sagan — pale blue dots, billions and billions.", 50),
  fixed("Human Rights Day", 12, 10, "culture", ["rights"], "Adoption of the Universal Declaration of Human Rights, 1948.", 50),
  fixed("Darwin Day", 2, 12, "science", ["darwin", "evolution"], "Charles Darwin's birthday.", 50),
  fixed("World Oceans Day", 6, 8, "nature", ["ocean"], "UN day for the seas that cover most of this planet.", 50),
  fixed("International Day of Peace", 9, 21, "culture", ["peace"], "UN International Day of Peace.", 50),
];

const MOVEABLE: SeriesRule[] = [
  // —— Easter family (Gregorian computus) ——
  {
    slug: "easter-sunday",
    title: "Easter Sunday",
    category: "holidays",
    tags: ["easter", "religious", "christian"],
    recurrence: { kind: "easter-offset", days: 0 },
    description: "The central feast of the Christian year, on the first Sunday after the first full moon on or after the March equinox.",
    popularity: 85,
    featured: true,
    aliases: ["easter"],
  },
  {
    slug: "good-friday",
    title: "Good Friday",
    category: "holidays",
    tags: ["easter", "religious", "christian"],
    recurrence: { kind: "easter-offset", days: -2 },
    description: "The Friday before Easter, commemorating the crucifixion. A public holiday in much of the world.",
    popularity: 70,
  },
  {
    slug: "ash-wednesday",
    title: "Ash Wednesday",
    category: "religion",
    tags: ["lent", "religious", "christian"],
    recurrence: { kind: "easter-offset", days: -46 },
    description: "The first day of Lent, 46 days before Easter.",
    popularity: 55,
  },
  {
    slug: "mardi-gras",
    title: "Mardi Gras",
    category: "festivals",
    tags: ["carnival", "new-orleans", "festival"],
    regions: ["US", "GLOBAL"],
    recurrence: { kind: "easter-offset", days: -47 },
    description: "Fat Tuesday — the last day of Carnival before Lent. Parades in New Orleans, pancakes elsewhere.",
    popularity: 68,
    aliases: ["fat-tuesday", "shrove-tuesday", "pancake-day"],
  },
  {
    slug: "carnival",
    title: "Carnival",
    category: "festivals",
    tags: ["carnival", "rio", "festival"],
    regions: ["BR", "GLOBAL"],
    recurrence: { kind: "easter-offset", days: -51 },
    durationDays: 6,
    description: "Rio de Janeiro's Carnival opens on the Friday before Ash Wednesday: samba schools, blocos and five days of parades.",
    popularity: 80,
    featured: true,
    aliases: ["rio-carnival", "carnaval"],
  },
  {
    slug: "pentecost",
    title: "Pentecost",
    category: "holidays",
    tags: ["religious", "christian"],
    recurrence: { kind: "easter-offset", days: 49 },
    description: "Whit Sunday, fifty days after Easter. A public holiday in many European countries (with Whit Monday).",
    popularity: 55,
    aliases: ["whit-sunday", "whitsun"],
  },
  {
    slug: "orthodox-easter",
    title: "Orthodox Easter",
    category: "religion",
    tags: ["easter", "religious", "orthodox"],
    regions: ["GR", "RU", "RO", "RS", "UA", "BG", "GLOBAL"],
    recurrence: { kind: "orthodox-easter-offset", days: 0 },
    description: "Pascha in the Eastern Orthodox churches, computed on the Julian calendar — usually a week or more after Western Easter.",
    popularity: 65,
    aliases: ["pascha", "greek-easter"],
  },

  // —— US calendar ——
  {
    slug: "thanksgiving-day",
    title: "Thanksgiving Day",
    category: "holidays",
    tags: ["thanksgiving", "family"],
    regions: ["US"],
    recurrence: { kind: "nth-weekday", month: 11, weekday: THU, n: 4 },
    description: "The fourth Thursday of November: turkey, parades, football and the start of the holiday season in the United States.",
    popularity: 90,
    featured: true,
    aliases: ["thanksgiving", "turkey-day"],
  },
  {
    slug: "black-friday",
    title: "Black Friday",
    category: "culture",
    tags: ["shopping", "sales"],
    regions: ["US", "GLOBAL"],
    recurrence: { kind: "nth-weekday", month: 11, weekday: THU, n: 4, offsetDays: 1 },
    description: "The day after Thanksgiving — the biggest shopping day of the year, now observed far beyond the United States.",
    popularity: 78,
  },
  {
    slug: "cyber-monday",
    title: "Cyber Monday",
    category: "culture",
    tags: ["shopping", "sales", "online"],
    regions: ["US", "GLOBAL"],
    recurrence: { kind: "nth-weekday", month: 11, weekday: THU, n: 4, offsetDays: 4 },
    description: "The Monday after Thanksgiving, when online retailers run their deepest discounts.",
    popularity: 60,
  },
  {
    slug: "mother-s-day",
    title: "Mother's Day",
    category: "culture",
    tags: ["family"],
    regions: ["US", "CA", "AU", "DE", "IT", "JP", "BR"],
    recurrence: { kind: "nth-weekday", month: 5, weekday: SUN, n: 2 },
    description: "The second Sunday of May, as observed in the United States and most of the world (the UK celebrates Mothering Sunday in Lent).",
    popularity: 72,
    aliases: ["mothers-day"],
  },
  {
    slug: "father-s-day",
    title: "Father's Day",
    category: "culture",
    tags: ["family"],
    regions: ["US", "CA", "GB", "FR", "IN", "JP"],
    recurrence: { kind: "nth-weekday", month: 6, weekday: SUN, n: 3 },
    description: "The third Sunday of June in the United States, the UK and many other countries.",
    popularity: 65,
    aliases: ["fathers-day"],
  },
  {
    slug: "super-bowl",
    title: "Super Bowl",
    category: "sports",
    tags: ["nfl", "super-bowl", "american-football"],
    regions: ["US", "GLOBAL"],
    recurrence: { kind: "nth-weekday", month: 2, weekday: SUN, n: 2 },
    description: "The NFL championship game, played on the second Sunday of February since the 2021 season.",
    popularity: 90,
    featured: true,
    confidence: 0.9,
    aliases: ["superbowl", "super-bowl-sunday"],
  },
  {
    slug: "daylight-saving-time-begins-us",
    title: "Daylight saving time begins (US)",
    category: "curiosities",
    tags: ["dst", "clocks", "time"],
    regions: ["US", "CA"],
    recurrence: { kind: "nth-weekday", month: 3, weekday: SUN, n: 2 },
    description: "Clocks spring forward one hour at 2 a.m. on the second Sunday of March in the United States and Canada.",
    popularity: 60,
    aliases: ["spring-forward", "dst-starts-us"],
  },
  {
    slug: "daylight-saving-time-ends-us",
    title: "Daylight saving time ends (US)",
    category: "curiosities",
    tags: ["dst", "clocks", "time"],
    regions: ["US", "CA"],
    recurrence: { kind: "nth-weekday", month: 11, weekday: SUN, n: 1 },
    description: "Clocks fall back one hour at 2 a.m. on the first Sunday of November in the United States and Canada.",
    popularity: 60,
    aliases: ["fall-back", "dst-ends-us"],
  },
  {
    slug: "summer-time-begins-europe",
    title: "Summer time begins (Europe)",
    category: "curiosities",
    tags: ["dst", "clocks", "time"],
    regions: ["GB", "DE", "FR", "ES", "IT", "NL", "PL"],
    recurrence: { kind: "nth-weekday", month: 3, weekday: SUN, n: -1 },
    description: "European clocks go forward at 01:00 UTC on the last Sunday of March.",
    popularity: 58,
    aliases: ["dst-starts-eu", "british-summer-time-begins"],
  },
  {
    slug: "summer-time-ends-europe",
    title: "Summer time ends (Europe)",
    category: "curiosities",
    tags: ["dst", "clocks", "time"],
    regions: ["GB", "DE", "FR", "ES", "IT", "NL", "PL"],
    recurrence: { kind: "nth-weekday", month: 10, weekday: SUN, n: -1 },
    description: "European clocks go back at 01:00 UTC on the last Sunday of October.",
    popularity: 58,
    aliases: ["dst-ends-eu", "british-summer-time-ends"],
  },

  // —— Lunisolar ——
  {
    slug: "chinese-new-year",
    title: "Chinese New Year",
    category: "holidays",
    tags: ["lunar-new-year", "spring-festival"],
    regions: ["CN", "TW", "HK", "SG", "MY", "VN", "KR", "GLOBAL"],
    recurrence: { kind: "lunar-chinese", month: 1, day: 1 },
    description: "The first day of the Chinese lunisolar year — the Spring Festival, and the largest annual human migration on Earth.",
    popularity: 90,
    featured: true,
    aliases: ["lunar-new-year", "spring-festival", "tet"],
  },

  // —— Sports (rule-based, reconciled yearly) ——
  marathon("Boston Marathon", 4, MON, 3, ["US"], "Run on Patriots' Day, the third Monday of April, from Hopkinton to Boylston Street.", 66),
  marathon("Berlin Marathon", 9, SUN, -1, ["DE"], "The flattest and fastest of the majors, on the last Sunday of September.", 60),
  marathon("Chicago Marathon", 10, SUN, 2, ["US"], "The second Sunday of October through 29 Chicago neighbourhoods.", 58),
  marathon("New York City Marathon", 11, SUN, 1, ["US"], "The world's largest marathon, through all five boroughs on the first Sunday of November.", 66),
  marathon("Tokyo Marathon", 3, SUN, 1, ["JP"], "The Asian major, on the first Sunday of March.", 56),
  {
    slug: "wimbledon",
    title: "Wimbledon",
    category: "sports",
    tags: ["tennis", "grand-slam", "wimbledon"],
    regions: ["GB"],
    recurrence: { kind: "nth-weekday", month: 6, weekday: MON, n: -1 },
    durationDays: 14,
    description: "The Championships open on the last Monday of June (two weeks on the grass at the All England Club). Approximate until the LTA confirms.",
    popularity: 76,
    confidence: 0.85,
    aliases: ["the-championships"],
  },
  {
    slug: "us-open-tennis",
    title: "US Open tennis",
    category: "sports",
    tags: ["tennis", "grand-slam", "us-open"],
    regions: ["US"],
    recurrence: { kind: "nth-weekday", month: 9, weekday: MON, n: 1, offsetDays: -7 },
    durationDays: 14,
    description: "The last Grand Slam of the year starts in Flushing Meadows on the Monday before Labor Day.",
    popularity: 70,
    confidence: 0.85,
  },
  {
    slug: "australian-open",
    title: "Australian Open",
    category: "sports",
    tags: ["tennis", "grand-slam", "australian-open"],
    regions: ["AU"],
    recurrence: { kind: "nth-weekday", month: 1, weekday: MON, n: 2, offsetDays: 6 },
    durationDays: 15,
    description: "The first Grand Slam of the year in Melbourne, mid-January. Rule of thumb (second Monday + 6 days); the exact start is announced each year.",
    popularity: 68,
    confidence: 0.8,
    status: "tentative",
  },

  // —— Festivals ——
  {
    slug: "oktoberfest",
    title: "Oktoberfest",
    category: "festivals",
    tags: ["beer", "munich", "festival"],
    regions: ["DE"],
    recurrence: { kind: "custom", rule: "oktoberfest-start" },
    durationDays: 16,
    description: "The Munich Wiesn opens on the Saturday after 15 September with the mayor's 'O'zapft is!'.",
    popularity: 74,
    featured: true,
    confidence: 0.9,
  },
  {
    slug: "la-tomatina",
    title: "La Tomatina",
    category: "festivals",
    tags: ["tomatoes", "spain", "festival"],
    regions: ["ES"],
    recurrence: { kind: "nth-weekday", month: 8, weekday: WED, n: -1 },
    description: "Buñol's tomato fight, held on the last Wednesday of August.",
    popularity: 58,
  },
  {
    slug: "san-fermin",
    title: "San Fermín",
    category: "festivals",
    tags: ["pamplona", "spain", "festival"],
    regions: ["ES"],
    recurrence: { kind: "fixed", month: 7, day: 6 },
    durationDays: 9,
    description: "The chupinazo opens Pamplona's festival at noon on 6 July; the bulls run at 8 a.m. from the 7th to the 14th.",
    popularity: 62,
    aliases: ["running-of-the-bulls", "sanfermines"],
  },

  // —— Science / culture ——
  {
    slug: "nobel-prize-ceremony",
    title: "Nobel Prize ceremony",
    category: "science",
    tags: ["nobel", "awards"],
    regions: ["SE", "NO", "GLOBAL"],
    recurrence: { kind: "fixed", month: 12, day: 10 },
    description: "The Nobel Prizes are presented in Stockholm (and the Peace Prize in Oslo) on 10 December, the anniversary of Alfred Nobel's death.",
    popularity: 62,
    aliases: ["nobel-day"],
  },
  {
    slug: "doomsday-clock-announcement",
    title: "Doomsday Clock announcement",
    category: "science",
    tags: ["doomsday-clock", "nuclear", "climate"],
    recurrence: { kind: "nth-weekday", month: 1, weekday: TUE, n: -1 },
    description: "The Bulletin of the Atomic Scientists resets the Doomsday Clock in late January. Approximate: the exact day is announced a few weeks ahead.",
    popularity: 55,
    confidence: 0.7,
    status: "tentative",
  },
  {
    slug: "public-domain-day",
    title: "Public Domain Day",
    category: "culture",
    tags: ["copyright", "public-domain", "books"],
    recurrence: { kind: "fixed", month: 1, day: 1 },
    description: "Every 1 January a new year's worth of books, films and music enters the public domain as copyrights expire.",
    popularity: 52,
  },

  // —— Curiosities ——
  {
    slug: "leap-day",
    title: "Leap Day",
    category: "curiosities",
    tags: ["calendar", "leap-year"],
    recurrence: { kind: "custom", rule: "leap-day" },
    description: "29 February — the extra day that keeps the calendar in step with the seasons, once every four years (mostly).",
    popularity: 66,
    featured: true,
    aliases: ["february-29", "leap-year-day"],
  },
  {
    slug: "friday-the-13th",
    title: "Friday the 13th",
    category: "curiosities",
    tags: ["calendar", "superstition"],
    recurrence: { kind: "custom", rule: "friday-13th" },
    description: "Every year has at least one and at most three. Unlucky for some, a good excuse for a horror marathon for the rest.",
    popularity: 45,
  },
];

/**
 * Music — the annual dates. Why this block exists: `/category/music` held ONE published future row
 * against 169 for `festivals` and 15 for `entertainment` (live counts from the catalog survey that
 * asked for this work — not measured here), and its "Every year" rail was empty. The one row is
 * accounted for: expanding this file plus src/data/curated.ts for a 2026-09-10 "now" produced
 * exactly one `music` row before this block existed, the 2029 Woodstock anniversary (measured here,
 * `computeCuratedRows`) — so no other source is contributing music at all. Nothing in the catalog
 * *can* produce a recurring music date:
 *
 *   • Wikidata phase 1 queries Q4504495 (award ceremony) directly with `fallback: "entertainment"`,
 *     and `categoryFor()` (sources/wikidata.ts) only lets a tag rule override a fallback that is in
 *     GENERIC — which holds `culture` alone. So a Grammy or BRITs row from that class is
 *     `entertainment` by construction and can never reach `music`.
 *   • The AWARD_CATEGORIES map that would send "grammy|brit awards|eurovision" to `music`
 *     (sources/wikidata/more.ts) is only ever consulted by phase 2, and phase 2's awards family
 *     carries `minusDirect: true` — `MINUS { ?item wdt:P31 wd:Q4504495 }` — i.e. it excludes exactly
 *     the items phase 1 just took. The map can only recategorise ceremonies that sit DEEPER in the
 *     subtree; the ones this hub wants are direct instances.
 *   • Neither phase can make a SERIES either. `finalize_catalog()` (0009_indexable_summary.sql)
 *     derives series only from `holidays|curated|observances|astronomy|hebcal|aladhan|hindu|
 *     curiosities|openholidays` rows whose slug base repeats across ≥ 2 years, and a Wikidata
 *     ceremony label carries its ordinal, so the base differs yearly. GUESS how general that is —
 *     the only labels anyone here has seen are the two recorded in tests/fixtures/wikidata/
 *     awards.json ("99th Academy Awards", "78th Primetime Emmy Awards"), both ordinal-carrying.
 *
 * A rule here is therefore the only route to that rail. Cost: `finalize_catalog()` queues a summary
 * AND an image job for every series-linked future row whatever its popularity (`or e.series_slug is
 * not null`), so the 71 rows these five rules expand to (measured here at a 2026-09-10 "now" and
 * pinned in tests/ingest/recurrence.test.ts: five rules × 15 years, less the four occurrences
 * already past this year) are 142 jobs on the first pass after this lands. At the per-job costs in
 * src/lib/enrich/run.ts (2.5 s summary, 3.5 s image) against its 240 s budget, and the ten-minute
 * enrich cron in vercel.json, that is two or three runs if the queue is otherwise empty — half an
 * hour, once — and then five rows a year.
 *
 * WHAT IS NOT VERIFIED. No date below was checked against a source: this was written on a machine
 * with no outbound network — no SPARQL query, no ticket page, nothing fetched — so every "held on X
 * since Y" is recalled from the author's knowledge. GUESS, all of it; the per-rule comments name the
 * years the recollection covers so a reviewer can spot-check them instead of trusting a claim. What
 * IS checked is the arithmetic: the weekday and ordinal of every date quoted below were computed
 * here, and tests/ingest/recurrence.test.ts pins the occurrence each rule produces.
 *
 * DELIBERATELY ABSENT. Each of these moves on no rule any {@link Recurrence} kind can state, and a
 * rule that is a week wrong every other year is worse than an absent row — it would ship a
 * confidently wrong countdown forever. They belong in src/data/curated.ts as dated one-offs the day
 * their date is announced (`series:` links them to a rule here when one exists, exactly as
 * "Super Bowl LX" does):
 *   • Eurovision Song Contest — a Saturday in May chosen by the EBU with the host broadcaster, and
 *     it wanders: 2023-05-13 and 2024-05-11 were second Saturdays, 2025-05-17 and 2026-05-16 third,
 *     2021-05-22 fourth, 2010-05-29 fifth. See the skipped 2026 entry in src/data/curated.ts.
 *   • BRIT Awards — 2024-03-02 and 2025-03-01 were first Saturdays of March, 2026-02-28 the last
 *     Saturday of February, 2023-02-11 the second: same weekday, no rule.
 *   • MTV VMAs — not even a fixed weekday (2022-08-28 Sun, 2023-09-12 Tue, 2024-09-11 Wed,
 *     2025-09-07 Sun), and the month flips between August and September.
 *   • Mercury Prize — a September ceremony for years, then 2025-10-16 in Bradford once it began
 *     moving around the UK.
 *   • Glastonbury — fallow years break any rule outright (2026 was announced as one), and even the
 *     Wednesday moves: 2023-06-21 was the third Wednesday of June, 2024-06-26 and 2025-06-25 the
 *     last, 2022-06-22 the fourth of five.
 *   • Rock in Rio — alternates Rio and Lisbon on a biennial-per-city cycle, which is a two-year
 *     recurrence; every kind here is annual.
 *   • Montreux Jazz — anchored near 1 July, but 2022-07-01 and 2025-07-04 opened on the first Friday
 *     of July while 2023-06-30 and 2019-06-28 opened in June.
 *   • Coachella and Tomorrowland are omitted for a different reason: they are music FESTIVALS, and
 *     this repo files those under `festivals` (sources/wanted/resolve.ts maps Q868557 "music
 *     festival" → festivals; musicbrainz.ts does the same), which is the hub that already has 169
 *     rows. Adding them here would not fill the music rail and would risk a second row beside the
 *     Wikidata festival one. FWIW the rules look real if anyone wants them in `festivals`:
 *     Tomorrowland's first weekend was the third Friday of July in 2018, 2019, 2022, 2023, 2024 and
 *     2025; Coachella's was the second Friday of April in 2019 and 2023-2026 but the third in 2016
 *     and 2022 — both Aprils that opened on a Friday.
 */
const MUSIC: SeriesRule[] = [
  {
    slug: "grammy-awards",
    title: "Grammy Awards",
    category: "music",
    tags: ["awards", "grammys", "ceremony"],
    regions: ["US", "GLOBAL"],
    // First Sunday of February — 2023-02-05, 2024-02-04, 2025-02-02 and 2026-02-01, four running.
    // Only four: the ceremony moved freely before that (2019-02-10 a second Sunday, 2020-01-26 a
    // January one, 2021-03-14 and 2022-04-03 pandemic reschedules), which is why this is `tentative`
    // at 0.8 rather than a flat rule. The Recording Academy still announces each date, and a dated
    // one-off carrying `series: "grammy-awards"` replaces the computed occurrence for that year.
    recurrence: { kind: "nth-weekday", month: 2, weekday: SUN, n: 1 },
    description:
      "Music's awards night: the Recording Academy hands out the gramophones on the first Sunday of February, with the exact date confirmed by the Academy each year.",
    popularity: 72,
    confidence: 0.8,
    status: "tentative",
    aliases: ["grammys", "the-grammys"],
  },
  {
    slug: "fete-de-la-musique",
    title: "Fête de la Musique",
    category: "music",
    tags: ["music-day", "street-music", "solstice"],
    regions: ["FR", "GLOBAL"],
    // 21 June by definition, not by scheduling: France's Ministry of Culture pinned it to the
    // summer solstice when it started in 1982, and the adoptions abroad (as World Music Day or Make
    // Music Day) kept the same day — so, unlike a ceremony, there is no year that picks a different
    // one. GUESS like every date in this block; no counter-example is recalled, none was looked up.
    //
    // OVERLAP: the `observances` adapter harvests Wikidata P837 world days and files them as
    // `awareness`, so this day may already arrive from there. That is not a duplicate — curated is
    // rank 9 and `upsert_events` lets the higher rank overwrite `category`, so the row moves to
    // `music` and gains its series link — but only if the titles produce the same slug base. This
    // one is spelled as Wikidata's English label (GUESS: unverified here); if the harvest emits
    // "World Music Day" instead, 21 June carries two rows until the titles are reconciled.
    recurrence: { kind: "fixed", month: 6, day: 21 },
    description:
      "Free music in the streets on the summer solstice, from the 1982 French original to the many countries that now join in as World Music Day.",
    popularity: 55,
    aliases: ["world-music-day", "make-music-day"],
  },
  {
    slug: "international-jazz-day",
    title: "International Jazz Day",
    category: "music",
    tags: ["jazz", "unesco"],
    // 30 April, fixed by the UNESCO General Conference resolution that created the day (2011, first
    // held 2012 — recalled, GUESS, like every date in this block). What makes the rule safe is not
    // the citation but the shape: a designated international day IS a date, so unlike a ceremony
    // there is nothing to reconcile each year. Same `observances` overlap as Fête de la Musique.
    recurrence: { kind: "fixed", month: 4, day: 30 },
    description:
      "UNESCO's day for jazz as a language of freedom, marked every 30 April with concerts, workshops and an all-star global gala.",
    popularity: 48,
    aliases: ["jazz-day"],
  },
  {
    slug: "last-night-of-the-proms",
    title: "Last Night of the Proms",
    category: "music",
    tags: ["classical", "bbc", "royal-albert-hall"],
    regions: ["GB"],
    // Second Saturday of September, closing the BBC Proms season: 2017-09-09, 2018-09-08,
    // 2019-09-14, 2021-09-11, 2023-09-09, 2024-09-14, 2025-09-13 — seven recalled seasons with no
    // counter-example among them (2020's season was rebuilt without audiences). Long enough to state
    // as a rule; the BBC still publishes the season each spring, hence 0.85, the same treatment
    // Wimbledon's last-Monday rule gets. The `bbc-proms` alias points here rather than at the season
    // opening in mid-July because the opening moves (13-19 July across recent years) and the closing
    // night does not — the last night is the only Proms date this file can state truthfully.
    recurrence: { kind: "nth-weekday", month: 9, weekday: SAT, n: 2 },
    description:
      "The Royal Albert Hall sings out the BBC Proms season on the second Saturday of September — flags, Elgar, and the Fantasia on British Sea Songs.",
    popularity: 52,
    confidence: 0.85,
    aliases: ["bbc-proms", "the-proms"],
  },
  {
    slug: "vienna-new-year-s-concert",
    title: "Vienna New Year's Concert",
    category: "music",
    tags: ["classical", "strauss", "new-year"],
    regions: ["AT", "GLOBAL"],
    // 1 January, every year since 1941 (the first was played on 31 December 1939 — recalled, GUESS,
    // like every date in this block). Safe as a `fixed` rule for the same reason as the two days
    // above and unlike the Grammys: New Year's morning is the identity of the concert, not a slot
    // someone books, so there is no announcement each year that could move it.
    recurrence: { kind: "fixed", month: 1, day: 1 },
    description:
      "The Vienna Philharmonic plays Strauss waltzes and polkas in the Musikverein on New Year's morning, broadcast around the world.",
    popularity: 50,
    aliases: ["neujahrskonzert"],
  },
];

export const SERIES: SeriesRule[] = [...ASTRONOMY, ...CULTURE, ...MOVEABLE, ...MUSIC];

function slugOf(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function fixed(
  title: string,
  month: number,
  day: number,
  category: Category,
  tags: string[],
  description: string,
  popularity: number,
  featured = false,
  aliases?: string[],
): SeriesRule {
  return { slug: slugOf(title), title, category, tags, recurrence: { kind: "fixed", month, day }, description, popularity, featured, aliases };
}

function marathon(
  title: string,
  month: number,
  wd: number,
  n: number,
  regions: string[],
  description: string,
  popularity: number,
): SeriesRule {
  return {
    slug: slugOf(title),
    title,
    category: "sports",
    tags: ["running", "marathon", "world-marathon-majors"],
    regions,
    recurrence: { kind: "nth-weekday", month, weekday: wd, n },
    description,
    popularity,
    confidence: 0.85,
  };
}
