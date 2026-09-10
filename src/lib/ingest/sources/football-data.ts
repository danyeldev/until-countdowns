import type { Category } from "@/lib/types";
import { HttpError, isBudgetExceeded } from "../http";
import { buildEvent, classify, isFarFuture, isFutureOrFar, parseInstant, sanitizeTitle } from "../normalize";
import type { Adapter, IngestContext, IngestEvent, IngestStatus, Json, Plan, Unit } from "../types";
import { labelYearConsistent } from "./wikidata/common";

/**
 * Marquee football fixtures from football-data.org v4 (free tier, https://www.football-data.org/).
 *
 * Coverage: the 12 free-tier competitions (`PL BL1 SA PD FL1 DED PPL ELC CL EC WC BSA`), current
 * season only — the API is season-bounded, so a 2030 World Cup arrives via Wikidata/Wikipedia
 * until football-data opens that season. Kept per competition: cups (`WC`, `EC`, `CL`) → the
 * final, the semi-finals, the quarter-finals and the main phase's first match ("opening match":
 * earliest `LEAGUE_STAGE` / `GROUP_STAGE` / `REGULAR_SEASON` match, so CL qualifiers never become
 * the opener; when the published season has no main-phase match at all — a tournament between
 * editions, only qualifiers listed — no opener is emitted rather than mislabelling a qualifying
 * tie); domestic leagues → the season's first kick-off only. Knockout ties whose teams are still
 * undecided are collapsed to one row per stage (two-legged ties would otherwise be counted as
 * separate "quarter-final 5…8" fixtures); once the draw is made each leg is titled "A v B
 * (quarter-final)" and stands on its own. ≈ 40–60 rows per full pass. Category `sports`.
 *
 * Endpoints:
 *   GET /v4/competitions                         — tokenless catalogue (189 competitions) with each
 *                                                  competition's `currentSeason`; read by `plan()`
 *                                                  to skip the fixed-window tournaments (`WC`, `EC`)
 *                                                  whose season already ended, falling back to all
 *                                                  12 codes when the call fails. Other codes are
 *                                                  never skipped: the CL catalogue `currentSeason`
 *                                                  was observed to cover the league phase only
 *                                                  (endDate 2027-01-27), and skipping on it would
 *                                                  hide the knockout rounds for months.
 *   GET /v4/competitions/{code}/matches          — `X-Auth-Token: $FOOTBALL_DATA_API_KEY` required
 *                                                  (403 without it). Fetched WITHOUT a `status`
 *                                                  filter: the opener is the season's earliest
 *                                                  match whatever its status, and `POSTPONED` /
 *                                                  `CANCELLED` must come through in the same call
 *                                                  (a comma-separated `status` list is not
 *                                                  documented). Statuses are filtered locally.
 *                                                  A 403/404 for one competition (no fetchable
 *                                                  season on this plan) completes the unit empty
 *                                                  instead of failing it — three failed units in a
 *                                                  row would put the whole source into backoff.
 *                                                  Any other error is retried once as
 *                                                  `?status=SCHEDULED` (the documented shape) in
 *                                                  case a plan rejects the whole-season request;
 *                                                  that shape hides postponed/cancelled rows and
 *                                                  can misplace the opener, so it is a fallback
 *                                                  only and is logged when used.
 *
 * Quota: free tier 10 requests/minute → `minIntervalMs: 7000`, one request per unit, one unit per
 * competition (catalogue + ≤ 12 codes ≈ 90 s per pass). AFC/CAF/CONMEBOL matches are paywalled
 * (403) and are never requested.
 *
 * Dates: `TIMED` = kick-off confirmed → instant (`utcDate`, `timezone: 'UTC'`); `SCHEDULED` =
 * date known, time not confirmed → day precision (`utcDate.slice(0, 10)`). `POSTPONED` /
 * `SUSPENDED` → `postponed`, `CANCELLED` → `cancelled`; `FINISHED`, `AWARDED`, `IN_PLAY`,
 * `PAUSED` and any match whose kick-off is in the past are dropped.
 *
 * Identity: `source_key = football-data:match:<id>` — titles change when an undecided tie
 * ("UEFA Champions League semi-final") becomes a real fixture ("A v B (semi-final)"), the match id
 * does not. Finals are
 * always titled "<competition> final" so their slug never drifts. The cursor is the last
 * competition code completed (`{ afterCode }`), never an array index.
 *
 * Licence: terms are silent on caching/commercial use — written permission from
 * football-data.org is pending (brief §14); docs ask for attribution, stored on `public.sources`
 * ("Football data provided by football-data.org"). Crests/emblems are trademarks: no
 * `image_candidate_url`, ever. Rejected alternatives (brief §20): ESPN site API (ToU bans scripts
 * and commercial use), TheSportsDB free tier (non-commercial), fixturedownload.com (no storage),
 * Sportradar/Stats Perform/SportsDataIO (enterprise), jolpica-f1 (CC BY-NC-SA).
 */

