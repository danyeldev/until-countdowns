import type { Category } from "@/lib/types";
import { COUNTRY_NAMES } from "@/lib/regions";
import { buildEvent, classify, FAR_FUTURE_YEARS, isFarFuture, isFutureOrFar, precisionFromWikidata, slugify } from "../../normalize";
import type { IngestContext, IngestEvent, IngestPrecision, Json } from "../../types";
import { enwikiTitle, labelYearConsistent, type SparqlBinding, WD_ENDPOINT } from "./common";

/**
 * Phase 2 of the `wikidata` adapter ("wikidata-more"): additional families harvested through
 * the statement path (`p:PROP / psv:PROP`), which carries the stored precision and rank, over
 * three date slices (`now → Y+3`, `Y+3 → Y+6`, `Y+6 → Y+15`). Every family either has no class
 * filter (P619 launches, P1619 openings) or walks one `wdt:P31/wdt:P279*` subtree and, when
 * phase 1 already queries the root class directly, excludes those direct instances (`MINUS`) so
 * the two phases emit disjoint rows and no `source_key` is written twice per pass.
 *
 * Verified 2026-09-09 (live, UA-identified): elections subtree 3 s / 16 items in slice 1;
 * awards 1 s; launches 1 s / 9; film subtree 16 s / 95; game subtree 9 s; world's fair 1 s;
 * festival subtree 2 s / 0. Albums (Q482994, direct or subtree) cost 18–55 s for a single
 * future item and were dropped. A `P18` join inside the harvest returned 504, so images,
 * venue label/coordinates and the country flag come from a second, VALUES-bound query per
 * 100 items (~0.6 s) — far cheaper than wbgetentities, whose country entities weigh MBs each.
 *
 * Rejected for this family set (see brief §20): TMDB/IGDB/RAWG (non-commercial or agreement
 * gated), IFES ElectionGuide (bot-blocked, 1-year horizon) — Wikidata CC0 statements only.
 */

export const MORE_PAGE = 500;
const MAX_MORE_PAGES = 10;
const ENRICH_BATCH = 100;
const MIN_SITELINKS = 5;
const SLICE_YEARS = [3, 6, FAR_FUTURE_YEARS] as const;

export type MoreFamily = {
  id: string;
  label: string;
  prop: "P585" | "P580" | "P619" | "P577" | "P1619";
  /** Root of the `wdt:P31/wdt:P279*` walk; none = any item with the property. */
  root?: string;
  /** Phase 1 queries this root's direct instances: exclude them here. */
  minusDirect?: boolean;
  /** Also read `wdt:P582` as the end date. */
  withEnd?: boolean;
  /** Also read `wdt:P17 → wdt:P297` as ISO regions. */
  withIso?: boolean;
  minPrecision: 9 | 10;
  minSitelinks: number;
  category: Category;
  tags: string[];
  popularity: (sl: number, label: string) => number;
  /** Second pass: images, venue, coordinates, flag. */
  enrich: boolean;
  /** Image chain per brief: P18 → venue P18 → country flag. `none` = posters/key art are non-free. */
  image: "p18" | "p18-venue-flag" | "none";
  jsonld?: boolean;
  description: (label: string, regions: string[]) => string;
};

const countryNames = (regions: string[]): string =>
  regions
    .filter((r) => r !== "GLOBAL")
    .map((r) => COUNTRY_NAMES[r] ?? r)
    .slice(0, 3)
    .join(", ");

const inCountry = (regions: string[]): string => {
  const names = countryNames(regions);
  return names ? ` in ${names}` : "";
};

