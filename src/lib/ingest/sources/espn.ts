import type { Category } from "@/lib/types";
import { buildEvent, classify, decodeEntities, isFarFuture, isFutureOrFar, isoDate, parseInstant, sanitizeTitle, titleDigest } from "../normalize";
import type { Adapter, IngestContext, IngestEvent, IngestLogger, IngestStatus, Json, Plan, Unit } from "../types";

/**
 * UFC cards with a real start time, scraped from ESPN's public MMA schedule page
 * (`https://www.espn.com/mma/schedule/_/league/ufc`).
 *
 * Why this source exists: UFC cards already reach the catalog through `wikipedia-categories` →
 * Wikidata, which states them to DAY precision only ("UFC 320 — 3 October 2026"). A fight card is
 * one of the few things people actually count down to by the hour, and an all-day row makes the
 * countdown useless from about 24 hours out. ESPN publishes the broadcast start for every scheduled
 * card, months ahead, without a key. That is the whole reason for the adapter: time precision, not
 * coverage.
 *
 * Rank 6 beats `wikipedia-categories` (3) and `wikidata` (2), so where the two rows meet ESPN's
 * instant wins the date, `all_day` and `date_precision` (`0001_core.sql`, strict `>` on
 * `source_rank`). They meet on the SLUG, though, which is `slugify(title)-<day>`: ESPN names a
 * numbered card "UFC 320: Jones vs. Aspinall" while the Wikipedia article is "UFC 320", so those
 * two land as separate rows and only the Fight Nights (named identically on both sides —
 * "UFC Fight Night: Silva vs. Delgado") merge. The title is left as ESPN publishes it rather than
 * truncated to "UFC <n>" to force a merge: which title an event page shows is a catalog-wide
 * decision, not this adapter's to make quietly. If the owner would rather have the merge than the
 * matchup in the title, `titleOf()` is the one place to change.
 *
 * WHAT IS NOT KNOWN. This adapter used to call ESPN's undocumented scoreboard JSON
 * (`site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard`); it now fetches the schedule WEB PAGE
 * and digs the same records out of the HTML. Nothing about that HTML has been verified. It was
 * written on a machine with no outbound network — no ESPN page was ever fetched here — and unlike
 * the JSON API, whose field names were at least corroborated against a published TypeScript typing,
 * there is no published description of ESPN's markup to check against. Every script marker, JSON-LD
 * assumption and table-column guess below is exactly that: a guess. The first real cron run is the
 * experiment, and this file is written so that run is readable rather than merely successful.
 *
 * Three readings of the page, tried in order of how much structure survives ({@link scrapeSchedule}):
 *   1. `app-state` — the JSON blob ESPN embeds in a script tag, historically
 *      `window['__espnfitt__'] = {…};`. The opening bracket — `{` or `[` — is balance-matched by
 *      {@link balancedJson} (a stack walk that ignores brackets inside string literals and honours
 *      escapes; a greedy regex to the last `}` would swallow the rest of the bundle), `JSON.parse`d, and
 *      handed to the same {@link extractEvents} the API response used. Best case by far: identical
 *      records to the old endpoint, `timeValid` and venue included, so nothing downstream can tell
 *      the difference. {@link MAX_DEPTH} was raised for it — an API envelope buried `events` six
 *      levels down, a page-state tree buries it deeper.
 *   2. `json-ld` — `<script type="application/ld+json">` blocks; schema.org `SportsEvent` / `Event`
 *      nodes carry `name`, `startDate`, `url` and `location`, which are mapped onto the same
 *      {@link EspnEvent} shape ({@link jsonLdToEspnEvent}) so the mapping layer below is unchanged.
 *      No `timeValid` here: the midnight-UTC backstop is the only guard left against a placeholder
 *      stamp.
 *   3. `markup` — a regex pass over the schedule table ({@link eventsFromMarkup}). Least reliable
 *      and deliberately the most conservative: it reads a DAY and never a time, because the times
 *      ESPN renders in a table are in some presentation zone this code cannot identify, and a
 *      confident wrong hour is the one output this adapter exists to prevent. A row counts as a
 *      card only if it links into `/mma/fightcenter/` or its name reads like one — any other
 *      `/mma/` anchor is navigation, and a schedule page is full of it. Rows here get their
 *      id from a `/mma/fightcenter/_/id/<id>` href when there is one, and otherwise a stable hash
 *      of name+day (`h<8 hex>`) — so a card with no link keeps one identity across runs, but WOULD
 *      re-key (and briefly duplicate) if a later run reached it through layer 1 or 2 instead. That
 *      is the price of a fallback that still produces rows; it is only paid while layers 1 and 2
 *      are broken.
 *
 * READING THE LOG. Every run logs which layer fired, at info level:
 * `strategy=app-state — 12 events from 843210 bytes of HTML`. That line is the only way anyone will
 * learn what ESPN actually serves, so it is unconditional. When all three yield nothing the run
 * logs a warning instead, naming the page size and whether each marker was present
 * (`app-state=no ld+json=no fightcenter-href=no`), which is enough to tell a challenge page from a
 * shape change without a second request. A pass that DID read events and then rejected every one of
 * them warns too, with the reject tally (`0 kept · skipped past=31`), because that reads exactly
 * like a normal pass otherwise. Zero rows are never reported quietly, by any route.
 *
 * User-Agent: `ctx.http` sets `INGEST_USER_AGENT` (a contact string) centrally for every source and
 * this adapter does not override it — a per-source browser impersonation would be a lie told to
 * bypass a control, and it would also drift from the one place UAs are configured. The likeliest
 * first-run failure follows from that: ESPN answers a non-browser UA with a bot-challenge or
 * consent interstitial, 200 OK, a few kilobytes, none of the three markers. It looks exactly like
 * the warning above with a small byte count. If that is what the log shows, the question for the
 * owner is whether to drop the source, not which regex to tweak.
 *
 * Dates: an ESPN stamp is UTC and often omits seconds ("2026-09-12T22:00Z"); it is normalised to a
 * full instant and passed with `timezone: "UTC"`. Four cases deliberately come out ALL-DAY
 * instead: a date with no time component at all (every layer-3 row, by design); a time-bearing
 * stamp that names no zone ("2026-09-12T19:00:00"), which `Date.parse` would read in whatever zone
 * the runner happens to sit in — a shape the JSON API never sent but schema.org and a `datetime`
 * attribute both permit, so the scraper can now reach it; a competition ESPN
 * itself flags `timeValid: false` (its own way of saying "date yes, slot no", which survives layer
 * 1 and only layer 1); and — as a backstop for a payload that omits that flag — a date at exactly
 * 00:00 UTC, the placeholder shape of an unset slot. A synthesised midnight is worse than an
 * all-day row: it renders a precise countdown to a time nobody claimed. The cost of the backstop is
 * that a genuine 00:00 UTC start (an 8 pm ET prelim slot) loses its hour; it keeps the right day,
 * and the next refresh restores the time if ESPN moves it a minute.
 *
 * Statuses: `STATUS_SCHEDULED` / `state: "pre"` → `scheduled`, `*CANCEL*` → `cancelled`,
 * `*POSTPON*` / `*DELAY*` → `postponed`, anything completed or in play (`state: "in" | "post"`,
 * `completed: true`, `STATUS_FINAL`) → dropped. schema.org `eventStatus` is mapped onto the same
 * strings by layer 2; layer 3 states nothing and everything it finds is `scheduled`. An
 * unrecognised status is treated as `scheduled`: the row is a future date from a schedule page, and
 * dropping it over an unknown enum string is the failure mode this adapter exists to avoid. Past
 * cards are dropped outright.
 *
 * Identity: `source_key = espn:mma:<event id>`, stable across runs and across a title change (ESPN
 * renames a card when a main event falls apart), and the same id whichever layer produced the row
 * as long as the fightcenter link is there to carry it. Never `image_candidate_url`: ESPN's fighter
 * and event art is licensed press photography, not ours to store.
 *
 * Licence / terms: a schedule is a set of facts — "UFC 320 starts at 02:00 UTC on 3 October" is not
 * a creative work and is not copyrightable (README, "Licence policy"). ESPN's Terms of Use do
 * forbid scripted access to their services, and scraping their web page is scripted access more
 * plainly than calling their JSON was; the project has decided to accept that contractual risk
 * deliberately for schedule facts, at ONE request per day with the `INGEST_USER_AGENT` contact
 * string attached, and to drop the source without argument if ESPN objects. That is a business
 * judgement, not a claim that the page is unencumbered. No prose is copied (descriptions are our
 * own sentences), no images are stored, and `source_url` links every row back to its ESPN page.
 *
 * Rejected alternatives: the UFC's own site (no public JSON; stricter terms), Sportradar /
 * SportsDataIO MMA (enterprise pricing), TheSportsDB free tier (non-commercial),
 * Wikipedia/Wikidata (already ingested — day precision only, which is the problem being solved),
 * tapology.com (explicit anti-scraping terms).
 */