export const FD_BASE = "https://api.football-data.org/v4";
export const SOURCE_URL = "https://www.football-data.org/";
const SOURCE = "football-data" as const;
const CATEGORY: Category = "sports";
/** Rows kept per competition (brief: cap 100 per run; one unit is one competition). */
export const MAX_ROWS_PER_UNIT = 100;

export type Competition = { code: string; regions: string[]; cup: boolean };

/** The free-tier competitions, in unit order (cups first: they carry the marquee rows). */
export const COMPETITIONS: readonly Competition[] = [
  { code: "WC", regions: ["GLOBAL"], cup: true },
  { code: "EC", regions: ["GLOBAL"], cup: true },
  { code: "CL", regions: ["GLOBAL"], cup: true },
  { code: "PL", regions: ["GB"], cup: false },
  { code: "ELC", regions: ["GB"], cup: false },
  { code: "BL1", regions: ["DE"], cup: false },
  { code: "SA", regions: ["IT"], cup: false },
  { code: "PD", regions: ["ES"], cup: false },
  { code: "FL1", regions: ["FR"], cup: false },
  { code: "DED", regions: ["NL"], cup: false },
  { code: "PPL", regions: ["PT"], cup: false },
  { code: "BSA", regions: ["BR"], cup: false },
];

const BY_CODE = new Map(COMPETITIONS.map((c) => [c.code, c]));
export const KNOCKOUT_STAGES = new Set(["FINAL", "SEMI_FINALS", "QUARTER_FINALS"]);
/** Stages whose earliest match is a competition's "opening match" (qualifiers/play-offs are not). */
export const MAIN_PHASE_STAGES = new Set(["LEAGUE_STAGE", "GROUP_STAGE", "REGULAR_SEASON"]);
/** Fixed-window tournaments that `plan()` may skip once the catalogue says the season is over. */
export const SKIPPABLE = new Set(["WC", "EC"]);

const STAGE_LABELS: Record<string, string> = {
  FINAL: "final",
  SEMI_FINALS: "semi-final",
  QUARTER_FINALS: "quarter-final",
  THIRD_PLACE: "third-place play-off",
  ROUND_OF_16: "round of 16",
  LAST_16: "round of 16",
  LAST_32: "round of 32",
  LAST_64: "round of 64",
  PLAYOFFS: "play-off",
  PLAYOFF_ROUND: "play-off round",
  GROUP_STAGE: "group stage",
  LEAGUE_STAGE: "league phase",
  REGULAR_SEASON: "regular season",
  PRELIMINARY_ROUND: "preliminary round",
  QUALIFICATION: "qualification",
};

// ---------------------------------------------------------------------------------------------
// Upstream shapes (the subset read here)

export type FdTeam = { id?: number | null; name?: string | null; shortName?: string | null; tla?: string | null; crest?: string | null } | null;
export type FdSeason = { id?: number; startDate?: string | null; endDate?: string | null; currentMatchday?: number | null } | null;
export type FdMatch = {
  id: number;
  utcDate?: string | null;
  status?: string | null;
  matchday?: number | null;
  stage?: string | null;
  group?: string | null;
  lastUpdated?: string | null;
  homeTeam?: FdTeam;
  awayTeam?: FdTeam;
  competition?: { id?: number; name?: string | null; code?: string | null; emblem?: string | null } | null;
  season?: FdSeason;
  area?: { id?: number; name?: string | null; code?: string | null } | null;
  /** Not seen on the free tier; accepted as a name or a `{ name, city }` object when present. */
  venue?: string | { name?: string | null; city?: string | null } | null;
};
export type FdMatchesResponse = {
  filters?: Record<string, unknown>;
  resultSet?: { count?: number; first?: string; last?: string; played?: number };
  competition?: { id?: number; name?: string | null; code?: string | null };
  matches?: FdMatch[];
};
export type FdCompetition = { id?: number; code?: string | null; name?: string | null; currentSeason?: FdSeason };
export type FdCompetitionsResponse = { count?: number; competitions?: FdCompetition[] };

