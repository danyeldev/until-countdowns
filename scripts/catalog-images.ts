/**
 * Catalog image maintenance.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/catalog-images.ts optimize
 *     Re-encode every stored image from its origin as high-quality WebP and overwrite R2.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/catalog-images.ts fill
 *     Inherit series photos, store pending licensed candidates, re-queue featured skips,
 *     then run the discovery chain for a slice of events still missing a picture.
 */
import { createClient } from "@supabase/supabase-js";
import { isShareAlike } from "@/lib/images";
import { buildDerivatives, downloadImage, uploadVariants } from "@/lib/enrich/images/process";
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

async function optimizeExisting(): Promise<void> {
  const rows = await allImages();
  const storage = r2StorageLike();
  const stats = { ok: 0, skip: 0, errors: 0 };
  const cap = limit ?? rows.length;
  const queue = rows.slice(0, cap);
  console.log(`optimize: ${rows.length} images, doing ${queue.length}`);
  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const i = cursor++;
      const row = queue[i];
      try {
        let source: Buffer;
        try {
          source = await downloadImage(row.origin_url);
        } catch (err) {
          const hosted = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "");
          if (!hosted) throw err;
          source = await downloadImage(`${hosted}/${row.sha256}/hero.webp`);
        }
        const derivatives = await buildDerivatives(source, { includeOg: !isShareAlike(row.license) });
        await uploadVariants(storage, row.sha256, derivatives);
        stats.ok++;
      } catch (err) {
        stats.errors++;
        if (stats.errors <= 25) {
          console.log("optimize error", row.sha256.slice(0, 12), err instanceof Error ? err.message : err);
        }
      }
      if ((i + 1) % 25 === 0) console.log(`optimize progress ${i + 1}/${queue.length}`, stats);
    }
  }
  await Promise.all(Array.from({ length: 3 }, () => worker()));
  console.log("optimize done", stats);
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
  else throw new Error(`unknown command ${command} (use optimize|fill|slugs|series)`);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
