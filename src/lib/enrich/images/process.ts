/**
 * Download → validate → derive → store. The only place in the app that writes catalog
 * image bytes (Cloudflare R2 when configured, otherwise the injected storage client).
 *
 * Nothing is hotlinked: every accepted file is fetched once with the shared descriptive
 * User-Agent (12 MB cap, `image/*` only, 15 s), validated with sharp (it must decode and be at
 * least 400 px wide; an SVG is rendered at hero width first), hashed, and re-encoded into three
 * fixed derivatives under a content-addressed prefix, whatever the licence:
 *
 *   <sha256>/hero.webp   1600w, q90   — event page hero
 *   <sha256>/card.webp    640w, q88   — listing cards
 *   <sha256>/og.jpg    1200×630, q82  — social card background, kept under 600 KB (WhatsApp)
 *
 * The sha is the dedupe key: two events pointing at the same Commons file share one `images` row
 * and one set of objects. `events.image_id` is only ever *filled in*, never overwritten — a
 * curated image wins over anything the chain finds later.
 */
import { createHash } from "node:crypto";
import { rgbaToThumbHash } from "thumbhash";
import type { Db } from "@/lib/ingest/db";
import { userAgent } from "@/lib/ingest/http";
import { encodeWebp, WEBP_QUALITY } from "@/lib/images/encode";
import { creditLine, evaluateNamedLicense, isRehostableFileUrl, type LicensedImage } from "./license";

function r2WriteConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim() &&
      process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim(),
  );
}

async function resolveImageStorage(db: Db): Promise<StorageLike> {
  if (!r2WriteConfigured()) return db.storage as unknown as StorageLike;
  const { r2StorageLike } = await import("@/lib/r2");
  return r2StorageLike();
}

export const DEFAULT_BUCKET = "event-images";
/** Hard download cap; a bigger file is a scan or a panorama, not an event photo. */
export const MAX_DOWNLOAD_BYTES = 12 * 1024 * 1024;
export const DOWNLOAD_TIMEOUT_MS = 15_000;
/**
 * Below this a photo is a thumbnail, not a picture. 400 px still fills a 640 px card at the size
 * cards actually render (≤ 400 px on desktop, one column on phones) and is soft but usable as a
 * hero backdrop; the 800 px floor it replaces threw away the only free photo of ~400 events.
 */
export const MIN_SOURCE_WIDTH = 400;
/** WhatsApp refuses to preview cards over 600 KB. */
export const OG_MAX_BYTES = 600 * 1024;
const OG_QUALITY_STEPS = [82, 72, 62];
/** thumbhash needs a thumbnail of at most 100×100. */
const THUMB_MAX = 100;

export const VARIANTS = {
  hero: { file: "hero.webp", width: 1600, contentType: "image/webp" },
  card: { file: "card.webp", width: 640, contentType: "image/webp" },
  og: { file: "og.jpg", width: 1200, height: 630, contentType: "image/jpeg" },
} as const;

export type VariantName = keyof typeof VARIANTS;
export const VARIANT_NAMES = Object.keys(VARIANTS) as VariantName[];

export function bucketName(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
}

