import type { Category } from "@/lib/types";
import { COUNTRY_NAMES } from "@/lib/regions";
import { buildEvent, classify, isFutureOrFar } from "../../normalize";
import type { Adapter, IngestContext, IngestEvent, IngestLogger, Json, Plan, Unit } from "../../types";
import { OBSERVANCE_OVERRIDES, OVERRIDE_QIDS } from "./overrides";
import { describeRule, longDate, occurrence, parseDayLabel, ruleKey, type Recurrence } from "./rules";

/**
 * Awareness days, national days and the notable fun/holiday long tail from Wikidata (CC0),
 * materialised as yearly occurrences for `now.year … now.year + OBSERVANCES_YEARS - 1`:
 *
 *  - `q2558684`  P31 = world day / international observance          → category `awareness`
 *  - `q57598`    P31/P279* = national day (small subtree)            → category `national`
 *  - `p837`      P31 ∈ { awareness day Q422695, holiday Q1445650, public holiday Q1197685,
 *                commemorative day Q136624236 } with an enwiki article, minus the two above
 *                                                                    → `fun` / `classify()`
 *  - `overrides` src/lib/ingest/sources/observances/overrides.ts (offline)
 *
 * P837 ("day in year for periodic occurrence") values are items; the English label is parsed
 * by observances/rules.ts into a recurrence rule (fixed day, nth weekday, Easter offset,
 * equinox/solstice, Chinese lunar) that is expanded per year and stored in `raw.recurrence`
 * for the series page. Non-Gregorian rules (Nisan, Farvardin, tithis, "variable") are skipped.
 *
 * Paging is keyset-based on the item IRI (`FILTER(STR(?item) > …) ORDER BY STR(?item)`) inside a
 * DISTINCT-item subquery, so a page holds whole items (an item's statements never straddle two
 * pages) and the cursor `{ kind, afterQid }` is content-addressed. ≤ ~10 SPARQL queries per
 * monthly pass, serial, ≥ 5 s apart; no `SERVICE wikibase:label` (rdfs:label + LANG filter) so
 * the queries survive the WDQS → QLever migration.
 *
 * Licence: Wikidata statements are CC0 ("Observance data: Wikidata (CC0)" on `public.sources`).
 * Images referenced by P18 are NOT CC0 — only a candidate URL is recorded; enrichment verifies
 * the per-file licence via `extmetadata` before anything is re-hosted.
 *
 * Rejected alternatives (never add): un.org International Days list (ToU: "personal,
 * non-commercial use … without any right to … compile or create derivative works"); National Day
 * Calendar / daysoftheyear.com / nationaltoday.com / awarenessdays.com (proprietary editorial,
 * licensing is the business model); Checkiday (Basic plan non-commercial); Kaggle "unofficial
 * holidays" CSV dumps (unlicensed laundered scrapes).
 */

export const WD_ENDPOINT = "https://query.wikidata.org/sparql";
export const ENTITY_PREFIX = "http://www.wikidata.org/entity/";
/** Items per SPARQL page (whole items; the outer join fans out to ~1.5–3 bindings per item). */
export const PAGE_ITEMS = 250;
/** Pages per kind per pass (caps a kind at 3,000 items even if the class balloons). */
const MAX_PAGES = 12;
const DEFAULT_YEARS = 3;
/** §0: high-volume sources cap popularity at 35 (world days and the fun tail; national days are exempt). */
export const POPULARITY_CAP = 35;
const SOURCE = "observances" as const;

export type Kind = "overrides" | "q2558684" | "q57598" | "p837";
export const KINDS: Kind[] = ["overrides", "q2558684", "q57598", "p837"];

/**
 * Classes of the fun/holiday long tail (resolved with wbsearchentities on 2026-09-09): awareness
 * day, holiday, commemorative day. "public holiday" (Q1197685, 1,334 P837 items) is deliberately
 * excluded: those rows belong to the `holidays`/`openholidays` adapters and this rank-6 source
 * would overwrite their richer merged rows on every slug collision.
 */
export const P837_TYPES = ["Q422695", "Q1445650", "Q136624236"] as const;
export const PUBLIC_HOLIDAY_QID = "Q1197685";

