/**
 * The rewrites and redirects that connect the public, localized URL space to the app tree.
 *
 * Every page lives under `src/app/[locale]/<english-section>/…`. Two things have to happen for the
 * URLs people and crawlers see:
 *
 * 1. **English is unprefixed.** `/days-until/christmas` is rewritten to `/en/days-until/christmas`
 *    — internally, so the address bar, the canonical and every backlink keep the path the site has
 *    always had. `/en/…` itself redirects back to the bare path so the two never both index.
 * 2. **Sections are translated.** `/es/cuantos-dias-faltan/navidad` is rewritten to
 *    `/es/days-until/navidad`, and the English spelling under a non-English locale redirects to the
 *    translated one, for the same reason.
 *
 * Both directions are generated from `SECTION_NAMES`, so a new locale or a renamed section cannot
 * leave a rule behind. `tests/i18n/routing.test.ts` walks the app tree and fails if a section ever
 * exists without a rule.
 *
 * Imported by `next.config.ts`: no React, no `server-only`, no `@/` alias.
 */
import { DEFAULT_LOCALE, PREFIXED_LOCALES } from "./config";
import { SECTIONS, sectionName } from "./paths";

export type Rewrite = { source: string; destination: string };
export type Redirect = Rewrite & {
  permanent: boolean;
  has?: { type: "query"; key: string; value?: string }[];
  missing?: { type: "query"; key: string }[];
};

/** `/x` and `/x/:rest*` both, because a trailing catch-all does not reliably match the bare path. */
function pair(source: string, destination: string): Rewrite[] {
  return [
    { source, destination },
    { source: `${source}/:rest*`, destination: `${destination}/:rest*` },
  ];
}

/**
 * `beforeFiles` rewrites: they run ahead of the filesystem, which is what lets `/about` reach the
 * `/[locale]/about` route without `about` ever being read as a locale.
 *
 * Only the nine known sections (and `/`) are listed, so `/api/…`, `/og/…`, `/embed/…`,
 * `/robots.txt`, `/sitemap-index.xml` and everything in `public/` are untouched.
 */
export function localeRewrites(): Rewrite[] {
  const out: Rewrite[] = [{ source: "/", destination: `/${DEFAULT_LOCALE}` }];
  for (const section of SECTIONS) {
    out.push(...pair(`/${section}`, `/${DEFAULT_LOCALE}/${section}`));
  }
  for (const locale of PREFIXED_LOCALES) {
    for (const section of SECTIONS) {
      const name = sectionName(locale, section);
      if (name === section) continue; // the locale keeps the English word; the file route matches already
      out.push(...pair(`/${locale}/${name}`, `/${locale}/${section}`));
    }
  }
  return out;
}

/**
 * The duplicate-killing half. Runs before the rewrites above (Next evaluates redirects first), so
 * `/en/about` becomes `/about` and `/es/days-until/x` becomes `/es/cuantos-dias-faltan/x` before
 * anything is rendered. Neither can loop: each source is a spelling the rewrites never produce.
 */
export function localeRedirects(): Redirect[] {
  const out: Redirect[] = [
    { source: `/${DEFAULT_LOCALE}`, destination: "/", permanent: true },
    { source: `/${DEFAULT_LOCALE}/:rest*`, destination: "/:rest*", permanent: true },
  ];
  for (const locale of PREFIXED_LOCALES) {
    for (const section of SECTIONS) {
      const name = sectionName(locale, section);
      if (name === section) continue;
      for (const r of pair(`/${locale}/${section}`, `/${locale}/${name}`)) {
        out.push({ ...r, permanent: true });
      }
    }
  }
  return out;
}

/**
 * The pre-i18n query redirects (`/?category=x` → the category hub, `?page=n` → the path-paginated
 * hub), repeated for every locale in that locale's spelling.
 */
export function hubQueryRedirects(): Redirect[] {
  const page = "(?<n>[2-9]|[1-9][0-9]{1,3})";
  const out: Redirect[] = [];
  for (const locale of [DEFAULT_LOCALE, ...PREFIXED_LOCALES]) {
    const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
    const category = `${prefix}/${sectionName(locale, "category")}`;
    const tag = `${prefix}/${sectionName(locale, "tag")}`;
    out.push(
      {
        source: prefix || "/",
        has: [{ type: "query", key: "category", value: "(?<c>[a-z]+)" }],
        missing: [{ type: "query", key: "q" }],
        destination: `${category}/:c`,
        permanent: true,
      },
      {
        source: `${category}/:c`,
        has: [{ type: "query", key: "page", value: page }],
        destination: `${category}/:c/page/:n`,
        permanent: true,
      },
      {
        source: `${tag}/:t`,
        has: [{ type: "query", key: "page", value: page }],
        destination: `${tag}/:t/page/:n`,
        permanent: true,
      },
    );
  }
  return out;
}
