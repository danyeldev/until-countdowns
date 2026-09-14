# UI rebuild: scope and functional contracts

The existing visual system is disposable: layout, typography, color, imagery treatment, card structure, navigation and copy hierarchy can all change. Preserve the working product behavior and public URLs below. This is a code inventory, not the separate visual research or a requirement to retain the current article-style pages.

Reviewed the installed Next 16.3.4 layouts/pages guide and existing route/component implementations. Keep async `params`/`searchParams`, metadata exports and catalog reads on the server. Client navigation can live inside the server layout; the whole application does not need to become a client component.

## Route and component coverage

| Surface | Routes | Current components / behavior to carry forward |
| --- | --- | --- |
| Discovery and search | `/`, `/?q=...&category=...&sort=...&page=...` | `CatalogExplorer`, `CategoryBar`, `EventCard`, `FeaturedHero`, `EventTable`. Search is URL-backed, categories persist through sort/pagination, empty searches offer recovery, and stale deep pagination redirects to page one. Unfiltered discovery also exposes featured dates, the next seven days, recurring events, categories, countries and months. These can become a unified application workspace. |
| Future-year discovery | Search cards and `/days-until/[series]` | Search groups upcoming occurrences by series/region before counts and pagination. `More years` expands four later occurrences, each linked to its exact event; `All dates` opens the series. An explicit year search selects that year and offers the following years. Distinct TV/event titles and regional variants remain distinct. |
| Catalog event | `/event/[slug]` | `Countdown`, `IntentAnswer`, `StatusBadge`, `CalendarButtons`, `SaveButton`, `ShareButton`, `EmbedStudio`, `EventImage`, `ImageCredit`, related `EventCard`s. Date/status, description, source, last verification, date-change history, geography, tags and other years remain accessible. Alias redirects and true not-found handling already exist. |
| Recurring event | `/days-until`, `/days-until/[series]` | Next eligible occurrence, an evergreen countdown, all canonical future dates, separately identified regional/date variants, related series and optional FAQ. Calendar actions target the next occurrence; sharing and embedding can target the evergreen series. Preserve the no-upcoming-date state. |
| Personal event / shared link | `/event/mine-*`, `/event/share-*` | `MineEvent` loads local records after hydration. Shared URLs decode their own data and work on another device. Saved shared records must reopen the share URL, not a browser-local `mine-*` URL. These are private/noindex surfaces. |
| Saved collection | `/saved` | `SavedList` combines catalog snapshots and local personal records, with All/Saved/Made-by-you filters. Legacy saved IDs are immutable text slugs, not necessarily UUIDs; `/api/events/saved` resolves them in bounded batches. Preserve loading, missing record, retry, blocked storage, empty collection and stale-snapshot fallback states. |
| Creator | `/create` | `CreateForm`, `MineList`. Title, date, category and optional note; live preview; local save; shareable page; calendar/export and embed controls. Tomorrow comes from a request-time server value. Validation, success and failure feedback must remain visible. |
| Categories | `/category`, `/category/[category]`, `/category/[category]/page/[n]` | Grouped category directory, counts, featured/recurring suggestions, chronological results and pagination. Category-specific browsing can share the discovery workspace rather than have a separate visual language. |
| Countries | `/country`, `/country/[code]` | Country directory and counts; dates grouped by the event's local month; links into the monthly calendar; worldwide suggestions. Canonical country links use lowercase codes. |
| Calendar | `/calendar/[year]/[month]` | Previous/next month, event-local day grouping, date drill-through and empty month state. Supported range is 2026–2040; past months are not browseable under the current contract. A new calendar interface must preserve access to every listed event. |
| Tags | `/tag/[tag]`, `/tag/[tag]/page/[n]` | Validated tag routes, chronological rows, pagination and an alternate search link. Thin pages stay noindex; unknown/empty tags use not-found handling. |
| Trust and recovery | `/about`, `/attributions`, root `error.tsx`, event `error.tsx`, `not-found.tsx`, home `loading.tsx` | Source/coverage explanation, image/text credits, retriable catalog failures, unknown links and loading feedback must receive the same rebuild. Database outages must not become cached 404s. |

Machine endpoints remain stable: `/api/events`, `/api/events/saved`, `/api/ics/[slug]`, `/api/oembed`, `/embed/[slug]`, `/og/*`, manifest, robots and sitemap routes. Cron/status endpoints and database contracts are not UI work.