/** Number of years materialised per item, `OBSERVANCES_YEARS` env (1..15, default 3). */
export function yearsAhead(): number {
  const n = Number(process.env.OBSERVANCES_YEARS);
  return Number.isFinite(n) && n >= 1 ? Math.min(15, Math.floor(n)) : DEFAULT_YEARS;
}

function itemSelector(kind: Exclude<Kind, "overrides">): string {
  switch (kind) {
    case "q2558684":
      return "?item wdt:P31 wd:Q2558684 ; wdt:P837 [] .";
    case "q57598":
      return "?item wdt:P31/wdt:P279* wd:Q57598 ; wdt:P837 [] .";
    case "p837":
      return `VALUES ?t { ${P837_TYPES.map((q) => `wd:${q}`).join(" ")} }
      ?item wdt:P31 ?t ; wdt:P837 [] .
      ?ew schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
      FILTER NOT EXISTS { ?item wdt:P31 wd:Q2558684 }
      FILTER NOT EXISTS { ?item wdt:P31 wd:${PUBLIC_HOLIDAY_QID} }
      FILTER NOT EXISTS { ?item wdt:P31/wdt:P279* wd:Q57598 }`;
  }
}

/**
 * One page of whole items after `afterQid`. Every outer pattern is OPTIONAL (or guaranteed by
 * the selector) so each item of the subquery appears in the bindings: the "last page" signal is
 * `distinct items < PAGE_ITEMS`, which must not be tripped by an item lacking an English label.
 */
export function buildObservancesQuery(kind: Exclude<Kind, "overrides">, afterQid: string | null, limit = PAGE_ITEMS): string {
  const after = afterQid ? `\n      FILTER(STR(?item) > "${ENTITY_PREFIX}${afterQid}")` : "";
  const typeClause =
    kind === "p837" ? `  ?item wdt:P31 ?type . FILTER(?type IN (${P837_TYPES.map((q) => `wd:${q}`).join(", ")}))\n` : "";
  const typeVar = kind === "p837" ? " ?type" : "";
  return `
SELECT ?item ?itemLabel ?sl ?day ?dayLabel ?rank ?stIso ?itemIso ?img ?enwiki${typeVar} WHERE {
  {
    SELECT DISTINCT ?item WHERE {
      ${itemSelector(kind)}${after}
    }
    ORDER BY STR(?item)
    LIMIT ${limit}
  }
  OPTIONAL { ?item wikibase:sitelinks ?sl . }
  OPTIONAL { ?item rdfs:label ?itemLabel . FILTER(LANG(?itemLabel) = "en") }
  ?item p:P837 ?st .
  ?st ps:P837 ?day ; wikibase:rank ?rank .
  FILTER(?rank != wikibase:DeprecatedRank)
  OPTIONAL { ?day rdfs:label ?dayLabel . FILTER(LANG(?dayLabel) = "en") }
  OPTIONAL { ?st pq:P17 ?stCtry . ?stCtry wdt:P297 ?stIso . }
  OPTIONAL { ?item wdt:P17 ?itemCtry . ?itemCtry wdt:P297 ?itemIso . }
  OPTIONAL { ?item wdt:P18 ?img . }
  OPTIONAL { ?enwiki schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
${typeClause}}
ORDER BY ?item`.trim();
}

export type SparqlBinding = Record<string, { type: string; value: string; datatype?: string } | undefined>;

type Statement = { dayQid: string; dayLabel: string | null; preferred: boolean; stIsos: Set<string> };

type Item = {
  qid: string;
  label: string | null;
  sitelinks: number;
  enwiki: string | null;
  images: Set<string>;
  itemIsos: Set<string>;
  types: Set<string>;
  statements: Map<string, Statement>;
};

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const INTERNATIONAL_RE = /^(International|World) .* (Day|Week)$/;
const NATURE_RE = /environment|ocean|forest|biodiversity|climate|wildlife|\bnature\b|animal|bird|\bbee|\bsoil|\bwater\b|earth\b/i;
const Q_LABEL_RE = /^Q\d+$/;
/** Wiki-namespace labels ("Wikipedia:Justin Knapp Day") are project pages, not observances. */
const NAMESPACE_LABEL_RE = /^(Wikipedia|Wikidata|Commons|Meta|Template|Category|User|Help|Portal):/i;
/** "100th Anniversary of the Republic of Turkey": a one-off edition, not a recurring observance. */
const ONE_OFF_LABEL_RE = /\b\d+(st|nd|rd|th) (anniversary|edition|jubilee)\b/i;

