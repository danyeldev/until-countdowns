import type { NextRequest } from "next/server";
import { loadFeaturedCollection, parseFeaturedCollectionSlug } from "@/lib/featured-collections";
import { firstOgBackground } from "@/lib/images";
import { CACHE_UNDATED, renderOgCard } from "@/lib/og";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await ctx.params;
  const slug = parseFeaturedCollectionSlug(raw.replace(/\.png$/, ""));
  if (!slug) return new Response("Unknown collection", { status: 404 });
  const collection = await loadFeaturedCollection(slug);
  if (!collection) return new Response("Unknown collection", { status: 404 });
  const background = firstOgBackground(collection.events);
  return renderOgCard(
    {
      eyebrow: "Until's lists",
      title: collection.meta.title,
      subtitle: collection.meta.description,
      imageUrl: background?.imageUrl,
      imageCredit: background?.imageCredit,
      seed: `featured:${slug}`,
    },
    CACHE_UNDATED,
  );
}
