import type { NextConfig } from "next";
import { hubQueryRedirects, localeRedirects, localeRewrites } from "./src/lib/i18n/routing";

/** Host of the Supabase project serving re-hosted event images (derived at config time). */
function supabaseImageHost(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url) {
    try {
      const host = new URL(url).hostname;
      if (host) return host;
    } catch {
      /* fall through */
    }
  }
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (ref && /^[a-z0-9]+$/i.test(ref)) return `${ref}.supabase.co`;
  return "*.supabase.co";
}

/** Fonts read at runtime by the `/og/*` handlers (src/lib/og.tsx); traced explicitly so Vercel ships them. */
const OG_FONT_FILES = [
  "node_modules/@fontsource/fraunces/files/fraunces-latin-600-normal.woff",
  "node_modules/@fontsource/geist-mono/files/geist-mono-latin-500-normal.woff",
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseImageHost(),
        pathname: "/storage/v1/object/public/event-images/**",
      },
    ],
    // Re-hosted derivatives are content-addressed (sha256 paths): cache them for 31 days.
    minimumCacheTTL: 2678400,
  },
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/og/**": OG_FONT_FILES,
    "/og/*": OG_FONT_FILES,
  },
  async redirects() {
    // Next passes the incoming query through to every redirect destination, so these land on
    // e.g. `/category/sports?category=sports`. The hubs are static (they never read
    // `searchParams`), the stray query is ignored and the page's canonical is the clean path;
    // stripping it would need a `proxy.ts`, which is deliberately not part of this app yet.
    //
    // `hubQueryRedirects()` is the pre-i18n set — the category filter that moved to its own hub,
    // and hub pagination that moved from `?page=n` into the path (page 1 stays ISR) — repeated in
    // every locale's spelling. (`?page=1` is left alone: a redirect to the bare path would carry
    // the query along and loop.) It comes first because its rules are the narrower ones.
    // `localeRedirects()` then folds `/en/…` back onto the bare path and the English spelling of a
    // section back onto the locale's own, so no page has two live URLs.
    return [...hubQueryRedirects(), ...localeRedirects()];
  },
  async rewrites() {
    // `beforeFiles`, so `/about` reaches `/[locale]/about` without `about` ever being matched as a
    // locale. Nothing outside the nine sections is listed, which leaves `/api`, `/og`, `/embed`,
    // `/robots.txt`, `/sitemap-index.xml` and `public/` untouched.
    return { beforeFiles: localeRewrites(), afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
