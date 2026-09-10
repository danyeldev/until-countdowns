import { i18n } from "@/lib/i18n/server";
import type { Category } from "@/lib/types";

/**
 * The designed stand-in for an event with no freely licensed photo — which, per the coverage
 * survey, is most of the catalog (film, TV, games and anime are ~100% fair-use posters).
 *
 * Everything is derived from a hash of the slug: the same event always gets the same card, on
 * the server and in the browser, with no network request and no layout shift. The palette is
 * anchored to the category so a sports card never reads as an astronomy card, and the hue drift
 * inside that anchor keeps a grid of twelve cards from looking like wallpaper.
 *
 * The one word it prints is the category, so it reads the locale itself (as `StatusBadge` does)
 * rather than making every grid that draws a card pass a label down.
 */

const ASPECT = "16 / 9";

/** FNV-1a: short, stable, and identical wherever it runs. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Base hue per category (degrees). Neighbouring categories are kept apart on the wheel. */
const CATEGORY_HUE: Record<Category, number> = {
  holidays: 8,
  national: 352,
  religion: 268,
  awareness: 188,
  fun: 32,
  culture: 300,
  festivals: 320,
  sports: 108,
  esports: 158,
  games: 248,
  film: 218,
  tv: 202,
  anime: 330,
  music: 284,
  entertainment: 340,
  politics: 220,
  tech: 196,
  science: 168,
  space: 232,
  astronomy: 252,
  nature: 128,
  history: 40,
  curiosities: 60,
};

function hsl(h: number, s: number, l: number): string {
  return `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`;
}

export type FallbackCardProps = {
  slug: string;
  title: string;
  category: Category;
  /** `card` is the listing tile, `hero` the full-width block on an event page. */
  variant?: "card" | "hero";
  className?: string;
};

export async function FallbackCard({ slug, title, category, variant = "card", className }: FallbackCardProps) {
  const L = await i18n();
  const h = hash(slug);
  const base = CATEGORY_HUE[category] ?? 40;
  const hue = base + ((h % 28) - 14);
  const angle = 120 + (h >>> 5) % 90;
  const accent = hsl(hue + 26, 62, 52);
  const hero = variant === "hero";

  return (
    <div
      aria-hidden="true"
      className={`relative flex w-full flex-col justify-end overflow-hidden ${className ?? ""}`}
      style={{
        aspectRatio: ASPECT,
        background: `linear-gradient(${angle}deg, ${hsl(hue, 38, 16)} 0%, ${hsl(hue - 18, 30, 9)} 55%, ${hsl(hue + 24, 44, 13)} 100%)`,
      }}
    >
      {/* Two soft blooms placed from the hash: enough variety that no two cards read alike. */}
      <span
        className="pointer-events-none absolute rounded-full"
        style={{
          width: hero ? "46%" : "58%",
          aspectRatio: "1 / 1",
          left: `${8 + (h % 55)}%`,
          top: `${-18 + ((h >>> 7) % 40)}%`,
          background: `radial-gradient(circle, ${hsl(hue + 14, 70, 40)} 0%, transparent 68%)`,
          opacity: 0.5,
        }}
      />
      <span
        className="pointer-events-none absolute rounded-full"
        style={{
          width: hero ? "34%" : "42%",
          aspectRatio: "1 / 1",
          right: `${4 + ((h >>> 11) % 40)}%`,
          bottom: `${-20 + ((h >>> 13) % 34)}%`,
          background: `radial-gradient(circle, ${hsl(hue - 30, 64, 34)} 0%, transparent 70%)`,
          opacity: 0.45,
        }}
      />
      <span
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{ height: 3, background: `linear-gradient(90deg, ${accent}, transparent 70%)` }}
      />
      <div className={`relative ${hero ? "px-8 py-8 sm:px-10" : "px-4 py-4"}`}>
        <p
          className={`font-mono uppercase text-paper-dim ${hero ? "text-[11px] tracking-[0.28em]" : "text-[9px] tracking-[0.22em]"}`}
        >
          {L.m.categories.labels[category]}
        </p>
        <p
          className={`mt-1 font-serif leading-tight text-paper ${hero ? "line-clamp-3 text-3xl sm:text-4xl" : "line-clamp-2 text-base"}`}
        >
          {title}
        </p>
      </div>
    </div>
  );
}
