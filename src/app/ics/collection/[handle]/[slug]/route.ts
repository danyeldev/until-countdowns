import { NextRequest } from "next/server";
import { publicCollectionIcsResponse } from "@/lib/ics-collection-feed";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/ics/collection/[handle]/[slug]">,
) {
  const { handle, slug } = await ctx.params;
  return publicCollectionIcsResponse(handle, slug);
}
