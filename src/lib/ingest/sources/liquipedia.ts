import { COUNTRY_NAMES, regionCodesMatching } from "@/lib/regions";
import { buildEvent, decodeEntities, isFutureOrFar, parseInstant, sanitizeTitle } from "../normalize";
import type { Adapter, IngestContext, IngestEvent, IngestLogger, IngestPrecision, Json, Plan, Unit } from "../types";

/**
 * Tier-1 esports tournaments from the Liquipedia MediaWiki API (CC BY-SA 3.0).
 *
 * Discovery: one CirrusSearch query per wiki, `incategory:"S-Tier_Tournaments|Tier_1_Tournaments"
 * incategory:"Upcoming_Tournaments"`, run as a *generator* with `prop=revisions&rvprop=content` so
 * the same request returns the wikitext of up to 20 pages (verified 2026-09-09 on all nine wikis;
 * dota2 tiers its categories "Tier 1", the others "S-Tier"). Only the `{{Infobox league}}`
 * parameters are read (`sdate`, `edate`, `liquipediatier`, `liquipediatiertype`, `country`, `city`,
 * `venue`/`venue1`, `prizepoolusd`, `name`); no prose is copied — descriptions are our own
 * sentences built from those facts, and `image_candidate_url` stays null (logos are trademarks).
 * `action=parse` is never used, so the 1-per-30 s parse rule does not apply.
 *
 * Terms (https://liquipedia.net/api-terms-of-use, verified 2026-09-09). The *MediaWiki API*
 * section — the one this adapter is bound by — requires: "Rate limit all HTTP requests to no more
 * than 1 request per 2 seconds", `action=parse` no more than 1 request per 30 s, "Use a custom
 * HTTP 'User-Agent' header in your requests that identifies your project / use of the API, and
 * includes contact information" (violations are met with automated IP bans), "Your HTTP client
 * must support Content-Encoding: gzip responses", and "Re-use / cache your API results for as
 * long as possible - do not issue repeated requests which return the same data". The "60 requests
 * per 1 hour" cap belongs to the *LiquipediaDB API* section and does not apply here. Site-wide:
 * "Automated access to non-API endpoints (ie, generated HTML pages) is not permitted" and
 * "Liquipedia content is licensed under CC-BY-SA 3.0, which requires that you attribute
 * Liquipedia as the source of your data" — `sources.attribution = "Esports data from Liquipedia
 * (CC BY-SA 3.0)"` plus the per-row `source_url` link-back. A full pass is ≤ 27 requests (9 wikis
 * × ≤ 3 search pages) at 2 s spacing. Cadence honours the caching request: weekly is enough for
 * ~60 pages whose start dates move only a few times a season (see the cron suggestion), and the
 * `Upcoming_Tournaments` category itself changes slowly. The LPDB / v3 REST API
 * (`api.liquipedia.net`) is enterprise-only (403) and is not used.
 *
 * Rejected esports alternatives (never add): the undocumented lolesports API (leaked shared key,
 * match-level only), PandaScore (display-only licence + mandatory "Source: PandaScore" credit,
 * no public export — optional later path, not v1), TheSportsDB free tier (personal,
 * non-commercial). ESPN site.api is no longer rejected outright — its ToU restricts scripted
 * access, which the project weighed and accepted for schedule data (see `espn.ts`).
 *
 * Units: one per wiki; `after = { afterWiki }` so a resumed pass continues with the next wiki in
 * `WIKIS` order (content-addressed, never an index). Rows: `source_key = liquipedia:<wiki>:<pageid>`.
 */

export const LP_BASE = "https://liquipedia.net";
/** Search hits per request (`gsrlimit`); ~20 KB of wikitext per page, so 20 keeps responses small. */
export const SEARCH_PAGE = 20;
/** Search pages per wiki per unit; beyond 60 hits everything is stale "Upcoming" noise. */
export const MAX_SEARCH_PAGES = 3;
/** Tournaments starting later than this are left for a later pass (brief: 18 months). */
export const HORIZON_DAYS = 548;
const BASE_POPULARITY = 40;
const MARQUEE_BONUS = 20;
const CONFIDENCE = 0.8;

