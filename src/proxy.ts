import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/auth/session";

const handleI18nRouting = createMiddleware(routing);

function skipIntl(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/og/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/embed/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/sitemap") ||
    pathname === "/robots.txt" ||
    pathname.startsWith("/manifest")
  );
}

export async function proxy(request: NextRequest) {
  if (skipIntl(request.nextUrl.pathname)) {
    return updateSession(request);
  }
  return updateSession(request, handleI18nRouting(request));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
