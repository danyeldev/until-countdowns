import { COUNTRY_NAMES } from "@/lib/regions";
import { BudgetExceededError, HttpError, isBudgetExceeded } from "../http";
import { buildEvent, sanitizeTitle, slugify } from "../normalize";
import type { Adapter, IngestContext, IngestEvent, IngestLogger, Json, Plan, Unit } from "../types";

/**
 * Developer conferences from confs.tech (https://confs.tech), read straight from the
 * `tech-conferences/conference-data` GitHub repository (MIT — attribution "Conference data from
 * confs.tech (MIT)" lives on `public.sources`). One JSON file per year × topic:
 * `conferences/{YYYY}/{topic}.json`, an array of `{ name, url, startDate, endDate, city, country,
 * online, locales, cocUrl, cfpUrl, cfpEndDate, bluesky, twitter, mastodon }` (verified 2026-09-09:
 * 30 topic files for 2026, 562 entries, 186 online, 103 name+date duplicates across topics,
 * `country` as free-form names — "U.S.A.", "U.K.", "Czech Republic" — and absent on pure-online rows).
 *
 * Units: one per year (`now.year` and `now.year + 1`, ≤ 30 requests each) so entries that appear
 * in several topic files are merged in memory (topics become tags) before they are upserted.
 * The cursor is content-addressed (`{ afterYear }`): a resume only re-plans the years not yet
 * upserted, and a cursor that would leave no unit restarts the pass (an empty completed pass
 * would let `mark_stale_records` demote every row).
 *
 * Hosts: raw.githubusercontent.com is primary (the topic list is hardcoded — the GitHub REST API
 * allows 60 unauthenticated calls per hour and is never used). Its Fastly edge answers
 * "503 Backend.max_conn reached" in bursts (seen on 80 % of requests from one POP on 2026-09-09),
 * so a file that fails there is re-read from jsDelivr's GitHub mirror, which serves the same
 * commit-addressed bytes (`@main` is cached up to 12 h — fine for a weekly job). Only a 404 from
 * the *primary* means "no such topic file this year" (skipped); every other outcome — including a
 * 404 from the mirror, which cannot prove absence — fails the unit so the runner keeps the cursor
 * and retries with a fresh budget. The undocumented unauthenticated limit of the raw CDN is
 * respected with 500 ms spacing, ≤ 60 requests per run and a single backed-off retry on 429.
 *
 * Kept: `name` (≥ 3 chars), `url`, `startDate >= today`, `startDate` within 18 months. Dropped:
 * names carrying a 4-digit year that differs from `startDate` (label-year check). Titles get
 * ` {YYYY}` appended when the name has no year. Descriptions are our own two or three sentences
 * (place, dates, CFP deadline while it is still open); `description` never copies upstream prose.
 * `regions` = the country resolved to ISO-3166 alpha-2 by whole-name match against the ISO English
 * names (`Intl.DisplayNames`) plus an alias table, `GLOBAL` when online or unresolved (each
 * unresolved spelling is logged once). `jsonld_eligible` only for in-person events with a city and
 * a resolved country. A conference listed in both the {YYYY} and {YYYY+1} files with a January
 * start deliberately yields the same `source_key` from both units — the later unit of the same run
 * wins deterministically, and the row is identical either way. No images: the dataset carries none and
 * scraping conference sites' `og:image` is off limits (third-party terms). CFP deadlines are not
 * emitted as events (thin pages). CES/re:Invent-scale keynotes are not in this dataset (`general`
 * is community events) — those stay curated.
 *
 * Rejected alternatives (Phase-4 briefs §20): Eventbrite public search (shut down), Ticketmaster
 * Discovery (no caching beyond "reasonable periods", no derived revenue).
 */

export const CONFS_RAW_BASE = "https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences";
export const CONFS_MIRROR_BASE = "https://cdn.jsdelivr.net/gh/tech-conferences/conference-data@main/conferences";
export const HORIZON_MONTHS = 18;
export const YEARS_PER_PASS = 2;
const CONFIDENCE = 0.8;
const POPULARITY = 20;
const POPULARITY_GENERAL = 25;
const POPULARITY_CAP = 30;
const MIN_NAME = 3;
/** A topic file is not started with less budget left than one full primary+mirror attempt needs. */
const MIN_UNIT_TAIL_MS = 30_000;