function qidOf(iri: string | undefined): string | null {
  if (!iri || !iri.startsWith(ENTITY_PREFIX)) return null;
  const q = iri.slice(ENTITY_PREFIX.length);
  return /^Q\d+$/.test(q) ? q : null;
}

/** Commons `Special:FilePath/<name>` IRI → decoded file name. */
export function commonsFileName(iri: string): string | null {
  try {
    const path = new URL(iri).pathname;
    const i = path.indexOf("Special:FilePath/");
    if (i < 0) return null;
    const name = decodeURIComponent(path.slice(i + "Special:FilePath/".length)).replace(/_/g, " ").trim();
    return name || null;
  } catch {
    return null;
  }
}

/** Deterministic image candidate: raster files only (pdf/svg/tif need conversion), then the alphabetically first name. */
export function pickImage(images: Iterable<string>): { url: string; meta: Record<string, unknown> } | null {
  const names = [...images].map(commonsFileName).filter((n): n is string => Boolean(n) && IMAGE_EXT.test(n as string));
  if (!names.length) return null;
  names.sort();
  const name = names[0];
  const encoded = encodeURIComponent(name.replace(/ /g, "_"));
  return {
    url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}`,
    meta: { provider: "commons", pageUrl: `https://commons.wikimedia.org/wiki/File:${encoded}` },
  };
}

