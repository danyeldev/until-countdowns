/** Formatting helpers for astronomy descriptions: UTC only, no locale dependence. */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const KM_PER_AU = 149_597_870.7;
export const LUNAR_DISTANCE_KM = 384_400;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** `YYYY-MM-DD` of the UTC calendar day. */
export function isoDay(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** ISO instant with whole seconds (`2029-04-13T21:46:00Z`), keeps slugs and hashes free of ms noise. */
export function isoInstant(d: Date): string {
  return new Date(Math.round(d.getTime() / 1000) * 1000).toISOString().replace(/\.000Z$/, "Z");
}

export type UtcParts = { time: string; day: string; month: string; year: number };

/** `{ time: "21:46", day: "13 April 2029", month: "April", year: 2029 }` in UTC. */
export function utcParts(d: Date): UtcParts {
  return {
    time: `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`,
    day: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
    month: MONTHS[d.getUTCMonth()],
    year: d.getUTCFullYear(),
  };
}

export function monthName(month1: number): string {
  return MONTHS[month1 - 1] ?? "";
}

/** Human phrase for a date at a given precision: "on 28 July 2061", "in February 2027", "in 2028". */
export function whenPhrase(date: string, precision: "instant" | "day" | "month" | "quarter" | "year" | "decade"): string {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  if (precision === "instant" || precision === "day") return `on ${d} ${MONTHS[m - 1]} ${y}`;
  if (precision === "month") return `in ${MONTHS[m - 1]} ${y}`;
  return `in ${y}`;
}

/** Thousands separators, no decimals. */
export function fmtInt(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function fmtFixed(n: number, digits: number): string {
  return n.toFixed(digits);
}

/** `25.5°N, 33.2°E` */
export function fmtLatLng(lat: number, lng: number): string {
  const la = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}`;
  const lo = `${Math.abs(lng).toFixed(1)}°${lng >= 0 ? "E" : "W"}`;
  return `${la}, ${lo}`;
}

const PHASES = ["new moon", "waxing crescent", "first quarter", "waxing gibbous", "full moon", "waning gibbous", "last quarter", "waning crescent"];

/** Name of the lunar phase for a Sun–Moon elongation angle in degrees (astronomy-engine `MoonPhase`). */
export function moonPhaseName(angle: number): string {
  const idx = Math.round((((angle % 360) + 360) % 360) / 45) % 8;
  return PHASES[idx];
}

/** Rough diameter (m) from absolute magnitude H assuming albedo 0.14 (CNEOS convention). */
export function diameterFromH(h: number, albedo = 0.14): number {
  return (1329 / Math.sqrt(albedo)) * 10 ** (-h / 5) * 1000;
}

/** "about 340 m" / "about 1.2 km". */
export function fmtDiameter(m: number): string {
  if (m >= 1000) return `about ${(m / 1000).toFixed(1)} km`;
  if (m >= 100) return `about ${Math.round(m / 10) * 10} m`;
  return `about ${Math.round(m)} m`;
}

/** Julian Date of a JS Date (UTC). */
export function julianDate(d: Date): number {
  return d.getTime() / 86_400_000 + 2_440_587.5;
}