// ---------------------------------------------------------------------------------------------
// Pure helpers

export function apiKey(): string {
  return (process.env.FOOTBALL_DATA_API_KEY ?? "").trim();
}

export function authHeaders(): Record<string, string> {
  const key = apiKey();
  return key ? { "X-Auth-Token": key } : {};
}

export function matchesUrl(code: string): string {
  return `${FD_BASE}/competitions/${encodeURIComponent(code)}/matches`;
}

export function stageLabel(stage: string | null | undefined): string {
  const s = String(stage ?? "").toUpperCase();
  return STAGE_LABELS[s] ?? s.toLowerCase().replace(/_/g, " ");
}

/** "2026–27" for a season spanning two years, "2026" for a single-year one; "" when unknown. */
export function seasonLabel(season: FdSeason): string {
  const start = String(season?.startDate ?? "").slice(0, 4);
  const end = String(season?.endDate ?? "").slice(0, 4);
  if (!/^\d{4}$/.test(start)) return "";
  if (!/^\d{4}$/.test(end) || end === start) return start;
  return `${start}–${end.slice(2)}`;
}

/**
 * A team's display name, or null when the fixture is still a placeholder. Keyed off the name, not
 * `id`: football-data sends `{ id: null, name: null }` for an undecided side, while a reduced
 * free-tier payload might carry a name without an id — that is a real team.
 */
export function teamName(team: FdTeam): string | null {
  const name = sanitizeTitle(String(team?.shortName || team?.name || ""));
  return name || null;
}

