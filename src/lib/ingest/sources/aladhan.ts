import { buildEvent, classify, farFutureCutoffMs, isFarFuture, isFutureOrFar, pad2 } from "../normalize";
import type { Adapter, IngestContext, IngestEvent, Json, Plan, Unit } from "../types";
import { crossCheckWithDateHolidays } from "./aladhan/crosscheck";

/**
 * Major Islamic observances for the next ~15 years, dated with the AlAdhan Hijri calendar API
 * (`GET https://api.aladhan.com/v1/hToGCalendar/{hijriMonth}/{hijriYear}`, no key).
 *
 * Coverage is a curated whitelist of 11 observances per Hijri year (Islamic New Year, Ashura,
 * Mawlid, Isra and Mi'raj, Laylat al-Bara'at, Ramadan begins, Laylat al-Qadr, Eid al-Fitr, Day of
 * Arafah, Eid al-Adha, Hajj); the ~60 Naqshbandi urs the API also lists are ignored. Dates are
 * arithmetic (method `HJCoSA`, Umm al-Qura style), so every row is `tentative` with confidence 0.7
 * and the tag `moon-sighting`: the real observance may shift by a day or two with local sighting.
 *
 * Unit = one Hijri year (7 month calls: 1, 3, 7, 8, 9, 10, 12). The cursor is the last Hijri year
 * upserted (`{ afterHijriYear }`), never an array index, so a pass resumed on a later day sees the
 * same remaining years. A month whose fetch fails throws and the runner retries the unit; a row is
 * skipped (with a warning) when the API's Gregorian date is more than a few days from the tabular
 * Islamic calendar, which catches a wrong year/month coming back. Rows for Eid al-Fitr, Eid al-Adha,
 * Ramadan, Islamic New Year and Mawlid are cross-checked against date-holidays (SA/AE/EG) and a
 * gap > 2 days is logged.
 *
 * Rate limit: the API answers with `ratelimit-limit: 12` (per second, verified 2026-09-09) and
 * `cache-control: public, max-age=7200`; we send 2 req/s at most. Terms: aladhan.com
 * "© 2013–2026 Islamic Network and respective contributors" (/credits-and-terms); calendar dates
 * are facts. `sources.attribution = "Islamic calendar dates via AlAdhan (aladhan.com)"`. No images.
 *
 * Rejected alternatives (see the Phase 4 brief §20): Calendarific / HolidayAPI / Abstract API
 * (paid, previous-year-only or non-commercial free tiers); timeanddate.com (proprietary, bot-blocked).
 */

export const ALADHAN_BASE = "https://api.aladhan.com/v1/hToGCalendar";
export const SOURCE_ID = "aladhan" as const;

/** Hijri months the whitelist needs, fetched in this order. */
export const HIJRI_MONTHS = [1, 3, 7, 8, 9, 10, 12] as const;

/** Tolerated distance (days) between the API's date and the tabular Islamic calendar. */
export const MAX_TABULAR_DRIFT_DAYS = 4;
/** A Hijri year is included while its (tabular) end is at most this far in the past. */
const PAST_GRACE_DAYS = 30;

const MOON_SENTENCE = "The date is computed from the Hijri calendar and may shift by a day or two depending on local moon sighting.";

export type Observance = {
  key: string;
  title: string;
  month: number;
  day: number;
  /** Last day of a multi-day observance (same Hijri month). */
  endDay?: number;
  popularity: number;
  featured?: boolean;
  description: string;
};