export type LiquipediaWiki = { id: string; game: string; tag: string };

export const WIKIS: readonly LiquipediaWiki[] = [
  { id: "leagueoflegends", game: "League of Legends", tag: "league-of-legends" },
  { id: "dota2", game: "Dota 2", tag: "dota-2" },
  { id: "counterstrike", game: "Counter-Strike", tag: "counter-strike" },
  { id: "valorant", game: "Valorant", tag: "valorant" },
  { id: "rocketleague", game: "Rocket League", tag: "rocket-league" },
  { id: "overwatch", game: "Overwatch", tag: "overwatch" },
  { id: "rainbowsix", game: "Rainbow Six Siege", tag: "rainbow-six" },
  { id: "starcraft2", game: "StarCraft II", tag: "starcraft" },
  { id: "mobilelegends", game: "Mobile Legends: Bang Bang", tag: "mobile-legends" },
];

/** Marquee page-title patterns (popularity +20); `featured` for The International and LoL Worlds. */
export const MARQUEE: ReadonlyArray<{ wiki: string; re: RegExp; featured?: boolean }> = [
  { wiki: "dota2", re: /^The International\/\d{4}$/, featured: true },
  { wiki: "leagueoflegends", re: /^World Championship\/\d{4}$/, featured: true },
  { wiki: "leagueoflegends", re: /^Mid-Season Invitational\/\d{4}$/ },
  { wiki: "counterstrike", re: /^Majors\/\d{4}\/[^/]+$/ },
  { wiki: "counterstrike", re: /^[^/]+\/Major\/\d{4}(\/[^/]+)?$/ },
  { wiki: "valorant", re: /^VCT\/\d{4}\/Champions$/ },
  { wiki: "rocketleague", re: /^Rocket League Championship Series\/\d{4}(\/World Championship)?$/ },
  { wiki: "rainbowsix", re: /^Six Invitational\/\d{4}$/ },
  { wiki: "overwatch", re: /^Overwatch Champions Series\/\d{4}\/World Finals$/ },
  { wiki: "mobilelegends", re: /^M\d+ World Championship$/ },
  { wiki: "*", re: /^Esports World Cup\/\d{4}$/ },
];

/**
 * Multi-game umbrella tournaments live under the same page title on every participating wiki
 * (verified 2026-09-09: `Esports Nations Cup/2026` on dota2, valorant, rocketleague and
 * mobilelegends; `Esports World Cup/2027` on counterstrike and rocketleague). Each copy carries
 * that game's segment dates but the whole event's `name`, so emitting all of them would put the
 * same marquee event in the catalog several times with conflicting dates and — because the date
 * is part of the slug — the slug-merge in `upsert.ts` could not collapse them. One wiki owns each
 * umbrella title; the other wikis skip it. The owner is the wiki whose copy is the most reliably
 * present and best dated (CS is at every EWC; ENC's dota2 page leads the others).
 *
 * Trade-off: if the owning wiki's copy is missing or filtered in a pass, the event is absent for
 * that pass rather than duplicated — measured 2026-09-09, that costs two far-out tentative rows
 * (`Esports World Cup/2028`, sdate `2028` → year precision, and `Esports Nations Cup/2027`,
 * month precision, both only on the rocketleague wiki so far) and removes one hard duplicate
 * (`Esports World Cup 2027` at 2027-07-16 from counterstrike vs 2027-08-01 from rocketleague).
 * Both reappear as soon as the owning wiki creates its page. Skips are counted in the per-wiki
 * log line, so `{"umbrella": n}` there is the size of the effect in any pass.
 */
