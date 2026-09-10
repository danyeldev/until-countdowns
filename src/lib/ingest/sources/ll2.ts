import type { Category } from "@/lib/types";
import { BudgetExceededError, HttpError, isBudgetExceeded } from "../http";
import { buildEvent, clamp, isFarFuture, isFutureOrFar, sanitizeTitle, slugify } from "../normalize";
import type { Adapter, IngestContext, IngestEvent, IngestPrecision, IngestStatus, Json, Plan, Unit } from "../types";

/**
 * Rocket launches and space events from Launch Library 2 (The Space Devs, https://thespacedevs.com/llapi).
 *
 * Coverage: every upcoming launch (≈ 360; about half at year precision, a few percent with a real
 * T-0) and every upcoming space event — dockings, EVAs, flybys, orbit insertions, landings (≈ 30,
 * reaching 2035). Category `space`.
 *
 * Endpoints (2.3.0, `mode=detailed` so `updates[]`, `vid_urls[]`, `program[]`, `mission` and the pad
 * country come in one call):
 *   GET /launches/upcoming/?limit=100&mode=detailed&offset=N   (4 pages for ≈ 360 launches)
 *   GET /events/upcoming/?limit=100&mode=detailed&offset=N     (1 page)
 *   GET /api-throttle/   → { your_request_limit, limit_frequency_secs, current_use, next_use_secs }
 *                          (does not count against the quota; its `ident` field is the caller's IP
 *                          and is never logged or stored)
 *
 * Quota: **15 requests per hour per IP** unauthenticated, shared by everything behind the same
 * egress; exceeding it locks the IP out for the rest of the hour. Hence `maxRetries: 0` (a 429 is
 * never retried), 3 s spacing, one unit = one request, and a free `api-throttle` check at the top
 * of every `run()`: when the hour has no slot left, run() throws a BUDGET-shaped error *before* any
 * page request, which the runner classifies as `budget` — the pass ends `partial`, the cursor is
 * kept, `consecutive_failures` is reset and no backoff is applied. A quota stop is an expected
 * pause, not an outage; the next cron (6-hourly) resumes exactly where it stopped. `LL2_API_TOKEN`
 * (optional, `Authorization: Token …`, Patreon-backed) raises the per-key limit; the throttle
 * response's own `your_request_limit` is used, never a hard-coded 15. `lldev.thespacedevs.com` is
 * unthrottled but stale — never use it.
 *
 * Operator notes:
 *  - `cadence: "daily"` although the cron is 6-hourly: a full pass may legitimately take several
 *    crons on the anonymous quota, and housekeeping reports STALE after 2× the cadence (48 h ≈ 8
 *    missed crons), which is the right alarm threshold here.
 *  - A quota stop shows in /api/cron/status as `partial` (reason `budget`), never as an `error`
 *    with backoff. Only real failures — a 429 lock-out, timeouts, three consecutive unit failures —
 *    reach the runner's error/backoff path. Setting `LL2_API_TOKEN` makes quota stops rare.
 *  - Any request that does get a 429 puts the process in a 60 s lock-out (`lockedOutUntil`), so the
 *    runner's second unit attempt (`UNIT_ATTEMPTS = 2`) short-circuits without spending another
 *    request on an exhausted bucket, as the brief requires ("never retry on 429").
 *  - A page whose run() fails (429, timeout) keeps the SAME cursor, so the next run retries it
 *    instead of skipping ≈ 100 launches; a persistently failing page is bounded by the runner's
 *    three-consecutive-failures rule. A page that repeatedly eats the WHOLE budget would otherwise
 *    stall the pass for ever (the runner's anti-stall rule persists `after` verbatim), so the
 *    cursor carries `tries` and such a page is stepped over after MAX_STALL_TRIES attempts.
 *  - Offset pagination over a live list ordered by `net` is an accepted trade-off (agreed in
 *    review): launches that fly or are re-dated between page fetches shift page boundaries, so a
 *    row can occasionally be skipped (then marked tentative by the stale sweep until the next pass,
 *    which only flips `scheduled` → `tentative`) or fetched twice (deduped within a unit, and
 *    idempotent across units through the upsert). Rare inside one run; possible for a handful of
 *    rows when a pass is split across crons. A content-addressed `net__gte=<last net seen>` window
 *    was considered and rejected: coarse-precision rows share identical `net` values (every "Year"
 *    launch of a year sits on 31 December), so a `net__gte` window cannot guarantee forward
 *    progress once more than `limit` rows share one timestamp.
 *  - `timeoutMs` is 60 s (brief: 30 s): a detailed page is ≈ 3 MB with an 8–30 s time-to-first-byte.
 *  - Space events use `external_ids.ll2_event` (integer id) instead of `ll2` so they never collide
 *    with a launch uuid under the same key.
 *  - `timezone` is "UTC" only for instants; day-precision (all-day) rows and coarser placeholders
 *    carry null, matching the catalog convention for per-viewer local dates (as football-data does).
 *
 * Coarse dates: LL2 stores `net` at the END of the period ("Month" → the 30th/31st, "Year" →
 * 31 December). Rows store the FIRST day of the period as the catalog convention requires
 * (`YYYY-MM-01`, `YYYY-01-01`, first month of a quarter) and keep the original in `raw.net`.
 * `net_precision.name` is `Second|Minute|Hour|Day|Month|Quarter N|Year Half N|Year|Decade`; the
 * catalog has no half-year precision, so "Year Half N" is stored at `year` precision — the
 * description still says "in the second half of 2027". "Hour" is an instant (the NET is a real
 * timestamp) but the wording says "around 09:00 UTC" and never "go for that time", and the
 * confidence is 0.8 instead of 0.9.
 *
 * Licence (TSD FAQ, https://github.com/TheSpaceDevs/Tutorials/blob/main/faqs/faq_LL2.md, read
 * 2026-09-09): the data is free to use "in any way, shape, or form"; caching is "heavily
 * encouraged"; users should "refrain from forwarding it without adding value"; attribution is
 * "not mandatory, but encouraged" → `public.sources.attribution = "Launch data: The Space Devs
 * (Launch Library 2)"`. Mission descriptions are TSD's own text and are used under that credit.
 * Images carry per-item third-party licences: `image_candidate_url` is set only when
 * `image.license.name` is in IMAGE_LICENSE_ALLOWLIST (CC0 / CC BY / CC BY-SA / NASA guidelines /
 * GODL-India); "Unknown", any NC licence, "ESA Standard Licence" (non-commercial only), ULA,
 * Roscosmos, JAXA, SNC, CNES and DoD policies are rejected.
 *
 * Rejected alternatives (Phase-4 briefs §20): r/spacex SpaceX-API v4 (archived 2024, Cloudflare
 * 525); RocketLaunch.Live free tier (next 5 launches only).
 */