/** Order matters: the first family that yields a QID wins when a unit sees it twice. */
export const MORE_FAMILIES: MoreFamily[] = [
  {
    id: "elections",
    label: "elections (Q40231 subtree)",
    prop: "P585",
    root: "Q40231",
    minusDirect: true,
    withIso: true,
    minPrecision: 9,
    minSitelinks: MIN_SITELINKS,
    category: "politics",
    tags: ["election"],
    popularity: (sl, label) => 35 + Math.min(30, sl) + (/presidential|general election/i.test(label) ? 10 : 0),
    enrich: true,
    image: "p18-venue-flag",
    description: (_label, regions) => `Election${inCountry(regions)}, as scheduled on Wikidata.`,
  },
  {
    id: "awards",
    label: "award ceremonies (Q4504495 subtree)",
    prop: "P585",
    root: "Q4504495",
    minusDirect: true,
    minPrecision: 9,
    minSitelinks: MIN_SITELINKS,
    category: "entertainment",
    tags: ["awards", "ceremony"],
    popularity: (sl) => 40 + Math.min(30, Math.floor(sl / 2)),
    enrich: true,
    image: "p18-venue-flag",
    description: () => "Award ceremony, as scheduled on Wikidata.",
  },
  {
    id: "expos",
    label: "world's fairs (Q172754 subtree)",
    prop: "P580",
    root: "Q172754",
    withEnd: true,
    withIso: true,
    minPrecision: 9,
    minSitelinks: 3,
    category: "festivals",
    tags: ["expo", "festival"],
    popularity: (sl) => 30 + Math.min(30, sl),
    enrich: true,
    image: "p18-venue-flag",
    jsonld: true,
    description: (_label, regions) => `International exposition${inCountry(regions)}, with dates from Wikidata.`,
  },
  {
    id: "festivals",
    label: "festivals (Q132241 subtree)",
    prop: "P580",
    root: "Q132241",
    minusDirect: true,
    withEnd: true,
    withIso: true,
    minPrecision: 9,
    minSitelinks: 3,
    category: "festivals",
    tags: ["festival"],
    popularity: (sl) => 30 + Math.min(30, sl),
    enrich: true,
    image: "p18-venue-flag",
    jsonld: true,
    description: (_label, regions) => `Festival${inCountry(regions)}, with dates from Wikidata.`,
  },
  {
    id: "launches",
    label: "spacecraft launches (P619)",
    prop: "P619",
    minPrecision: 9,
    minSitelinks: MIN_SITELINKS,
    category: "space",
    tags: ["launch", "mission"],
    popularity: (sl) => 40 + Math.min(30, sl),
    enrich: true,
    image: "p18",
    description: () => "Spacecraft launch, with the target date from Wikidata.",
  },
  {
    id: "films",
    label: "film releases (Q11424 subtree)",
    prop: "P577",
    root: "Q11424",
    minusDirect: true,
    minPrecision: 9,
    minSitelinks: MIN_SITELINKS,
    category: "film",
    tags: ["release", "film"],
    popularity: (sl) => 30 + Math.min(35, sl),
    enrich: false,
    image: "none",
    description: () => "Film release, with the earliest publication date from Wikidata.",
  },
  {
    id: "games",
    label: "video game releases (Q7889 subtree)",
    prop: "P577",
    root: "Q7889",
    minusDirect: true,
    minPrecision: 9,
    minSitelinks: MIN_SITELINKS,
    category: "games",
    tags: ["release", "video-game"],
    popularity: (sl) => 30 + Math.min(35, sl),
    enrich: false,
    image: "none",
    description: () => "Video game release, with the earliest publication date from Wikidata.",
  },
  {
    id: "openings",
    label: "official openings (P1619)",
    prop: "P1619",
    withIso: true,
    minPrecision: 10,
    minSitelinks: MIN_SITELINKS,
    category: "culture",
    tags: ["opening"],
    popularity: () => 30,
    enrich: true,
    image: "p18-venue-flag",
    description: (_label, regions) => `Official opening${inCountry(regions)}, with the date from Wikidata.`,
  },
];

export function familyById(id: string): MoreFamily | undefined {
  return MORE_FAMILIES.find((f) => f.id === id);
}

export type Slice = { from: string; to: string };

/** Slice boundaries for a pass: the UTC day of `now`, then Jan 1 of Y+3, Y+6 and Y+15. */
export function sliceBoundaries(now: Date): string[] {
  const y = now.getUTCFullYear();
  return [`${now.toISOString().slice(0, 10)}T00:00:00Z`, ...SLICE_YEARS.map((n) => `${y + n}-01-01T00:00:00Z`)];
}

export function firstSlice(now: Date): Slice {
  const b = sliceBoundaries(now);
  return { from: b[0], to: b[1] };
}

