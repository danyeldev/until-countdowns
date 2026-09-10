import type { Category } from "@/lib/types";
import type { Recurrence } from "./rules";

/**
 * Hand-maintained observances the Wikidata harvest cannot supply: rule-based days whose item
 * has no P837 (System Administrator Appreciation Day Q310776, National Doughnut Day Q6972348,
 * National Cat Day Q17115865 — all verified without P837 on 2026-09-09), and well-known joke days
 * with no Wikidata item at all. Facts only — every sentence in `description` is our own.
 * An entry with a `qid` wins over the harvest: the network units skip that item so one pass
 * never emits two competing rows for the same `observances:<QID>:<year>` key — so never add an
 * item that already carries a usable P837 (International Talk Like a Pirate Day Q37669 has one
 * and comes from the `q2558684` unit with its sitelink popularity, enwiki id and P18 image).
 * Popularity is clamped to the §0 high-volume cap (35) by the adapter.
 */
export type ObservanceOverride = {
  /** Wikidata item when one exists; the source_key is then `observances:<qid>:<year>`. */
  qid?: string;
  /** Stable key for entries without a Wikidata item (`observances:x-<key>:<year>`). */
  key?: string;
  title: string;
  rule: Recurrence;
  category: Category;
  tags: string[];
  regions: string[];
  sourceUrl: string;
  popularity: number;
  description: string;
};

export const OBSERVANCE_OVERRIDES: ObservanceOverride[] = [
  {
    qid: "Q310776",
    title: "System Administrator Appreciation Day",
    rule: { kind: "nth_weekday", n: -1, weekday: 5, month: 7 },
    category: "fun",
    tags: ["tech", "workplace"],
    regions: ["GLOBAL"],
    sourceUrl: "https://en.wikipedia.org/wiki/System_Administrator_Appreciation_Day",
    popularity: 35,
    description: "A day to thank the people who keep servers, networks and printers running.",
  },
  {
    qid: "Q6972348",
    title: "National Doughnut Day",
    rule: { kind: "nth_weekday", n: 1, weekday: 5, month: 6 },
    category: "fun",
    tags: ["food"],
    regions: ["US"],
    sourceUrl: "https://en.wikipedia.org/wiki/National_Doughnut_Day",
    popularity: 34,
    description: "A United States food day that began as a Salvation Army fundraiser in 1938.",
  },
  {
    key: "national-pizza-day",
    title: "National Pizza Day",
    rule: { kind: "fixed_day", month: 2, day: 9 },
    category: "fun",
    tags: ["food"],
    regions: ["US"],
    sourceUrl: "https://en.wikipedia.org/wiki/Pizza_in_the_United_States",
    popularity: 33,
    description: "An unofficial United States food day celebrated with pizza deals and a lot of cheese.",
  },
  {
    qid: "Q17115865",
    title: "National Cat Day",
    rule: { kind: "fixed_day", month: 10, day: 29 },
    category: "fun",
    tags: ["animals"],
    regions: ["US"],
    sourceUrl: "https://en.wikipedia.org/wiki/National_Cat_Day",
    popularity: 34,
    description: "A United States day created in 2005 to encourage cat adoption and celebrate cats.",
  },
];

export const OVERRIDE_QIDS: ReadonlySet<string> = new Set(OBSERVANCE_OVERRIDES.flatMap((o) => (o.qid ? [o.qid] : [])));