export function enwikiTitle(articleUrl: string | null): string | null {
  if (!articleUrl) return null;
  try {
    const path = new URL(articleUrl).pathname.replace(/^\/wiki\//, "");
    const title = decodeURIComponent(path).replace(/_/g, " ").trim();
    return title || null;
  } catch {
    return null;
  }
}

/** Group bindings by item (P837 statements, P17 codes, P18 files, sitelink count). */
export function groupBindings(bindings: SparqlBinding[]): Map<string, Item> {
  const items = new Map<string, Item>();
  for (const b of bindings) {
    const qid = qidOf(b.item?.value);
    if (!qid) continue;
    let it = items.get(qid);
    if (!it) {
      it = { qid, label: null, sitelinks: 0, enwiki: null, images: new Set(), itemIsos: new Set(), types: new Set(), statements: new Map() };
      items.set(qid, it);
    }
    if (b.itemLabel?.value && !it.label) it.label = b.itemLabel.value.trim();
    if (b.sl?.value) it.sitelinks = Math.max(it.sitelinks, Number(b.sl.value) || 0);
    if (b.enwiki?.value && !it.enwiki) it.enwiki = b.enwiki.value;
    if (b.img?.value) it.images.add(b.img.value);
    if (b.itemIso?.value) it.itemIsos.add(b.itemIso.value.toUpperCase());
    const type = qidOf(b.type?.value);
    if (type) it.types.add(type);
    const dayQid = qidOf(b.day?.value);
    if (dayQid) {
      let st = it.statements.get(dayQid);
      if (!st) {
        st = { dayQid, dayLabel: null, preferred: false, stIsos: new Set() };
        it.statements.set(dayQid, st);
      }
      if (b.dayLabel?.value && !st.dayLabel) st.dayLabel = b.dayLabel.value.trim();
      if (/PreferredRank$/.test(b.rank?.value ?? "")) st.preferred = true;
      if (b.stIso?.value) st.stIsos.add(b.stIso.value.toUpperCase());
    }
  }
  return items;
}

export type Resolved = { rule: Recurrence; dayLabel: string; stIsos: Set<string> };

/**
 * One rule per item. Preferred-rank statements win; among the rest a statement without a
 * country qualifier beats country-specific ones, then one whose country matches the item's own;
 * if more than one distinct Gregorian rule survives the item is ambiguous and skipped.
 */
export function resolveRule(item: Item): { ok: true; value: Resolved } | { ok: false; reason: "unparsable" | "conflict"; labels: string[] } {
  const parsed: Array<Resolved & { preferred: boolean }> = [];
  const labels: string[] = [];
  for (const st of item.statements.values()) {
    const label = st.dayLabel ?? st.dayQid;
    labels.push(label);
    const rule = st.dayLabel ? parseDayLabel(st.dayLabel) : null;
    if (rule) parsed.push({ rule, dayLabel: st.dayLabel as string, stIsos: st.stIsos, preferred: st.preferred });
  }
  if (!parsed.length) return { ok: false, reason: "unparsable", labels };
  const distinct = (list: Array<Resolved>) => new Set(list.map((p) => ruleKey(p.rule))).size;
  let pool: Array<Resolved & { preferred: boolean }> = parsed;
  if (distinct(pool) > 1 && pool.some((p) => p.preferred)) pool = pool.filter((p) => p.preferred);
  if (distinct(pool) > 1 && pool.some((p) => p.stIsos.size === 0)) pool = pool.filter((p) => p.stIsos.size === 0);
  if (distinct(pool) > 1 && item.itemIsos.size) {
    const match = pool.filter((p) => [...p.stIsos].some((c) => item.itemIsos.has(c)));
    if (match.length) pool = match;
  }
  if (distinct(pool) > 1) return { ok: false, reason: "conflict", labels };
  // Same rule from several statements (e.g. one per country): union the country codes.
  const stIsos = new Set<string>();
  for (const p of pool) for (const c of p.stIsos) stIsos.add(c);
  pool.sort((a, b) => (a.dayLabel < b.dayLabel ? -1 : a.dayLabel > b.dayLabel ? 1 : 0));
  return { ok: true, value: { rule: pool[0].rule, dayLabel: pool[0].dayLabel, stIsos } };
}

/**
 * Category per kind. Returns null for a `p837` item that belongs to the holiday adapters
 * (Christmas/Easter/New Year/Eid/national/labour/thanksgiving/royal families per TAG_RULES —
 * "Christmas in Poland", "Whit Monday", "Thanksgiving (Canada)"); remembrance days stay, as `culture`.
 */
export function categoryFor(kind: Kind, label: string, types: ReadonlySet<string>): { category: Category; tags: string[] } | null {
  if (kind === "q57598") return { category: "national", tags: [...classify(label, "national").tags, "national-day"] };
  if (kind === "q2558684") {
    const { category, tags } = classify(label, "awareness");
    return { category: category === "nature" || NATURE_RE.test(label) ? "nature" : "awareness", tags: [...tags, "awareness-day"] };
  }
  if (types.has(PUBLIC_HOLIDAY_QID)) return null; // belt and braces: the SPARQL selector excludes the class too
  const { category, tags } = classify(label, "fun");
  const extra = types.has("Q422695") ? ["awareness-day"] : [];
  if (category === "holidays") {
    if (!tags.includes("remembrance")) return null;
    return { category: "culture", tags: [...tags, ...extra] };
  }
  return { category, tags: [...tags, ...extra] };
}

/** Drop titles that name a year other than the row's ("2026 edition" rows are not recurring). */
export function labelYearConsistent(label: string, year: number): boolean {
  const years = label.match(/\b(19|20|21)\d{2}\b/g) ?? [];
  return years.every((y) => Number(y) === year);
}

/** Prose names where `COUNTRY_NAMES` reads badly mid-sentence ("observed in United States of America"). */
const PROSE_COUNTRY: Record<string, string> = {
  US: "the United States",
  GB: "the United Kingdom",
  CI: "Côte d'Ivoire",
  ML: "Mali",
  NE: "Niger",
  GQ: "Equatorial Guinea",
  VA: "Vatican City",
};
/** Country names that take a definite article in running text ("the Netherlands", "the Cayman Islands"). */
const ARTICLE_NAME_RE =
  /^(United |Republic of |Democratic |Central African|Dominican Republic|Czech Republic|Netherlands|Caribbean Netherlands|Philippines|Bahamas|Comoros|Seychelles|Gambia|Maldives|Marshall Islands|Solomon Islands|Isle of Man|.*\bIslands$)/;

/** Country name as used inside our own sentences. */
export function proseCountryName(code: string): string {
  if (PROSE_COUNTRY[code]) return PROSE_COUNTRY[code];
  const name = COUNTRY_NAMES[code] ?? code;
  return ARTICLE_NAME_RE.test(name) ? `the ${name}` : name;
}

function regionNames(regions: readonly string[]): string {
  const names = regions.filter((r) => r !== "GLOBAL").map(proseCountryName);
  if (!names.length) return "";
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} and ${names.length - 3} more countries`;
}

/** Own-written two-sentence description (never Wikipedia/Wikidata prose). */
export function describe(title: string, rule: Recurrence, regions: readonly string[], date: string, kind: Kind): string {
  const where = regionNames(regions);
  const year = date.slice(0, 4);
  const first =
    kind === "q57598" && where
      ? `${title} is a national day observed in ${where} every year ${describeRule(rule)}.`
      : where
        ? `${title} is observed in ${where} every year ${describeRule(rule)}.`
        : `${title} is observed every year ${describeRule(rule)}.`;
  return `${first} In ${year} it falls on ${longDate(date)}.`;
}

export type ExpandInput = {
  kind: Kind;
  title: string;
  rule: Recurrence;
  regions: string[];
  category: Category;
  tags: string[];
  sourceUrl: string;
  sourceKeyBase: string;
  externalIds: Record<string, unknown>;
  popularity: number;
  confidence: number;
  description?: string;
  image: { url: string; meta: Record<string, unknown> } | null;
  raw: Record<string, unknown>;
};

/** Expand one rule into one row per upcoming year. */
export function expandRows(input: ExpandInput, now: Date, years = yearsAhead()): IngestEvent[] {
  const startYear = now.getUTCFullYear();
  const rows: IngestEvent[] = [];
  for (let y = startYear; y < startYear + years; y++) {
    const date = occurrence(input.rule, y);
    if (!date) continue;
    if (!isFutureOrFar(date, "day", now)) continue;
    if (!labelYearConsistent(input.title, y)) continue;
    const ev = buildEvent({
      title: input.title,
      date,
      category: input.category,
      tags: input.tags,
      regions: input.regions,
      description: input.description ?? describe(input.title, input.rule, input.regions, date, input.kind),
      source: SOURCE,
      sourceUrl: input.sourceUrl,
      sourceKey: `${input.sourceKeyBase}:${y}`,
      slugFallbackPrefix: "observance",
      featured: false,
      popularity: input.popularity,
      allDay: true,
      timezone: null,
      datePrecision: "day",
      status: "scheduled",
      confidence: input.confidence,
      externalIds: input.externalIds,
      seriesSlug: null,
      location: null,
      raw: input.raw,
    });
    if (input.image) {
      ev.image_candidate_url = input.image.url;
      ev.image_candidate_meta = input.image.meta;
    }
    rows.push(ev);
  }
  return rows;
}

export type Skips = { unparsable: string[]; conflict: string[]; noLabel: number; noRegion: number; overridden: number; holidayOwned: number };

export function emptySkips(): Skips {
  return { unparsable: [], conflict: [], noLabel: 0, noRegion: 0, overridden: 0, holidayOwned: 0 };
}

/** Bindings of one page → rows (pure). `skips` collects what was dropped for the log. */
export function bindingsToEvents(bindings: SparqlBinding[], kind: Exclude<Kind, "overrides">, now: Date, skips?: Skips, years?: number): IngestEvent[] {
  const rows: IngestEvent[] = [];
  const s: Skips = skips ?? emptySkips();
  for (const item of groupBindings(bindings).values()) {
    if (OVERRIDE_QIDS.has(item.qid)) {
      s.overridden++;
      continue;
    }
    if (!item.label || Q_LABEL_RE.test(item.label) || NAMESPACE_LABEL_RE.test(item.label) || ONE_OFF_LABEL_RE.test(item.label)) {
      s.noLabel++;
      continue;
    }
    const res = resolveRule(item);
    if (!res.ok) {
      (res.reason === "conflict" ? s.conflict : s.unparsable).push(`${item.qid} ${item.label}: ${res.labels.join(" | ")}`);
      continue;
    }
    const { rule, dayLabel, stIsos } = res.value;
    let regions: string[];
    if (kind === "q57598") {
      regions = [...new Set([...item.itemIsos, ...stIsos])].sort();
      if (!regions.length) {
        s.noRegion++;
        continue;
      }
    } else {
      const codes = stIsos.size ? stIsos : item.itemIsos;
      regions = codes.size ? [...codes].sort() : ["GLOBAL"];
    }
    const cat = categoryFor(kind, item.label, item.types);
    if (!cat) {
      s.holidayOwned++;
      continue;
    }
    const { category, tags } = cat;
    const allTags = [...tags, "observance", "wikidata"];
    if (INTERNATIONAL_RE.test(item.label)) allTags.push("international-day");
    const enwiki = enwikiTitle(item.enwiki);
    // Brief §7 formula, clamped to the §0 high-volume cap for the two bulk kinds (~5,000 rows per
    // pass); national days are a small set that §22 lets this source win, so they keep base 45.
    const sitelinkBonus = Math.min(20, Math.floor(item.sitelinks / 5));
    const popularity = kind === "q57598" ? 45 + sitelinkBonus : Math.min(POPULARITY_CAP, 30 + sitelinkBonus);
    const raw: Record<string, unknown> = {
      qid: item.qid,
      dayLabel,
      recurrence: rule,
      sitelinks: item.sitelinks,
      kind,
      ...(item.types.size ? { types: [...item.types].sort() } : {}),
    };
    rows.push(
      ...expandRows(
        {
          kind,
          title: item.label,
          rule,
          regions,
          category,
          tags: allTags,
          sourceUrl: item.enwiki ?? `https://www.wikidata.org/wiki/${item.qid}`,
          sourceKeyBase: `${SOURCE}:${item.qid}`,
          externalIds: { qid: item.qid, ...(enwiki ? { enwiki } : {}) },
          popularity,
          confidence: rule.kind === "fixed_day" ? 0.9 : 0.8,
          image: pickImage(item.images),
          raw,
        },
        now,
        years,
      ),
    );
  }
  return rows;
}

