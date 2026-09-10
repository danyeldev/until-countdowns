import {
  ApsisKind,
  Body,
  EclipseKind,
  Illumination,
  MoonPhase,
  NextGlobalSolarEclipse,
  NextLunarApsis,
  NextLunarEclipse,
  NextMoonQuarter,
  NextTransit,
  SearchGlobalSolarEclipse,
  SearchLunarApsis,
  SearchLunarEclipse,
  SearchMoonQuarter,
  SearchRelativeLongitude,
  SearchSunLongitude,
  SearchTransit,
  Seasons,
  SunPosition,
  type AstroTime,
  type TransitInfo,
} from "astronomy-engine";
import { buildEvent, classify, farFutureCutoffMs } from "../../normalize";
import type { IngestEvent } from "../../types";
import { fmtInt, fmtLatLng, isoDay, isoInstant, KM_PER_AU, moonPhaseName, utcParts } from "./format";
import { METEOR_SHOWERS, type MeteorShower } from "./meteor-showers";

/**
 * Sky events computed in-process with astronomy-engine (MIT; computed facts are not
 * copyrightable). Every instant is UTC; the client converts to local time. Accuracy: eclipse
 * peaks within ≈ 7.5 min, ΔT bias ≈ 5 s — descriptions say "computed", never "NASA-identical".
 * `SearchRelativeLongitude(body, 0, …)` is the opposition of a superior planet (asserted against
 * the 2027-02-19 Mars opposition in tests); `Seasons(year)` and `SearchSunLongitude` exist in
 * 2.1.19 (checked in astronomy.d.ts). astronomy-engine has no "hybrid" solar-eclipse kind: a
 * hybrid eclipse is reported as total or annular by its greatest-eclipse point.
 */

export const ENGINE_URL = "https://github.com/cosinekitty/astronomy";
export const ENGINE_NAME = "astronomy-engine@2.1.19";
/** A full Moon within this many hours of perigee is called a supermoon (editorial threshold). */
export const SUPERMOON_HOURS = 24;
/** Total solar eclipses within this many years of "now" are featured (marquee horizon, like curated). */
export const FEATURED_HORIZON_YEARS = 2;
/** General precession in ecliptic longitude, degrees per Julian year (≈ 50.29″/yr). */
const PRECESSION_DEG_PER_YEAR = 50.29 / 3600;

const HOUR_MS = 3_600_000;

function jan1(year: number): Date {
  return new Date(Date.UTC(year, 0, 1));
}

function utc(year: number, month0: number, day: number): Date {
  return new Date(Date.UTC(year, month0, day));
}

type SkyInput = {
  title: string;
  at: Date;
  sourceKey: string;
  tags: string[];
  description: string;
  popularity: number;
  featured?: boolean;
  location?: Record<string, unknown> | null;
  raw?: Record<string, unknown>;
};

/** Common shape of every computed row: instant, UTC, GLOBAL, confidence 0.95, tag `computed`. */
export function skyEvent(input: SkyInput): IngestEvent {
  const { tags: ruleTags } = classify(input.title, "astronomy");
  return buildEvent({
    title: input.title,
    date: isoInstant(input.at),
    category: "astronomy",
    tags: [...input.tags, ...ruleTags, "computed"],
    regions: ["GLOBAL"],
    description: input.description,
    source: "astronomy",
    sourceUrl: ENGINE_URL,
    sourceKey: input.sourceKey,
    featured: Boolean(input.featured),
    popularity: input.popularity,
    status: "scheduled",
    confidence: 0.95,
    timezone: "UTC",
    location: input.location ?? null,
    raw: { engine: ENGINE_NAME, ...(input.raw ?? {}) },
  });
}

const ECLIPSE_NOTE = "Times are for the moment of greatest eclipse, computed with astronomy-engine (accurate to a few minutes); local timing and coverage depend on where you watch.";

