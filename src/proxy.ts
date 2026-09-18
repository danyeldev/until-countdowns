import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/auth/session";

const handleI18nRouting = createMiddleware(routing);

const SEARCH_KEYS = ["q", "sort", "category", "page"] as const;

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

function catalogSearchRedirect(request: NextRequest): NextResponse | null {
  const url = request.nextUrl.clone();
  if (!SEARCH_KEYS.some((key) => url.searchParams.has(key))) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const maybeLocale = parts[0];
  const isLocale = (routing.locales as readonly string[]).includes(maybeLocale);
  const rest = `/${(isLocale ? parts.slice(1) : parts).join("/")}`;
  if (rest !== "/" && rest !== "") return null;
  url.pathname = `${isLocale ? `/${maybeLocale}` : ""}/search`;
  return NextResponse.redirect(url, 308);
}

export async function proxy(request: NextRequest) {
  if (skipIntl(request.nextUrl.pathname)) {
    return updateSession(request);
  }
  const searchRedirect = catalogSearchRedirect(request);
  if (searchRedirect) return updateSession(request, searchRedirect);
  return updateSession(request, handleI18nRouting(request));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
