import { createHash } from "node:crypto";
import type { Category } from "@/lib/types";
import { buildEvent, classify, isFarFuture, isFutureOrFar } from "../../normalize";
import type { IngestEvent } from "../../types";
import { labelYearConsistent } from "../wikidata/common";
import { bestClaims, enLabel, itemIds, parseWdTime, type WdEntity, type WdTime } from "../wikipedia-categories/wikidata";

/**
 * Pure helpers for the `wanted` adapter: URL builders for the MediaWiki / Wikibase Action APIs,
 * response readers, the entity → row mapping and the country QID → ISO seed.
 *
 * KNOWN, ACCEPTED RISK — search text in retry logs. Rows and cursors only ever carry
 * `sha1(normalised query)` (see `searchHash`), but the raw query necessarily travels in the
 * request URL (`gsrsearch=`, `search=`), and the shared HTTP layer logs the full URL on a retry
 * (`src/lib/ingest/http.ts`: `log?.warn(\`http ${status} from ${host}; retry …\`, { url })`). So a
 * 429/5xx from Wikimedia puts the visitor's search text in the server console log. It does not
 * reach the database (`run.ts` persists only a generic "unit failed after N attempt(s)" string),
 * so this is log-retention exposure, not stored PII. Removing it needs a shared change to
 * `createHttp` (log `origin + pathname` instead of the full URL) — see the adapter's report.
 */

export const WP_API = "https://en.wikipedia.org/w/api.php";
export const WD_API = "https://www.wikidata.org/w/api.php";

/** Search text is treated as potential PII: only this normalised form is hashed, and only the hash is stored. */
export function normalizeQuery(q: string): string {
  return String(q ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function searchHash(q: string): string {
  return createHash("sha1").update(normalizeQuery(q)).digest("hex");
}

/** Top 3 article hits with their Wikidata ids in one call (`generator=search` + `prop=pageprops`). */
export function wikipediaSearchUrl(q: string): string {
  const p = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: q,
    gsrlimit: "3",
    gsrnamespace: "0",
    prop: "pageprops",
    ppprop: "wikibase_item|disambiguation",
    format: "json",
    formatversion: "2",
  });
  return `${WP_API}?${p}`;
}

export function wbSearchUrl(q: string): string {
  const p = new URLSearchParams({ action: "wbsearchentities", search: q, language: "en", type: "item", limit: "5", format: "json" });
  return `${WD_API}?${p}`;
}

export function wbEntitiesUrl(ids: readonly string[]): string {
  const p = new URLSearchParams({
    action: "wbgetentities",
    ids: ids.join("|"),
    props: "claims|labels|sitelinks",
    languages: "en",
    sitefilter: "enwiki",
    format: "json",
  });
  return `${WD_API}?${p}`;
}

export function wbClaimsUrl(entity: string, property: string): string {
  const p = new URLSearchParams({ action: "wbgetclaims", entity, property, format: "json" });
  return `${WD_API}?${p}`;
}

export type WpSearchPage = { title?: string; index?: number; pageprops?: { wikibase_item?: string; disambiguation?: string } };
export type WpSearchResponse = { query?: { pages?: WpSearchPage[] }; error?: { code?: string; info?: string } };

/** How many search hits are carried forward as resolution candidates (one Wikipedia request either way). */
export const SEARCH_HITS = 3;

/**
 * The top `limit` article hits that have a Wikidata item and are not disambiguation pages, in
 * search-rank order. More than one is kept because the queries this adapter exists for are vague
 * ("next total solar eclipse" ranks two past eclipses above the next one), and the hits are
 * already in the response — walking them costs zero extra requests. The caller must stop at the
 * first hit that resolves and must NOT fall through past a `label-year` rejection, which means
 * the right item was found (see `FALLTHROUGH_REASONS`).
 */
export function topQidsFromSearch(res: WpSearchResponse, limit = SEARCH_HITS): Array<{ qid: string; title: string }> {
  const pages = [...(res.query?.pages ?? [])].sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  const out: Array<{ qid: string; title: string }> = [];
  for (const p of pages) {
    if (out.length >= limit) break;
    if (p.pageprops?.disambiguation !== undefined) continue;
    const qid = p.pageprops?.wikibase_item;
    if (qid && /^Q\d+$/.test(qid)) out.push({ qid, title: String(p.title ?? "") });
  }
  return out;
}

