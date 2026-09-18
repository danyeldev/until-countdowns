/**
 * Catalog image maintenance.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/catalog-images.ts optimize
 *     Re-encode every stored image from its origin as high-quality WebP and overwrite R2.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/catalog-images.ts og
 *     Build the missing `og.jpg` for every stored image (from the R2 hero), so social cards
 *     carry the photo whatever its licence.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/catalog-images.ts requeue
 *     Put back in the queue every image job that was skipped under a rule that no longer
 *     applies (800 px minimum, insignia / personality restrictions, SVG / TIFF / GIF, the
 *     Flickr Commons licence labels).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/catalog-images.ts drain
 *     Run the enrichment worker over the image queue until it is empty.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/catalog-images.ts fill
 *     Inherit series photos, store pending licensed candidates, re-queue featured skips,
 *     then run the discovery chain for a slice of events still missing a picture.
 */
import { createClient } from "@supabase/supabase-js";
import { buildDerivatives, buildOgVariant, downloadImage, uploadVariant, uploadVariants, VARIANTS } from "@/lib/enrich/images/process";
import { r2StorageLike } from "@/lib/r2";
import { hydrateEventImages } from "@/lib/enrich/images/hydrate";
import { getDb } from "@/lib/ingest/db";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");

const db = createClient(url, key, { auth: { persistSession: false } });
const command = process.argv[2] ?? "fill";
const limit = Number(process.argv[3] ?? 0) || undefined;

type ImageRow = {
  id: string;
  sha256: string;
  origin_url: string;
  license: string | null;
};

function hostedBase(): string {
  const hosted = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!hosted) throw new Error("NEXT_PUBLIC_R2_PUBLIC_URL is not set");
  return hosted;
}

async function allImages(): Promise<ImageRow[]> {
  const rows: ImageRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("images")
      .select("id, sha256, origin_url, license")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...(data as ImageRow[]));
    if (data.length < 1000) break;
  }
  return rows;
}

async function parallel(count: number, total: number, work: (index: number) => Promise<void>): Promise<void> {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: count }, async () => {
      while (cursor < total) await work(cursor++);
    }),
  );
}

async function optimizeExisting(): Promise<void> {
  const rows = await allImages();
  const storage = r2StorageLike();
  const stats = { ok: 0, errors: 0 };
  const queue = rows.slice(0, limit ?? rows.length);
  console.log(`optimize: ${rows.length} images, doing ${queue.length}`);
  await parallel(3, queue.length, async (i) => {
    const row = queue[i];
    try {
      let source: Buffer;
      try {
        source = await downloadImage(row.origin_url);
      } catch {
        source = await downloadImage(`${hostedBase()}/${row.sha256}/hero.webp`);
      }
      await uploadVariants(storage, row.sha256, await buildDerivatives(source));
      stats.ok++;
    } catch (err) {
      stats.errors++;
      if (stats.errors <= 25) console.log("optimize error", row.sha256.slice(0, 12), err instanceof Error ? err.message : err);
    }
    if ((i + 1) % 25 === 0) console.log(`optimize progress ${i + 1}/${queue.length}`, stats);
  });
  console.log("optimize done", stats);
}

/** `og.jpg` for every stored image that lacks one, built from the 1600px hero already on R2. */
async function backfillOg(): Promise<void> {
  const rows = await allImages();
  const storage = r2StorageLike();
  const base = hostedBase();
  const stats = { built: 0, present: 0, errors: 0 };
  const queue = rows.slice(0, limit ?? rows.length);
  console.log(`og: ${rows.length} images, checking ${queue.length}`);
  await parallel(4, queue.length, async (i) => {
    const row = queue[i];
    try {
      const head = await fetch(`${base}/${row.sha256}/${VARIANTS.og.file}`, { method: "HEAD" });
      if (head.ok) {
        stats.present++;
      } else {
        const hero = await downloadImage(`${base}/${row.sha256}/hero.webp`);
        await uploadVariant(storage, row.sha256, "og", { body: await buildOgVariant(hero), contentType: VARIANTS.og.contentType });
        stats.built++;
      }
    } catch (err) {
      stats.errors++;
      if (stats.errors <= 25) console.log("og error", row.sha256.slice(0, 12), err instanceof Error ? err.message : err);
    }
    if ((i + 1) % 100 === 0) console.log(`og progress ${i + 1}/${queue.length}`, stats);
  });
  console.log("og done", stats);
}

/**
 * Jobs parked under a rule that has since been relaxed. The `last_error` string is the pipeline's
 * own reason text, so matching it is exact rather than heuristic.
 */
const RELAXED_RULES = [
  "too small: %px wide (minimum 800)",
  "%restricted: insignia%",
  "%restricted: personality%",
  "%unsupported mime image/svg+xml%",
  "%unsupported mime image/tiff%",
  "%unsupported mime image/gif%",
  '%not on the allowlist: "No restrictions"%',
  '%not on the allowlist: "Attribution"%',
];

