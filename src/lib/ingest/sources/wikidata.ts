import type { Category } from "@/lib/types";
import { buildEvent, classify, FAR_FUTURE_YEARS, isFutureOrFar, precisionFromWikidata } from "../normalize";
import type { Adapter, IngestEvent, Json, Plan, Unit } from "../types";
import { enwikiTitle, labelYearConsistent, type SparqlBinding, WD_ENDPOINT } from "./wikidata/common";
import { isMoreCursor, MORE_PAGE, moreAfter, type MoreCursor, moreStart, runMore } from "./wikidata/more";

export { enwikiTitle, labelYearConsistent, WD_ENDPOINT } from "./wikidata/common";
export type { SparqlBinding } from "./wikidata/common";

/**
 * Wikidata SPARQL harvest (CC0). One unit per (class, time property, page). The query reads
 * the statement node so the stored precision comes with the value: nothing coarser than a year
 * is accepted, imprecise dates keep Wikidata's placeholder (YYYY-01-01 / YYYY-MM-01) with
 * `date_precision` set and `status = 'tentative'`. An English Wikipedia sitelink is required.
 *
 * Category comes from the class fallback; TAG_RULES only add tags — except for the generic
 * "occurrence"/"planned event" classes where a clear sports/politics/astronomy/space match wins.
 * WDQS terms: descriptive User-Agent, ≤ 5 parallel per IP, 60 s per query; we run one query at a
 * time with 1.5 s spacing. Docs: https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service
 *
 * Once the class variants are exhausted the pass continues with the "wikidata-more" families
 * (elections with regions, award ceremonies, expos/festivals, launches, film/game releases,
 * official openings) in ./wikidata/more.ts; those units carry a `more` cursor instead of
 * `{ i, page }`.
 *
 * MUSIC CLASSES — Q1573906 (concert tour) and Q182832 (concert). READ THIS BEFORE TRUSTING THE
 * COVERAGE THEY IMPLY. The reason they exist is REPORTED, not measured here: a survey asked for
 * them on the grounds that the catalog's `music` category held one published future row against
 * 169 for `festivals`, with no tours and no concerts at all, and that the gig feeds which would
 * fill that gap are dead (Songkick, Last.fm events, JamBase), consent-gated (Bandsintown) or
 * key-gated at listings granularity (Ticketmaster, SeatGeek). None of those counts and none of
 * those feeds was checked from here — no network — so read them as why the change was made, not
 * as facts this file stands behind. What IS checkable from here: both QIDs are already mapped to
 * `music` by the on-demand `wanted` path (sources/wanted/resolve.ts `P31_CATEGORY`), so the two
 * routes now agree on the category instead of only one of them knowing about it.
 *
 * `range: true` on the tour is the Q132241 (festival) shape: the class is queried twice, once as
 * P585 with `FILTER NOT EXISTS { ?item wdt:P580 [] }` and once as P580 + OPTIONAL P582, so an item
 * with both dates comes from exactly one variant and its slug cannot flip between passes. That a
 * tour actually carries P580 + P582 (and a one-night concert P585) is how Wikidata's property
 * documentation reads and how tour items are described there — it was NOT checked against live
 * data. GUESS. It is a cheap one to be wrong about: the pair is self-covering, so tours that state
 * only P585 are picked up by the point variant regardless.
 *
 * Q182832 is not `range` because a one-night concert has a date, not a span. It is the weaker of
 * the two bets, and it rests on an ASSUMPTION about upstream data that was not checked: that the
 * enwiki gate below (`?article schema:about ?item`) leaves only the countdown-shaped one-offs — a
 * farewell show, a reunion, a benefit — because an ordinary arena date has no Wikipedia article
 * and so never reaches the mapper. If that is wrong, the class comes back either empty or full of
 * routine gigs, and the first run's log line says which. What IS verified is the cost of the other
 * way of being wrong, towards history (the class may be mostly past concerts): the query window
 * opens at 1 January of the current year, so past concerts are excluded by WDQS rather than
 * fetched and discarded, and the far end is `year + FAR_FUTURE_YEARS` (phase 1 never calls
 * `isFarFuture`; the window IS the far-future bound). So the downside there is one query per pass
 * returning nothing, not a flood.
 *
 * HOW MANY ROWS EITHER CLASS ADDS IS UNVERIFIED. This was written on a machine with no outbound
 * network: no SPARQL was run and no count taken, so no row count anywhere below is a measurement.
 * Size it from the log — every unit prints `Q1573906 concert tour [P580] page 1: <n> bindings,
 * <k> kept` — or ask WDQS for the count form of what {@link buildWikidataQuery} sends (paste at
 * https://query.wikidata.org/, or GET https://query.wikidata.org/sparql?query=<urlencoded> with
 * `Accept: application/sparql-results+json`). Only the label service is dropped from it, a count
 * having no labels to fetch; `hint:rangeSafe` is kept, because the comment on
 * {@link buildWikidataQuery} says this shape times out at 60 s on a large class without it. The
 * dates are the 2026 pass — the code builds `<current year>-01-01` to `+ FAR_FUTURE_YEARS` (15),
 * so move both literals if you run this later:
 *
 *     SELECT (COUNT(DISTINCT ?item) AS ?n) WHERE {
 *       ?item wdt:P31 wd:Q1573906 .
 *       ?item wdt:P580 ?date . hint:Prior hint:rangeSafe true .
 *       FILTER(?date >= "2026-01-01T00:00:00Z"^^xsd:dateTime && ?date < "2041-01-01T00:00:00Z"^^xsd:dateTime)
 *       ?item p:P580 ?st . ?st psv:P580 ?v . ?v wikibase:timeValue ?date ; wikibase:timePrecision ?prec .
 *       FILTER(?prec >= 9)
 *       ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
 *     }
 *
 * For the tour's other variant swap every `P580` above for `P585` (all three — `wdt:`, `p:`,
 * `psv:`) and add `FILTER NOT EXISTS { ?item wdt:P580 [] }`; for Q182832 use that P585 form
 * without the FILTER (one variant, no end date). Reading the answer:
 *   • under ~10 kept rows for a class — it was not worth it. Delete the entry: it costs a WDQS
 *     query per variant per daily pass (cron `0 3 * * *`, vercel.json), and `wanted` already
 *     resolves either QID on demand for anything a visitor actually asks for.
 *   • ~10 to WD_PAGE (3000) — the band this was written for. One page per variant, nothing to tune.
 *   • above WD_PAGE — paging starts and the class can reach MAX_PAGES × WD_PAGE = 30 000 rows per
 *     variant. A number that big means the class is not what this comment assumes; re-check it and
 *     the enrichment arithmetic below before a second pass runs.
 *
 * ENRICHMENT COST OF `popularity: 45`. That constant is load-bearing, not decoration:
 * `finalize_catalog` queues a `wikipedia_summary` AND an `image` job for every published future
 * row at `popularity >= 45` that is still missing each one (the same branch in every version of
 * the function since 0001_core.sql; current one in supabase/migrations/0009_indexable_summary.sql).
 * Phase-1 Wikidata rows sit exactly ON that boundary — all of them, not just these two classes —
 * so N newly kept rows cost 2N jobs. The drain rate below is arithmetic from the constants, not
 * an observed figure: the worker runs every 10 minutes (vercel.json), claims at most
 * `DEFAULT_LIMIT` = 60 per kind, and sizes each claim to the 240 s budget with the per-job costs
 * measured in src/lib/enrich/run.ts (2.5 s summary, 3.5 s image), so a run beginning with
 * summaries clears ~85 jobs and one beginning with images ~70 (the kinds alternate run to run),
 * for roughly 450 an hour. N rows therefore cost about 2N/450 hours of queue, once — and what N
 * is, is exactly what this file cannot know.
 *
 * Do NOT tune this class BELOW 45 to dodge that queue: the description written here is 30
 * characters against the publication gate's 80, so the summary job is the only thing that ever
 * fills `summary` and makes such a row indexable at all. If a first run comes back in the
 * thousands, it is that row count that needs revisiting, not the 45.
 */