export const LL2_BASE = "https://ll.thespacedevs.com/2.3.0";
export const PAGE_SIZE = 100;
/** How often one page may eat the whole run budget before the pass steps over it (anti-stall). */
export const MAX_STALL_TRIES = 2;
/** A 429 locks the egress out for the rest of the hour; remember it for at least this long. */
export const LOCKOUT_MS = 60_000;
const SOURCE = "ll2" as const;
const CATEGORY: Category = "space";
const DESCRIPTION_MAX = 1500;

export const IMAGE_LICENSE_ALLOWLIST = new Set([
  "cc0 1.0",
  "cc by 4.0",
  "cc by-sa 4.0",
  "cc by-sa 3.0 igo",
  "nasa image and media guidelines",
  "godl-india",
]);

// ---------------------------------------------------------------------------------------------
// Upstream shapes (the subset read here; `mode=detailed`)

export type Ll2Named = { id?: number; name?: string | null; abbrev?: string | null; url?: string | null };
export type Ll2Image = {
  image_url?: string | null;
  thumbnail_url?: string | null;
  credit?: string | null;
  license?: { name?: string | null; link?: string | null } | null;
} | null;
export type Ll2Update = { comment?: string | null; created_on?: string | null; info_url?: string | null };
export type Ll2Video = {
  title?: string | null;
  url?: string | null;
  publisher?: string | null;
  source?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  type?: { name?: string | null } | null;
};
export type Ll2Country = { name?: string | null; alpha_2_code?: string | null } | null;

export type Ll2Launch = {
  id: string;
  url?: string | null;
  slug?: string | null;
  name?: string | null;
  status?: { name?: string | null; abbrev?: string | null } | null;
  last_updated?: string | null;
  net?: string | null;
  net_precision?: Ll2Named | null;
  window_start?: string | null;
  window_end?: string | null;
  image?: Ll2Image;
  launch_service_provider?: Ll2Named | null;
  rocket?: { configuration?: { name?: string | null; full_name?: string | null } | null } | null;
  mission?: { name?: string | null; type?: string | null; description?: string | null; orbit?: Ll2Named | null } | null;
  pad?: {
    url?: string | null;
    name?: string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
    country?: Ll2Country;
    location?: { name?: string | null; timezone_name?: string | null; country?: Ll2Country } | null;
  } | null;
  webcast_live?: boolean | null;
  program?: Ll2Named[] | null;
  updates?: Ll2Update[] | null;
  vid_urls?: Ll2Video[] | null;
};

export type Ll2Event = {
  id: number;
  url?: string | null;
  slug?: string | null;
  name?: string | null;
  type?: { name?: string | null } | null;
  description?: string | null;
  location?: string | null;
  date?: string | null;
  date_precision?: Ll2Named | null;
  duration?: string | null;
  last_updated?: string | null;
  image?: Ll2Image;
  agencies?: Ll2Named[] | null;
  program?: Ll2Named[] | null;
  launches?: Array<{ id?: string; name?: string | null }> | null;
  astronauts?: Ll2Named[] | null;
  updates?: Ll2Update[] | null;
  vid_urls?: Ll2Video[] | null;
};

