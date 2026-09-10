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
