import { revalidateTag, unstable_cache } from "next/cache";

/**
 * Single seam over Next's data cache so a later `'use cache'` migration is mechanical.
 * Detail reads carry `TAG_EVENTS`, hub reads `TAG_CATALOG_LISTS`, and aggregates
 * `TAG_STATS`. Scheduled ingestion relies on their TTLs; enrichment invalidates
 * individual events and the ops-only `/api/revalidate` route can refresh the catalog.
 */
export const TAG_EVENTS = "events";
export const TAG_STATS = "stats";
/** Hub lists (home, category, country, series rails). Refreshed by TTL or an explicit ops request. */
export const TAG_CATALOG_LISTS = "catalog-lists";
/** Live attention totals. Short TTL; not wiped by enrich. */
export const TAG_HYPE = "hype";

const MAX_TAG_LENGTH = 256;

export function eventTag(slug: string): string {
  return `event:${slug}`.slice(0, MAX_TAG_LENGTH);
}

export function seriesTag(slug: string): string {
  return `series:${slug}`.slice(0, MAX_TAG_LENGTH);
}

export type CacheOptions = {
  tags: string[];
  revalidate: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AsyncFn = (...args: any[]) => Promise<unknown>;

export function cached<T extends AsyncFn>(fn: T, keyParts: string[], options: CacheOptions): T {
  return unstable_cache(fn, keyParts, {
    tags: options.tags.map((t) => t.slice(0, MAX_TAG_LENGTH)),
    revalidate: options.revalidate,
  });
}

/**
 * Marks tagged data stale with the `max` profile (stale-while-revalidate: visitors keep
 * getting the old page while the next request refills it). Only for cron handlers and the
 * `/api/revalidate` route — never from the read path.
 */
export function invalidateTags(tags: string[]): void {
  for (const tag of tags) revalidateTag(tag.slice(0, MAX_TAG_LENGTH), "max");
}
