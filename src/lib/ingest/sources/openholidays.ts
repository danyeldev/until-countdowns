import { buildEvent, classify, FEATURED_NAMES, isFarFuture, slugify } from "../normalize";
import { addDaysIso } from "../recurrence";
import type { Adapter, IngestContext, IngestEvent, Json, Plan, Unit } from "../types";
import type { Category } from "@/lib/types";

/**
 * OpenHolidays API (openholidaysapi.org, operator STÜBER SYSTEMS GmbH) — public holidays for the
 * 36 countries the API covers, as a quality overlay on the offline `holidays` adapter: localized
 * names, `nationwide` vs ISO-3166-2 subdivision scoping, stable UUID ids. Rank 2 > holidays
 * rank 1, so on a slug collision its title/date win.
 *
 * Licence: the server code is AGPL-3.0; the *data* licence is not stated anywhere on the site
 * (`/en/sources/` and `/en/about/` 404 on 2026-09-09). `public.sources` records ODbL — treat as
 * unverified; attribution "Holiday data from OpenHolidays API (openholidaysapi.org)". No images.
 *
 * Rejected alternatives (do not add): Nager.Date — ToS "It is not allowed to use the holiday
 * information to publish or operate your own holiday portal", commercial use requires
 * sponsorship, capped at current year + 5; Calendarific / HolidayAPI / Abstract API — paid,
 * previous-year-only or non-commercial free tiers; Google public holiday ICS — no licence grant
 * for bulk extraction.
 *
 * Verified 2026-09-09: `GET /Countries?languageIsoCode=EN` → 36 entries; `GET /PublicHolidays`
 * rows carry `id` (UUID), `startDate`, `endDate`, `type` (`Public`), `name[]` of
 * `{language, text}`, `nationwide`, `subdivisions[]` of `{code, shortName}`, `regionalScope`
 * (`National|Regional|Local`), `temporalScope` (`FullDay|HalfDay`); the maximum query range is
 * 1095 days (HTTP 400 "The maximum date range is 1095 days." beyond it); `/SchoolHolidays` exists
 * (type `School`, extra `groups[]`) but v1 ingests public holidays only. No documented rate limit
 * — 1 request per second, one at a time. No auth.
 *
 * Units: country × 1095-day window (two windows: now−1 d … +3 y, +3 y … +6 y; the far window is
 * often empty — the data for some countries currently ends within a year). The cursor is the
 * last completed `{ country, win }` plus the country list of the pass, so a resume never depends
 * on array positions.
 *
 * source_key: `openholidays:<CC>:<startDate>:<slugify(title)>` — deterministic, so an upstream
 * data reload that mints new UUIDs (stability across reloads is unproven) cannot orphan the keys
 * behind the site's marquee holiday rows and flip them to `tentative` via mark_stale_records. The
 * UUID is kept in `external_ids.openholidays` only.
 *
 * Descriptions are written country-neutrally for both nationwide and subdivision rows: slugs carry
 * no country, so a row's prose can end up on a catalog row whose regions[] spans many countries.
 */

export const OH_BASE = "https://openholidaysapi.org";
export const SOURCE_ATTRIBUTION = "Holiday data from OpenHolidays API (openholidaysapi.org)";

/** Countries `/Countries` returned on 2026-09-09 — fallback when the live list cannot be fetched. */
export const OPENHOLIDAYS_COUNTRIES: readonly string[] = [
  "AD", "AL", "AT", "BE", "BG", "BR", "BY", "CH", "CZ", "DE", "EE", "ES", "FR", "HR", "HU", "IE", "IT", "LI",
  "LT", "LU", "LV", "MC", "MD", "MT", "MX", "NL", "PL", "PT", "RO", "RS", "SE", "SI", "SK", "SM", "VA", "ZA",
];

/** API hard cap on `validFrom..validTo` (inclusive day difference). */
export const WINDOW_DAYS = 1095;
export const WINDOWS = 2;
const MAX_SUBDIVISION_TAGS = 30;
const YEAR_RE = /\b(19|20)\d{2}\b/;