export const UMBRELLA: ReadonlyArray<{ re: RegExp; wiki: string }> = [
  { re: /^Esports World Cup\/\d{4}$/, wiki: "counterstrike" },
  { re: /^Esports Nations Cup\/\d{4}$/, wiki: "dota2" },
  { re: /^FIFAe World Cup\/\d{4}$/, wiki: "rocketleague" },
  { re: /^World Electronic Sports Games\/\d{4}$/, wiki: "dota2" },
];

/** The wiki that owns a multi-game umbrella page title, or null when the title is not an umbrella. */
export function umbrellaOwner(title: string): string | null {
  for (const u of UMBRELLA) if (u.re.test(title)) return u.wiki;
  return null;
}

export type LiquipediaUnit = Unit & { wiki: string };
export type Cursor = { afterWiki: string | null };

export type LpRevision = { slots?: { main?: { content?: string } } };
export type LpPage = { pageid: number; ns?: number; title: string; missing?: boolean; revisions?: LpRevision[] };
export type LpQueryResponse = {
  continue?: { gsroffset?: number; continue?: string };
  query?: { pages?: LpPage[] };
  error?: { code?: string; info?: string };
};

export function searchUrl(wiki: string, offset = 0): string {
  const p = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: 'incategory:"S-Tier_Tournaments|Tier_1_Tournaments" incategory:"Upcoming_Tournaments"',
    gsrnamespace: "0",
    gsrlimit: String(SEARCH_PAGE),
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    format: "json",
    formatversion: "2",
  });
  if (offset > 0) p.set("gsroffset", String(offset));
  return `${LP_BASE}/${wiki}/api.php?${p.toString()}`;
}

export function pageUrl(wiki: string, title: string): string {
  return `${LP_BASE}/${wiki}/${encodeURI(title.replace(/ /g, "_"))}`;
}

// ---------------------------------------------------------------------------------------------
// Wikitext helpers (pure, exported for tests)

export function stripComments(s: string): string {
  return s.replace(/<!--[\s\S]*?-->/g, "");
}

/**
 * The parameters of the first `{{Infobox league}}` template: brace-depth aware, splits on
 * top-level pipes only (`|liquipediatier=1 |liquipediatiertype=Qualifier` on one line is two
 * parameters; `{{Abbr/TBA}}` and `[[a|b]]` inside a value are not). Values are raw wikitext.
 */
