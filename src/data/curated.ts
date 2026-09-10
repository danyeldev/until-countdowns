import type { Category, DatePrecision, EventStatus } from "@/lib/types";

/**
 * Hand-maintained one-off future dates. The canonical copy of the data that used to live in
 * scripts/curated.mjs (kept there only so `scripts/push-catalog.mjs` still runs; a test keeps
 * both in sync). Recurring dates live in src/data/series.ts.
 *
 * Rules: `date` is `YYYY-MM-DD` or an ISO instant; `datePrecision` other than day makes the row
 * `tentative`; `series` links a one-off to a series slug — the series expansion then skips its own
 * occurrence for that date so the richer one-off row is the one that carries the series link.
 */
export type CuratedEvent = {
  title: string;
  date: string;
  endDate?: string;
  category: Category;
  tags: string[];
  regions: string[];
  featured?: boolean;
  popularity?: number;
  allDay?: boolean;
  description?: string;
  sourceUrl?: string;
  datePrecision?: DatePrecision;
  status?: EventStatus;
  series?: string;
  /** Kept in the list for the record but never emitted. */
  skip?: boolean;
};

export const CURATED: CuratedEvent[] = [
  {
    title: "Milano Cortina 2026 Winter Olympics",
    date: "2026-02-06",
    endDate: "2026-02-22",
    category: "sports",
    tags: ["olympics","winter","italy"],
    regions: ["IT","GLOBAL"],
    featured: true,
    popularity: 98,
    description:
      "The XXV Olympic Winter Games open in Milan and Cortina d'Ampezzo — alpine skiing, skating, and the return of the Games to Italy.",
    sourceUrl: "https://www.milanocortina2026.org/",
  },
  {
    title: "Super Bowl LX",
    date: "2026-02-08",
    category: "sports",
    tags: ["nfl","super-bowl","american-football"],
    regions: ["US"],
    featured: true,
    popularity: 96,
    description:
      "Super Bowl LX at Levi's Stadium in Santa Clara. The NFL's championship Sunday.",
    series: "super-bowl",
  },
  {
    title: "FIFA World Cup 2026",
    date: "2026-06-11",
    endDate: "2026-07-19",
    category: "sports",
    tags: ["football","soccer","world-cup","fifa"],
    regions: ["US","CA","MX","GLOBAL"],
    featured: true,
    popularity: 100,
    description:
      "The first 48-team World Cup, hosted across the United States, Mexico, and Canada. Opening match in Mexico City; final at MetLife Stadium.",
    sourceUrl: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026",
  },
  {
    title: "FIFA World Cup 2026 Final",
    date: "2026-07-19",
    category: "sports",
    tags: ["football","soccer","world-cup","final"],
    regions: ["US","GLOBAL"],
    featured: true,
    popularity: 99,
    description:
      "World Cup final at MetLife Stadium in East Rutherford, New Jersey.",
  },
  {
    title: "Asian Games 2026 — Aichi-Nagoya",
    date: "2026-09-19",
    endDate: "2026-10-04",
    category: "sports",
    tags: ["asian-games","multi-sport","japan"],
    regions: ["JP"],
    featured: true,
    popularity: 78,
    description:
      "The 20th Asian Games in Aichi Prefecture and Nagoya, Japan.",
  },
  {
    title: "FIFA Women's World Cup 2027",
    date: "2027-06-24",
    endDate: "2027-07-25",
    category: "sports",
    tags: ["football","soccer","world-cup","women"],
    regions: ["BR","GLOBAL"],
    featured: true,
    popularity: 88,
    description:
      "The expanded Women's World Cup in Brazil.",
  },
  {
    title: "UEFA Euro 2028",
    date: "2028-06-09",
    endDate: "2028-07-09",
    category: "sports",
    tags: ["football","soccer","euro","uefa"],
    regions: ["GB","IE","GLOBAL"],
    featured: true,
    popularity: 90,
    description:
      "European Championship hosted by the United Kingdom and Ireland.",
  },
  {
    title: "Los Angeles 2028 Summer Olympics",
    date: "2028-07-14",
    endDate: "2028-07-30",
    category: "sports",
    tags: ["olympics","summer","usa"],
    regions: ["US","GLOBAL"],
    featured: true,
    popularity: 99,
    description:
      "The Games of the XXXIV Olympiad return to Los Angeles — a city that last hosted in 1984.",
    sourceUrl: "https://la28.org/",
  },
  {
    title: "French Alps 2030 Winter Olympics",
    date: "2030-02-01",
    endDate: "2030-02-17",
    category: "sports",
    tags: ["olympics","winter","france"],
    regions: ["FR","GLOBAL"],
    featured: true,
    popularity: 86,
    description:
      "The XXVI Olympic Winter Games in the French Alps.",
  },
  {
    title: "FIFA World Cup 2030",
    date: "2030-06-08",
    endDate: "2030-07-21",
    category: "sports",
    tags: ["football","soccer","world-cup","fifa"],
    regions: ["ES","PT","MA","UY","AR","PY","GLOBAL"],
    featured: true,
    popularity: 97,
    description:
      "The centenary World Cup: Spain, Portugal, and Morocco host the tournament, with opening anniversary matches in Uruguay, Argentina, and Paraguay.",
  },
  {
    title: "UEFA Euro 2032",
    date: "2032-06-11",
    endDate: "2032-07-11",
    category: "sports",
    tags: ["football","soccer","euro","uefa"],
    regions: ["IT","TR","GLOBAL"],
    featured: true,
    popularity: 84,
    description:
      "European Championship co-hosted by Italy and Türkiye.",
  },
  {
    title: "Brisbane 2032 Summer Olympics",
    date: "2032-07-23",
    endDate: "2032-08-08",
    category: "sports",
    tags: ["olympics","summer","australia"],
    regions: ["AU","GLOBAL"],
    featured: true,
    popularity: 92,
    description:
      "The Games of the XXXV Olympiad — Australia's first Summer Games since Sydney 2000.",
  },
  {
    title: "Super Bowl LXI",
    date: "2027-02-14",
    category: "sports",
    tags: ["nfl","super-bowl"],
    regions: ["US"],
    featured: true,
    popularity: 90,
    description:
      "Super Bowl LXI — NFL championship Sunday.",
    series: "super-bowl",
  },
  {
    title: "Super Bowl LXII",
    date: "2028-02-13",
    category: "sports",
    tags: ["nfl","super-bowl"],
    regions: ["US"],
    popularity: 88,
    description:
      "Super Bowl LXII — NFL championship Sunday.",
    series: "super-bowl",
  },
  {
    title: "Super Bowl LXIII",
    date: "2029-02-11",
    category: "sports",
    tags: ["nfl","super-bowl"],
    regions: ["US"],
    popularity: 86,
    description:
      "Super Bowl LXIII — NFL championship Sunday.",
    series: "super-bowl",
  },
  {
    title: "Super Bowl LXIV",
    date: "2030-02-10",
    category: "sports",
    tags: ["nfl","super-bowl"],
    regions: ["US"],
    popularity: 84,
    description:
      "Super Bowl LXIV — NFL championship Sunday.",
    series: "super-bowl",
  },
  {
    title: "Tour de France 2026",
    date: "2026-07-04",
    endDate: "2026-07-26",
    category: "sports",
    tags: ["cycling","tour-de-france"],
    regions: ["FR"],
    popularity: 74,
    description:
      "The 113th Tour de France.",
  },
  {
    title: "Wimbledon 2026",
    date: "2026-06-29",
    endDate: "2026-07-12",
    category: "sports",
    tags: ["tennis","grand-slam","wimbledon"],
    regions: ["GB"],
    popularity: 76,
    description:
      "The Championships, Wimbledon — strawberries, grass, and the oldest tennis tournament.",
    series: "wimbledon",
  },
  {
    title: "Boston Marathon 2026",
    date: "2026-04-20",
    category: "sports",
    tags: ["running","marathon"],
    regions: ["US"],
    popularity: 62,
    description:
      "The 130th Boston Marathon, run on Patriots' Day.",
    series: "boston-marathon",
  },
  {
    title: "Annular Solar Eclipse",
    date: "2026-02-17",
    category: "astronomy",
    tags: ["eclipse","solar","annular"],
    regions: ["GLOBAL"],
    featured: true,
    popularity: 80,
    description:
      "A ring-of-fire eclipse crossing Antarctica and the southern Indian and Pacific Oceans.",
    sourceUrl: "https://eclipse.gsfc.nasa.gov/",
  },
  {
    title: "Total Solar Eclipse over Europe",
    date: "2026-08-12",
    category: "astronomy",
    tags: ["eclipse","solar","total"],
    regions: ["ES","IS","GL","GLOBAL"],
    featured: true,
    popularity: 94,
    description:
      "Totality crosses Greenland, Iceland, and Spain — the first total solar eclipse visible from mainland Europe since 1999 in many places.",
    sourceUrl: "https://eclipse.gsfc.nasa.gov/SEgoogle/SEgoogle2001/SE2026Aug12Tgoogle.html",
  },
  {
    title: "Total Solar Eclipse over Africa & Spain",
    date: "2027-08-02",
    category: "astronomy",
    tags: ["eclipse","solar","total"],
    regions: ["ES","EG","SA","LY","GLOBAL"],
    featured: true,
    popularity: 93,
    description:
      "One of the longest totalities of the century — up to ~6 minutes 23 seconds — crossing Spain, North Africa, and the Red Sea.",
  },
  {
    title: "Total Solar Eclipse over Australia & New Zealand",
    date: "2028-07-22",
    category: "astronomy",
    tags: ["eclipse","solar","total"],
    regions: ["AU","NZ","GLOBAL"],
    featured: true,
    popularity: 88,
    description:
      "Totality crosses Australia and the Tasman Sea toward New Zealand.",
  },
  {
    title: "Annular Solar Eclipse",
    date: "2028-01-26",
    category: "astronomy",
    tags: ["eclipse","solar","annular"],
    regions: ["GLOBAL"],
    popularity: 72,
    description:
      "A ring-of-fire eclipse over South America, the Atlantic, and Europe/Africa.",
  },
  {
    title: "Annular Solar Eclipse",
    date: "2030-06-01",
    category: "astronomy",
    tags: ["eclipse","solar","annular"],
    regions: ["GLOBAL"],
    popularity: 70,
    description:
      "Annular eclipse across North Africa, Europe, and Asia.",
  },
  {
    title: "Total Solar Eclipse",
    date: "2030-11-25",
    category: "astronomy",
    tags: ["eclipse","solar","total"],
    regions: ["ZA","AU","GLOBAL"],
    featured: true,
    popularity: 82,
    description:
      "Totality over Namibia, Botswana, South Africa, and later Australia.",
  },
  {
    title: "Total Solar Eclipse over North America",
    date: "2044-08-23",
    category: "astronomy",
    tags: ["eclipse","solar","total","far-future"],
    regions: ["US","CA","GLOBAL"],
    featured: true,
    popularity: 85,
    description:
      "The next great North American totality after 2024 — Canada and the northern United States.",
  },
  {
    title: "Total Solar Eclipse across the United States",
    date: "2045-08-12",
    category: "astronomy",
    tags: ["eclipse","solar","total","far-future"],
    regions: ["US","GLOBAL"],
    featured: true,
    popularity: 91,
    description:
      "A long totality from California to Florida — one of the most watched American eclipses of the century.",
  },
  {
    title: "Transit of Mercury",
    date: "2032-11-13",
    category: "astronomy",
    tags: ["mercury","transit"],
    regions: ["GLOBAL"],
    featured: true,
    popularity: 77,
    description:
      "Mercury crosses the face of the Sun. The next transit after 2019; the following one is 2039.",
  },
  {
    title: "Transit of Mercury",
    date: "2039-11-07",
    category: "astronomy",
    tags: ["mercury","transit"],
    regions: ["GLOBAL"],
    popularity: 70,
    description:
      "Mercury's second transit of the 2030s.",
  },
  {
    title: "Transit of Venus",
    date: "2117-12-11",
    category: "astronomy",
    tags: ["venus","transit","rare","far-future"],
    regions: ["GLOBAL"],
    featured: true,
    popularity: 80,
    description:
      "Venus will cross the Sun for the first time since 2012. Transits of Venus come in pairs more than a century apart.",
  },
  {
    title: "Halley's Comet perihelion",
    date: "2061-07-28",
    category: "astronomy",
    tags: ["comet","halley","rare","far-future"],
    regions: ["GLOBAL"],
    featured: true,
    popularity: 95,
    description:
      "Halley's Comet returns to the inner solar system. Last seen in 1986; the next visit after this is 2134.",
  },
  {
    title: "Perseid meteor shower peak",
    date: "2026-08-12",
    category: "astronomy",
    tags: ["meteors","perseids"],
    regions: ["GLOBAL"],
    popularity: 68,
    description:
      "The Perseids — leftover dust from comet Swift–Tuttle — peak around August 12.",
    series: "perseid-meteor-shower-peak",
  },
  {
    title: "Artemis II lunar flyby (targeted)",
    date: "2026-04-01",
    category: "space",
    tags: ["nasa","artemis","moon","crewed"],
    regions: ["US","GLOBAL"],
    featured: true,
    popularity: 89,
    description:
      "Target window for Artemis II, the first crewed Orion flight around the Moon since Apollo. Dates slip — treat as a planned milestone, not a lock.",
    sourceUrl: "https://www.nasa.gov/mission/artemis-ii/",
  },
  {
    title: "Artemis III lunar landing (targeted)",
    date: "2027-01-01",
    datePrecision: "year",
    status: "tentative",
    category: "space",
    tags: ["nasa","artemis","moon","landing"],
    regions: ["US","GLOBAL"],
    featured: true,
    popularity: 90,
    description:
      "NASA's targeted first crewed lunar landing of the Artemis era. Highly schedule-sensitive.",
  },
  {
    title: "Solar Cycle 25 maximum (approx.)",
    date: "2026-01-15",
    category: "space",
    tags: ["sun","solar-cycle"],
    regions: ["GLOBAL"],
    popularity: 55,
    description:
      "Approximate peak of Solar Cycle 25 — more auroras, more solar storms.",
  },
  {
    title: "United States midterm elections",
    date: "2026-11-03",
    category: "politics",
    tags: ["elections","usa","midterms"],
    regions: ["US"],
    featured: true,
    popularity: 87,
    description:
      "All House seats and about one-third of the Senate. First Tuesday after the first Monday in November.",
  },
  {
    title: "United States presidential election",
    date: "2028-11-07",
    category: "politics",
    tags: ["elections","usa","president"],
    regions: ["US","GLOBAL"],
    featured: true,
    popularity: 96,
    description:
      "The 61st US presidential election.",
  },
  {
    title: "United States midterm elections",
    date: "2030-11-05",
    category: "politics",
    tags: ["elections","usa","midterms"],
    regions: ["US"],
    popularity: 80,
    description:
      "US midterm elections, 2030.",
  },
  {
    title: "United States presidential election",
    date: "2032-11-02",
    category: "politics",
    tags: ["elections","usa","president"],
    regions: ["US","GLOBAL"],
    featured: true,
    popularity: 90,
    description:
      "The 62nd US presidential election.",
  },
  {
    title: "French presidential election",
    date: "2027-04-11",
    category: "politics",
    tags: ["elections","france"],
    regions: ["FR"],
    featured: true,
    popularity: 78,
    description:
      "First round of the French presidential election (typical mid-April calendar).",
  },
  {
    title: "Brazilian general election",
    date: "2026-10-04",
    category: "politics",
    tags: ["elections","brazil"],
    regions: ["BR"],
    featured: true,
    popularity: 76,
    description:
      "Brazil votes for president, Congress, and governors.",
  },
  {
    title: "CES 2027",
    date: "2027-01-06",
    endDate: "2027-01-09",
    category: "tech",
    tags: ["ces","gadgets","las-vegas"],
    regions: ["US"],
    featured: true,
    popularity: 72,
    description:
      "The Consumer Electronics Show returns to Las Vegas (typical first full week of January).",
  },
  {
    title: "CES 2028",
    date: "2028-01-05",
    endDate: "2028-01-08",
    category: "tech",
    tags: ["ces","gadgets"],
    regions: ["US"],
    popularity: 68,
    description:
      "CES Las Vegas, early January.",
  },
  {
    title: "Eurovision Song Contest 2026",
    date: "2026-05-16",
    category: "music",
    tags: ["eurovision","contest"],
    regions: ["GLOBAL"],
    featured: true,
    popularity: 80,
    description:
      "Europe's glittering pop final (grand final typically a Saturday in mid-May).",
  },
  {
    title: "Academy Awards 2027",
    date: "2027-03-07",
    category: "film",
    tags: ["oscars","awards"],
    regions: ["US","GLOBAL"],
    featured: true,
    popularity: 82,
    description:
      "The Oscars — typical first-Sunday-in-March window.",
  },
  {
    title: "Burning Man 2026",
    date: "2026-08-30",
    endDate: "2026-09-07",
    category: "culture",
    tags: ["burning-man","festival"],
    regions: ["US"],
    popularity: 64,
    description:
      "Black Rock City rises again in the Nevada desert (Labor Day week).",
  },
  {
    title: "25 years since September 11",
    date: "2026-09-11",
    category: "history",
    tags: ["anniversary","usa"],
    regions: ["US","GLOBAL"],
    featured: true,
    popularity: 83,
    description:
      "A quarter century after the 2001 attacks.",
  },
  {
    title: "20 years since the first iPhone",
    date: "2027-06-29",
    category: "tech",
    tags: ["anniversary","apple","iphone"],
    regions: ["GLOBAL"],
    featured: true,
    popularity: 75,
    description:
      "Steve Jobs unveiled the iPhone in January 2007; it went on sale June 29, 2007.",
  },
  {
    title: "60th anniversary of the Moon landing",
    date: "2029-07-20",
    category: "history",
    tags: ["anniversary","apollo","moon"],
    regions: ["GLOBAL"],
    featured: true,
    popularity: 92,
    description:
      "July 20, 1969 — Armstrong and Aldrin walked on the Moon. Sixty years on.",
  },
  {
    title: "40th anniversary of the World Wide Web proposal",
    date: "2029-03-12",
    category: "tech",
    tags: ["anniversary","www","internet"],
    regions: ["GLOBAL"],
    featured: true,
    popularity: 74,
    description:
      "Tim Berners-Lee submitted 'Information Management: A Proposal' at CERN on 12 March 1989.",
  },
  {
    title: "40 years since the fall of the Berlin Wall",
    date: "2029-11-09",
    category: "history",
    tags: ["anniversary","berlin","cold-war"],
    regions: ["DE","GLOBAL"],
    featured: true,
    popularity: 81,
    description:
      "November 9, 1989 — the wall opened. Forty years later.",
  },
  {
    title: "60th anniversary of Woodstock",
    date: "2029-08-15",
    category: "music",
    tags: ["anniversary","woodstock"],
    regions: ["US"],
    popularity: 66,
    description:
      "Three days of peace and music, sixty years later.",
  },
  {
    title: "70th anniversary of Gagarin's flight",
    date: "2031-04-12",
    category: "history",
    tags: ["anniversary","space","gagarin"],
    regions: ["GLOBAL"],
    featured: true,
    popularity: 78,
    description:
      "April 12, 1961 — Yuri Gagarin became the first human in space. Cosmonautics Day, seventy years on.",
  },
  {
    title: "Earth Day turns 60",
    date: "2030-04-22",
    category: "nature",
    tags: ["anniversary","earth-day"],
    regions: ["GLOBAL"],
    popularity: 70,
    description:
      "The first Earth Day was April 22, 1970.",
  },
  {
    title: "50th anniversary of the Chernobyl disaster",
    date: "2036-04-26",
    category: "history",
    tags: ["anniversary","chernobyl"],
    regions: ["UA","GLOBAL"],
    popularity: 72,
    description:
      "April 26, 1986 — half a century later.",
  },
  {
    title: "New Year 2030",
    date: "2030-01-01",
    category: "holidays",
    tags: ["new-year","decade"],
    regions: ["GLOBAL"],
    featured: true,
    popularity: 88,
    description:
      "The 2030s begin.",
  },
  {
    title: "New Year 2050",
    date: "2050-01-01",
    category: "holidays",
    tags: ["new-year","mid-century","far-future"],
    regions: ["GLOBAL"],
    featured: true,
    popularity: 80,
    description:
      "Mid-century. A date that still feels like science fiction.",
  },
  {
    title: "New Year 2100",
    date: "2100-01-01",
    category: "holidays",
    tags: ["new-year","century","far-future"],
    regions: ["GLOBAL"],
    featured: true,
    popularity: 86,
    description:
      "The 22nd century. Almost no one alive today will see it — almost.",
  },
  {
    title: "Turn of the millennium (Y3K)",
    date: "3000-01-01",
    category: "holidays",
    tags: ["new-year","millennium","far-future"],
    regions: ["GLOBAL"],
    popularity: 50,
    description:
      "A thousand years from the Y2K scare. Purely for the vibe.",
  },
  {
    title: "Unix time 32-bit overflow (Y2K38)",
    date: "2038-01-19T03:14:07Z",
    category: "tech",
    tags: ["unix", "y2k38", "computers"],
    regions: ["GLOBAL"],
    featured: true,
    popularity: 84,
    allDay: false,
    description:
      "Signed 32-bit Unix time runs out — 2,147,483,647 seconds after 1970-01-01. The Y2K of the 2030s for leftover 32-bit systems.",
  },
  {
    title: "Unix time 2,000,000,000",
    date: "2033-05-18T03:33:20Z",
    category: "curiosities",
    tags: ["unix", "computers", "milestone"],
    regions: ["GLOBAL"],
    featured: true,
    popularity: 70,
    allDay: false,
    description:
      "The Unix clock reads two billion seconds since 1 January 1970 at 03:33:20 UTC. The last round-number billion was 2001; the next one lands in 2065.",
  },
];
