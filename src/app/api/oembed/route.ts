/**
 * oEmbed provider, so a bare Until link pasted into WordPress, Ghost or Notion unfurls as the live
 * widget rather than a flat URL. `oembedDiscoveryUrl()` in src/lib/seo.ts is what points editors
 * here from the countdown pages themselves.
 *
 * Only our own origin is described: an endpoint that answers for any URL lends the "Until"
 * provider name to somebody else's content. An `/embed/` URL round-trips with its theme intact, so
 * a widget someone customised in the studio and then pasted stays the widget they built.
 */
import { NextResponse, type NextRequest } from "next/server";
import { resolveEmbedSubject } from "@/lib/embed/resolve";
import { parsePath } from "@/lib/i18n/paths";
import {
  DEFAULT_EMBED_THEME,
  EMBED_BOX,
  embedIframeSnippet,
  embedUrl,
  parseEmbedTheme,
  type EmbedTheme,
} from "@/lib/embed/theme";
import { SITE_NAME, siteUrl } from "@/lib/seo";

/** An oEmbed consumer fetches this cross-origin, from its own server or its editor. */
const HEADERS: Record<string, string> = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  "Access-Control-Allow-Origin": "*",
};

/** The three shapes of Until URL somebody might paste. */
const EMBEDDABLE = /^\/(?:event|days-until|embed)\/([^/]+)\/?$/;

/** Below this the digits are unreadable, so an absurd `maxwidth` is floored rather than honoured. */
const MIN_BOX = 120;

function target(raw: string | null, origin: string): { slug: string; theme: EmbedTheme } | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  // A pasted URL can be in any of the fifteen spellings (`/es/cuantos-dias-faltan/navidad`);
  // `parsePath()` folds it back to the app-internal one before the shape is matched.
  const { path } = parsePath(url.pathname);
  const match = EMBEDDABLE.exec(path);
  if (!match) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(match[1]);
  } catch {
    // A malformed percent-escape is not a slug we have.
    return null;
  }
  const embed = path.startsWith("/embed/");
  return { slug, theme: embed ? parseEmbedTheme(url.searchParams) : DEFAULT_EMBED_THEME };
}

/** `maxwidth`/`maxheight` are an upper bound, never a request to grow: the default box shrinks to fit. */
function fit(raw: string | null, box: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return box;
  return Math.max(MIN_BOX, Math.min(box, Math.round(n)));
}

function miss(message: string, status: number) {
  return new NextResponse(message, { status, headers: { ...HEADERS, "Content-Type": "text/plain; charset=utf-8" } });
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const format = params.get("format")?.trim().toLowerCase() || "json";
  if (format !== "json") return miss("Only the JSON format is supported.", 501);

  const origin = siteUrl();
  const asked = target(params.get("url"), origin);
  if (!asked) return miss("Not found", 404);

  const subject = await resolveEmbedSubject(asked.slug);
  if (!subject) return miss("Not found", 404);

  const width = fit(params.get("maxwidth"), EMBED_BOX.width);
  const height = fit(params.get("maxheight"), EMBED_BOX.height);

  return NextResponse.json(
    {
      version: "1.0",
      type: "rich",
      provider_name: SITE_NAME,
      provider_url: origin,
      title: subject.title,
      html: embedIframeSnippet(embedUrl(origin, subject.slug, asked.theme), subject.title, { width, height }),
      width,
      height,
      cache_age: "3600",
    },
    { headers: HEADERS },
  );
}
