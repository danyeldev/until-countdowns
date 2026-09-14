# Consumer discovery patterns for Until

Until should make the future feel worth collecting: expressive event imagery, a clear sense of time, immediate saving, and a useful personal view. Recent consumer products support this direction more strongly than a large filter dashboard or an endless wall of identical countdown cards.

This review distinguishes dated product changes from the current appearance of public pages. Public interfaces were inspected on September 14, 2026 at desktop and 390-pixel mobile widths. Native app observations use explicitly identified official screenshots. These observations are evidence of particular screens, not claims of overall accessibility compliance or measured improvements in conversion.

## Evidence and recency

| Product | Dated evidence | Current visual evidence | What the evidence establishes |
| --- | --- | --- | --- |
| Apple Invites | Apple launch announcement, February 4, 2025 | Official launch screenshot of an invitation | A released 2025 product with an expressive invitation surface and a clear response action; the screenshot is not asserted to depict the September 2026 version. |
| Luma | No release date established for the inspected design | Live Discover and Buenos Aires pages, desktop/mobile | Current category discovery, community calendars, and a dated event timeline. Do not label this a 2026 redesign. |
| Partiful | Explore help article dated July 2, 2026 | Live Explore mobile page | Explore is documented in 2026, including its change of name from Discover; the article date does not establish the feature's launch date. |
| Flighty | App Store version history: Airport Intelligence, version 4.8.0, March 24, 2026; late-2025 notes describe revised Live Activities and an essential-action toolbar | Live Flighty Airports desktop/mobile | Released recent changes plus a current public interface that translates changing data into visible status. |
| Cosmos | Founder announcement, January 20, 2026; search documentation, March 30, 2026 | Live Explore desktop/mobile | A documented 2026 change to saving, following and provenance, alongside a current visual discovery interface. |