/** Topic files present for 2026 (verified 2026-09-09). `label` is the wording used in descriptions. */
export const CONFS_TOPICS: ReadonlyArray<{ id: string; label: string; article: "a" | "an" }> = [
  { id: "accessibility", label: "accessibility", article: "an" },
  { id: "android", label: "Android", article: "an" },
  { id: "api", label: "API", article: "an" },
  { id: "clojure", label: "Clojure", article: "a" },
  { id: "cpp", label: "C++", article: "a" },
  { id: "css", label: "CSS", article: "a" },
  { id: "data", label: "data", article: "a" },
  { id: "devops", label: "DevOps", article: "a" },
  { id: "dotnet", label: ".NET", article: "a" },
  { id: "general", label: "developer", article: "a" },
  { id: "graphql", label: "GraphQL", article: "a" },
  { id: "groovy", label: "Groovy", article: "a" },
  { id: "ios", label: "iOS", article: "an" },
  { id: "iot", label: "IoT", article: "an" },
  { id: "java", label: "Java", article: "a" },
  { id: "javascript", label: "JavaScript", article: "a" },
  { id: "kotlin", label: "Kotlin", article: "a" },
  { id: "leadership", label: "engineering leadership", article: "an" },
  { id: "networking", label: "networking", article: "a" },
  { id: "opensource", label: "open source", article: "an" },
  { id: "performance", label: "web performance", article: "a" },
  { id: "php", label: "PHP", article: "a" },
  { id: "product", label: "product", article: "a" },
  { id: "python", label: "Python", article: "a" },
  { id: "rust", label: "Rust", article: "a" },
  { id: "security", label: "security", article: "a" },
  { id: "sre", label: "SRE", article: "an" },
  { id: "testing", label: "software testing", article: "a" },
  { id: "typescript", label: "TypeScript", article: "a" },
  { id: "ux", label: "UX", article: "a" },
];

const TOPIC_INDEX = new Map(CONFS_TOPICS.map((t, i) => [t.id, i]));

export type ConfsEntry = {
  name?: string | null;
  url?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  city?: string | null;
  country?: string | null;
  online?: boolean | null;
  locales?: string | null;
  cocUrl?: string | null;
  cfpUrl?: string | null;
  cfpEndDate?: string | null;
  offersSignLanguageOrCC?: boolean | null;
  bluesky?: string | null;
  twitter?: string | null;
  mastodon?: string | null;
};

export type ConfsUnit = Unit & { year: number };
type Cursor = { afterYear: number };

/**
 * Spellings the dataset uses (or plausibly could) that neither `Intl.DisplayNames` nor
 * `COUNTRY_NAMES` spells the same way. Keys are normalised by `normalizeCountry` before lookup,
 * so punctuation and case here are irrelevant.
 */
export const COUNTRY_ALIASES: Record<string, string> = {
  "u.s.a.": "US",
  usa: "US",
  "u.s.": "US",
  us: "US",
  "united states of america": "US",
  "u.k.": "GB",
  uk: "GB",
  "great britain": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  "czech republic": "CZ",
  holland: "NL",
  uae: "AE",
  korea: "KR",
  "russian federation": "RU",
  macedonia: "MK",
  "ivory coast": "CI",
  "republic of ireland": "IE",
  "viet nam": "VN",
  turkiye: "TR",
  "hong kong sar": "HK",
  "hong kong": "HK",
  "taiwan, roc": "TW",
  myanmar: "MM",
  "cabo verde": "CV",
  // "Congo" alone is ambiguous (CD vs CG); only the unambiguous spellings are mapped.
  drc: "CD",
  "congo-kinshasa": "CD",
  "congo-brazzaville": "CG",
  swaziland: "SZ",
  "cape verde": "CV",
  burma: "MM",
  "east timor": "TL",
  "bosnia and herzegovina": "BA",
};

const COUNTRY_PREFIXES = [
  "the ",
  "people's republic of ",
  "democratic republic of ",
  "islamic republic of ",
  "republic of ",
  "kingdom of ",
  "state of ",
  "commonwealth of ",
  "federation of ",
];

/**
 * Fold a country label to a comparison key: lowercase, strip diacritics, `&` → `and`, curly
 * quotes → ASCII, drop `.`, collapse whitespace, then peel leading articles/qualifiers
 * ("Kingdom of Morocco" → "morocco", "People's Republic of Bangladesh" → "bangladesh").
 * Applied to *both* sides of every lookup so the two spellings never have to agree exactly.
 */
