# Search and sharing

`NEXT_PUBLIC_SITE_URL` is the canonical production origin. Set it before deploying to a new domain: canonical URLs, social cards, structured data and sitemaps all use it. `GOOGLE_SITE_VERIFICATION` optionally adds Search Console verification through the root layout.

## Indexing

- Submit `/sitemap-index.xml` in Search Console. It links to the stable `hubs`, `series` and event-year sitemap shards.
- Search/filter views, personal countdown links, thin hubs, occurrence variants and pagination keep their existing `noindex` policies. English HTML is crawlable so bots can actually read `noindex`; `/api/` is blocked in robots.txt.
- Only the unprefixed English URL is indexable. The 26 locale-prefixed copies (`/es/…`, `/zh-hant/…`) translate the chrome around the same English catalog, so they carry the English canonical, emit no hreflang alternates (neither `<link>` tags nor next-intl's `Link` header) and are disallowed in robots.txt together with `/search`. The proxy answers self-identified crawlers on those paths with a 403 before any render (`src/lib/request/crawlers.ts`) and logs a `crawler_refused` line naming the user agent. Before this, crawlers fetched the catalog 27 times over — ~9 event renders a second, every one a cache miss — for pages nobody read. Reversing the decision means restoring `languageAlternates` in `src/lib/seo.ts`, `alternateLinks` in `src/i18n/routing.ts`, and dropping the locale prefixes from `crawlTrapDisallows()`.
- Hubs include the countdown creator. Empty categories and countries stay out of the sitemap. Series require an upcoming occurrence; event shards retain the database's explicit eligibility gate and exclude series members.
- `lastModified` uses actual catalog update times. The build/deploy timestamp is not substituted for content freshness.
- The existing catalog shards split large years into half-years. If either half grows beyond 50,000 eligible URLs, extend catalog sharding before increasing that ceiling; 50,000 is the sitemap protocol limit.

## Accurate metadata

Event titles and descriptions use the event's IANA timezone when available. All-day dates remain literal calendar dates. Month/quarter/year/decade estimates never become exact-day countdown claims. Cancelled and postponed events advertise their status rather than a running countdown; tentative dates are described as provisional.

Each public page gets a canonical URL, a 1200 × 630 Open Graph image, a Twitter large card with alternative text, and permission for large Google image previews. Personal/thin pages replace the index directive with `noindex,follow`.

Structured `Event` data requires the ingestion eligibility flag, a precise valid date and a meaningful venue/address. Postponed stays `EventPostponed` even if the event changed dates previously. Attended series share the same event eligibility rules; non-attendable recurring dates are `CollectionPage` objects. External summaries are not copied into structured descriptions. The website and organization have stable entity IDs and the organization uses a square branded logo.

## Social cards and icons

The shared renderer uses locally bundled fonts, a graphite/violet palette, and a deterministic decorative background. Eligible licensed photos retain their attribution; image fetch/render failures fall back to the branded background. Photo cards stay below the existing 600 KB response budget.

Dated image URLs rotate daily. They still revalidate hourly because a provider may correct or cancel an event during the day; their content is not immutable. Exact event cards use the event's local calendar date for the printed date and dated day count.

`manifest.webmanifest`, the SVG/ICO favicon, Apple touch icon and 192/512 px app icons share the same mark. The manifest adds browser installation metadata and shortcuts; it does not promise offline support.

## Verification

Run `npx vitest run tests/seo.test.ts tests/jsonld.test.ts tests/og.test.ts tests/catalog-day.test.ts`, then the project build. Check an event, a coarse date, a cancellation and the home page with a social crawler user agent. Inspect the canonical, robots, OG/Twitter tags and generated PNGs. After deployment, use Search Console URL Inspection and Google's Rich Results Test; tests cannot guarantee indexing or rich-result eligibility.

References: [Google's noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing), [Google event structured data](https://developers.google.com/search/docs/appearance/structured-data/event), and the installed Next.js metadata, sitemap, manifest, icon and ImageResponse documentation in `node_modules/next/dist/docs/`.
