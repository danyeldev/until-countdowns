import { buildFestivalsTable, TRADITIONAL_REFERENCE } from "panchang-ts";
import { readFestivalsForYear, type FestivalsFile, type FestivalTableDay, type FestivalTableEntry } from "panchang-ts/festivals";
import { buildEvent, isFutureOrFar } from "../normalize";
import type { Adapter, IngestContext, IngestEvent, Json, Plan, Unit } from "../types";
import { HINDU_FESTIVALS, LONG_TAIL_EXCLUDED, LONG_TAIL_TYPES, TITHI_FALLBACKS } from "./hindu/festivals";
import { addDays, tithiAtSunsetLastDay, tithiEndDay } from "./hindu/tithi";

/**
 * Hindu lunisolar festivals computed offline with `panchang-ts` (MIT; no festival table ships
 * with the package because dates are observer-dependent). Convention, stated on every row:
 * Ujjain reference observer (the package's `TRADITIONAL_REFERENCE`), IST civil dates, Lahiri
 * ayanamsa, purnimanta months — Diwali is the Lakshmi Puja day (Kartika Amavasya), Holi the
 * Rangwali day after Holika Dahan, Chhath the Sandhya Arghya evening. Only the marquee
 * whitelist in ./hindu/festivals.ts is emitted with descriptions; the long tail is behind
 * `HINDU_INCLUDE_ALL=true` with an empty description.
 *
 * Holi is never read from the table: the engine's `holi` rule is "Purnima current at sunrise",
 * which lands on Holika Dahan rather than Rangwali Holi whenever Purnima outlasts sunset
 * (6 of the 15 years). The row is computed with the pradosha rule instead — the last day
 * Phalguna Purnima is running at Ujjain sunset is Holika Dahan and Rangwali Holi is the next
 * day (`external_ids.derived = "purnima-at-sunset+1"`, `external_ids.holika_dahan`).
 *
 * Zero network requests. One unit per year (15 years ≈ 2 s of CPU in total); the cursor is
 * content-addressed (`{ start, afterYear }`), never an index. Dates beyond the far-future
 * cutoff cannot occur (start + 14 < now + 15 y). No Panchang API exists that permits this use
 * (drikpanchang, prokerala and timeanddate are proprietary and bot-blocked): do not add one.
 *
 * Table gaps: roughly once a decade per festival the tithi never touches the engine's anchor
 * (a kshaya tithi) and the table skips the year. For the keys in TITHI_FALLBACKS the day is then
 * recovered from the tithi's end instant (confidence 0.7, `external_ids.derived`); other
 * whitelist keys missing for a year are logged and left out.
 */

export const YEARS = 15;
export const TIMEZONE = "Asia/Kolkata";
export const TZ_OFFSET_MINUTES = 330;
/** Matches the `hindu` row of public.sources (migration 0008); the repository is https://github.com/ishankgupta95/panchang. */
export const SOURCE_URL = "https://www.npmjs.com/package/panchang-ts";
export const LOCATION = TRADITIONAL_REFERENCE;
const NOTE = "Date computed for the Ujjain reference observer (Lahiri ayanamsa); local almanacs may differ by a day.";
const RANGE_NOTE = "The observance spans both days shown; almanacs differ on which one carries the main rituals.";
/** Same-key entries this many days apart or less are one observance with a date range, not two festivals. */
const RANGE_MAX_DAYS = 2;

export type HinduUnit = Unit & { year: number };
type Cursor = { start: number; afterYear: number };

export type YearOptions = {
  includeAll?: boolean;
  /** Set to false to skip the kshaya getDailyPanchang scans (tests over a fixture only); the Holi scan always runs. */
  fallbacks?: boolean;
};

export function includeAllFromEnv(): boolean {
  return /^(1|true|yes)$/i.test(String(process.env.HINDU_INCLUDE_ALL ?? ""));
}

/** One-year festival table for the reference observer. Exported so tests can snapshot a fixture. */
export function buildYearTable(year: number): FestivalsFile {
  return buildFestivalsTable({
    location: LOCATION,
    timezoneOffsetMinutes: TZ_OFFSET_MINUTES,
    startYear: year,
    endYear: year,
    languages: ["en"],
    referenceLocation: "Ujjain",
    generatedAt: "",
  });
}

type Occurrence = { date: string; entry: FestivalTableEntry };

