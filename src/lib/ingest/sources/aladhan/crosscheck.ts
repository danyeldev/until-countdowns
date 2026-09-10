import type { IngestEvent, IngestLogger } from "../../types";

/**
 * Sanity check of AlAdhan rows against the Islamic public holidays that `date-holidays` computes
 * for Saudi Arabia, the UAE and Egypt. A one-day gap is normal (different sighting conventions);
 * a gap above `TOLERANCE_DAYS` is logged as a warning so it shows up in the run log. The check is
 * advisory only: rows are never dropped by it and any failure inside it is swallowed.
 */

export const TOLERANCE_DAYS = 2;
export const CROSS_CHECK_COUNTRIES = ["SA", "AE", "EG"] as const;

/** Observance key → regexp matching the date-holidays English name. */
export const CROSS_CHECK_NAMES: ReadonlyArray<readonly [key: string, re: RegExp]> = [
  ["eid-al-fitr", /eid al-fitr/i],
  ["eid-al-adha", /eid al-adha/i],
  ["ramadan-begins", /first day of ramadan/i],
  ["islamic-new-year", /islamic new year/i],
  ["mawlid", /mawlid/i],
];

export type Reference = { name: string; date: string; country: string };

/** Nearest reference date for a key in the same Gregorian year, or null when none is listed. */
export function nearestReference(rowDate: string, refs: readonly Reference[]): Reference | null {
  const t = Date.parse(`${rowDate}T00:00:00Z`);
  let best: Reference | null = null;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const r of refs) {
    const gap = Math.abs(Date.parse(`${r.date}T00:00:00Z`) - t) / 86_400_000;
    if (gap < bestGap) {
      best = r;
      bestGap = gap;
    }
  }
  return best;
}

export function gapDays(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/** Pure comparison over precomputed references; returns the number of rows off by more than the tolerance. */
export function compareRows(rows: readonly IngestEvent[], refsFor: (key: string, year: number) => Reference[], log?: IngestLogger): number {
  let mismatches = 0;
  for (const row of rows) {
    const key = CROSS_CHECK_NAMES.find(([k]) => row.tags.includes(k))?.[0];
    if (!key) continue;
    const ref = nearestReference(row.date, refsFor(key, Number(row.date.slice(0, 4))));
    if (!ref) continue;
    const gap = gapDays(row.date, ref.date);
    if (gap > TOLERANCE_DAYS) {
      mismatches++;
      log?.warn(`${row.source_key}: ${row.date} is ${gap} days from date-holidays ${ref.country} "${ref.name}" (${ref.date})`);
    }
  }
  return mismatches;
}

/** Loads `date-holidays` lazily (several MB) and compares the rows; never throws. */
export async function crossCheckWithDateHolidays(rows: readonly IngestEvent[], log?: IngestLogger): Promise<number> {
  if (rows.length === 0) return 0;
  try {
    const { default: Holidays } = await import("date-holidays");
    const cache = new Map<string, Reference[]>();
    const refsFor = (key: string, year: number): Reference[] => {
      const cacheKey = `${key}:${year}`;
      const hit = cache.get(cacheKey);
      if (hit) return hit;
      const re = CROSS_CHECK_NAMES.find(([k]) => k === key)?.[1];
      const out: Reference[] = [];
      if (re) {
        for (const country of CROSS_CHECK_COUNTRIES) {
          try {
            const hd = new Holidays(country, { languages: ["en"], types: ["public"] });
            for (const h of hd.getHolidays(year) ?? []) {
              const name = String(h?.name ?? "");
              const date = String(h?.date ?? "").slice(0, 10);
              if (re.test(name) && /^\d{4}-\d{2}-\d{2}$/.test(date)) out.push({ name, date, country });
            }
          } catch {
            // a country that fails to initialise simply contributes no references
          }
        }
      }
      cache.set(cacheKey, out);
      return out;
    };
    return compareRows(rows, refsFor, log);
  } catch (err) {
    log?.warn(`date-holidays cross-check skipped: ${(err as Error)?.message ?? err}`);
    return 0;
  }
}
