/**
 * `wikipedia_summary` enrichment: resolve an event to an English Wikipedia article, then take the
 * REST `page/summary` **extract** as `events.summary`.
 *
 * Text only. The REST summary payload also carries `thumbnail` / `originalimage`, and those can
 * point at non-free local uploads (`/wikipedia/en/…`) — the image pipeline never reads them and
 * neither does this module.
 *
 * Title resolution, in order, stopping at the first hit (never guessing):
 *   a. `external_ids.enwiki` — already resolved on a previous run or set by the adapter.
 *   b. `external_ids.qid` → `Special:EntityData/<QID>.json` → `sitelinks.enwiki.title`.
 *   c. `source_url` pointing at en.wikipedia.org → the title in the path.
 *   d. a confident search: `list=search&srlimit=1`, accepted only when the result title matches
 *      the event title closely (`similarity >= TITLE_MATCH_MIN`). "Christmas Day" → "Christmas"
 *      scores 0.69 and is rejected — the queue would rather have no summary than a wrong one.
 *
 * Licence: Wikipedia prose is CC BY-SA 4.0. Whenever a summary comes from here the event page has
 * to say so and link the article, so the run persists `external_ids.enwiki` (the article) and
 * `external_ids.summary_source = 'wikipedia'` (the flag the UI reads) next to the text.
 */
import type { EnrichContext } from "./context";

export const REST_SUMMARY_BASE = "https://en.wikipedia.org/api/rest_v1/page/summary/";
export const ACTION_API = "https://en.wikipedia.org/w/api.php";
export const WIKIDATA_ENTITY_DATA = "https://www.wikidata.org/wiki/Special:EntityData/";

/** Descriptions at or above this length are considered good enough to leave alone. */
export const MIN_DESCRIPTION_CHARS = 80;
/** Minimum title similarity for a search hit to be trusted. */
export const TITLE_MATCH_MIN = 0.8;
/** Wikipedia extracts are a couple of sentences; anything longer is trimmed at a sentence break. */
export const MAX_SUMMARY_CHARS = 700;

export const QID_RE = /^Q[1-9][0-9]*$/;

export type TitleSource = "external_ids" | "wikidata" | "source_url" | "search";
export type TitleResolution = { title: string; via: TitleSource };

export type EnrichableEvent = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  summary: string | null;
  source_url: string | null;
  external_ids: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Gates and string helpers (pure — the unit tests drive these directly)
// ---------------------------------------------------------------------------

/**
 * Filler an adapter writes when it has nothing to say. These are all under the 80-char bar
 * anyway; the pattern exists so a longer template ("Scheduled event. Details to follow.") is
 * still treated as empty.
 */
const PLACEHOLDER_RE = /^(?:tbd|tba|n\/a|scheduled event\.?|details? (?:to follow|tbc)\.?|no description(?: available)?\.?)$/i;

export function isPlaceholderDescription(description: string | null | undefined): boolean {
  const d = (description ?? "").trim();
  return d.length === 0 || PLACEHOLDER_RE.test(d);
}

/** The summary gate: only fill in when there is no summary yet and the description is thin. */
export function needsSummary(event: Pick<EnrichableEvent, "description" | "summary">): boolean {
  if ((event.summary ?? "").trim().length > 0) return false;
  const description = (event.description ?? "").trim();
  return isPlaceholderDescription(description) || description.length < MIN_DESCRIPTION_CHARS;
}

export function normalizeForCompare(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

/** Token overlap over the larger of the two token sets. */
function tokenOverlap(a: string, b: string): number {
  const at = new Set(a.split(" ").filter(Boolean));
  const bt = new Set(b.split(" ").filter(Boolean));
  if (at.size === 0 || bt.size === 0) return 0;
  let hit = 0;
  for (const t of at) if (bt.has(t)) hit++;
  return hit / Math.max(at.size, bt.size);
}

/**
 * 0..1 confidence that two titles name the same thing: the better of a normalised Levenshtein
 * ratio and a token-overlap ratio (both over the *larger* side, so "Christmas Day" vs
 * "Christmas" scores 0.69 / 0.5, below the 0.8 bar).
 */
export function titleSimilarity(a: string, b: string): number {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ratio = 1 - levenshtein(na, nb) / Math.max(na.length, nb.length);
  return Math.max(ratio, tokenOverlap(na, nb));
}

/** `https://en.wikipedia.org/wiki/Diwali#Origins` → `Diwali`; anything else → null. */
export function titleFromWikipediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname !== "en.wikipedia.org" && parsed.hostname !== "en.m.wikipedia.org") return null;
  const fromQuery = parsed.searchParams.get("title");
  const raw = fromQuery ?? (parsed.pathname.startsWith("/wiki/") ? parsed.pathname.slice("/wiki/".length) : "");
  if (!raw) return null;
  let title: string;
  try {
    title = decodeURIComponent(raw);
  } catch {
    title = raw;
  }
  title = title.replace(/_/g, " ").trim();
  // Namespaced pages (File:, Category:, Special:) are not article summaries.
  if (!title || /^(?:file|category|special|help|template|talk|portal|wikipedia):/i.test(title)) return null;
  return title;
}

export function readQid(external: Record<string, unknown>): string | null {
  const qid = typeof external.qid === "string" ? external.qid.trim().toUpperCase() : "";
  return QID_RE.test(qid) ? qid : null;
}