export type WbSearchResponse = { search?: Array<{ id?: string; label?: string }>; error?: { code?: string; info?: string } };

export function topQidFromWbSearch(res: WbSearchResponse): string | null {
  const id = res.search?.[0]?.id;
  return id && /^Q\d+$/.test(id) ? id : null;
}

export type WbClaimsResponse = { claims?: Record<string, Array<{ mainsnak?: { snaktype?: string; datavalue?: { value?: unknown } }; rank?: string }>> };

export function isoFromClaims(res: WbClaimsResponse): string | null {
  for (const c of res.claims?.P297 ?? []) {
    if (c.rank === "deprecated" || c.mainsnak?.snaktype !== "value") continue;
    const v = c.mainsnak.datavalue?.value;
    if (typeof v === "string" && /^[A-Z]{2}$/.test(v)) return v;
  }
  return null;
}

/** Date properties in priority order: point in time, start time, publication date, UTC date of spacecraft launch. */
export const DATE_PROPS = ["P585", "P580", "P577", "P619"] as const;
export type DateProp = (typeof DATE_PROPS)[number];

/**
 * First property (in `DATE_PROPS` order) with a usable future time: preferred rank wins inside a
 * property (`bestClaims`), precision ≥ 9 (`parseWdTime` rejects decades), the period must not have
 * ended (`isFutureOrFar`, precision-aware) and must start inside the 15-year horizon.
 */
export function futureDate(entity: WdEntity | undefined, now: Date): { prop: DateProp; time: WdTime; raw: string } | null {
  for (const prop of DATE_PROPS) {
    const hits: Array<{ time: WdTime; raw: string }> = [];
    for (const c of bestClaims(entity, prop)) {
      const time = parseWdTime(c.mainsnak.datavalue?.value);
      if (!time) continue;
      if (!isFutureOrFar(time.day, time.precision, now) || isFarFuture(time.day, [], now)) continue;
      hits.push({ time, raw: String((c.mainsnak.datavalue?.value as { time?: unknown } | undefined)?.time ?? "") });
    }
    if (hits.length) {
      hits.sort((a, b) => (a.time.day < b.time.day ? -1 : a.time.day > b.time.day ? 1 : 0));
      return { prop, ...hits[0] };
    }
  }
  return null;
}

/** P31 classes whose category beats the label heuristics (`classify`). */
export const P31_CATEGORY: Record<string, Category> = {
  Q40231: "politics", // public election
  Q11424: "film",
  Q24869: "film", // feature film
  Q202866: "film", // animated film
  Q7889: "games", // video game
  Q13406554: "sports", // sports competition
  Q16510064: "sports", // sporting event
  Q18608583: "sports", // recurring sporting event
  Q500834: "sports", // tournament
  Q27020041: "sports", // sports season
  Q32096: "sports", // Super Bowl
  Q4504495: "entertainment", // award ceremony
  Q132241: "festivals",
  Q868557: "festivals", // music festival
  Q5398426: "tv", // television series
  Q15416: "tv", // television program
  Q482994: "music", // album
  Q182832: "music", // concert
  Q1573906: "music", // concert tour
  Q40218: "space", // spacecraft
  Q26540: "space", // artificial satellite
  Q2020153: "tech", // academic conference
};

export function categoryFor(label: string, p31: readonly string[], dateProp: DateProp): Category {
  if (dateProp === "P619") return "space";
  for (const id of p31) {
    const c = P31_CATEGORY[id];
    if (c) return c;
  }
  return classify(label, "culture").category;
}

/**
 * Sovereign-state QID → ISO 3166-1 alpha-2: **186 entries**, every one re-verified against live
 * `wdt:P297` on 2026-09-09 (batched `wbgetentities`; 0 mismatches, 0 missing P297). It is a seed,
 * not the full ISO list — anything absent (territories, historical states, the ~10 sovereign
 * states not seeded here) costs one `wbgetclaims` P297 lookup at run time, cached per process.
 * `tests/ingest/wanted.test.ts` pins the count and the shape so drift is visible.
 */
