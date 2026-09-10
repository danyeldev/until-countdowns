# Until

A catalog of future dates — public holidays from nearly every country, scheduled events from Wikipedia and Wikidata, plus curated milestones (eclipses, World Cups, Olympics, elections). Each date is tagged, classified, and shown as a live countdown.

## What you can do

- Browse thousands of upcoming dates across 23 categories
- Filter by category (holidays, national days, sports, astronomy, space, tech, politics, …)
- Search titles, tags, and countries
- Open a full-page ticking countdown (dates without a confirmed day show "expected …" instead of a clock)
- Add any date to Google Calendar, Outlook, or download an `.ics`
- Create personal countdowns (stored in the browser, shareable via URL)
- Put any countdown on your own site as an `<iframe>`, or on a stream as an OBS browser source — colours, font, size, units and position all live in the URL

## Catalog

The catalog lives in a Supabase Postgres project. The schema is in `supabase/migrations/` (the `events_public` view and the `search_events` / `featured_upcoming` / `related_events` / … RPCs are the read contract) and the generated types in `src/lib/db/database.types.ts` (`npm run db:types`).

The app reads through `src/lib/catalog.ts` with the anonymous publishable key (RLS on), caches every read in the Next.js data cache under the `events` / `stats` tags, and degrades to an empty catalog when the database is unreachable — a build never fails because of data.

To load or refresh the catalog from the local sources (date-holidays, curated records, Wikipedia year pages, Wikidata):

```bash
cp .env.example .env.local   # fill in the Supabase URL, publishable key and secret key
npm run push                 # runs scripts/push-catalog.mjs with the secret key
```

`push` is idempotent: rows are keyed by a stable `source_key` and a content hash, so a second run reports `inserted=0, updated=0, unchanged=N`. Curated records win when sources disagree.