/** Table days → key → date-sorted occurrences (sankranti keys apart from the generic marker are kept). */
export function groupByKey(days: readonly FestivalTableDay[]): Map<string, Occurrence[]> {
  const byKey = new Map<string, Occurrence[]>();
  for (const day of days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date)) continue;
    for (const entry of day.festivals) {
      if (!entry?.key || !LONG_TAIL_TYPES.has(entry.type)) continue;
      const list = byKey.get(entry.key) ?? [];
      list.push({ date: day.date, entry });
      byKey.set(entry.key, list);
    }
  }
  for (const list of byKey.values()) list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return byKey;
}

function daysApart(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

type Resolved = {
  date: string;
  endDate?: string;
  confidence: number;
  alt?: string[];
  derived?: string;
  holikaDahan?: string;
  /** `tentative` when the engine offers candidates too far apart to be one observance. */
  status?: "tentative";
};

/**
 * One date per (year, key). The engine emits two consecutive days when a tithi straddles the
 * anchor (Raksha Bandhan after Bhadra, a Purnima at two sunrises): that is one observance
 * spanning both days, so `date` is the EARLIER candidate and `end_date` the later one — the
 * countdown targets the first day the tithi is current, which is the almanac's pick for
 * sunrise-anchored keys but not necessarily for pradosha/aparahna/madhyahna keys (Chhath,
 * Raksha Bandhan, Rama Navami); the range and RANGE_NOTE make that explicit rather than
 * guessing. Occurrences further apart (Onam's Thiruvonam nakshatra twice in Chingam, 2032
 * and 2035) are a genuine ambiguity: the row keeps the first date but is `tentative` (the UI
 * shows "expected" without a clock) and sits below the 0.6 indexability threshold; the other
 * candidates are kept in `alt_dates` until one is verified against a Kerala almanac.
 */
export function resolveOccurrences(occ: readonly Occurrence[]): Resolved {
  const first = occ[0].date;
  if (occ.length === 1) return { date: first, confidence: 0.8 };
  const last = occ[occ.length - 1].date;
  if (daysApart(first, last) <= RANGE_MAX_DAYS) {
    return { date: first, endDate: last, confidence: 0.7, alt: occ.slice(1).map((o) => o.date) };
  }
  return { date: first, confidence: 0.55, alt: occ.slice(1).map((o) => o.date), status: "tentative" };
}

/**
 * Rangwali Holi for a year by the pradosha rule (drikpanchang convention): Holika Dahan is the
 * last civil day Phalguna Purnima prevails at Ujjain sunset and Holi is the day after. Should
 * no sunset fall inside Purnima at all (not the case 2026–2040) the tithi's end day stands in
 * for Holika Dahan. Null only when the engine finds no Phalguna Purnima in the window.
 */
export function holiForYear(year: number): { date: string; holikaDahan: string; derived: string } | null {
  const rule = TITHI_FALLBACKS.holi;
  const atSunset = tithiAtSunsetLastDay(year, rule, LOCATION);
  if (atSunset) return { date: addDays(atSunset, 1), holikaDahan: atSunset, derived: "purnima-at-sunset+1" };
  const end = tithiEndDay(year, rule, LOCATION);
  return end ? { date: addDays(end, 1), holikaDahan: end, derived: "purnima-end+1" } : null;
}

function baseTags(key: string, extra: readonly string[] = []): string[] {
  return ["hindu", "panchang", "india", key.replace(/_/g, "-"), ...extra];
}

/**
 * Rows for one year from its table days. Pure apart from the optional tithi fallback scans
 * (deterministic, offline). `source_key = hindu:<year>:<key>`; a long-tail key that recurs
 * within the year gets `:<MM-DD>` appended from its second occurrence on.
 */
export function rowsForYear(days: readonly FestivalTableDay[], year: number, now: Date, opts: YearOptions = {}, log?: IngestContext["log"]): IngestEvent[] {
  const byKey = groupByKey(days);
  const rows: IngestEvent[] = [];
  const missing: string[] = [];
  let filled = 0;

  for (const [key, spec] of Object.entries(HINDU_FESTIVALS)) {
    const occ = byKey.get(key);
    let resolved: Resolved | null;
    if (key === "holi") {
      const holi = holiForYear(year);
      resolved = holi && holi.date.startsWith(String(year)) ? { date: holi.date, confidence: 0.8, derived: holi.derived, holikaDahan: holi.holikaDahan } : null;
    } else {
      resolved = occ?.length ? resolveOccurrences(occ) : null;
    }
    if (!resolved && key !== "holi" && opts.fallbacks !== false && TITHI_FALLBACKS[key]) {
      const day = tithiEndDay(year, TITHI_FALLBACKS[key], LOCATION);
      if (day && day.startsWith(String(year))) {
        resolved = { date: day, confidence: 0.7, derived: "tithi-end" };
        filled++;
      }
    }
    if (!resolved) {
      missing.push(key);
      continue;
    }
    if (!isFutureOrFar(resolved.date, "day", now)) continue;
    if (resolved.status === "tentative") log?.warn(`${year}: ${key} has candidates ${[resolved.date, ...(resolved.alt ?? [])].join(", ")} more than ${RANGE_MAX_DAYS} days apart; emitted tentative`);
    rows.push(
      buildEvent({
        title: spec.title,
        date: resolved.date,
        endDate: resolved.endDate,
        category: "religion",
        tags: baseTags(key, spec.tags),
        regions: spec.regions,
        description: `${spec.description} ${NOTE}${resolved.endDate ? ` ${RANGE_NOTE}` : ""}`,
        source: "hindu",
        sourceUrl: SOURCE_URL,
        sourceKey: `hindu:${year}:${key}`,
        featured: Boolean(spec.featured),
        popularity: spec.popularity,
        datePrecision: "day",
        status: resolved.status ?? "scheduled",
        confidence: resolved.confidence,
        timezone: TIMEZONE,
        externalIds: {
          panchang_key: key,
          ...(resolved.alt ? { alt_dates: resolved.alt } : {}),
          ...(resolved.derived ? { derived: resolved.derived } : {}),
          ...(resolved.holikaDahan ? { holika_dahan: resolved.holikaDahan } : {}),
        },
        raw: occ ? occ.map((o) => ({ date: o.date, ...o.entry })) : { derived: resolved.derived, key },
      }),
    );
  }

  if (opts.includeAll) {
    for (const [key, occ] of byKey) {
      if (HINDU_FESTIVALS[key] || LONG_TAIL_EXCLUDED.has(key)) continue;
      occ.forEach((o, i) => {
        if (!isFutureOrFar(o.date, "day", now)) return;
        const name = String(o.entry.name ?? "").trim();
        if (name.length < 2) return;
        rows.push(
          buildEvent({
            title: name,
            date: o.date,
            category: "religion",
            tags: baseTags(key, ["long-tail"]),
            regions: ["IN"],
            description: "",
            source: "hindu",
            sourceUrl: SOURCE_URL,
            sourceKey: i === 0 ? `hindu:${year}:${key}` : `hindu:${year}:${key}:${o.date.slice(5)}`,
            popularity: 20,
            datePrecision: "day",
            status: "scheduled",
            confidence: 0.8,
            timezone: TIMEZONE,
            externalIds: { panchang_key: key },
            raw: { date: o.date, ...o.entry },
          }),
        );
      });
    }
  }

  rows.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  if (missing.length) log?.warn(`${year}: not in the table and no fallback: ${missing.join(", ")}`);
  log?.info(`${year}: ${days.length} table days → ${rows.length} rows` + (filled ? ` (${filled} kshaya day(s) recovered from tithi end)` : ""));
  return rows;
}

export function parseCursor(cursor: Json | null, start: number): Cursor {
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    const c = cursor as { start?: unknown; afterYear?: unknown };
    if (c.start === start && typeof c.afterYear === "number" && Number.isInteger(c.afterYear)) return { start, afterYear: c.afterYear };
  }
  return { start, afterYear: start - 1 };
}

