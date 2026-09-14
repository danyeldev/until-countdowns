import { HttpError } from "../http";
import { buildEvent, rehash, sanitizeTitle } from "../normalize";
import type { Adapter, IngestContext, IngestEvent, Json, Plan, Unit } from "../types";

/**
 * Formula 1 Grand Prix and sprint schedules from sportstimes/f1 (F1Calendar).
 * The repository, including its JSON calendars, is MIT licensed. Attribution and
 * the full upstream notice are retained in docs/licenses/f1calendar-MIT.txt.
 * No account or key: two small GitHub raw requests per daily pass, 1 second apart.
 * A missing next-season file is normal; a missing current season or malformed
 * payload fails the unit, preserving the runner's retry/staleness protections.
 *
 * Source keys use season + race slug + session, never round number or date:
 * rounds can be renumbered and dates can move. Only published GP/sprint sessions
 * become events. Missing times stay day precision; no start times are invented.
 * Circuit zones preserve the local race day (Las Vegas runs on Saturday locally
 * but Sunday UTC). New/unknown locations stay explicitly UTC and GLOBAL.
 * Verified against the public 2026 calendar and Formula1.com on 2026-09-14.
 */
export const F1CALENDAR_BASE = "https://raw.githubusercontent.com/sportstimes/f1/main/_db/f1";
export const F1CALENDAR_SOURCE = "https://github.com/sportstimes/f1";

type Venue = { country: string; timezone: string };
const VENUES: Record<string, Venue> = Object.fromEntries([
  ["australian", "AU", "Australia/Melbourne"],
  ["chinese", "CN", "Asia/Shanghai"],
  ["japanese", "JP", "Asia/Tokyo"],
  ["bahrain", "BH", "Asia/Bahrain"],
  ["bahrain-malaysia", "MY", "Asia/Kuala_Lumpur"],
  ["saudi-arabia", "SA", "Asia/Riyadh"],
  ["miami", "US", "America/New_York"],
  ["canadian", "CA", "America/Toronto"],
  ["monaco", "MC", "Europe/Monaco"],
  ["spanish", "ES", "Europe/Madrid"],
  ["barcelona-catalunya", "ES", "Europe/Madrid"],
  ["emilia-romagna", "IT", "Europe/Rome"],
  ["austrian", "AT", "Europe/Vienna"],
  ["british", "GB", "Europe/London"],
  ["belgian", "BE", "Europe/Brussels"],
  ["hungarian", "HU", "Europe/Budapest"],
  ["dutch", "NL", "Europe/Amsterdam"],
  ["italian", "IT", "Europe/Rome"],
  ["azerbaijan", "AZ", "Asia/Baku"],
  ["singapore", "SG", "Asia/Singapore"],
  ["us", "US", "America/Chicago"],
  ["mexican", "MX", "America/Mexico_City"],
  ["brazilian", "BR", "America/Sao_Paulo"],
  ["las-vegas", "US", "America/Los_Angeles"],
  ["qatar", "QA", "Asia/Qatar"],
  ["abu-dhabi", "AE", "Asia/Dubai"],
].map(([slug, country, timezone]) => [`${slug}-grand-prix`, { country, timezone }]));

export type F1Race = {
  name?: unknown;
  slug?: unknown;
  location?: unknown;
  sessions?: { gp?: unknown; sprint?: unknown };
};
export type F1Unit = Unit & { year: number };

/** Round-trip validation rejects JavaScript's automatic February 30 rollover. */
export function sessionDate(value: unknown, year: number): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}Z)?$/.test(value)) return null;
  if (Number(value.slice(0, 4)) !== year) return null;
  const instant = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (!Number.isFinite(instant.getTime()) || instant.toISOString().replace(".000Z", "Z").slice(0, value.length) !== value) return null;
  return value;
}