export type Ll2Page<T> = { count?: number; next?: string | null; previous?: string | null; results?: T[] };
export type Ll2Throttle = { your_request_limit?: number; limit_frequency_secs?: number; current_use?: number; next_use_secs?: number };

// ---------------------------------------------------------------------------------------------
// Dates and precision

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ORDINAL_HALF = ["first", "second"];

export type Ll2Date = {
  /** Catalog `date`: an ISO instant for instants, else the first day of the period. */
  date: string;
  precision: IngestPrecision;
  /** Human wording for the description ("10 September 2026 at 15:37 UTC", "around 09:00 UTC on 10 September 2026", "Q4 2026", "the second half of 2026", "2027", "the 2030s"). */
  label: string;
  /** Upstream precision name, lower-cased ("minute", "hour", "quarter 4" …); lets callers soften hour-precision instants. */
  source: string;
};

/**
 * `net` + `net_precision.name` (or an event's `date` + `date_precision.name`) → catalog date and
 * precision. LL2 sets `net` to the END of a coarse period; the catalog stores the FIRST day.
 * Returns null for an unparseable date or an unknown precision name (logged by the caller).
 */
export function ll2Date(net: string | null | undefined, precisionName: string | null | undefined): Ll2Date | null {
  if (!net || typeof net !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/.exec(net);
  if (!m) return null;
  const t = Date.parse(net);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const y = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ymd = (yy: number, mo: number, dd: number) => `${yy}-${String(mo).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  const name = String(precisionName ?? "").trim();
  const lower = name.toLowerCase();
  const out = (date: string, precision: IngestPrecision, label: string): Ll2Date => ({ date, precision, label, source: lower });
  if (lower === "second" || lower === "minute" || lower === "hour") {
    const instant = d.toISOString().replace(/\.\d{3}Z$/, "Z");
    const dayLabel = `${day} ${MONTHS[month - 1]} ${y}`;
    // Hour precision: a real timestamp, but not a confirmed minute → "around HH:00 UTC on <day>".
    return out(instant, "instant", lower === "hour" ? `around ${hh}:${mm} UTC on ${dayLabel}` : `${dayLabel} at ${hh}:${mm} UTC`);
  }
  if (lower === "day") return out(ymd(y, month, day), "day", `${day} ${MONTHS[month - 1]} ${y}`);
  if (lower === "month") return out(ymd(y, month, 1), "month", `${MONTHS[month - 1]} ${y}`);
  const quarter = /^quarter(?:\s+([1-4]))?$/.exec(lower);
  if (quarter) {
    const q = quarter[1] ? Number(quarter[1]) : Math.floor((month - 1) / 3) + 1;
    return out(ymd(y, (q - 1) * 3 + 1, 1), "quarter", `Q${q} ${y}`);
  }
  const half = /^(?:year\s+)?half(?:\s+([12]))?$/.exec(lower);
  if (half) {
    // No half-year precision in the catalog: year precision, but the wording keeps the half.
    const h = half[1] ? Number(half[1]) : month <= 6 ? 1 : 2;
    return out(ymd(y, 1, 1), "year", `the ${ORDINAL_HALF[h - 1]} half of ${y}`);
  }
  if (lower === "year") return out(ymd(y, 1, 1), "year", String(y));
  // "Fiscal Year" (seen live 2026-09-09 on US government launches, net = 30 June of the FY's
  // calendar year): the catalog has no such bucket, so year precision of that calendar year.
  if (lower === "fiscal year") return out(ymd(y, 1, 1), "year", `fiscal year ${y}`);
  if (lower.includes("decade")) {
    const start = Math.floor(y / 10) * 10;
    return out(ymd(start, 1, 1), "decade", `the ${start}s`);
  }
  // Any other year-ish bucket LL2 may add later is still a year placeholder; anything else is unknown.
  if (lower.includes("year")) return out(ymd(y, 1, 1), "year", String(y));
  return null;
}

const CONFIDENCE: Record<IngestPrecision, number> = { instant: 0.9, day: 0.9, month: 0.7, quarter: 0.5, year: 0.5, decade: 0.4 };
const CONFIDENCE_HOUR = 0.8;

/** Precision-based confidence; an hour-precision NET is an instant but not a confirmed minute. */
export function confidenceFor(d: Ll2Date): number {
  return d.source === "hour" ? CONFIDENCE_HOUR : CONFIDENCE[d.precision];
}

/** "UTC" only for instants; all-day and coarser rows are per-viewer local dates (null), as in football-data. */
function timezoneFor(d: Ll2Date): string | null {
  return d.precision === "instant" ? "UTC" : null;
}

/**
 * Drop titles that name a different year than the date ("Kosmos 2027 demo" dated 2026). Minor-planet
 * provisional designations ("1998 KY26", "2024 YR4" — flyby/rendezvous targets) are not years.
 */
export function titleYearConsistent(title: string, dateYear: number): boolean {
  const withoutDesignations = title.replace(/\b(?:18|19|20|21)\d{2}\s[A-Z]{2}\d{0,3}\b/g, " ");
  const years = withoutDesignations.match(/\b(?:19|20|21)\d{2}\b/g) ?? [];
  return years.every((y) => Number(y) === dateYear);
}

// ---------------------------------------------------------------------------------------------
// Status, tags, popularity, images

const TERMINAL_STATUS = new Set(["success", "failure", "partial failure"]);

/** LL2 `status.abbrev`/`status.name` → catalog status; null when the launch is over. */
export function launchStatus(status: Ll2Launch["status"], precision: IngestPrecision): IngestStatus | null {
  const abbrev = String(status?.abbrev ?? "").trim().toLowerCase();
  const name = String(status?.name ?? "").trim().toLowerCase();
  if (TERMINAL_STATUS.has(name) || abbrev === "success" || abbrev === "failure") return null;
  if (precision !== "instant" && precision !== "day") return "tentative";
  if (abbrev === "hold" || name.includes("hold")) return "postponed";
  if (abbrev === "go" || name.startsWith("go for") || abbrev === "in flight" || name === "in flight") return "scheduled";
  // TBD / TBC / anything unknown.
  return "tentative";
}

const CREWED_RE = /human exploration/i;
const STARLINK_RE = /\bstarlink\b/i;
const UNKNOWN_PAYLOAD_RE = /unknown payload/i;
const ARTEMIS_RE = /\bartemis\b/i;
const MARQUEE_PROVIDER_RE = /\bNASA\b|National Aeronautics|European Space Agency|Indian Space Research|Japan Aerospace|Blue Origin/i;

function tag(s: string | null | undefined): string | null {
  const t = slugify(String(s ?? "")).slice(0, 60).replace(/-+$/, "");
  return t && t !== "unknown" && t !== "n-a" ? t : null;
}

export function launchTags(l: Ll2Launch): string[] {
  const out: string[] = ["launch"];
  const push = (s: string | null | undefined) => {
    const t = tag(s);
    if (t && !out.includes(t)) out.push(t);
  };
  push(l.launch_service_provider?.name);
  push(l.rocket?.configuration?.name);
  for (const p of l.program ?? []) push(p?.name);
  push(l.mission?.orbit?.name);
  if (CREWED_RE.test(l.mission?.type ?? "")) out.push("crewed");
  if (STARLINK_RE.test(l.name ?? "") || STARLINK_RE.test(l.mission?.name ?? "")) push("starlink");
  return out;
}

export function launchPopularity(l: Ll2Launch): { popularity: number; featured: boolean } {
  const name = l.name ?? "";
  const missionName = l.mission?.name ?? "";
  const crewed = CREWED_RE.test(l.mission?.type ?? "");
  const programs = (l.program ?? []).map((p) => p?.name ?? "");
  const artemis = programs.some((p) => ARTEMIS_RE.test(p)) || ARTEMIS_RE.test(name);
  if (artemis && crewed) return { popularity: 90, featured: true };
  if (UNKNOWN_PAYLOAD_RE.test(name) || UNKNOWN_PAYLOAD_RE.test(missionName)) return { popularity: 10, featured: false };
  if (STARLINK_RE.test(name) || STARLINK_RE.test(missionName)) return { popularity: 15, featured: false };
  let p = 30;
  if (crewed) p += 25;
  if (artemis) p += 15;
  const provider = l.launch_service_provider?.name ?? "";
  const rocket = `${l.rocket?.configuration?.full_name ?? ""} ${l.rocket?.configuration?.name ?? ""}`;
  if (MARQUEE_PROVIDER_RE.test(provider) || (/spacex/i.test(provider) && /starship/i.test(rocket))) p += 10;
  return { popularity: clamp(p, 0, 100), featured: false };
}

export type ImageCandidate = { url: string; meta: Record<string, unknown> } | null;

/** `image_candidate_url` only for allowlisted licences (see the header comment). */
export function imageCandidate(image: Ll2Image | undefined, pageUrl: string | null): ImageCandidate {
  const url = image?.image_url;
  const license = String(image?.license?.name ?? "").trim();
  if (!url || !/^https:\/\//.test(url) || !license) return null;
  if (!IMAGE_LICENSE_ALLOWLIST.has(license.toLowerCase())) return null;
  return {
    url,
    meta: {
      provider: "launchlibrary",
      pageUrl,
      license,
      licenseUrl: image?.license?.link ?? null,
      author: image?.credit ?? null,
    },
  };
}

function alpha2(country: Ll2Country | undefined): string | null {
  const code = String(country?.alpha_2_code ?? "")
    .trim()
    .toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function trimUpdates(updates: Ll2Update[] | null | undefined): Array<Record<string, unknown>> {
  return (updates ?? []).slice(0, 10).map((u) => ({ comment: u.comment ?? null, created_on: u.created_on ?? null, info_url: u.info_url ?? null }));
}

function trimVideos(vids: Ll2Video[] | null | undefined): Array<Record<string, unknown>> {
  return (vids ?? []).slice(0, 5).map((v) => ({
    title: v.title ?? null,
    url: v.url ?? null,
    publisher: v.publisher ?? null,
    type: v.type?.name ?? null,
    start_time: v.start_time ?? null,
    end_time: v.end_time ?? null,
  }));
}

/** Own prose: no upstream text is copied except TSD's mission description, used under the source credit. */
function capDescription(s: string): string {
  const text = s.replace(/\s+/g, " ").trim();
  if (text.length <= DESCRIPTION_MAX) return text;
  const cut = text.slice(0, DESCRIPTION_MAX);
  const at = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (at > DESCRIPTION_MAX / 2 ? cut.slice(0, at + 1) : cut.replace(/\s+\S*$/, "")).trim();
}

function sentence(s: string | null | undefined): string {
  const t = String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "";
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

function launchStatusSentence(status: IngestStatus, d: Ll2Date, abbrev: string): string {
  if (d.precision === "instant") {
    const lead = `Liftoff is targeted for ${d.label}.`;
    if (status === "postponed") return `${lead} The launch is currently on hold.`;
    if (abbrev === "tbc") return `${lead} The date is awaiting official confirmation.`;
    // Hour precision: the day is set but the minute is not, so never claim "go for that time".
    if (d.source === "hour") return status === "scheduled" ? `${lead} The launch is go for that day; the exact liftoff time has not been announced.` : `${lead} The exact liftoff time is still to be determined.`;
    if (status === "scheduled") return `${lead} The launch is go for that time.`;
    return `${lead} The exact date is still to be determined.`;
  }
  if (d.precision === "day") {
    return status === "scheduled" ? `Launch is planned for ${d.label}; the exact time has not been announced.` : `Launch is planned for ${d.label}, subject to confirmation.`;
  }
  return `Launch is expected in ${d.label} and no firm date has been announced yet.`;
}

// ---------------------------------------------------------------------------------------------
// Records

export function launchToEvent(l: Ll2Launch, now: Date, log?: IngestContext["log"]): IngestEvent | null {
  const id = String(l.id ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rawName = sanitizeTitle(String(l.name ?? "").replace(/\s*\|\s*/g, ": "));
  if (!rawName) return null;
  const d = ll2Date(l.net, l.net_precision?.name);
  if (!d) {
    log?.warn(`launch ${id} (${rawName}): unusable net/precision ${JSON.stringify([l.net, l.net_precision?.name])}`);
    return null;
  }
  const status = launchStatus(l.status, d.precision);
  if (!status) return null;
  if (!titleYearConsistent(rawName, Number(d.date.slice(0, 4)))) return null;
  if (!isFutureOrFar(d.date, d.precision, now)) return null;
  const tags = launchTags(l);
  if (isFarFuture(d.date, tags, now)) return null;

  const provider = sanitizeTitle(l.launch_service_provider?.name ?? "");
  const rocket = sanitizeTitle(l.rocket?.configuration?.full_name ?? l.rocket?.configuration?.name ?? "");
  const missionName = sanitizeTitle(l.mission?.name ?? "");
  const pad = l.pad ?? null;
  const siteName = sanitizeTitle(pad?.location?.name ?? "");
  const country = alpha2(pad?.location?.country) ?? alpha2(pad?.country);
  const payload = !missionName || UNKNOWN_PAYLOAD_RE.test(missionName) ? "an undisclosed payload" : missionName;
  const lead = provider
    ? `${provider} is preparing to launch ${payload}${rocket ? ` on ${/^[aeiou]/i.test(rocket) ? "an" : "a"} ${rocket}` : ""}${siteName ? ` from ${siteName}` : ""}.`
    : `${rocket || "A rocket"} launch carrying ${payload}${siteName ? ` from ${siteName}` : ""}.`;
  const missionText = sentence(l.mission?.description);
  const missionSentence = missionText && !/^(details )?tb[ad]\.?$/i.test(missionText) ? missionText : "";
  const description = capDescription([lead, missionSentence, launchStatusSentence(status, d, String(l.status?.abbrev ?? "").toLowerCase())].filter(Boolean).join(" "));

  const { popularity, featured } = launchPopularity(l);
  const sourceUrl = l.url && /^https:\/\//.test(l.url) ? l.url : `${LL2_BASE}/launches/${id}/`;
  const location: Record<string, unknown> | null = pad
    ? {
        name: siteName || (pad.name ?? null),
        pad: pad.name ?? null,
        country,
        lat: num(pad.latitude),
        lng: num(pad.longitude),
        url: pad.url ?? null,
        timezone: pad.location?.timezone_name ?? null,
      }
    : null;
  const image = imageCandidate(l.image, sourceUrl);
  const row = buildEvent({
    title: rawName,
    date: d.date,
    category: CATEGORY,
    tags,
    regions: country ? [country] : ["GLOBAL"],
    description,
    source: SOURCE,
    sourceUrl,
    sourceKey: `ll2:launch:${id}`,
    slugFallbackPrefix: "launch",
    featured,
    popularity,
    datePrecision: d.precision,
    status,
    confidence: confidenceFor(d),
    externalIds: { ll2: id, ...(l.slug ? { ll2_slug: l.slug } : {}) },
    location,
    timezone: timezoneFor(d),
    raw: {
      kind: "launch",
      id,
      name: l.name ?? null,
      status: { name: l.status?.name ?? null, abbrev: l.status?.abbrev ?? null },
      net: l.net ?? null,
      net_precision: l.net_precision?.name ?? null,
      window_start: l.window_start ?? null,
      window_end: l.window_end ?? null,
      last_updated: l.last_updated ?? null,
      provider: l.launch_service_provider?.name ?? null,
      rocket: l.rocket?.configuration?.full_name ?? null,
      mission: l.mission ? { name: l.mission.name ?? null, type: l.mission.type ?? null, orbit: l.mission.orbit?.name ?? null } : null,
      program: (l.program ?? []).map((p) => p?.name ?? null),
      image: l.image ? { image_url: l.image.image_url ?? null, license: l.image.license?.name ?? null, credit: l.image.credit ?? null } : null,
      webcast_live: Boolean(l.webcast_live),
      updates: trimUpdates(l.updates),
      vid_urls: trimVideos(l.vid_urls),
    },
  });
  if (image) {
    row.image_candidate_url = image.url;
    row.image_candidate_meta = image.meta;
  }
  return row;
}

const EVENT_TYPE_ARTICLE_RE = /^(?:spacecraft|orbital|space station)\s+/i;

export function eventToEvent(e: Ll2Event, now: Date, log?: IngestContext["log"]): IngestEvent | null {
  const id = Number(e.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const name = sanitizeTitle(String(e.name ?? ""));
  if (!name) return null;
  const d = ll2Date(e.date, e.date_precision?.name);
  if (!d) {
    log?.warn(`event ${id} (${name}): unusable date/precision ${JSON.stringify([e.date, e.date_precision?.name])}`);
    return null;
  }
  if (!titleYearConsistent(name, Number(d.date.slice(0, 4)))) return null;
  if (!isFutureOrFar(d.date, d.precision, now)) return null;
  const typeName = sanitizeTitle(e.type?.name ?? "");
  const tags = ["space-event"];
  const typeTag = tag(typeName);
  if (typeTag) tags.push(typeTag);
  for (const p of e.program ?? []) {
    const t = tag(p?.name);
    if (t && !tags.includes(t)) tags.push(t);
  }
  for (const a of e.agencies ?? []) {
    const t = tag(a?.name);
    if (t && !tags.includes(t)) tags.push(t);
  }
  const crew = (e.astronauts ?? []).length > 0;
  if (crew && !tags.includes("crewed")) tags.push("crewed");
  if (isFarFuture(d.date, tags, now)) return null;

  const artemis = (e.program ?? []).some((p) => ARTEMIS_RE.test(p?.name ?? "")) || ARTEMIS_RE.test(name);
  let popularity = 30;
  if (crew) popularity += 10;
  if (artemis) popularity += 15;
  const featured = artemis && crew;
  if (featured) popularity = Math.max(popularity, 90);

  const what = typeName ? typeName.replace(EVENT_TYPE_ARTICLE_RE, "").toLowerCase() : "event";
  const where = sanitizeTitle(e.location ?? "");
  const when = d.precision === "instant" ? `is ${d.source === "hour" ? "expected" : "scheduled for"} ${d.label}` : d.precision === "day" ? `is planned for ${d.label}` : `is expected in ${d.label}`;
  const statusSentence = `This ${what}${where ? ` at ${where}` : ""} ${when}${d.precision === "instant" || d.precision === "day" ? "." : "; no exact date has been set."}`;
  const description = capDescription([sentence(e.description), statusSentence].filter(Boolean).join(" "));
  const sourceUrl = e.url && /^https:\/\//.test(e.url) ? e.url : `${LL2_BASE}/events/${id}/`;
  const image = imageCandidate(e.image, sourceUrl);
  const row = buildEvent({
    title: name,
    date: d.date,
    category: CATEGORY,
    tags,
    regions: ["GLOBAL"],
    description,
    source: SOURCE,
    sourceUrl,
    sourceKey: `ll2:event:${id}`,
    slugFallbackPrefix: "space-event",
    featured,
    popularity: clamp(popularity, 0, 100),
    datePrecision: d.precision,
    status: d.precision === "instant" || d.precision === "day" ? "scheduled" : "tentative",
    confidence: confidenceFor(d),
    externalIds: { ll2_event: id, ...(e.slug ? { ll2_slug: e.slug } : {}) },
    location: where ? { name: where } : null,
    timezone: timezoneFor(d),
    raw: {
      kind: "event",
      id,
      name: e.name ?? null,
      type: e.type?.name ?? null,
      date: e.date ?? null,
      date_precision: e.date_precision?.name ?? null,
      duration: e.duration ?? null,
      location: e.location ?? null,
      last_updated: e.last_updated ?? null,
      agencies: (e.agencies ?? []).map((a) => a?.name ?? null),
      program: (e.program ?? []).map((p) => p?.name ?? null),
      launches: (e.launches ?? []).map((l) => l?.id ?? null),
      image: e.image ? { image_url: e.image.image_url ?? null, license: e.image.license?.name ?? null, credit: e.image.credit ?? null } : null,
      updates: trimUpdates(e.updates),
      vid_urls: trimVideos(e.vid_urls),
    },
  });
  if (image) {
    row.image_candidate_url = image.url;
    row.image_candidate_meta = image.meta;
  }
  return row;
}

function dedupe(rows: Array<IngestEvent | null>): IngestEvent[] {
  const seen = new Map<string, IngestEvent>();
  for (const r of rows) if (r && !seen.has(r.source_key)) seen.set(r.source_key, r);
  return [...seen.values()];
}

export function launchesToEvents(results: Ll2Launch[], now: Date, log?: IngestContext["log"]): IngestEvent[] {
  return dedupe(results.map((l) => launchToEvent(l, now, log)));
}

export function eventsToEvents(results: Ll2Event[], now: Date, log?: IngestContext["log"]): IngestEvent[] {
  return dedupe(results.map((e) => eventToEvent(e, now, log)));
}

// ---------------------------------------------------------------------------------------------
// Plan / run

export type Stage = "launches" | "events" | "done";
export type Cursor = { stage: Stage; offset: number; tries: number };
/**
 * `next` is set by run() from the page's `next` link and read by the `after` getter; `stalled` is
 * set when the run budget (not the source) cut the page short, which is what `tries` counts.
 */
export type Ll2Unit = Unit & {
  stage: Exclude<Stage, "done">;
  offset: number;
  next: string | null;
  ran: boolean;
  stalled: boolean;
};

export function parseCursor(cursor: Json | null): Cursor {
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    const c = cursor as { stage?: unknown; offset?: unknown; tries?: unknown };
    const offset = typeof c.offset === "number" && Number.isInteger(c.offset) && c.offset >= 0 ? c.offset : 0;
    const tries = typeof c.tries === "number" && Number.isInteger(c.tries) && c.tries > 0 ? c.tries : 0;
    if (c.stage === "launches" || c.stage === "events") return { stage: c.stage, offset, tries };
    if (c.stage === "done") return { stage: "done", offset: 0, tries: 0 };
  }
  return { stage: "launches", offset: 0, tries: 0 };
}

/** Cursor as persisted JSON; `tries` is omitted while it is 0 so the common cursor stays `{stage, offset}`. */
export function cursorJson(stage: Stage, offset: number, tries = 0): Json {
  return tries > 0 ? { stage, offset, tries } : { stage, offset };
}

export function pageUrl(stage: Exclude<Stage, "done">, offset: number): string {
  return `${LL2_BASE}/${stage}/upcoming/?limit=${PAGE_SIZE}&mode=detailed&offset=${offset}`;
}

/** Offset of the page a `next` link points at; null when the link is absent or unreadable. */
export function offsetFromNext(next: string | null | undefined): number | null {
  if (!next) return null;
  try {
    const n = Number(new URL(next).searchParams.get("offset"));
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

export function authHeaders(): Record<string, string> {
  const token = (process.env.LL2_API_TOKEN ?? "").trim();
  return token ? { Authorization: `Token ${token}` } : {};
}

/**
 * The hour's request bucket is empty. Deliberately a `BudgetExceededError`: `run.ts` classifies it
 * as `kind: "budget"`, which ends the run `partial` with the cursor kept, `consecutive_failures`
 * reset and no backoff — the semantics the brief asks for ("end the run partial and resume next
 * cron"), instead of the outage-plus-backoff a plain throw from an adapter would produce.
 */
export class Ll2QuotaError extends BudgetExceededError {
  constructor(
    public readonly currentUse: number,
    public readonly limit: number,
    public readonly nextUseSecs: number,
  ) {
    super(`${LL2_BASE}/api-throttle/`, 0);
    this.message =
      `LL2 hourly quota: ${currentUse}/${limit} requests used on this egress; ` +
      `not enough left for the next page (next slot in ${nextUseSecs} s). Resuming from the saved cursor next run.`;
    // `isBudgetExceeded()` accepts either the instance or the name; keep the name it checks for.
    this.name = "BudgetExceededError";
  }
}

/** Set when a request came back 429: the whole egress is locked out, so do not spend another. */
let lockedOutUntil = 0;

/** Test/process helper: forget a remembered 429 lock-out. */
export function resetLockout(): void {
  lockedOutUntil = 0;
}

export function lockoutRemainingMs(now = Date.now()): number {
  return Math.max(0, lockedOutUntil - now);
}

/** Budget-shaped (so the run ends `partial`, not `error`) refusal to touch an exhausted bucket. */
export function lockoutError(url: string, remainingMs: number): BudgetExceededError {
  const err = new BudgetExceededError(url, 0);
  err.message =
    `LL2 429 lock-out: this egress is rate-limited for another ~${Math.ceil(remainingMs / 1000)} s; ` +
    `not requesting ${url}. Resuming from the saved cursor next run.`;
  return err;
}

/**
 * Free quota check (`/api-throttle/`, does not count against the bucket). Throws `Ll2QuotaError`
 * when the hour has no slot left for the page about to be requested; a failed throttle call itself
 * is only logged (the page request will surface a real problem). One slot is enough: a pass may
 * legitimately span several crons, so partial progress beats refusing to start.
 */
export async function checkQuota(ctx: IngestContext): Promise<void> {
  let t: Ll2Throttle;
  try {
    t = await ctx.http.fetchJson<Ll2Throttle>(`${LL2_BASE}/api-throttle/`, { headers: authHeaders() });
  } catch (err) {
    if (isBudgetExceeded(err)) throw err;
    ctx.log.warn(`api-throttle check failed (${(err as Error)?.message ?? err}); continuing`);
    return;
  }
  const limit = Number(t?.your_request_limit);
  const used = Number(t?.current_use);
  if (!Number.isFinite(limit) || !Number.isFinite(used)) return;
  if (limit - used < 1) throw new Ll2QuotaError(used, limit, Number(t?.next_use_secs) || 0);
  ctx.log.info(`quota ${used}/${limit} used this hour`);
}

export const adapter: Adapter<Ll2Unit> = {
  id: SOURCE,
  label: "Launch Library 2 (The Space Devs)",
  rank: 7,
  cadence: "daily",
  isConfigured: () => true, // LL2_API_TOKEN is optional
  // 15 req/h per IP anonymous: never retry a 429 (the lock-out lasts the rest of the hour).
  // A detailed page is ≈ 3 MB with an 8–30 s time-to-first-byte (measured 2026-09-09), hence 60 s.
  limits: { concurrency: 1, minIntervalMs: 3000, timeoutMs: 60_000, maxRetries: 0 },

  // plan() makes no request: the quota gate lives in run(), where a stop can be reported as
  // `budget` (partial, cursor kept) instead of a systemic failure.
  async plan(cursor): Promise<Plan<Ll2Unit>> {
    const c = parseCursor(cursor);
    if (c.stage === "done") return { units: [], done: true };
    const { stage, offset, tries } = c;
    const unit: Ll2Unit = {
      key: `ll2:${stage}:${offset}`,
      label: `${stage} offset ${offset}`,
      stage,
      offset,
      next: null,
      ran: false,
      stalled: false,
      // Read by the runner after run(): the page's own `next` link decides the resume point.
      get after(): Json {
        if (this.ran) {
          const nextOffset = offsetFromNext(this.next);
          if (nextOffset !== null && nextOffset > offset) return cursorJson(stage, nextOffset);
          return stage === "launches" ? cursorJson("events", 0) : cursorJson("done", 0);
        }
        if (this.stalled && tries + 1 >= MAX_STALL_TRIES) {
          // This page ate the whole budget MAX_STALL_TRIES times. The runner persists `after` for
          // the first unit of a run in that case precisely so the pass can move on: step over it
          // (the stale sweep will not run, because such a pass never completes cleanly).
          return stage === "launches" ? cursorJson(stage, offset + PAGE_SIZE) : cursorJson("done", 0);
        }
        if (this.stalled) return cursorJson(stage, offset, tries + 1);
        // run() did not finish (quota stop, 429, timeout): resume in place so no page is skipped.
        // A persistently failing page is bounded by the runner's three-consecutive-failures rule.
        return cursorJson(stage, offset, tries);
      },
    };
    return {
      units: [unit],
      done: false,
      get nextCursor(): Json {
        return unit.after;
      },
    };
  },

  async run(unit, ctx) {
    // Both gates run BEFORE the page request, so `unit.ran`/`unit.stalled` stay false and `after`
    // resolves to the very same cursor: the next cron resumes exactly here.
    const url = pageUrl(unit.stage, unit.offset);
    const lockout = lockoutRemainingMs();
    if (lockout > 0) throw lockoutError(url, lockout);
    await checkQuota(ctx);
    let page: Ll2Page<Ll2Launch | Ll2Event>;
    try {
      page = await ctx.http.fetchJson<Ll2Page<Ll2Launch | Ll2Event>>(url, { headers: authHeaders() });
    } catch (err) {
      // A 429 means the whole hour is spent: remember it so the runner's second attempt does not
      // spend another request. A budget cut-off is what the `tries` anti-stall counter counts.
      if (err instanceof HttpError && err.status === 429) lockedOutUntil = Date.now() + LOCKOUT_MS;
      else if (isBudgetExceeded(err)) unit.stalled = true;
      throw err;
    }
    const results = Array.isArray(page?.results) ? page.results : [];
    unit.next = typeof page?.next === "string" ? page.next : null;
    unit.ran = true;
    const rows = unit.stage === "launches" ? launchesToEvents(results as Ll2Launch[], ctx.now, ctx.log) : eventsToEvents(results as Ll2Event[], ctx.now, ctx.log);
    ctx.log.info(`${unit.label}: ${results.length} of ${page?.count ?? "?"} ${unit.stage}, ${rows.length} kept${unit.next ? "" : " (last page)"}`);
    return rows;
  },
};
