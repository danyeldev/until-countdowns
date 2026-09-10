import type { Category } from "@/lib/types";
import { buildEvent, classify, isFarFuture, isFutureOrFar, parseInstant, sanitizeTitle } from "../normalize";
import type { Adapter, IngestContext, IngestEvent, IngestLogger, IngestStatus, Json, Plan, Unit } from "../types";

/**
 * UFC cards with a real start time, from ESPN's public MMA scoreboard
 * (`site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates=YYYYMMDD-YYYYMMDD`).
 *
 * Why this source exists: UFC cards already reach the catalog through `wikipedia-categories` →
 * Wikidata, which states them to DAY precision only ("UFC 320 — 3 October 2026"). A fight card is
 * one of the few things people actually count down to by the hour, and an all-day row makes the
 * countdown useless from about 24 hours out. ESPN publishes the broadcast start as a UTC instant
 * for every scheduled card, months ahead, without a key. That is the whole reason for the adapter:
 * time precision, not coverage.
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
 * Endpoint: `GET .../scoreboard?dates=YYYYMMDD-YYYYMMDD` — undocumented but long-stable, no key, no
 * quota published. `plan()` walks {@link WINDOW_COUNT} windows of {@link WINDOW_DAYS} days from
 * today (≈ a year ahead, four requests per pass); the UFC announces roughly six to nine months out,
 * so the far windows are usually empty and cost one request each. The cursor is the last window's
 * start day (`{ afterStart: "YYYYMMDD" }`), never an array index; a completed pass clears it
 * (`run.ts`), so every pass re-fetches the near windows and rows stay fresh for `mark_stale_records`.
 *
 * Shape tolerance is the point of the parser, not a nicety: this endpoint is undocumented, so the
 * exact nesting is not a contract. Events are collected by walking the body for any `events` array
 * whose members look like events ({@link extractEvents}), which finds both the flat
 * `{ events: [...] }` envelope and the `{ sports: [{ leagues: [{ events: [...] }] }] }` one ESPN
 * uses elsewhere; the date, venue and status are each accepted at more than one plausible path
 * (`event.date` or `competitions[0].date`, …); an entry that cannot yield an id, a title and a date
 * is skipped and counted, never thrown. A pass that finds nothing logs a warning rather than
 * silently reporting zero rows — a shape change must look like a shape change in
 * `/api/cron/status`, not like a quiet week in the UFC.
 *
 * Dates: ESPN stamps are UTC and often omit seconds ("2026-09-12T22:00Z"); they are normalised to a
 * full instant and passed with `timezone: "UTC"`. Three cases deliberately come out ALL-DAY
 * instead: a date with no time component at all; a competition ESPN itself flags `timeValid: false`
 * (its own way of saying "date yes, slot no"); and — as a backstop for a payload that omits that
 * flag — a date at exactly 00:00 UTC, the placeholder shape of an unset slot. A synthesised
 * midnight is worse than an all-day row: it renders a precise countdown to a time nobody claimed.
 * The cost of the backstop is that a genuine 00:00 UTC start (an 8 pm ET prelim slot) loses its
 * hour; it keeps the right day, and the next refresh restores the time if ESPN moves it a minute.
 *
 * Statuses: `STATUS_SCHEDULED` / `state: "pre"` → `scheduled`, `*CANCEL*` → `cancelled`,
 * `*POSTPON*` / `*DELAY*` → `postponed`, anything completed or in play (`state: "in" | "post"`,
 * `completed: true`, `STATUS_FINAL`) → dropped. An unrecognised status is treated as `scheduled`:
 * the row is a future date from a scheduled-events feed, and dropping it over an unknown enum
 * string is the failure mode this adapter exists to avoid. Past cards are dropped outright.
 *
 * Identity: `source_key = espn:mma:<event id>`, stable across runs and across a title change
 * (ESPN renames a card when a main event falls apart). Never `image_candidate_url`: ESPN's fighter
 * and event art is licensed press photography, not ours to store.
 *
 * Licence / terms: a schedule is a set of facts — "UFC 320 starts at 02:00 UTC on 3 October" is not
 * a creative work and is not copyrightable (README, "Licence policy"). ESPN's Terms of Use do
 * forbid scripted access to their services, and this adapter is scripted access; the project has
 * decided to accept that contractual risk deliberately for schedule facts, at one request per
 * window per day and with the `INGEST_USER_AGENT` contact string attached, and to drop the source
 * without argument if ESPN objects. That is a business judgement, not a claim that the endpoint is
 * unencumbered. No prose is copied (descriptions are our own sentences), no images are stored, and
 * `source_url` links every row back to its ESPN fightcenter page.
 *
 * Rejected alternatives: the UFC's own site (no public JSON; the schedule page is rendered
 * server-side and its terms are stricter), Sportradar / SportsDataIO MMA (enterprise pricing),
 * TheSportsDB free tier (non-commercial), Wikipedia/Wikidata (already ingested — day precision
 * only, which is the problem being solved), tapology.com (explicit anti-scraping terms).
 */

