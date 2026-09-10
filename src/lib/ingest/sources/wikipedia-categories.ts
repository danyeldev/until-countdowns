import type { Category } from "@/lib/types";
import { COUNTRY_NAMES } from "@/lib/regions";
import { buildEvent, classify, FEATURED_NAMES, isFarFuture, isFutureOrFar, sanitizeTitle, slugify } from "../normalize";
import type { Adapter, IngestContext, IngestEvent, IngestPrecision, Json, Plan, Unit } from "../types";
import { countryCode, G20 } from "./wikipedia-categories/countries";
import { electionKind, electionTitle, parseElectoralCalendar, type ElectoralEntry } from "./wikipedia-categories/electoral";
import {
  coordinates,
  enLabel,
  eventDates,
  itemIds,
  stringValues,
  type WdClaimsResponse,
  type WdEntitiesResponse,
  type WdEntity,
} from "./wikipedia-categories/wikidata";

/**
 * English Wikipedia scheduled-event categories (sports, multi-sport, esports) and the
 * "YYYY national electoral calendar" pages, via the MediaWiki Action API.
 *
 * Category membership is only a seed: every member page is resolved to its Wikidata item
 * (`pageprops.wikibase_item`) and dated from precision-guarded P580 (start) / P585 (point in
 * time) with P582 as end; members without a usable claim are dropped rather than guessed.
 * Elections come from the calendar wikitext (day-precision entries only); a "Next X election" link
 * target redirects to the PREVIOUS election's article, so those rows link the calendar page and
 * carry no `enwiki` id. `jsonld_eligible` needs a real P276 venue that is not the host country and
 * a day-precision date — a year-precision placeholder has no bookable date to publish.
 *
 * Licence: Wikipedia text is CC BY-SA 4.0 — only titles, dates and links are taken (facts), the
 * descriptions here are our own sentences and every row links its article
 * (`sources.attribution` = "Event titles and dates from Wikipedia (CC BY-SA 4.0)"). Wikidata
 * statements are CC0. Lead images are proposed only when they live on Commons
 * (`/wikipedia/commons/`); `/wikipedia/en/` uploads are fair-use logos and are never re-hosted.
 * Rejected alternatives: TheSportsDB free tier (personal use only), fixturedownload.com (no
 * storage), IFES ElectionGuide (bot-blocked, no open licence), Sportradar/Stats Perform
 * (enterprise redistribution terms). ESPN site.api WAS rejected here for its ToU and now supplies
 * MMA start times (`espn.ts`), which is why UFC cards this adapter dates to the day alone come
 * back with an hour: rank 6 beats this source's 3 on the merge.
 *
 * Network: Wikimedia asks for a descriptive User-Agent and serial requests (200 req/min with a
 * UA, 10/min without, 429 + Retry-After); `limits` keep one request every 400 ms.
 *
 * Units: one per category (roots + the one-level subcategories of
 * Category:Scheduled sports events, discovered at plan time) then one per electoral-calendar
 * year. The cursor is content-addressed: `{ phase: "cat", after: "<category title>" }` resumes
 * after that category in title order, `{ phase: "electoral", after: <year> }` after that year.
 */

export const WP_API = "https://en.wikipedia.org/w/api.php";
export const WD_API = "https://www.wikidata.org/w/api.php";
export const SOURCE = "wikipedia-categories" as const;

export const ROOT_CATEGORIES = [
  "Category:Scheduled multi-sport events",
  "Category:Scheduled sports events",
  "Category:Scheduled esports events",
] as const;
const SUBCAT_PARENT = "Category:Scheduled sports events";
const ELECTORAL_YEARS = 3; // this year .. +2
const BATCH = 50; // titles/pageids per query call, ids per wbgetentities call
const MAX_CATEGORY_PAGES = 4; // × cmlimit 500