export const COUNTRY_ISO: Record<string, string> = {
  Q16: "CA", Q17: "JP", Q20: "NO", Q27: "IE", Q28: "HU", Q29: "ES", Q30: "US", Q31: "BE", Q32: "LU", Q33: "FI",
  Q34: "SE", Q35: "DK", Q36: "PL", Q37: "LT", Q38: "IT", Q39: "CH", Q40: "AT", Q41: "GR", Q43: "TR", Q45: "PT",
  Q55: "NL", Q77: "UY", Q79: "EG", Q96: "MX", Q114: "KE", Q142: "FR", Q145: "GB", Q148: "CN", Q155: "BR", Q159: "RU",
  Q183: "DE", Q184: "BY", Q189: "IS", Q191: "EE", Q211: "LV", Q212: "UA", Q213: "CZ", Q214: "SK", Q215: "SI", Q217: "MD",
  Q218: "RO", Q219: "BG", Q221: "MK", Q222: "AL", Q224: "HR", Q225: "BA", Q227: "AZ", Q229: "CY", Q230: "GE", Q232: "KZ",
  Q233: "MT", Q235: "MC", Q236: "ME", Q238: "SM", Q241: "CU", Q244: "BB", Q252: "ID", Q258: "ZA", Q262: "DZ", Q265: "UZ",
  Q298: "CL", Q334: "SG", Q347: "LI", Q398: "BH", Q399: "AM", Q403: "RS", Q408: "AU", Q414: "AR", Q419: "PE", Q423: "KP",
  Q424: "KH", Q574: "TL", Q664: "NZ", Q668: "IN", Q672: "TV", Q678: "TO", Q683: "WS", Q685: "SB", Q686: "VU", Q691: "PG",
  Q695: "PW", Q697: "NR", Q702: "FM", Q709: "MH", Q710: "KI", Q711: "MN", Q712: "FJ", Q717: "VE", Q730: "SR", Q733: "PY",
  Q734: "GY", Q736: "EC", Q739: "CO", Q750: "BO", Q754: "TT", Q757: "VC", Q760: "LC", Q766: "JM", Q769: "GD", Q774: "GT",
  Q778: "BS", Q781: "AG", Q783: "HN", Q784: "DM", Q786: "DO", Q790: "HT", Q792: "SV", Q794: "IR", Q796: "IQ", Q800: "CR",
  Q801: "IL", Q804: "PA", Q805: "YE", Q810: "JO", Q811: "NI", Q813: "KG", Q817: "KW", Q819: "LA", Q822: "LB", Q826: "MV",
  Q833: "MY", Q836: "MM", Q837: "NP", Q842: "OM", Q843: "PK", Q846: "QA", Q851: "SA", Q854: "LK", Q858: "SY", Q863: "TJ",
  Q865: "TW", Q869: "TH", Q874: "TM", Q878: "AE", Q881: "VN", Q884: "KR", Q889: "AF", Q902: "BD", Q912: "ML", Q916: "AO",
  Q921: "BN", Q924: "TZ", Q928: "PH", Q929: "CF", Q945: "TG", Q948: "TN", Q953: "ZM", Q954: "ZW", Q962: "BJ", Q963: "BW",
  Q965: "BF", Q967: "BI", Q970: "KM", Q971: "CG", Q974: "CD", Q977: "DJ", Q983: "GQ", Q986: "ER", Q1000: "GA", Q1005: "GM",
  Q1006: "GN", Q1007: "GW", Q1008: "CI", Q1009: "CM", Q1013: "LS", Q1014: "LR", Q1019: "MG", Q1020: "MW", Q1025: "MR",
  Q1027: "MU", Q1028: "MA", Q1029: "MZ", Q1030: "NA", Q1032: "NE", Q1033: "NG", Q1036: "UG", Q1037: "RW", Q1039: "ST",
  Q1041: "SN", Q1042: "SC", Q1044: "SL", Q1045: "SO", Q1049: "SD", Q1050: "SZ", Q1246: "XK", Q219060: "PS",
};

export type Resolved = {
  qid: string;
  label: string;
  enwiki: string;
  prop: DateProp;
  time: WdTime;
  rawTime: string;
  p31: string[];
  p17: string[];
};

export type ReadReason = "missing" | "no-label" | "bare-qid" | "no-enwiki" | "no-future-date" | "label-year";
export type ReadResult = { ok: true; value: Resolved } | { ok: false; reason: ReadReason };