async function requeueRelaxed(): Promise<void> {
  const ids = new Set<string>();
  const eventIds = new Set<string>();
  for (const pattern of RELAXED_RULES) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from("enrichment_jobs")
        .select("id, event_id, last_error")
        .eq("kind", "image")
        .in("status", ["skipped", "failed"])
        .like("last_error", pattern)
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        // A 291px thumbnail is still too small; only widths the new floor accepts come back.
        const width = /too small: (\d+)px/.exec(row.last_error ?? "");
        if (width && Number(width[1]) < 400 && !/restricted|unsupported|allowlist/.test(row.last_error ?? "")) continue;
        ids.add(row.id);
        eventIds.add(row.event_id);
      }
      if (!data || data.length < 1000) break;
    }
  }
  console.log(`requeue: ${ids.size} jobs over ${eventIds.size} events`);
  const jobIds = [...ids];
  const events = [...eventIds];
  for (let i = 0; i < jobIds.length; i += 200) {
    const { error } = await db
      .from("enrichment_jobs")
      .update({ status: "pending", attempts: 0, last_error: null, next_attempt_at: new Date().toISOString() })
      .in("id", jobIds.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }
  for (let i = 0; i < events.length; i += 200) {
    const { error } = await db.from("events").update({ image_status: "pending" }).in("id", events.slice(i, i + 200)).is("image_id", null);
    if (error) throw new Error(error.message);
  }
  console.log("requeue done");
}

/** Run the worker over the image queue until a pass claims nothing (or `limit` passes). */
async function drainQueue(): Promise<void> {
  const { runEnrichment } = await import("@/lib/enrich/run");
  const totals = { done: 0, skipped: 0, failed: 0, images_created: 0, images_reused: 0 };
  const maxPasses = limit ?? 400;
  for (let pass = 1; pass <= maxPasses; pass++) {
    const summary = await runEnrichment({ kinds: ["image"], limit: 20, dryRun: false, budgetMs: 240_000 });
    totals.done += summary.done;
    totals.skipped += summary.skipped;
    totals.failed += summary.failed;
    totals.images_created += summary.images_created;
    totals.images_reused += summary.images_reused;
    console.log(`drain pass ${pass}: claimed ${summary.claimed}`, {
      done: summary.done,
      skipped: summary.skipped,
      failed: summary.failed,
      created: summary.images_created,
      reused: summary.images_reused,
    }, summary.errors.slice(0, 3));
    if (summary.claimed === 0) break;
  }
  console.log("drain done", totals);
}

async function pendingSlugs(max: number): Promise<string[]> {
  const { data, error } = await db
    .from("events")
    .select("slug")
    .is("image_id", null)
    .eq("image_status", "pending")
    .not("image_candidate_url", "is", null)
    .order("popularity", { ascending: false })
    .limit(max);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.slug);
}

async function missingSlugs(max: number): Promise<string[]> {
  const { data, error } = await db
    .from("events")
    .select("slug")
    .is("image_id", null)
    .eq("published", true)
    .in("image_status", ["skip", "none", "pending"])
    .gte("starts_on", "2026-09-18")
    .or("featured.eq.true,popularity.gte.70")
    .order("popularity", { ascending: false })
    .limit(max);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.slug);
}

async function requeueFeaturedSkips(): Promise<number> {
  const { data: events, error } = await db
    .from("events")
    .select("id")
    .is("image_id", null)
    .eq("image_status", "skip")
    .or("featured.eq.true,popularity.gte.80");
  if (error) throw new Error(error.message);
  const ids = (events ?? []).map((row) => row.id);
  if (!ids.length) return 0;
  await db.from("events").update({ image_status: "pending" }).in("id", ids);
  const { data: jobs } = await db.from("enrichment_jobs").select("id").eq("kind", "image").in("event_id", ids);
  const jobIds = (jobs ?? []).map((row) => row.id);
  if (jobIds.length) {
    await db
      .from("enrichment_jobs")
      .update({
        status: "pending",
        attempts: 0,
        last_error: null,
        next_attempt_at: new Date().toISOString(),
      })
      .in("id", jobIds);
  }
  return ids.length;
}

async function fillMissing(): Promise<void> {
  console.log("fill: starting");
  const requeued = await requeueFeaturedSkips();
  console.log("requeued featured/high-pop skips", requeued);

  const service = await getDb();
  const pending = await pendingSlugs(limit ?? 700);
  console.log("pending candidates", pending.length);
  for (let i = 0; i < pending.length; i += 8) {
    const chunk = pending.slice(i, i + 8);
    const summary = await hydrateEventImages(chunk, { db: service, budgetMs: 80_000 });
    console.log("pending chunk", i, summary);
  }

  const missing = await missingSlugs(limit ?? 80);
  console.log("featured/high-pop still missing", missing.length);
  for (let i = 0; i < missing.length; i += 6) {
    const chunk = missing.slice(i, i + 6);
    const summary = await hydrateEventImages(chunk, { db: service, budgetMs: 90_000 });
    console.log("search chunk", i, summary);
  }
}

async function attachSeriesImages(seriesSlug: string): Promise<number> {
  const { data: series, error } = await db.from("series").select("image_id").eq("slug", seriesSlug).maybeSingle();
  if (error) throw new Error(error.message);
  if (!series?.image_id) return 0;
  const { data, error: updateError } = await db
    .from("events")
    .update({ image_id: series.image_id, image_status: "ok" })
    .eq("series_slug", seriesSlug)
    .is("image_id", null)
    .select("id");
  if (updateError) throw new Error(updateError.message);
  return data?.length ?? 0;
}

async function main(): Promise<void> {
  if (command === "optimize") await optimizeExisting();
  else if (command === "og") await backfillOg();
  else if (command === "requeue") await requeueRelaxed();
  else if (command === "drain") await drainQueue();
  else if (command === "fill") await fillMissing();
  else if (command === "slugs") {
    const slugs = process.argv.slice(3);
    const summary = await hydrateEventImages(slugs, { budgetMs: Math.max(60_000, slugs.length * 12_000) });
    console.log(summary);
  }
  else if (command === "series") {
    const copied = await attachSeriesImages(process.argv[3] ?? "");
    console.log("copied series image to", copied, "events");
  }
  else throw new Error(`unknown command ${command} (use optimize|og|requeue|drain|fill|slugs|series)`);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
