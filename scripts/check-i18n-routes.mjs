/**
 * End-to-end check of the localized URL space against a running server.
 *
 * The routing rules in `src/lib/i18n/routing.ts` are unit-tested as data, but what they *do* is
 * decided by Next's router, not by us: whether `/about/:rest*` also matches `/about`, whether a
 * redirect and a rewrite can chase each other, whether `/foobar` is a 404 or a locale. That is only
 * answerable by asking a real server, so:
 *
 *   npm run build && npm run start &
 *   node scripts/check-i18n-routes.mjs            # or BASE=https://… for a deployment
 *
 * It runs with an empty catalog too (no Supabase env): every path checked here is either a routing
 * decision or a page that does not need a row to exist.
 */
const BASE = (process.env.BASE || "http://localhost:3000").replace(/\/$/, "");

/** @type {{ path: string, expect: number | number[], to?: string, contains?: string[], why: string }[]} */
const CASES = [
  // English is unprefixed, and still is after the rewrite.
  // React serialises the attribute as `hrefLang`; HTML attribute names are case-insensitive, so the
  // needle is matched that way rather than "fixed" in the markup.
  { path: "/", expect: 200, contains: ['<html lang="en"', 'hrefLang="es"', 'rel="canonical"'], why: "home stays at /" },
  { path: "/about", expect: 200, contains: ['<html lang="en"'], why: "English section, rewritten to /en/about" },
  { path: "/create", expect: 200, why: "English section with no sub-path" },
  { path: "/category", expect: 200, why: "hub index" },
  { path: "/country", expect: 200, why: "hub index" },
  { path: "/days-until", expect: 200, why: "hub index" },
  { path: "/attributions", expect: 200, why: "prose page" },

  // …and /en never becomes a second URL for it.
  { path: "/en", expect: 308, to: "/", why: "the prefixed default locale folds onto the bare path" },
  { path: "/en/about", expect: 308, to: "/about", why: "…including its sections" },

  // Prefixed locales, in their own spelling.
  { path: "/es", expect: 200, contains: ['<html lang="es"'], why: "locale home" },
  { path: "/es/acerca-de", expect: 200, contains: ['<html lang="es"'], why: "translated section, rewritten to /es/about" },
  { path: "/es/categoria", expect: 200, why: "translated hub index" },
  { path: "/de/kategorie", expect: 200, why: "another locale's spelling" },
  { path: "/tr/hakkinda", expect: 200, why: "another locale's spelling" },
  { path: "/ja/about", expect: 200, contains: ['<html lang="ja"'], why: "a locale that keeps the English section" },
  { path: "/ar/about", expect: 200, contains: ['<html lang="ar"', 'dir="rtl"'], why: "RTL" },

  // …and the English spelling under a locale never becomes a second URL for it.
  { path: "/es/about", expect: 308, to: "/es/acerca-de", why: "English spelling folds onto the locale's own" },
  { path: "/es/days-until", expect: 308, to: "/es/cuantos-dias-faltan", why: "the money section, folded" },

  // The pre-i18n query redirects, in every spelling.
  { path: "/?category=sports", expect: 308, to: "/category/sports", why: "the old category filter" },
  { path: "/category/sports?page=2", expect: 308, to: "/category/sports/page/2", why: "hub pagination moved into the path" },
  { path: "/es/categoria/sports?page=2", expect: 308, to: "/es/categoria/sports/page/2", why: "…in Spanish" },

  // Nothing outside the nine sections is rewritten.
  { path: "/robots.txt", expect: 200, contains: ["/es/evento/mine-", "Sitemap:"], why: "robots is not a section" },
  { path: "/sitemap-index.xml", expect: 200, contains: ["<sitemapindex"], why: "sitemap index is not a section" },
  { path: "/og/default", expect: 200, why: "OG cards are not a section" },
  // 503 when the database is unreachable, which is the point of a health check — what matters here
  // is that the request reached the route rather than being rewritten into the locale tree.
  { path: "/api/health", expect: [200, 503], why: "the API is not a section" },
  { path: "/file.svg", expect: 200, why: "public/ is not a section" },

  // Unknown paths are 404s, not locales.
  { path: "/foobar", expect: 404, why: "an unknown first segment is not a locale" },
  { path: "/foo/bar", expect: 404, why: "the catch-all takes the deeper misses" },
  { path: "/es/nonsense", expect: 404, why: "an unknown section under a real locale" },
  { path: "/es/nonsense/deeper", expect: 404, why: "…at any depth" },
];

let failed = 0;

for (const testCase of CASES) {
  const url = `${BASE}${testCase.path}`;
  let res;
  try {
    res = await fetch(url, { redirect: "manual" });
  } catch (err) {
    console.error(`FAIL ${testCase.path} — ${err instanceof Error ? err.message : String(err)}`);
    failed++;
    continue;
  }

  const problems = [];
  const wanted = Array.isArray(testCase.expect) ? testCase.expect : [testCase.expect];
  if (!wanted.includes(res.status)) problems.push(`status ${res.status}, wanted ${wanted.join(" or ")}`);
  if (testCase.to) {
    const location = res.headers.get("location") || "";
    const path = location.startsWith("http") ? new URL(location).pathname + new URL(location).search : location;
    if (path.split("?")[0] !== testCase.to) problems.push(`redirects to ${path || "(nothing)"}, wanted ${testCase.to}`);
  }
  if (testCase.contains && res.status === 200) {
    const body = await res.text();
    for (const needle of testCase.contains) if (!body.includes(needle)) problems.push(`body lacks ${JSON.stringify(needle)}`);
  }

  if (problems.length) {
    failed++;
    console.error(`FAIL ${testCase.path}  (${testCase.why})\n      ${problems.join("\n      ")}`);
  } else {
    console.log(`ok   ${testCase.path.padEnd(34)} ${testCase.why}`);
  }
}

console.log(`\n${CASES.length - failed}/${CASES.length} passed`);
process.exit(failed ? 1 : 0);