/** Solar (total/annular) and lunar (total/partial) eclipses whose peak falls in `year`. Partial solar and penumbral lunar eclipses are skipped. */
export function eclipseRows(year: number, now: Date): IngestEvent[] {
  const rows: IngestEvent[] = [];
  const featuredUntil = utc(now.getUTCFullYear() + FEATURED_HORIZON_YEARS, now.getUTCMonth(), now.getUTCDate()).getTime();

  let solar = SearchGlobalSolarEclipse(jan1(year));
  while (solar.peak.date.getUTCFullYear() === year) {
    if (solar.kind === EclipseKind.Total || solar.kind === EclipseKind.Annular) {
      const total = solar.kind === EclipseKind.Total;
      const peak = solar.peak.date;
      const p = utcParts(peak);
      const lat = solar.latitude ?? 0;
      const lng = solar.longitude ?? 0;
      const coverage = Math.round((solar.obscuration ?? 1) * 100);
      const description = total
        ? `A total solar eclipse peaks at ${p.time} UTC on ${p.day}, with the Moon completely covering the Sun along the path of totality. Greatest eclipse is near ${fmtLatLng(lat, lng)}. ${ECLIPSE_NOTE}`
        : `An annular solar eclipse peaks at ${p.time} UTC on ${p.day}: the Moon is too far from Earth to cover the whole Sun, so about ${coverage}% of the disc is hidden and a bright ring of fire remains along the central path. Greatest eclipse is near ${fmtLatLng(lat, lng)}. ${ECLIPSE_NOTE}`;
      rows.push(
        skyEvent({
          title: total ? "Total solar eclipse" : "Annular solar eclipse",
          at: peak,
          sourceKey: `astronomy:solar-eclipse:${isoDay(peak)}`,
          tags: ["eclipse", "solar-eclipse", total ? "total" : "annular"],
          description,
          popularity: total ? 80 : 60,
          featured: total && peak.getTime() <= featuredUntil,
          location: { name: "Point of greatest eclipse", lat: Number(lat.toFixed(2)), lng: Number(lng.toFixed(2)) },
          raw: { kind: solar.kind, obscuration: solar.obscuration ?? null, latitude: lat, longitude: lng },
        }),
      );
    }
    solar = NextGlobalSolarEclipse(solar.peak);
  }

  let lunar = SearchLunarEclipse(jan1(year));
  while (lunar.peak.date.getUTCFullYear() === year) {
    if (lunar.kind === EclipseKind.Total || lunar.kind === EclipseKind.Partial) {
      const total = lunar.kind === EclipseKind.Total;
      const peak = lunar.peak.date;
      const p = utcParts(peak);
      const partialMin = Math.round(2 * lunar.sd_partial);
      const totalMin = Math.round(2 * lunar.sd_total);
      const description = total
        ? `A total lunar eclipse peaks at ${p.time} UTC on ${p.day}, when the Moon passes fully into Earth's umbra and takes on a coppery red colour. Totality lasts about ${totalMin} minutes and the partial phases about ${partialMin} minutes in all; it is visible from anywhere the Moon is above the horizon. Computed with astronomy-engine.`
        : `A partial lunar eclipse peaks at ${p.time} UTC on ${p.day}, with about ${Math.round(lunar.obscuration * 100)}% of the Moon's disc inside Earth's umbra. The partial phase lasts about ${partialMin} minutes and is visible from anywhere the Moon is above the horizon. Computed with astronomy-engine.`;
      rows.push(
        skyEvent({
          title: total ? "Total lunar eclipse" : "Partial lunar eclipse",
          at: peak,
          sourceKey: `astronomy:lunar-eclipse:${isoDay(peak)}`,
          tags: ["eclipse", "lunar-eclipse", "moon", total ? "total" : "partial"],
          description,
          popularity: total ? 55 : 35,
          raw: { kind: lunar.kind, obscuration: lunar.obscuration, sd_partial: lunar.sd_partial, sd_total: lunar.sd_total },
        }),
      );
    }
    lunar = NextLunarEclipse(lunar.peak);
  }
  return rows;
}