/** The offline overrides unit. */
export function overrideRows(now: Date, years?: number): IngestEvent[] {
  const rows: IngestEvent[] = [];
  for (const o of OBSERVANCE_OVERRIDES) {
    const id = o.qid ?? `x-${o.key ?? ""}`;
    if (id === "x-") continue;
    const { tags } = classify(o.title, o.category);
    rows.push(
      ...expandRows(
        {
          kind: "overrides",
          title: o.title,
          rule: o.rule,
          regions: o.regions,
          category: o.category,
          tags: [...tags, ...o.tags, "observance"],
          sourceUrl: o.sourceUrl,
          sourceKeyBase: `${SOURCE}:${id}`,
          externalIds: o.qid ? { qid: o.qid } : {},
          popularity: Math.min(POPULARITY_CAP, o.popularity),
          confidence: 0.9,
          image: null,
          raw: { ...(o.qid ? { qid: o.qid } : { key: o.key }), recurrence: o.rule, override: true },
        },
        now,
        years,
      ).map((ev) => {
        // Prepend the curated sentence; the computed date sentence stays so the text is two sentences.
        ev.description = `${o.description} ${describe(o.title, o.rule, o.regions, ev.date, "overrides")}`;
        return ev;
      }),
    );
  }
  return rows;
}

