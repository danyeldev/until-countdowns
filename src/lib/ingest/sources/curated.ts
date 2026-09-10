import { CURATED, type CuratedEvent } from "@/data/curated";
import { SERIES, type Recurrence, type SeriesRule } from "@/data/series";
import { getDb } from "../db";
import { buildEvent, classify, isFarFuture, isFutureOrFar, slugify } from "../normalize";
import type { IngestLogger } from "../types";
import {
  addDays,
  chineseLunarToSolar,
  dayOfYear,
  easterSunday,
  fridays13,
  isLeapYear,
  nextWeekdayAfter,
  nthWeekday,
  orthodoxEaster,
  toIso,
  type Ymd,
} from "../recurrence";
import type { Adapter, IngestContext, IngestEvent, Json, Plan, Unit } from "../types";

/**
 * Curated source (rank 9, wins every merge): the one-off list in src/data/curated.ts plus the
 * recurring series in src/data/series.ts expanded for now..now+14 years. At the start of a pass
 * the series rows and aliases are upserted into `public.series` / `public.series_aliases`
 * (skipped on dry runs) so `events.series_slug` has its foreign key target.
 *
 * The cursor is content-addressed (`{ year, afterSlug }`, see holidays.ts): the row set depends on
 * "now", so a positional index would drift between the invocations of one pass.
 * One-offs dated beyond now + 15 years must carry the `far-future` tag explicitly in
 * src/data/curated.ts; untagged ones are dropped with a warning (a typo such as 2107 for 2027
 * must not be published).
 */

const YEARS_AHEAD = 15; // this year .. +14
const FEATURED_HORIZON_YEARS = 2;
const UNIT_SIZE = 400;

type CuratedUnit = Unit & { start: number; end: number };
type Cursor = { year: number; afterSlug: string | null };

/** Every occurrence of a rule in a year (usually one; Friday the 13th has up to three). */
export function occurrencesIn(rule: Recurrence, year: number): Ymd[] {
  switch (rule.kind) {
    case "fixed":
      return [addDays({ y: year, m: rule.month, d: rule.day }, rule.offsetDays ?? 0)];
    case "nth-weekday": {
      const d = nthWeekday(year, rule.month, rule.weekday, rule.n);
      return d ? [addDays(d, rule.offsetDays ?? 0)] : [];
    }
    case "easter-offset":
      return [addDays(easterSunday(year), rule.days)];
    case "orthodox-easter-offset":
      return [addDays(orthodoxEaster(year), rule.days)];
    case "lunar-chinese":
      return [chineseLunarToSolar(year, rule.month, rule.day)];
    case "custom":
      switch (rule.rule) {
        case "programmers-day":
          return [dayOfYear(year, 256)];
        case "leap-day":
          return isLeapYear(year) ? [{ y: year, m: 2, d: 29 }] : [];
        case "friday-13th":
          return fridays13(year);
        case "oktoberfest-start":
          return [nextWeekdayAfter({ y: year, m: 9, d: 15 }, 6)];
      }
  }
  return [];
}

export function expandSeries(rule: SeriesRule, years: readonly number[], now: Date, skipYears?: Set<number>): IngestEvent[] {
  const nowYear = now.getUTCFullYear();
  const out: IngestEvent[] = [];
  for (const year of years) {
    if (skipYears?.has(year)) continue;
    for (const occ of occurrencesIn(rule.recurrence, year)) {
      const date = toIso(occ);
      if (!isFutureOrFar(date, "day", now)) continue;
      const endDate = rule.durationDays && rule.durationDays > 1 ? toIso(addDays(occ, rule.durationDays - 1)) : undefined;
      out.push(
        buildEvent({
          title: rule.title,
          date,
          endDate,
          category: rule.category,
          tags: rule.tags,
          regions: rule.regions ?? ["GLOBAL"],
          description: rule.description,
          source: "curated",
          sourceUrl: rule.sourceUrl,
          featured: Boolean(rule.featured) && year <= nowYear + FEATURED_HORIZON_YEARS,
          popularity: rule.popularity,
          datePrecision: "day",
          status: rule.status ?? "scheduled",
          confidence: rule.confidence ?? 1,
          seriesSlug: rule.slug,
        }),
      );
    }
  }
  return out;
}

export function expandCurated(list: readonly CuratedEvent[], now: Date, log?: IngestLogger): IngestEvent[] {
  const out: IngestEvent[] = [];
  for (const e of list) {
    if (e.skip || !e.date) continue;
    const precision = e.datePrecision ?? (e.date.includes("T") ? "instant" : "day");
    if (!isFutureOrFar(e.date, precision, now)) continue;
    if (isFarFuture(e.date, e.tags, now)) {
      log?.warn(`dropped "${e.title}" (${e.date}): beyond now + 15 years without the explicit "far-future" tag`);
      continue;
    }
    const { tags } = classify(e.title, e.category);
    out.push(
      buildEvent({
        title: e.title,
        date: e.date,
        endDate: e.endDate,
        category: e.category,
        tags: [...e.tags, ...tags],
        regions: e.regions.length ? e.regions : ["GLOBAL"],
        description: e.description,
        source: "curated",
        sourceUrl: e.sourceUrl,
        featured: Boolean(e.featured),
        popularity: e.popularity ?? 70,
        allDay: e.allDay !== false,
        datePrecision: e.datePrecision,
        status: e.status,
        confidence: 1,
        seriesSlug: e.series ?? null,
      }),
    );
  }
  return out;
}