export function readEnwiki(external: Record<string, unknown>): string | null {
  const title = typeof external.enwiki === "string" ? external.enwiki.trim() : "";
  return title.length > 0 && title.length <= 255 ? title : null;
}

/** Trim an extract to whole sentences under the cap. */
export function trimExtract(extract: string): string {
  const clean = extract.replace(/\s+/g, " ").trim();
  if (clean.length <= MAX_SUMMARY_CHARS) return clean;
  const cut = clean.slice(0, MAX_SUMMARY_CHARS);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return stop > MAX_SUMMARY_CHARS * 0.5 ? cut.slice(0, stop + 1) : `${cut.trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

type EntityData = { entities?: Record<string, { sitelinks?: Record<string, { title?: string }> }> };
type SearchResponse = { query?: { search?: Array<{ title?: string }> } };
type SummaryResponse = {
  type?: string;
  title?: string;
  titles?: { canonical?: string; normalized?: string };
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
};

export function articleUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

/** enwiki sitelink of a Wikidata item, or null when the item has no English article. */
export async function enwikiFromQid(ctx: EnrichContext, qid: string): Promise<string | null> {
  const data = await ctx.http.fetchJson<EntityData>(`${WIKIDATA_ENTITY_DATA}${encodeURIComponent(qid)}.json`);
  const title = data.entities?.[qid]?.sitelinks?.enwiki?.title;
  return typeof title === "string" && title.trim().length > 0 ? title.trim() : null;
}

/** Top search hit, accepted only when it is a close match for `title`. */
export async function searchTitle(ctx: EnrichContext, title: string): Promise<string | null> {
  const url = `${ACTION_API}?action=query&format=json&formatversion=2&list=search&srlimit=1&srsearch=${encodeURIComponent(title)}`;
  const data = await ctx.http.fetchJson<SearchResponse>(url);
  const hit = data.query?.search?.[0]?.title;
  if (!hit) return null;
  return titleSimilarity(hit, title) >= TITLE_MATCH_MIN ? hit : null;
}

export async function resolveEnwikiTitle(ctx: EnrichContext, event: EnrichableEvent): Promise<TitleResolution | null> {
  const known = readEnwiki(event.external_ids);
  if (known) return { title: known, via: "external_ids" };

  const qid = readQid(event.external_ids);
  if (qid) {
    const title = await enwikiFromQid(ctx, qid);
    if (title) return { title, via: "wikidata" };
  }

  const fromUrl = titleFromWikipediaUrl(event.source_url);
  if (fromUrl) return { title: fromUrl, via: "source_url" };

  const searched = await searchTitle(ctx, event.title);
  if (searched) return { title: searched, via: "search" };
  return null;
}

/** REST `page/summary` — extract text only, disambiguation pages rejected. */
export async function fetchSummary(
  ctx: EnrichContext,
  title: string,
): Promise<{ title: string; extract: string; pageUrl: string } | null> {
  const url = `${REST_SUMMARY_BASE}${encodeURIComponent(title.replace(/ /g, "_"))}`;
  const data = await ctx.http.fetchJson<SummaryResponse>(url, { headers: { Accept: "application/json" } });
  if (data.type && /disambiguation/i.test(data.type)) return null;
  const extract = typeof data.extract === "string" ? trimExtract(data.extract) : "";
  if (extract.length < 40) return null;
  const canonical = data.titles?.canonical ?? data.title ?? title;
  return { title: canonical.replace(/_/g, " "), extract, pageUrl: data.content_urls?.desktop?.page ?? articleUrl(canonical) };
}

// ---------------------------------------------------------------------------
// One job
// ---------------------------------------------------------------------------

export type SummaryOutcome =
  | { status: "done"; slug: string; title: string; via: TitleSource; chars: number; patch: SummaryPatch }
  | { status: "skipped"; slug: string; reason: string; patch?: SummaryPatch };

export type SummaryPatch = { summary?: string; external_ids: Record<string, unknown> };

/**
 * Resolve and (when the gate allows) produce the patch for one event. Pure of database writes so
 * the caller can honour `?dry=1`; `patch` is what the caller applies to `events`.
 */
export async function enrichSummary(ctx: EnrichContext, event: EnrichableEvent): Promise<SummaryOutcome> {
  const resolution = await resolveEnwikiTitle(ctx, event);
  if (!resolution) return { status: "skipped", slug: event.slug, reason: "no confident Wikipedia title" };

  const external = { ...event.external_ids };
  // Remember the resolution even when the summary is not needed: the next run (and the citation
  // on the page) both start from `external_ids.enwiki`.
  const learned = readEnwiki(external) !== resolution.title;
  external.enwiki = resolution.title;

  if (!needsSummary(event)) {
    return {
      status: "skipped",
      slug: event.slug,
      reason: "description already meets the bar",
      patch: learned ? { external_ids: external } : undefined,
    };
  }

  const summary = await fetchSummary(ctx, resolution.title);
  if (!summary) {
    return { status: "skipped", slug: event.slug, reason: "no usable extract", patch: learned ? { external_ids: external } : undefined };
  }
  // The article title the REST endpoint settled on wins (redirects are followed upstream).
  external.enwiki = summary.title;
  external.summary_source = "wikipedia";
  return {
    status: "done",
    slug: event.slug,
    title: summary.title,
    via: resolution.via,
    chars: summary.extract.length,
    patch: { summary: summary.extract, external_ids: external },
  };
}
