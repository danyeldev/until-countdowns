import type { Database, Json } from "./database.types";
import {
  CATEGORIES,
  type Category,
  type CountdownEvent,
  type DatePrecision,
  type EventImage,
  type EventLocation,
  type EventStatus,
} from "../types";

export type EventRow = Database["public"]["Views"]["events_public"]["Row"];

const STATUSES: ReadonlySet<string> = new Set(["scheduled", "tentative", "postponed", "cancelled", "done", "retired"]);
const PRECISIONS: ReadonlySet<string> = new Set(["instant", "day", "month", "quarter", "year", "decade"]);
const COARSE: ReadonlySet<string> = new Set(["month", "quarter", "year", "decade"]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function toCategory(value: string | null | undefined): Category {
  return CATEGORIES.includes(value as Category) ? (value as Category) : "culture";
}

function toStatus(value: string | null | undefined): EventStatus | undefined {
  return value && STATUSES.has(value) ? (value as EventStatus) : undefined;
}

function toPrecision(value: string | null | undefined): DatePrecision | undefined {
  return value && PRECISIONS.has(value) ? (value as DatePrecision) : undefined;
}

export function parseImage(value: Json | null | undefined): EventImage | undefined {
  if (!isRecord(value)) return undefined;
  const url = str(value.url);
  const width = num(value.width);
  const height = num(value.height);
  if (!url || width === undefined || height === undefined) return undefined;
  return {
    url,
    width,
    height,
    thumbhash: str(value.thumbhash),
    color: str(value.color),
    credit: str(value.credit),
    author: str(value.author),
    license: str(value.license),
    licenseUrl: str(value.licenseUrl),
    originPage: str(value.originPage),
    provider: str(value.provider),
  };
}

export function parseLocation(value: Json | null | undefined): EventLocation | undefined {
  if (!isRecord(value)) return undefined;
  const loc: EventLocation = {
    name: str(value.name),
    city: str(value.city),
    country: str(value.country),
    lat: num(value.lat),
    lng: num(value.lng),
    url: str(value.url),
  };
  return Object.values(loc).some((v) => v !== undefined) ? loc : undefined;
}

/** Map one `events_public` row (or the `to_jsonb(pe)` payload of `search_events`) to the app shape. */
export function rowToEvent(row: EventRow): CountdownEvent {
  const slug = row.slug ?? "";
  const datePrecision = toPrecision(row.date_precision);
  // `days_until` is start-date based; for a coarse placeholder date (e.g. 2026-01-01 for
  // "sometime in 2026") it would read as long past, so it is withheld rather than passed through.
  const coarse = datePrecision !== undefined && COARSE.has(datePrecision);
  return {
    id: row.id ?? slug,
    slug,
    title: row.title ?? "",
    description: row.description ?? "",
    date: row.date ?? "",
    endDate: row.end_date ?? undefined,
    allDay: row.all_day ?? true,
    category: toCategory(row.category),
    tags: row.tags ?? [],
    regions: row.regions && row.regions.length > 0 ? row.regions : ["GLOBAL"],
    source: row.source ?? "curated",
    sourceUrl: row.source_url ?? undefined,
    featured: row.featured ?? false,
    popularity: row.popularity ?? 0,
    status: toStatus(row.status),
    datePrecision,
    daysUntil: coarse ? undefined : (row.days_until ?? undefined),
    periodEnd: row.period_end ?? undefined,
    seriesSlug: row.series_slug ?? undefined,
    seriesTitle: row.series_title ?? undefined,
    summary: row.summary ?? undefined,
    image: parseImage(row.image),
    location: parseLocation(row.location),
    jsonldEligible: row.jsonld_eligible ?? undefined,
    indexable: row.indexable ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    sourceLabel: row.source_label ?? undefined,
    lastVerifiedAt: row.last_seen_at ?? undefined,
  };
}

/** `search_events` returns `event jsonb` — the same columns as `events_public`. */
export function jsonToEvent(value: Json): CountdownEvent {
  return rowToEvent((isRecord(value) ? value : {}) as unknown as EventRow);
}