The app caches its reads (Next.js Data Cache, tags `events` and `stats`, 1 h each), and the push script does not invalidate them. After a push — or whenever the site shows a stale or empty catalog — call the ops route with the cron bearer:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" "$NEXT_PUBLIC_SITE_URL/api/revalidate"
# optional: ?tags=events,stats (default both) or ?slug=<event-slug> for one page
```

Locally, `unstable_cache` results also persist on disk between runs (`.next/cache/fetch-cache` for `next build`/`next start`, `.next/dev/cache/fetch-cache` for `next dev`); delete those directories when the dev server keeps showing an old catalog.

### Licence policy

Only sources whose terms allow commercial use and persistent storage are ingested (Wikidata CC0, Wikipedia and date-holidays CC BY-SA with visible attribution, NASA / public computation). Every event page shows its source and when the date was last verified. Nager.Date, TMDB, IGDB, ESPN and similar restricted feeds are deliberately not used.

## Ingestion

The catalog is kept fresh by cron jobs that run one **source adapter** each. Everything lives under `src/lib/ingest/`:

| file | role |
|---|---|
| `types.ts` | `IngestEvent` (zod schema — the snake_case row `upsert_events(jsonb)` accepts), `Adapter`, `Unit`, `IngestContext` |
| `normalize.ts` | `slugify` / `classify` (TAG_RULES) / `buildEvent` / `contentHash` / far-future guard / title sanitising — ported from the seed so slugs, source keys and hashes stay identical |
| `http.ts` | `fetchJson` / `fetchText` with `INGEST_USER_AGENT`, timeouts, per-host spacing, backoff + `Retry-After`; `pool()` |
| `upsert.ts` | zod validation (invalid rows are counted, never thrown), dedupe by `source_key` and by `slug`, chunks of 500 → `rpc('upsert_events')` |
| `run.ts` | `runSource(id, { budgetMs, trigger, force, dryRun })`: lease, `ingest_runs` row, resumable cursor, time budget, stale marking, backoff, one JSON log line |
| `sources/index.ts` | registry (`SOURCES`, `listSources()`, `loadAdapter()`); adapters are imported lazily per source |
| `sources/*.ts` | `holidays` (date-holidays, offline), `curated` (src/data/curated.ts + src/data/series.ts), `wikidata`, `wikipedia`, `housekeeping` |

### Adapter contract

```ts
{
  id, label, rank, cadence,            // rank mirrors public.sources.rank (0 = emits no events)
  isConfigured(): boolean,             // keyless adapters return true; keyed ones gate on their env var
  limits: { concurrency, minIntervalMs, timeoutMs, maxRetries },
  plan(cursor, ctx)  -> { units, done, nextCursor? },   // small serialisable work items
  run(unit, ctx)     -> IngestEvent[]                     // build rows with buildEvent()
}
```

`ctx` carries `http`, `log`, `now`, `budget.remainingMs()` and `dryRun`. The runner persists `unit.after` as the cursor after every unit, stops with status `partial` when the budget (`INGEST_BUDGET_MS`, minus a safety margin) runs out and resumes from that cursor on the next invocation; only a *complete* pass calls `mark_stale_records` (rows the source no longer reports become `tentative`). A source in trouble gets `consecutive_failures` and an exponential `backoff_until` (1 h … 24 h); overlapping invocations are prevented by a lease row (`acquire_source_lease`). Unit-level failures are recorded in `ingest_runs.errors` without failing the run (the pass then ends `partial` and restarts from scratch next time). Skipped runs (lease held, backoff, unconfigured) also get an `ingest_runs` row with `status = 'skipped'`.

**Budget is enforced inside a unit too.** `ctx.http` clamps every request timeout to `budget.remainingMs()`, refuses a retry that would not fit and raises `BudgetExceededError` when the deadline — not the remote — cut a request short; the runner then ends `partial` (`reason: budget`) with the cursor still at that unit so the next invocation retries it with a fresh budget (a unit that swallowed the *whole* budget is recorded as failed and skipped so the pass always progresses). The cron route clamps `INGEST_BUDGET_MS` / `?budget=` to `maxDuration − 20 s`, so a run can no longer be killed by Vercel mid-unit with the `ingest_runs` row stuck at `running`.

**Cursors are content-addressed.** The offline sources (`holidays`, `curated`) compute their whole row set per pass and filter it by "now"; a resumed pass therefore continues after the last upserted *slug* (`{ year, afterSlug }`), never at a positional index that would shift once rows became past. Wikidata carries its paging decision in `unit.after` (next page, or next variant when a page was the last one) instead of module state.

**Slugs always have a base.** `buildEvent()` derives `slugify(title)-YYYY-MM-DD`; a title without Latin letters (Arabic or Thai holiday names) gets `<prefix>-<8-hex digest of the title>` (`holiday-tn-1a2b3c4d-…` for holidays, `<source>-…` otherwise), and the zod schema rejects an empty base outright.

**Far-future rows** (beyond now + 15 years) are dropped unless the entry carries the `far-future` tag explicitly (`src/data/curated.ts`: Halley 2061, Transit of Venus 2117, New Year 2100, Y3K …); the curated adapter logs each dropped title so a typo such as `2107` for `2027` is noticed instead of published.

**Source keys** are stable per source (`holidays:<slug>`, `curated:<slug>`, `wikidata:<QID>`, `wikipedia:<year>:<slug>`) so re-ingestion updates rows in place; a row's own source is authoritative on re-ingest, otherwise the higher `sources.rank` wins the merge (curated 9 > wikipedia 3 > wikidata 2 > holidays 1).

### Adding a source

1. Create `src/lib/ingest/sources/<id>.ts` exporting `adapter` (a `docs` comment with the licence / attribution rule, a recorded fixture under `tests/fixtures/<id>/` and a vitest for its mapper).
2. Register it in `src/lib/ingest/sources/index.ts` and add the id to `SOURCE_IDS` in `types.ts` if it is new to `public.sources` (insert the row with its rank and licence in a migration).
3. Add a cron line to `vercel.json` (see the list below) — one path per source, `/api/cron/<id>`.
4. Dry-run it twice: source keys must be identical across runs.

### CLI

```bash
npm run ingest -- --list
npm run ingest -- --source=curated --dry-run          # validate + count (reported as `validated`), 5 sample rows, no writes
npm run ingest -- --source=holidays --budget=8000     # stops 'partial' with a cursor …
npm run ingest -- --source=holidays                   # … and resumes to 'ok'
npm run ingest -- --source=wikidata --force           # ignore the saved cursor and backoff
```

The script runs the same `runSource()` as the cron routes (via `tsx --conditions=react-server`, which keeps the `server-only` guard inert). Outside Next the data-cache tags cannot be invalidated; set `REVALIDATE_URL=https://<site>/api/revalidate` and the script POSTs there with `CRON_SECRET` after a run that changed rows.

### Cron jobs (`vercel.json`, UTC)

| path | schedule | what |
|---|---|---|
| `/api/cron/finalize` | `5 0 * * *` | `finalize_catalog()` (110 s client deadline): past → done, indexability, series linking, enrichment queue, `catalog_stats`; revalidates `events` + `stats` |
| `/api/cron/enrich` | `*/10 * * * *` | drains `enrichment_jobs`: Wikipedia summaries and the licensed image pipeline (see [Images](#images)) |
| `/api/cron/enrich?kind=recheck` | `0 4 1 * *` | monthly licence re-check of the oldest stored Commons files (see [Re-checks](#re-checks)) |
| `/api/cron/holidays` | `0 2 * * 1` | date-holidays, this year … +6 |
| `/api/cron/curated` | `30 2 * * *` | curated one-offs + series expansion (now … +14 years), syncs `series` / `series_aliases` |
| `/api/cron/wikidata` | `0 3 * * *` | precision-guarded SPARQL per class (one query at a time, 1.5 s spacing) |
| `/api/cron/wikipedia` | `20 3 * * *` | year pages, this year … +4 |
| `/api/cron/housekeeping` | `0 8 * * *` | popularity decay (−1/week for non-curated rows unseen 30 days), prune `ingest_runs` > 90 days, `[ingest] STALE <source>` log |

Every route needs `Authorization: Bearer $CRON_SECRET` (401 otherwise) and answers with the run summary JSON (`{ ok: false, status: "error", error }` with HTTP 500 when the runner cannot even start, e.g. missing env or a failed lease RPC). `GET /api/cron/<source>?force=1` ignores the cursor and backoff, `?dry=1` validates without writing, `?budget=<ms>` caps the run (clamped to `maxDuration − 20 s`). `GET /api/cron/status` returns the last 30 runs, `ingest_state` and `catalog_stats`.

The curated adapter syncs `public.series` / `series_aliases` at the start of each pass; an alias that is also an existing `series.slug` (a shell auto-created by `finalize_catalog()` from holiday rows, e.g. `thanksgiving`) is skipped with a warning until the owner retires that shell — otherwise `/days-until/<x>` would have two targets.

**Kill switch:** set `INGEST_ENABLED` to anything but `true` and every cron route returns `200 {skipped:true}` without touching the database.

### Environment

`CRON_SECRET`, `INGEST_ENABLED=true`, `INGEST_BUDGET_MS=240000`, `INGEST_USER_AGENT="UntilCountdowns/2.0 (https://…; contact)"` (Wikimedia rejects requests without a descriptive UA), plus the Supabase variables. Optional: `REVALIDATE_URL` for the CLI, `ENRICH_BUDGET_MS` (falls back to `INGEST_BUDGET_MS`), `SUPABASE_STORAGE_BUCKET` (default `event-images`).

## Develop

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). With no `NEXT_PUBLIC_SUPABASE_URL` the site renders with an empty catalog.

Checks: `npm run lint` · `npm run typecheck` · `npm run build`.

## Images

Every photo on the site is a **re-hosted copy** of a freely licensed file, never a hotlink. `/api/cron/enrich` (every 10 minutes) claims `enrichment_jobs` rows queued by `finalize_catalog()` and runs two workers.

**`wikipedia_summary`** resolves the event to an English Wikipedia article — `external_ids.enwiki`, else the `external_ids.qid` sitelink, else an `en.wikipedia.org` `source_url`, else a search hit that scores ≥ 0.8 against the event title (`"Christmas Day"` → `"Christmas"` scores 0.69 and is refused; the pipeline never guesses) — and copies the REST `page/summary` **extract** into `events.summary` when the description is a placeholder or under 80 characters. Text only: the summary payload's image fields can point at non-free uploads and are never read. Wikipedia prose is CC BY-SA 4.0, so the resolution is stored as `external_ids.enwiki` + `external_ids.summary_source` and the event page renders "Summary from Wikipedia (CC BY-SA 4.0)" linking the article.

**`image`** runs the discovery chain in `src/lib/enrich/images/resolve.ts`, stopping at the first *licensed* hit:

1. `events.image_candidate_url` from an adapter — Launch Library (only with a licence from its allowlist), NASA, or a Commons/Wikipedia file (re-verified against Commons).
2. Wikipedia `prop=pageimages&pilicense=free`, batched 50 titles per call.
3. Wikidata `P18` → venue `P276`'s `P18` → country `P17`'s `P41` flag (elections, national days). `P154` logos are **not** taken: the brief allows a trademarked mark inline only, and everything stored here becomes a hero (the step survives behind an `allowLogo` option no caller passes).
4. Commons keyword search (`gsrnamespace=6`), filtered on size, aspect and title.
5. NASA `images-api.nasa.gov`, for space/astronomy/science, screened for third-party copyright notices and mission patches.
6. Nothing licensed → `image_status = 'skip'` with the reason in `enrichment_jobs.last_error`, and the UI draws the deterministic `FallbackCard` (category gradient + typography seeded by the slug).

### Licence gate

Two independent checks, both in `src/lib/enrich/images/license.ts`:

- **Where the bytes live** — under `/wikipedia/commons/` on the Wikimedia hosts, on the NASA asset hosts, or on the Launch Library CDN. `/wikipedia/en/` is refused: local uploads are where the fair-use posters live, and `pilicense=free` does not reliably exclude them.
- **What the metadata says** — verified through Commons `imageinfo&iiprop=url|size|mime|extmetadata` (**never** `en.wikipedia.org`, which returns fair-use files with a working URL). Accepted: CC0, public domain / PD, CC BY, CC BY-SA, GODL-India, OGL, KOGL, NASA media guidelines. Rejected: `NonFree=true`, "Fair use", any NC or ND clause, `Restrictions` naming a trademark / insignia / currency / personality right, a required attribution that names nobody ("Multiple authors" on a montage), and **a missing licence name** — freedom is never assumed.

Both halves are re-checked inside `storeLicensedImage()` itself, the one place that writes to Storage, so no future branch of the discovery chain can hand over a candidate that skipped the gate. Rows whose title reads like an incident, a disaster or a trial also refuse files categorised as portraits of identifiable people: `extmetadata` says nothing about personality rights, and a head-of-state portrait illustrating a fatal-accident countdown is the wrong picture whatever its licence allows.

`LicenseShortName`, `LicenseUrl`, `Artist`, `Credit`, `AttributionRequired` and the file page are persisted on `public.images`, and `credit` is rendered as `Photo: <author> · <licence> · via <provider>` under every photo, linking the file page and the licence deed.

### Storage

Accepted files are downloaded once with the shared UA (12 MB cap, `image/*`, 15 s), validated with sharp (must decode, ≥ 800 px wide), hashed, and stored under a content-addressed prefix in the public `event-images` bucket:

| object | size | used by |
|---|---|---|
| `<sha256>/hero.webp` | 1600w, q80 | event and series pages |
| `<sha256>/card.webp` | 640w, q75 | listing cards |
| `<sha256>/og.jpg` | 1200×630 cover, q82, < 600 KB | the social card background in `src/lib/og.tsx` — **not built for ShareAlike sources** |

Objects are uploaded with `cache-control: public, max-age=31536000`; `next/image` serves them `unoptimized` (they are already the exact widths the layouts ask for) inside a box whose aspect ratio is known from the stored dimensions, over the stored dominant colour and a thumbhash blur — so an image never shifts the layout. The sha is the dedupe key: two events on the same Commons file share one `images` row and one set of objects, and `events.image_id` is only ever filled in, never overwritten, so a curated image always wins. `series.image_id` inherits the first image one of its occurrences gets.

Failures that a retry cannot fix (too large, too small, undecodable) park the job as `skipped`; transient ones back off `2^attempts` hours, capped at 7 days, and become `failed` after 6 attempts *that actually failed* — `claim_enrichment_jobs` bumps `attempts` on everything it hands out, so a job is only retired when it also carries a `last_error` from an earlier run. Each run claims `remaining budget ÷ ~3 s` jobs rather than a flat 60, and alternates which kind goes first, so a long summary batch stops ageing the image queue behind it.

### ShareAlike, and what may be *made* from a photo

A CC BY-SA file may be published as-is with its credit; cropping it to 1200×630 and laying a scrim, the title and the wordmark over it produces Adapted Material (CC BY-SA 4.0 §2(a)(1)(B)), which would have to be released under a share-alike licence and say so on the card. Until does not do that: `isShareAlike()` in `src/lib/images.ts` gates both ends — `process.ts` does not even build the `og.jpg` crop for such a file, and `ogBackgroundUrl()` makes the OG route fall back to the seeded gradient. CC0 / public domain / CC BY photos keep the card, with `Photo: <author> · <licence>` composed from the parts so the licence name is never the half that gets truncated. Heroes are shown unmodified, in a box clamped to at most 5:4 so a portrait source cannot fill three viewports.

### Re-checks

A re-hosted copy outlives its source: Commons deletes copyright violations and uploaders change licences. `GET /api/cron/enrich?kind=recheck` (monthly, `0 4 1 * *`) takes the 25 oldest `images.last_checked_at` rows with `provider = 'commons'`, re-runs the same `imageinfo` gate, and either bumps `last_checked_at` (rewriting `license` / `credit` when the name changed but is still free) or — when the file is gone or no longer free — sets every event pointing at it back to `image_status = 'skip'`, deletes the three objects and drops the `images` row (`image_id` is `on delete set null`). It is not an `enrichment_jobs` kind: that table's check constraint only knows the two per-event kinds, and this pass is driven straight off `images`. Oldest rows on demand:

```sql
select id, license, origin_page, last_checked_at from images order by last_checked_at asc limit 25;
```

### Operating it

```bash
curl -H "Authorization: Bearer $CRON_SECRET" '<host>/api/cron/enrich?kind=image&limit=10'
curl -H "Authorization: Bearer $CRON_SECRET" '<host>/api/cron/enrich?slug=christmas-day-2026-12-25'
curl -H "Authorization: Bearer $CRON_SECRET" '<host>/api/cron/enrich?kind=recheck&limit=25&dry=1'
```

`?kind=` picks one worker (`wikipedia_summary`, `image`, or `recheck`; default: the two queue kinds), `?limit=` is per kind (default 60, or 25 for `recheck`; max 200), `?dry=1` resolves and reports without writing — note it still *claims* the jobs it inspects, so they come back in 30 minutes — and `?slug=` enriches exactly one event without touching the queue. The run answers with `{claimed, done, skipped, failed, images_created, images_reused, rechecked, relicensed, dropped, durations, changed}` and logs one `{"evt":"enrich_run",…}` line. `/attributions` lists the providers and licences actually present in the library.

## SEO & pages

URL taxonomy (all server-rendered, ISR `revalidate = 3600`, bounded `generateStaticParams`):

| Route | Purpose | Indexable |
| --- | --- | --- |
| `/event/[slug]` | one occurrence (existing links, Save ids, `.ics`) | only when `indexable` and not a series member |
| `/days-until/[series]` | evergreen canonical for a recurring date: next occurrence, dates table (now → +14 y), curated FAQ as visible text, `EventSeries` JSON-LD; aliases 308 | yes |
| `/days-until`, `/category`, `/category/[c]`, `/country`, `/country/[cc]`, `/calendar/[year]/[month]` (2026–2040), `/tag/[tag]` | hubs with `CollectionPage` JSON-LD | yes (empty categories, tags with < 8 events, series without a future date and every `/page/[n]` are `noindex,follow`; calendar months before the current one 404) |
| `/category/[c]/page/[n]`, `/tag/[tag]/page/[n]` (n ≥ 2) | hub pagination lives in the path so page 1 never reads `searchParams` and stays ISR | no (self canonical, `rel=prev/next`) |
| `/attributions` | sources, licences, attribution text | yes |

`/` is the only route that reads `searchParams` (`?q=`, `?sort=`, `?page=`, `?category=` with `q`); those variants are `noindex` with a canonical of `/`. `/?category=x` 308s to `/category/x` and `/category/x?page=n` / `/tag/t?page=n` to `/…/page/n` (`next.config.ts` redirects). Next passes the matched query through to the destination (`/category/x?category=x`); the static hubs ignore it and their canonical is the clean path — dropping it would need a `proxy.ts`, which the app does not have. `robots.txt` disallows `/api/`, `/event/mine-`, `/event/share-` and the `?q=` / `?sort=` / `?page=` URL space; AI crawlers are allowed.

Mixed-case paths (`/country/Ae`, `/event/Foo-…`) are 404s, never redirects: an ISR render that redirects is cached under the request key, and on a case-insensitive file system (macOS `next start`/`next dev`) that entry shadows the lowercase canonical for the whole revalidate window (on Vercel keys are exact-case, so it only bites locally).

**Series guard.** The nightly linker attaches every published row whose slug base equals a series slug, so "Christmas Day" on 7 January (Orthodox), "New Year's Day" on 11 September (Ethiopia) or "Labour Day" in late October (New Zealand) end up linked to the worldwide series. Until the linker checks dates, `src/lib/catalog.ts` treats a linked row as canonical only when it matches the curated recurrence rule (when the series has one) and is curated/worldwide or observed by at least half as many countries as the most widely observed linked row. Series pages, the event page's "Other years", the home/category/index lists and `series.next*` all use that guarded list (`seriesOccurrencesSplit()` also returns the variants, shown apart as "Other dates linked to this series"). Sitemaps exclude series members explicitly (`series_slug is null`), independent of when finalize flips `indexable`.

Metadata comes from `src/lib/seo.ts` (`buildMetadata()`; titles rotate by category and never carry the day count; descriptions do, from SQL `days_until`). JSON-LD builders live in `src/lib/jsonld.ts`: `BreadcrumbList` everywhere, `WebSite` + `Organization` on `/`, `EventSeries` on series pages (its `subEvent` list carries `Event` items only for `jsonld_eligible` occurrences), schema.org `Event` only for `jsonld_eligible` rows (no FAQPage, no SearchAction). Sitemaps: `generateSitemaps()` in `src/app/sitemap.ts` shards into `hubs`, `series` and `events-<year>` (`-h1/-h2` above 40k URLs), served at `/sitemap/<id>.xml`; `/sitemap-index.xml` is a hand-written index because Next emits none. `lastmod` is `updated_at`, no priority/changefreq.

Open Graph cards are route handlers under `src/app/og/*` (`src/lib/og.tsx`, `ImageResponse`, Fraunces + Geist Mono woff from `@fontsource/*`, traced with `outputFileTracingIncludes`). Event and series cards embed the metadata date in the URL (`/og/event/<slug>/<yyyy-mm-dd>.png`) so the day count is fixed per URL and social scrapers refetch daily; dated URLs are `s-maxage=86400, immutable`, undated hubs `s-maxage=3600`. Unknown slugs get the default card (200); a malformed date is a 400. A card only uses a photo when the licence allows adaptations (see [ShareAlike](#sharealike-and-what-may-be-made-from-a-photo)); everything else draws the seeded gradient. Cards stay under 600 KB (WhatsApp limit) — the PNG is quantised in steps and, if it still will not fit, the photo is dropped for the gradient rather than shipped over budget. `GOOGLE_SITE_VERIFICATION` (optional) is emitted from the root layout.

## Sharing

Three ways out of the site, all built on the same document.

| Surface | What it is |
|---|---|
| Link | `ShareButton` — `navigator.share`, falling back to the clipboard |
| **Embed** | `<iframe src="/embed/<slug>">` on someone else's site |
| **Stream** | the same URL as an OBS / Streamlabs **browser source**, background keyed out |

`/embed/[slug]` is a **route handler, not a page** (`src/app/embed/[slug]/route.ts`). The app has a
single root layout — header, footer, gradient body — and an embed has to be a bare, transparent,
dependency-free document, so it is rendered as one self-contained HTML string by
`src/lib/embed/html.ts`: inline CSS, a ~40-line ES5 ticker, no React, no hydration, no webfont, no
third-party request. It answers with `Content-Security-Policy: frame-ancestors *` (the one route on
the site meant to be framed anywhere), `X-Robots-Tag: noindex` and
`Cache-Control: s-maxage=3600` — the markup depends only on the slug and the query string, because
the clock itself is computed in the viewer's browser.

The slug resolves in three ways, so every kind of countdown can travel:

1. `share-<payload>` — a personal countdown, carried whole in the URL (nothing is stored server-side).
2. an event slug (`christmas-day-2026-12-25`), through the same alias redirect the event page uses.
3. a **series** slug (`christmas`) — the evergreen case: the widget ticks to the series' *next*
   occurrence, so an embed put up for one year keeps working the next without the owner touching
   the snippet.

`mine-…` slugs never resolve here: they live in one browser's `localStorage`, and a third-party
iframe is storage-partitioned anyway. The customiser always hands out the `share-` form instead.

### Look and feel

Everything a person can change travels in the query string, parsed by `parseEmbedTheme()` in
`src/lib/embed/theme.ts`. That parser is the security boundary — the values end up in generated CSS
and HTML — so it is closed: every parameter is an enum member, an integer clamped to a range, or a
`#rrggbb` colour, and anything else silently falls back to the preset. A broken URL still renders a
readable countdown.

| Parameter | Values | Default |
|---|---|---|
| `preset` | `dark` `light` `amber` `mono` `neon` `clear` | `dark` |
| `accent` / `text` | `#rrggbb`, `#rgb`, with or without the `#` | from the preset |
| `bg` | a colour, or `transparent` (also `none` / `clear` / `chroma`) — the card's fill under `frame=card`, the whole canvas otherwise, so a widget on a blog is a card and not a coloured band | from the preset |
| `font` | `serif` `sans` `mono` (CSS stacks — no webfont is fetched) | `mono` |
| `scale` | 40–400 (% of the base type size) | `100` |
| `layout` | `row` `stack` `compact` `big` | `row` |
| `pos` | the nine-grid: `top-left` … `center` … `bottom-right` | `center` |
| `units` | `dhms` `dhm` `dh` `d` `hms` `hm` `ms` | `dhms` |
| `frame` | `card` `outline` `none` | `card` |
| `sep` | `colon` `dot` `space` `none` | `colon` |
| `radius` | 0–48 px | `24` |
| `pad` | 0–96 px — the inset from the **canvas edge**, which is how a corner overlay is placed | `24` |
| `labels` `title` `date` `note` `brand` `glow` `trim` | `1` / `0` | see `presetTheme()` |
| `done` | up to 60 characters replacing "It's here." | — |

Only what differs from the named preset is serialised (`embedQuery()`), so switching preset
shortens the URL again instead of freezing the old palette into it.

Two details worth knowing:

- **The largest enabled unit absorbs everything above it.** `units=hms` on a three-day countdown
  shows 76 hours, not 4 — the ticker walks the enabled units in order, taking the whole remainder
  at the first one.
- **All-day dates tick to the viewer's local midnight**, the same rule `eventInstant()` uses. The
  server renders a UTC figure as the no-JS fallback and first paint; the inline script corrects it
  before the first frame.

### The customiser

`src/components/EmbedStudio.tsx` is a closed disclosure on every countdown page (event, series,
`/create`, and a personal countdown's own page). It opens on **Embed on your site** or **Add to your
stream**, drives one `EmbedTheme` through colour, font, size, layout, unit, separator, frame and
nine-grid position controls, previews the real document in an `<iframe>` (debounced, and on a
checkerboard in the stream tab so a keyed-out background is visible), and hands over either the
`<iframe>` snippet or the browser-source URL.

### oEmbed

`GET /api/oembed?url=<an Until URL>` returns the `rich` payload for `/event/…`, `/days-until/…` and
`/embed/…` URLs on this origin, so pasting a plain countdown link into WordPress, Ghost or Notion
produces the widget. Event and series pages advertise it as
`<link rel="alternate" type="application/json+oembed">` (`oembedDiscoveryUrl()` in `src/lib/seo.ts`).
`format=xml` is a 501; `maxwidth` / `maxheight` clamp the box.

> The embed ships inline `<style>` and `<script>`. If the site ever grows a `Content-Security-Policy`
> for its own pages, `/embed/*` needs a hash or nonce — or an exemption.

## Deploy

Vercel (`framework: nextjs`, no custom build command). Set `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` in the project environment (see `.env.example`). Event pages are ISR (`revalidate = 3600`). Cached reads refresh after 1 h (`events` and `stats` tags) or sooner when `/api/revalidate` is called with the `CRON_SECRET` bearer (do this after every `npm run push`); the cron jobs (see Ingestion) invalidate the same tags after each run that changes rows. Set `CRON_SECRET` before relying on the route.

## Stack

Next.js (App Router) · TypeScript · Tailwind v4 · Supabase Postgres