export function extractInfobox(wikitext: string): Record<string, string> | null {
  const text = stripComments(wikitext);
  const m = /\{\{\s*Infobox league\b/i.exec(text);
  if (!m) return null;
  let depth = 0;
  let i = m.index;
  let end = -1;
  while (i < text.length) {
    if (text.startsWith("{{", i)) {
      depth++;
      i += 2;
      continue;
    }
    if (text.startsWith("}}", i)) {
      depth--;
      i += 2;
      if (depth === 0) {
        end = i - 2;
        break;
      }
      continue;
    }
    i++;
  }
  const inner = text.slice(m.index + m[0].length, end < 0 ? text.length : end);
  const parts: string[] = [];
  let cur = "";
  let tpl = 0;
  let link = 0;
  for (let j = 0; j < inner.length; j++) {
    const two = inner.slice(j, j + 2);
    if (two === "{{") {
      tpl++;
      cur += two;
      j++;
      continue;
    }
    if (two === "}}") {
      tpl = Math.max(0, tpl - 1);
      cur += two;
      j++;
      continue;
    }
    const ch = inner[j];
    if (ch === "[") link++;
    else if (ch === "]") link = Math.max(0, link - 1);
    if (ch === "|" && tpl === 0 && link === 0) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  const out: Record<string, string> = {};
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    if (!key || key in out) continue;
    out[key] = part.slice(eq + 1).trim();
  }
  return out;
}

/** Plain text of an infobox value: templates dropped, links reduced to their label, markup stripped. */
export function cleanValue(raw: string | undefined): string {
  if (!raw) return "";
  let s = raw;
  for (let guard = 0; guard < 10 && /\{\{[^{}]*\}\}/.test(s); guard++) s = s.replace(/\{\{[^{}]*\}\}/g, " ");
  s = s.replace(/\{\{[\s\S]*$/, " "); // unbalanced remainder
  s = s.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2").replace(/\[\[([^\]]*)\]\]/g, "$1");
  s = s.replace(/\[\s*[a-z]+:\/\/\S*\s+([^\]]*)\]/gi, "$1").replace(/\[\s*[a-z]+:\/\/[^\]]*\]/gi, " ");
  s = s.replace(/'{2,}/g, "").replace(/<br\s*\/?>/gi, " ");
  s = sanitizeTitle(decodeEntities(s));
  if (/^(tba|tbd|n\/a|-|—|\?+)$/i.test(s)) return "";
  return s;
}

/**
 * Liquipedia dates: `YYYY-MM-DD`, or with unknown parts as `??` (`2027-11-??`, `2027-??-??`), or
 * truncated (`2027-11`, `2027`). Coarse values store the first day of the period.
 */
export function parseLpDate(raw: string | undefined): { date: string; precision: IngestPrecision } | null {
  const s = cleanValue(raw).replace(/\s+/g, "");
  const m = /^(\d{4})(?:-(\d{2}|\?\?|xx))?(?:-(\d{2}|\?\?|xx))?$/i.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  if (y < 2000 || y > 2100) return null;
  const mm = m[2] && /^\d{2}$/.test(m[2]) ? Number(m[2]) : null;
  const dd = mm !== null && m[3] && /^\d{2}$/.test(m[3]) ? Number(m[3]) : null;
  if (mm === null) return { date: `${y}-01-01`, precision: "year" };
  if (mm < 1 || mm > 12) return null;
  const month = String(mm).padStart(2, "0");
  if (dd === null) return { date: `${y}-${month}-01`, precision: "month" };
  const date = `${y}-${month}-${String(dd).padStart(2, "0")}`;
  const t = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== date) return null;
  return { date, precision: "day" };
}

/** `liquipediatier`: `1` (dota2) or `S-Tier` / `S` (the other wikis). */
export function isTopTier(raw: string | undefined): boolean {
  const s = cleanValue(raw).toLowerCase().replace(/\s+/g, " ");
  return s === "1" || s === "s" || s === "s-tier" || s === "tier 1" || s === "s tier";
}

/** Qualifiers, showmatches and similar sub-events share the parent's tier; they are not countdowns. */
export function isExcludedType(tierType: string | undefined, title: string): boolean {
  const t = cleanValue(tierType).toLowerCase();
  if (/qualifier|showmatch|show match|points|charity|misc/.test(t)) return true;
  return /\/[^/]*qualifier[^/]*(\/|$)/i.test(title) || /\/[^/]*showmatch[^/]*(\/|$)/i.test(title);
}

const NON_COUNTRIES = new Set([
  "world",
  "international",
  "europe",
  "asia",
  "americas",
  "america",
  "north america",
  "south america",
  "latin america",
  "southeast asia",
  "east asia",
  "oceania",
  "africa",
  "mena",
  "cis",
  "online",
  "eu",
  "na",
  "sea",
  "apac",
  "emea",
]);

const COUNTRY_ALIASES: Record<string, string> = {
  "united states": "US",
  usa: "US",
  "united states of america": "US",
  uk: "GB",
  "united kingdom": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "south korea": "KR",
  korea: "KR",
  "republic of korea": "KR",
  türkiye: "TR",
  turkiye: "TR",
  turkey: "TR",
  czechia: "CZ",
  "czech republic": "CZ",
  russia: "RU",
  vietnam: "VN",
  uae: "AE",
  "united arab emirates": "AE",
  "hong kong": "HK",
  taiwan: "TW",
  macau: "MO",
  "the netherlands": "NL",
  netherlands: "NL",
  "the philippines": "PH",
};

let nameIndex: Map<string, string> | null = null;

/** ISO code for one infobox country value (aliases and fuzzy name match); null for World/unknown. */
export function countryCode(name: string): string | null {
  const key = name.toLowerCase().trim();
  if (!key || NON_COUNTRIES.has(key)) return null;
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  if (!nameIndex) {
    nameIndex = new Map();
    for (const [code, n] of Object.entries(COUNTRY_NAMES)) if (code !== "GLOBAL") nameIndex.set(n.toLowerCase(), code);
  }
  const exact = nameIndex.get(key);
  if (exact) return exact;
  const fuzzy = regionCodesMatching(key);
  return fuzzy.length === 1 ? fuzzy[0] : null;
}

/** ISO codes for the infobox `country` (and `country2`…) values; empty for World/Europe/unknown. */
export function regionsFor(...countries: Array<string | undefined>): string[] {
  const out: string[] = [];
  for (const c of countries) {
    const code = countryCode(cleanValue(c));
    if (code && !out.includes(code)) out.push(code);
  }
  return out;
}

/** Marquee patterns on the infobox display name (page titles do not always carry "Major"). */
export const MARQUEE_NAMES: ReadonlyArray<{ wiki: string; re: RegExp }> = [
  { wiki: "counterstrike", re: /\bMajor\b/ },
  { wiki: "valorant", re: /\bChampions\b(?! Tour)/ },
  { wiki: "rocketleague", re: /\bWorld Championship\b/ },
];

export function isMarquee(wiki: string, title: string, name = ""): { marquee: boolean; featured: boolean } {
  for (const m of MARQUEE) {
    if ((m.wiki === "*" || m.wiki === wiki) && m.re.test(title)) return { marquee: true, featured: Boolean(m.featured) };
  }
  for (const m of MARQUEE_NAMES) {
    if (m.wiki === wiki && name && m.re.test(name)) return { marquee: true, featured: false };
  }
  return { marquee: false, featured: false };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function formatPeriod(date: string, precision: IngestPrecision): string {
  const [y, m] = date.split("-").map(Number);
  if (precision === "month") return `${MONTHS[m - 1]} ${y}`;
  if (precision === "day" || precision === "instant") return formatDay(date);
  return String(y);
}

function prizeUsd(raw: string | undefined): string | null {
  const s = cleanValue(raw).replace(/[\s$,]/g, "").replace(/^usd?/i, "");
  if (!/^\d{4,}$/.test(s)) return null;
  return Number(s).toLocaleString("en-US");
}

/** Own sentences from infobox facts (never Liquipedia prose). */
export function describe(input: {
  title: string;
  game: string;
  city: string;
  country: string;
  venue: string;
  date: string;
  precision: IngestPrecision;
  endDate: string | null;
  prize: string | null;
}): string {
  const where = [input.city, input.country].filter(Boolean).join(", ");
  let s1 = `${input.title} is a top-tier ${input.game} esports tournament`;
  if (where) s1 += ` held in ${where}`;
  if (input.venue) s1 += ` at ${input.venue}`;
  s1 += ".";
  let s2: string;
  if (input.precision === "day") {
    s2 = input.endDate && input.endDate !== input.date ? `It runs from ${formatDay(input.date)} to ${formatDay(input.endDate)}` : `It takes place on ${formatDay(input.date)}`;
  } else {
    s2 = `It is expected in ${formatPeriod(input.date, input.precision)}`;
  }
  if (input.prize) s2 += ` with a US$${input.prize} prize pool`;
  s2 += ".";
  return `${s1} ${s2}`;
}

/** Years mentioned in the title must match the start year (label-year check). */
export function titleYearConsistent(title: string, date: string): boolean {
  const year = date.slice(0, 4);
  const years = title.match(/\b(19|20)\d{2}\b/g) ?? [];
  return years.every((y) => y === year);
}

export type SkipReason = "no-infobox" | "not-top-tier" | "excluded-type" | "umbrella" | "cancelled" | "no-date" | "past" | "horizon" | "year-mismatch" | "title";

/** One search page → one event, or a skip reason. */
export function pageToEvent(page: LpPage, wiki: LiquipediaWiki, now: Date): { event: IngestEvent } | { skip: SkipReason } {
  const owner = umbrellaOwner(page.title);
  if (owner && owner !== wiki.id) return { skip: "umbrella" };
  // One stripped copy for every wikitext test below: a template parked inside `<!-- -->` (a common
  // pattern when an edition is un-cancelled) must not drop a live tournament.
  const text = stripComments(page.revisions?.[0]?.slots?.main?.content ?? "");
  const box = extractInfobox(text);
  if (!box) return { skip: "no-infobox" };
  if (!isTopTier(box.liquipediatier)) return { skip: "not-top-tier" };
  if (isExcludedType(box.liquipediatiertype, page.title)) return { skip: "excluded-type" };
  if (/\{\{\s*Cancelled Tournament\b/i.test(text) || /^(true|1|yes)$/i.test(cleanValue(box.cancelled))) return { skip: "cancelled" };
  const start = parseLpDate(box.sdate);
  if (!start) return { skip: "no-date" };
  if (!isFutureOrFar(start.date, start.precision, now)) return { skip: "past" };
  if (parseInstant(start.date) > now.getTime() + HORIZON_DAYS * 86_400_000) return { skip: "horizon" };
  const title = cleanValue(box.name) || sanitizeTitle(page.title.replace(/\//g, " "));
  if (title.length < 2 || /^Q\d+$/.test(title)) return { skip: "title" };
  if (!titleYearConsistent(title, start.date)) return { skip: "year-mismatch" };

  const end = parseLpDate(box.edate);
  const endDate = start.precision === "day" && end?.precision === "day" && end.date >= start.date ? end.date : null;
  const city = cleanValue(box.city);
  const countryRaw = cleanValue(box.country);
  const regions = regionsFor(box.country, box.country2, box.country3);
  // Canonical name when the country resolves, so "USA"/"UK"/"Türkiye" render like every other row.
  const code = countryCode(countryRaw);
  const country = code ? (COUNTRY_NAMES[code] ?? countryRaw) : NON_COUNTRIES.has(countryRaw.toLowerCase()) ? "" : countryRaw;
  const venue = cleanValue(box.venue) || cleanValue(box.venue1);
  const prize = prizeUsd(box.prizepoolusd);
  const { marquee, featured } = isMarquee(wiki.id, page.title, title);
  const location: Record<string, unknown> = {};
  if (venue) location.name = venue;
  if (city) location.city = city;
  if (country) location.country = country;

  const event = buildEvent({
    title,
    date: start.date,
    endDate,
    category: "esports",
    tags: ["esports", wiki.tag, "tier-1", ...(marquee ? ["marquee"] : [])],
    regions,
    description: describe({ title, game: wiki.game, city, country, venue, date: start.date, precision: start.precision, endDate, prize }),
    source: "liquipedia",
    sourceUrl: pageUrl(wiki.id, page.title),
    sourceKey: `liquipedia:${wiki.id}:${page.pageid}`,
    externalIds: { liquipedia_pageid: page.pageid, liquipedia_wiki: wiki.id, liquipedia_title: page.title },
    featured,
    popularity: BASE_POPULARITY + (marquee ? MARQUEE_BONUS : 0),
    allDay: true,
    timezone: null,
    datePrecision: start.precision,
    confidence: CONFIDENCE,
    location: Object.keys(location).length ? location : null,
    raw: {
      pageid: page.pageid,
      title: page.title,
      infobox: Object.fromEntries(
        ["name", "sdate", "edate", "liquipediatier", "liquipediatiertype", "type", "country", "country2", "city", "venue", "venue1", "prizepoolusd", "series", "organizer"]
          .filter((k) => box[k] !== undefined)
          .map((k) => [k, box[k].slice(0, 200)]),
      ),
    },
  });
  // A studio address does not make an online tournament publicly attendable.
  event.jsonld_eligible = Boolean((venue || city) && !/online/i.test(cleanValue(box.type)));
  return { event };
}

export function pagesToEvents(pages: readonly LpPage[], wiki: LiquipediaWiki, now: Date, log?: IngestLogger): IngestEvent[] {
  const byKey = new Map<string, IngestEvent>();
  const skips: Partial<Record<SkipReason, number>> = {};
  for (const page of pages) {
    if (page.missing || (page.ns ?? 0) !== 0) continue;
    const r = pageToEvent(page, wiki, now);
    if ("skip" in r) {
      skips[r.skip] = (skips[r.skip] ?? 0) + 1;
      continue;
    }
    if (!byKey.has(r.event.source_key)) byKey.set(r.event.source_key, r.event);
  }
  const rows = [...byKey.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.slug < b.slug ? -1 : 1));
  log?.info(`${wiki.id}: ${pages.length} candidate pages → ${rows.length} rows`, { skipped: skips });
  return rows;
}

/** All search hits for a wiki (≤ MAX_SEARCH_PAGES requests, continuation via `gsroffset`). */
export async function fetchCandidatePages(wiki: string, ctx: IngestContext): Promise<LpPage[]> {
  const pages: LpPage[] = [];
  let offset = 0;
  for (let n = 0; n < MAX_SEARCH_PAGES; n++) {
    const res = await ctx.http.fetchJson<LpQueryResponse>(searchUrl(wiki, offset), { headers: { "Accept-Encoding": "gzip" } });
    if (res.error) throw new Error(`liquipedia ${wiki}: ${res.error.code ?? "error"} ${res.error.info ?? ""}`.trim());
    pages.push(...(res.query?.pages ?? []));
    const next = res.continue?.gsroffset;
    if (typeof next !== "number" || next <= offset) {
      // A prop-level continuation (`rvcontinue`, no `gsroffset`) means this batch was incomplete;
      // we cannot follow it with an offset, so say so instead of dropping the rest in silence.
      if (res.continue) ctx.log.warn(`liquipedia ${wiki}: unfollowed continuation ${JSON.stringify(res.continue)}`);
      break;
    }
    offset = next;
  }
  if (pages.length >= SEARCH_PAGE * MAX_SEARCH_PAGES) ctx.log.warn(`liquipedia ${wiki}: search truncated at ${pages.length} hits (MAX_SEARCH_PAGES=${MAX_SEARCH_PAGES})`);
  return pages;
}

export function parseCursor(cursor: Json | null): Cursor {
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    const c = cursor as { afterWiki?: unknown };
    if (typeof c.afterWiki === "string" && WIKIS.some((w) => w.id === c.afterWiki)) return { afterWiki: c.afterWiki };
  }
  return { afterWiki: null };
}

export function planUnits(afterWiki: string | null): LiquipediaUnit[] {
  const start = afterWiki ? WIKIS.findIndex((w) => w.id === afterWiki) + 1 : 0;
  return WIKIS.slice(start).map((w) => ({
    key: `liquipedia:${w.id}`,
    label: `${w.game} (${w.id})`,
    after: { afterWiki: w.id },
    wiki: w.id,
  }));
}

export const adapter: Adapter<LiquipediaUnit> = {
  id: "liquipedia",
  label: "Liquipedia (tier-1 esports tournaments)",
  rank: 4,
  cadence: "daily",
  isConfigured: () => true,
  limits: { concurrency: 1, minIntervalMs: 2000, timeoutMs: 20_000, maxRetries: 1 },

  async plan(cursor): Promise<Plan<LiquipediaUnit>> {
    return { units: planUnits(parseCursor(cursor).afterWiki), done: true };
  },

  async run(unit, ctx) {
    const wiki = WIKIS.find((w) => w.id === unit.wiki);
    if (!wiki) throw new Error(`unknown liquipedia wiki: ${unit.wiki}`);
    const pages = await fetchCandidatePages(wiki.id, ctx);
    return pagesToEvents(pages, wiki, ctx.now, ctx.log);
  },
};
