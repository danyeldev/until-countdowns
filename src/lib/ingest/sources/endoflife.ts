import { buildEvent, isFarFuture, isFutureOrFar, sanitizeTitle } from "../normalize";
import type { Adapter, IngestContext, IngestEvent, IngestLogger, IngestPrecision, Json, Plan, Unit } from "../types";

/**
 * Software lifecycle milestones from endoflife.date (https://endoflife.date/docs/api/v1/),
 * `GET /api/v1/products/full/`: every product with every release cycle in one payload
 * (verified 2026-09-09: 473 products, 8,609 releases, 2.8 MB gzip-served, `schema_version 1.2.1`,
 * no auth, ETag + `must-revalidate`). One request per pass; the body is parsed once per invocation
 * and split into resumable units of `UNIT_SIZE` rows.
 *
 * One row per (product, release, milestone) with a future date, milestone ∈
 *   eol          `eolFrom`          "end of life"
 *   eoas         `eoasFrom`         "end of active support"
 *   eoes         `eoesFrom`         "end of extended support" (Windows ESU, Ubuntu ESM, …)
 *   lts          `ltsFrom`          "LTS begins"
 *   discontinued `discontinuedFrom` "discontinued" (devices)
 *   release      `releaseDate`      "release" (only when still in the future)
 * Skipped: milestones already flagged (`isEol` …) or dated before yesterday (`release` rows:
 * before today — a cycle that shipped yesterday is not "scheduled for release"), dates beyond
 * `now + 15 y`, a milestone dated on the release day itself (data quirks, "LTS from day one"),
 * an eoas/eoes dated on the eol day (the eol row alone carries it), `release` rows whose label
 * names another year (label-year check; version years such as "Windows Server 2025" are exempt
 * for the other milestones — ≈ 100 rows — because the milestone is by definition later than the
 * version year). Capped at `MAX_ROWS` (highest popularity, then earliest date). All rows: `category = 'tech'`, all-day, `date_precision = 'day'` (`month` for a
 * `YYYY-MM` value — none seen on the live payload), `status = 'scheduled'`, `regions = ['GLOBAL']`.
 *
 * Licence: the data is MIT ("Copyright 2020 endoflife.date contributors";
 * `sources.attribution = "Release lifecycle data from endoflife.date (MIT)"`). Product descriptions
 * on the site are adapted from Wikipedia (CC BY-SA) and are never copied: `description` is our own
 * wording built from the dates. `links.icon` (Simple Icons, CC0 SVG on jsDelivr) is kept in `raw`
 * for inline UI use only — a trademarked logo is not an `image_candidate_url`.
 *
 * Cursor: `{ fetchedOn, afterKey }` — the `source_key` of the last row upserted (rows are
 * key-sorted), never an index: a pass resumed on a later day sees a different set and must not
 * skip rows. A same-day re-run always fetches again (an empty completed pass would let
 * `mark_stale_records` flag every row as unseen).
 *
 * API is Beta: follow redirects (product slugs get renamed), tolerate unknown fields and enum
 * values, assert `schema_version` starts with `1.` and log when it is not `1.2.1`. A body that
 * parses but carries fewer than `MIN_PRODUCTS` products (empty or truncated `result`) is an
 * error, not a clean pass: an empty pass marked "ok" would let `mark_stale_records` flip every
 * row to tentative. The polite
 * mode (`If-None-Match` → 304) needs response-header access that `ctx.http` does not expose yet.
 * Resellers (`oanor.com` and similar) are not the official endpoint. Rejected alternatives for
 * this niche: none — endoflife.date is the canonical open dataset.
 */

export const EOL_ENDPOINT = "https://endoflife.date/api/v1/products/full/";
export const EXPECTED_SCHEMA = "1.2.1";
export const MAX_ROWS = 2000;
export const UNIT_SIZE = 400;
/** Floor on a plausible payload (473 products verified 2026-09-09); fewer → throw, never an empty "ok" pass. */
export const MIN_PRODUCTS = 200;
const CONFIDENCE = 0.9;
const BASE_POPULARITY = 25;
const MARQUEE_POPULARITY = 40;
const EOL_BONUS = 5;
const CAP_MARQUEE = 45;
const CAP_LONG_TAIL = 35;

/** Products whose milestones are widely awaited (the brief's list; `java` and `sql-server` mapped to their real slugs). */
export const MARQUEE_PRODUCTS = new Set([
  "windows",
  "windows-server",
  "ubuntu",
  "debian",
  "rhel",
  "macos",
  "ios",
  "android",
  "python",
  "nodejs",
  "java",
  "oracle-jdk",
  "openjdk-builds-from-oracle",
  "php",
  "go",
  "ruby",
  "rails",
  "django",
  "react",
  "angular",
  "kubernetes",
  "postgresql",
  "mysql",
  "dotnet",
  "sql-server",
  "mssqlserver",
  "office",
]);

