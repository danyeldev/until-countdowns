import { CACHE_UNDATED, renderOgCard } from "@/lib/og";

export const runtime = "nodejs";

export async function GET() {
  return renderOgCard(
    {
      eyebrow: "Collections",
      title: "Until's lists",
      subtitle: "Horror this month, festivals this week, and lists people share.",
      seed: "collections",
    },
    CACHE_UNDATED,
  );
}
