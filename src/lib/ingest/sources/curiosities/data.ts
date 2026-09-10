import type { IngestPrecision, IngestStatus } from "../../types";

/**
 * Hand-picked far-future and "date genuinely unknown" curiosities. Facts only (no licence);
 * `sourceUrl` is a citation, never copied text — every description is written here.
 *
 * Deliberately absent:
 * - Halley's Comet 2061: owned by the `astronomy` adapter's curated comet allowlist (one owner).
 * - Transit of Venus 2117-12-11: `astronomy` (`SearchTransit`).
 * - KEO satellite: the project announced its closure in July 2025 — no countdown.
 *
 * `date` follows the catalog convention: coarser than day ⇒ first day of the period
 * (`YYYY-01-01` for year precision, `YYYY-MM-01` for month precision); `buildEvent` marks those
 * `tentative` so the UI shows "expected …" instead of a ticking clock.
 */
export type CuriosityEntry = {
  /** Stable id: `curiosities:curated:<id>`. Never rename — it is the upsert key. */
  id: string;
  title: string;
  date: string;
  datePrecision: IngestPrecision;
  status?: IngestStatus;
  /** Beyond now + 15 years; mandatory tag `far-future` is added by the adapter. */
  farFuture?: boolean;
  tags: string[];
  regions?: string[];
  description: string;
  sourceUrl: string;
  popularity: number;
  featured?: boolean;
};

export const CURIOSITIES: readonly CuriosityEntry[] = [
  {
    id: "crypt-of-civilization",
    title: "Crypt of Civilization opens",
    date: "8113-05-28",
    datePrecision: "day",
    farFuture: true,
    tags: ["time-capsule", "history"],
    regions: ["US", "GLOBAL"],
    description:
      "The Crypt of Civilization, a sealed chamber beneath Oglethorpe University in Atlanta, was welded shut on 28 May 1940 with instructions that it stay closed until 28 May 8113. That date sits as far in the future as the first recorded Egyptian calendar sat in the past when the crypt was planned.",
    sourceUrl: "https://en.wikipedia.org/wiki/Crypt_of_Civilization",
    popularity: 60,
  },
  {
    id: "westinghouse-time-capsules",
    title: "Westinghouse Time Capsules opening",
    date: "6939-01-01",
    datePrecision: "year",
    farFuture: true,
    tags: ["time-capsule", "history", "worlds-fair"],
    regions: ["US", "GLOBAL"],
    description:
      "Two Westinghouse time capsules were buried 50 feet below Flushing Meadows in New York at the 1939 and 1964 World's Fairs. Both are meant to be opened in the year 6939, five thousand years after the first was sealed.",
    sourceUrl: "https://en.wikipedia.org/wiki/Westinghouse_Time_Capsules",
    popularity: 40,
  },
  {
    id: "leap-seconds-abolished",
    title: "Leap seconds abolished",
    date: "2035-01-01",
    datePrecision: "year",
    status: "tentative",
    tags: ["leap-second", "time", "utc", "metrology"],
    description:
      "In November 2022 the General Conference on Weights and Measures resolved that leap seconds will stop being added to UTC by 2035 at the latest, letting civil time drift slowly from Earth's rotation. The exact year of the last leap second has not been fixed, so this is a deadline rather than a scheduled instant.",
    sourceUrl: "https://en.wikipedia.org/wiki/Leap_second",
    popularity: 40,
  },
  {
    id: "voyager-1-light-day",
    title: "Voyager 1 reaches one light-day from Earth",
    date: "2026-11-01",
    datePrecision: "month",
    tags: ["voyager", "space", "deep-space"],
    description:
      "Voyager 1, launched in 1977, is expected to pass about 173.8 astronomical units from Earth in November 2026, the distance light travels in a day. From then on a radio command takes more than 24 hours to reach the probe, and its reply takes as long to come back.",
    sourceUrl: "https://en.wikipedia.org/wiki/Voyager_1",
    popularity: 45,
  },
  {
    id: "voyager-dsn-range",
    title: "Voyager probes expected to fall silent",
    date: "2036-01-01",
    datePrecision: "year",
    status: "tentative",
    tags: ["voyager", "space", "deep-space"],
    description:
      "Voyager 1 and Voyager 2 run on plutonium generators that lose about four watts a year, and NASA expects them to stop powering any instrument around the mid-2030s. By roughly 2036 both probes should also be beyond the range of the Deep Space Network, ending 60 years of contact.",
    sourceUrl: "https://en.wikipedia.org/wiki/Voyager_program",
    popularity: 30,
  },
];