const SEASONS: Array<{ key: string; field: "mar_equinox" | "jun_solstice" | "sep_equinox" | "dec_solstice"; title: string; tags: string[]; text: string }> = [
  {
    key: "mar-equinox",
    field: "mar_equinox",
    title: "March equinox",
    tags: ["equinox", "seasons"],
    text: "The Sun crosses the celestial equator heading north; day and night are close to equal length everywhere. Astronomical spring begins in the Northern Hemisphere and autumn in the Southern Hemisphere.",
  },
  {
    key: "jun-solstice",
    field: "jun_solstice",
    title: "June solstice",
    tags: ["solstice", "seasons"],
    text: "The Sun reaches its northernmost point in the sky: the longest day of the year north of the equator and the shortest south of it. Astronomical summer begins in the Northern Hemisphere and winter in the Southern Hemisphere.",
  },
  {
    key: "sep-equinox",
    field: "sep_equinox",
    title: "September equinox",
    tags: ["equinox", "seasons"],
    text: "The Sun crosses the celestial equator heading south; day and night are close to equal length everywhere. Astronomical autumn begins in the Northern Hemisphere and spring in the Southern Hemisphere.",
  },
  {
    key: "dec-solstice",
    field: "dec_solstice",
    title: "December solstice",
    tags: ["solstice", "seasons"],
    text: "The Sun reaches its southernmost point in the sky: the shortest day of the year north of the equator and the longest south of it. Astronomical winter begins in the Northern Hemisphere and summer in the Southern Hemisphere.",
  },
];

export function seasonRows(year: number): IngestEvent[] {
  const s = Seasons(year);
  return SEASONS.map((def) => {
    const at = s[def.field].date;
    const p = utcParts(at);
    return skyEvent({
      title: def.title,
      at,
      sourceKey: `astronomy:season:${year}:${def.key}`,
      tags: def.tags,
      description: `${def.title} at ${p.time} UTC on ${p.day}, computed with astronomy-engine. ${def.text}`,
      popularity: 45,
    });
  });
}

type FullMoon = { at: Date };
type Perigee = { at: Date; km: number };

/** Full Moons (quarter 2) of a UTC calendar year, in order. */
export function fullMoons(year: number): FullMoon[] {
  const out: FullMoon[] = [];
  let mq = SearchMoonQuarter(jan1(year));
  while (mq.time.date.getUTCFullYear() <= year) {
    if (mq.quarter === 2 && mq.time.date.getUTCFullYear() === year) out.push({ at: mq.time.date });
    mq = NextMoonQuarter(mq);
  }
  return out;
}

/** Lunar perigees from mid-December of the previous year to mid-January of the next. */
export function perigees(year: number): Perigee[] {
  const out: Perigee[] = [];
  const end = Date.UTC(year + 1, 0, 15);
  let ap = SearchLunarApsis(utc(year - 1, 11, 15));
  while (ap.time.date.getTime() < end) {
    if (ap.kind === ApsisKind.Pericenter) out.push({ at: ap.time.date, km: ap.dist_km });
    ap = NextLunarApsis(ap);
  }
  return out;
}

