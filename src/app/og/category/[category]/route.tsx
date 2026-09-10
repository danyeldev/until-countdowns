import type { NextRequest } from "next/server";
import { isCategory } from "@/lib/catalog";
import { CATEGORY_BLURB, CATEGORY_LABELS } from "@/lib/labels";
import { CACHE_UNDATED, renderOgCard } from "@/lib/og";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ category: string }> }) {
  const { category } = await ctx.params;
  const slug = category.replace(/\.png$/, "").toLowerCase();
  if (!isCategory(slug)) return new Response("Unknown category", { status: 404 });
  return renderOgCard(
    {
      eyebrow: "Category",
      title: `Upcoming ${CATEGORY_LABELS[slug].toLowerCase()}`,
      subtitle: CATEGORY_BLURB[slug],
      seed: `category:${slug}`,
    },
    CACHE_UNDATED,
  );
}