export const OBSERVANCES: readonly Observance[] = [
  {
    key: "islamic-new-year",
    title: "Islamic New Year",
    month: 1,
    day: 1,
    popularity: 40,
    description:
      "The first day of Muharram opens a new year of the Islamic lunar calendar. Many Muslims mark it quietly with reflection and prayer rather than festivities.",
  },
  {
    key: "ashura",
    title: "Ashura",
    month: 1,
    day: 10,
    popularity: 35,
    description:
      "The tenth day of Muharram is observed with fasting by Sunni Muslims and with mourning for Husayn ibn Ali by Shia communities. Processions and commemorations take place in many countries.",
  },
  {
    key: "mawlid",
    title: "Mawlid al-Nabi",
    month: 3,
    day: 12,
    popularity: 35,
    description:
      "Mawlid al-Nabi commemorates the birth of the Prophet Muhammad on 12 Rabi al-Awwal. It is a public holiday in many Muslim-majority countries, marked with gatherings, recitations and charity.",
  },
  {
    key: "isra-miraj",
    title: "Isra and Mi'raj",
    month: 7,
    day: 27,
    popularity: 20,
    description:
      "Isra and Mi'raj commemorates the Prophet Muhammad's night journey to Jerusalem and ascension to heaven. The night of 27 Rajab is marked with prayers and storytelling in many communities.",
  },
  {
    key: "laylat-al-baraat",
    title: "Laylat al-Bara'at",
    month: 8,
    day: 15,
    popularity: 20,
    description:
      "Laylat al-Bara'at, the night of 15 Sha'ban, is observed with prayers and remembrance in many Muslim communities. It falls two weeks before the start of Ramadan.",
  },
  {
    key: "ramadan-begins",
    title: "Ramadan begins",
    month: 9,
    day: 1,
    popularity: 60,
    featured: true,
    description:
      "The first day of Ramadan opens a month of dawn-to-dusk fasting for Muslims around the world. Nightly prayers, family meals and charity mark the holiest month of the Islamic year.",
  },
  {
    key: "laylat-al-qadr",
    title: "Laylat al-Qadr",
    month: 9,
    day: 27,
    popularity: 40,
    description:
      "Laylat al-Qadr, the Night of Power, is traditionally observed on the 27th night of Ramadan. Muslims spend the night in prayer, believing it to be the night the Quran was first revealed.",
  },
  {
    key: "eid-al-fitr",
    title: "Eid al-Fitr",
    month: 10,
    day: 1,
    popularity: 60,
    featured: true,
    description:
      "Eid al-Fitr marks the end of Ramadan with communal prayers, festive meals and gifts. It is a public holiday across the Muslim world and one of the two major Islamic festivals.",
  },
  {
    key: "day-of-arafah",
    title: "Day of Arafah",
    month: 12,
    day: 9,
    popularity: 20,
    description:
      "The Day of Arafah, 9 Dhu al-Hijjah, is the climax of the Hajj pilgrimage when pilgrims gather on the plain of Arafat. Muslims not on pilgrimage often fast on this day.",
  },
  {
    key: "eid-al-adha",
    title: "Eid al-Adha",
    month: 12,
    day: 10,
    endDay: 13,
    popularity: 55,
    featured: true,
    description:
      "Eid al-Adha, the Festival of Sacrifice, commemorates Ibrahim's willingness to sacrifice his son. Celebrated over several days at the end of the Hajj, it is marked with prayers, the sharing of meat and family visits.",
  },
  {
    key: "hajj",
    title: "Hajj",
    month: 12,
    day: 8,
    endDay: 13,
    popularity: 40,
    description:
      "The Hajj pilgrimage to Mecca takes place from 8 to 13 Dhu al-Hijjah and is a once-in-a-lifetime obligation for Muslims who are able. Millions of pilgrims gather for the rites at Mina, Arafat and Muzdalifah.",
  },
];

/** One `data[]` entry of `hToGCalendar` (only the fields we read). */
export type HijriDay = {
  hijri?: {
    date?: string;
    day?: string | number;
    month?: { number?: number; en?: string };
    year?: string | number;
    holidays?: string[];
    method?: string;
  };
  gregorian?: { date?: string };
};

export type HijriMonthResponse = { code?: number; status?: string; data?: HijriDay[] };

export function monthUrl(hijriMonth: number, hijriYear: number): string {
  return `${ALADHAN_BASE}/${hijriMonth}/${hijriYear}`;
}

