import Holidays from "date-holidays";
import { buildEvent, classify, FEATURED_NAMES, isFutureOrFar, slugBase } from "../normalize";
import type { Adapter, IngestContext, IngestEvent, Json, Plan, Unit } from "../types";

/**
 * Public holidays from the `date-holidays` package (offline, 200+ countries, CC BY-SA 3.0 data;
 * attribution "Holiday data from date-holidays" is stored on `public.sources`).
 *
 * The whole holiday set is computed once per pass (about 1 s) and merged across countries
 * (regions union, description/popularity/featured rules ported from scripts/lib/seed-sources.mjs
 * `loadHolidays`) before it is split into units, so a partial run still emits fully-merged rows.
 * Units are ranges of the slug-sorted result; the cursor is content-addressed
 * (`{ year, afterSlug }` = the last slug already upserted) because the set is filtered by "now":
 * a resume days later must not shift positions and silently skip rows.
 *
 * Titles without Latin letters (e.g. Tunisia's Arabic holiday names) get the slug base
 * `holiday-<cc>-<digest>` instead of an empty base.
 */

const YEARS_AHEAD = 7; // this year .. +6
const UNIT_SIZE = 400;
const SOURCE_URL = "https://github.com/commenthol/date-holidays";

type HolidayUnit = Unit & { start: number; end: number };
type Cursor = { year: number; afterSlug: string | null };

let cache: { key: string; rows: IngestEvent[] } | null = null;

export function countryNames(): Record<string, string> {
  const hd = new Holidays();
  const countries = hd.getCountries("en") ?? {};
  const out: Record<string, string> = { GLOBAL: "Worldwide" };
  for (const code of Object.keys(countries).sort()) out[code.toUpperCase()] = countries[code];
  return out;
}

type Draft = {
  title: string;
  date: string;
  regions: string[];
  featured: boolean;
  popularity: number;
  category: ReturnType<typeof classify>["category"];
  tags: string[];
};

/** All public holidays for `startYear .. startYear+6`, merged across countries. Pure and offline. */
export function computeHolidayRows(startYear: number, now: Date, log?: IngestContext["log"]): IngestEvent[] {
  const names = countryNames();
  const codes = Object.keys(names).filter((c) => c !== "GLOBAL");
  const years = Array.from({ length: YEARS_AHEAD }, (_, i) => startYear + i);
  const map = new Map<string, Draft>();
  let raw = 0;
  let skippedCountries = 0;
  let fallbackSlugs = 0;
  for (const code of codes) {
    let hd: Holidays;
    try {
      hd = new Holidays(code, { languages: ["en"], types: ["public"] });
    } catch (err) {
      skippedCountries++;
      log?.warn(`${code}: init failed (${(err as Error).message})`);
      continue;
    }
    for (const year of years) {
      let list: ReturnType<Holidays["getHolidays"]>;
      try {
        list = hd.getHolidays(year) ?? [];
      } catch (err) {
        log?.warn(`${code} ${year}: ${(err as Error).message}`);
        continue;
      }
      for (const h of list) {
        if (!h || h.substitute) continue;
        if (h.type && h.type !== "public") continue;
        const name = String(h.name ?? "").trim();
        if (!name) continue;
        const day = String(h.date ?? "").slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
        raw++;
        const base = slugBase(name, `holiday-${code}`);
        const key = `${base}|${day}`;
        const existing = map.get(key);
        if (!existing) {
          if (base.startsWith("holiday-")) fallbackSlugs++;
          const { category, tags } = classify(name, "holidays");
          const featured = FEATURED_NAMES.test(name);
          map.set(key, {
            title: name,
            date: day,
            regions: [code],
            featured,
            popularity: featured ? 70 : 30,
            category: tags.includes("national") ? "national" : category,
            tags,
          });
        } else if (!existing.regions.includes(code)) {
          existing.regions.push(code);
        }
      }
    }
  }

  const rows: IngestEvent[] = [];
  for (const d of map.values()) {
    if (!isFutureOrFar(d.date, "day", now)) continue;
    const n = d.regions.length;
    const popularity = Math.min(99, d.popularity + Math.floor(Math.log2(n + 1) * 8));
    const featured = d.featured || n >= 25;
    let description: string;
    if (n >= 8) description = `Observed in ${n} countries and territories.`;
    else if (n === 1) description = `Public holiday in ${names[d.regions[0]] ?? d.regions[0]}.`;
    else description = `Observed in ${d.regions.map((c) => names[c] ?? c).slice(0, 6).join(", ")}${n > 6 ? "…" : ""}.`;
    const ev = buildEvent({
      title: d.title,
      date: d.date,
      category: d.category,
      tags: d.tags,
      regions: d.regions,
      description,
      source: "holidays",
      sourceUrl: SOURCE_URL,
      featured,
      popularity,
      datePrecision: "day",
      status: "scheduled",
      confidence: 1,
      slugFallbackPrefix: `holiday-${d.regions[0]}`,
    });
    rows.push(ev); // source_key defaults to `holidays:<slug>`
  }
  rows.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  log?.info(
    `date-holidays: ${codes.length} countries × ${years.length} years, ${raw} raw → ${rows.length} merged rows` +
      (skippedCountries ? ` (${skippedCountries} countries skipped)` : "") +
      (fallbackSlugs ? ` (${fallbackSlugs} non-Latin titles given a digest slug)` : ""),
  );
  return rows;
}

