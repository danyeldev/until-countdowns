import type { IngestLogger } from "./types";

/**
 * Invalidate the `events` and `stats` data-cache tags after a run that changed rows.
 * `src/lib/cache.ts` needs the Next request context (`revalidateTag`); from the CLI it throws,
 * which is logged and swallowed — scripts/ingest.ts can POST to `$REVALIDATE_URL` instead.
 */
export async function revalidateCatalog(log: IngestLogger): Promise<"ok" | "skipped"> {
  try {
    const cache = await import("@/lib/cache");
    cache.invalidateTags([cache.TAG_EVENTS, cache.TAG_STATS]);
    log.info("revalidate: events, stats");
    return "ok";
  } catch {
    log.info("revalidate: skipped (not in Next runtime)");
    return "skipped";
  }
}
