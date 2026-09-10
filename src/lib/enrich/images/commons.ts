/**
 * Wikimedia API calls used by the image discovery chain.
 *
 * All of them go out with the shared descriptive User-Agent and the per-host spacing from
 * `src/lib/ingest/http.ts` (an empty UA is a 403 on `api.php` and on the thumb host, and drops an
 * identified client from 200 req/min to 10).
 *
 * Two batching rules from the API docs are respected here: up to 50 titles per `pageimages`
 * query, but at most 10 per `imageinfo` query, because `extmetadata` is expensive.
 */
import type { EnrichContext } from "../context";
import { type CommonsImageInfo, evaluateCommonsFile, type LicensedImage, PREFERRED_THUMB_WIDTH, stripTracking } from "./license";

export const EN_ACTION_API = "https://en.wikipedia.org/w/api.php";
export const COMMONS_ACTION_API = "https://commons.wikimedia.org/w/api.php";

export const PAGEIMAGES_BATCH = 50;
export const IMAGEINFO_BATCH = 10;
/** Requested thumbnail width; the thumb host buckets sizes, so the answer may be wider. */
export const THUMB_WIDTH = PREFERRED_THUMB_WIDTH;

type PageImagesResponse = {
  query?: {
    pages?: Array<{
      title?: string;
      missing?: boolean;
      pageimage?: string;
      original?: { source?: string; width?: number; height?: number };
      thumbnail?: { source?: string; width?: number; height?: number };
    }>;
    normalized?: Array<{ from?: string; to?: string }>;
  };
};

type ImageInfoResponse = {
  query?: {
    pages?: Array<{ title?: string; missing?: boolean; imageinfo?: CommonsImageInfo[] }>;
    normalized?: Array<{ from?: string; to?: string }>;
  };
};

type SearchGeneratorResponse = ImageInfoResponse;

/** `A Happy Ugadi.jpg` / `File:A Happy Ugadi.jpg` → `File:A Happy Ugadi.jpg`. */
export function fileTitle(name: string): string {
  const clean = name.replace(/_/g, " ").trim();
  return /^file:/i.test(clean) ? `File:${clean.slice(clean.indexOf(":") + 1).trim()}` : `File:${clean}`;
}

/** `https://commons.wikimedia.org/wiki/Special:FilePath/Foo.jpg` → `File:Foo.jpg`. */
export function fileTitleFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const path = decodeURIComponent(parsed.pathname);
  const special = /\/wiki\/Special:FilePath\/(.+)$/i.exec(path);
  if (special) return fileTitle(special[1]);
  const filePage = /\/wiki\/File:(.+)$/i.exec(path);
  if (filePage) return fileTitle(filePage[1]);
  // upload.wikimedia.org/wikipedia/commons/6/6b/Name.jpg (thumbnails add /<width>px-Name.jpg)
  const upload = /\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/i.exec(path);
  if (upload) return fileTitle(upload[1]);
  return null;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Follows the `normalized` table so the caller can look results up by the title it asked for. */
function normalizedMap(list: Array<{ from?: string; to?: string }> | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const n of list ?? []) if (n.from && n.to) map.set(n.to, n.from);
  return map;
}

export type PageImage = { title: string; file: string | null; source: string; width?: number; height?: number };

/**
 * Step 1 of the chain: the free lead image of a set of English Wikipedia articles.
 * `pilicense=free` already excludes fair-use leads; the `/wikipedia/commons/` check in the
 * licence gate is what actually keeps local uploads out.
 */
export async function pageImages(ctx: EnrichContext, titles: readonly string[]): Promise<Map<string, PageImage>> {
  const out = new Map<string, PageImage>();
  const unique = [...new Set(titles.map((t) => t.trim()).filter(Boolean))];
  for (const batch of chunk(unique, PAGEIMAGES_BATCH)) {
    if (ctx.budget.remainingMs() < 5_000) break;
    const url =
      `${EN_ACTION_API}?action=query&format=json&formatversion=2&prop=pageimages` +
      `&piprop=original%7Cthumbnail%7Cname&pithumbsize=${THUMB_WIDTH}&pilicense=free&pilimit=${PAGEIMAGES_BATCH}` +
      `&titles=${encodeURIComponent(batch.join("|"))}`;
    const data = await ctx.http.fetchJson<PageImagesResponse>(url);
    const back = normalizedMap(data.query?.normalized);
    for (const page of data.query?.pages ?? []) {
      if (!page.title || page.missing) continue;
      const best = page.original ?? page.thumbnail;
      if (!best?.source) continue;
      const entry: PageImage = {
        title: page.title,
        file: page.pageimage ?? null,
        source: stripTracking(best.source),
        width: best.width,
        height: best.height,
      };
      out.set(page.title, entry);
      const asked = back.get(page.title);
      if (asked) out.set(asked, entry);
    }
  }
  return out;
}

