import { CACHE_UNDATED, renderOgCard } from "@/lib/og";

export const runtime = "nodejs";

/** Site-wide fallback card (home page, hubs without their own card, unknown slugs). */
export async function GET() {
  return renderOgCard(
    {
      eyebrow: "Countdowns for everything coming",
      title: "Until",
      subtitle: "Holidays, eclipses, World Cups, elections — ticking.",
      seed: "default",
    },
    CACHE_UNDATED,
  );
}