export const WD_PAGE = 3000;
const MAX_PAGES = 10;

export type WikidataClass = {
  qid: string;
  label: string;
  prop: "P585" | "P577" | "P580";
  fallback: Category;
  /** Also query P580 (start time) with the P582 end time for multi-day events. */
  range?: boolean;
};

export const WIKIDATA_CLASSES: WikidataClass[] = [
  { qid: "Q1656682", label: "planned event", prop: "P585", fallback: "culture" },
  { qid: "Q18608583", label: "recurring sporting event", prop: "P585", fallback: "sports", range: true },
  { qid: "Q16510064", label: "sporting event", prop: "P585", fallback: "sports", range: true },
  { qid: "Q11424", label: "film", prop: "P577", fallback: "film" },
  { qid: "Q500834", label: "tournament", prop: "P585", fallback: "sports", range: true },
  { qid: "Q13406554", label: "sports competition", prop: "P585", fallback: "sports", range: true },
  { qid: "Q40231", label: "public election", prop: "P585", fallback: "politics" },
  { qid: "Q1190554", label: "occurrence", prop: "P585", fallback: "culture" },
  { qid: "Q4504495", label: "award ceremony", prop: "P585", fallback: "entertainment" },
  { qid: "Q7889", label: "video game", prop: "P577", fallback: "games" },
  { qid: "Q132241", label: "festival", prop: "P585", fallback: "festivals", range: true },
  { qid: "Q2761147", label: "meeting", prop: "P585", fallback: "politics" },
  // Appended, never inserted: a pass in flight resumes from a stored `{ i, page }` index into
  // VARIANTS, so inserting mid-list would point yesterday's cursor at a different class for one
  // pass. Appending only ever adds work at the end, and run.ts clears the cursor when a pass
  // finishes, so the new variants are picked up from the next pass on.
  { qid: "Q1573906", label: "concert tour", prop: "P585", fallback: "music", range: true },
  { qid: "Q182832", label: "concert", prop: "P585", fallback: "music" },
];