export type Milestone = "eol" | "eoas" | "eoes" | "lts" | "discontinued" | "release";

export type EolRelease = {
  name: string;
  label?: string | null;
  codename?: string | null;
  releaseDate?: string | null;
  isLts?: boolean | null;
  ltsFrom?: string | null;
  isEoas?: boolean | null;
  eoasFrom?: string | null;
  isEol?: boolean | null;
  eolFrom?: string | null;
  isEoes?: boolean | null;
  eoesFrom?: string | null;
  isDiscontinued?: boolean | null;
  discontinuedFrom?: string | null;
  isMaintained?: boolean | null;
  latest?: { name?: string | null; date?: string | null; link?: string | null } | null;
  custom?: unknown;
};

export type EolProduct = {
  name: string;
  label?: string | null;
  category?: string | null;
  tags?: string[] | null;
  aliases?: string[] | null;
  /** Per-product display names of the support phases ("Security Support", "Extended Security Updates" …). */
  labels?: Partial<Record<"eoas" | "eol" | "eoes" | "discontinued", string | null>> | null;
  links?: { html?: string | null; icon?: string | null; releasePolicy?: string | null } | null;
  releases?: EolRelease[] | null;
};

export type EolPayload = { schema_version?: unknown; total?: unknown; result?: unknown };

export type EolUnit = Unit & { day: string; afterKey: string | null; toKey: string };
export type Cursor = { fetchedOn: string; afterKey: string | null };

type MilestoneSpec = { id: Milestone; field: keyof EolRelease; flag: keyof EolRelease | null; title: string };

export const MILESTONES: readonly MilestoneSpec[] = [
  { id: "eol", field: "eolFrom", flag: "isEol", title: "end of life" },
  { id: "eoas", field: "eoasFrom", flag: "isEoas", title: "end of active support" },
  { id: "eoes", field: "eoesFrom", flag: "isEoes", title: "end of extended support" },
  { id: "lts", field: "ltsFrom", flag: null, title: "LTS begins" },
  { id: "discontinued", field: "discontinuedFrom", flag: "isDiscontinued", title: "discontinued" },
  { id: "release", field: "releaseDate", flag: null, title: "release" },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function fmtMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** `YYYY-MM-DD` → day precision; `YYYY-MM` → first of the month at month precision; anything else → null. */
export function normalizeDate(value: unknown): { date: string; precision: IngestPrecision } | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Number.isNaN(Date.parse(`${s}T00:00:00Z`)) ? null : { date: s, precision: "day" };
  if (/^\d{4}-\d{2}$/.test(s)) return Number.isNaN(Date.parse(`${s}-01T00:00:00Z`)) ? null : { date: `${s}-01`, precision: "month" };
  return null;
}

/** A day (`YYYY-MM-DD`) from any lifecycle value, for descriptions; null when absent or not a date. */
function dayOf(value: unknown): string | null {
  return normalizeDate(value)?.date ?? null;
}

/**
 * "{product.label} {release.label}" with the overlap removed: "Microsoft Windows Server" +
 * "Windows Server 2025 (LTSC)" → "Microsoft Windows Server 2025 (LTSC)"; "Apple macOS" +
 * "macOS 26 (Tahoe)" → "Apple macOS 26 (Tahoe)". Falls back to `name` fields.
 *
 * A lone '+' in the release label ("Galaxy Tab A9+", "Razr+ 2024", "Compute Module 3+") is spelt
 * out as " Plus": `slugify()` drops '+', so the variant and its base model ("Galaxy Tab A9") would
 * otherwise share a slug and one of the two would be merged away at upsert. Only the release label
 * is rewritten (the product label "Notepad++" stays), and '++' is left alone.
 */
export function productTitle(product: EolProduct, release: EolRelease): string {
  const p = sanitizeTitle(typeof product.label === "string" && product.label.trim() ? product.label : product.name);
  const r = sanitizeTitle(typeof release.label === "string" && release.label.trim() ? release.label : release.name).replace(
    /(?<![+\s])\+(?![+\w])/g,
    " Plus",
  );
  if (!r) return p;
  if (!p) return r;
  const pw = p.split(" ");
  const rw = r.split(" ");
  const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]+/g, "");
  for (let k = Math.min(pw.length, rw.length); k > 0; k--) {
    const tail = pw.slice(-k).map(norm).join(" ");
    const head = rw.slice(0, k).map(norm).join(" ");
    if (tail && tail === head) return [...pw, ...rw.slice(k)].join(" ");
  }
  return `${p} ${r}`;
}

