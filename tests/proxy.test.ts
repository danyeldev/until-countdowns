import { describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
// Next 16.3.4 still exports the old helper name despite the proxy rename in its docs.
import { unstable_doesMiddlewareMatch as unstable_doesProxyMatch } from "next/experimental/testing/server";

vi.mock("@/lib/auth/session", () => ({
  updateSession: vi.fn(async (_request: NextRequest, response = NextResponse.next()) => response),
}));

import { config, proxy } from "@/proxy";

const GOOGLEBOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

describe("proxy request scope", () => {
  it("avoids middleware invocations for metadata, public assets and route handlers", () => {
    for (const url of [
      "/robots.txt", "/sitemap.xml", "/sitemap-index.xml", "/sitemap/hubs.xml",
      "/sitemap/events-2026.xml", "/manifest.webmanifest", "/og/event/new-year/2027-01-01",
      "/ics/featured/holidays", "/embed/new-year", "/api/hype?eventKey=new-year",
      "/api/cron/dispatch", "/api/collections/images", "/auth-font.woff2",
      "/_next/static/chunks/app.js", "/_next/image?url=test", "/favicon.ico",
    ]) {
      expect(unstable_doesProxyMatch({ config, nextConfig: {}, url }), url).toBe(false);
    }
  });

  it("retains locale routing, auth session refresh and existing crawl-trap protection", () => {
    for (const url of [
      "/", "/event/new-year", "/days-until/christmas", "/category/holidays", "/country/ar",
      "/es/event/new-year", "/search?q=christmas", "/login", "/saved", "/create",
      "/collections/new", "/auth/callback?code=test", "/apiary", "/ogden", "/sitemapfan",
    ]) {
      expect(unstable_doesProxyMatch({ config, nextConfig: {}, url }), url).toBe(true);
    }
  });
});

describe("search crawler access", () => {
  it("serves canonical catalog HTML through the English rewrite for Google and Bing", async () => {
    for (const ua of [GOOGLEBOT, "Mozilla/5.0 (compatible; bingbot/2.0)"]) {
      for (const path of ["/", "/event/new-year", "/days-until/christmas", "/category/holidays"]) {
        const response = await proxy(new NextRequest(`https://until.day${path}`, {
          headers: { "user-agent": ua },
        }));
        expect(response.status).toBe(200);
        expect(new URL(response.headers.get("x-middleware-rewrite")!).pathname).toBe(`/en${path === "/" ? "" : path}`);
        expect(response.headers.get("x-robots-tag")).toBeNull();
        expect(response.headers.get("location")).toBeNull();
      }
    }
  });
});