/** The slice that follows `slice`: starts at its `to`, ends at the next boundary after it; null past the horizon. */
export function nextSlice(slice: Slice, now: Date): Slice | null {
  const to = sliceBoundaries(now).find((b) => b > slice.to);
  return to ? { from: slice.to, to } : null;
}

export function buildMoreQuery(f: MoreFamily, slice: Slice, offset = 0, limit = MORE_PAGE): string {
  const p = f.prop;
  const lines = [
    `  ?item p:${p} ?st . ?st psv:${p} ?v ; wikibase:rank ?rank .`,
    `  ?v wikibase:timeValue ?d ; wikibase:timePrecision ?prec .`,
    `  FILTER(?rank != wikibase:DeprecatedRank)`,
    `  FILTER(?d >= "${slice.from}"^^xsd:dateTime && ?d < "${slice.to}"^^xsd:dateTime && ?prec >= ${f.minPrecision})`,
    `  ?item wikibase:sitelinks ?sl . FILTER(?sl >= ${f.minSitelinks})`,
  ];
  if (f.root) lines.push(`  ?item wdt:P31/wdt:P279* wd:${f.root} .`);
  if (f.root && f.minusDirect) lines.push(`  MINUS { ?item wdt:P31 wd:${f.root} }`);
  lines.push(`  OPTIONAL { ?enwiki schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }`);
  if (f.withEnd) lines.push(`  OPTIONAL { ?item wdt:P582 ?end }`);
  if (f.withIso) lines.push(`  OPTIONAL { ?item wdt:P17 ?c . ?c wdt:P297 ?iso }`);
  lines.push(`  ?item rdfs:label ?itemLabel . FILTER(LANG(?itemLabel) = "en")`);
  const vars = ["?item", "?itemLabel", "?d", "?prec", "?rank", "?sl", "?enwiki", ...(f.withEnd ? ["?end"] : []), ...(f.withIso ? ["?iso"] : [])];
  return `SELECT ${vars.join(" ")} WHERE {\n${lines.join("\n")}\n} ORDER BY ?d ?item LIMIT ${limit} OFFSET ${offset}`;
}

export function buildEnrichQuery(qids: readonly string[]): string {
  return `SELECT ?item ?img ?venue ?venueLabel ?venueImg ?venueCoord ?venueIso ?iso ?flag WHERE {
  VALUES ?item { ${qids.map((q) => `wd:${q}`).join(" ")} }
  OPTIONAL { ?item wdt:P18 ?img }
  OPTIONAL { ?item wdt:P276 ?venue .
    OPTIONAL { ?venue rdfs:label ?venueLabel . FILTER(LANG(?venueLabel) = "en") }
    OPTIONAL { ?venue wdt:P18 ?venueImg }
    OPTIONAL { ?venue wdt:P625 ?venueCoord }
    OPTIONAL { ?venue wdt:P17 ?vc . ?vc wdt:P297 ?venueIso } }
  OPTIONAL { ?item wdt:P17 ?country . OPTIONAL { ?country wdt:P297 ?iso } OPTIONAL { ?country wdt:P41 ?flag } }
}`;
}

export function sparqlUrl(query: string): string {
  return `${WD_ENDPOINT}?query=${encodeURIComponent(query)}`;
}