/** The page this adapter scrapes; also the source's homepage (`public.sources.homepage`). */
export const SOURCE_URL = "https://www.espn.com/mma/schedule/_/league/ufc";
/** Origin for the relative hrefs in the page's markup. */
export const ESPN_ORIGIN = "https://www.espn.com";
const SOURCE = "espn" as const;
const CATEGORY: Category = "sports";

/** The page lists a season at a time (a few dozen cards); the cap only fires if the shape surprises us. */
export const MAX_ROWS_PER_UNIT = 100;
/** `indexable` in `0009_indexable_summary.sql` needs `length(description) >= 80`. */
export const MIN_DESCRIPTION = 80;
const CONFIDENCE_INSTANT = 0.9;
const CONFIDENCE_DAY = 0.8;
/**
 * Depth cap for the envelope walk. Six was enough for the API envelope (`sports[].leagues[].events`);
 * an embedded page state wraps the same array in routing, layout and content nodes, so the walk has
 * to go further. Cost is linear in the tree and {@link looksLikeEvent} still decides what counts.
 */
const MAX_DEPTH = 12;

// ---------------------------------------------------------------------------------------------
// Upstream shapes (the subset read here; every field optional — none of this is a contract)

export type EspnStatusType = { name?: string | null; state?: string | null; completed?: boolean | null; description?: string | null } | null;
export type EspnStatus = { type?: EspnStatusType } | null;
export type EspnAddress = { city?: string | null; state?: string | null; country?: string | null } | null;
export type EspnVenue = { id?: string | number | null; fullName?: string | null; name?: string | null; address?: EspnAddress } | null;
export type EspnLink = { href?: string | null; rel?: string[] | null; text?: string | null } | null;
export type EspnCompetition = {
  id?: string | number | null;
  date?: string | null;
  startDate?: string | null;
  /** ESPN's own flag: false while a card has a date but no confirmed broadcast slot. */
  timeValid?: boolean | null;
  name?: string | null;
  venue?: EspnVenue;
  status?: EspnStatus;
} | null;
export type EspnEvent = {
  id?: string | number | null;
  uid?: string | null;
  date?: string | null;
  startDate?: string | null;
  name?: string | null;
  shortName?: string | null;
  status?: EspnStatus;
  venue?: EspnVenue;
  competitions?: EspnCompetition[] | null;
  links?: EspnLink[] | null;
};
export type EspnScoreboard = { leagues?: unknown; events?: EspnEvent[] | null };

// ---------------------------------------------------------------------------------------------
// Envelope

/**
 * Loose enough to survive a re-nesting, strict enough not to collect competitors: an object with an
 * id that also carries a date, a name or a competitions array.
 */
export function looksLikeEvent(value: unknown): value is EspnEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  if (typeof o.id !== "string" && typeof o.id !== "number") return false;
  return typeof o.date === "string" || typeof o.name === "string" || Array.isArray(o.competitions);
}

