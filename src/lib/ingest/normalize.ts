import { createHash } from "node:crypto";
import { CATEGORIES, type Category } from "@/lib/types";
import type { IngestEvent, IngestPrecision, IngestStatus } from "./types";

/**
 * Pure normalisation helpers, ported from scripts/lib/seed-sources.mjs and
 * scripts/push-catalog.mjs so the cron adapters produce byte-identical slugs,
 * source_keys and content hashes to the rows the push script loaded.
 */

export const FAR_FUTURE_YEARS = 15;
export const TITLE_MIN = 2;
export const TITLE_MAX = 200;

export type TagRule = [RegExp, Category, string[]];

export const TAG_RULES: TagRule[] = [
  [/christmas|navidad|weihnachten|no[eë]l|bo[zż]e|natal|xmas/i, "holidays", ["christmas", "religious"]],
  [/boxing day/i, "holidays", ["christmas"]],
  [/new year|a[nñ]o nuevo|nouvel an|neujahr|ano novo|hogmanay/i, "holidays", ["new-year"]],
  [/easter|pascua|ostern|p[aá]scoa|p[âa]ques|pasqua/i, "holidays", ["easter", "religious"]],
  [
    /good friday|holy (thursday|saturday)|ascension|pentecost|whit|maundy|corpus christi|assumption|immaculate|epiphany|three kings|all saints|all souls/i,
    "holidays",
    ["religious", "christian"],
  ],
  [/ramadan|\beid\b|islamic|mawlid|muharram|prophet/i, "holidays", ["religious", "islamic"]], // \beid\b: the seed's bare "eid" also matched "Perseid"
  [/hanukkah|passover|yom kippur|rosh hash|purim|sukkot|shavuot/i, "holidays", ["religious", "jewish"]],
  // \bholi\b: a bare "holi" also matched the substring in "Holiday" (IE "June Holiday", UK bank holidays).
  [/diwali|\bholi\b|dussehra|navaratri|vesak|buddha|vesakha/i, "holidays", ["religious"]],
  [
    /independence|national day|republic day|liberation|revolution day|constitution|unification|foundation day|statehood/i,
    "holidays",
    ["national"],
  ],
  [/labou?r|workers|may day/i, "holidays", ["labor"]],
  [/thanksgiving/i, "holidays", ["thanksgiving"]],
  [/halloween|d[ií]a de (los )?muertos|day of the dead/i, "culture", ["halloween"]],
  [/memorial|armistice|veterans|remembrance|anzac|victory day|heroes/i, "holidays", ["remembrance"]],
  [/\b(king|queen|sultan|emperor|birthday of|royal)\b/i, "holidays", ["royal"]],
  [/valentine/i, "culture", ["romance"]],
  [/women'?s day/i, "culture", ["social"]],
  [/earth day|environment|ocean/i, "nature", ["earth"]],
  // Sports before the family rule: "Youth Olympics" is a sporting event, not a family day. Tokens
  // are deliberately narrow ("Final Fantasy", "Justice League", "Video Games Day" must not match).
  [
    /olympi|world cup|super bowl|grand slam|grand prix|championship|tournament|marathon|wimbledon|tour de france|asian games|african games|commonwealth games|pan american games|university games|(?:champions|europa|conference|premier) league|\b(?:cup|league) final\b|grand final|\b(?:australian|french|british|us|u\.s\.) open\b|\b(?:stanley|ryder|davis|fed|america's) cup\b/i,
    "sports",
    ["sports"],
  ],
  [/children|youth|family/i, "culture", ["family"]],
  [/eclipse|equinox|solstice|meteor|comet|transit of/i, "astronomy", ["sky"]],
  [/election|inauguration|referendum/i, "politics", ["elections"]],
  [/ces\b|wwdc|google i\/o|re:invent|conference/i, "tech", ["conference"]],
];

export const FEATURED_NAMES =
  /christmas day|new year'?s (day|eve)|halloween|thanksgiving day|independence day|eid al-fitr|diwali|lunar new year|chinese new year/i;

const CATEGORY_SET = new Set<string>(CATEGORIES);

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORY_SET.has(value);
}

export function slugify(input: string): string {
  return String(input)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Short stable digest of a title, for slugs of titles that have no Latin letters. */
export function titleDigest(title: string): string {
  return createHash("sha256").update(String(title).normalize("NFKC").trim()).digest("hex").slice(0, 8);
}

/**
 * Slug base for a title: `slugify(title)`, or — when the title has no Latin letters at all
 * (Arabic, Thai, … holiday names) — `<fallbackPrefix>-<digest>`, deterministic per title so
 * re-ingestion updates the same row and different names on the same day never collide.
 */
export function slugBase(title: string, fallbackPrefix: string): string {
  const base = slugify(title);
  if (base) return base;
  const prefix = slugify(fallbackPrefix) || "event";
  return `${prefix}-${titleDigest(title)}`;
}

export function classify(name: string, fallback: Category = "holidays"): { category: Category; tags: string[] } {
  for (const [re, category, tags] of TAG_RULES) {
    if (re.test(name)) return { category, tags: [...tags] };
  }
  return { category: fallback, tags: [] };
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function isoDate(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function parseInstant(dateStr: string): number {
  if (typeof dateStr !== "string") return NaN;
  return Date.parse(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00Z`);
}

/** Exact instant `now + FAR_FUTURE_YEARS`; rows later than this are dropped unless tagged `far-future`. */
export function farFutureCutoffMs(now: Date = new Date()): number {
  const d = new Date(now.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + FAR_FUTURE_YEARS);
  return d.getTime();
}

export function isFarFuture(date: string, tags: readonly string[], now: Date = new Date()): boolean {
  const t = parseInstant(date);
  if (Number.isNaN(t)) return false;
  return t > farFutureCutoffMs(now) && !tags.includes("far-future");
}

/**
 * Exclusive end (ms) of the period a date covers at a given precision: year precision
 * `2026-01-01` covers all of 2026, month precision `2026-09-01` all of September.
 */
export function precisionEnd(t: number, precision: IngestPrecision): number {
  const d = new Date(t);
  const y = d.getUTCFullYear();
  switch (precision) {
    case "decade":
      return Date.UTC(Math.floor(y / 10) * 10 + 10, 0, 1);
    case "year":
      return Date.UTC(y + 1, 0, 1);
    case "quarter":
      return Date.UTC(y, Math.floor(d.getUTCMonth() / 3) * 3 + 3, 1);
    case "month":
      return Date.UTC(y, d.getUTCMonth() + 1, 1);
    default:
      return t;
  }
}

/** Last calendar day (`YYYY-MM-DD`) covered by `date` at `precision`. */
export function periodEnd(date: string, precision: IngestPrecision): string {
  const t = parseInstant(date);
  if (precision === "instant" || precision === "day") return date.slice(0, 10);
  const end = new Date(precisionEnd(t, precision) - 86_400_000);
  return isoDate(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate());
}

/** Keep anything from yesterday onward, precision-aware (a year placeholder survives until the year ends). */
export function isFutureOrFar(date: string, precision: IngestPrecision = "day", now: Date = new Date()): boolean {
  const t = parseInstant(date);
  if (Number.isNaN(t)) return false;
  return precisionEnd(t, precision) > now.getTime() - 2 * 86_400_000;
}

/** Wikidata `wikibase:timePrecision` → catalog precision (anything coarser than a year is rejected). */
export function precisionFromWikidata(prec: number): IngestPrecision | null {
  switch (prec) {
    case 11:
      return "day";
    case 10:
      return "month";
    case 9:
      return "year";
    case 8:
      return "decade";
    default:
      return null;
  }
}

const PRECISION_RANK: Record<IngestPrecision, number> = { instant: 0, day: 1, month: 2, quarter: 3, year: 4, decade: 5 };

export function isCoarse(precision: IngestPrecision): boolean {
  return PRECISION_RANK[precision] > PRECISION_RANK.day;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Strip tags, `[12]`/`[citation needed]` markers and entities; collapse whitespace; cap at TITLE_MAX. */
export function sanitizeTitle(raw: string): string {
  let s = String(raw ?? "");
  s = s.replace(/<ref[\s\S]*?<\/ref>/gi, " ").replace(/<ref[^>]*\/>/gi, " ");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  s = s.replace(/\[[^\]]{0,40}\]/g, " "); // [1], [a], [citation needed]
  s = s.replace(/[\u200b-\u200d\ufeff]/g, "");
  s = s.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
  if (s.length > TITLE_MAX) s = s.slice(0, TITLE_MAX).replace(/\s+\S*$/, "").trim();
  return s;
}

export function rejectReserved(slug: string): boolean {
  return slug.startsWith("mine-") || slug.startsWith("share-");
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function sortedObject(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(obj)
      .sort()
      .filter((k) => obj[k] !== undefined)
      .map((k) => [k, obj[k]]),
  );
}

export type HashFields = Pick<
  IngestEvent,
  | "title"
  | "description"
  | "date"
  | "end_date"
  | "all_day"
  | "category"
  | "tags"
  | "regions"
  | "source"
  | "source_url"
  | "featured"
  | "popularity"
  | "status"
  | "date_precision"
  | "confidence"
  | "external_ids"
> &
  Partial<Pick<IngestEvent, "series_slug">>;

/**
 * sha256 over the content fields. Field order and JSON shape are identical to
 * scripts/push-catalog.mjs `contentHash` so a re-ingest of an unchanged row is
 * reported `unchanged` instead of `updated`; `series_slug` is appended only when set,
 * which keeps the hashes of series-less rows (holidays, wikidata, wikipedia) compatible.
 */
export function contentHash(row: HashFields): string {
  const stable = {
    title: row.title,
    description: row.description,
    date: row.date,
    end_date: row.end_date,
    all_day: row.all_day,
    category: row.category,
    tags: [...row.tags].sort(),
    regions: [...row.regions].sort(),
    source: row.source,
    source_url: row.source_url,
    featured: row.featured,
    popularity: row.popularity,
    status: row.status,
    date_precision: row.date_precision,
    confidence: row.confidence,
    external_ids: sortedObject(row.external_ids ?? {}),
    ...(row.series_slug ? { series_slug: row.series_slug } : {}),
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export type BuildEventInput = {
  title: string;
  date: string;
  endDate?: string | null;
  category: Category;
  tags?: string[];
  regions?: string[];
  description?: string;
  source: IngestEvent["source"];
  sourceUrl?: string | null;
  /** Defaults to `<source>:<slug>`. */
  sourceKey?: string;
  /**
   * Prefix for the slug base when `slugify(title)` is empty (no Latin letters); defaults to the
   * source id. See `slugBase()`.
   */
  slugFallbackPrefix?: string;
  featured?: boolean;
  popularity?: number;
  allDay?: boolean;
  datePrecision?: IngestPrecision;
  status?: IngestStatus;
  confidence?: number;
  externalIds?: Record<string, unknown>;
  seriesSlug?: string | null;
  location?: Record<string, unknown> | null;
  timezone?: string | null;
  summary?: string | null;
  raw?: unknown;
};

const DEFAULT_CONFIDENCE: Partial<Record<IngestEvent["source"], number>> = {
  curated: 1,
  holidays: 1,
  wikipedia: 0.8,
};

/**
 * Build one normalised `IngestEvent` row (the `makeEvent` + `toRow` port). The slug is
 * `slugify(title)-YYYY-MM-DD` (`slugBase()` supplies a digest base for titles without Latin
 * letters); `content_hash` is computed last over the final values.
 */
export function buildEvent(input: BuildEventInput): IngestEvent {
  const title = sanitizeTitle(input.title);
  const isInstant = input.date.includes("T");
  const allDay = input.allDay !== false && !isInstant;
  const day = input.date.slice(0, 10);
  const date = allDay ? day : input.date;
  const slug = `${slugBase(title, input.slugFallbackPrefix ?? input.source)}-${day}`;
  const precision: IngestPrecision = isInstant ? "instant" : (input.datePrecision ?? "day");
  const status: IngestStatus = input.status ?? (isCoarse(precision) ? "tentative" : "scheduled");
  const rawEnd = input.endDate ? (allDay ? input.endDate.slice(0, 10) : input.endDate) : null;
  const endDate = rawEnd && rawEnd.slice(0, 10) >= day ? rawEnd : null;
  const tags = [...new Set((input.tags ?? []).map((t) => slugify(t)).filter(Boolean))];
  const regions = [...new Set((input.regions ?? []).filter(Boolean))];
  const confidence =
    input.confidence !== undefined
      ? clamp(Number(input.confidence) || 0, 0, 1)
      : input.source === "wikidata"
        ? isCoarse(precision)
          ? 0.6
          : 0.7
        : (DEFAULT_CONFIDENCE[input.source] ?? 0.5);
  const externalIds = sortedObject(input.externalIds ?? {});
  const row: IngestEvent = {
    slug,
    title,
    description: String(input.description ?? "").trim(),
    summary: input.summary ?? null,
    date,
    end_date: endDate,
    all_day: allDay,
    timezone: input.timezone ?? null,
    category: isCategory(input.category) ? input.category : "culture",
    tags,
    regions: regions.length ? regions : ["GLOBAL"],
    source: input.source,
    source_url: input.sourceUrl || null,
    source_key: input.sourceKey ?? `${input.source}:${slug}`,
    external_ids: externalIds,
    status,
    date_precision: precision,
    confidence,
    featured: Boolean(input.featured),
    popularity: clamp(Math.round(Number(input.popularity ?? 20)) || 0, 0, 100),
    series_slug: input.seriesSlug ?? null,
    location: input.location ?? null,
    jsonld_eligible: false,
    image_candidate_url: null,
    image_candidate_meta: null,
    content_hash: "",
    raw: input.raw ?? null,
  };
  row.content_hash = contentHash(row);
  return row;
}

/** Recompute the hash after in-place edits (tag/region merges). */
export function rehash(row: IngestEvent): IngestEvent {
  row.content_hash = contentHash(row);
  return row;
}