export const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard";
/** The source's homepage (`public.sources.homepage`); every row's own `source_url` comes from `links[]`. */
export const SOURCE_URL = "https://www.espn.com/mma/schedule/_/league/ufc";
const SOURCE = "espn" as const;
const CATEGORY: Category = "sports";

/** Days per scoreboard request. */
export const WINDOW_DAYS = 90;
/** Windows per pass: ≈ a year ahead, four requests. */
export const WINDOW_COUNT = 4;
/** A 90-day window holds ≈ 13 UFC cards; the cap only ever fires if the response shape surprises us. */
export const MAX_ROWS_PER_UNIT = 100;
/** `indexable` in `0009_indexable_summary.sql` needs `length(description) >= 80`. */
export const MIN_DESCRIPTION = 80;
const CONFIDENCE_INSTANT = 0.9;
const CONFIDENCE_DAY = 0.8;
/** Depth cap for the envelope walk (the deepest real path is `sports[].leagues[].events`). */
const MAX_DEPTH = 6;

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
  log?.info(`${label}: ${events.length} events → ${rows.length} kept${skipped ? ` · skipped ${skipped}` : ""}`);
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Plan / run

export type EspnWindow = { start: string; end: string };
export type EspnUnit = Unit & { window: EspnWindow };

export function yyyymmdd(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

/** {@link WINDOW_COUNT} consecutive, non-overlapping windows of {@link WINDOW_DAYS} days from today. */
export function windowsFor(now: Date): EspnWindow[] {
  const day0 = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  return Array.from({ length: WINDOW_COUNT }, (_, i) => ({
    start: yyyymmdd(addDays(day0, i * WINDOW_DAYS)),
    end: yyyymmdd(addDays(day0, (i + 1) * WINDOW_DAYS - 1)),
  }));
}

export function scoreboardUrl(w: EspnWindow): string {
  return `${ESPN_BASE}?dates=${w.start}-${w.end}`;
}

export type Cursor = { afterStart: string | null };

export function parseCursor(cursor: Json | null): Cursor {
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    const c = cursor as { afterStart?: unknown };
    if (typeof c.afterStart === "string" && /^\d{8}$/.test(c.afterStart)) return { afterStart: c.afterStart };
  }
  return { afterStart: null };
}

/**
 * The windows still to run: everything starting after `afterStart`. Windows are derived from `now`,
 * so a cursor left over from an earlier day is simply older than every window and the whole pass
 * runs again — which is what a daily source wants.
 */
export function planUnits(now: Date, afterStart: string | null): EspnUnit[] {
  return windowsFor(now)
    .filter((w) => !afterStart || w.start > afterStart)
    .map((w) => ({
      key: `${SOURCE}:mma:${w.start}-${w.end}`,
      label: `UFC scoreboard ${w.start}–${w.end}`,
      after: { afterStart: w.start },
      window: w,
    }));
}

export const adapter: Adapter<EspnUnit> = {
  id: SOURCE,
  label: "ESPN MMA scoreboard (UFC start times)",
  rank: 6,
  cadence: "daily",
  // Keyless: nothing to configure, so the source is always on.
  isConfigured: () => true,
  // No published quota. Four small requests a day, spaced politely, retried twice.
  limits: { concurrency: 1, minIntervalMs: 1500, timeoutMs: 20_000, maxRetries: 2 },

  async plan(cursor, ctx): Promise<Plan<EspnUnit>> {
    // No request here: the windows are pure arithmetic on `ctx.now`.
    return { units: planUnits(ctx.now, parseCursor(cursor).afterStart), done: true };
  },

  async run(unit, ctx: IngestContext) {
    const body = await ctx.http.fetchJson<unknown>(scoreboardUrl(unit.window));
    return scoreboardToEvents(body, ctx.now, ctx.log, unit.label);
  },
};
