import Image from "next/image";
import { heroAspectRatio, imageSize, imageUrl, type ImageVariant } from "@/lib/images";
import { thumbhashToDataUrl } from "@/lib/thumbhash";
import type { EventImage as EventImageType } from "@/lib/types";

/**
 * One re-hosted event photo.
 *
 * The derivatives are already the exact widths the layouts ask for (640 for a card, 1600 for a
 * hero), so `unoptimized` sends them straight from Supabase Storage instead of round-tripping
 * through the optimizer — they are content-addressed and cached for a year.
 *
 * The box always has a known aspect ratio before the bytes arrive (16:9 for cards, the image's
 * own ratio for heroes, clamped so a portrait source never grows past 5:4) and is painted with the
 * stored dominant colour under a thumbhash blur, so the page never shifts while it loads.
 */
export type EventImageProps = {
  image: EventImageType;
  alt: string;
  /** `card` uses the 640px derivative in a fixed 16:9 crop; `hero` uses 1600px at its (clamped) ratio. */
  variant?: Extract<ImageVariant, "card" | "hero">;
  /** First image above the fold on a page (the event hero, the featured card). */
  priority?: boolean;
  sizes?: string;
  className?: string;
};

const DEFAULT_SIZES: Record<"card" | "hero", string> = {
  card: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  hero: "(max-width: 1024px) 100vw, 900px",
};

export function EventImage({ image, alt, variant = "card", priority = false, sizes, className }: EventImageProps) {
  const src = imageUrl(image, variant);
  const { width, height } = imageSize(image, variant);
  const blurDataURL = thumbhashToDataUrl(image.thumbhash);

  return (
    <div
      className={`relative overflow-hidden bg-ink-2 ${className ?? ""}`}
      style={{
        aspectRatio: variant === "card" ? "16 / 9" : heroAspectRatio(image),
        backgroundColor: image.color ?? undefined,
      }}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes ?? DEFAULT_SIZES[variant]}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        unoptimized
        {...(blurDataURL ? { placeholder: "blur" as const, blurDataURL } : {})}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