/** Content-addressed object key: `<sha256>/<variant file>`. */
export function variantPath(sha256: string, variant: VariantName): string {
  return `${sha256}/${VARIANTS[variant].file}`;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function hexColor(rgb: { r: number; g: number; b: number }): string {
  const to = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${to(rgb.r)}${to(rgb.g)}${to(rgb.b)}`;
}

/**
 * `permanent` marks a failure that re-running cannot fix — a 35 MB panorama, a 400 px thumbnail,
 * bytes that are not an image. The worker turns those into a terminal `skipped` job instead of
 * retrying the same URL every few hours until the attempt cap.
 */
export class ImageError extends Error {
  constructor(
    message: string,
    readonly permanent = false,
  ) {
    super(message);
    this.name = "ImageError";
  }
}

export function isPermanentImageError(err: unknown): boolean {
  return err instanceof ImageError && err.permanent;
}

/** Fetch the bytes with the shared UA, refusing non-images and anything over the cap. */
export async function downloadImage(url: string, maxBytes = MAX_DOWNLOAD_BYTES): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { "User-Agent": userAgent(), Accept: "image/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw new ImageError(`download failed: HTTP ${res.status}`);
  }
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) {
    await res.body?.cancel().catch(() => undefined);
    throw new ImageError(`not an image: content-type ${type || "(none)"}`, true);
  }
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel().catch(() => undefined);
    throw new ImageError(`too large: ${declared} bytes`, true);
  }
  // Read through the stream and stop at the cap rather than buffering first and measuring after:
  // a missing (or lying) `content-length` is common outside Wikimedia, and a 200 MB body must not
  // reach this function's memory before being rejected.
  const buffer = await readCapped(res, maxBytes);
  if (buffer.byteLength === 0) throw new ImageError("empty response", true);
  return buffer;
}

async function readCapped(res: Response, maxBytes: number): Promise<Buffer> {
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ImageError(`too large: over ${maxBytes} bytes`, true);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

export type Derivatives = {
  width: number;
  height: number;
  thumbhash: string;
  dominantColor: string;
  variants: Record<VariantName, { body: Buffer; contentType: string }>;
};

/**
 * The 1200×630 social-card crop, stepping the JPEG quality down until it fits WhatsApp's 600 KB
 * preview limit. Also used on its own to backfill `og.jpg` for files stored before every licence
 * got one.
 */
export async function buildOgVariant(source: Buffer): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  let og: Buffer | null = null;
  for (const quality of OG_QUALITY_STEPS) {
    og = await sharp(source, { animated: false })
      .rotate()
      .resize(VARIANTS.og.width, VARIANTS.og.height, { fit: "cover", position: "attention" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (og.byteLength <= OG_MAX_BYTES) break;
  }
  if (!og) throw new ImageError("og variant could not be encoded");
  return og;
}

/**
 * Decode once, then emit the three derivatives plus the placeholder metadata. Throws
 * `ImageError` when the bytes do not decode or the source is too small to use.
 */
export async function buildDerivatives(input: Buffer): Promise<Derivatives> {
  // `sharp` is a native module listed in `serverExternalPackages`: imported here so it is only
  // loaded inside the cron invocation that actually processes an image.
  const { default: sharp } = await import("sharp");

  let source = input;
  let meta: { width?: number; height?: number; format?: string };
  try {
    meta = await sharp(source).metadata();
  } catch (err) {
    throw new ImageError(`undecodable image: ${err instanceof Error ? err.message : String(err)}`, true);
  }
  if (!meta.width || !meta.height) throw new ImageError("image has no dimensions", true);

  // A vector file has no real width: render it at hero size and carry on with the bitmap.
  if (meta.format === "svg") {
    const density = Math.min(2400, Math.ceil((72 * VARIANTS.hero.width) / meta.width));
    try {
      source = await sharp(input, { density }).png().toBuffer();
      meta = await sharp(source).metadata();
    } catch (err) {
      throw new ImageError(`svg could not be rendered: ${err instanceof Error ? err.message : String(err)}`, true);
    }
    if (!meta.width || !meta.height) throw new ImageError("svg rendered to nothing", true);
  }
  if (meta.width < MIN_SOURCE_WIDTH) throw new ImageError(`too small: ${meta.width}px wide (minimum ${MIN_SOURCE_WIDTH})`, true);

  // `.rotate()` with no argument applies the EXIF orientation before every resize.
  const base = () => sharp(source, { animated: false }).rotate();

  const hero = await encodeWebp(source, { width: VARIANTS.hero.width, quality: WEBP_QUALITY.hero });
  const card = await encodeWebp(source, { width: VARIANTS.card.width, quality: WEBP_QUALITY.card });
  const og = await buildOgVariant(source);

  const stats = await base().stats();
  const thumb = await base()
    .resize({ width: THUMB_MAX, height: THUMB_MAX, fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const hash = rgbaToThumbHash(thumb.info.width, thumb.info.height, thumb.data);

  return {
    width: hero.width,
    height: hero.height,
    thumbhash: Buffer.from(hash).toString("base64"),
    dominantColor: hexColor(stats.dominant),
    variants: {
      hero: { body: hero.data, contentType: VARIANTS.hero.contentType },
      card: { body: card.data, contentType: VARIANTS.card.contentType },
      og: { body: og, contentType: VARIANTS.og.contentType },
    },
  };
}

// ---------------------------------------------------------------------------
// Storage + database
// ---------------------------------------------------------------------------

/** Minimal surface of the object store, so the tests can pass a stub. */
export type StorageLike = {
  from: (bucket: string) => {
    upload: (
      path: string,
      body: Buffer,
      options: { upsert: boolean; cacheControl: string; contentType: string },
    ) => Promise<{ error: { message: string } | null }>;
    getPublicUrl: (path: string) => { data: { publicUrl: string } };
    remove?: (paths: string[]) => Promise<{ error: { message: string } | null }>;
  };
};

export async function uploadVariant(
  storage: StorageLike,
  sha256: string,
  name: VariantName,
  variant: { body: Buffer; contentType: string },
): Promise<void> {
  const { error } = await storage.from(bucketName()).upload(variantPath(sha256, name), variant.body, {
    upsert: true,
    cacheControl: "31536000",
    contentType: variant.contentType,
  });
  if (error) throw new ImageError(`storage upload of ${variantPath(sha256, name)} failed: ${error.message}`);
}

export async function uploadVariants(storage: StorageLike, sha256: string, derivatives: Derivatives): Promise<string> {
  for (const name of VARIANT_NAMES) {
    await uploadVariant(storage, sha256, name, derivatives.variants[name]);
  }
  return storage.from(bucketName()).getPublicUrl(variantPath(sha256, "hero")).data.publicUrl;
}

export type StoredImage = { imageId: string; sha256: string; reused: boolean; publicUrl: string };

/** An existing row for the same origin URL (checked before downloading anything). */
export async function findImageByOrigin(db: Db, originUrl: string): Promise<StoredImage | null> {
  const { data, error } = await db.from("images").select("id, sha256, public_url").eq("origin_url", originUrl).limit(1).maybeSingle();
  if (error) throw new ImageError(`images lookup failed: ${error.message}`);
  return data ? { imageId: data.id, sha256: data.sha256, reused: true, publicUrl: data.public_url } : null;
}

export async function findImageBySha(db: Db, sha256: string): Promise<StoredImage | null> {
  const { data, error } = await db.from("images").select("id, sha256, public_url").eq("sha256", sha256).limit(1).maybeSingle();
  if (error) throw new ImageError(`images lookup failed: ${error.message}`);
  return data ? { imageId: data.id, sha256: data.sha256, reused: true, publicUrl: data.public_url } : null;
}

/**
 * Download, derive, upload and insert (or reuse) the `images` row for one licensed candidate.
 * Returns the row id plus whether the bytes were already known.
 */
export async function storeLicensedImage(db: Db, candidate: LicensedImage): Promise<StoredImage> {
  // The single write choke point re-checks both halves of the gate, so a future branch of the
  // discovery chain cannot bypass `license.ts` by handing over a candidate of its own.
  if (!isRehostableFileUrl(candidate.fileUrl)) {
    throw new ImageError(`unlicensed candidate host: ${candidate.fileUrl.slice(0, 120)}`, true);
  }
  const licence = evaluateNamedLicense(candidate.license);
  if (!licence.ok) throw new ImageError(`unlicensed candidate: ${licence.reason}`, true);

  const known = await findImageByOrigin(db, candidate.fileUrl);
  if (known) return known;

  const source = await downloadImage(candidate.fileUrl);
  const sha256 = sha256Hex(source);
  const bySha = await findImageBySha(db, sha256);
  if (bySha) return bySha;

  const derivatives = await buildDerivatives(source);
  const publicUrl = await uploadVariants(await resolveImageStorage(db), sha256, derivatives);

  const row = {
    sha256,
    storage_path: sha256,
    public_url: publicUrl,
    width: derivatives.width,
    height: derivatives.height,
    thumbhash: derivatives.thumbhash,
    dominant_color: derivatives.dominantColor,
    provider: candidate.provider,
    origin_url: candidate.fileUrl,
    origin_page: candidate.originPage,
    license: candidate.license,
    license_url: candidate.licenseUrl,
    author: candidate.author,
    credit: creditLine({ author: candidate.author, license: candidate.license, provider: candidate.provider }),
    attribution_required: candidate.attributionRequired,
    last_checked_at: new Date().toISOString(),
  };
  const { data, error } = await db.from("images").insert(row).select("id").single();
  if (error) {
    // A concurrent run may have inserted the same sha between the lookup and the insert.
    const raced = await findImageBySha(db, sha256);
    if (raced) return raced;
    throw new ImageError(`images insert failed: ${error.message}`);
  }
  return { imageId: data.id, sha256, reused: false, publicUrl };
}

/**
 * Point an event at a stored image. The first write is non-destructive (`.is('image_id', null)`)
 * so a curated image always wins; the second one exists because that filter would otherwise
 * leave a curated row's `image_status` stuck at `pending` forever — the status has to describe
 * reality either way.
 */
export async function attachImageToEvent(db: Db, eventId: string, imageId: string): Promise<void> {
  const { error } = await db
    .from("events")
    .update({ image_id: imageId, image_status: "ok" })
    .eq("id", eventId)
    .is("image_id", null);
  if (error) throw new ImageError(`events image_id update failed: ${error.message}`);
  const { error: statusError } = await db
    .from("events")
    .update({ image_status: "ok" })
    .eq("id", eventId)
    .not("image_id", "is", null);
  if (statusError) throw new ImageError(`events image_status update failed: ${statusError.message}`);
}

/** The series inherits the first image one of its occurrences gets. */
export async function attachImageToSeries(db: Db, seriesSlug: string, imageId: string): Promise<void> {
  const { error } = await db.from("series").update({ image_id: imageId }).eq("slug", seriesSlug).is("image_id", null);
  if (error) throw new ImageError(`series image_id update failed: ${error.message}`);
}

/** No licensed candidate: the UI falls back to the generated card, and we remember why. */
export async function markImageSkipped(db: Db, eventId: string): Promise<void> {
  const { error } = await db.from("events").update({ image_status: "skip" }).eq("id", eventId).is("image_id", null);
  if (error) throw new ImageError(`events image_status update failed: ${error.message}`);
}

export async function markImageFailed(db: Db, eventId: string): Promise<void> {
  const { error } = await db.from("events").update({ image_status: "failed" }).eq("id", eventId).is("image_id", null);
  if (error) throw new ImageError(`events image_status update failed: ${error.message}`);
}
