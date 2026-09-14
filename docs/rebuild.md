# Rebuild and rollout

Work starts from main commit `7fa5ae8` and lives on `codex/rebuild-until`.

## Experience

- Rebuilt discovery with a prominent search, featured countdown, nearby events, category browsing, recurring dates and country/month links.
- Recurring search results show the next matching occurrence, with expandable future dates instead of repeated yearly cards. Explicit searches such as `Halloween 2030` remain supported. See [search behavior](search-behavior.md).
- Replaced the visual system with graphite/violet surfaces, Geist typography, original abstract artwork, persistent navigation, keyboard search, a real month grid, year timelines, and a redesigned personal space. The [September 2026 design research](design-research.md) records dated sources, observed interfaces, decisions, and limits.
- Countdown first on event pages, predictable compact cards, event-local display dates and clear status for cancelled, postponed, retired and completed events. One shared timer pauses while the document is hidden.
- Calendar links and exports require a real date; approximate dates and cancelled/postponed events cannot become invented calendar appointments. Calendar API outages return a retryable response.
- A real `/saved` collection for catalog and personal dates. Existing immutable catalog IDs still resolve after an event changes its slug; cached copies remain useful when the catalog is unavailable.
- Strict dates, bounded Unicode share URLs, selectable fallback links when copying fails, and explicit storage errors. Personal content stays in the browser; shared URLs include the title, date, category and note.

## Data and operations

F1Calendar adds free Formula 1 race/sprint dates. TVMaze failures no longer become empty successful imports. Computed astronomy now owns equinox, solstice and meteor-shower series instead of fixed calendar guesses. See [source research](data-sources.md), including access terms and alternatives evaluated.

The dispatcher chooses due sources from their cadence and saved state. Source leases, retained checkpoints, bounded retries, queue previews and returned deferred jobs address incomplete-pass and dry-run failures. See [operations](operations.md) for the four exact schedules, configuration and recovery.

## SEO and build behavior

Canonical/Open Graph/Twitter metadata is consistent, social previews match the visual identity, event dates use their time zone, and approximate dates are not published as exact Event schema. Icons, an installable manifest, sitemap coverage and crawl directives are included. See [SEO](seo.md).

The previous build attempted nearly 900 prerenders and timed out against the database. Catalog pages now render on first request and cache with ISR. `CATALOG_PRERENDER_LIMIT=0` is the default; a small positive value opts into bounded warming per route family. The first request to an uncached page does database work; subsequent requests use the cached page. Strict detail readers preserve database failures as retryable errors rather than caching a false 404.

## Validation

The verification suite covers ingestion deadlines/cursors, scheduling, queue claims, free-source mapping, time-zone/date boundaries, schema and metadata, storage/share payloads, bookmark lookup, calendar exports and embed rendering. `npm run check` runs lint, generated route types/TypeScript and Vitest.

`npm run test:sql` creates a disposable PostgreSQL 17 container with no host ports, mounts or remote credentials; it applies catalog migrations and runs actual search/recurrence/lifecycle/permission regressions, then removes the container.

Browser verification includes desktop and 390px mobile layouts, navigation and search, category/detail pages, personal creation and saving, Unicode shares, embedded countdown preview, saved collection/legacy bookmarks, corrupt/blocked storage, sharing cancellation and clipboard failure. Production checks cover the compiled app, catalog API, cron authentication, robots, manifest, sitemap and generated OG images.

After the UI rebuild, final local lint, generated route types/TypeScript, 909 tests across 58 suites, and the production build pass. The earlier data verification also passed 15 catalog migrations with SQL regression assertions. The search fix also passes independently against the current deployed core schema. Axe reported no violations on home, creator, saved collection and catalog detail pages; overlapping decorative layers still require manual contrast assessment, which was also performed.

The GitHub Actions workflow runs checks, SQL regressions and the build on pull requests and main pushes, with ingestion disabled and no production credentials. It has been added locally; it has not run on GitHub yet.

## Production rollout

The recurring-search fix (`20260914220341_search_next_occurrences.sql`) was applied to the connected `until` database on September 14, 2026. It changes the search function and upcoming helper only; no event records were deleted or merged. The application changes remain local and the three earlier migrations below remain pending.

1. Review/apply the pending migrations in their generated order, using the normal Supabase migration workflow:
   - `20260914211022_f1calendar_source.sql`: register source/attribution.
   - `20260914212035_upcoming_catalog.sql`: consistent upcoming selection, counts and lifecycle. It leaves the newer search function intact.
   - `20260914213148_astronomy_series_correction.sql`: repair astronomy ownership, duplicate records and series links.
2. Configure the production origin with `NEXT_PUBLIC_SITE_URL`, public Supabase URL/publishable key, server-only secret, `CRON_SECRET`, and a meaningful `INGEST_USER_AGENT`. `.env.example` defaults ingestion off for local development.
3. Deploy the application on a Vercel plan that supports subdaily cron schedules, then enable ingestion with `INGEST_ENABLED=true`. Keep catalog prerendering at 0 unless build-time warming is needed.
4. Refresh computed astronomy and curated sources, let F1Calendar complete its first pass, finalize and revalidate the catalog. The operations guide describes the authenticated routes and recovery options.
5. Check `/api/cron/status`, sample the actual event/series pages and social previews, and submit `/sitemap-index.xml` for the production domain.

The SQL migrations preserve existing API signatures and do not require a new public-view column. Original event URLs remain available or redirect through aliases. Search uses the applied recurrence fix; the other catalog operations continue to use their current SQL/data until the pending migrations and refreshes are run.