export type OpenHolidayName = { language?: string; text?: string };
export type OpenHolidaySubdivision = { code?: string; shortName?: string };
export type OpenHolidayRow = {
  id?: string;
  startDate?: string;
  endDate?: string;
  type?: string;
  name?: OpenHolidayName[];
  regionalScope?: string;
  temporalScope?: string;
  nationwide?: boolean;
  subdivisions?: OpenHolidaySubdivision[];
};
export type OpenHolidayCountry = { isoCode?: string; name?: OpenHolidayName[] };

export type OpenHolidaysUnit = Unit & { country: string; win: number; from: string; to: string };
export type Cursor = { countries: string[]; after: { country: string; win: number } | null };

export function includeSubdivisions(): boolean {
  return /^(1|true|yes)$/i.test(process.env.OPENHOLIDAYS_INCLUDE_SUBDIVISIONS ?? "");
}

export function countriesUrl(): string {
  return `${OH_BASE}/Countries?languageIsoCode=EN`;
}

export function publicHolidaysUrl(country: string, from: string, to: string): string {
  const q = new URLSearchParams({ countryIsoCode: country, languageIsoCode: "EN", validFrom: from, validTo: to });
  return `${OH_BASE}/PublicHolidays?${q.toString()}`;
}

/** `[from, to]` (inclusive, `WINDOW_DAYS` apart) for window `win`, starting the day before `now`. */
export function windowFor(now: Date, win: number): { from: string; to: string } {
  const today = now.toISOString().slice(0, 10);
  const from = addDaysIso(today, -1 + win * WINDOW_DAYS);
  return { from, to: addDaysIso(from, WINDOW_DAYS - 1) };
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Friday, 1 January 2027" — hand-rolled so the text does not depend on the runtime's ICU data. */
export function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** English name, else the first non-empty entry (some Spanish regional rows carry only an `ES` name). */
export function pickName(names: OpenHolidayName[] | undefined): string {
  if (!Array.isArray(names)) return "";
  const en = names.find((n) => String(n?.language ?? "").toUpperCase() === "EN" && String(n?.text ?? "").trim());
  const pick = en ?? names.find((n) => String(n?.text ?? "").trim());
  // Upstream sometimes uses typographic quotes ("New Year’s Day" for ZA); normalise so the title
  // matches the straight-quote text of the offline `holidays` adapter on a slug collision.
  return String(pick?.text ?? "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').trim();
}

/**
 * National civic days the shared `national` TAG_RULE misses in this API's English names
 * ("Day of German Unity", "Swiss National Day", ZA's Freedom/Heritage/Reconciliation days …).
 */
const NATIONAL_RE = /\bunity\b|national holiday|federal (?:day|holiday)|freedom day|heritage day|reconciliation|king'?s day|koningsdag|bastille/i;

/**
 * Category from TAG_RULES: national days → `national`; religious feasts (Epiphany, Easter Monday,
 * Corpus Christi …) → `religion`, except the marquee names (Christmas Day, New Year's Day) and the
 * Christmas family (Boxing Day, 2nd Day of Christmas) which stay `holidays` so the merged catalog
 * row keeps the category the offline adapter gave it.
 */
export function categoryFor(title: string): { category: Category; tags: string[] } {
  // "June Holiday", "Bank Holiday" …: the shared /diwali|holi|…/ rule matches the "holi" of
  // "Holiday" and would tag the row `religious`. Blank the word before the shared rules run;
  // NATIONAL_RE and FEATURED_NAMES below still test the original title.
  const { category, tags } = classify(title.replace(/\bholidays?\b/gi, " "), "holidays");
  if (tags.includes("national")) return { category: "national", tags };
  if (NATIONAL_RE.test(title)) return { category: "national", tags: [...tags, "national"] };
  if (tags.includes("religious") && !tags.includes("christmas") && !FEATURED_NAMES.test(title)) return { category: "religion", tags };
  return { category, tags };
}

export type ConvertOptions = {
  country: string;
  now: Date;
  includeSubdivisions?: boolean;
};

/**
 * Stable per-row `source_url`: the `/PublicHolidays` query for that country and calendar year.
 * `content_hash` covers `source_url`, so it must not carry the unit's sliding request window
 * (that would rewrite every row on every weekly pass).
 */
export function yearSourceUrl(country: string, isoDate: string): string {
  const year = isoDate.slice(0, 4);
  return publicHolidaysUrl(country.toUpperCase(), `${year}-01-01`, `${year}-12-31`);
}

function subdivisionCodes(row: OpenHolidayRow): { codes: string[]; shortNames: string[] } {
  const subs = Array.isArray(row.subdivisions) ? row.subdivisions : [];
  const codes: string[] = [];
  const shortNames: string[] = [];
  for (const s of subs) {
    const code = String(s?.code ?? "").trim();
    if (!code) continue;
    codes.push(code);
    shortNames.push(String(s?.shortName ?? "").trim() || code);
  }
  return { codes, shortNames };
}

/** One upstream row → event, or null when a filter rejects it. Pure. */
export function holidayToEvent(row: OpenHolidayRow, opts: ConvertOptions): IngestEvent | null {
  if (!row || typeof row !== "object") return null;
  const cc = opts.country.toUpperCase();
  if (String(row.type ?? "").toLowerCase() !== "public") return null;
  const nationwide = row.nationwide === true;
  if (!nationwide && !opts.includeSubdivisions) return null;
  const start = String(row.startDate ?? "").slice(0, 10);
  const end = String(row.endDate ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return null;
  if (end && (!/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start)) return null;
  const today = opts.now.toISOString().slice(0, 10);
  if (start < addDaysIso(today, -1)) return null;
  const title = pickName(row.name);
  if (!title) return null;
  const yearInTitle = title.match(YEAR_RE)?.[0];
  if (yearInTitle && yearInTitle !== start.slice(0, 4)) return null;
  const { codes, shortNames } = subdivisionCodes(row);
  const { category, tags } = categoryFor(title);
  const allTags = [...tags, "public-holiday", "openholidays", String(row.type).toLowerCase()];
  if (!nationwide) allTags.push(...codes.slice(0, MAX_SUBDIVISION_TAGS).map((c) => `sub-${c.toLowerCase()}`));
  const halfDay = String(row.temporalScope ?? "").toLowerCase() === "halfday";
  if (halfDay) allTags.push("half-day");
  if (isFarFuture(start, allTags, opts.now)) return null;

  const occurs = end && end !== start ? `runs from ${formatDay(start)} to ${formatDay(end)}` : `falls on ${formatDay(start)}`;
  // Rows collide on slug with the multi-country rows of the rank-1 `holidays` adapter
  // (christmas-day-2026-12-25 …) and with this adapter's own rows for other countries, and this
  // text can win the merge, so it must stay true for a row whose regions[] spans many countries:
  // never name the country here (the subdivision codes are in the tags).
  const closes = halfDay ? "Offices and many businesses close for part of the day." : "Government offices, schools and most businesses close for the day.";
  let description: string;
  if (nationwide) {
    description = `${title} is an official public holiday that ${occurs}. ${closes}`;
  } else {
    const n = shortNames.length;
    const where = n === 0 ? "in some regions rather than nationwide" : `in ${n} ${n === 1 ? "region" : "regions"} rather than nationwide`;
    description = `${title} is a regional public holiday that ${occurs}. It is observed ${where}. ${closes}`;
  }

  const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : null;
  // Deterministic key (see header): survives an upstream UUID reload; title drift only re-keys that row.
  const sourceKey = `openholidays:${cc}:${start}:${slugify(title)}`;
  const raw: OpenHolidayRow = {
    id: id ?? undefined,
    startDate: start,
    endDate: end || undefined,
    type: row.type,
    name: Array.isArray(row.name) ? row.name : undefined,
    nationwide,
    regionalScope: row.regionalScope,
    temporalScope: row.temporalScope,
    subdivisions: Array.isArray(row.subdivisions) ? row.subdivisions : undefined,
  };
  return buildEvent({
    title,
    date: start,
    endDate: end && end !== start ? end : null,
    category,
    tags: allTags,
    regions: [cc],
    description,
    source: "openholidays",
    sourceUrl: yearSourceUrl(cc, start),
    sourceKey,
    slugFallbackPrefix: `holiday-${cc}`,
    featured: false,
    popularity: nationwide ? 30 : 15,
    allDay: true,
    datePrecision: "day",
    status: "scheduled",
    confidence: 0.95,
    externalIds: id ? { openholidays: id } : {},
    seriesSlug: null,
    location: null,
    timezone: null,
    raw,
  });
}

/** Rows of one response → events, deduped by `source_key` (first wins). Pure. */
export function holidaysToEvents(rows: OpenHolidayRow[], opts: ConvertOptions): IngestEvent[] {
  const byKey = new Map<string, IngestEvent>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const ev = holidayToEvent(row, opts);
    if (ev && !byKey.has(ev.source_key)) byKey.set(ev.source_key, ev);
  }
  return [...byKey.values()];
}

export function parseCursor(cursor: Json | null): Cursor | null {
  if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return null;
  const c = cursor as { countries?: unknown; after?: unknown };
  if (!Array.isArray(c.countries) || !c.countries.every((x) => typeof x === "string" && /^[A-Z]{2}$/.test(x))) return null;
  const countries = c.countries as string[];
  if (c.after === null || c.after === undefined) return { countries, after: null };
  const a = c.after as { country?: unknown; win?: unknown };
  if (typeof a.country !== "string" || typeof a.win !== "number" || !Number.isInteger(a.win)) return null;
  return { countries, after: { country: a.country, win: a.win } };
}

/** Units in pass order (country, then window), skipping everything up to and including `after`. Exported for tests. */
export function planUnits(countries: readonly string[], after: Cursor["after"], now: Date): OpenHolidaysUnit[] {
  const units: OpenHolidaysUnit[] = [];
  let started = !after || !countries.includes(after.country); // unknown resume point: start over
  for (const country of countries) {
    for (let win = 0; win < WINDOWS; win++) {
      if (!started) {
        if (after && country === after.country && win === after.win) started = true;
        continue;
      }
      const { from, to } = windowFor(now, win);
      units.push({
        key: `openholidays:${country}:${win}`,
        label: `${country} ${from}..${to}`,
        after: { countries: [...countries], after: { country, win } },
        country,
        win,
        from,
        to,
      });
    }
  }
  return units;
}

/** Live `/Countries` list, falling back to the verified constant when the request fails or looks wrong. */
export async function fetchCountries(ctx: IngestContext): Promise<string[]> {
  try {
    const list = await ctx.http.fetchJson<OpenHolidayCountry[]>(countriesUrl());
    const codes = (Array.isArray(list) ? list : [])
      .map((c) => String(c?.isoCode ?? "").toUpperCase())
      .filter((c) => /^[A-Z]{2}$/.test(c));
    const unique = [...new Set(codes)].sort();
    if (unique.length >= 10) return unique;
    ctx.log.warn(`/Countries returned ${unique.length} usable codes; using the built-in list`);
  } catch (err) {
    ctx.log.warn(`/Countries failed (${(err as Error)?.message ?? err}); using the built-in list`);
  }
  return [...OPENHOLIDAYS_COUNTRIES];
}

export const adapter: Adapter<OpenHolidaysUnit> = {
  id: "openholidays",
  label: "OpenHolidays API",
  rank: 2,
  cadence: "weekly",
  isConfigured: () => true,
  limits: { concurrency: 1, minIntervalMs: 1000, timeoutMs: 20_000, maxRetries: 3 },

  async plan(cursor, ctx): Promise<Plan<OpenHolidaysUnit>> {
    const parsed = parseCursor(cursor);
    const countries = parsed?.countries ?? (await fetchCountries(ctx));
    return { units: planUnits(countries, parsed?.after ?? null, ctx.now), done: true };
  },

  async run(unit, ctx) {
    const url = publicHolidaysUrl(unit.country, unit.from, unit.to);
    const rows = await ctx.http.fetchJson<OpenHolidayRow[]>(url);
    const list = Array.isArray(rows) ? rows : [];
    const events = holidaysToEvents(list, { country: unit.country, now: ctx.now, includeSubdivisions: includeSubdivisions() });
    ctx.log.info(`${unit.label}: ${list.length} rows → ${events.length} kept`);
    return events;
  },
};
