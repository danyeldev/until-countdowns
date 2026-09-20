import { NextResponse } from "next/server";

export function icsUnavailable(): NextResponse {
  return new NextResponse("Calendar temporarily unavailable. Please try again.", {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  });
}

export function icsNeedsDate(): NextResponse {
  return new NextResponse("A confirmed date is required for calendar export.", {
    status: 422,
    headers: { "Cache-Control": "no-store" },
  });
}

export function icsNotFound(): NextResponse {
  return new NextResponse("Not found", { status: 404 });
}

export function icsFileResponse(
  content: string,
  filename: string,
  cacheControl: string,
): NextResponse {
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": cacheControl,
    },
  });
}