export function normalizeCountry(raw: string | null | undefined): string {
  let s = String(raw ?? "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();
  s = s.replace(/[\u2018\u2019\u02bc\u2032]/g, "'").replace(/[\u201c\u201d]/g, '"');
  s = s.replace(/[\u2010-\u2015]/g, "-");
  s = s.replace(/&/g, " and ");
  s = s.replace(/\./g, "");
  s = s.replace(/\s+/g, " ").trim();
  for (let changed = true; changed; ) {
    changed = false;
    for (const prefix of COUNTRY_PREFIXES) {
      if (s.startsWith(prefix) && s.length > prefix.length) {
        s = s.slice(prefix.length).trim();
        changed = true;
      }
    }
  }
  return s;
}

let displayNames: Intl.DisplayNames | null = null;

/** The ISO English name of an alpha-2 code ("IT" → "Italy"), or the code when the runtime has none. */
export function countryName(code: string): string {
  const cc = code.toUpperCase();
  if (cc === "GLOBAL") return "Worldwide";
  try {
    displayNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    const label = displayNames.of(cc);
    if (label && label !== cc) return label;
  } catch {
    /* runtime without full ICU: fall through */
  }
  return COUNTRY_NAMES[cc] || cc;
}

let nameIndex: Map<string, string> | null = null;

/**
 * name → alpha-2, built once from the codes in `COUNTRY_NAMES` (the project's canonical code set).
 * Three layers, later ones winning: that file's labels (which are date-holidays-derived and may be
 * local-language — "Italia" — or long-form — "Kingdom of Morocco"), the hand alias table, and the
 * ISO English names from `Intl.DisplayNames`. The English names win so that an edit to
 * `src/data/countries.json` (a shared file this adapter does not own) can only *add* spellings,
 * never take one away.
 */
function countryIndex(): Map<string, string> {
  if (nameIndex) return nameIndex;
  const index = new Map<string, string>();
  const codes: string[] = [];
  for (const [code, label] of Object.entries(COUNTRY_NAMES)) {
    if (code === "GLOBAL") continue;
    const cc = code.toUpperCase();
    codes.push(cc);
    const key = normalizeCountry(label);
    if (key) index.set(key, cc);
  }
  const known = new Set(codes);
  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) {
    const key = normalizeCountry(alias);
    // An alias may only name a code the catalog knows how to label.
    if (key && known.has(code.toUpperCase())) index.set(key, code.toUpperCase());
  }
  for (const cc of codes) {
    const key = normalizeCountry(countryName(cc));
    if (key) index.set(key, cc);
  }
  nameIndex = index;
  return index;
}

const warnedCountries = new Set<string>();

/** Country name → alpha-2 (whole-name match after normalisation, never a substring). */
export function countryCode(name: string | null | undefined, log?: Pick<IngestLogger, "warn">): string | null {
  const needle = normalizeCountry(name);
  if (!needle) return null;
  const code = countryIndex().get(needle) ?? null;
  if (!code && log && !warnedCountries.has(needle)) {
    warnedCountries.add(needle);
    log.warn(`confs: unrecognised country name ${JSON.stringify(String(name))} → GLOBAL`);
  }
  return code;
}

/** Test seam: forget which unresolved names have already been logged. */
export function resetCountryWarnings(): void {
  warnedCountries.clear();
}

export function fileUrl(base: string, year: number, topic: string): string {
  return `${base}/${year}/${topic}.json`;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_RE = /\b(19|20)\d{2}\b/;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Strict `YYYY-MM-DD`: V8 parses `2026-02-30` leniently, so the day must round-trip. */
function isDay(s: unknown): s is string {
  if (typeof s !== "string" || !DAY_RE.test(s)) return false;
  const t = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

/** `today + months` as `YYYY-MM-DD` (UTC), the inclusive horizon for `startDate`. */
export function horizonDay(now: Date, months = HORIZON_MONTHS): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, now.getUTCDate()));
  return d.toISOString().slice(0, 10);
}

/** "September 10, 2026" */
export function formatDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "on September 10, 2026" / "from September 10 to September 11, 2026" / "from December 30, 2026 to January 2, 2027". */
export function formatSpan(start: string, end: string | null): string {
  if (!end || end === start) return `on ${formatDay(start)}`;
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey] = end.split("-").map(Number);
  if (sy === ey) return `from ${MONTHS[sm - 1]} ${sd} to ${formatDay(end)}`;
  return `from ${formatDay(start)} to ${formatDay(end)}`;
}

