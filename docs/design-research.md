# Until: a new interface for anticipation

Research and implementation review · 14 September 2026

Until now uses an app shell with persistent navigation, expressive event artwork, a large readable countdown, immediate saving, and a personal collection organized by time. Discovery, event details, later years, calendars, creation, sharing, and metadata artwork follow the same visual system. The existing event URLs, recurrence logic, date confidence, source attribution, and local saving behavior remain part of the product.

The direction comes from a comparison of twelve product references, supported by recent first-party release material, current public interfaces, and platform design guidance. The strongest common thread is **expressive content inside a quieter, predictable interface**. The evidence does not establish that dark interfaces are universally better. Graphite, violet, and original abstract artwork are a design choice for Until: they give anticipation a recognizable visual identity while keeping dates and controls legible.

## What “recent” means in this report

Dated product evidence spans February 2025 through August 2026. Linear's March 2026 refresh, Raycast's May redesign and August general release, Cosmos's January 2026 changes, and Apple's June 2026 Design Awards are especially relevant. Current public Luma, Partiful, Cosmos, and Flighty interfaces were inspected on September 14, 2026 at desktop and mobile widths. An undated live page is identified as a current observation, not described as a newly launched design.

The appendices retain the individual source dates, authors where available, visual evidence, limitations, and recommendations. Vendor release posts establish shipped features and stated design intentions. They do not establish conversion gains, accessibility conformance, or Until user preferences. No authenticated native app account was needed; native examples use explicitly identified official product images. Captured reference screens are research evidence, not assets reused in the app.

## The findings that shaped the rebuild

### Quiet navigation makes expressive content easier to use