/**
 * Cursor `{ kind, afterQid, page }`: `afterQid` is the last item of the previous page (keyset,
 * content-addressed); `page` only enforces MAX_PAGES. `fetched`/`last`/`lastQid` are set by run()
 * and read by the `after` getter, so the resume point comes from what the page actually returned.
 * A unit whose fetch never completed (WDQS 5xx after all retries, budget cut) reports its own
 * cursor as `after`: the runner persists it and re-plans the same page next time instead of
 * silently skipping the rest of the kind (a keyset cursor cannot skip a page it never saw).
 */
export type ObsUnit = Unit & { kind: Kind; afterQid: string | null; page: number; fetched: boolean; lastQid: string | null; last: boolean };
export type Cursor = { kind: Kind; afterQid: string | null; page: number };

export function nextKind(kind: Kind): Kind | null {
  const i = KINDS.indexOf(kind);
  return i >= 0 && i + 1 < KINDS.length ? KINDS[i + 1] : null;
}

export function parseCursor(cursor: Json | null): Cursor | "end" {
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    const c = cursor as { kind?: unknown; afterQid?: unknown; page?: unknown };
    if (c.kind === "end") return "end";
    if (typeof c.kind === "string" && (KINDS as string[]).includes(c.kind)) {
      const afterQid = typeof c.afterQid === "string" && /^Q\d+$/.test(c.afterQid) ? c.afterQid : null;
      const page = typeof c.page === "number" && c.page >= 0 ? Math.floor(c.page) : 0;
      return { kind: c.kind as Kind, afterQid, page };
    }
  }
  return { kind: KINDS[0], afterQid: null, page: 0 };
}