/** One unit per year of `start .. start + YEARS - 1` after the cursor year. Exported for tests. */
export function planUnits(start: number, afterYear: number): HinduUnit[] {
  const units: HinduUnit[] = [];
  for (let year = Math.max(start, afterYear + 1); year < start + YEARS; year++) {
    units.push({ key: `hindu:${year}`, label: `festivals ${year}`, after: { start, afterYear: year }, year });
  }
  return units;
}

export const adapter: Adapter<HinduUnit> = {
  id: "hindu",
  label: "Computed Hindu festivals (panchang-ts)",
  rank: 6,
  cadence: "monthly",
  isConfigured: () => true,
  limits: { concurrency: 1, minIntervalMs: 0, timeoutMs: 30_000, maxRetries: 0 },

  async plan(cursor, ctx): Promise<Plan<HinduUnit>> {
    const start = ctx.now.getUTCFullYear();
    const { afterYear } = parseCursor(cursor, start);
    return { units: planUnits(start, afterYear), done: true };
  },

  async run(unit, ctx) {
    const table = buildYearTable(unit.year);
    const days = readFestivalsForYear(table, unit.year, "en");
    if (!days) throw new Error(`panchang-ts returned no table for ${unit.year}`);
    return rowsForYear(days, unit.year, ctx.now, { includeAll: includeAllFromEnv() }, ctx.log);
  },
};