export type Variant = { cls: WikidataClass; prop: WikidataClass["prop"]; withEnd: boolean };

/** Flattened query list: every class once with its own property, range classes again with P580 + P582. */
export const VARIANTS: Variant[] = WIKIDATA_CLASSES.flatMap((cls) => {
  const v: Variant[] = [{ cls, prop: cls.prop, withEnd: false }];
  if (cls.range) v.push({ cls, prop: "P580", withEnd: true });
  return v;
});

/** Categories a generic-class item may be moved to when a tag rule is unambiguous. */
const OVERRIDES = new Set<Category>(["sports", "politics", "astronomy", "space"]);
const GENERIC = new Set<Category>(["culture"]);

export function buildWikidataQuery(v: Variant, year: number, limit = WD_PAGE, offset = 0): string {
  const from = `${year}-01-01T00:00:00Z`;
  const to = `${year + FAR_FUTURE_YEARS}-01-01T00:00:00Z`;
  // Range classes are queried twice (P585, then P580 + P582). An item with both must come from
  // exactly one unit or its slug flips between the two dates on every pass.
  const endClause = v.withEnd
    ? "  OPTIONAL { ?item wdt:P582 ?end . }\n"
    : v.cls.range
      ? "  FILTER NOT EXISTS { ?item wdt:P580 [] }\n"
      : "";
  const endVar = v.withEnd ? " ?end" : "";
  // `hint:rangeSafe` lets Blazegraph range-scan the date index before touching the class
  // (large classes such as film time out at 60 s without it). Joining `wdt:` on the same ?date
  // restricts the statement to truthy values, so a rescheduled event yields only its current date.
  return `
SELECT DISTINCT ?item ?itemLabel ?date ?prec ?article${endVar} WHERE {
  ?item wdt:P31 wd:${v.cls.qid} .
  ?item wdt:${v.prop} ?date . hint:Prior hint:rangeSafe true .
  FILTER(?date >= "${from}"^^xsd:dateTime && ?date < "${to}"^^xsd:dateTime)
  ?item p:${v.prop} ?st .
  ?st psv:${v.prop} ?v .
  ?v wikibase:timeValue ?date ;
     wikibase:timePrecision ?prec .
  FILTER(?prec >= 9)
  ?article schema:about ?item ;
           schema:isPartOf <https://en.wikipedia.org/> .
${endClause}  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?item ?date
LIMIT ${limit} OFFSET ${offset}`.trim();
}

