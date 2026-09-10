import { NextRequest, NextResponse } from "next/server";
import { icsContent } from "@/lib/calendar";
import { getEvent, resolveSlugAlias } from "@/lib/catalog";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/ics/[slug]">) {
  const { slug } = await ctx.params;
  let event = await getEvent(slug);
  if (!event) {
    const current = await resolveSlugAlias(slug);
    if (current) event = await getEvent(current);
  }
  if (!event) return new NextResponse("Not found", { status: 404 });

  // Calendar clients choke on raw CR/LF inside a property; normalise before the ICS escaping.
  const sanitized = {
    ...event,
    title: event.title.replace(/[\r\n]+/g, " ").trim(),
    description: event.description.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim(),
  };

  return new NextResponse(icsContent(sanitized), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