/** Supermoons (perigee within 24 h of full), calendar blue moons (2nd full Moon of a UTC month) and the Harvest Moon (full Moon nearest the September equinox). */
export function moonRows(year: number): IngestEvent[] {
  const rows: IngestEvent[] = [];
  const fulls = fullMoons(year);
  const peris = perigees(year);
  const equinox = Seasons(year).sep_equinox.date.getTime();

  for (const f of fulls) {
    let nearest: Perigee | null = null;
    for (const pg of peris) if (!nearest || Math.abs(pg.at.getTime() - f.at.getTime()) < Math.abs(nearest.at.getTime() - f.at.getTime())) nearest = pg;
    if (!nearest) continue;
    const hours = Math.abs(nearest.at.getTime() - f.at.getTime()) / HOUR_MS;
    if (hours > SUPERMOON_HOURS) continue;
    const p = utcParts(f.at);
    rows.push(
      skyEvent({
        title: "Supermoon",
        at: f.at,
        sourceKey: `astronomy:moon:supermoon:${isoDay(f.at)}`,
        tags: ["moon", "supermoon", "full-moon"],
        description: `The full Moon of ${p.day} at ${p.time} UTC comes within ${Math.round(hours)} hours of perigee, its closest point to Earth on this orbit at about ${fmtInt(nearest.km)} km, so it looks slightly larger and brighter than an average full Moon. "Supermoon" here means perigee within ${SUPERMOON_HOURS} hours of full Moon; times computed with astronomy-engine.`,
        popularity: 40,
        raw: { perigee: isoInstant(nearest.at), perigee_km: Math.round(nearest.km), hours: Number(hours.toFixed(1)) },
      }),
    );
  }

  const byMonth = new Map<number, FullMoon[]>();
  for (const f of fulls) {
    const m = f.at.getUTCMonth();
    byMonth.set(m, [...(byMonth.get(m) ?? []), f]);
  }
  for (const list of byMonth.values()) {
    if (list.length < 2) continue;
    const f = list[1];
    const p = utcParts(f.at);
    rows.push(
      skyEvent({
        title: "Blue moon",
        at: f.at,
        sourceKey: `astronomy:moon:blue-moon:${isoDay(f.at)}`,
        tags: ["moon", "blue-moon", "full-moon"],
        description: `The second full Moon of ${p.month} ${p.year} (UTC), at ${p.time} UTC on ${p.day}: a calendar "blue moon". Two full Moons in one month happen roughly every two and a half years; the Moon does not actually change colour. Time computed with astronomy-engine.`,
        popularity: 40,
        raw: { first: isoInstant(list[0].at) },
      }),
    );
  }

  let harvest: FullMoon | null = null;
  for (const f of fulls) if (!harvest || Math.abs(f.at.getTime() - equinox) < Math.abs(harvest.at.getTime() - equinox)) harvest = f;
  if (harvest) {
    const p = utcParts(harvest.at);
    rows.push(
      skyEvent({
        title: "Harvest Moon",
        at: harvest.at,
        sourceKey: `astronomy:moon:harvest-moon:${isoDay(harvest.at)}`,
        tags: ["moon", "harvest-moon", "full-moon"],
        description: `The full Moon closest to the September equinox, at ${p.time} UTC on ${p.day}: the traditional Harvest Moon. For several evenings around it the Moon rises soon after sunset at northern mid-latitudes, giving extra light after dark. Time computed with astronomy-engine.`,
        popularity: 40,
      }),
    );
  }
  return rows;
}

const OPPOSITIONS: Array<{ body: Body; name: string; key: string; popularity: number }> = [
  { body: Body.Mars, name: "Mars", key: "mars", popularity: 45 },
  { body: Body.Jupiter, name: "Jupiter", key: "jupiter", popularity: 35 },
  { body: Body.Saturn, name: "Saturn", key: "saturn", popularity: 35 },
];

/** Oppositions of Mars, Jupiter and Saturn in `year` (relative longitude 0 = opposition for a superior planet). */
export function planetRows(year: number): IngestEvent[] {
  const rows: IngestEvent[] = [];
  const end = Date.UTC(year + 1, 0, 1);
  for (const def of OPPOSITIONS) {
    let t: AstroTime = SearchRelativeLongitude(def.body, 0, jan1(year));
    while (t.date.getTime() < end) {
      const at = t.date;
      const p = utcParts(at);
      const ill = Illumination(def.body, t);
      const millionKm = (ill.geo_dist * KM_PER_AU) / 1e6;
      rows.push(
        skyEvent({
          title: `${def.name} at opposition`,
          at,
          sourceKey: `astronomy:opposition:${def.key}:${isoDay(at)}`,
          tags: ["planets", "opposition", def.key],
          description: `${def.name} reaches opposition at ${p.time} UTC on ${p.day}, with Earth passing between the planet and the Sun: it rises around sunset, stays up all night and is near its brightest for the year at about magnitude ${ill.mag.toFixed(1)}. Its distance from Earth is roughly ${millionKm.toFixed(0)} million km. Computed with astronomy-engine.`,
          popularity: def.popularity,
          raw: { mag: Number(ill.mag.toFixed(2)), geo_dist_au: Number(ill.geo_dist.toFixed(4)) },
        }),
      );
      t = SearchRelativeLongitude(def.body, 0, t.AddDays(30));
    }
  }
  return rows;
}

