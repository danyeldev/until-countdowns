/**
 * The embeddable countdown: one document serving both an `<iframe>` on someone's own site and an
 * OBS / Streamlabs browser source, with its whole appearance carried in the query string.
 *
 * A route handler rather than a page, because every page in this app is wrapped by the one root
 * layout — header, footer, gradient body — and an embed has to be a bare document that can be
 * fully transparent. Building the HTML by hand is also what keeps it a single request with no
 * framework runtime inside a stranger's page.
 */
import { NextResponse, type NextRequest } from "next/server";
import { buildEmbedDocument, buildEmbedNotFoundDocument } from "@/lib/embed/html";
import { resolveEmbedSubject } from "@/lib/embed/resolve";
import { parseEmbedTheme } from "@/lib/embed/theme";
import { siteUrl } from "@/lib/seo";

/** The response only depends on slug + query — the clock itself is computed in the browser. */
const CACHE_HIT = "public, s-maxage=3600, stale-while-revalidate=86400";
/** A miss is often a slug that is about to exist (a series being linked up), so keep it brief. */
const CACHE_MISS = "public, s-maxage=300";

function headers(cache: string): Record<string, string> {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": cache,
    // The one route on the site that is *meant* to be framed anywhere — an explicit, permissive
    // `frame-ancestors` so a host page (or a CMS that checks before pasting) knows it is intended.
    "Content-Security-Policy": "frame-ancestors *",
    // The widget is a fragment of the countdown page it links back to — that page is the one that
    // belongs in the index.
    "X-Robots-Tag": "noindex",
  };
}

export async function GET(req: NextRequest, ctx: RouteContext<"/embed/[slug]">) {
  const { slug } = await ctx.params;
  const theme = parseEmbedTheme(req.nextUrl.searchParams);
  const subject = await resolveEmbedSubject(slug);

  if (!subject) {
    return new NextResponse(buildEmbedNotFoundDocument(theme, siteUrl()), {
      status: 404,
      headers: headers(CACHE_MISS),
    });
  }

  return new NextResponse(buildEmbedDocument(subject, theme), { headers: headers(CACHE_HIT) });
}