export function titleFor(product: EolProduct, release: EolRelease, milestone: Milestone): string {
  const spec = MILESTONES.find((m) => m.id === milestone)!;
  let base = productTitle(product, release);
  // "Node.js 26 (Upcoming LTS) LTS begins" → "Node.js 26 LTS begins", "RHEL 10 (Upcoming ELS) LTS begins" →
  // "RHEL 10 LTS begins": the milestone already says it.
  if (milestone === "lts") base = base.replace(/\s*\([^)]*\b(LTS|ELS|ESM)\b[^)]*\)\s*$/i, "").trim();
  return `${base} ${spec.title}`;
}

function lower(label: unknown): string | null {
  return typeof label === "string" && label.trim() ? label.trim().toLowerCase() : null;
}

/** Own wording (never the site's CC BY-SA product description): what happens, when, and the surrounding dates. */
export function describe(product: EolProduct, release: EolRelease, milestone: Milestone, date: string, precision: IngestPrecision, now: Date): string {
  const name = productTitle(product, release);
  const when = precision === "month" ? fmtMonth(date) : fmtDay(date);
  const today = now.toISOString().slice(0, 10);
  const releaseDay = dayOf(release.releaseDate);
  const eol = dayOf(release.eolFrom);
  const eoas = dayOf(release.eoasFrom);
  const labels = product.labels ?? {};
  const released = releaseDay ? ` It was released on ${fmtDay(releaseDay)}.` : "";
  const tense = (d: string) => (d < today ? "ended" : "ends");
  switch (milestone) {
    case "eol": {
      // Fixed wording: `labels.eol` is free text ("Supported", "End of Support", "Service Status" …)
      // and cannot be dropped into a sentence verbatim.
      const support = eoas && eoas !== date ? ` Active support ${tense(eoas)} on ${fmtDay(eoas)}.` : "";
      return `${name} reaches end of life on ${when}: upstream support ends and no further security fixes are expected.${released}${support}`;
    }
    case "eoas": {
      const until = eol && eol > date ? ` until its end of life on ${fmtDay(eol)}` : "";
      return `${name} leaves active support on ${when}. After that date only security fixes are expected${until}.${released}`;
    }
    case "eoes": {
      const phase = lower(labels.eoes) ?? "extended support";
      const regular = eol && eol < date ? ` Its regular end of life was ${fmtDay(eol)}; the ${phase} programme covers it until this date.` : "";
      return `${name} reaches the end of ${phase} on ${when}: no further updates are expected after that.${regular}${released}`;
    }
    case "lts": {
      const until = eol && eol > date ? ` Support is planned until ${fmtDay(eol)}.` : "";
      return `${name} enters long-term support on ${when}, the point from which it receives extended maintenance instead of feature work.${released}${until}`;
    }
    case "discontinued": {
      const until = eol && eol > date ? ` Software support continues until ${fmtDay(eol)}.` : "";
      return `${name} is discontinued on ${when}: it is no longer produced or sold from that date.${until}${released}`;
    }
    case "release": {
      const codename = typeof release.codename === "string" ? release.codename.trim() : "";
      // Skip codenames that merely repeat the version label or are a bare year ("2026").
      const code = codename && codename !== (release.label ?? release.name) && codename !== release.name && !/^\d{4}$/.test(codename) ? ` (codename ${codename})` : "";
      const until = eol && eol > date ? ` Support is planned until ${fmtDay(eol)}.` : "";
      const lts = release.isLts ? " It is a long-term support release." : "";
      return `${name}${code} is scheduled for release on ${when}.${lts}${until}`;
    }
  }
}

export function popularityFor(productName: string, milestone: Milestone): number {
  const marquee = MARQUEE_PRODUCTS.has(productName);
  const base = (marquee ? MARQUEE_POPULARITY : BASE_POPULARITY) + (milestone === "eol" ? EOL_BONUS : 0);
  return Math.min(marquee ? CAP_MARQUEE : CAP_LONG_TAIL, base);
}

/** Drop `release` rows whose label names a year other than the release year ("Office 2027 release" dated 2028). */
function labelYearConsistent(title: string, year: number): boolean {
  const years = title.match(/\b(19|20|21)\d{2}\b/g) ?? [];
  return years.every((y) => Number(y) === year);
}

export type Reject = "flagged" | "bad-date" | "past" | "far-future" | "on-release-day" | "same-as-eol" | "label-year" | "empty-title";

