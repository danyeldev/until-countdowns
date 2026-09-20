import { NextRequest } from "next/server";
import { featuredCollectionIcsResponse } from "@/lib/ics-collection-feed";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/ics/featured/[slug]">,
) {
  const { slug } = await ctx.params;
  return featuredCollectionIcsResponse(slug);
}