/**
 * Rejections that mean "this hit is not the thing being searched for", so the next search hit may
 * be tried. `label-year` is deliberately excluded: it fires when the item IS the match but
 * Wikidata's English label disagrees with the date (the recorded Eurovision item is labelled
 * "…2028" while its sitelink and P585 say 2027), and falling through there would silently pick a
 * sibling item — hit 2 for "eurovision 2027" is "Melodifestivalen 2027". `bare-qid` is excluded
 * for the same reason: the item matched, its label is just unusable.
 */
export const FALLTHROUGH_REASONS: ReadonlySet<ReadReason> = new Set<ReadReason>(["missing", "no-label", "no-enwiki", "no-future-date"]);

/** Entity → resolution facts, or the reason the item is not a countdown. */
export function readEntity(entity: WdEntity | undefined, now: Date): ReadResult {
  if (!entity || entity.missing !== undefined) return { ok: false, reason: "missing" };
  const label = enLabel(entity);
  if (!label) return { ok: false, reason: "no-label" };
  if (/^Q\d+$/i.test(label)) return { ok: false, reason: "bare-qid" };
  const enwiki = entity.sitelinks?.enwiki?.title?.trim();
  if (!enwiki) return { ok: false, reason: "no-enwiki" };
  const date = futureDate(entity, now);
  if (!date) return { ok: false, reason: "no-future-date" };
  if (!labelYearConsistent(label, Number(date.time.day.slice(0, 4)))) return { ok: false, reason: "label-year" };
  return {
    ok: true,
    value: {
      qid: entity.id,
      label,
      enwiki,
      prop: date.prop,
      time: date.time,
      rawTime: date.raw,
      p31: itemIds(entity, "P31"),
      p17: itemIds(entity, "P17"),
    },
  };
}

export type BuildInput = {
  /** Zero-result searches for this query in the window (drives popularity). */
  n: number;
  /** sha1 of the normalised query; the query text itself is never stored. */
  hash: string;
  regions: string[];
};

/** Popularity ceiling for this source — the §0 convention for high-volume, non-marquee sources. */
export const POPULARITY_CAP = 35;

/**
 * Low-confidence tentative row: `wanted:<QID>`, never featured, never indexable (confidence 0.5).
 *
 * Popularity is `min(35, 25 + min(20, n))`. The brief's §19 formula is `25 + min(20, n)`, which
 * tops out at 45; it is clamped to the §0 convention cap of 35 on purpose, because `n` is a raw
 * count from the anon-callable `log_search()` RPC — an unauthenticated visitor can drive any query
 * to its ceiling by repeating a search. At 45 a row trips the `popularity >= 45` branch of
 * `finalize_catalog` (supabase/migrations/0005_precision.sql) and queues summary + image
 * enrichment for an item nothing has confirmed. 35 keeps the ordering signal for n = 3..10 and
 * still clears the home listing's `minPopularity: 30`. See the adapter's report — this deviates
 * from the literal brief text and is flagged for the brief owner.
 *
 * `tags` come from `classify` only when `classify` agrees with the resolved category (P31 / P619
 * heuristics win), so a sports or space item whose label happens to trip the remembrance/royal
 * TAG_RULES does not get contradictory tags. Every row carries the provenance tag `wanted`.
 */
export function buildWantedEvent(r: Resolved, input: BuildInput): IngestEvent {
  const category = categoryFor(r.label, r.p31, r.prop);
  const guess = classify(r.label, "culture");
  const tags = [...(guess.category === category ? guess.tags : []), "wanted"];
  return buildEvent({
    title: r.label,
    date: r.time.day,
    category,
    tags,
    regions: input.regions,
    description: "",
    source: "wanted",
    sourceUrl: `https://www.wikidata.org/wiki/${r.qid}`,
    sourceKey: `wanted:${r.qid}`,
    popularity: Math.min(POPULARITY_CAP, 25 + Math.min(20, Math.max(0, Math.floor(input.n)))),
    datePrecision: r.time.precision,
    status: "tentative",
    confidence: 0.5,
    featured: false,
    externalIds: { qid: r.qid, enwiki: r.enwiki, search_hash: input.hash },
    raw: { qid: r.qid, label: r.label, enwiki: r.enwiki, prop: r.prop, time: r.rawTime, precision: r.time.precision, p31: r.p31, p17: r.p17 },
  });
}