export function categoryFor(label: string, cls: WikidataClass): { category: Category; tags: string[] } {
  const { category: ruleCategory, tags } = classify(label, cls.fallback);
  let category = cls.fallback;
  if (GENERIC.has(cls.fallback) && OVERRIDES.has(ruleCategory)) category = ruleCategory;
  return { category, tags };
}

/** One SPARQL binding → event row, or null when a guard rejects it. */
export function bindingToEvent(b: SparqlBinding, cls: WikidataClass, now: Date): IngestEvent | null {
  const iri = b.item?.value;
  const label = (b.itemLabel?.value ?? "").trim();
  const raw = b.date?.value;
  const prec = Number(b.prec?.value);
  if (!iri || !label || !raw) return null;
  if (/^Q\d+$/.test(label)) return null;
  const qid = iri.split("/").pop() ?? "";
  if (!/^Q\d+$/.test(qid)) return null;
  const precision = precisionFromWikidata(prec);
  if (!precision || precision === "decade") return null;
  const day = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const year = Number(day.slice(0, 4));
  if (!labelYearConsistent(label, year)) return null;
  const enwiki = enwikiTitle(b.article?.value);
  if (!enwiki) return null;
  if (!isFutureOrFar(day, precision, now)) return null;
  const imprecise = precision !== "day";
  const { category, tags } = categoryFor(label, cls);
  const endRaw = b.end?.value;
  const endDate = endRaw && /^\d{4}-\d{2}-\d{2}/.test(endRaw) ? endRaw.slice(0, 10) : undefined;
  return buildEvent({
    title: label,
    date: day,
    endDate: endDate && endDate > day ? endDate : undefined,
    category,
    tags: [...tags, "wikidata"],
    regions: ["GLOBAL"],
    description: "Scheduled event from Wikidata.",
    source: "wikidata",
    sourceUrl: iri,
    sourceKey: `wikidata:${qid}`,
    popularity: 45,
    datePrecision: precision,
    status: imprecise ? "tentative" : "scheduled",
    confidence: imprecise ? 0.6 : 0.7,
    externalIds: { qid, enwiki },
  });
}

/** Rows from one page, one per QID (earliest date wins, end dates merged). */
export function bindingsToEvents(bindings: SparqlBinding[], cls: WikidataClass, now: Date): IngestEvent[] {
  const byQid = new Map<string, IngestEvent>();
  for (const b of bindings) {
    const ev = bindingToEvent(b, cls, now);
    if (!ev) continue;
    const prev = byQid.get(ev.source_key);
    if (!prev) byQid.set(ev.source_key, ev);
    else if (ev.date < prev.date) {
      if (prev.end_date && !ev.end_date) ev.end_date = prev.end_date;
      byQid.set(ev.source_key, ev);
    } else if (!prev.end_date && ev.end_date) prev.end_date = ev.end_date;
  }
  return [...byQid.values()];
}

/**
 * `last` is set by run() (fewer than WD_PAGE bindings) and read by the `after` getter, so the
 * resume point — next page, or next variant — is decided from what the page actually returned.
 * Nothing is kept in module state across invocations.
 */
