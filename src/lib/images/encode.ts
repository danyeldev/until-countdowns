/**
 * The only WebP encoder the app uses. Catalog derivatives and collection uploads both go
 * through here so every object written to R2 is already the size and format the UI serves.
 *
 * Quality 90 / effort 6 is visually lossless on photographs at these widths — the previous
 * q80 / q75 encode was the visible quality drop. `smartSubsample` keeps chroma from banding
 * on skies and gradients.
 */
export const WEBP_EFFORT = 6;
export const WEBP_QUALITY = { hero: 90, card: 88, upload: 90 } as const;

export type EncodedWebp = { data: Buffer; width: number; height: number; contentType: "image/webp" };

export async function encodeWebp(
  source: Buffer,
  options: { width: number; quality: number; withoutEnlargement?: boolean },
): Promise<EncodedWebp> {
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(source, { animated: false })
    .rotate()
    .resize({ width: options.width, withoutEnlargement: options.withoutEnlargement ?? true })
    .webp({ quality: options.quality, alphaQuality: 100, smartSubsample: true, effort: WEBP_EFFORT })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, contentType: "image/webp" };
}

/** User-uploaded collection photo: one WebP, capped at the hero width, never enlarged. */
export async function optimizeUploadImage(source: Buffer, maxWidth = 1600): Promise<EncodedWebp> {
  if (source.byteLength === 0) throw new Error("empty image");
  return encodeWebp(source, { width: maxWidth, quality: WEBP_QUALITY.upload });
}
