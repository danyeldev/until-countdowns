import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/auth/session";
import { isBlockedCrawl } from "@/lib/request/crawlers";

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

/**
 * robots.txt already disallows the path; a crawler that asks anyway is answered here, before the
 * page function and the ISR write it would otherwise cost. 403 rather than 404 because the page
 * does exist — for people. The log line names the crawler, so one that keeps coming back can be
 * given a firewall rule.
 */
function refuseCrawler(request: NextRequest): NextResponse {
  console.log(
    JSON.stringify({
      kind: "crawler_refused",
      path: request.nextUrl.pathname,
      ua: (request.headers.get("user-agent") ?? "").slice(0, 200),
      ip: request.headers.get("x-real-ip"),
    }),
  );
  return new NextResponse("Not served to crawlers. See /robots.txt.", {
    status: 403,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (skipIntl(pathname)) {
    return updateSession(request);
  }
  const searchRedirect = catalogSearchRedirect(request);
  if (isBlockedCrawl(request.headers, pathname, searchRedirect !== null)) {
    return refuseCrawler(request);
  }
  if (searchRedirect) return updateSession(request, searchRedirect);
  return updateSession(request, handleI18nRouting(request));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
