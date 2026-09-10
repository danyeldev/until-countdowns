/**
 * The monthly licence re-check (plan Phase 5: "a slow monthly re-check confirms the Commons file
 * still exists and is still free").
 *
 * A re-hosted copy outlives its source. Commons deletes copyright violations, and an uploader can
 * change a licence; without this pass the bucket would keep serving those bytes for ever under a
 * credit that no longer applies. So the oldest `images.last_checked_at` rows are re-verified
 * against the same `imageinfo` + `extmetadata` gate that let them in:
 *
 * - still free → `last_checked_at` is bumped, and a licence that merely *changed* (still on the
 *   allowlist) is rewritten, credit line included;
 * - gone, deleted, or no longer free → every event pointing at the row is put back to
 *   `image_status = 'skip'` (the UI draws the fallback card), the three objects are deleted from
 *   Storage, and the `images` row is dropped — `events.image_id` / `series.image_id` are
 *   `on delete set null`, so the references clear themselves.
 *
 * This is not an `enrichment_jobs` kind: those rows are per event and the table's check constraint
 * only knows `wikipedia_summary` and `image`. The pass is driven straight off `images`, which is
 * also what makes it cheap — 25 files is at most three `imageinfo` calls.
 */
import type { EnrichContext } from "./context";
import type { Db } from "@/lib/ingest/db";
import { CommonsVerifier, fileTitleFromUrl } from "./images/commons";
import { creditLine } from "./images/license";
import { bucketName, VARIANT_NAMES, variantPath } from "./images/process";

/** How many files one pass re-verifies. Deliberately small: this runs monthly, not hourly. */
export const RECHECK_LIMIT = 25;
export const MAX_RECHECK_LIMIT = 200;

export type RecheckRow = {
  id: string;
  sha256: string;
  provider: string;
  license: string;
  origin_page: string | null;
  origin_url: string;
};

export type RecheckSummary = {
  checked: number;
  ok: number;
  relicensed: number;
  dropped: number;
  /** Slugs whose page changed (their image was dropped), for cache invalidation. */
  changed: string[];
  errors: string[];
};

/** The oldest-checked Commons rows. `nullsFirst` puts any row that was never checked at the head. */
export async function dueForRecheck(db: Db, limit: number): Promise<RecheckRow[]> {
  const { data, error } = await db
    .from("images")
    .select("id, sha256, provider, license, origin_page, origin_url")
    .eq("provider", "commons")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error(`images recheck read failed: ${error.message}`);
  return (data ?? []) as RecheckRow[];
}

/** The Commons file title behind a stored row: the file page first, the bytes URL as a fallback. */
export function recheckFileTitle(row: Pick<RecheckRow, "origin_page" | "origin_url">): string | null {
  return (row.origin_page ? fileTitleFromUrl(row.origin_page) : null) ?? fileTitleFromUrl(row.origin_url);
}

async function dropImage(db: Db, row: RecheckRow, reason: string, summary: RecheckSummary): Promise<void> {
  const { data: events, error: readError } = await db.from("events").select("slug").eq("image_id", row.id);
  if (readError) throw new Error(`events read failed: ${readError.message}`);
  const slugs = ((events ?? []) as Array<{ slug: string }>).map((e) => e.slug);

  // Put the events back on the fallback card before the row disappears, so no page is ever left
  // claiming `image_status = 'ok'` with no image.
  const { error: eventError } = await db.from("events").update({ image_status: "skip" }).eq("image_id", row.id);
  if (eventError) throw new Error(`events image_status update failed: ${eventError.message}`);

  const paths = VARIANT_NAMES.map((name) => variantPath(row.sha256, name));
  const { error: storageError } = await db.storage.from(bucketName()).remove(paths);
  if (storageError) summary.errors.push(`storage remove ${row.sha256}: ${storageError.message}`);

  const { error: deleteError } = await db.from("images").delete().eq("id", row.id);
  if (deleteError) throw new Error(`images delete failed: ${deleteError.message}`);

  summary.dropped++;
  for (const slug of slugs) summary.changed.push(slug);
  summary.errors.push(`dropped ${row.origin_page ?? row.origin_url}: ${reason}`);
}

/**
 * Re-verify up to `limit` stored Commons files. `dryRun` reports what would happen and writes
 * nothing — including no `last_checked_at` bump, so a dry pass never hides a due row.
 */
export async function runRecheck(
  db: Db,
  ctx: EnrichContext,
  options: { limit?: number; dryRun?: boolean } = {},
): Promise<RecheckSummary> {
  const limit = Math.max(1, Math.min(options.limit ?? RECHECK_LIMIT, MAX_RECHECK_LIMIT));
  const summary: RecheckSummary = { checked: 0, ok: 0, relicensed: 0, dropped: 0, changed: [], errors: [] };
  const rows = await dueForRecheck(db, limit);
  if (rows.length === 0) return summary;

  const verifier = new CommonsVerifier(ctx);
  const titles = rows.map(recheckFileTitle).filter((t): t is string => Boolean(t));
  await verifier.warm(titles);

  for (const row of rows) {
    if (ctx.budget.remainingMs() < 8_000) break;
    const title = recheckFileTitle(row);
    if (!title) {
      summary.errors.push(`no file title for ${row.origin_page ?? row.origin_url}`);
      continue;
    }
    summary.checked++;
    try {
      const verdict = await verifier.verify(title, "recheck");
      if (!verdict.ok) {
        if (options.dryRun) {
          summary.dropped++;
          summary.errors.push(`would drop ${title}: ${verdict.reason}`);
          continue;
        }
        await dropImage(db, row, verdict.reason, summary);
        continue;
      }
      summary.ok++;
      if (options.dryRun) continue;
      const patch: Record<string, unknown> = { last_checked_at: new Date().toISOString() };
      if (verdict.image.license !== row.license) {
        // Still free, but under a different name: the stored credit has to say the same thing the
        // file page does.
        patch.license = verdict.image.license;
        patch.license_url = verdict.image.licenseUrl;
        patch.author = verdict.image.author;
        patch.credit = creditLine({ author: verdict.image.author, license: verdict.image.license, provider: "commons" });
        patch.attribution_required = verdict.image.attributionRequired;
        summary.relicensed++;
      }
      const { error } = await db.from("images").update(patch as never).eq("id", row.id);
      if (error) throw new Error(`images update failed: ${error.message}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof Error && err.name === "BudgetExceededError") break;
      if (summary.errors.length < 10) summary.errors.push(`${title}: ${message}`);
    }
  }
  return summary;
}
