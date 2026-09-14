import Image from "next/image";
import type { Category } from "@/lib/types";
import { Icon, type IconName } from "./Icon";

function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++)
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}
const CATEGORY_HUE: Partial<Record<Category, number>> = {
  holidays: 140,
  national: 125,
  religion: 30,
  awareness: 240,
  fun: 145,
  culture: 65,
  festivals: 50,
  sports: 210,
  esports: 280,
  games: 0,
  film: 25,
  tv: 335,
  anime: 80,
  music: 60,
  entertainment: 110,
  politics: 310,
  tech: 325,
  science: 265,
  space: 0,
  astronomy: 345,
  nature: 235,
  history: 165,
  curiosities: 170,
};
const CATEGORY_ICON: Partial<Record<Category, IconName>> = {
  astronomy: "moon",
  space: "spark",
  nature: "leaf",
  holidays: "calendar",
  national: "globe",
  sports: "trophy",
  film: "film",
  tv: "film",
  music: "music",
  games: "grid",
  tech: "bolt",
};

export type FallbackCardProps = {
  slug: string;
  title: string;
  category: Category;
  variant?: "card" | "hero";
  className?: string;
};

/** Original abstract artwork is decorative; it never represents a photograph of the event. */
export function FallbackCard({
  slug,
  category,
  variant = "card",
  className,
}: FallbackCardProps) {
  const variation = hash(slug);
  const cosmic = ["space", "astronomy", "science", "nature"].includes(category);
  const celebrate = [
    "holidays",
    "national",
    "religion",
    "culture",
    "fun",
    "festivals",
    "awareness",
  ].includes(category);
  const artwork = cosmic
    ? "cosmos"
    : celebrate || variation % 3 === 0
      ? "ribbon"
      : "sculpture";
  return (
    <div
      aria-hidden="true"
      className={`event-art w-full ${className ?? ""}`}
      style={{ aspectRatio: variant === "hero" ? "2 / 1" : "1.85" }}
    >
      <Image
        src={`/art/until-${artwork}.png`}
        alt=""
        fill
        sizes={variant === "hero" ? "100vw" : "(max-width: 640px) 100vw, 400px"}
        className="object-cover"
        style={{
          filter: `hue-rotate(${(artwork === "sculpture" ? (CATEGORY_HUE[category] ?? 0) : 0) + (variation % 25)}deg)`,
          objectPosition: `${65 + (variation % 25)}% center`,
          transform: `scale(${1.05 + (variation % 3) * 0.14})`,
        }}
      />
      <div className="absolute inset-0 bg-linear-to-r from-black/40 to-transparent" />
      <span className="absolute bottom-4 left-4 z-10 flex size-9 items-center justify-center rounded-xl border border-white/15 bg-black/25 text-white/80 backdrop-blur-sm">
        <Icon name={CATEGORY_ICON[category] ?? "spark"} size={18} />
      </span>
    </div>
  );
}
