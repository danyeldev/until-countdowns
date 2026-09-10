/**
 * URLs and sizes for the re-hosted image derivatives.
 *
 * `images.public_url` (exposed as `event.image.url`) points at the hero variant; every variant of
 * one image lives under the same content-addressed prefix `<sha256>/`, so the others are a
 * filename swap away. `image.width` / `image.height` are the hero's dimensions, which is what
 * makes the aspect ratio — and therefore a zero-CLS box — known before the bytes arrive.
 *
 * Client-safe: no server imports, no network.
 */
import type { EventImage } from "./types";

export const IMAGE_VARIANTS = {
  hero: { file: "hero.webp", width: 1600 },
  card: { file: "card.webp", width: 640 },
  og: { file: "og.jpg", width: 1200, height: 630 },
} as const;

export type ImageVariant = keyof typeof IMAGE_VARIANTS;

const VARIANT_FILES: ReadonlySet<string> = new Set(Object.values(IMAGE_VARIANTS).map((v) => v.file));

/**
 * Public URL of one variant. A URL that does not end in a known variant filename (a curated
 * image stored before the pipeline existed) is returned untouched.
 */
export function imageUrl(image: Pick<EventImage, "url">, variant: ImageVariant = "hero"): string {
  const url = image.url;
  const cut = url.lastIndexOf("/");
  if (cut < 0) return url;
  const [name] = url.slice(cut + 1).split("?");
  if (!VARIANT_FILES.has(name)) return url;
  return `${url.slice(0, cut + 1)}${IMAGE_VARIANTS[variant].file}`;
}

/** Rendered pixel size of a variant, derived from the stored hero dimensions. */
export function imageSize(image: Pick<EventImage, "width" | "height">, variant: ImageVariant = "hero"): { width: number; height: number } {
  if (variant === "og") return { width: IMAGE_VARIANTS.og.width, height: IMAGE_VARIANTS.og.height };
  const source = IMAGE_VARIANTS[variant].width;
  if (!image.width || !image.height) return { width: source, height: Math.round(source * 0.5625) };
  const width = Math.min(source, image.width);
  return { width, height: Math.max(1, Math.round((width * image.height) / image.width)) };
}

/**
 * `16 / 9` style ratio string for a CSS `aspect-ratio`, guarding against zero dimensions — and a
 * hero never gets taller than 5:4 whatever the source is. Two in five stored files are
 * portraits (up to 1600×3213); at their own ratio one of them renders three viewport heights of
 * photo above the countdown and becomes the LCP element. The box is clamped and `object-cover`
 * crops the rest — the ratio is still known before the bytes arrive, so CLS stays at 0.
 */
export const MIN_HERO_ASPECT = 0.8;

export function heroAspectRatio(image: Pick<EventImage, "width" | "height">): string {
  if (!(image.width > 0 && image.height > 0)) return "16 / 9";
  const ratio = image.width / image.height;
  return ratio >= MIN_HERO_ASPECT ? `${image.width} / ${image.height}` : `${MIN_HERO_ASPECT} / 1`;
}

/**
 * ShareAlike detection, applied to the stored `LicenseShortName` ("CC BY-SA 4.0",
 * "CC BY-SA 3.0 IGO", "Attribution-ShareAlike").
 *
 * It matters because of what we are allowed to *make* from a file, not what we may show: a
 * BY-SA photo may be published unmodified with its credit, but cropping it to 1200×630 and
 * laying a scrim, a title and a wordmark over it produces Adapted Material (CC BY-SA 4.0
 * §2(a)(1)(B)), which would have to be released under a BY-SA-compatible licence and said so on
 * the card. The plan's answer is the cheap one: ShareAlike files keep the hero and lose the
 * social card, which falls back to the seeded gradient.
 */
const SHARE_ALIKE_RE = /(?:^|[\s\-])sa(?:[\s\-.]|$)|share\s*-?\s*alike/i;

export function isShareAlike(license: string | null | undefined): boolean {
  return Boolean(license && SHARE_ALIKE_RE.test(license));
}

/**
 * Background for the OG composite, or null when the card must fall back to the gradient
 * (no image, or a ShareAlike licence).
 */
export function ogBackgroundUrl(image: Pick<EventImage, "url" | "license"> | null | undefined): string | null {
  if (!image?.url) return null;
  if (isShareAlike(image.license)) return null;
  return imageUrl(image, "og");
}

/**
 * The credit drawn on an OG card. Composed from the parts instead of clamping the finished
 * string: the licence name is the one piece that may never be cut, so only the author is
 * truncated (a 60-character museum credit used to push "CC BY 4.0" off the card).
 */
export function shortCredit(
  image: Pick<EventImage, "author" | "license" | "credit">,
  maxAuthor = 30,
): string | null {
  const license = image.license?.trim() || null;
  const author = image.author?.trim() || null;
  if (author) {
    const short = author.length > maxAuthor ? `${author.slice(0, maxAuthor - 1).trimEnd()}…` : author;
    return license ? `Photo: ${short} · ${license}` : `Photo: ${short}`;
  }
  if (license) return license;
  return image.credit?.trim() || null;
}

/**
 * Alt text. The photo illustrates the event rather than depicting a specific thing we can
 * describe, so the event title is the honest description.
 */
export function imageAlt(title: string): string {
  return title;
}

/** Display names for `images.provider`, shared by the credit line and the attributions page. */
export const PROVIDER_LABELS: Record<string, string> = {
  commons: "Wikimedia Commons",
  wikipedia: "Wikimedia Commons",
  nasa: "NASA",
  launchlibrary: "Launch Library 2",
  generated: "Until",
};

export function providerLabel(provider: string | null | undefined): string {
  if (!provider) return "an open source";
  return PROVIDER_LABELS[provider] ?? provider;
}