/**
 * Step 4 (mandatory): `imageinfo` + `extmetadata` from **commons.wikimedia.org**. Never from
 * en.wikipedia.org — that endpoint returns fair-use local files with a working URL.
 * Results are memoised on the returned map so a file shared by several events is fetched once.
 */
export async function commonsImageInfo(ctx: EnrichContext, titles: readonly string[]): Promise<Map<string, CommonsImageInfo>> {
  const out = new Map<string, CommonsImageInfo>();
  const unique = [...new Set(titles.map((t) => t.trim()).filter(Boolean))];
  for (const batch of chunk(unique, IMAGEINFO_BATCH)) {
    if (ctx.budget.remainingMs() < 5_000) break;
    const url =
      `${COMMONS_ACTION_API}?action=query&format=json&formatversion=2&prop=imageinfo` +
      `&iiprop=url%7Csize%7Cmime%7Cextmetadata&iiurlwidth=${THUMB_WIDTH}` +
      `&titles=${encodeURIComponent(batch.join("|"))}`;
    const data = await ctx.http.fetchJson<ImageInfoResponse>(url);
    const back = normalizedMap(data.query?.normalized);
    for (const page of data.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      if (!page.title || page.missing || !info) continue;
      out.set(page.title, info);
      const asked = back.get(page.title);
      if (asked) out.set(asked, info);
    }
  }
  return out;
}

/** Small cache in front of `commonsImageInfo` so one file is verified once per run. */
export class CommonsVerifier {
  private readonly cache = new Map<string, CommonsImageInfo | null>();

  constructor(private readonly ctx: EnrichContext) {}

  /** Fetch a batch up front (cheaper than one call per event). */
  async warm(titles: readonly string[]): Promise<void> {
    const missing = titles.map(fileTitle).filter((t) => !this.cache.has(t));
    if (missing.length === 0) return;
    const found = await commonsImageInfo(this.ctx, missing);
    for (const title of missing) this.cache.set(title, found.get(title) ?? null);
  }

  async info(name: string): Promise<CommonsImageInfo | null> {
    const title = fileTitle(name);
    const hit = this.cache.get(title);
    if (hit !== undefined) return hit;
    const found = await commonsImageInfo(this.ctx, [title]);
    const info = found.get(title) ?? null;
    this.cache.set(title, info);
    return info;
  }

  /**
   * Verify one file and apply the licence gate. The per-file `imageinfo` is what is memoised, not
   * the verdict, so a per-event option (`rejectPortraits`) never leaks between events.
   */
  async verify(
    name: string,
    via: string,
    options: { rejectPortraits?: boolean } = {},
  ): Promise<{ ok: true; image: LicensedImage } | { ok: false; reason: string }> {
    const info = await this.info(name);
    return evaluateCommonsFile(info, via, options);
  }
}

const BAD_TITLE_RE = /logo|map\b|poster|scan|manuscript|coat of arms|seal of|diagram|icon/i;
const MIN_SEARCH_WIDTH = 800;
const PREFERRED_SEARCH_WIDTH = 1200;

/**
 * Step 3: Commons keyword search for events with no article at all. `gsrnamespace=6` is
 * mandatory (without it the generator returns nothing). Legality is guaranteed by Commons policy;
 * quality is not, so results are filtered on size, aspect and title before the licence gate runs.
 */
export async function commonsSearch(ctx: EnrichContext, query: string, limit = 5): Promise<Array<{ title: string; info: CommonsImageInfo }>> {
  const url =
    `${COMMONS_ACTION_API}?action=query&format=json&formatversion=2&generator=search&gsrnamespace=6` +
    `&gsrlimit=${limit}&gsrsearch=${encodeURIComponent(`filetype:bitmap ${query}`)}` +
    `&prop=imageinfo&iiprop=url%7Csize%7Cmime%7Cextmetadata&iiurlwidth=${THUMB_WIDTH}`;
  const data = await ctx.http.fetchJson<SearchGeneratorResponse>(url);
  const tokens = new Set(
    query
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2),
  );
  const rows: Array<{ title: string; info: CommonsImageInfo; score: number }> = [];
  for (const page of data.query?.pages ?? []) {
    const info = page.imageinfo?.[0];
    if (!page.title || !info) continue;
    if (BAD_TITLE_RE.test(page.title)) continue;
    const w = info.width ?? 0;
    const h = info.height ?? 0;
    if (w < MIN_SEARCH_WIDTH || h <= 0) continue;
    const aspect = w / h;
    if (aspect < 0.5 || aspect > 2.5) continue;
    let score = w >= PREFERRED_SEARCH_WIDTH ? 1 : 0;
    const titleTokens = page.title.toLowerCase();
    for (const t of tokens) if (titleTokens.includes(t)) score += 1;
    // "prefer results whose title contains >= 2 query tokens" (brief §21 step 3)
    if (score < 2) continue;
    rows.push({ title: page.title, info, score });
  }
  rows.sort((a, b) => b.score - a.score || (b.info.width ?? 0) - (a.info.width ?? 0));
  return rows.map(({ title, info }) => ({ title, info }));
}