/** `DD-MM-YYYY` (AlAdhan's Gregorian format) → `YYYY-MM-DD`, or null when malformed. */
export function parseGregorian(s: string | undefined): string | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  // Date.UTC rolls an impossible day over (31 Feb → 3 Mar): require an exact round trip.
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Tabular (arithmetic, 30-year cycle) Islamic calendar → UTC midnight in ms. Used only as a
 * sanity bound: Umm al-Qura style dates stay within ±2 days of it.
 */
export function tabularIslamicToUtcMs(h: number, m: number, d: number): number {
  const jdn = Math.floor((11 * h + 3) / 30) + 354 * h + 30 * m - Math.floor((m - 1) / 2) + d + 1948440 - 385;
  return (jdn - 2440588) * 86_400_000;
}

/** Hijri years whose (tabular) span intersects `now − 30 d … now + 15 y`. */
export function hijriYearsFor(now: Date): number[] {
  const lower = now.getTime() - PAST_GRACE_DAYS * 86_400_000;
  const upper = farFutureCutoffMs(now);
  // 1 AH began in 622 CE; one Hijri year ≈ 0.97 Gregorian years.
  let h = Math.floor((now.getUTCFullYear() - 622) / 0.970229) - 1;
  while (tabularIslamicToUtcMs(h + 1, 1, 1) <= lower) h++;
  const years: number[] = [];
  for (; tabularIslamicToUtcMs(h, 1, 1) < upper; h++) years.push(h);
  return years;
}

export type AladhanUnit = Unit & { hijriYear: number };
type Cursor = { afterHijriYear: number | null };

export function parseCursor(cursor: Json | null): Cursor {
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    const c = cursor as { afterHijriYear?: unknown };
    if (typeof c.afterHijriYear === "number" && Number.isInteger(c.afterHijriYear) && c.afterHijriYear > 0) {
      return { afterHijriYear: c.afterHijriYear };
    }
  }
  return { afterHijriYear: null };
}

export function planUnits(years: readonly number[], afterHijriYear: number | null): AladhanUnit[] {
  return years
    .filter((h) => afterHijriYear === null || h > afterHijriYear)
    .map((h) => ({ key: `aladhan:${h}`, label: `Hijri year ${h} AH`, after: { afterHijriYear: h }, hijriYear: h }));
}

/** Index a month response by Hijri day after checking it is the month/year that was asked for. */
export function indexMonth(res: HijriMonthResponse, hijriMonth: number, hijriYear: number): Map<number, HijriDay> {
  const data = Array.isArray(res?.data) ? res.data : null;
  if (!data || res.code !== 200) throw new Error(`hToGCalendar/${hijriMonth}/${hijriYear}: unexpected response (code ${res?.code ?? "?"})`);
  const byDay = new Map<number, HijriDay>();
  for (const entry of data) {
    const month = Number(entry?.hijri?.month?.number);
    const year = Number(entry?.hijri?.year);
    const day = Number(entry?.hijri?.day);
    if (month !== hijriMonth || year !== hijriYear) {
      throw new Error(`hToGCalendar/${hijriMonth}/${hijriYear}: got ${month}/${year} back`);
    }
    if (Number.isInteger(day) && day >= 1 && day <= 30) byDay.set(day, entry);
  }
  if (byDay.size === 0) throw new Error(`hToGCalendar/${hijriMonth}/${hijriYear}: empty month`);
  return byDay;
}

function trimRaw(entry: HijriDay): Json {
  return {
    hijri: {
      date: entry.hijri?.date ?? null,
      day: entry.hijri?.day === undefined ? null : String(entry.hijri.day),
      month: { number: entry.hijri?.month?.number ?? null, en: entry.hijri?.month?.en ?? null },
      year: entry.hijri?.year === undefined ? null : String(entry.hijri.year),
      holidays: (entry.hijri?.holidays ?? []).map(String),
      method: entry.hijri?.method ?? null,
    },
    gregorian: { date: entry.gregorian?.date ?? null },
  };
}

/** Distance in days between an ISO day and the tabular date for the same Hijri day. */
export function tabularDrift(iso: string, h: number, m: number, d: number): number {
  return Math.abs(Date.parse(`${iso}T00:00:00Z`) - tabularIslamicToUtcMs(h, m, d)) / 86_400_000;
}