## Reuse logic, replace presentation

- **Time:** retain `lib/time.ts`, the shared `useNow` timer and the state logic in `Countdown`. All-day dates, timed instants, event-local days, today/past states, approximate periods and cancelled/postponed/retired events are different states. Never turn a year/month placeholder into an exact day or running clock.
- **Catalog:** retain `lib/catalog.ts`, recurrence/region guards, source-backed search, `futureOccurrencesForEvents`, immutable event IDs and bounded prerendering. One batch supplies year previews; avoid a request per visible card.
- **Personal data:** retain `lib/user-events.ts`, `use-local-store.ts` and `event-id.ts`. Keep existing storage keys and old personal slugs, 120-character titles, 500-character new notes, 2,000-character UTF-8 share payload limit, corrupt/blocked storage handling and local record deletion cleanup. Older long notes remain readable.
- **Sharing and calendars:** retain `lib/calendar.ts`, `canAddToCalendar`, share cancellation/clipboard fallback and the `lib/embed` model. Google/Outlook/.ics must carry the right source date/time, end time, location and share/series URL. Approximate or withdrawn dates must not produce misleading calendar events. Existing embed URLs and stream customization remain compatible.
- **Search appearance and attribution:** preserve central metadata, canonicals, JSON-LD eligibility, noindex policies, daily OG URLs and source/image license checks. New branding should update OG/icons as part of the same visual release. Do not copy externally licensed summaries into a new panel without their attribution; the existing series summary rendering needs particular review.

## Proposed implementation ownership

| Owner | Exclusive files / responsibility | Shared interface |
| --- | --- | --- |
| Root: application shell | `app/layout.tsx`, `globals.css`, Header/Footer, Icon, navigation/overlay primitives, root loading/error/not-found; brand/OG coordination | Establish semantic surface/text/accent/status tokens and reusable controls first. Publish the shell/content boundary and mobile navigation behavior. |
| Discovery + browse | Home, category/country/tag/calendar/recurring directories; `CatalogExplorer`, `CategoryBar`, `EventCard`, `EventTable`, `Pager`, `FeaturedHero`, image/fallback presentation | Preserve `EventCard` props including future occurrence previews. `EventTable` remains reusable by detail routes. Coordinate shared layout tokens, not edits to other owners' files. |
| Detail + distribution | Event and series detail routes; `Countdown`, `IntentAnswer`, `StatusBadge`, `CalendarButtons`, `EmbedStudio`, `ImageCredit`; about/attributions and metadata consistency | Personal owner supplies save/share controls. Preserve date/status gates, license credits and evergreen embed behavior while replacing the entire detail composition. |
| Personal workspace | Saved/create routes; `SavedList`, `CreateForm`, `MineList`, `MineEvent`, `SaveButton`, `ShareButton`; local data libraries only when necessary | Preserve compact save and full save variants, original event snapshots, portable shared links and accurate success/error announcements. |

Avoid concurrent edits to shared card/table/countdown/control files. Agree props before parallel implementation; route owners can consume the new controls as soon as the interface is stable.

## New interface acceptance criteria

1. Searching, saving and making a countdown are immediately discoverable on desktop and mobile. Navigation, focus and search state survive normal route changes and browser Back/Forward.
2. Repeated annual dates feel like one expandable event, while later years and regional variants remain easy to find. Keep the tested Halloween and explicit-2030 flows.
3. Date, event status and primary actions are readable before optional background/context. Secondary information can use tabs, drawers or disclosures, with keyboard/focus behavior and meaningful deep links.
4. Every route above has an intentional loading, empty, error and narrow-screen state. No nested links/buttons, hidden keyboard actions, clipped countdowns, horizontal page overflow or invisible save failures.
5. The UI does not promise accounts, cross-device sync, notifications or offline access that the product does not provide. A shared URL includes its note; local storage belongs to the current browser.
6. Validate desktop and 390px mobile search → More years → exact date/series; event → save → collection; create → save → personal page; shared link → save → reopen; calendar export/embed; month/country/category/tag navigation; storage failure and API failure recovery. Run existing time, calendar, personal-store, series-preview, embed and SEO regressions with lint/typecheck/build. New tests should cover changed behavior, not cosmetic markup.