/** A knockout match whose teams are not both known yet. */
export function isPlaceholder(m: FdMatch): boolean {
  return !teamName(m.homeTeam ?? null) || !teamName(m.awayTeam ?? null);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatDay(iso: string): string {
  const d = new Date(parseInstant(iso));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatKickoff(iso: string): string {
  const d = new Date(parseInstant(iso));
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${formatDay(iso)} at ${hh}:${mm} UTC`;
}

export function matchStatus(status: string | null | undefined): IngestStatus | null {
  switch (String(status ?? "").toUpperCase()) {
    case "SCHEDULED":
    case "TIMED":
      return "scheduled";
    case "POSTPONED":
    case "SUSPENDED":
      return "postponed";
    case "CANCELLED":
      return "cancelled";
    default:
      return null; // FINISHED, AWARDED, IN_PLAY, PAUSED, unknown
  }
}

export type Kind = "final" | "semi" | "quarter" | "opener";

export function popularityFor(code: string, kind: Kind): number {
  if (kind === "final") return code === "WC" ? 90 : code === "EC" ? 80 : code === "CL" ? 75 : 60;
  if (kind === "semi") return 55;
  if (kind === "quarter") return 45;
  if (code === "WC" || code === "EC") return 60;
  if (code === "CL") return 40;
  return 35;
}

export function kindFor(stage: string | null | undefined): Exclude<Kind, "opener"> | null {
  switch (String(stage ?? "").toUpperCase()) {
    case "FINAL":
      return "final";
    case "SEMI_FINALS":
      return "semi";
    case "QUARTER_FINALS":
      return "quarter";
    default:
      return null;
  }
}

function byKickoff(a: FdMatch, b: FdMatch): number {
  const ta = String(a.utcDate ?? "");
  const tb = String(b.utcDate ?? "");
  return ta < tb ? -1 : ta > tb ? 1 : a.id - b.id;
}

function validDate(iso: unknown): iso is string {
  return typeof iso === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso) && !Number.isNaN(Date.parse(iso));
}

/**
 * Which matches of a competition's season are kept, with their kind. The opener is the earliest
 * main-phase match (`MAIN_PHASE_STAGES`) whatever its status (it is then dropped as past like any
 * other row); a season with no main-phase match yet — WC/EC listing only qualifying ties — gets no
 * opener, because a qualifier is not the tournament's opening match. For cups every knockout leg
 * with both teams known is kept; undecided legs collapse to the earliest one per stage, since a
 * two-legged tie publishes two placeholder rows for the same fixture.
 */
export function selectMatches(matches: FdMatch[], comp: Competition): Array<{ match: FdMatch; kind: Kind }> {
  const valid = matches.filter((m) => m && Number.isInteger(m.id) && validDate(m.utcDate)).sort(byKickoff);
  if (!valid.length) return [];
  const out: Array<{ match: FdMatch; kind: Kind }> = [];
  const opener = valid.find((m) => MAIN_PHASE_STAGES.has(String(m.stage ?? "").toUpperCase())) ?? null;
  if (opener) out.push({ match: opener, kind: "opener" });
  if (!comp.cup) return out;
  const undecided = new Set<string>();
  for (const m of valid) {
    if (opener && m.id === opener.id) continue;
    const kind = kindFor(m.stage);
    if (!kind) continue;
    if (isPlaceholder(m)) {
      const stage = String(m.stage).toUpperCase();
      if (undecided.has(stage)) continue;
      undecided.add(stage);
    }
    out.push({ match: m, kind });
  }
  return out;
}

export function titleFor(m: FdMatch, kind: Kind): string {
  const competition = sanitizeTitle(String(m.competition?.name ?? "")) || "Football";
  if (kind === "opener") {
    const season = seasonLabel(m.season ?? null);
    return `${competition}${season ? ` ${season}` : ""} opening match`;
  }
  if (kind === "final") return `${competition} final`;
  const label = stageLabel(m.stage);
  const home = teamName(m.homeTeam ?? null);
  const away = teamName(m.awayTeam ?? null);
  // Undecided ties are never numbered: the ordinal would count legs, not ties.
  return home && away ? `${home} v ${away} (${label})` : `${competition} ${label}`;
}

export function describeMatch(m: FdMatch, kind: Kind, status: string, comp: Competition): string {
  const competition = sanitizeTitle(String(m.competition?.name ?? "")) || "the competition";
  const season = seasonLabel(m.season ?? null);
  const what = kind === "opener" ? "Opening match" : stageLabel(m.stage).replace(/^\w/, (c) => c.toUpperCase());
  const first = `${what} of the ${season ? `${season} ` : ""}${competition}${kind === "opener" && !comp.cup ? " season" : ""}.`;
  const home = teamName(m.homeTeam ?? null);
  const away = teamName(m.awayTeam ?? null);
  const teams = home && away ? `, ${home} against ${away}` : "";
  const iso = String(m.utcDate);
  let when: string;
  if (status === "TIMED") when = `Kick-off ${formatKickoff(iso)}${teams}.`;
  else if (status === "SCHEDULED") when = `Scheduled for ${formatDay(iso)}${teams}; the kick-off time has not been confirmed.`;
  else if (status === "CANCELLED") when = `Originally set for ${formatDay(iso)}${teams}; the match has been cancelled.`;
  else when = `Originally set for ${formatDay(iso)}${teams}; the match has been postponed and a new date is awaited.`;
  const tail = !home || !away ? " The teams have not been decided yet." : "";
  return `${first} ${when}${tail}`;
}

function locationFor(m: FdMatch): Record<string, unknown> | null {
  const v = m.venue;
  if (!v) return null;
  if (typeof v === "string") {
    const name = sanitizeTitle(v);
    return name ? { name } : null;
  }
  const name = sanitizeTitle(String(v.name ?? ""));
  if (!name) return null;
  const city = sanitizeTitle(String(v.city ?? ""));
  return city ? { name, city } : { name };
}

function trimRaw(m: FdMatch): Json {
  const team = (t: FdTeam) => (t ? { id: t.id ?? null, name: t.name ?? null, shortName: t.shortName ?? null, tla: t.tla ?? null } : null);
  return {
    id: m.id,
    utcDate: m.utcDate ?? null,
    status: m.status ?? null,
    matchday: m.matchday ?? null,
    stage: m.stage ?? null,
    group: m.group ?? null,
    lastUpdated: m.lastUpdated ?? null,
    homeTeam: team(m.homeTeam ?? null),
    awayTeam: team(m.awayTeam ?? null),
    competition: m.competition ? { id: m.competition.id ?? null, name: m.competition.name ?? null, code: m.competition.code ?? null } : null,
    season: m.season ? { id: m.season.id ?? null, startDate: m.season.startDate ?? null, endDate: m.season.endDate ?? null } : null,
    area: m.area ? { name: m.area.name ?? null, code: m.area.code ?? null } : null,
    venue: typeof m.venue === "string" ? m.venue : m.venue ? { name: m.venue.name ?? null, city: m.venue.city ?? null } : null,
  };
}

/** One selected match → event row, or null when a guard rejects it. */
export function matchToEvent(m: FdMatch, kind: Kind, comp: Competition, now: Date): IngestEvent | null {
  if (!Number.isInteger(m.id) || !validDate(m.utcDate)) return null;
  const upstream = String(m.status ?? "").toUpperCase();
  const status = matchStatus(upstream);
  if (!status) return null;
  const timed = upstream === "TIMED" || upstream === "POSTPONED" || upstream === "SUSPENDED" || upstream === "CANCELLED";
  // TIMED keeps the confirmed instant; SCHEDULED (time unconfirmed) is a day. Postponed/cancelled
  // rows keep whatever precision the last known kick-off had.
  const hasTime = !/T00:00:00(\.0+)?Z$/.test(m.utcDate) || upstream === "TIMED";
  const instant = timed && hasTime;
  const date = instant ? m.utcDate : m.utcDate.slice(0, 10);
  if (instant ? parseInstant(date) < now.getTime() : !isFutureOrFar(date, "day", now)) return null;
  const title = titleFor(m, kind);
  if (!title || !labelYearConsistent(title, Number(date.slice(0, 4)))) return null;
  const code = String(m.competition?.code ?? comp.code).toUpperCase();
  const { tags: ruleTags } = classify(String(m.competition?.name ?? ""), CATEGORY);
  const tags = ["football", "soccer", "sports", code.toLowerCase(), String(m.stage ?? "").toLowerCase(), kind === "opener" ? "season-opener" : "knockout", ...ruleTags];
  if (isFarFuture(date, tags, now)) return null; // upstream placeholder dates
  const featured = kind === "final" && (code === "WC" || code === "EC");
  const location = locationFor(m);
  const row = buildEvent({
    title,
    date,
    category: CATEGORY,
    tags,
    regions: comp.regions,
    description: describeMatch(m, kind, upstream, comp),
    source: SOURCE,
    sourceUrl: SOURCE_URL,
    sourceKey: `${SOURCE}:match:${m.id}`,
    featured,
    popularity: popularityFor(code, kind),
    datePrecision: instant ? "instant" : "day",
    status,
    confidence: 0.9,
    timezone: instant ? "UTC" : null,
    externalIds: {
      football_data_match: m.id,
      ...(Number.isInteger(m.competition?.id) ? { football_data_competition: m.competition!.id } : {}),
      ...(Number.isInteger(m.season?.id) ? { football_data_season: m.season!.id } : {}),
    },
    location,
    raw: trimRaw(m),
  });
  row.jsonld_eligible = Boolean(location);
  return row;
}

/** All rows for one competition's season response: selection, guards, dedupe by source_key, cap. */
export function matchesToEvents(matches: FdMatch[], comp: Competition, now: Date, log?: IngestContext["log"]): IngestEvent[] {
  const seen = new Set<string>();
  const rows: IngestEvent[] = [];
  let dropped = 0;
  for (const { match, kind } of selectMatches(matches, comp)) {
    const ev = matchToEvent(match, kind, comp, now);
    if (!ev) {
      dropped++;
      continue;
    }
    if (seen.has(ev.source_key)) continue;
    seen.add(ev.source_key);
    rows.push(ev);
    if (rows.length >= MAX_ROWS_PER_UNIT) break;
  }
  if (dropped) log?.info(`${comp.code}: ${dropped} selected match(es) dropped (past, finished or in play)`);
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Plan / run

export type Cursor = { afterCode: string | null };
export type FdUnit = Unit & { code: string };

export function parseCursor(cursor: Json | null): Cursor {
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    const c = cursor as { afterCode?: unknown };
    if (typeof c.afterCode === "string" && BY_CODE.has(c.afterCode)) return { afterCode: c.afterCode };
  }
  return { afterCode: null };
}

/** Codes still to run: everything after `afterCode` in COMPETITIONS order, minus `skip`. */
export function planUnits(afterCode: string | null, skip: ReadonlySet<string> = new Set()): FdUnit[] {
  const start = afterCode ? COMPETITIONS.findIndex((c) => c.code === afterCode) + 1 : 0;
  return COMPETITIONS.slice(start)
    .filter((c) => !skip.has(c.code))
    .map((c) => ({ key: `football-data:${c.code}`, label: `${c.code} matches`, after: { afterCode: c.code }, code: c.code }));
}

/**
 * `SKIPPABLE` codes whose `currentSeason` in the tokenless catalogue ended more than two days ago
 * (nothing left to count down to: WC/EC between tournaments). Every other code always runs — the
 * catalogue's `currentSeason` for a club competition may cover only its opening phase, so its
 * endDate says nothing about the knockout rounds. Unknown or missing seasons are not skipped.
 */
export function endedCodes(catalogue: FdCompetitionsResponse | null | undefined, now: Date): Set<string> {
  const skip = new Set<string>();
  for (const c of catalogue?.competitions ?? []) {
    const code = String(c?.code ?? "").toUpperCase();
    if (!SKIPPABLE.has(code)) continue;
    const end = String(c.currentSeason?.endDate ?? "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(end) && !isFutureOrFar(end, "day", now)) skip.add(code);
  }
  return skip;
}

/**
 * One competition's season, or null when this plan has no fetchable season for it. A 403/404 is a
 * missing competition, not a broken run: WC and EC lead the unit order and are exactly the codes
 * most likely to 404, and three consecutive failed units would put the whole source into
 * exponential backoff and take the healthy league units with it. Any other error is retried once
 * with the documented `?status=SCHEDULED` shape before it propagates.
 */
export async function fetchSeason(code: string, ctx: IngestContext): Promise<FdMatchesResponse | null> {
  const url = matchesUrl(code);
  try {
    return await ctx.http.fetchJson<FdMatchesResponse>(url, { headers: authHeaders() });
  } catch (err) {
    if (err instanceof HttpError && (err.status === 403 || err.status === 404)) {
      ctx.log.warn(`${code}: HTTP ${err.status} from football-data — no fetchable season on this plan; unit completed empty`);
      return null;
    }
    if (isBudgetExceeded(err)) throw err;
    ctx.log.warn(`${code}: whole-season request failed (${(err as Error)?.message ?? err}); retrying with ?status=SCHEDULED`);
    const res = await ctx.http.fetchJson<FdMatchesResponse>(`${url}?status=SCHEDULED`, { headers: authHeaders() });
    ctx.log.info(`${code}: ?status=SCHEDULED fallback succeeded (postponed/cancelled rows and a pre-season opener may be missing)`);
    return res;
  }
}

export const adapter: Adapter<FdUnit> = {
  id: SOURCE,
  label: "football-data.org v4 (free tier)",
  rank: 6,
  cadence: "daily",
  isConfigured: () => apiKey().length > 0,
  // Free tier: 10 requests/minute; one request per unit at 7 s spacing.
  limits: { concurrency: 1, minIntervalMs: 7000, timeoutMs: 20_000, maxRetries: 2 },

  async plan(cursor, ctx): Promise<Plan<FdUnit>> {
    const { afterCode } = parseCursor(cursor);
    let skip = new Set<string>();
    try {
      const catalogue = await ctx.http.fetchJson<FdCompetitionsResponse>(`${FD_BASE}/competitions`);
      skip = endedCodes(catalogue, ctx.now);
      if (skip.size) ctx.log.info(`season over, skipped: ${[...skip].join(", ")}`);
    } catch (err) {
      ctx.log.warn(`competitions catalogue unavailable (${(err as Error)?.message ?? err}); running all codes`);
    }
    return { units: planUnits(afterCode, skip), done: true };
  },

  async run(unit, ctx) {
    const comp = BY_CODE.get(unit.code);
    if (!comp) throw new Error(`unknown competition code ${unit.code}`);
    const res = await fetchSeason(comp.code, ctx);
    const matches = Array.isArray(res?.matches) ? res.matches : [];
    const rows = matchesToEvents(matches, comp, ctx.now, ctx.log);
    ctx.log.info(`${unit.label}: ${matches.length} matches in season, ${rows.length} kept`);
    return rows;
  },
};