function afterOf(unit: ObsUnit): Json {
  if (!unit.fetched) return { kind: unit.kind, afterQid: unit.afterQid, page: unit.page };
  if (unit.last || !unit.lastQid) {
    const next = nextKind(unit.kind);
    return next ? { kind: next, afterQid: null, page: 0 } : { kind: "end" };
  }
  return { kind: unit.kind, afterQid: unit.lastQid, page: unit.page + 1 };
}

function logSkips(log: IngestLogger, label: string, s: Skips): void {
  const parts: string[] = [];
  if (s.unparsable.length) parts.push(`${s.unparsable.length} unparsable day label(s)`);
  if (s.conflict.length) parts.push(`${s.conflict.length} multi-day conflict(s)`);
  if (s.noLabel) parts.push(`${s.noLabel} without English label`);
  if (s.noRegion) parts.push(`${s.noRegion} national day(s) without ISO country`);
  if (s.overridden) parts.push(`${s.overridden} covered by overrides`);
  if (s.holidayOwned) parts.push(`${s.holidayOwned} holiday-family item(s) left to the holiday adapters`);
  if (parts.length) log.info(`${label}: skipped ${parts.join(", ")}`);
  for (const line of s.unparsable.slice(0, 15)) log.info(`${label}: unparsable P837 label — ${line}`);
  for (const line of s.conflict.slice(0, 10)) log.info(`${label}: conflicting P837 values — ${line}`);
}

export const adapter: Adapter<ObsUnit> = {
  id: SOURCE,
  label: "Wikidata observances (world/national/fun days)",
  rank: 6,
  cadence: "monthly",
  isConfigured: () => true,
  limits: { concurrency: 1, minIntervalMs: 5000, timeoutMs: 65_000, maxRetries: 3 },

  async plan(cursor): Promise<Plan<ObsUnit>> {
    const c = parseCursor(cursor);
    if (c === "end") return { units: [], done: true };
    let { kind, afterQid, page } = c;
    // Past the page cap: move on to the next kind (a last page already advanced via `after`).
    while (page >= MAX_PAGES) {
      const next = nextKind(kind);
      if (!next) return { units: [], done: true };
      kind = next;
      afterQid = null;
      page = 0;
    }
    const unit: ObsUnit = {
      key: `${SOURCE}:${kind}:${afterQid ?? "start"}`,
      label: kind === "overrides" ? "overrides" : `${kind} page ${page + 1}${afterQid ? ` after ${afterQid}` : ""}`,
      kind,
      afterQid,
      page,
      fetched: false,
      lastQid: null,
      last: false,
      get after(): Json {
        return afterOf(this);
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

  async run(unit, ctx: IngestContext) {
    if (unit.kind === "overrides") {
      unit.fetched = true;
      unit.last = true;
      const rows = overrideRows(ctx.now);
      ctx.log.info(`overrides: ${rows.length} rows`);
      return rows;
    }
    const query = buildObservancesQuery(unit.kind, unit.afterQid);
    const url = `${WD_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
    const json = await ctx.http.fetchJson<{ results?: { bindings?: SparqlBinding[] } }>(url, {
      headers: { Accept: "application/sparql-results+json" },
    });
    unit.fetched = true;
    const bindings = json?.results?.bindings ?? [];
    const qids = new Set<string>();
    let lastQid: string | null = null;
    for (const b of bindings) {
      const q = qidOf(b.item?.value);
      if (!q) continue;
      qids.add(q);
      if (lastQid === null || q > lastQid) lastQid = q; // lexicographic, same order as STR(?item)
    }
    unit.lastQid = lastQid;
    unit.last = qids.size < PAGE_ITEMS;
    const skips = emptySkips();
    const rows = bindingsToEvents(bindings, unit.kind, ctx.now, skips);
    ctx.log.info(`${unit.label}: ${bindings.length} bindings, ${qids.size} items → ${rows.length} rows${unit.last ? " (last page)" : ""}`);
    logSkips(ctx.log, unit.label, skips);
    return rows;
  },
};
