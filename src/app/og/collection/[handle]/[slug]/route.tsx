import type { NextRequest } from "next/server";
import { parseProfileParam } from "@/lib/auth/profile";
import { collectionImageUrl, parseCollectionSlug } from "@/lib/collections";
import { getPublicCollectionServer } from "@/lib/collections-server";
import { firstOgBackground } from "@/lib/images";
import { CACHE_UNDATED, renderOgCard } from "@/lib/og";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ handle: string; slug: string }> }) {
  const { handle: rawHandle, slug: rawSlug } = await ctx.params;
  const handle = parseProfileParam(rawHandle);
  const slug = parseCollectionSlug(rawSlug.replace(/\.png$/, ""));
  if (!handle || !slug) return new Response("Unknown collection", { status: 404 });
  const collection = await getPublicCollectionServer(handle, slug);
  if (!collection) return new Response("Unknown collection", { status: 404 });

  const cover = collection.images[0] ? collectionImageUrl(collection.images[0].path) : "";
  const uploaded = /^https:\/\//.test(cover) ? cover : "";
  const background = uploaded ? null : firstOgBackground(collection.items);
  const count = collection.items.length;
  return renderOgCard(
    {
      eyebrow: `@${collection.owner.handle}`,
      title: collection.title,
      subtitle:
        collection.description ||
        (count > 0 ? `${count} countdown${count === 1 ? "" : "s"}` : "A public countdown list"),
      imageUrl: uploaded || background?.imageUrl,
      imageCredit: uploaded ? null : background?.imageCredit,
      seed: `collection:${collection.owner.handle}:${collection.slug}`,
    },
    CACHE_UNDATED,
  );
}