/**
 * Build the rows for one Hijri year from the indexed months (pure). `months` maps Hijri month →
 * day → entry; a missing month or day skips its observances with a warning.
 */
export function buildYearRows(hijriYear: number, months: ReadonlyMap<number, ReadonlyMap<number, HijriDay>>, now: Date, log?: IngestContext["log"]): IngestEvent[] {
  const rows: IngestEvent[] = [];
  const seen = new Set<string>();
  for (const o of OBSERVANCES) {
    const month = months.get(o.month);
    const entry = month?.get(o.day);
    const iso = parseGregorian(entry?.gregorian?.date);
    if (!entry || !iso) {
      log?.warn(`${hijriYear} ${o.key}: no Gregorian date for ${o.month}/${o.day}`);
      continue;
    }
    const drift = tabularDrift(iso, hijriYear, o.month, o.day);
    if (drift > MAX_TABULAR_DRIFT_DAYS) {
      log?.warn(`${hijriYear} ${o.key}: ${iso} is ${drift} days from the tabular date; skipped`);
      continue;
    }
    let endDate: string | undefined;
    if (o.endDay) {
      const endIso = parseGregorian(month?.get(o.endDay)?.gregorian?.date);
      if (endIso && endIso > iso && tabularDrift(endIso, hijriYear, o.month, o.endDay) <= MAX_TABULAR_DRIFT_DAYS) endDate = endIso;
      else log?.warn(`${hijriYear} ${o.key}: end day ${o.endDay} missing or inconsistent; stored without end_date`);
    }
    const tags = ["islamic", "hijri", "aladhan", "moon-sighting", o.key, ...classify(o.title, "religion").tags];
    if (!isFutureOrFar(iso, "day", now)) continue;
    if (isFarFuture(iso, tags, now)) continue;
    const sourceKey = `aladhan:${hijriYear}:${o.key}`;
    if (seen.has(sourceKey)) continue;
    seen.add(sourceKey);
    rows.push(
      buildEvent({
        title: o.title,
        date: iso,
        endDate,
        category: "religion",
        tags,
        regions: ["GLOBAL"],
        description: `${o.description} ${MOON_SENTENCE}`,
        source: SOURCE_ID,
        sourceUrl: monthUrl(o.month, hijriYear),
        sourceKey,
        featured: Boolean(o.featured),
        popularity: o.popularity,
        allDay: true,
        timezone: null,
        datePrecision: "day",
        status: "tentative",
        confidence: 0.7,
        externalIds: { hijri: `${hijriYear}-${pad2(o.month)}-${pad2(o.day)}` },
        raw: trimRaw(entry),
      }),
    );
  }
  return rows;
}

export const adapter: Adapter<AladhanUnit> = {
  id: SOURCE_ID,
  label: "AlAdhan Hijri calendar",
  rank: 5,
  cadence: "weekly",
  isConfigured: () => true,
  // Published limit is 12 req/s (`ratelimit-limit` header); 500 ms spacing keeps us at ≤ 2 req/s.
  limits: { concurrency: 1, minIntervalMs: 500, timeoutMs: 20_000, maxRetries: 3 },

  async plan(cursor, ctx): Promise<Plan<AladhanUnit>> {
    const { afterHijriYear } = parseCursor(cursor);
    return { units: planUnits(hijriYearsFor(ctx.now), afterHijriYear), done: true };
  },

  async run(unit, ctx) {
    const months = new Map<number, Map<number, HijriDay>>();
    for (const m of HIJRI_MONTHS) {
      const res = await ctx.http.fetchJson<HijriMonthResponse>(monthUrl(m, unit.hijriYear));
      months.set(m, indexMonth(res, m, unit.hijriYear));
    }
    const rows = buildYearRows(unit.hijriYear, months, ctx.now, ctx.log);
    const mismatches = await crossCheckWithDateHolidays(rows, ctx.log);
    ctx.log.info(`${unit.label}: ${rows.length} rows` + (mismatches ? ` (${mismatches} date-holidays mismatch(es) > 2 days)` : ""));
    return rows;
  },
};