type WdUnit = Unit & { i: number; page: number; last: boolean; more?: MoreCursor };
type Cursor = { i: number; page: number };

function parseCursor(cursor: Json | null): Cursor {
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    const c = cursor as { i?: unknown; page?: unknown };
    if (typeof c.i === "number" && typeof c.page === "number" && c.i >= 0 && c.page >= 0) return { i: c.i, page: c.page };
  }
  return { i: 0, page: 0 };
}

/** Phase-2 unit: one family × slice × page; `after` is decided from the page size like phase 1. */
function planMore(c: MoreCursor, now: Date): Plan<WdUnit> {
  if (c.done) return { units: [], done: true };
  const unit: WdUnit = {
    key: `wikidata:more:${c.family}:${c.from.slice(0, 10)}:${c.offset}`,
    label: `more ${c.family} ${c.from.slice(0, 10)}→${c.to.slice(0, 10)} offset ${c.offset}`,
    i: VARIANTS.length,
    page: c.offset / MORE_PAGE,
    last: false,
    more: c,
    get after(): Json {
      return moreAfter(c, this.last, now);
    },
  };
  return {
    units: [unit],
    done: false,
    get nextCursor(): Json {
      return unit.after;
    },
  };
}

export const adapter: Adapter<WdUnit> = {
  id: "wikidata",
  label: "Wikidata",
  rank: 2,
  cadence: "daily",
  isConfigured: () => true,
  limits: { concurrency: 1, minIntervalMs: 1500, timeoutMs: 65_000, maxRetries: 1 }, // WDQS kills queries at 60 s; one retry keeps a bad class under 2.5 min

  async plan(cursor, ctx): Promise<Plan<WdUnit>> {
    if (isMoreCursor(cursor)) return planMore(cursor, ctx.now);
    let { i, page } = parseCursor(cursor);
    // Past the page cap: advance to the next variant (a last page already advanced via `after`).
    while (i < VARIANTS.length && page >= MAX_PAGES) {
      i++;
      page = 0;
    }
    // Class variants exhausted: continue with the phase-2 families.
    if (i >= VARIANTS.length) return planMore(moreStart(ctx.now), ctx.now);
    const v = VARIANTS[i];
    const unit: WdUnit = {
      key: `wikidata:${v.cls.qid}:${v.prop}:${page}`,
      label: `${v.cls.qid} ${v.cls.label} [${v.prop}] page ${page + 1}`,
      i,
      page,
      last: false,
      // Read by the runner after run(): next page, or the next variant when this page was the last one.
      get after(): Json {
        return this.last ? { i: i + 1, page: 0 } : { i, page: page + 1 };
      },
    };
    return {
      units: [unit],
      done: false,
      get nextCursor(): Json {
        return unit.after;
      },
    };
  },

  async run(unit, ctx) {
    if (unit.more) {
      const { rows, bindings } = await runMore(unit.more, ctx);
      unit.last = bindings < MORE_PAGE;
      ctx.log.info(`${unit.label}: ${bindings} bindings, ${rows.length} kept`);
      return rows;
    }
    const v = VARIANTS[unit.i];
    const query = buildWikidataQuery(v, ctx.now.getUTCFullYear(), WD_PAGE, unit.page * WD_PAGE);
    const url = `${WD_ENDPOINT}?query=${encodeURIComponent(query)}`;
    const json = await ctx.http.fetchJson<{ results?: { bindings?: SparqlBinding[] } }>(url, {
      headers: { Accept: "application/sparql-results+json" },
    });
    const bindings = json?.results?.bindings ?? [];
    unit.last = bindings.length < WD_PAGE;
    const rows = bindingsToEvents(bindings, v.cls, ctx.now);
    ctx.log.info(`${unit.label}: ${bindings.length} bindings, ${rows.length} kept`);
    return rows;
  },
};
