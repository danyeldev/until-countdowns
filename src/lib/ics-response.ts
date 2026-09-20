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
  disposition: "attachment" | "inline" | false = "attachment",
): NextResponse {
  const headers = new Headers({
    "Content-Type": "text/calendar; charset=utf-8",
    "Cache-Control": cacheControl,
    "X-Robots-Tag": "noindex",
  });
  if (disposition) {
    headers.set("Content-Disposition", `${disposition}; filename="${filename}"`);
  }
  return new NextResponse(content, { headers });
}
