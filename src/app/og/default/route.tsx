import { CACHE_UNDATED, renderOgCard } from "@/lib/og";

export const runtime = "nodejs";

/** Site-wide fallback card (home page, hubs without their own card, unknown slugs). */
export async function GET() {
  return renderOgCard(
    {
      eyebrow: "A little anticipation goes a long way",
      title: "Something to look forward to.",
      subtitle: "Holidays, sports, space, culture. Your next great thing.",
      seed: "default",
    },
    CACHE_UNDATED,
  );
}