/** One (release, milestone) → row, `null` when the milestone is absent, or a rejection reason. */
export function milestoneToEvent(
  product: EolProduct,
  release: EolRelease,
  spec: MilestoneSpec,
  now: Date,
): { event: IngestEvent } | { reject: Reject } | null {
  const value = release[spec.field];
  if (value === null || value === undefined || value === false) return null;
  const parsed = normalizeDate(value);
  if (!parsed) return { reject: "bad-date" };
  const { date, precision } = parsed;
  if (spec.flag && release[spec.flag] === true) return { reject: "flagged" };
  if (!isFutureOrFar(date, precision, now)) return { reject: "past" };
  // `release` rows are "scheduled for release": a cycle that already shipped (even yesterday) is not.
  if (spec.id === "release" && date < now.toISOString().slice(0, 10)) return { reject: "past" };
  const releaseDay = dayOf(release.releaseDate);
  if (spec.id !== "release" && releaseDay && releaseDay === date) return { reject: "on-release-day" };
  // An eoas/eoes dated on the eol day is the same countdown twice, and "only security fixes after
  // that date" would be false: the eol row alone carries it.
  const eolDay = dayOf(release.eolFrom);
  if ((spec.id === "eoas" || spec.id === "eoes") && eolDay && eolDay === date) return { reject: "same-as-eol" };
  const title = titleFor(product, release, spec.id);
  if (title.trim().length < 2) return { reject: "empty-title" };
  if (spec.id === "release" && !labelYearConsistent(title, Number(date.slice(0, 4)))) return { reject: "label-year" };
  const tags = [
    "endoflife",
    spec.id,
    product.name,
    ...(typeof product.category === "string" ? [product.category] : []),
    ...(Array.isArray(product.tags) ? product.tags.filter((t): t is string => typeof t === "string") : []),
    ...(release.isLts ? ["lts"] : []),
  ];
  if (isFarFuture(date, tags, now)) return { reject: "far-future" };
  const html = product.links?.html;
  const sourceUrl = typeof html === "string" && /^https?:\/\//.test(html) ? html : `https://endoflife.date/${encodeURIComponent(product.name)}`;
  const event = buildEvent({
    title,
    date,
    category: "tech",
    tags,
    regions: ["GLOBAL"],
    description: describe(product, release, spec.id, date, precision, now),
    source: "endoflife",
    sourceUrl,
    sourceKey: `endoflife:${product.name}:${release.name}:${spec.id}`,
    featured: false,
    popularity: popularityFor(product.name, spec.id),
    allDay: true,
    timezone: null,
    datePrecision: precision,
    status: precision === "day" ? "scheduled" : "tentative",
    confidence: CONFIDENCE,
    externalIds: { endoflife: product.name },
    seriesSlug: null,
    location: null,
    raw: { product: product.name, release: release.name, icon: product.links?.icon ?? null },
  });
  return { event };
}

function isProduct(p: unknown): p is EolProduct {
  return Boolean(p) && typeof (p as EolProduct).name === "string" && (p as EolProduct).name.trim().length > 0;
}

/** Throws when the payload is not a v1 body; logs when the minor/patch version drifted from the verified one. */
export function assertSchema(payload: EolPayload, log?: IngestLogger): EolProduct[] {
  const version = payload?.schema_version;
  if (typeof version !== "string" || !version.startsWith("1.")) {
    throw new Error(`endoflife: unsupported schema_version ${JSON.stringify(version)} (expected 1.x)`);
  }
  if (version !== EXPECTED_SCHEMA) log?.warn(`endoflife: schema_version ${version} (verified against ${EXPECTED_SCHEMA})`);
  if (!Array.isArray(payload.result)) throw new Error("endoflife: payload.result is not an array");
  const products = payload.result.filter(isProduct);
  if (products.length < MIN_PRODUCTS) {
    throw new Error(`endoflife: only ${products.length} products (expected ≥ ${MIN_PRODUCTS}, verified 473)`);
  }
  if (typeof payload.total === "number" && payload.total !== payload.result.length) {
    log?.warn(`endoflife: payload.total=${payload.total} but result has ${payload.result.length} entries`);
  }
  return products;
}

/**
 * Rows for one payload: every future milestone of every release, deduped by `source_key`, capped
 * at `MAX_ROWS` (highest popularity, then earliest date, then key), returned **sorted by
 * `source_key`** so units can be cut by key.
 */
