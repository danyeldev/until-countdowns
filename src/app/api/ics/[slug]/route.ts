import { NextRequest, NextResponse } from "next/server";
import { canAddToCalendar, icsContent, sanitizeCalendarEvent } from "@/lib/calendar";
import { getEventStrict, resolveSlugAliasStrict } from "@/lib/catalog";
import { icsFileResponse, icsNeedsDate, icsUnavailable } from "@/lib/ics-response";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/ics/[slug]">,
) {
  const { slug } = await ctx.params;
  let event;
  try {
    event = await getEventStrict(slug);
    if (!event) {
      const current = await resolveSlugAliasStrict(slug);
      if (current) event = await getEventStrict(current);
    }
  } catch {
    return icsUnavailable();
  }
  if (!event) return new NextResponse("Not found", { status: 404 });
  if (!canAddToCalendar(event)) return icsNeedsDate();

  return icsFileResponse(
    icsContent(sanitizeCalendarEvent(event)),
    `${event.slug}.ics`,
    "public, s-maxage=3600, stale-while-revalidate=86400",
  );
}
