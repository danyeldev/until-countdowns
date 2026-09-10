import { buildEvent, FAR_FUTURE_YEARS, farFutureCutoffMs, isFarFuture, isFutureOrFar, pad2 } from "../normalize";
import { daysInMonth, fridays13, isLeapYear, toIso, type Ymd } from "../recurrence";
import type { Adapter, IngestContext, IngestEvent, Json, Plan, Unit } from "../types";
import { CURIOSITIES, type CuriosityEntry } from "./curiosities/data";

/**
 * Computed calendar and clock curiosities (rank 8, zero network requests): Unix-time
 * milestones and the Year 2038 overflow as exact instants, Friday the 13ths, leap days,
 * palindrome dates and Public Domain Day for `now .. now + 15 years`, plus the hand-picked
 * far-future list in ./curiosities/data.ts (time capsules, leap-second abolition, Voyager).
 *
 * Licence: pure arithmetic and public facts — `sources.attribution = null`. Wikipedia links are
 * citations only; every description is written here. Rejected for this category (never add):
 * KEO (project closed July 2025), timeanddate.com (proprietary, bot-blocked).
 *
 * Units: `unix`, `calendar:<year>` (one per horizon year) and `far-future`; each finishes in
 * milliseconds. The cursor is content-addressed (`{ afterUnit: '<unit key>' }`, the last unit
 * upserted), so a pass resumed across a month boundary continues at the same unit instead of
 * an index that may have shifted with the horizon.
 *
 * Slug collisions are intended: Friday the 13th / Leap Day / Public Domain Day are also expanded
 * by `curated` (rank 9, wins) and Public Domain Day exists on Wikidata (`observances`, rank 6,
 * loses); `upsert_events` merges tags/regions either way. Public Domain Day therefore keeps the
 * bare title (no year suffix) so its slug matches the other sources' rows.
 */

const UNIX_STEP = 100_000_000;
const Y2038 = 0x7fffffff; // 2 147 483 647 — largest signed 32-bit value
const UNIX_URL = "https://en.wikipedia.org/wiki/Unix_time";
const Y2038_URL = "https://en.wikipedia.org/wiki/Year_2038_problem";
const PUBLIC_DOMAIN_URL = "https://web.law.duke.edu/cspd/publicdomainday/";
const FRIDAY13_URL = "https://en.wikipedia.org/wiki/Friday_the_13th";
const LEAP_DAY_URL = "https://en.wikipedia.org/wiki/February_29";
const PALINDROME_URL = "https://en.wikipedia.org/wiki/Palindrome#Dates";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ORDINALS = ["first", "second", "third"];

export type CuriosityUnit = Unit & { kind: "unix" | "calendar" | "far-future"; year?: number };
type Cursor = { afterUnit: string | null };

