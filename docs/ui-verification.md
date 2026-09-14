# UI rebuild verification

Verified locally on September 14, 2026, after the research-led graphite/violet redesign. Development preview: `http://localhost:3001/`. A separate production build was exercised on port 3002 and stopped afterward. The application has not been deployed as part of this UI revision.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run lint` | Pass, no warnings |
| `npm run typecheck` | Pass, generated Next route types and TypeScript |
| `npm test` | 909 tests across 58 suites pass |
| `npm run build` | Pass; 43 static outputs generated; dynamic/ISR catalog routes remain bounded |
| `git diff --check` | Pass |

The suite includes recurrence previews, precise and approximate dates, lifecycle states, timezone display, calendar eligibility, saved storage and portable Unicode shares, collection grouping, API recovery, SEO/OG and embed rendering. This UI revision did not change or rerun production ingestion. SQL regression results from the earlier rebuild remain documented separately in [rebuild and rollout](rebuild.md).

## Browser flows

| Area | Checks completed |
| --- | --- |
| Discovery | Loaded production homepage at 1440px and 390px; 12 cards, feature artwork, navigation and no failed images or horizontal overflow. Additional 320px inspection passed, including a 2039 detail page with a four-digit day count. |
| Search | Global modal opens with focused input; debounced Halloween results; Arrow Down advances between links; Escape closes and restores trigger focus. Enter-submitted Halloween 2039 search renders one dated result. Full results retain query, sort and category routes. |
| Future years | Halloween has one next-occurrence result plus its separately named TV matches. More years reveals 2027–2030 and the all-dates route. A year chip opens the actual dated event URL. Explicit Halloween 2039 API search returns the 2039 occurrence alone. |
| Details | Desktop series and 390px dated event checked. Countdown, source/date context, year navigation and metadata preserved. ShareAlike photos use a separate original-proportion photograph view; generated artwork supplies the backdrop. |
| Calendar | `/calendar` redirects to the current UTC month. Month grid, day anchors and month switching work. Calendar export disclosure fits 390px; Escape restores its summary focus. |
| Directories | Category pages at desktop/mobile, country filtering to Argentina, correct country route, paginated canonical/robots/previous-next links, and expected out-of-range 404 checked. |
| Creation | Desktop and mobile date entry, long Unicode title/note, live preview and editing anchors, creation and full reload persistence checked. |
| Saved | All/Saved/Created filters, counts, local search, clear/no-match states, Save/Unsave, reload persistence and empty state checked. Shared item retains its portable URL after its originating local record is removed. |
| Sharing | Real native-share cancellation with Escape leaves no false copied feedback. Clipboard fallback checked with a scoped browser stub; denied copy displays manual-copy guidance. |
| Embeds | Matching default theme, four visible units at mobile width, optional date in source timezone, explicit legacy theme URL compatibility, studio controls and copy feedback checked. |

Verification created two disposable personal records in an isolated browser session; both were removed through the UI. Existing user data was not used as test data.

## Accessibility and visual review

Axe checks reported zero violations on the inspected home, mobile search dialog, 2039 search results/detail, personal collection and embed studio surfaces. Keyboard checks covered search focus and arrow navigation, modal dismissal, ordinary links, and calendar disclosure dismissal. Main reading surfaces, image overlays, desktop layouts, 390px mobile layouts, and a 320px home/search viewport were visually reviewed. Reduced-motion and reduced-transparency preferences have explicit CSS handling.

Automated contrast checks left some image/gradient layers inconclusive. They were visually reviewed, but this is not a complete WCAG certification or an assistive-technology user study. The design uses labels alongside color and keeps artwork decorative. Date and storage logic tests supplement, rather than replace, the browser checks.

## Production route smoke checks

The compiled app returned 200 for the homepage, Halloween series, Halloween search, catalog search API, manifest, default OG image, and dated Halloween OG image. Search variants retained `noindex, follow`. The series canonical and OG paths remained correct. Absolute metadata origins used this checkout's configured local `NEXT_PUBLIC_SITE_URL` (port 3000), independently of the temporary test server port; production must use the production domain as documented in the rollout guide.

The production browser reported no page errors on the checked homepage. Artwork loaded successfully. Development-only Next controls are absent from the production screenshots.

## Representative captures

- [Final desktop homepage](../artifacts/ui-home-final-desktop.png)
- [Final mobile homepage](../artifacts/ui-home-final-mobile.png)
- [Keyboard search dialog](../artifacts/ui-search-dialog.png)
- [Future-year disclosure on mobile](../artifacts/ui-future-years-mobile.png)
- [Halloween desktop detail](../artifacts/ui-halloween-desktop.png)
- [Dated event on mobile](../artifacts/redesign-details/event-mobile.png)
- [Original-proportion photograph disclosure](../artifacts/redesign-details/event-photo-mobile.png)
- [Embed studio on mobile](../artifacts/redesign-details/studio-mobile.png)
- [Calendar desktop](../artifacts/redesign-browse/calendar-desktop.png)
- [Calendar mobile](../artifacts/redesign-browse/calendar-mobile.png)
- [Country filter](../artifacts/redesign-browse/country-filter-mobile.png)
- [Creator desktop](../artifacts/redesign-personal/create-desktop.png)
- [Saved collection mobile](../artifacts/redesign-personal/saved-mobile-fixed.png)

Research source captures are cataloged separately in the [consumer design appendix](design-research-consumer.md).