/** Index/list pages that sit in the categories but are not events. */
export const INDEX_TITLE_RE =
  /^(?:bids? for\b|list of\b|\d{4}(?:[–-]\d{2,4})?\s+in\b|international cricket in\b|.+\bin \d{4}(?:[–-]\d{2,4})?$|template:|portal:|category:|draft:)/i;
/** Marquee names: popularity 85 + featured (Youth Games and bid pages are excluded). */
const MARQUEE_RE = /\b(?:summer|winter)\s+(?:olympics|paralympics)\b|\bfifa world cup\b|\brugby world cup\b|\bcricket world cup\b|\bsuper bowl\b/i;
/** Qualifiers, play-offs, youth editions and bid pages are never marquee even when the name matches. */
const NOT_MARQUEE_RE = /youth|qualif|play-?off|bids? for|squads?|\bdraw\b/i;
/** Country names that take a definite article in prose ("in the United States"). */
const ARTICLE_RE = /^(?:united|netherlands|philippines|gambia|bahamas|maldives|czech|dominican|central african|democratic republic|republic of|kingdom of|isle of|marshall|solomon|comoros|seychelles|cayman|faroe|cook islands|ivory coast)/i;

export function withArticle(country: string): string {
  return ARTICLE_RE.test(country) && !/^the\s/i.test(country) ? `the ${country}` : country;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type CatUnit = Unit & { kind: "cat"; category: string };
type ElectoralUnit = Unit & { kind: "electoral"; year: number };
export type WcUnit = CatUnit | ElectoralUnit;
type Cursor = { phase: "cat"; after: string } | { phase: "electoral"; after: number };

type CategoryMember = { pageid: number; ns: number; title: string };
type CategoryMembersResponse = {
  batchcomplete?: boolean;
  continue?: { cmcontinue?: string };
  query?: { categorymembers?: CategoryMember[] };
  error?: { code?: string; info?: string };
};
type PagePropsPage = {
  pageid?: number;
  ns?: number;
  title: string;
  missing?: boolean;
  pageprops?: { wikibase_item?: string };
  original?: { source?: string; width?: number; height?: number };
  pageimage?: string;
};
type PagePropsResponse = {
  query?: { pages?: PagePropsPage[]; redirects?: Array<{ from: string; to: string }> };
  error?: { code?: string; info?: string };
};
type ParseResponse = { parse?: { title?: string; pageid?: number; wikitext?: string }; error?: { code?: string; info?: string } };

export function parseCursor(cursor: Json | null): Cursor | null {
  if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return null;
  const c = cursor as { phase?: unknown; after?: unknown };
  if (c.phase === "cat" && typeof c.after === "string") return { phase: "cat", after: c.after };
  if (c.phase === "electoral" && typeof c.after === "number") return { phase: "electoral", after: c.after };
  return null;
}

export function electoralYears(now: Date): number[] {
  const y = now.getUTCFullYear();
  return Array.from({ length: ELECTORAL_YEARS }, (_, i) => y + i);
}

/** Category title → catalog category and sport tag ("Category:Scheduled ice hockey competitions" → ice-hockey). */
export function categoryMeta(catTitle: string): { category: Category; tag: string | null } {
  const name = catTitle.replace(/^Category:/i, "").trim();
  const category: Category = /esports/i.test(name) ? "esports" : "sports";
  const m = /^Scheduled\s+(.+?)\s+(?:events|competitions|seasons|tournaments|championships|drafts)$/i.exec(name);
  const tag = m ? slugify(m[1]) : null;
  return { category, tag: tag && tag !== "sports" ? tag : null };
}

/** Build the ordered unit list for a pass, filtered by the cursor. */
export function planUnits(categories: string[], now: Date, cursor: Cursor | null): WcUnit[] {
  const cats = [...new Set(categories)].sort();
  const units: WcUnit[] = [];
  if (!cursor || cursor.phase === "cat") {
    for (const c of cats) {
      if (cursor && c <= cursor.after) continue;
      units.push({ kind: "cat", key: `cat:${c.replace(/^Category:/, "").replace(/\s+/g, "_")}`, label: c, category: c, after: { phase: "cat", after: c } });
    }
  }
  for (const y of electoralYears(now)) {
    if (cursor?.phase === "electoral" && y <= cursor.after) continue;
    units.push({ kind: "electoral", key: `electoral:${y}`, label: `${y} national electoral calendar`, year: y, after: { phase: "electoral", after: y } });
  }
  return units;
}

function wpUrl(params: Record<string, string>): string {
  const q = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  return `${WP_API}?${q}`;
}

function wdUrl(params: Record<string, string>): string {
  const q = new URLSearchParams({ format: "json", ...params });
  return `${WD_API}?${q}`;
}

function articleUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_")).replace(/%3A/g, ":").replace(/%2C/g, ",").replace(/%27/g, "'")}`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function humanDate(day: string, precision: IngestPrecision): string {
  const [y, m, d] = day.split("-").map(Number);
  if (precision === "year" || precision === "decade") return String(y);
  if (precision === "month" || precision === "quarter") return `${MONTH_NAMES[m - 1]} ${y}`;
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

/** "2026–27 season" is consistent with 2027; "2026 World Cup" dated 2027 is not. */
export function titleYearConsistent(title: string, year: number): boolean {
  const ranges: Array<[number, number]> = [];
  const rest = title.replace(/\b((?:19|20|21)\d{2})\s*[–—-]\s*(\d{4}|\d{2})\b/g, (_, a: string, b: string) => {
    const start = Number(a);
    let end = b.length === 4 ? Number(b) : Number(a.slice(0, 2) + b);
    if (end < start) end += 100;
    ranges.push([start, end]);
    return " ";
  });
  const years = rest.match(/\b(?:19|20|21)\d{2}\b/g) ?? [];
  return years.every((y) => Number(y) === year) && ranges.every(([s, e]) => year >= s && year <= e);
}

/** Commons-hosted lead image only; the `?utm_…` query the API appends is dropped. */
export function commonsImage(page: PagePropsPage): { url: string; file: string } | null {
  const src = page.original?.source;
  if (!src || !page.pageimage) return null;
  try {
    const u = new URL(src);
    if (u.hostname !== "upload.wikimedia.org" || !u.pathname.startsWith("/wikipedia/commons/")) return null;
    return { url: `${u.origin}${u.pathname}`, file: page.pageimage };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Network helpers (all through ctx.http so spacing/retries/UA apply).

async function listCategoryMembers(ctx: IngestContext, category: string, type: "page" | "subcat"): Promise<CategoryMember[]> {
  const out: CategoryMember[] = [];
  let cmcontinue: string | undefined;
  let page = 0;
  for (; page < MAX_CATEGORY_PAGES; page++) {
    const json = await ctx.http.fetchJson<CategoryMembersResponse>(
      wpUrl({
        action: "query",
        list: "categorymembers",
        cmtitle: category,
        cmtype: type,
        cmnamespace: type === "page" ? "0" : "14",
        cmlimit: "500",
        ...(cmcontinue ? { cmcontinue } : {}),
      }),
    );
    if (json.error) throw new Error(`categorymembers ${category}: ${json.error.info ?? json.error.code ?? "error"}`);
    out.push(...(json.query?.categorymembers ?? []));
    cmcontinue = json.continue?.cmcontinue;
    if (!cmcontinue) break;
  }
  // The cap keeps one unit inside the budget; a category that outgrows it must be split, so say so.
  if (cmcontinue) ctx.log.warn(`${category}: more than ${MAX_CATEGORY_PAGES * 500} ${type} members, truncated after ${out.length}`);
  return out;
}

/** Pages plus the API's redirect map (`from` → `to`), needed to look results up by the requested title. */
async function fetchPageProps(
  ctx: IngestContext,
  by: "pageids" | "titles",
  values: string[],
  images: boolean,
): Promise<{ pages: PagePropsPage[]; redirects: Array<{ from: string; to: string }> }> {
  const out: PagePropsPage[] = [];
  const redirects: Array<{ from: string; to: string }> = [];
  for (const batch of chunk(values, BATCH)) {
    const json = await ctx.http.fetchJson<PagePropsResponse>(
      wpUrl({
        action: "query",
        prop: images ? "pageprops|pageimages" : "pageprops",
        ppprop: "wikibase_item",
        ...(images ? { piprop: "original|name", pilicense: "free" } : {}),
        redirects: "1",
        [by]: batch.join("|"),
      }),
    );
    if (json.error) throw new Error(`pageprops: ${json.error.info ?? json.error.code ?? "error"}`);
    out.push(...(json.query?.pages ?? []));
    redirects.push(...(json.query?.redirects ?? []));
  }
  return { pages: out, redirects };
}

async function fetchEntities(ctx: IngestContext, qids: string[], props: string): Promise<Map<string, WdEntity>> {
  const out = new Map<string, WdEntity>();
  for (const batch of chunk([...new Set(qids)], BATCH)) {
    const json = await ctx.http.fetchJson<WdEntitiesResponse>(
      wdUrl({ action: "wbgetentities", ids: batch.join("|"), props, languages: "en", sitefilter: "enwiki" }),
    );
    if (json.error) throw new Error(`wbgetentities: ${json.error.info ?? json.error.code ?? "error"}`);
    for (const [id, e] of Object.entries(json.entities ?? {})) if (!e.missing) out.set(id, e);
  }
  return out;
}

/** Country item → ISO alpha-2 (P297), cached for the life of the process (codes do not change). */
const isoCache = new Map<string, string | null>();
async function isoCodeFor(ctx: IngestContext, qid: string): Promise<string | null> {
  if (isoCache.has(qid)) return isoCache.get(qid) ?? null;
  let code: string | null = null;
  try {
    const json = await ctx.http.fetchJson<WdClaimsResponse>(wdUrl({ action: "wbgetclaims", entity: qid, property: "P297" }));
    const codes = stringValues(json.claims?.P297).map((c) => c.toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c));
    code = codes[0] ?? null;
  } catch (err) {
    ctx.log.warn(`P297 lookup failed for ${qid}: ${(err as Error).message}`);
    return null; // not cached: retried next unit
  }
  isoCache.set(qid, code);
  return code;
}

const labelCache = new Map<string, string | null>();
async function labelsFor(ctx: IngestContext, qids: string[]): Promise<Map<string, string | null>> {
  const missing = [...new Set(qids)].filter((q) => !labelCache.has(q));
  if (missing.length) {
    const entities = await fetchEntities(ctx, missing, "labels");
    for (const q of missing) labelCache.set(q, enLabel(entities.get(q)));
  }
  return new Map(qids.map((q) => [q, labelCache.get(q) ?? null]));
}

// ---------------------------------------------------------------------------------------------
// Category unit.

export type MemberInput = {
  page: PagePropsPage & { pageid: number; title: string };
  entity: WdEntity | undefined;
  /** ISO codes of P17 hosts, already resolved. */
  regions: string[];
  /** English label of P276 (the real venue) when the item has one — never the host-country fallback. */
  venueName: string | null;
  /** What `location.name` should read: the venue, or the first host country when P276 is absent. */
  locationName: string | null;
  countryNames: string[];
};

/** One category member → event row, or null when a guard rejects it. Pure; exported for tests. */
export function memberToEvent(input: MemberInput, unitCategory: string, now: Date): IngestEvent | null {
  const { page, entity } = input;
  const title = sanitizeTitle(page.title);
  if (!title || INDEX_TITLE_RE.test(title)) return null;
  const qid = page.pageprops?.wikibase_item;
  if (!qid || !/^Q\d+$/.test(qid)) return null;
  const dates = eventDates(entity);
  if (!dates) return null;
  const { start, end } = dates;
  const year = Number(start.day.slice(0, 4));
  if (!titleYearConsistent(title, year)) return null;
  if (!isFutureOrFar(start.day, start.precision, now)) return null;
  const { category, tag } = categoryMeta(unitCategory);
  const tags = [...classify(title, category).tags, "wikipedia-category", category === "esports" ? "esports" : "sports"];
  if (tag) tags.push(tag);
  if (isFarFuture(start.day, tags, now)) return null;
  const marquee = (MARQUEE_RE.test(title) && !NOT_MARQUEE_RE.test(title)) || FEATURED_NAMES.test(title);
  const regions = input.regions.length ? input.regions : ["GLOBAL"];
  const country = input.countryNames[0] ?? (input.regions[0] ? COUNTRY_NAMES[input.regions[0]] : undefined);
  const coords = coordinates(entity);
  const location =
    input.locationName || country
      ? {
          ...(input.locationName ? { name: input.locationName } : {}),
          ...(country ? { country } : {}),
          ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
        }
      : null;
  const where = input.countryNames.length
    ? ` in ${input.countryNames.slice(0, 3).map(withArticle).join(", ")}${input.countryNames.length > 3 ? " and others" : ""}`
    : "";
  const when = humanDate(start.day, start.precision);
  const opening = start.precision === "day" ? `${title} is scheduled to start on ${when}${where}.` : `${title} is expected in ${when}${where}.`;
  const description = `${opening} Listed among scheduled ${category === "esports" ? "esports" : "sports"} events on Wikipedia; dates come from Wikidata and may change.`;
  const row = buildEvent({
    title,
    date: start.day,
    endDate: end,
    category,
    tags,
    regions,
    description,
    source: SOURCE,
    sourceUrl: articleUrl(page.title),
    sourceKey: `${SOURCE}:${page.pageid}`,
    popularity: marquee ? 85 : 40,
    featured: marquee,
    datePrecision: start.precision,
    confidence: 0.85,
    externalIds: { qid, enwiki_pageid: page.pageid, enwiki: page.title },
    location,
    raw: {
      pageid: page.pageid,
      title: page.title,
      qid,
      start: start.day,
      precision: start.precision,
      end,
      p17: itemIds(entity, "P17"),
      p276: itemIds(entity, "P276"),
      pageimage: page.pageimage ?? null,
    },
  });
  // Only a real P276 venue on a day-precision date is an attendable, bookable event. A
  // country-name fallback, a country-wide P276 ("2027 Rugby World Cup" → Australia) and an
  // "expected in 2029" placeholder must never become a schema.org Event with a fabricated
  // 1 January startDate or a Place named after a whole country.
  row.jsonld_eligible = Boolean(input.venueName && country && input.venueName !== country && start.precision === "day");
  const img = commonsImage(page);
  if (img) {
    row.image_candidate_url = img.url;
    row.image_candidate_meta = { provider: "wikipedia", pageUrl: articleUrl(page.title), file: img.file };
  }
  return row;
}

async function runCategory(unit: CatUnit, ctx: IngestContext): Promise<IngestEvent[]> {
  const members = (await listCategoryMembers(ctx, unit.category, "page")).filter((m) => m.ns === 0 && !INDEX_TITLE_RE.test(m.title));
  if (!members.length) {
    ctx.log.info(`${unit.label}: no member pages`);
    return [];
  }
  const { pages } = await fetchPageProps(
    ctx,
    "pageids",
    members.map((m) => String(m.pageid)),
    true,
  );
  const withQid = pages.filter((p): p is PagePropsPage & { pageid: number; title: string } => Boolean(p.pageid && !p.missing && p.pageprops?.wikibase_item));
  const entities = await fetchEntities(
    ctx,
    withQid.map((p) => p.pageprops!.wikibase_item!),
    "claims|labels|sitelinks",
  );
  // Hosts (P17) and venues (P276) for the dated members only.
  const dated = withQid.filter((p) => eventDates(entities.get(p.pageprops!.wikibase_item!)));
  const countryQids = new Set<string>();
  const labelQids = new Set<string>();
  for (const p of dated) {
    const e = entities.get(p.pageprops!.wikibase_item!);
    for (const q of itemIds(e, "P17")) {
      countryQids.add(q);
      labelQids.add(q);
    }
    for (const q of itemIds(e, "P276").slice(0, 1)) labelQids.add(q);
  }
  const iso = new Map<string, string | null>();
  for (const q of countryQids) iso.set(q, await isoCodeFor(ctx, q));
  const labels = labelQids.size ? await labelsFor(ctx, [...labelQids]) : new Map<string, string | null>();

  const rows: IngestEvent[] = [];
  const seen = new Set<string>();
  let noDate = 0;
  for (const page of withQid) {
    const entity = entities.get(page.pageprops!.wikibase_item!);
    if (!eventDates(entity)) {
      noDate++;
      continue;
    }
    const hosts = itemIds(entity, "P17");
    const regions = [...new Set(hosts.map((q) => iso.get(q)).filter((c): c is string => Boolean(c)))];
    const countryNames = hosts.map((q) => labels.get(q) ?? (iso.get(q) ? COUNTRY_NAMES[iso.get(q)!] : null)).filter((n): n is string => Boolean(n));
    const venue = itemIds(entity, "P276")[0];
    const venueName = (venue ? labels.get(venue) : null) ?? null;
    const locationName = venueName ?? countryNames[0] ?? null;
    const row = memberToEvent({ page, entity, regions, venueName, locationName, countryNames }, unit.category, ctx.now);
    if (!row || seen.has(row.source_key)) continue;
    seen.add(row.source_key);
    rows.push(row);
  }
  ctx.log.info(`${unit.label}: ${members.length} members, ${withQid.length} with QID, ${noDate} without a date, ${rows.length} rows`);
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Electoral calendar unit.

export type ElectionInput = ElectoralEntry & { pageid?: number; qid?: string };

/** One calendar entry → event row, or null. Pure; exported for tests. */
export function electionToEvent(e: ElectionInput, year: number, now: Date): IngestEvent | null {
  if (Number(e.date.slice(0, 4)) !== year) return null;
  const title = electionTitle(e.article, year);
  if (!title) return null;
  if (!isFutureOrFar(e.date, "day", now)) return null;
  const code = countryCode(e.country);
  const kind = electionKind(e.article);
  const tags = [...classify(title, "politics").tags, "election", ...(kind ? [kind] : []), "wikipedia-category"];
  let popularity = 45;
  if (/presidential|general/i.test(e.article)) popularity += 15;
  if (code && G20.has(code)) popularity += 10;
  const office = e.office.replace(/\s+/g, " ").trim();
  const description = `${withArticle(e.country).replace(/^the/, "The")} votes on ${humanDate(e.date, "day")}${office ? ` to elect its ${office}` : ""}. Listed on Wikipedia's ${year} national electoral calendar; the date may still change.`;
  // "Next X election" redirects to the PREVIOUS election's article, which documents a different
  // event than the row we emit — link (and id) the calendar page instead.
  const isNext = /^Next\s/i.test(e.article);
  return buildEvent({
    title,
    date: e.date,
    endDate: e.endDate ?? null,
    category: "politics",
    tags,
    regions: code ? [code] : ["GLOBAL"],
    description,
    source: SOURCE,
    sourceUrl: articleUrl(isNext ? `${year} national electoral calendar` : e.article),
    sourceKey: `${SOURCE}:elections:${year}:${slugify(title).slice(0, 60)}`,
    popularity,
    datePrecision: "day",
    status: "scheduled",
    confidence: 0.85,
    externalIds: {
      ...(isNext ? {} : { enwiki: e.article }),
      ...(e.qid ? { qid: e.qid } : {}),
      ...(e.pageid ? { enwiki_pageid: e.pageid } : {}),
    },
    location: code ? { country: COUNTRY_NAMES[code] ?? e.country } : null,
    raw: { calendar: `${year} national electoral calendar`, country: e.country, article: e.article, office: e.office, italic: e.italic, date: e.date },
  });
}

async function runElectoral(unit: ElectoralUnit, ctx: IngestContext): Promise<IngestEvent[]> {
  const page = `${unit.year} national electoral calendar`;
  const json = await ctx.http.fetchJson<ParseResponse>(wpUrl({ action: "parse", page, prop: "wikitext", redirects: "1" }));
  if (json.error) {
    if (json.error.code === "missingtitle") {
      ctx.log.warn(`${unit.label}: page does not exist yet`);
      return [];
    }
    throw new Error(`parse ${page}: ${json.error.info ?? json.error.code ?? "error"}`);
  }
  const entries = parseElectoralCalendar(json.parse?.wikitext ?? "", unit.year);
  // Resolve pageid/QID only for year-prefixed articles: "Next X election" redirects to the
  // previous election's article, which would attach the wrong ids.
  const resolvable = [...new Set(entries.map((e) => e.article).filter((a) => a.startsWith(String(unit.year))))];
  const ids = new Map<string, { pageid: number; qid?: string }>();
  // A year-prefixed article may itself be a redirect, so results come back under the resolved
  // title — follow the API's redirect map to look them up by the title we asked for.
  const alias = new Map<string, string>();
  if (resolvable.length) {
    const { pages, redirects } = await fetchPageProps(ctx, "titles", resolvable, false);
    for (const r of redirects) alias.set(r.from, r.to);
    for (const p of pages) {
      if (!p.pageid || p.missing || !p.title.startsWith(String(unit.year))) continue;
      ids.set(p.title, { pageid: p.pageid, qid: p.pageprops?.wikibase_item });
    }
  }
  const rows: IngestEvent[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const row = electionToEvent({ ...e, ...(ids.get(alias.get(e.article) ?? e.article) ?? {}) }, unit.year, ctx.now);
    if (!row || seen.has(row.source_key)) continue;
    seen.add(row.source_key);
    rows.push(row);
  }
  ctx.log.info(`${unit.label}: ${entries.length} dated entries, ${rows.length} rows`);
  return rows;
}

// ---------------------------------------------------------------------------------------------

export const adapter: Adapter<WcUnit> = {
  id: SOURCE,
  label: "Wikipedia scheduled-event categories + electoral calendars",
  rank: 3,
  cadence: "daily",
  isConfigured: () => true,
  limits: { concurrency: 1, minIntervalMs: 400, timeoutMs: 30_000, maxRetries: 3 },

  async plan(cursor, ctx): Promise<Plan<WcUnit>> {
    const parsed = parseCursor(cursor);
    const categories: string[] = [...ROOT_CATEGORIES];
    if (!parsed || parsed.phase === "cat") {
      // Deliberately unguarded: a pass planned from a failed discovery would hold only the 3 roots,
      // yet still be `done`, and mark_stale_records would tentative-ise every subcategory row. The
      // runner records the error, keeps the cursor and retries on the next cron instead.
      const subcats = await listCategoryMembers(ctx, SUBCAT_PARENT, "subcat");
      for (const s of subcats) if (s.ns === 14 && s.title.startsWith("Category:")) categories.push(s.title);
    }
    return { units: planUnits(categories, ctx.now, parsed), done: true };
  },

  async run(unit, ctx) {
    return unit.kind === "cat" ? runCategory(unit, ctx) : runElectoral(unit, ctx);
  },
};