export function payloadToEvents(payload: EolPayload, now: Date, log?: IngestLogger): IngestEvent[] {
  const products = assertSchema(payload, log);
  const rejects: Partial<Record<Reject, number>> = {};
  const byKey = new Map<string, IngestEvent>();
  let releases = 0;
  for (const product of products) {
    for (const release of product.releases ?? []) {
      if (!release || typeof release.name !== "string" || !release.name.trim()) continue;
      releases++;
      for (const spec of MILESTONES) {
        const r = milestoneToEvent(product, release, spec, now);
        if (!r) continue;
        if ("reject" in r) {
          rejects[r.reject] = (rejects[r.reject] ?? 0) + 1;
          continue;
        }
        if (!byKey.has(r.event.source_key)) byKey.set(r.event.source_key, r.event);
      }
    }
  }
  const ranked = [...byKey.values()].sort(
    (a, b) => b.popularity - a.popularity || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || (a.source_key < b.source_key ? -1 : 1),
  );
  const rows = ranked.slice(0, MAX_ROWS).sort((a, b) => (a.source_key < b.source_key ? -1 : a.source_key > b.source_key ? 1 : 0));
  log?.info(
    `endoflife: ${products.length} products, ${releases} releases → ${byKey.size} future milestones` +
      (byKey.size > MAX_ROWS ? `, capped at ${MAX_ROWS}` : "") +
      ` · rejected ${Object.entries(rejects)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ")}`,
  );
  return rows;
}

export function parseCursor(cursor: Json | null): Cursor | null {
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    const c = cursor as { fetchedOn?: unknown; afterKey?: unknown };
    if (typeof c.fetchedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.fetchedOn)) {
      return { fetchedOn: c.fetchedOn, afterKey: typeof c.afterKey === "string" && c.afterKey ? c.afterKey : null };
    }
  }
  return null;
}

/** Index of the first row whose key sorts after `afterKey` (rows are key-sorted); 0 for a fresh pass. */
export function resumeIndex(rows: readonly { source_key: string }[], afterKey: string | null): number {
  if (!afterKey) return 0;
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (rows[mid].source_key <= afterKey) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Split key-sorted rows into units of `size` starting after `afterKey`; each unit names its key range. */
export function planUnits(rows: readonly IngestEvent[], day: string, afterKey: string | null, size = UNIT_SIZE): EolUnit[] {
  const units: EolUnit[] = [];
  for (let start = resumeIndex(rows, afterKey); start < rows.length; start += size) {
    const end = Math.min(rows.length, start + size);
    const from = start === 0 ? null : rows[start - 1].source_key;
    const toKey = rows[end - 1].source_key;
    units.push({
      key: `endoflife:${day}:${rows[start].source_key}`,
      label: `rows ${start}–${end - 1} of ${rows.length}`,
      after: { fetchedOn: day, afterKey: toKey },
      day,
      afterKey: from,
      toKey,
    });
  }
  return units;
}

/** Rows of one unit: `afterKey < source_key <= toKey`, independent of the array the plan was cut from. */
export function sliceUnit(rows: readonly IngestEvent[], unit: EolUnit): IngestEvent[] {
  const start = resumeIndex(rows, unit.afterKey);
  const out: IngestEvent[] = [];
  for (let i = start; i < rows.length && rows[i].source_key <= unit.toKey; i++) out.push(rows[i]);
  return out;
}

let cache: { key: string; rows: IngestEvent[] } | null = null;

/** One fetch per invocation and UTC day: plan() and every run() of the same pass share the parsed rows. */
async function rowsFor(ctx: IngestContext): Promise<IngestEvent[]> {
  const key = ctx.now.toISOString().slice(0, 10);
  if (cache && cache.key === key) return cache.rows;
  const payload = await ctx.http.fetchJson<EolPayload>(EOL_ENDPOINT, { headers: { Accept: "application/json" } });
  const rows = payloadToEvents(payload, ctx.now, ctx.log);
  cache = { key, rows };
  return rows;
}

/** Exported for tests: forget the parsed payload. */
export function resetCache(): void {
  cache = null;
}

export const adapter: Adapter<EolUnit> = {
  id: "endoflife",
  label: "endoflife.date lifecycle milestones",
  rank: 5,
  cadence: "daily",
  isConfigured: () => true,
  limits: { concurrency: 1, minIntervalMs: 1000, timeoutMs: 60_000, maxRetries: 2 },

  async plan(cursor, ctx): Promise<Plan<EolUnit>> {
    const day = ctx.now.toISOString().slice(0, 10);
    const rows = await rowsFor(ctx);
    const afterKey = parseCursor(cursor)?.afterKey ?? null;
    return { units: planUnits(rows, day, afterKey), done: true };
  },

  async run(unit, ctx) {
    const rows = sliceUnit(await rowsFor(ctx), unit);
    ctx.log.info(`${unit.label}: ${rows.length} rows`);
    return rows;
  },
};