export function racesToEvents(races: F1Race[], year: number, now: Date): IngestEvent[] {
  const events = new Map<string, IngestEvent>();
  for (const race of races) {
    if (!race || typeof race !== "object" || typeof race.name !== "string" || typeof race.slug !== "string") continue;
    const name = sanitizeTitle(race.name);
    if (name.length < 3 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(race.slug) || race.slug.length > 100) continue;
    const venue = VENUES[race.slug];
    const city = typeof race.location === "string" ? sanitizeTitle(race.location).slice(0, 100) : "";
    const grandPrix = /grand prix/i.test(name) ? name : `${name} Grand Prix`;
    for (const session of ["gp", "sprint"] as const) {
      const date = sessionDate(race.sessions?.[session], year);
      if (!date) continue;
      const isInstant = date.includes("T");
      if (isInstant ? Date.parse(date) < now.getTime() : date < now.toISOString().slice(0, 10)) continue;
      const sourceKey = `f1calendar:${year}:${race.slug}:${session}`;
      const title = `${year} ${grandPrix}${session === "sprint" ? " Sprint" : ""}`;
      const description = `The ${year} Formula 1 ${session === "sprint" ? "sprint at the" : "race at the"} ${grandPrix}${city ? ` takes place in ${city}` : " is on the calendar"}. ${isInstant ? "The countdown follows the published session start time." : "The date is published; the start time has not been confirmed."} Schedule data is maintained by F1Calendar and may change.`;
      const row = buildEvent({
        title,
        date,
        category: "sports",
        tags: ["formula-1", "f1", "motorsport", session === "sprint" ? "sprint" : "grand-prix"],
        regions: venue ? ["GLOBAL", venue.country] : ["GLOBAL"],
        source: "f1calendar",
        sourceUrl: `${F1CALENDAR_SOURCE}/blob/main/_db/f1/${year}.json`,
        sourceKey,
        description,
        summary: description,
        timezone: isInstant ? venue?.timezone ?? "UTC" : null,
        confidence: isInstant ? 0.85 : 0.75,
        status: "scheduled",
        popularity: session === "gp" ? 65 : 45,
        externalIds: { f1calendar: `${year}:${race.slug}:${session}` },
        location: city && venue ? { name: city, city, country: venue.country } : null,
        raw: { year, race_slug: race.slug, session, published_start: date },
      });
      row.jsonld_eligible = Boolean(row.location);
      events.set(sourceKey, rehash(row));
    }
  }
  return [...events.values()].sort((a, b) => a.date.localeCompare(b.date) || a.source_key.localeCompare(b.source_key));
}

export function planUnits(cursor: Json | null, now: Date): Plan<F1Unit> {
  const year = now.getUTCFullYear();
  const afterYear = cursor && typeof cursor === "object" && !Array.isArray(cursor) ? cursor.afterYear : undefined;
  const years = [year, year + 1];
  const remaining = typeof afterYear === "number" ? years.filter((y) => y > afterYear) : years;
  // An expired/end-of-pass cursor starts a real pass; never finalize an empty one.
  const planned = remaining.length ? remaining : years;
  return { done: true, units: planned.map((y) => ({ key: `f1calendar:${y}`, label: `Formula 1 ${y}`, year: y, after: { afterYear: y } })) };
}

export async function runSeason(unit: F1Unit, ctx: IngestContext): Promise<IngestEvent[]> {
  let data: unknown;
  try {
    data = await ctx.http.fetchJson(`${F1CALENDAR_BASE}/${unit.year}.json`);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404 && unit.year > ctx.now.getUTCFullYear()) {
      ctx.log.info("Formula 1 next-season calendar is not published yet", { year: unit.year });
      return [];
    }
    throw error;
  }
  if (!data || typeof data !== "object" || !("races" in data) || !Array.isArray(data.races) || !data.races.length) {
    throw new Error(`Invalid F1Calendar ${unit.year} payload: expected a non-empty races array`);
  }
  if (!data.races.some((race: F1Race) => race && typeof race.name === "string" && typeof race.slug === "string" && sessionDate(race.sessions?.gp, unit.year))) {
    throw new Error(`Invalid F1Calendar ${unit.year} payload: no recognizable race schedules`);
  }
  return racesToEvents(data.races, unit.year, ctx.now);
}

export const adapter: Adapter<F1Unit> = {
  id: "f1calendar",
  label: "F1Calendar race and sprint schedules",
  rank: 6,
  cadence: "daily",
  isConfigured: () => true,
  limits: { concurrency: 1, minIntervalMs: 1000, timeoutMs: 20_000, maxRetries: 2 },
  plan: async (cursor, ctx) => planUnits(cursor, ctx.now),
  run: runSeason,
};