/**
 * Every event in the body, wherever ESPN put it: the flat `{ events: [...] }` envelope, the
 * `{ sports: [{ leagues: [{ events: [...] }] }] }` one, or a bare array. Deduped by id, so an
 * envelope that repeats the same event at two depths still yields one row.
 */
export function extractEvents(body: unknown): EspnEvent[] {
  const out: EspnEvent[] = [];
  const seen = new Set<string>();
  const take = (arr: readonly unknown[]): void => {
    for (const item of arr) {
      if (!looksLikeEvent(item)) continue;
      const id = String(item.id);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(item);
    }
  };
  const walk = (node: unknown, depth: number): void => {
    if (depth > MAX_DEPTH || !node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    const o = node as Record<string, unknown>;
    if (Array.isArray(o.events)) take(o.events);
    for (const [key, value] of Object.entries(o)) {
      if (key === "events" || !value || typeof value !== "object") continue;
      walk(value, depth + 1);
    }
  };
  if (Array.isArray(body)) take(body);
  walk(body, 0);
  return out;
}

export function firstCompetition(ev: EspnEvent): EspnCompetition {
  const list = Array.isArray(ev?.competitions) ? ev.competitions : [];
  return list.find((c) => c && typeof c === "object") ?? null;
}

// ---------------------------------------------------------------------------------------------
// Field extraction

/** The event's date string, from whichever of the four plausible paths carries one. */
export function rawDateOf(ev: EspnEvent): string | null {
  const comp = firstCompetition(ev);
  for (const candidate of [ev?.date, ev?.startDate, comp?.date, comp?.startDate]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

export type EventDate = { date: string; instant: boolean };

/** A stamp that names its own offset (`…Z`, `…+02:00`, `…-0400`) and so means the same thing everywhere. */
const ZONED_STAMP = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * One ESPN stamp → the date this row carries. A time-bearing stamp becomes a full ISO instant
 * ("2026-09-12T22:00Z" → "2026-09-12T22:00:00Z"); a bare date, an unparsable stamp and an exact
 * midnight-UTC placeholder become the day alone (see the docblock: a fake instant is worse than an
 * all-day row). Null when there is not even a usable day.
 *
 * `timeValid` is ESPN's own answer to the question this function is otherwise guessing at: it is
 * false on a card whose broadcast slot has not been set, where the stamp is a placeholder rather
 * than a start. Pass it when the competition carries one and the midnight heuristic becomes a
 * backstop rather than the test.
 */
export function toEventDate(raw: string | null | undefined, timeValid?: boolean | null): EventDate | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (!m) return null;
  const day = (candidate: string): EventDate | null => (Number.isNaN(Date.parse(`${candidate}T00:00:00Z`)) ? null : { date: candidate, instant: false });
  if (!s.includes("T")) return day(m[1]);
  // A time with no `Z` and no ±HH:MM: `Date.parse` reads that in the RUNNER's local zone, so the
  // same page would produce different instants — and sometimes different days, hence different
  // slugs — on a laptop and on the cron box. ESPN's JSON never sent that shape, but schema.org
  // `startDate` and an HTML `datetime` attribute both allow it, so the scraper can now reach it.
  // The day is the only part of such a stamp that means the same thing everywhere.
  if (!ZONED_STAMP.test(s)) return day(m[1]);
  const t = Date.parse(s);
  if (Number.isNaN(t)) return day(m[1]);
  const iso = new Date(t).toISOString().replace(/\.000Z$/, "Z");
  // Explicitly untimed: ESPN has a date but no confirmed slot.
  if (timeValid === false) return day(iso.slice(0, 10));
  if (iso.slice(11, 19) === "00:00:00") return day(iso.slice(0, 10));
  return { date: iso, instant: true };
}

/** `scheduled` / `postponed` / `cancelled`, or null for a card that is over or under way. */
export function statusOf(ev: EspnEvent): IngestStatus | null {
  const type = ev?.status?.type ?? firstCompetition(ev)?.status?.type ?? null;
  const name = String(type?.name ?? "").toUpperCase();
  const state = String(type?.state ?? "").toLowerCase();
  if (name.includes("CANCEL")) return "cancelled";
  if (name.includes("POSTPON") || name.includes("DELAY")) return "postponed";
  if (type?.completed === true) return null;
  if (name.includes("FINAL") || name.includes("COMPLET")) return null;
  if (state === "in" || state === "post") return null;
  // "pre", STATUS_SCHEDULED, a missing status and anything unrecognised: this is a schedule feed.
  return "scheduled";
}

/**
 * The card's name as ESPN publishes it, falling back to `shortName` and the competition name so a
 * dropped `name` field costs the matchup rather than the row. Empty when nothing is usable.
 */
export function titleOf(ev: EspnEvent): string {
  for (const candidate of [ev?.name, ev?.shortName, firstCompetition(ev)?.name]) {
    if (typeof candidate !== "string") continue;
    const title = sanitizeTitle(candidate);
    if (title.length >= 2) return title;
  }
  return "";
}

export function isFightNight(title: string): boolean {
  return /fight\s*night/i.test(title);
}

/** The pay-per-view number of a numbered card ("UFC 320: …" → 320); null for Fight Nights and "UFC on ABC 8". */
export function cardNumber(title: string): number | null {
  if (isFightNight(title)) return null;
  const m = /^\s*UFC\s+(\d{1,4})\b/i.exec(title);
  return m ? Number(m[1]) : null;
}

/**
 * Modest and flat: a numbered pay-per-view outranks a Fight Night, and a landmark card (UFC 300,
 * 350, …) outranks an ordinary one. Nothing here reaches the marquee band football-data uses for a
 * World Cup final.
 */
export function popularityFor(title: string): number {
  const n = cardNumber(title);
  if (n === null) return 30;
  return n % 50 === 0 ? 55 : 45;
}

/**
 * ISO-3166 alpha-2 for the country codes ESPN puts on a venue address (alpha-3, occasionally
 * alpha-2 already). Only the countries the UFC actually runs cards in; an unknown value yields
 * null and the country is simply left off the location rather than stored in a second format.
 */
const COUNTRY_ISO2: Record<string, string> = {
  USA: "US",
  CAN: "CA",
  MEX: "MX",
  BRA: "BR",
  ARG: "AR",
  CHL: "CL",
  GBR: "GB",
  IRL: "IE",
  FRA: "FR",
  DEU: "DE",
  GER: "DE",
  ESP: "ES",
  ITA: "IT",
  POL: "PL",
  SWE: "SE",
  NLD: "NL",
  CZE: "CZ",
  RUS: "RU",
  JPN: "JP",
  CHN: "CN",
  KOR: "KR",
  SGP: "SG",
  PHL: "PH",
  AUS: "AU",
  NZL: "NZ",
  ARE: "AE",
  UAE: "AE",
  SAU: "SA",
  QAT: "QA",
  ZAF: "ZA",
};

export function iso2(country: string | null | undefined): string | null {
  const raw = String(country ?? "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  return COUNTRY_ISO2[raw] ?? null;
}

export function venueOf(ev: EspnEvent): EspnVenue {
  return firstCompetition(ev)?.venue ?? ev?.venue ?? null;
}

/** `{ name, city, country }` for the arena, or null when ESPN has not named one yet (common far out). */
export function locationOf(ev: EspnEvent): Record<string, unknown> | null {
  const venue = venueOf(ev);
  if (!venue) return null;
  const name = sanitizeTitle(String(venue.fullName ?? venue.name ?? ""));
  const city = sanitizeTitle(String(venue.address?.city ?? ""));
  const country = iso2(venue.address?.country);
  if (!name && !city) return null;
  return { ...(name ? { name } : {}), ...(city ? { city } : {}), ...(country ? { country } : {}) };
}

export function fightcenterUrl(id: string): string {
  return `https://www.espn.com/mma/fightcenter/_/id/${encodeURIComponent(id)}`;
}

/** The event's own ESPN page: an `/mma/` link if one is published, else the fightcenter URL for its id. */
export function sourceUrlOf(ev: EspnEvent, id: string): string {
  const links = Array.isArray(ev?.links) ? ev.links : [];
  const hrefs = links.map((l) => (typeof l?.href === "string" ? l.href.trim() : "")).filter((h) => /^https?:\/\//.test(h));
  return hrefs.find((h) => h.includes("/mma/")) ?? hrefs[0] ?? fightcenterUrl(id);
}

// ---------------------------------------------------------------------------------------------
// Prose

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatDay(iso: string): string {
  const d = new Date(parseInstant(iso));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatTime(iso: string): string {
  const d = new Date(parseInstant(iso));
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function cardKind(title: string): string {
  if (cardNumber(title) !== null) return "numbered UFC pay-per-view card";
  if (isFightNight(title)) return "UFC Fight Night card";
  return "UFC card";
}

/**
 * Our own sentences, never ESPN's copy. Every clause is a fact from the payload; sentences are
 * appended until the text clears {@link MIN_DESCRIPTION}, because no enrichment job will ever fill
 * `summary` for a row this source owns and a short description would leave it non-indexable.
 */
export function describeEvent(title: string, when: EventDate, status: IngestStatus, location: Record<string, unknown> | null): string {
  const kind = cardKind(title);
  const venue = typeof location?.name === "string" ? location.name : "";
  const city = typeof location?.city === "string" ? location.city : "";
  const where = venue ? ` at ${venue}${city ? ` in ${city}` : ""}` : city ? ` in ${city}` : "";
  const day = formatDay(when.date);
  const sentences: string[] = [];
  if (status === "cancelled") sentences.push(`${title} was a ${kind}${where} set for ${day}. ESPN lists it as cancelled.`);
  else if (status === "postponed") sentences.push(`${title} is a ${kind}${where} that was set for ${day}. ESPN lists it as postponed.`);
  else sentences.push(`${title} is a ${kind}${where} on ${day}.`);
  if (when.instant) sentences.push(`ESPN lists the card as starting at ${formatTime(when.date)} UTC.`);
  else sentences.push("ESPN lists the date but no start time yet, so this countdown runs to the day itself.");
  const text = () => sentences.join(" ");
  if (text().length < MIN_DESCRIPTION) sentences.push("The countdown on this page tracks the time left until the card begins.");
  return text();
}

// ---------------------------------------------------------------------------------------------
// Mapping

export type Reject = "no-id" | "no-title" | "bad-date" | "status" | "past" | "far-future";

function trimRaw(ev: EspnEvent, id: string): Json {
  const comp = firstCompetition(ev);
  const venue = venueOf(ev);
  const type = ev?.status?.type ?? comp?.status?.type ?? null;
  return {
    id,
    uid: typeof ev?.uid === "string" ? ev.uid : null,
    date: typeof ev?.date === "string" ? ev.date : null,
    competitionDate: typeof comp?.date === "string" ? comp.date : null,
    // Kept so a row that came out all-day can be explained from the stored payload alone.
    timeValid: typeof comp?.timeValid === "boolean" ? comp.timeValid : null,
    name: typeof ev?.name === "string" ? ev.name : null,
    shortName: typeof ev?.shortName === "string" ? ev.shortName : null,
    status: type ? { name: type.name ?? null, state: type.state ?? null, completed: type.completed ?? null } : null,
    venue: venue
      ? {
          fullName: venue.fullName ?? venue.name ?? null,
          city: venue.address?.city ?? null,
          state: venue.address?.state ?? null,
          country: venue.address?.country ?? null,
        }
      : null,
  };
}

/** One ESPN event → a catalog row, or the reason it was skipped. Never throws on a malformed entry. */
export function espnEventToRow(ev: EspnEvent, now: Date): { event: IngestEvent } | { reject: Reject } {
  if (!ev || typeof ev !== "object") return { reject: "no-id" };
  const id = typeof ev.id === "string" || typeof ev.id === "number" ? String(ev.id).trim() : "";
  if (!id) return { reject: "no-id" };
  const title = titleOf(ev);
  if (!title) return { reject: "no-title" };
  const when = toEventDate(rawDateOf(ev), firstCompetition(ev)?.timeValid);
  if (!when) return { reject: "bad-date" };
  const status = statusOf(ev);
  if (!status) return { reject: "status" };
  if (when.instant ? parseInstant(when.date) < now.getTime() : !isFutureOrFar(when.date, "day", now)) return { reject: "past" };

  const numbered = cardNumber(title) !== null;
  const { tags: ruleTags } = classify(title, CATEGORY);
  const tags = ["mma", "ufc", "sports", numbered ? "numbered-card" : "", isFightNight(title) ? "fight-night" : "", ...ruleTags].filter(Boolean);
  if (isFarFuture(when.date, tags, now)) return { reject: "far-future" };

  const location = locationOf(ev);
  const event = buildEvent({
    title,
    date: when.date,
    category: CATEGORY,
    tags,
    // A UFC card is watched wherever it is broadcast; the arena's country says where it is held,
    // not who it is for. It stays on `location`, and `regions` stays GLOBAL.
    regions: ["GLOBAL"],
    description: describeEvent(title, when, status, location),
    source: SOURCE,
    sourceUrl: sourceUrlOf(ev, id),
    sourceKey: `${SOURCE}:mma:${id}`,
    featured: false,
    popularity: popularityFor(title),
    allDay: !when.instant,
    datePrecision: when.instant ? "instant" : "day",
    status,
    confidence: when.instant ? CONFIDENCE_INSTANT : CONFIDENCE_DAY,
    // ESPN stamps are UTC; an all-day row has no zone to claim.
    timezone: when.instant ? "UTC" : null,
    externalIds: { espn_event: id },
    location,
    raw: trimRaw(ev, id),
  });
  event.jsonld_eligible = Boolean(location?.name && location?.city);
  return { event };
}

/**
 * All rows for one scoreboard response: tolerant extraction, per-event guards, dedupe by
 * `source_key`, cap. Rejections are counted and logged, so a shape change shows up as
 * "0 kept, no-title=42" rather than as an empty week.
 */
export function scoreboardToEvents(body: unknown, now: Date, log?: IngestLogger, label = "espn"): IngestEvent[] {
  const events = extractEvents(body);
  if (!events.length) {
    log?.warn(`${label}: no events found in the response — an empty window, or the payload shape moved`);
    return [];
  }
  const rejects: Partial<Record<Reject, number>> = {};
  const seen = new Set<string>();
  const rows: IngestEvent[] = [];
  for (const ev of events) {
    const result = espnEventToRow(ev, now);
    if ("reject" in result) {
      rejects[result.reject] = (rejects[result.reject] ?? 0) + 1;
      continue;
    }
    if (seen.has(result.event.source_key)) continue;
    seen.add(result.event.source_key);
    rows.push(result.event);
    if (rows.length >= MAX_ROWS_PER_UNIT) break;
  }
  const skipped = Object.entries(rejects)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  const line = `${label}: ${events.length} events → ${rows.length} kept${skipped ? ` · skipped ${skipped}` : ""}`;
  // Events found and none kept is the other way this source can go quiet: the page still parses,
  // every row is rejected for the same reason, and an info line would read like an ordinary pass.
  if (rows.length) log?.info(line);
  else log?.warn(`${line} — every event was rejected, so this pass upserts nothing`);
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Scraping the page
//
// Everything below until "Plan / run" is the unverified half of this file (see the docblock): three
// independent readings of the same HTML, each returning the `EspnEvent[]` the mapping layer above
// already understands, so a change of layer changes the log line and nothing else.

export type Strategy = "app-state" | "json-ld" | "markup";
export type Scrape = { strategy: Strategy | null; events: EspnEvent[] };

/**
 * Assignments that plausibly carry ESPN's embedded page state. `__espnfitt__` is the global ESPN
 * has used historically; the third pattern catches a rename of it (the likeliest drift, and free to
 * allow — a blob that parses but holds no event-shaped object costs one `JSON.parse`), the fourth a
 * move to a Next.js-style `__NEXT_DATA__` script. Every pattern ends AT the opening bracket — `{`
 * or `[`, because a state blob is not required to be an object — and the match end minus one is
 * where {@link balancedJson} starts.
 */
const STATE_ASSIGNMENTS: readonly RegExp[] = [
  /window\s*\[\s*(['"])__espnfitt__\1\s*\]\s*=\s*[{[]/g,
  /window\s*\.\s*__espnfitt__\s*=\s*[{[]/g,
  /window\s*\[\s*(['"])__[A-Za-z0-9_]+__\1\s*\]\s*=\s*[{[]/g,
  /<script[^>]+id\s*=\s*(['"])__NEXT_DATA__\1[^>]*>\s*[{[]/g,
];

/** A page state blob larger than this is not a page state blob; refusing it beats parsing 50 MB. */
export const MAX_STATE_BYTES = 8_000_000;

const CLOSER: Record<string, string> = { "{": "}", "[": "]" };

/**
 * The JSON literal starting at `open` — `{…}` or `[…]` — or null if it never closes (a truncated
 * page), closes in the wrong order (`{"a":1]`, which is not JSON however the braces count) or runs
 * past {@link MAX_STATE_BYTES}. Brackets are matched with a stack, and brackets inside a string
 * literal — `"}"`, `"{\"league\":\"ufc\"}"` — are not counted at all, which is the whole reason
 * this is a walk and not `/=\s*(\{[\s\S]*\})/`: ESPN's state is one line of a bundle and a greedy
 * match would take the rest of the file.
 */
export function balancedJson(src: string, open: number): string | null {
  const first = src[open];
  if (first !== "{" && first !== "[") return null;
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  const end = Math.min(src.length, open + MAX_STATE_BYTES);
  for (let i = open; i < end; i++) {
    const ch = src[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(CLOSER[ch]);
    else if (ch === "}" || ch === "]") {
      if (stack.pop() !== ch) return null;
      if (!stack.length) return src.slice(open, i + 1);
    }
  }
  return null;
}

/** Every balance-matched state blob in the page, in document order, deduped by offset. */
export function stateBlobs(html: string): string[] {
  const opens = new Set<number>();
  for (const re of STATE_ASSIGNMENTS) {
    re.lastIndex = 0;
    for (let m = re.exec(html); m; m = re.exec(html)) opens.add(m.index + m[0].length - 1);
  }
  const out: string[] = [];
  for (const open of [...opens].sort((a, b) => a - b)) {
    const json = balancedJson(html, open);
    if (json) out.push(json);
  }
  return out;
}

/** Strategy 1: the first state blob that parses AND holds event-shaped objects wins. */
export function eventsFromAppState(html: string): EspnEvent[] {
  for (const blob of stateBlobs(html)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(blob);
    } catch {
      continue; // an analytics blob, or a state that is not JSON: the next candidate may still be.
    }
    const events = extractEvents(parsed);
    if (events.length) return events;
  }
  return [];
}

const LD_SCRIPT = /<script[^>]*type\s*=\s*(['"])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi;
/** schema.org containers a page wraps its events in; each is followed one level further. */
const LD_CONTAINERS = ["@graph", "itemListElement", "item", "subEvent"] as const;
const LD_MAX_DEPTH = 6;

/** Every object inside the page's ld+json blocks, containers flattened. A malformed block is skipped. */
export function jsonLdNodes(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const push = (node: unknown, depth: number): void => {
    if (!node || depth > LD_MAX_DEPTH) return;
    if (Array.isArray(node)) {
      for (const child of node) push(child, depth + 1);
      return;
    }
    if (typeof node !== "object") return;
    const o = node as Record<string, unknown>;
    out.push(o);
    for (const key of LD_CONTAINERS) if (key in o) push(o[key], depth + 1);
  };
  LD_SCRIPT.lastIndex = 0;
  for (let m = LD_SCRIPT.exec(html); m; m = LD_SCRIPT.exec(html)) {
    const raw = m[2].trim().replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
    try {
      push(JSON.parse(raw), 0);
    } catch {
      // One broken block is not a reason to abandon the others.
    }
  }
  return out;
}

/** `SportsEvent`, `Event`, `ScreeningEvent`, … — `@type` may also be an array. */
export function isEventNode(node: Record<string, unknown>): boolean {
  const type = node["@type"];
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => typeof t === "string" && /event$/i.test(t.trim()));
}

/** schema.org `location` → the venue shape {@link locationOf} reads. A bare string becomes the name. */
function ldVenue(location: unknown): EspnVenue {
  if (typeof location === "string") return location.trim() ? { fullName: location.trim() } : null;
  if (!location || typeof location !== "object" || Array.isArray(location)) return null;
  const o = location as Record<string, unknown>;
  const address = o.address;
  const addr = address && typeof address === "object" && !Array.isArray(address) ? (address as Record<string, unknown>) : {};
  const country = addr.addressCountry;
  return {
    fullName: typeof o.name === "string" ? o.name : null,
    address: {
      city: typeof addr.addressLocality === "string" ? addr.addressLocality : null,
      state: typeof addr.addressRegion === "string" ? addr.addressRegion : null,
      // `addressCountry` is a Country node as often as a string.
      country:
        typeof country === "string"
          ? country
          : country && typeof country === "object" && typeof (country as { name?: unknown }).name === "string"
            ? (country as { name: string }).name
            : null,
    },
  };
}

/** schema.org `eventStatus` → the `status.type.name` strings {@link statusOf} already knows. */
function ldStatus(node: Record<string, unknown>): EspnStatus {
  const raw = typeof node.eventStatus === "string" ? node.eventStatus : "";
  if (/cancel/i.test(raw)) return { type: { name: "STATUS_CANCELED" } };
  if (/postpon/i.test(raw)) return { type: { name: "STATUS_POSTPONED" } };
  // Absent, `EventScheduled`, `EventRescheduled` (which has a new date and is simply scheduled).
  return null;
}

/** Id from a fightcenter/gamecast href — the one piece that keeps layers 2 and 3 keyed like layer 1. */
export function idFromHref(href: string): string | null {
  const m = /\/id\/(\d+)/.exec(String(href ?? ""));
  return m ? m[1] : null;
}

/** Fallback identity when ESPN links a card without an id: stable in name+day, marked `h` so it is recognisable. */
export function hashId(name: string, date: string): string {
  return `h${titleDigest(`${name}|${String(date).slice(0, 10)}`)}`;
}

export function absoluteEspnUrl(href: string): string {
  const s = String(href ?? "").trim();
  if (/^https?:\/\//i.test(s)) return s;
  // `//www.espn.com/…` is a URL with the scheme left out, not a path: joining it to the origin
  // would build `https://www.espn.com//www.espn.com/…`, which validates and points nowhere.
  if (s.startsWith("//")) return `https:${s}`;
  return `${ESPN_ORIGIN}${s.startsWith("/") ? "" : "/"}${s}`;
}

/**
 * schema.org `url`, which is a string in the common case and a node reference (`{"@id": …}`) or a
 * one-element array often enough to be worth reading: it is the only thing that keeps a layer-2 row
 * keyed on ESPN's own event id instead of on a hash, so losing it costs identity, not a field.
 */
function ldUrl(value: unknown): string {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first === "string") return first.trim();
  if (first && typeof first === "object") {
    const id = (first as { "@id"?: unknown })["@id"];
    if (typeof id === "string") return id.trim();
  }
  return "";
}

/**
 * One schema.org event → the {@link EspnEvent} the mapping layer understands. `startDate` is passed
 * through untouched, bare day or full instant: {@link toEventDate} is the one place that decides
 * what a stamp means.
 */
export function jsonLdToEspnEvent(node: Record<string, unknown>): EspnEvent | null {
  if (!isEventNode(node)) return null;
  const name = typeof node.name === "string" ? node.name.trim() : "";
  const date = typeof node.startDate === "string" ? node.startDate.trim() : "";
  if (!name || !date) return null;
  const url = ldUrl(node.url);
  const id = (url ? idFromHref(url) : null) ?? hashId(name, date);
  return {
    id,
    name,
    date,
    status: ldStatus(node),
    links: url ? [{ href: absoluteEspnUrl(url) }] : null,
    competitions: [{ id, date, venue: ldVenue(node.location) }],
  };
}

/** Strategy 2. */
export function eventsFromJsonLd(html: string): EspnEvent[] {
  const out: EspnEvent[] = [];
  const seen = new Set<string>();
  for (const node of jsonLdNodes(html)) {
    const ev = jsonLdToEspnEvent(node);
    if (!ev || seen.has(String(ev.id))) continue;
    seen.add(String(ev.id));
    out.push(ev);
  }
  return out;
}

const ROW_RE = /<tr\b[^>]*>[\s\S]*?<\/tr>/gi;
const CELL_RE = /<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi;
const ANCHOR_RE = /<a\b[^>]*href\s*=\s*(['"])([^'"]*)\1[^>]*>([\s\S]*?)<\/a>/gi;
const DATE_ATTR_RE = /\bdata-(?:date|utc-date|start-date|game-date)\s*=\s*(['"])([^'"]+)\1/i;
/** A row is only kept as a card if it links into `/mma/` or names itself like one. */
const EVENT_NAME_RE = /\bufc\b|fight\s*night|ultimate fighter|contender series|dana white/i;
const MIN_MARKUP_NAME = 4;
/** Month names → 1-12 by their first three letters ("Sept." and "September" both land on 9). */
const MONTH_BY_PREFIX = new Map(MONTHS.map((m, i): [string, number] => [m.slice(0, 3).toLowerCase(), i + 1]));
/** `<word> <1-2 digits>[, <year>]` — a month name only after {@link MONTH_BY_PREFIX} says so. */
const MONTH_DAY_RE = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:\s*,?\s+(\d{4}))?\b/g;
/** A table row dated inside this window before `now` still belongs to the current year, not the next. */
const MARKUP_BACKDATE_MS = 30 * 86_400_000;

/**
 * A date out of one table cell. An ISO stamp (from a `data-date` attribute, say) is returned as
 * written and left to {@link toEventDate}; "Sep 12" / "September 12, 2026" yields a bare day. The
 * schedule table prints no year, so an absent one is inferred from `now`: this year unless that day
 * is already more than a month past, in which case next year. The month lookup is what keeps
 * "UFC 349" from reading as a date — and because a cell may print the card before the date
 * ("UFC 349 · Sat, Oct 2"), EVERY `<word> <number>` in the cell is tried, not just the first: a
 * leading non-month match used to abandon the cell and lose a date that was right there.
 */
export function markupDate(text: string, now: Date): string | null {
  const s = decodeEntities(String(text ?? "")).replace(/\s+/g, " ").trim();
  const iso = /\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?/.exec(s);
  if (iso) return iso[0];
  const dayIn = (year: number, month: number, day: number): string | null => {
    const date = isoDate(year, month, day);
    const t = Date.parse(`${date}T00:00:00Z`);
    // Round-trip rejects "2026-02-30" and friends.
    return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== date ? null : date;
  };
  MONTH_DAY_RE.lastIndex = 0;
  for (let m = MONTH_DAY_RE.exec(s); m; m = MONTH_DAY_RE.exec(s)) {
    const month = MONTH_BY_PREFIX.get(m[1].slice(0, 3).toLowerCase());
    if (!month) continue;
    const day = Number(m[2]);
    if (m[3]) return dayIn(Number(m[3]), month, day);
    const thisYear = dayIn(now.getUTCFullYear(), month, day);
    if (thisYear && parseInstant(thisYear) >= now.getTime() - MARKUP_BACKDATE_MS) return thisYear;
    return dayIn(now.getUTCFullYear() + 1, month, day);
  }
  return null;
}

/**
 * One `<tr>` → an event, or null for a header, a promo or anything without both a name and a date.
 * Only a day is ever produced: see the docblock on why layer 3 refuses to read a time.
 */
export function markupRowToEvent(row: string, now: Date): EspnEvent | null {
  const cells = (row.match(CELL_RE) ?? []).map((c) => sanitizeTitle(c));
  if (!cells.length) return null;
  ANCHOR_RE.lastIndex = 0;
  const anchors = [...row.matchAll(ANCHOR_RE)].map((m) => ({ href: decodeEntities(m[2].trim()), text: sanitizeTitle(m[3]) }));
  const fightcenter = anchors.find((a) => /\/mma\/fightcenter\//i.test(a.href)) ?? null;
  const link = fightcenter ?? anchors.find((a) => /\/mma\//i.test(a.href)) ?? null;

  const attr = DATE_ATTR_RE.exec(row);
  const date = (attr && markupDate(attr[2], now)) || cells.map((c) => markupDate(c, now)).find((d) => d) || null;
  if (!date) return null;

  const linkName = link && link.text.length >= MIN_MARKUP_NAME ? link.text : "";
  const name = linkName || cells.find((c) => c.length >= MIN_MARKUP_NAME && EVENT_NAME_RE.test(c)) || "";
  if (!name) return null;
  // Evidence that this row is a card. A fightcenter link is conclusive; ANY OTHER /mma/ anchor is
  // not — a schedule page is full of them (rankings, video, a fighter profile in the same table) —
  // so a row without one has to read like a card, whether or not it happens to be linked.
  if (!fightcenter && !EVENT_NAME_RE.test(name)) return null;

  const id = (link ? idFromHref(link.href) : null) ?? hashId(name, date);
  return {
    id,
    name,
    date,
    links: link ? [{ href: absoluteEspnUrl(link.href) }] : null,
    competitions: [{ id, date }],
  };
}

/**
 * Strategy 3. One bad row costs one row: `decodeEntities` throws a RangeError on a numeric entity
 * outside Unicode (`&#x110000;`), and one of those anywhere in the page would otherwise take the
 * whole table down. {@link scrapeSchedule} would still catch it, but catching it there turns a
 * single unreadable cell into "this layer found nothing".
 */
export function eventsFromMarkup(html: string, now: Date): EspnEvent[] {
  const out: EspnEvent[] = [];
  const seen = new Set<string>();
  for (const row of html.match(ROW_RE) ?? []) {
    let ev: EspnEvent | null = null;
    try {
      ev = markupRowToEvent(row, now);
    } catch {
      continue;
    }
    if (!ev || seen.has(String(ev.id))) continue;
    seen.add(String(ev.id));
    out.push(ev);
  }
  return out;
}

export type StrategyImpl = { name: Strategy; extract: (html: string, now: Date) => EspnEvent[] };

export const STRATEGIES: readonly StrategyImpl[] = [
  { name: "app-state", extract: (html) => eventsFromAppState(html) },
  { name: "json-ld", extract: (html) => eventsFromJsonLd(html) },
  { name: "markup", extract: eventsFromMarkup },
];

/** Which markers the page carries — the whole diagnosis of a run that found nothing, in one line. */
export function markerReport(html: string): string {
  // `.test` on a /g regex advances its lastIndex, and these are module-level: reset on both sides
  // so a marker check can never change what a later `stateBlobs()` finds.
  const hasMarker = (re: RegExp): boolean => {
    re.lastIndex = 0;
    const hit = re.test(html);
    re.lastIndex = 0;
    return hit;
  };
  const anyState = STATE_ASSIGNMENTS.some(hasMarker);
  const yn = (present: boolean): string => (present ? "yes" : "no");
  return `app-state=${yn(anyState)} ld+json=${yn(/application\/ld\+json/i.test(html))} fightcenter-href=${yn(/\/mma\/fightcenter\//i.test(html))}`;
}

/**
 * The first strategy that yields anything, and its name. Logged at info level on every run —
 * that line is how anyone learns what ESPN actually served (docblock, "READING THE LOG"). A
 * strategy that throws is reported and the next one is tried: a regex surprise in one reading must
 * not cost the other two. `strategies` is a parameter only so that fall-through can be tested with
 * a reading that really does throw; production always passes {@link STRATEGIES}.
 */
export function scrapeSchedule(html: string, now: Date, log?: IngestLogger, label = "espn", strategies: readonly StrategyImpl[] = STRATEGIES): Scrape {
  const page = typeof html === "string" ? html : "";
  for (const { name, extract } of strategies) {
    let events: EspnEvent[] = [];
    try {
      events = extract(page, now);
    } catch (err) {
      log?.warn(`${label}: strategy ${name} threw (${(err as Error)?.message ?? String(err)}); falling through`);
      continue;
    }
    if (events.length) {
      log?.info(`${label}: strategy=${name} — ${events.length} events from ${page.length} bytes of HTML`);
      return { strategy: name, events };
    }
  }
  log?.warn(
    `${label}: strategy=none — no events in ${page.length} bytes of HTML · markers ${markerReport(page)} · ` +
      "ESPN may be serving a challenge page to our User-Agent, or the page shape moved",
  );
  return { strategy: null, events: [] };
}

// ---------------------------------------------------------------------------------------------
// Plan / run

export type EspnUnit = Unit & { url: string };

/** One page, one request, one unit per pass. */
export const SCHEDULE_UNIT_KEY = `${SOURCE}:mma:schedule`;

export type Cursor = { afterKey: string | null };

export function parseCursor(cursor: Json | null): Cursor {
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    const c = cursor as { afterKey?: unknown };
    if (typeof c.afterKey === "string" && c.afterKey.trim()) return { afterKey: c.afterKey.trim() };
  }
  return { afterKey: null };
}

/**
 * The schedule page is a single upcoming-events view — no windows, no `?dates=` to walk, so no
 * date-scoped variants are invented here: a URL shape this file is not confident of would cost a
 * 404 and the whole pass. The one unit is skipped only by a cursor that names it, i.e. by a pass
 * that already upserted it and died before `run.ts` could clear the cursor; a completed pass clears
 * it, so every pass re-fetches and rows stay fresh for `mark_stale_records`.
 */
export function planUnits(afterKey: string | null): EspnUnit[] {
  const unit: EspnUnit = {
    key: SCHEDULE_UNIT_KEY,
    label: "UFC schedule page",
    after: { afterKey: SCHEDULE_UNIT_KEY },
    url: SOURCE_URL,
  };
  return afterKey === unit.key ? [] : [unit];
}

export const adapter: Adapter<EspnUnit> = {
  id: SOURCE,
  label: "ESPN MMA schedule (UFC start times)",
  rank: 6,
  cadence: "daily",
  // Keyless: nothing to configure, so the source is always on.
  isConfigured: () => true,
  // One request a day. The timeout is generous because this is a full page, not a JSON envelope.
  limits: { concurrency: 1, minIntervalMs: 1500, timeoutMs: 25_000, maxRetries: 2 },

  async plan(cursor): Promise<Plan<EspnUnit>> {
    // No request here: there is exactly one page to read.
    return { units: planUnits(parseCursor(cursor).afterKey), done: true };
  },

  async run(unit, ctx: IngestContext) {
    // No headers: `ctx.http` attaches INGEST_USER_AGENT centrally and this adapter does not fight it.
    const html = await ctx.http.fetchText(unit.url);
    const { strategy, events } = scrapeSchedule(html, ctx.now, ctx.log, unit.label);
    return scoreboardToEvents(events, ctx.now, ctx.log, `${unit.label} [${strategy ?? "none"}]`);
  },
};