/** Award-name → category (the brief's Oscars → film, Grammys → music, Emmys → tv rule). */
const AWARD_CATEGORIES: Array<[RegExp, Category]> = [
  [/academy award|oscars?\b|golden globe|bafta film|british academy film|cannes|c[eé]sar award|goya award|film award|screen actors guild|independent spirit|annie award/i, "film"],
  [/grammy|brit awards|mtv (video|europe)|billboard music|american music awards|eurovision|juno award|aria music|latin grammy|country music/i, "music"],
  [/emmy|television award|tv awards|critics'? choice television|golden nymph/i, "tv"],
  [/game awards|bafta games|golden joystick|d\.i\.c\.e\.|dice award/i, "games"],
  [/laureus|ballon d'or|the best fifa|heisman|sports? awards|espy/i, "sports"],
  [/booker|nobel|pulitzer|hugo award|nebula award|goncourt|costa book|women'?s prize/i, "culture"],
  [/tony award|olivier award|drama desk/i, "entertainment"],
];

export function awardCategory(label: string): Category {
  for (const [re, cat] of AWARD_CATEGORIES) if (re.test(label)) return cat;
  return "entertainment";
}

const OFFICE_WORDS =
  /\b(presidential|parliamentary|legislative|general|gubernatorial|mayoral|municipal|local|state|federal|senate|house of representatives|european parliament|by-election|referendum|primary|regional|provincial|assembly)\b/i;

/** The brief's "office keyword" tag for an election label ("presidential", "general" …). */
export function officeTag(label: string): string | null {
  const m = OFFICE_WORDS.exec(label);
  return m ? slugify(m[1]) : null;
}

export function categoryAndTags(f: MoreFamily, label: string): { category: Category; tags: string[] } {
  const rule = classify(label, f.category);
  const tags = [...f.tags, ...rule.tags];
  let category = f.category;
  if (f.id === "awards") category = awardCategory(label);
  if (f.id === "elections") {
    const office = officeTag(label);
    if (office) tags.push(office);
  }
  return { category, tags };
}

type Candidate = {
  qid: string;
  label: string;
  day: string;
  precision: IngestPrecision;
  prec: number;
  preferred: boolean;
  sl: number;
  enwiki?: string;
  ends: string[];
  isos: string[];
  raw: Json;
};

const PREC_ORDER: Record<string, number> = { day: 0, month: 1, year: 2 };

function parseCandidate(b: SparqlBinding, f: MoreFamily): Candidate | null {
  const iri = b.item?.value;
  const label = (b.itemLabel?.value ?? "").trim();
  const raw = b.d?.value;
  const prec = Number(b.prec?.value);
  if (!iri || !label || !raw) return null;
  if (/^Q\d+$/.test(label)) return null;
  const qid = iri.split("/").pop() ?? "";
  if (!/^Q\d+$/.test(qid)) return null;
  const precision = precisionFromWikidata(prec);
  if (!precision || precision === "decade" || prec < f.minPrecision) return null;
  const day = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const sl = Number(b.sl?.value);
  if (!Number.isFinite(sl) || sl < f.minSitelinks) return null;
  const end = b.end?.value;
  const iso = b.iso?.value;
  return {
    qid,
    label,
    day,
    precision,
    prec,
    preferred: (b.rank?.value ?? "").endsWith("PreferredRank"),
    sl,
    enwiki: enwikiTitle(b.enwiki?.value),
    ends: end && /^\d{4}-\d{2}-\d{2}/.test(end) ? [end.slice(0, 10)] : [],
    isos: iso && /^[A-Z]{2}$/.test(iso) ? [iso] : [],
    raw: { d: raw, prec, rank: (b.rank?.value ?? "").split("#").pop() ?? null, sl },
  };
}

/** Preferred rank first, then the finest precision, then the earliest date. */
function better(a: Candidate, b: Candidate): boolean {
  if (a.preferred !== b.preferred) return a.preferred;
  if (a.precision !== b.precision) return PREC_ORDER[a.precision] < PREC_ORDER[b.precision];
  return a.day < b.day;
}

/** One row per QID from a page of bindings (multi-valued P17/P582/dates are merged). */
export function moreBindingsToEvents(bindings: readonly SparqlBinding[], f: MoreFamily, now: Date): IngestEvent[] {
  const byQid = new Map<string, Candidate>();
  for (const b of bindings) {
    const c = parseCandidate(b, f);
    if (!c) continue;
    const prev = byQid.get(c.qid);
    if (!prev) {
      byQid.set(c.qid, c);
      continue;
    }
    const keep = better(c, prev) ? c : prev;
    const other = keep === c ? prev : c;
    keep.ends = [...new Set([...keep.ends, ...other.ends])];
    keep.isos = [...new Set([...keep.isos, ...other.isos])].sort();
    byQid.set(c.qid, keep);
  }
  const rows: IngestEvent[] = [];
  for (const c of byQid.values()) {
    const year = Number(c.day.slice(0, 4));
    if (!labelYearConsistent(c.label, year)) continue;
    if (!isFutureOrFar(c.day, c.precision, now)) continue;
    const { category, tags } = categoryAndTags(f, c.label);
    const allTags = [...tags, "wikidata"];
    if (isFarFuture(c.day, allTags, now)) continue;
    const imprecise = c.precision !== "day";
    const regions = c.isos.length ? c.isos : ["GLOBAL"];
    const endDate = c.ends.filter((e) => e > c.day).sort()[0];
    rows.push(
      buildEvent({
        title: c.label,
        date: c.day,
        endDate,
        category,
        tags: allTags,
        regions,
        description: f.description(c.label, regions),
        source: "wikidata",
        sourceUrl: `https://www.wikidata.org/wiki/${c.qid}`,
        sourceKey: `wikidata:${c.qid}`,
        popularity: f.popularity(c.sl, c.label),
        datePrecision: c.precision,
        status: imprecise ? "tentative" : "scheduled",
        confidence: imprecise ? 0.6 : 0.7,
        externalIds: { qid: c.qid, enwiki: c.enwiki },
        raw: { family: f.id, ...(c.raw as Record<string, Json>) },
      }),
    );
  }
  return rows;
}

const RASTER = /\.(jpe?g|png|webp|gif)$/i;
const RASTER_OR_SVG = /\.(jpe?g|png|webp|gif|svg)$/i;

export type CommonsImage = { url: string; file: string; pageUrl: string };

/** `http://commons.wikimedia.org/wiki/Special:FilePath/<name>` (WDQS form) → https + file name; null for unsupported types. */
export function commonsImage(iri: string | undefined, allowSvg = false): CommonsImage | null {
  if (!iri) return null;
  const m = /^https?:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/(.+)$/.exec(iri);
  if (!m) return null;
  let file: string;
  try {
    file = decodeURIComponent(m[1]).replace(/_/g, " ");
  } catch {
    return null;
  }
  if (!(allowSvg ? RASTER_OR_SVG : RASTER).test(file)) return null;
  const encoded = encodeURIComponent(file).replace(/%20/g, "_");
  return {
    url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}`,
    file,
    pageUrl: `https://commons.wikimedia.org/wiki/File:${encoded}`,
  };
}

export type Enrichment = {
  img?: string;
  venue?: string;
  venueLabel?: string;
  venueImg?: string;
  venueCoord?: string;
  venueIso?: string;
  iso?: string;
  flag?: string;
};

/** Enrichment bindings keyed by QID (first non-empty value per field wins). */
export function indexEnrichment(bindings: readonly SparqlBinding[]): Map<string, Enrichment> {
  const out = new Map<string, Enrichment>();
  for (const b of bindings) {
    const qid = b.item?.value.split("/").pop();
    if (!qid) continue;
    const e = out.get(qid) ?? {};
    for (const k of ["img", "venue", "venueLabel", "venueImg", "venueCoord", "venueIso", "iso", "flag"] as const) {
      const v = b[k]?.value;
      if (v && !e[k]) e[k] = v;
    }
    out.set(qid, e);
  }
  return out;
}

function parsePoint(wkt?: string): { lat: number; lng: number } | null {
  const m = wkt && /Point\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i.exec(wkt);
  if (!m) return null;
  const lng = Number(m[1]);
  const lat = Number(m[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** Apply the second pass to a row in place: image candidate (P18 → venue P18 → flag), location, JSON-LD eligibility. */
export function applyEnrichment(row: IngestEvent, f: MoreFamily, e: Enrichment | undefined): IngestEvent {
  if (!e) return row;
  const venueLabel = e.venueLabel?.trim();
  if (venueLabel && !/^Q\d+$/.test(venueLabel)) {
    const country = e.venueIso ?? e.iso ?? row.regions.find((r) => r !== "GLOBAL");
    const point = parsePoint(e.venueCoord);
    row.location = {
      name: venueLabel,
      ...(country ? { country } : {}),
      ...(point ? { lat: point.lat, lng: point.lng } : {}),
      url: e.venue ? `https://www.wikidata.org/wiki/${e.venue.split("/").pop()}` : undefined,
    };
    if (row.location.url === undefined) delete row.location.url;
    if (f.jsonld && country) row.jsonld_eligible = true;
  }
  if (f.image === "none") return row;
  let kind: "p18" | "venue" | "flag" | null = null;
  let img = commonsImage(e.img);
  if (img) kind = "p18";
  if (!img && f.image === "p18-venue-flag") {
    img = commonsImage(e.venueImg);
    if (img) kind = "venue";
    if (!img) {
      img = commonsImage(e.flag, true);
      if (img) kind = "flag";
    }
  }
  if (img && kind) {
    row.image_candidate_url = img.url;
    row.image_candidate_meta = { provider: "commons", kind, file: img.file, pageUrl: img.pageUrl };
  }
  return row;
}

type SparqlJson = { results?: { bindings?: SparqlBinding[] } };

/** Second pass over up to `ENRICH_BATCH` QIDs per query; a failed batch only logs (images/locations are not in the content hash). */
export async function enrichRows(rows: IngestEvent[], f: MoreFamily, ctx: IngestContext): Promise<void> {
  if (!f.enrich || rows.length === 0) return;
  for (let i = 0; i < rows.length; i += ENRICH_BATCH) {
    const batch = rows.slice(i, i + ENRICH_BATCH);
    const qids = batch.map((r) => String(r.external_ids.qid));
    try {
      const json = await ctx.http.fetchJson<SparqlJson>(sparqlUrl(buildEnrichQuery(qids)), {
        headers: { Accept: "application/sparql-results+json" },
        timeoutMs: 30_000,
      });
      const index = indexEnrichment(json?.results?.bindings ?? []);
      for (const row of batch) applyEnrichment(row, f, index.get(String(row.external_ids.qid)));
    } catch (err) {
      ctx.log.warn(`${f.id}: enrichment batch ${i / ENRICH_BATCH + 1} skipped: ${(err as Error)?.message ?? err}`);
    }
  }
}

/** Phase-2 cursor: family + content-addressed slice + page offset; `done` marks the end of the pass. */
export type MoreCursor = { phase: "more"; family: string; from: string; to: string; offset: number; done?: boolean };

export function isMoreCursor(cursor: Json | null): cursor is MoreCursor {
  if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return false;
  const c = cursor as Record<string, unknown>;
  if (c.phase !== "more") return false;
  if (c.done === true) return true;
  return typeof c.family === "string" && typeof c.from === "string" && typeof c.to === "string" && typeof c.offset === "number" && c.offset >= 0;
}

export function moreStart(now: Date): MoreCursor {
  const s = firstSlice(now);
  return { phase: "more", family: MORE_FAMILIES[0].id, from: s.from, to: s.to, offset: 0 };
}

export const MORE_DONE: MoreCursor = { phase: "more", family: "", from: "", to: "", offset: 0, done: true };

/** Cursor after a unit: next page while pages are full (up to the cap), else next slice, else next family, else done. */
export function moreAfter(c: MoreCursor, last: boolean, now: Date): MoreCursor {
  const nextPage = c.offset + MORE_PAGE;
  if (!last && nextPage < MORE_PAGE * MAX_MORE_PAGES) return { ...c, offset: nextPage };
  const slice = nextSlice({ from: c.from, to: c.to }, now);
  if (slice) return { phase: "more", family: c.family, from: slice.from, to: slice.to, offset: 0 };
  const idx = MORE_FAMILIES.findIndex((f) => f.id === c.family);
  const next = MORE_FAMILIES[idx + 1];
  if (!next) return MORE_DONE;
  const first = firstSlice(now);
  return { phase: "more", family: next.id, from: first.from, to: first.to, offset: 0 };
}

export async function runMore(c: MoreCursor, ctx: IngestContext): Promise<{ rows: IngestEvent[]; bindings: number }> {
  const f = familyById(c.family);
  if (!f) throw new Error(`unknown wikidata family: ${c.family}`);
  const json = await ctx.http.fetchJson<SparqlJson>(sparqlUrl(buildMoreQuery(f, { from: c.from, to: c.to }, c.offset)), {
    headers: { Accept: "application/sparql-results+json" },
  });
  const bindings = json?.results?.bindings ?? [];
  const rows = moreBindingsToEvents(bindings, f, ctx.now);
  await enrichRows(rows, f, ctx);
  return { rows, bindings: bindings.length };
}
