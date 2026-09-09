import { NextRequest, NextResponse } from "next/server";
import { icsContent } from "@/lib/calendar";
import { getEvent } from "@/lib/catalog";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const event = getEvent(slug);
  if (!event) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(icsContent(event), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
    },
  });
}