/** Cache key: the pass year and the UTC day of `now` (the set is filtered by `now`). */
function cacheKey(year: number, now: Date): string {
  return `${year}:${now.toISOString().slice(0, 10)}`;
}

function rowsFor(year: number, ctx: IngestContext): IngestEvent[] {
  const key = cacheKey(year, ctx.now);
  if (!cache || cache.key !== key) cache = { key, rows: computeHolidayRows(year, ctx.now, ctx.log) };
  return cache.rows;
}

export function parseCursor(cursor: Json | null, year: number): Cursor {
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    const c = cursor as { year?: unknown; afterSlug?: unknown };
    if (c.year === year && typeof c.afterSlug === "string" && c.afterSlug) return { year, afterSlug: c.afterSlug };
  }
  return { year, afterSlug: null };
}

/** Index of the first row whose slug sorts after `afterSlug` (rows are slug-sorted); 0 for a fresh pass. */
export function resumeIndex(rows: readonly { slug: string }[], afterSlug: string | null): number {
  if (!afterSlug) return 0;
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (rows[mid].slug <= afterSlug) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Split slug-sorted rows into resumable units of `size` starting at `from`. Exported for tests. */
export function planUnits(rows: readonly IngestEvent[], year: number, afterSlug: string | null, size = UNIT_SIZE): HolidayUnit[] {
  const units: HolidayUnit[] = [];
  for (let start = resumeIndex(rows, afterSlug); start < rows.length; start += size) {
    const end = Math.min(rows.length, start + size);
    units.push({
      key: `holidays:${year}:${rows[start].slug}`,
      label: `rows ${start}–${end - 1} of ${rows.length}`,
      after: { year, afterSlug: rows[end - 1].slug },
      start,
      end,
    });
  }
  return units;
}

export const adapter: Adapter<HolidayUnit> = {
  id: "holidays",
  label: "date-holidays",
  rank: 1,
  cadence: "weekly",
  isConfigured: () => true,
  limits: { concurrency: 1, minIntervalMs: 0, timeoutMs: 30_000, maxRetries: 1 },

  async plan(cursor, ctx): Promise<Plan<HolidayUnit>> {
    const year = ctx.now.getUTCFullYear();
    const rows = rowsFor(year, ctx);
    const { afterSlug } = parseCursor(cursor, year);
    return { units: planUnits(rows, year, afterSlug), done: true };
  },

  async run(unit, ctx) {
    const rows = rowsFor(ctx.now.getUTCFullYear(), ctx);
    return rows.slice(unit.start, unit.end);
  },
};