function isHttpUrl(s: unknown): s is string {
  if (typeof s !== "string" || !/^https?:\/\//i.test(s)) return false;
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

/** Topic ids in `CONFS_TOPICS` order; `general` is dropped when a specific topic is present. */
export function topicIds(topics: Iterable<string>): string[] {
  const ids = [...new Set(topics)].filter((t) => TOPIC_INDEX.has(t)).sort((a, b) => TOPIC_INDEX.get(a)! - TOPIC_INDEX.get(b)!);
  return ids.length > 1 ? ids.filter((t) => t !== "general") : ids;
}

/** "a JavaScript and TypeScript" / "an API, JavaScript and TypeScript" */
function topicPhrase(ids: string[]): string {
  const topics = ids.map((id) => CONFS_TOPICS[TOPIC_INDEX.get(id)!]);
  if (topics.length === 0) return "a developer";
  const labels = topics.map((t) => t.label);
  const list = labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  return `${topics[0].article} ${list}`;
}

export type ConfsDraft = {
  entry: ConfsEntry;
  name: string;
  url: string;
  startDate: string;
  endDate: string | null;
  topics: Set<string>;
  files: Set<string>;
};

/** Reject an entry outright (missing fields, out of window, label-year mismatch), or return it trimmed. */
export function acceptEntry(entry: ConfsEntry, today: string, horizon: string): Omit<ConfsDraft, "topics" | "files"> | null {
  const name = sanitizeTitle(String(entry?.name ?? ""));
  if (name.length < MIN_NAME) return null;
  if (!isHttpUrl(entry.url)) return null;
  if (!isDay(entry.startDate)) return null;
  const startDate = entry.startDate;
  if (startDate < today || startDate > horizon) return null;
  const m = YEAR_RE.exec(name);
  if (m && m[0] !== startDate.slice(0, 4)) return null;
  const endDate = isDay(entry.endDate) && entry.endDate >= startDate ? entry.endDate : null;
  return { entry, name, url: entry.url, startDate, endDate };
}

/**
 * `city` / `country` come from a crowd-sourced file with no schema contract, so they go through
 * the same `sanitizeTitle` as the name (tags, entities, `[...]` markers, stray whitespace).
 */
function placeParts(entry: ConfsEntry, log?: Pick<IngestLogger, "warn">): { city: string; code: string | null; countryLabel: string } {
  const city = sanitizeTitle(String(entry.city ?? ""));
  const rawCountry = sanitizeTitle(String(entry.country ?? ""));
  const code = countryCode(rawCountry, log);
  return { city, code, countryLabel: code ? countryName(code) : rawCountry };
}

/** Description written from facts (never upstream prose): place, dates, CFP while open. */
export function describeConf(d: ConfsDraft, today: string, log?: Pick<IngestLogger, "warn">): string {
  const online = Boolean(d.entry.online);
  const { city, countryLabel } = placeParts(d.entry, log);
  // City-states ("Singapore, Singapore", "Monaco, Monaco") read as a stutter: keep one.
  const parts = countryLabel && countryLabel.toLowerCase() === city.toLowerCase() ? [city] : [city, countryLabel];
  const where = parts.filter(Boolean).join(", ");
  let place: string;
  if (online) place = where ? `held online and in ${where}` : "held online";
  else place = where ? `held in ${where}` : "";
  const first = `${d.name} is ${topicPhrase(topicIds(d.topics))} conference${place ? ` ${place}` : ""}.`;
  const second = `It runs ${formatSpan(d.startDate, d.endDate)}.`;
  const cfp = isDay(d.entry.cfpEndDate) && d.entry.cfpEndDate >= today ? ` The call for papers closes on ${formatDay(d.entry.cfpEndDate)}.` : "";
  return `${first} ${second}${cfp}`;
}

/** One merged draft → catalog row. */
export function draftToEvent(d: ConfsDraft, today: string, log?: Pick<IngestLogger, "warn">): IngestEvent {
  const online = Boolean(d.entry.online);
  const place = placeParts(d.entry, online ? undefined : log);
  const code = online ? null : place.code;
  const city = place.city;
  const topics = topicIds(d.topics);
  const year = d.startDate.slice(0, 4);
  const title = YEAR_RE.test(d.name) ? d.name : `${d.name} ${year}`;
  const tags = ["conference", ...topics];
  if (d.entry.cfpUrl) tags.push("cfp");
  if (online) tags.push("online");
  const popularity = Math.min(POPULARITY_CAP, d.topics.has("general") ? POPULARITY_GENERAL : POPULARITY);
  // No `url`: the conference homepage is not the venue's URL (`jsonld.ts` would emit it as
  // `Place.url`), and `source_url` already carries it. An in-person row with neither a city nor a
  // resolved country carries no location at all rather than an empty object.
  const location: Record<string, unknown> | null =
    online || (!city && !code)
      ? null
      : {
          ...(city ? { city } : {}),
          ...(code ? { country: code } : {}),
        };
  const ev = buildEvent({
    title,
    date: d.startDate,
    endDate: d.endDate,
    category: "tech",
    tags,
    regions: code ? [code] : ["GLOBAL"],
    description: describeConf(d, today, log),
    source: "confs",
    sourceUrl: d.url,
    sourceKey: `confs:${year}:${slugify(d.name)}:${d.startDate}`,
    popularity,
    allDay: true,
    timezone: null,
    datePrecision: "day",
    status: "scheduled",
    confidence: CONFIDENCE,
    externalIds: {},
    location,
    raw: {
      name: d.entry.name,
      url: d.entry.url,
      startDate: d.entry.startDate,
      endDate: d.entry.endDate ?? null,
      city: d.entry.city ?? null,
      country: d.entry.country ?? null,
      online,
      locales: d.entry.locales ?? null,
      cfpUrl: d.entry.cfpUrl ?? null,
      cfpEndDate: d.entry.cfpEndDate ?? null,
      topics,
      files: [...d.files].sort(),
    },
  });
  ev.jsonld_eligible = !online && Boolean(city) && Boolean(code);
  return ev;
}

/**
 * Merge the entries of every topic file of one year (same `slugify(name)` + `startDate` ⇒ one
 * row, topics unioned) and build rows sorted by `source_key`. Pure; exported for tests.
 */
export function entriesToEvents(
  files: ReadonlyArray<{ topic: string; year: number; entries: ConfsEntry[] }>,
  now: Date,
  log?: Pick<IngestLogger, "warn">,
): IngestEvent[] {
  const today = now.toISOString().slice(0, 10);
  const horizon = horizonDay(now);
  const drafts = new Map<string, ConfsDraft>();
  for (const file of files) {
    for (const entry of file.entries) {
      const accepted = acceptEntry(entry, today, horizon);
      if (!accepted) continue;
      const key = `${slugify(accepted.name)}|${accepted.startDate}`;
      const prev = drafts.get(key);
      if (prev) {
        prev.topics.add(file.topic);
        prev.files.add(`${file.year}/${file.topic}`);
        // Keep the richer facts: a copy with a city/country or a CFP deadline beats one without.
        if (!prev.entry.city && entry.city) prev.entry = { ...prev.entry, city: entry.city, country: entry.country ?? prev.entry.country };
        if (!prev.entry.cfpEndDate && entry.cfpEndDate) prev.entry = { ...prev.entry, cfpUrl: entry.cfpUrl ?? prev.entry.cfpUrl, cfpEndDate: entry.cfpEndDate };
        if (!prev.entry.cfpUrl && entry.cfpUrl) prev.entry = { ...prev.entry, cfpUrl: entry.cfpUrl };
        if (!prev.endDate && accepted.endDate) prev.endDate = accepted.endDate;
      } else {
        drafts.set(key, { ...accepted, topics: new Set([file.topic]), files: new Set([`${file.year}/${file.topic}`]) });
      }
    }
  }
  const rows: IngestEvent[] = [];
  const seen = new Set<string>();
  for (const d of drafts.values()) {
    const ev = draftToEvent(d, today, log);
    if (seen.has(ev.source_key)) continue;
    seen.add(ev.source_key);
    rows.push(ev);
  }
  rows.sort((a, b) => (a.source_key < b.source_key ? -1 : a.source_key > b.source_key ? 1 : 0));
  return rows;
}

function is404(err: unknown): boolean {
  return err instanceof HttpError && err.status === 404;
}

/** Only the primary host may fail fast; a throttled primary is still backed off before the mirror. */
const PRIMARY_TIMEOUT_MS = 8_000;

/**
 * One topic file: primary host, then the mirror on any non-404 failure. `null` only when the
 * *primary* answered 404 — that is the authoritative "no such topic file this year". A 404 from
 * the mirror after the primary failed for some other reason is a mirror artefact (cold/uncached
 * path), not proof of absence, so it fails the unit rather than silently dropping a whole topic
 * (which `mark_stale_records` would then demote to `tentative`). Budget exhaustion is never masked.
 */
export async function fetchTopicFile(ctx: IngestContext, year: number, topic: string, log: IngestLogger = ctx.log): Promise<ConfsEntry[] | null> {
  const primary = fileUrl(CONFS_RAW_BASE, year, topic);
  let primaryErr: unknown;
  try {
    // No retries on the primary: the mirror is the retry (a 503 burst retried with backoff on all
    // 30 files pushed one unit to 110 s on 2026-09-09; failing fast keeps a unit near 20 s). The
    // one exception is 429 — throttling is answered by backing off (ctx.http honours Retry-After),
    // not by immediately asking a second host.
    const body = await fetchPrimary(ctx, primary, log);
    if (Array.isArray(body)) return body as ConfsEntry[];
    primaryErr = new Error(`unexpected payload (not an array) from ${primary}`);
  } catch (err) {
    if (isBudgetExceeded(err)) throw err;
    if (is404(err)) return null;
    primaryErr = err;
  }
  const mirror = fileUrl(CONFS_MIRROR_BASE, year, topic);
  log.warn(`${year}/${topic}: primary failed (${(primaryErr as Error)?.message ?? primaryErr}); trying mirror`, { url: mirror });
  try {
    const body = await ctx.http.fetchJson<unknown>(mirror);
    if (Array.isArray(body)) return body as ConfsEntry[];
    throw new Error(`unexpected payload (not an array) from ${mirror}`);
  } catch (err) {
    if (isBudgetExceeded(err)) throw err;
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/** The primary read: one shot, except a 429 which is re-issued once so `Retry-After` is honoured. */
async function fetchPrimary(ctx: IngestContext, url: string, log: IngestLogger): Promise<unknown> {
  try {
    return await ctx.http.fetchJson<unknown>(url, { maxRetries: 0, timeoutMs: PRIMARY_TIMEOUT_MS });
  } catch (err) {
    if (!(err instanceof HttpError) || err.status !== 429) throw err;
    log.warn(`429 from the raw CDN; backing off once before the mirror`, { url });
    return await ctx.http.fetchJson<unknown>(url, { maxRetries: 1, timeoutMs: PRIMARY_TIMEOUT_MS });
  }
}

export function parseCursor(cursor: Json | null): Cursor | null {
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    const c = cursor as { afterYear?: unknown };
    if (typeof c.afterYear === "number" && Number.isInteger(c.afterYear)) return { afterYear: c.afterYear };
  }
  return null;
}

/** Years of this pass (`now.year`, `now.year + 1`) not yet upserted; a cursor that leaves nothing restarts the pass. */
export function planUnits(now: Date, cursor: Json | null): ConfsUnit[] {
  const first = now.getUTCFullYear();
  const years = Array.from({ length: YEARS_PER_PASS }, (_, i) => first + i);
  const c = parseCursor(cursor);
  const pending = c ? years.filter((y) => y > c.afterYear) : years;
  const fetchedOn = now.toISOString().slice(0, 10);
  return (pending.length ? pending : years).map((year) => ({
    key: `confs:year:${year}`,
    label: `confs.tech ${year} (${CONFS_TOPICS.length} topic files)`,
    after: { afterYear: year, fetchedOn },
    year,
  }));
}

export const adapter: Adapter<ConfsUnit> = {
  id: "confs",
  label: "confs.tech conference-data",
  rank: 4,
  cadence: "weekly",
  isConfigured: () => true,
  limits: { concurrency: 1, minIntervalMs: 500, timeoutMs: 20_000, maxRetries: 2 },

  async plan(cursor, ctx): Promise<Plan<ConfsUnit>> {
    return { units: planUnits(ctx.now, cursor), done: true };
  },

  async run(unit, ctx) {
    const files: Array<{ topic: string; year: number; entries: ConfsEntry[] }> = [];
    let missing = 0;
    let raw = 0;
    for (const { id: topic } of CONFS_TOPICS) {
      // A unit is all-or-nothing: a year that would be truncated by the budget is thrown away and
      // retried whole next run, because a short row set here reads to `mark_stale_records` as
      // "these conferences are gone".
      const left = ctx.budget.remainingMs();
      if (left < MIN_UNIT_TAIL_MS) throw new BudgetExceededError(fileUrl(CONFS_RAW_BASE, unit.year, topic), left);
      const entries = await fetchTopicFile(ctx, unit.year, topic);
      if (!entries) {
        missing++;
        continue;
      }
      raw += entries.length;
      files.push({ topic, year: unit.year, entries });
    }
    const rows = entriesToEvents(files, ctx.now, ctx.log);
    ctx.log.info(`${unit.label}: ${files.length} files (${missing} absent), ${raw} entries → ${rows.length} rows`);
    return rows;
  },
};