function longDate({ y, m, d }: Ymd): string {
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function utcParts(ms: number): { day: Ymd; time: string } {
  const dt = new Date(ms);
  return {
    day: { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() },
    time: `${pad2(dt.getUTCHours())}:${pad2(dt.getUTCMinutes())}:${pad2(dt.getUTCSeconds())}`,
  };
}

/** Keep rows from yesterday onward and inside the horizon (unless tagged `far-future`). */
function inWindow(row: IngestEvent, now: Date): boolean {
  return isFutureOrFar(row.date, row.date_precision, now) && !isFarFuture(row.date, row.tags, now);
}

// ——— Unix time ———

/** Every `n × 100,000,000` seconds inside the horizon, plus the 2^31 − 1 overflow (tagged `far-future` if beyond it). */
export function unixMilestones(now: Date): IngestEvent[] {
  const nowSec = Math.floor(now.getTime() / 1000);
  const cutoffSec = Math.floor(farFutureCutoffMs(now) / 1000);
  const values: number[] = [];
  for (let n = Math.ceil((nowSec - 2 * 86_400) / UNIX_STEP) * UNIX_STEP; n <= cutoffSec; n += UNIX_STEP) values.push(n);
  if (Y2038 > nowSec - 2 * 86_400 && !values.includes(Y2038)) values.push(Y2038);
  values.sort((a, b) => a - b);

  const rows: IngestEvent[] = [];
  for (const n of values) {
    const ms = n * 1000;
    const { day, time } = utcParts(ms);
    const pretty = n.toLocaleString("en-US");
    const isOverflow = n === Y2038;
    const tags = ["unix-time", "tech", "computed"];
    if (isOverflow) tags.push("y2038");
    if (ms > farFutureCutoffMs(now)) tags.push("far-future");
    const title = isOverflow ? "Year 2038 problem: 32-bit Unix time overflows" : `Unix time reaches ${pretty}`;
    const description = isOverflow
      ? `At ${time} UTC on ${longDate(day)} the count of seconds since 1 January 1970 passes ${pretty}, the largest value a signed 32-bit integer can hold. Software that still stores time in 32 bits wraps around to December 1901 at that instant unless it has been patched.`
      : `At ${time} UTC on ${longDate(day)} the Unix clock, the count of seconds since 00:00:00 UTC on 1 January 1970, ticks over to ${pretty}. Programmers mark these round-number seconds as unofficial holidays of the epoch.`;
    const row = buildEvent({
      title,
      date: new Date(ms).toISOString(),
      category: "curiosities",
      tags,
      description,
      source: "curiosities",
      sourceUrl: isOverflow ? Y2038_URL : UNIX_URL,
      sourceKey: `curiosities:unix:${n}`,
      featured: isOverflow || n === 2_000_000_000,
      popularity: isOverflow ? 80 : n === 2_000_000_000 ? 70 : 50,
      timezone: "UTC",
      confidence: 1,
      raw: { kind: "unix", seconds: n },
    });
    if (inWindow(row, now)) rows.push(row);
  }
  return rows;
}

// ——— Calendar ———

/**
 * Palindrome dates of a year in the two common digit orders: `DDMMYYYY` (day = reversed last
 * two year digits, month = reversed first two) and `YYYYMMDD` (the mirror image). Each format
 * yields at most one date per year, and only when the digits form a real month and day.
 */
export function palindromeDates(y: number): Array<{ fmt: "dmy" | "ymd"; day: Ymd }> {
  const [y1, y2, y3, y4] = String(y).padStart(4, "0").split("");
  const out: Array<{ fmt: "dmy" | "ymd"; day: Ymd }> = [];
  const dmyMonth = Number(y2 + y1);
  const dmyDay = Number(y4 + y3);
  if (dmyMonth >= 1 && dmyMonth <= 12 && dmyDay >= 1 && dmyDay <= daysInMonth(y, dmyMonth)) out.push({ fmt: "dmy", day: { y, m: dmyMonth, d: dmyDay } });
  const ymdMonth = Number(y4 + y3);
  const ymdDay = Number(y2 + y1);
  if (ymdMonth >= 1 && ymdMonth <= 12 && ymdDay >= 1 && ymdDay <= daysInMonth(y, ymdMonth)) out.push({ fmt: "ymd", day: { y, m: ymdMonth, d: ymdDay } });
  return out;
}

/** Friday the 13ths, leap day, palindrome dates and Public Domain Day of one year. */
export function calendarRows(year: number, now: Date): IngestEvent[] {
  const rows: IngestEvent[] = [];

  const fridays = fridays13(year).slice(0, 3);
  fridays.forEach((day, i) => {
    const count = fridays.length === 1 ? "the only Friday the 13th" : `the ${ORDINALS[i]} of ${fridays.length} Friday the 13ths`;
    rows.push(
      buildEvent({
        title: "Friday the 13th",
        date: toIso(day),
        category: "curiosities",
        tags: ["friday-13th", "superstition", "calendar", "computed"],
        description: `Friday ${longDate(day)} is ${count} in ${year}; every year has at least one and never more than three. Unlucky in Western folklore, it is mostly an excuse for horror marathons today.`,
        source: "curiosities",
        sourceUrl: FRIDAY13_URL,
        sourceKey: `curiosities:friday13:${toIso(day)}`,
        popularity: 30,
        seriesSlug: "friday-the-13th",
        confidence: 1,
        raw: { kind: "friday13", date: toIso(day) },
      }),
    );
  });

  if (isLeapYear(year)) {
    const date = toIso({ y: year, m: 2, d: 29 });
    rows.push(
      buildEvent({
        title: "Leap day",
        date,
        category: "curiosities",
        tags: ["leap-day", "leap-year", "calendar", "computed"],
        description: `29 February ${year} is the extra day that keeps the Gregorian calendar in step with the seasons. Leap years come every four years, except century years that are not divisible by 400.`,
        source: "curiosities",
        sourceUrl: LEAP_DAY_URL,
        sourceKey: `curiosities:leapday:${date}`,
        popularity: 45,
        seriesSlug: "leap-day",
        confidence: 1,
        raw: { kind: "leap-day", date },
      }),
    );
  }

  for (const { fmt, day } of palindromeDates(year)) {
    const date = toIso(day);
    const shown = fmt === "dmy" ? `${pad2(day.d)}/${pad2(day.m)}/${day.y}` : date;
    const label = fmt === "dmy" ? "DD/MM/YYYY" : "YYYY-MM-DD";
    const digits = shown.replace(/\D/g, "");
    rows.push(
      buildEvent({
        title: `Palindrome date ${shown} (${label})`,
        date,
        category: "curiosities",
        tags: ["palindrome", "calendar", "computed"],
        description: `Written as ${label}, ${shown} reads the same backwards: ${digits}. Palindrome dates are rare enough that most years have at most one in each common date format.`,
        source: "curiosities",
        sourceUrl: PALINDROME_URL,
        sourceKey: `curiosities:palindrome:${fmt}:${date}`,
        popularity: 25,
        confidence: 1,
        raw: { kind: "palindrome", fmt, date },
      }),
    );
  }

  {
    const date = toIso({ y: year, m: 1, d: 1 });
    rows.push(
      buildEvent({
        title: "Public Domain Day",
        date,
        category: "curiosities",
        tags: ["public-domain", "copyright", "books", "computed"],
        regions: ["US", "GLOBAL"],
        description: `On 1 January ${year}, works first published in the United States in ${year - 96} enter the public domain under the 95-year rule. In countries with life-plus-70 copyright terms, works by authors who died in ${year - 71} become free to use the same day.`,
        source: "curiosities",
        sourceUrl: PUBLIC_DOMAIN_URL,
        sourceKey: `curiosities:pdd:${year}`,
        popularity: 45,
        seriesSlug: "public-domain-day",
        confidence: 1,
        raw: { kind: "public-domain-day", year, published: year - 96 },
      }),
    );
  }

  return rows.filter((r) => inWindow(r, now)).sort((a, b) => a.date.localeCompare(b.date) || a.slug.localeCompare(b.slug));
}

// ——— Far future / curated ———

export function curatedRows(now: Date, entries: readonly CuriosityEntry[] = CURIOSITIES, log?: IngestContext["log"]): IngestEvent[] {
  const rows: IngestEvent[] = [];
  for (const e of entries) {
    const tags = e.farFuture ? [...e.tags, "far-future", "curated"] : [...e.tags, "curated"];
    const row = buildEvent({
      title: e.title,
      date: e.date,
      category: "curiosities",
      tags,
      regions: e.regions ?? ["GLOBAL"],
      description: e.description,
      source: "curiosities",
      sourceUrl: e.sourceUrl,
      sourceKey: `curiosities:curated:${e.id}`,
      featured: Boolean(e.featured),
      popularity: e.popularity,
      datePrecision: e.datePrecision,
      status: e.status,
      confidence: 0.9,
      raw: { kind: "curated", id: e.id },
    });
    if (isFarFuture(row.date, row.tags, now)) {
      log?.warn(`dropped "${e.title}" (${e.date}): beyond now + ${FAR_FUTURE_YEARS} years without farFuture: true`);
      continue;
    }
    if (!isFutureOrFar(row.date, row.date_precision, now)) continue;
    rows.push(row);
  }
  return rows;
}

// ——— Plan / run ———

/** Fixed unit order for a pass: `unix`, one `calendar:<year>` per horizon year, then `far-future`. */
export function allUnits(now: Date): CuriosityUnit[] {
  const y0 = now.getUTCFullYear();
  const units: CuriosityUnit[] = [{ key: "unix", label: "Unix-time milestones", after: { afterUnit: "unix" }, kind: "unix" }];
  for (let year = y0; year <= y0 + FAR_FUTURE_YEARS; year++) {
    const key = `calendar:${year}`;
    units.push({ key, label: `calendar curiosities ${year}`, after: { afterUnit: key }, kind: "calendar", year });
  }
  units.push({ key: "far-future", label: "far-future and curated curiosities", after: { afterUnit: "far-future" }, kind: "far-future" });
  return units;
}

export function parseCursor(cursor: Json | null): Cursor {
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    const c = cursor as { afterUnit?: unknown };
    if (typeof c.afterUnit === "string" && c.afterUnit) return { afterUnit: c.afterUnit };
  }
  return { afterUnit: null };
}

/** Units still to run: everything after `afterUnit` in the fixed order (all of them for an unknown cursor). */
export function planUnits(now: Date, afterUnit: string | null): CuriosityUnit[] {
  const units = allUnits(now);
  if (!afterUnit) return units;
  const i = units.findIndex((u) => u.key === afterUnit);
  return i < 0 ? units : units.slice(i + 1);
}

export const adapter: Adapter<CuriosityUnit> = {
  id: "curiosities",
  label: "Computed calendar and clock curiosities",
  rank: 8,
  cadence: "monthly",
  isConfigured: () => true,
  limits: { concurrency: 1, minIntervalMs: 0, timeoutMs: 10_000, maxRetries: 0 },

  async plan(cursor, ctx): Promise<Plan<CuriosityUnit>> {
    const { afterUnit } = parseCursor(cursor);
    return { units: planUnits(ctx.now, afterUnit), done: true };
  },

  async run(unit, ctx) {
    switch (unit.kind) {
      case "unix":
        return unixMilestones(ctx.now);
      case "calendar":
        return calendarRows(unit.year ?? ctx.now.getUTCFullYear(), ctx.now);
      case "far-future":
        return curatedRows(ctx.now, CURIOSITIES, ctx.log);
    }
  },
};
