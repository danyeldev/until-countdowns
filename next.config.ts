import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { PREFIXED_LOCALE_PATTERN } from "./src/i18n/locales";

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

function r2ImageHost(): string | null {
  const url = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!url) return "images.until.day";
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

const r2Host = r2ImageHost();

/** Fonts read at runtime by the `/og/*` handlers (src/lib/og.tsx); traced explicitly so Vercel ships them. */
const OG_FONT_FILES = [
  "node_modules/@fontsource/geist/files/geist-latin-600-normal.woff",
  "node_modules/@fontsource/geist-mono/files/geist-mono-latin-500-normal.woff",
];

const nextConfig: NextConfig = {
  // Bound database fan-out when optional catalog warming is enabled.
  experimental: {
    staticGenerationMaxConcurrency: 2,
    staticGenerationMinPagesPerWorker: 100,
  },
  images: {
    remotePatterns: [
      ...(r2Host
        ? [
            {
              protocol: "https" as const,
              hostname: r2Host,
              pathname: "/**",
            },
          ]
        : []),
      {
        protocol: "https",
        hostname: supabaseImageHost(),
        pathname: "/storage/v1/object/public/event-images/**",
      },
      {
        protocol: "https",
        hostname: supabaseImageHost(),
        pathname: "/storage/v1/object/public/collection-images/**",
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
    // stripping it would need extra proxy rewrite logic beyond the auth session refresh.
    const page = "(?<n>[2-9]|[1-9][0-9]{1,3})";
    const locale = `:locale(${PREFIXED_LOCALE_PATTERN})`;
    return [
      // The old category filter on the home page now has its own hub; free-text searches keep
      // using the home page, so the rule only fires when there is no `q`.
      {
        source: "/",
        has: [{ type: "query", key: "category", value: "(?<c>[a-z]+)" }],
        missing: [{ type: "query", key: "q" }],
        destination: "/category/:c",
        permanent: true,
      },
      // Hub pagination moved from `?page=n` into the path (page 1 stays ISR).
      {
        source: "/category/:c",
        has: [{ type: "query", key: "page", value: page }],
        destination: "/category/:c/page/:n",
        permanent: true,
      },
      {
        source: "/tag/:t",
        has: [{ type: "query", key: "page", value: page }],
        destination: "/tag/:t/page/:n",
        permanent: true,
      },
      {
        source: `/${locale}`,
        has: [{ type: "query", key: "category", value: "(?<c>[a-z]+)" }],
        missing: [{ type: "query", key: "q" }],
        destination: `/${locale}/category/:c`,
        permanent: true,
      },
      {
        source: `/${locale}/category/:c`,
        has: [{ type: "query", key: "page", value: page }],
        destination: `/${locale}/category/:c/page/:n`,
        permanent: true,
      },
      {
        source: `/${locale}/tag/:t`,
        has: [{ type: "query", key: "page", value: page }],
        destination: `/${locale}/tag/:t/page/:n`,
        permanent: true,
      },
      // (`?page=1` is left alone: a redirect to the bare path would carry the query along and loop.)
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
