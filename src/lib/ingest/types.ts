import { z } from "zod";
import { CATEGORIES } from "@/lib/types";

/**
 * Ingestion contract shared by every adapter, the runner and the upsert layer.
 * `IngestEvent` is the snake_case row consumed by SQL `upsert_events(p_rows jsonb)`
 * (see supabase/migrations/0007_upsert_same_source.sql) — the field list must match
 * its `jsonb_to_recordset` column list exactly.
 */

export const DATE_PRECISIONS = ["instant", "day", "month", "quarter", "year", "decade"] as const;
export type IngestPrecision = (typeof DATE_PRECISIONS)[number];

export const EVENT_STATUSES = ["scheduled", "tentative", "postponed", "cancelled", "done", "retired"] as const;
export type IngestStatus = (typeof EVENT_STATUSES)[number];

/** Ids present in `public.sources` (supabase/migrations/0002_reference.sql). */
export const SOURCE_IDS = [
  "curated",
  "user",
  "astronomy",
  "curiosities",
  "observances",
  "ll2",
  "football-data",
  "hebcal",
  "aladhan",
  "tvmaze",
  "kitsu",
  "endoflife",
  "confs",
  "liquipedia",
  "wikipedia",
  "wikidata",
  "openholidays",
  "holidays",
  "hindu",
  "animeschedule",
  "musicbrainz",
  "wanted",
  "wikipedia-categories",
  "anniversaries",
] as const;

/** `YYYY-MM-DD` or a UTC/offset instant `YYYY-MM-DDTHH:MM[:SS[.sss]](Z|±HH:MM)`. */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

const isoDate = z
  .string()
  .regex(DATE_RE, "date must be YYYY-MM-DD or an ISO instant")
  .refine((s) => !Number.isNaN(Date.parse(s.includes("T") ? s : `${s}T00:00:00Z`)), "date is not a real date");

const jsonObject = z.record(z.string(), z.unknown());

/** `<base>-YYYY-MM-DD`; the base must start with a letter or digit (a title with no Latin letters must get a fallback base). */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]*-\d{4}-\d{2}-\d{2}$/;

export const IngestEventSchema = z
  .object({
    slug: z
      .string()
      .min(3)
      .max(120)
      .regex(SLUG_RE, "slug must be <base>-YYYY-MM-DD with a non-empty kebab-case base")
      .refine((s) => !s.startsWith("mine-") && !s.startsWith("share-"), "slug prefix is reserved for personal countdowns"),
    title: z.string().min(2).max(200),
    description: z.string().max(4000),
    summary: z.string().max(4000).nullable(),
    date: isoDate,
    end_date: isoDate.nullable(),
    all_day: z.boolean(),
    timezone: z.string().max(64).nullable(),
    category: z.enum(CATEGORIES),
    tags: z.array(z.string().min(1).max(60)).max(40),
    regions: z.array(z.string().min(2).max(12)).min(1).max(250),
    source: z.enum(SOURCE_IDS),
    source_url: z.string().url().max(1000).nullable(),
    source_key: z.string().min(3).max(200),
    external_ids: jsonObject,
    status: z.enum(EVENT_STATUSES),
    date_precision: z.enum(DATE_PRECISIONS),
    confidence: z.number().min(0).max(1),
    featured: z.boolean(),
    popularity: z.number().int().min(0).max(100),
    series_slug: z.string().max(120).nullable(),
    location: jsonObject.nullable(),
    jsonld_eligible: z.boolean(),
    image_candidate_url: z.string().url().max(1000).nullable(),
    image_candidate_meta: jsonObject.nullable(),
    content_hash: z.string().length(64),
    raw: z.unknown().nullable(),
  })
  .refine((r) => r.end_date === null || r.end_date.slice(0, 10) >= r.date.slice(0, 10), {
    message: "end_date must not be before date",
    path: ["end_date"],
  })
  .refine((r) => r.slug.endsWith(r.date.slice(0, 10)), {
    message: "slug must end with the event day (slugify(title)-YYYY-MM-DD)",
    path: ["slug"],
  });

export type IngestEvent = z.infer<typeof IngestEventSchema>;

/** Serialisable JSON value (cursors and units are persisted in `ingest_state.cursor`). */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * A unit is one small, serialisable piece of work (a country × year batch, a Wikidata
 * class × page, a Wikipedia year page …). `after` is the cursor the runner persists once the
 * unit has been upserted, i.e. the point a later invocation resumes from.
 */
export type Unit = {
  key: string;
  label: string;
  /** May be a getter: an adapter can decide the resume point from what `run()` found (Wikidata paging). */
  readonly after: Json;
};

export type Plan<U extends Unit = Unit> = {
  units: U[];
  /** `true` when `units` are the last ones of this pass. */
  done: boolean;
  /** Cursor for the next `plan()` call when `done` is false. */
  nextCursor?: Json;
};

export type IngestLogger = {
  info(msg: string, extra?: Record<string, unknown>): void;
  warn(msg: string, extra?: Record<string, unknown>): void;
  error(msg: string, extra?: Record<string, unknown>): void;
};

export type IngestHttp = {
  fetchJson<T = unknown>(url: string, init?: HttpInit): Promise<T>;
  fetchText(url: string, init?: HttpInit): Promise<string>;
};

export type HttpInit = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
  minIntervalMs?: number;
  method?: "GET" | "POST";
  body?: string;
};

export type IngestContext = {
  http: IngestHttp;
  log: IngestLogger;
  now: Date;
  budget: { remainingMs(): number };
  dryRun: boolean;
};

export type AdapterLimits = {
  concurrency: number;
  minIntervalMs: number;
  timeoutMs: number;
  maxRetries: number;
};

export type Adapter<U extends Unit = Unit> = {
  id: string;
  label: string;
  /** Merge precedence, mirrors `public.sources.rank` (0 for sources that emit no events). */
  rank: number;
  /** Human cadence, also used by housekeeping staleness checks (e.g. "daily", "weekly"). */
  cadence: "hourly" | "daily" | "weekly" | "monthly";
  isConfigured(): boolean;
  limits: AdapterLimits;
  plan(cursor: Json | null, ctx: IngestContext): Promise<Plan<U>>;
  run(unit: U, ctx: IngestContext): Promise<IngestEvent[]>;
};

export type RunStatus = "ok" | "partial" | "error" | "skipped";

export type RunSummary = {
  source: string;
  status: RunStatus;
  reason?: "unconfigured" | "backoff" | "leased" | "unknown";
  /** Why a run ended `partial`: the time budget ran out, or some units were lost. */
  partialReason?: "budget" | "lost-units";
  trigger: "cron" | "manual";
  dryRun: boolean;
  runId: number | null;
  started_at: string;
  duration_ms: number;
  units: number;
  fetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
  drifted: number;
  invalid: number;
  /** Dry runs only: rows that passed validation (nothing is written, `inserted`/`updated` stay 0). */
  validated: number;
  errors: Array<{ unit?: string; message: string }>;
  cursor: Json | null;
  sample?: IngestEvent[];
};