Linear's March 2026 case study describes more consistent locations for controls and a reduction in the prominence of navigation and separators. Raycast's May 2026 redesign consolidates common searches into one root surface. These support a predictable application frame and a visible search entry. They do not imply that Until needs an enterprise workspace or that keyboard shortcuts should replace ordinary controls. [Linear's design account](https://linear.app/now/behind-the-latest-design-refresh), [Raycast's redesign](https://www.raycast.com/blog/the-new-raycast).

Until implements a compact desktop sidebar, a consistent top search control, and a four-destination mobile navigation. Search also remains available in the catalog. Control/Command K opens a native modal dialog; arrow keys move through results, Enter follows a result, and Escape restores focus. Query, category, sort, pagination, and event destinations remain URL based, so links and browser navigation continue to work.

### The event should have character before the interface adds decoration

Apple Invites places event identity and primary actions together. Cosmos's January 2026 announcement removes a required organizational decision before saving an item. Current Luma screens use date groupings to make a collection of events understandable. These are compatible ideas: make an event attractive, make saving immediate, and make its position in time clear. [Apple Invites](https://www.apple.com/newsroom/2025/02/introducing-apple-invites-a-new-app-that-brings-people-together/), [Cosmos's product changes](https://www.cosmos.so/blog/the-future-of-cosmos), [Luma Discover](https://luma.com/discover).

Until uses a cinematic feature area, concise event cards, a large day figure with a smaller clock, and one-step saving. Original abstract artwork gives events without usable photography a visual identity. It is decorative and hidden from assistive technology; it does not claim to depict a real event. Licensed catalog images retain their attribution and usage rules. The original research screenshots are not part of the site's artwork.

### Time needs context, not just a number

Apple's 2026 Design Awards recognize Moonlitt for interaction and Tide Guide for visuals and graphics. Both are relevant examples of time and environmental information receiving a distinct visual treatment. Flighty's published 2026 changes connect changing travel data with explanations and status. These examples informed the emphasis on a readable primary time state, but do not validate Until's countdown calculations. [Apple's 2026 awards](https://www.apple.com/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/), [Flighty release history](https://apps.apple.com/us/app/flighty-live-flight-tracker/id1358823008).

Until keeps scheduled, approximate, postponed, cancelled, and past states explicit. Coarse dates do not acquire a false second-by-second timer. Exact active dates can be exported; unsupported states remain ineligible. Recurring search results lead with the next occurrence and disclose later years, while a dedicated year timeline links to the actual dated event pages. The calendar now has a real month grid with day navigation and a readable event agenda.

### Progressive disclosure can make a capable product feel simple

Craft's May 2026 reminder groups and Notion Mail's purpose-oriented views suggest that saved content is more useful when organized around what someone is trying to do. Their larger customization systems are not prerequisites for Until. [Craft's May update](https://www.craft.do/blog/craft-update-3-4-2), [Notion Mail's launch](https://www.notion.com/blog/introducing-notion-mail).

Until's personal space separates saved and created dates, provides search, and groups upcoming, changed, and past events. Creation begins with the essential date and title, with optional details and a live preview. Calendar choices sit behind a labeled disclosure. Embed configuration is available when requested. Sources and date explanations remain within reach without occupying the countdown's primary visual position.

### Material and motion should serve orientation

Apple's current material guidance distinguishes the functional navigation/control layer from content. Google's May 2025 Material 3 Expressive announcement emphasizes typography, color, and responsive motion. Neither source is a reason to apply blur to every panel. [Apple material guidance](https://developer.apple.com/design/human-interface-guidelines/materials), [Material 3 Expressive](https://blog.google/products-and-platforms/platforms/android/material-3-expressive-android-wearos-launch/).

Until uses opaque reading surfaces, restrained translucency in navigation and artwork overlays, short state transitions, stable tabular timer figures, and reduced-motion behavior. Reduced-transparency preferences remove navigation blur. Text labels accompany selected states and status colors. These are implemented decisions, with browser checks described below; they are not a claim of complete assistive-technology certification.

## Implementation map

| Product area | Rebuilt behavior | Evidence applied |
| --- | --- | --- |
| App frame | Stable desktop navigation; mobile Explore, Calendar, Saved, Create; visible global search | Linear, Raycast, Partiful |
| Discovery | Compact spotlight, upcoming selection, art-led cards, category chips, chronological highlights | Luma, Apple Invites, Cosmos |
| Search | Debounced modal search, keyboard navigation, exact-year queries, nearest recurring date with later-year access | Raycast; Until's recurrence requirements |
| Event and series | One focused countdown stage; date, Save, Share and Calendar together; year timeline; source context | Apple Invites, Flighty, Moonlitt, Tide Guide |
| Personal space | Local saved/created filters, collection search, upcoming/changed/past groups, storage recovery | Cosmos, Craft, Notion Mail |
| Creation | Essential inputs first, live artwork/countdown preview, optional details and on-demand embed | Progressive-disclosure synthesis |
| Calendar and directories | Month grid, day anchors, month switching, category groups, country search | Luma's chronological structure |
| Sharing identity | Matching graphite/violet icons, Geist typography and updated Open Graph treatment | Consistent system application |

The research also considered adjacent desktop detail panels, custom collections, personalized recommendations, and selectable time horizons. Those remain hypotheses, not implemented claims. This rebuild uses dedicated shareable detail routes, useful defaults, and the catalog's existing factual data. It does not invent social activity, personalized relevance scores, or live-source guarantees.

## Visual and interaction evaluation

The application is checked using real catalog content and disposable local countdowns. The representative flow is: search Halloween, inspect the next occurrence, expand future years, visit a specific year, save a date, view the personal collection, and inspect calendar/sharing controls. Desktop and narrow mobile screens are inspected separately. Empty, approximate, changed, and past states are evaluated through the implementation and automated date/storage tests.

See the [implementation verification record](ui-verification.md) for commands, results, screen captures, and remaining limits. Screenshots are a visual record of this local build; they are not production deployment evidence. Research findings remain provisional until real people use the redesign. In particular, this work does not establish whether the chosen dark palette outperforms a light alternative or whether visitors prefer the current discovery order.

## Detailed evidence

- [Appendix A — recent product and productivity interfaces](design-research-product.md): Linear, Raycast, Notion Mail, Craft, and Dia; dated sources and visual observations.
- [Appendix B — consumer event and discovery interfaces](design-research-consumer.md): Apple Invites, Luma, Partiful, Flighty, and Cosmos; desktop/mobile captures and dated product evidence.
- [Implementation design contract](ui-direction.md): tokens, typography, hierarchy, controls, and ownership used to keep the rebuild consistent.

Together these documents form the research record. Every recommendation is an application of evidence to Until's needs, rather than a claim that a reference company's design will produce the same outcome here.