Sources: [Apple announcement](https://www.apple.com/newsroom/2025/02/introducing-apple-invites-a-new-app-that-brings-people-together/), [Luma Discover](https://luma.com/discover), [Partiful Explore explanation](https://help.partiful.com/en-us/articles/15525568-what-is-the-partiful-explore-page), [Flighty version history](https://apps.apple.com/us/app/flighty-live-flight-tracker/id1358823008), [Flighty Airports](https://flighty.com/airports), [Cosmos founder announcement](https://www.cosmos.so/blog/the-future-of-cosmos), [Cosmos search documentation](https://help.cosmos.so/en/articles/11717945-search).

## Apple Invites: the event has a visual identity

The official 2025 invitation screenshot leads with a photograph occupying much of the phone, then the event name, time and address. A single segmented response area is placed before the longer host description. Controls sit on a softened photographic background. Apple's announcement also establishes that guests can respond on the web without an Apple Account or Apple device.[^apple]

**Adopt:** let an important event feel like a destination, with its own image and a strong title. Place date, countdown and the main save action together, before secondary metadata. The useful lesson is the ordering of information and action, not the particular blur effect.

**Avoid:** copying translucent text surfaces without testing them against the actual image collection. Use a reliable surface beneath date and action text when image contrast is unpredictable. Guest access on the web is evidence of reduced platform friction; it is not evidence of VoiceOver or WCAG support.

## Luma: discovery narrows into a timeline

Luma's current Discover page separates categories, community calendars and cities. Categories have names and counts; community calendars have identity and a follow action. Its Buenos Aires page uses a city photograph and local time above a chronological event list. In the mobile list, day grouping provides the structure around each event's title, time, host and location.[^luma]

**Adopt:** use human time groupings in Until—today, this week, later this month—and make categories useful entry points. A recurring series can serve the role of a calendar: follow the subject once, with dated occurrences available underneath. Keep country and timezone context near dates.

**Avoid:** making a city selector mandatory for a catalog containing global launches, holidays and entertainment. Luma's documentation explicitly limits its own discovery to public, in-person events; Until has a different content model. Its photographed city introduction also occupies substantial mobile space, so a smaller introduction would better suit repeat visits.

The inspected accessibility tree exposed named links, headings, search and calendar-subscription buttons. This supports a limited semantic observation, not a keyboard or screen-reader certification. Current mobile captures show horizontal category/calendar sections and a single-column event sequence.

## Partiful: character comes from events and communities

The current mobile Explore screen uses an atmospheric photograph, large informal typography and a persistent bottom navigation. Below the introduction, cities organize event posters and social signals. The July 2026 help article describes discovery through local events, friends and communities.[^partiful]

**Adopt:** give events room for their own visual personality instead of applying a category-colored placeholder to everything. Short themed collections can connect a visitor's interests with upcoming dates. A small mobile navigation can keep discovery, saved events and the calendar within reach.

**Avoid:** inventing popularity or friends-attending signals when Until has no supporting data. The inspected mobile screen spends most of its first viewport on an app-promotion introduction. Until should show actual upcoming events sooner.

The bottom navigation had accessible destination names in the extracted tree. Several event containers appeared as clickable generic elements with nested links, and some numeric buttons lacked an explanatory name. This is a reason to implement Until's own clearly named links and save buttons, not evidence of a complete accessibility failure in Partiful.

## Flighty: show what the time means

Flighty's App Store history documents 2026 airport intelligence, disruption reasons, delay trends and favoriting airports. The public airport interface combines a map with a structured list, airport identities, numeric status and explanatory alert text. Desktop has a prominent search field and a live/today switch.[^flighty]

**Adopt:** pair the countdown with meaningful state: scheduled, tentative, postponed, or a confirmed date change. Provide source attribution and a human-readable update time. A large number is more useful when the visitor can judge how dependable it is.

**Avoid:** pretending all data is live. Until's sources have different refresh schedules and date precision. Also avoid transplanting the wide airport table onto a phone: at 390 pixels, the inspected viewport displayed the airport/city columns while other metrics continued beyond the visible width. Critical countdown and date information should fit without horizontal scrolling.

The current App Store listing says the developer has not declared supported accessibility features. That means the listing supplies no such assurance; it does not mean the app lacks those features. The web screenshot uses color, icons and text together for some status information, but contrast and keyboard behavior were not audited.

## Cosmos: collect first, organize later

Cosmos's January 2026 announcement explicitly describes removing the requirement to select a collection before saving. It also introduces a following feed and contextual attribution for images. The current Explore page pairs a horizontal row of curated collections with an image-led grid. Desktop showed five image columns; the 390-pixel layout showed two. The search field remains prominent.[^cosmos]

**Adopt:** save immediately, then offer optional organization. For Until, this suggests a personal list of anticipated events with optional topics or collections. Search should work inside saved events as well as across the catalog. Curated groups should have descriptive names and recognizable visual content.

**Avoid:** using masonry for rows that must be compared by date. Cosmos's layout serves images of different dimensions; Until needs a stable place for title, date, confidence and countdown. Contextual search is documented in March 2026, but Until does not need visual search or AI-generated discovery to gain the same benefit.

The current tree exposed selected category tabs and save buttons. Some image names described uploader/date rather than image content. Until should supply descriptive event text independently of images. The inspected mobile layout provides evidence of responsive rearrangement, not proof of every breakpoint or assistive-technology behavior.

## Recommended direction

The following recommendations are design judgments derived from the comparisons, not measured outcomes from those companies.

1. **Make time the organizing structure.** Use a compact date horizon above a visually varied selection of events. Offer a calendar for deliberate planning and a chronological view for quick scanning.
2. **Treat an event as a collectible object.** Give it a recognizable image, concise title, readable countdown and immediate save action. Do not require organizational decisions before saving.
3. **Give recurring events a compact identity.** Show the next occurrence prominently, with a short horizontal sequence of later years or an expandable date list. Repetition should be useful information, not repeated search cards.
4. **Keep expressive imagery and functional controls distinct.** Rich images can carry personality; consistent typography and restrained surfaces carry dates, uncertainty and actions. A new visual direction should not depend on blurred gradients to feel modern.
5. **Make reliability visible in ordinary language.** Use precise versus approximate dates honestly. Put the source and last meaningful update within reach, especially for launches, schedules and predictions.
6. **Design the mobile hierarchy directly.** The first screen should include something upcoming. Title, date and countdown must remain readable without horizontal scrolling. Horizontal rails can hold optional collections or future years, with clear continuation cues.
7. **Verify rather than inherit accessibility.** Test focus order, reduced motion, text scaling, image contrast, save-state announcements, empty states and every icon's accessible name. None of the product comparisons substitutes for these checks in Until.

## Visual evidence files

These are captures of public interfaces for design comparison, not assets to reuse in Until's product.

| Evidence | Capture |
| --- | --- |
| Apple Invites official February 2025 screenshot | [Invitation](../artifacts/design-research-consumer/apple-invites-official-2025.png) |
| Luma current Discover | [Desktop](../artifacts/design-research-consumer/luma-discover-desktop.png) |
| Luma current Buenos Aires calendar | [Desktop](../artifacts/design-research-consumer/luma-city-desktop.png), [mobile introduction](../artifacts/design-research-consumer/luma-city-mobile.png), [mobile event sequence](../artifacts/design-research-consumer/luma-city-events-mobile.png) |
| Partiful current Explore | [Mobile](../artifacts/design-research-consumer/partiful-explore-mobile.png) |
| Flighty current Airports | [Desktop](../artifacts/design-research-consumer/flighty-airports-desktop.png), [mobile](../artifacts/design-research-consumer/flighty-airports-mobile.png) |
| Cosmos current Explore | [Desktop](../artifacts/design-research-consumer/cosmos-explore-desktop.png), [mobile](../artifacts/design-research-consumer/cosmos-explore-mobile.png) |

## Sources

[^apple]: Apple. [Introducing Apple Invites, a new app that brings people together](https://www.apple.com/newsroom/2025/02/introducing-apple-invites-a-new-app-that-brings-people-together/). February 4, 2025. Includes the official invitation screenshot used here.

[^luma]: Luma. [Discover Events](https://luma.com/discover) and [Buenos Aires events](https://luma.com/buenos-aires?k=p). Undated current interfaces, accessed September 14, 2026. Product scope corroborated by [Searching for Events on Luma](https://help.luma.com/p/searching-for-events), undated current help documentation.

[^partiful]: Partiful. [What is the Partiful Explore page?](https://help.partiful.com/en-us/articles/15525568-what-is-the-partiful-explore-page). July 2, 2026. Visual evidence: [Explore](https://partiful.com/explore), current interface accessed September 14, 2026.

[^flighty]: Flighty LLC. [Flighty — Live Flight Tracker, App Store version history and accessibility disclosure](https://apps.apple.com/us/app/flighty-live-flight-tracker/id1358823008). Version history includes March 24, 2026 and late-2025 entries. Visual evidence: [Flighty Airports](https://flighty.com/airports), current interface accessed September 14, 2026. App Store release dates without a printed year were interpreted within the chronological 2026/2025 version history.

[^cosmos]: Andy McCune, Cosmos founder and CEO. [The Future of Cosmos](https://www.cosmos.so/blog/the-future-of-cosmos). January 20, 2026. Cosmos, [Search](https://help.cosmos.so/en/articles/11717945-search), March 30, 2026. Visual evidence: [Explore](https://www.cosmos.so/explore), current interface accessed September 14, 2026.