/** The whole curated catalog for a pass, slug-sorted so `afterSlug` cursors resume in place. */
export function computeCuratedRows(now: Date, log?: IngestLogger): IngestEvent[] {
  const startYear = now.getUTCFullYear();
  const years = Array.from({ length: YEARS_AHEAD }, (_, i) => startYear + i);
  const linked = new Map<string, Set<number>>();
  for (const e of CURATED) {
    if (!e.series || e.skip) continue;
    const year = Number(e.date.slice(0, 4));
    if (!linked.has(e.series)) linked.set(e.series, new Set());
    linked.get(e.series)!.add(year);
  }
  const rows = [...expandCurated(CURATED, now, log)];
  for (const rule of SERIES) rows.push(...expandSeries(rule, years, now, linked.get(rule.slug)));
  const kept = rows.filter((r) => !isFarFuture(r.date, r.tags, now));
  kept.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  return kept;
}

let cache: { key: string; rows: IngestEvent[] } | null = null;

/** Cache key: the pass year and the UTC day of `now` (the set is filtered by `now`). */
function rowsFor(ctx: IngestContext): IngestEvent[] {
  const key = `${ctx.now.getUTCFullYear()}:${ctx.now.toISOString().slice(0, 10)}`;
  if (!cache || cache.key !== key) cache = { key, rows: computeCuratedRows(ctx.now, ctx.log) };
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

export function planUnits(rows: readonly IngestEvent[], year: number, afterSlug: string | null, size = UNIT_SIZE): CuratedUnit[] {
  const units: CuratedUnit[] = [];
  for (let start = resumeIndex(rows, afterSlug); start < rows.length; start += size) {
    const end = Math.min(rows.length, start + size);
    units.push({
      key: `curated:${year}:${rows[start].slug}`,
      label: `rows ${start}–${end - 1} of ${rows.length}`,
      after: { year, afterSlug: rows[end - 1].slug },
      start,
      end,
    });
  }
  return units;
}

export function seriesRows(): Array<Record<string, unknown>> {
  return SERIES.map((s) => ({
    slug: s.slug,
    title: s.title,
    description: s.description,
    category: s.category,
    tags: [...new Set(s.tags.map((t) => slugify(t)))],
    regions: s.regions ?? ["GLOBAL"],
    recurrence: s.recurrence,
    popularity: s.popularity,
    featured: Boolean(s.featured),
  }));
}

export function aliasRows(): Array<{ alias: string; series_slug: string }> {
  const out: Array<{ alias: string; series_slug: string }> = [];
  const seen = new Set<string>();
  for (const s of SERIES) {
    for (const a of s.aliases ?? []) {
      const alias = slugify(a);
      if (!alias || alias === s.slug || seen.has(alias)) continue;
      seen.add(alias);
      out.push({ alias, series_slug: s.slug });
    }
  }
  return out;
}

/**
 * Aliases must not shadow a series slug: `finalize_catalog()` auto-creates series from holiday
 * rows (e.g. `thanksgiving`, `new-year`), and an alias with the same name would give
 * `/days-until/<x>` two targets. Such aliases are skipped (and reported) until the owner retires
 * the auto-created shell. Pure, exported for tests.
 */
export function filterAliasCollisions<A extends { alias: string; series_slug: string }>(
  aliases: readonly A[],
  existingSeriesSlugs: Iterable<string>,
): { kept: A[]; collisions: A[] } {
  const taken = new Set(existingSeriesSlugs);
  const kept: A[] = [];
  const collisions: A[] = [];
  for (const a of aliases) (taken.has(a.alias) ? collisions : kept).push(a);
  return { kept, collisions };
}

async function syncSeries(ctx: IngestContext): Promise<void> {
  const db = await getDb();
  const { error } = await db.from("series").upsert(seriesRows() as never, { onConflict: "slug" });
  if (error) throw new Error(`series upsert failed: ${error.message}`);
  const aliases = aliasRows();
  let synced = 0;
  if (aliases.length) {
    const { data: existing, error: selError } = await db
      .from("series")
      .select("slug")
      .in(
        "slug",
        aliases.map((a) => a.alias),
      );
    if (selError) throw new Error(`series alias check failed: ${selError.message}`);
    const { kept, collisions } = filterAliasCollisions(aliases, ((existing ?? []) as Array<{ slug: string }>).map((r) => r.slug));
    for (const c of collisions) {
      ctx.log.warn(`alias "${c.alias}" → ${c.series_slug} skipped: a series with that slug exists (auto-created shell?); retire it or rename the alias`);
    }
    if (collisions.length) {
      // A colliding alias written by an earlier sync must not linger either (explicit list, never bulk).
      const { error: delError } = await db
        .from("series_aliases")
        .delete()
        .in(
          "alias",
          collisions.map((c) => c.alias),
        );
      if (delError) throw new Error(`series_aliases cleanup failed: ${delError.message}`);
    }
    if (kept.length) {
      const { error: aliasError } = await db.from("series_aliases").upsert(kept as never, { onConflict: "alias" });
      if (aliasError) throw new Error(`series_aliases upsert failed: ${aliasError.message}`);
    }
    synced = kept.length;
  }
  ctx.log.info(`series: ${SERIES.length} rows, ${synced}/${aliases.length} aliases synced`);
}

export const adapter: Adapter<CuratedUnit> = {
  id: "curated",
  label: "Curated",
  rank: 9,
  cadence: "daily",
  isConfigured: () => true,
  limits: { concurrency: 1, minIntervalMs: 0, timeoutMs: 30_000, maxRetries: 1 },

  async plan(cursor, ctx): Promise<Plan<CuratedUnit>> {
    const year = ctx.now.getUTCFullYear();
    const { afterSlug } = parseCursor(cursor, year);
    if (afterSlug === null && !ctx.dryRun) await syncSeries(ctx);
    return { units: planUnits(rowsFor(ctx), year, afterSlug), done: true };
  },

  async run(unit, ctx) {
    return rowsFor(ctx).slice(unit.start, unit.end);
  },
};
