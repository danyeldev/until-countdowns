# Request cost investigation — 21 September 2026

## What was observed

The supplied seven-day screenshots measure different things: Supabase shows
3,172,524 service requests (3,086,991 at its API gateway), PostHog shows 169 visitors
and 381 page views, and Search Console shows 43 organic-search clicks. Database
calls, scheduled ingestion, page assets, API calls, server rendering and crawler
requests cannot be compared one-to-one with human page views or search clicks.
The Supabase chart also includes the earlier large spikes before the latest fixes.

Production was on commit `6821f4e` during this investigation. Available Vercel
runtime-log counts over 24 hours included 8,158 entries for event routes and 1,254
for `/api/hype`. These are log-entry counts, not unique visitors or billing totals.
A bounded 200-record recent sample contained 46 `stale_tag` and 18 `stale_time`
records, alongside cold/collapsed requests; it is not a statistically representative
traffic breakdown. Aggregate metrics were unavailable without Observability Plus.

The dashboard request for `/event/new-year-s-eve-2038-12-31` at 14:00:55 UTC
identified itself as `ShapBot/0.1.0`. Its cache details showed a 15-minute lifetime
and the `catalog-lists` tag. [Parallel documents ShapBot as its search-index
crawler](https://parallel.ai/parallel-web-systems-bots). This identifies one observed
source, not its share of all traffic, and the user-agent alone is not identity
verification. No additional crawler blocks or firewall changes were applied.

## Fixed amplification

- Every changed ingestion slice could invalidate `catalog-lists`, a tag attached
  to event details and dependencies as well as hubs. Scheduled ingestion now
  relies on timed refresh; finalization invalidates recomputed statistics only.
  Event details, aliases, citations, related events and occurrence lists use
  detail tags, so refreshing a hub no longer evicts unrelated event pages.
- Related-event and occurrence caches silently reduced event HTML's declared
  one-hour refresh interval to 15 minutes. Those dependencies now use one hour.
- Catalog links automatically prefetched linked pages just because links became
  visible. The shared Link now defaults to `prefetch={false}`, retaining actual
  `href` anchors, client navigation and explicit prefetch opt-in.
- Public metadata, social images, feeds and API handlers went through session
  middleware despite not requiring locale routing. They now bypass the matcher;
  API handlers continue to authorize their own private operations.
- Public hype totals used cookie-aware database reads and `private, no-store`
  responses. GET now reads only anonymous public totals, caches per event for
  60 seconds and permits CDN caching. Writes/errors stay private; successful
  writes expire only the changed event's data. Client reads are deduplicated.
- The auth-only `/create` page was removed from the sitemap.

## Freshness and SEO

Hub/series lists generally refresh after 15 minutes; individual event details
and related occurrences after one hour. These are request-driven stale-while-
revalidate intervals, not hard delivery deadlines: the next request can see the
previous result while regeneration runs. Existing enrichment invalidates affected
event/series tags. Urgent manual corrections can use the authenticated
`/api/revalidate?slug=...`; a default ops refresh includes detail, list and stats
tags. Countdown ticking remains client-side and does not wait for regeneration.

Canonical HTML, structured data, robots policy, series/event indexability rules,
locale routing, and sitemap discovery remain intact. No new CAPTCHA, user-agent
block, crawl delay or rate limit was added. Existing search/locale crawl policies
are unchanged. Search crawlers need access to rendered content and its resources;
see [Google's JavaScript SEO guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

## Verification and rollout checks

The production build's prerender manifest reports `initialRevalidateSeconds: 3600`
for sampled event pages and `900` for sampled series pages. Browser verification
of the built home page found 128 anchors and zero speculative `_rsc` requests
before navigation; clicking Categories rendered the category directory. Regression
tests cover cache isolation/targeted invalidation, Google/Bing proxy access, matcher
scope, sitemap entries, anonymous hype reads and concurrent read/write races.

After rollout, compare equivalent 24-hour production windows: event function
invocations, `stale_tag` regeneration, ISR writes, middleware invocations on the
excluded routes, and Supabase API requests. Verify public hype responses become
CDN HITs and crawler-facing canonical pages/sitemaps continue returning success.
Track Search Console crawl errors and indexing separately from search clicks.
Initial cold requests after deployment are expected. Savings require live billing
and traffic measurements; this change does not eliminate the cost of serving
legitimate crawlers or promise request totals matching analytics page views.
