import { NextRequest, NextResponse } from "next/server";
import { eventsByIds } from "@/lib/catalog";
import { isCatalogEventId } from "@/lib/event-id";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex",
};

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("ids") ?? "";
  if (!raw) return NextResponse.json({ items: [] }, { headers });
  const ids = [...new Set(raw.split(","))];
  if (
    raw.length > 10_049 ||
    ids.length > 50 ||
    ids.some((id) => !isCatalogEventId(id))
  ) {
    return NextResponse.json(
      { error: "Provide up to 50 valid event IDs." },
      { status: 400, headers },
    );
  }
  try {
    const items = (await eventsByIds(ids)).map((event) => {
      const result = { ...event };
      // Wikipedia summaries require attribution; the catalog's own description is sufficient here.
      delete result.summary;
      return result;
    });
    return NextResponse.json({ items }, { headers });
  } catch {
    return NextResponse.json(
      { error: "Saved events could not be refreshed. Please try again." },
      { status: 503, headers },
    );
  }
}