function transitRow(body: "Mercury" | "Venus", tr: TransitInfo, farFuture: boolean): IngestEvent {
  const at = tr.peak.date;
  const p = utcParts(at);
  const s = utcParts(tr.start.date);
  const f = utcParts(tr.finish.date);
  const rarity = body === "Venus" ? "Transits of Venus come in pairs more than a century apart; the previous one was in June 2012." : "Transits of Mercury happen about 13 times a century.";
  return skyEvent({
    title: `Transit of ${body}`,
    at,
    sourceKey: `astronomy:transit:${body.toLowerCase()}:${isoDay(at)}`,
    tags: ["planets", "transit", body.toLowerCase(), ...(farFuture ? ["far-future"] : [])],
    description: `${body} crosses the face of the Sun as seen from Earth, from ${s.time} to ${f.time} UTC on ${p.day} (mid-transit ${p.time} UTC). The planet appears as a small black dot and must only be viewed with proper solar filters or by projection. ${rarity} Computed with astronomy-engine.`,
    popularity: 60,
    raw: { start: isoInstant(tr.start.date), finish: isoInstant(tr.finish.date), separation_arcmin: Number(tr.separation.toFixed(2)) },
  });
}

/** Transits of Mercury inside the horizon, plus the next transit of Venus (2117, tagged `far-future` when beyond it). */
export function transitRows(now: Date): IngestEvent[] {
  const rows: IngestEvent[] = [];
  const cutoff = farFutureCutoffMs(now);
  let tr = SearchTransit(Body.Mercury, now);
  while (tr.peak.date.getTime() <= cutoff) {
    rows.push(transitRow("Mercury", tr, false));
    tr = NextTransit(Body.Mercury, tr.finish);
  }
  const venus = SearchTransit(Body.Venus, now);
  rows.push(transitRow("Venus", venus, venus.peak.date.getTime() > cutoff));
  return rows;
}

/**
 * Instant when the apparent ecliptic longitude of the Sun (of date) reaches an IMO peak λ☉
 * (J2000.0) in `year`: the J2000 value is precessed to the date, the crossing day is bracketed
 * with a daily scan and refined with `SearchSunLongitude` over a 2-day window.
 */
export function sunLongitudeInstant(lambdaJ2000: number, year: number): Date | null {
  const yearsSince2000 = year + 0.5 - 2000;
  const target = (((lambdaJ2000 + yearsSince2000 * PRECESSION_DEG_PER_YEAR) % 360) + 360) % 360;
  const signed = (lon: number) => ((((lon - target) % 360) + 540) % 360) - 180;
  let prev = signed(SunPosition(jan1(year)).elon);
  for (let d = 1; d <= 371; d++) {
    const cur = signed(SunPosition(utc(year, 0, 1 + d)).elon);
    if (prev < 0 && cur >= 0) {
      const t = SearchSunLongitude(target, utc(year, 0, d), 2);
      return t ? t.date : null;
    }
    prev = cur;
  }
  return null;
}

export function showerRow(shower: MeteorShower, year: number): IngestEvent | null {
  const at = sunLongitudeInstant(shower.peakLambda, year);
  if (!at) return null;
  const p = utcParts(at);
  const illum = Illumination(Body.Moon, at).phase_fraction;
  const phase = moonPhaseName(MoonPhase(at));
  return skyEvent({
    title: `${shower.name} meteor shower peak`,
    at,
    sourceKey: `astronomy:shower:${shower.key}:${year}`,
    tags: ["meteor-shower", "meteors", ...shower.tags],
    description: `The ${shower.name} peak, when Earth passes through the densest part of the stream left by ${shower.parent}, is expected around ${p.time} UTC on ${p.day} (solar longitude ${shower.peakLambda}°, IMO working list). Rates can reach a ZHR of about ${shower.zhr} under dark skies; the Moon is ${Math.round(illum * 100)}% illuminated at the peak (${phase}). Activity runs ${shower.activity}.`,
    popularity: shower.popularity,
    raw: { iau: shower.iau, peak_lambda: shower.peakLambda, zhr: shower.zhr, moon_illumination: Number(illum.toFixed(2)) },
  });
}

export function showerRows(year: number): IngestEvent[] {
  const rows: IngestEvent[] = [];
  for (const s of METEOR_SHOWERS) {
    const row = showerRow(s, year);
    if (row) rows.push(row);
  }
  return rows;
}
