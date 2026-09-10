import type { IngestPrecision } from "../../types";

/**
 * Curated comet perihelion allowlist. JPL SBDB is used only to *refresh* these rows at run
 * time (see jpl.ts `cometRows`): its `tp` is the perihelion of the osculating orbit epoch, which
 * for most periodic comets is the *last* perihelion (Halley 1986, Encke 2023), and `per_y` is
 * null or absurd for long-period comets — so SBDB is never used for discovery and the next
 * return is never projected from `per_y` at run time.
 *
 * Seed values (2026-09-09): far-future returns are the published ones (Halley 2061 July 28,
 * Swift–Tuttle 2126, Pons–Brooks 2095). The near-term short-period returns were estimated at
 * seed time from the SBDB `tp` + n × period and are deliberately kept at *year* precision
 * (Encke, whose period is stable, at month precision) because planetary perturbations shift
 * actual perihelia by weeks; `buildEvent` marks them `tentative`. When SBDB publishes an orbit
 * whose `tp_cal` lies in the future for the same designation, that day replaces the estimate.
 */
export type CuratedComet = {
  /** Periodic designation as JPL prints it before the slash ("1P", "12P"). */
  des: string;
  /** Display name for the description. */
  name: string;
  /** Row title; matches the curated one-off for Halley so the two collapse to one slug. */
  title: string;
  date: string;
  precision: IngestPrecision;
  /** Perihelion distance in au (SBDB `q`, informational). */
  q: number;
  popularity: number;
  tags?: string[];
  note: string;
};

export const COMETS: CuratedComet[] = [
  {
    des: "1P",
    name: "Halley's Comet (1P/Halley)",
    title: "Halley's Comet perihelion",
    date: "2061-07-28",
    precision: "day",
    q: 0.575,
    popularity: 50,
    tags: ["halley", "far-future"],
    note: "Last seen in 1986, Halley returns roughly every 76 years and feeds the Eta Aquariid and Orionid meteor showers.",
  },
  {
    des: "2P",
    name: "Comet 2P/Encke",
    title: "Comet 2P/Encke perihelion",
    date: "2027-02-01",
    precision: "month",
    q: 0.339,
    popularity: 35,
    note: "Encke has the shortest period of any known comet, about 3.3 years, and is the parent of the Taurid meteor streams.",
  },
  {
    des: "67P",
    name: "Comet 67P/Churyumov–Gerasimenko",
    title: "Comet 67P/Churyumov–Gerasimenko perihelion",
    date: "2028-01-01",
    precision: "year",
    q: 1.24,
    popularity: 30,
    note: "The comet visited by ESA's Rosetta mission and its Philae lander returns to perihelion about every 6.4 years.",
  },
  {
    des: "46P",
    name: "Comet 46P/Wirtanen",
    title: "Comet 46P/Wirtanen perihelion",
    date: "2029-01-01",
    precision: "year",
    q: 1.06,
    popularity: 30,
    note: "A small, active Jupiter-family comet with a 5.4-year period; its 2018 return was bright enough to see with binoculars.",
  },
  {
    des: "103P",
    name: "Comet 103P/Hartley 2",
    title: "Comet 103P/Hartley 2 perihelion",
    date: "2030-01-01",
    precision: "year",
    q: 1.06,
    popularity: 30,
    note: "Flown past by NASA's EPOXI mission in 2010, Hartley 2 comes back about every 6.5 years.",
  },
  {
    des: "21P",
    name: "Comet 21P/Giacobini–Zinner",
    title: "Comet 21P/Giacobini–Zinner perihelion",
    date: "2031-01-01",
    precision: "year",
    q: 1.01,
    popularity: 30,
    note: "The parent of the October Draconids, on a 6.5-year orbit; strong Draconid outbursts follow its returns.",
  },
  {
    des: "55P",
    name: "Comet 55P/Tempel–Tuttle",
    title: "Comet 55P/Tempel–Tuttle perihelion",
    date: "2031-01-01",
    precision: "year",
    q: 0.976,
    popularity: 35,
    note: "The parent of the Leonids; its 33-year returns are followed by the shower's famous storm years.",
  },
  {
    des: "8P",
    name: "Comet 8P/Tuttle",
    title: "Comet 8P/Tuttle perihelion",
    date: "2035-01-01",
    precision: "year",
    q: 1.03,
    popularity: 30,
    note: "A 13.6-year comet and the parent of the December Ursids.",
  },
  {
    des: "12P",
    name: "Comet 12P/Pons–Brooks",
    title: "Comet 12P/Pons–Brooks perihelion",
    date: "2095-01-01",
    precision: "year",
    q: 0.781,
    popularity: 35,
    tags: ["far-future"],
    note: "The 'Devil Comet' of 2024 returns about every 71 years and is known for sudden outbursts.",
  },
  {
    des: "109P",
    name: "Comet 109P/Swift–Tuttle",
    title: "Comet 109P/Swift–Tuttle perihelion",
    date: "2126-01-01",
    precision: "year",
    q: 0.96,
    popularity: 35,
    tags: ["far-future"],
    note: "The parent of the Perseids, on a 133-year orbit; its last perihelion was in December 1992.",
  },
];
