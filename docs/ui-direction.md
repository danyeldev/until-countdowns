# Until interface direction

The interface is a time-focused consumer app. Its primary jobs are finding a moment, understanding when it happens, saving it, and returning to a useful collection. The design combines expressive content with a stable, quiet interaction layer, informed by 2025–2026 product research in the accompanying reports.

## Visual system

The interface is minimal: one graphite canvas, off-white typography and a soft violet interaction accent. Content sits directly on the canvas; hierarchy comes from type scale, spacing and hairline dividers rather than boxes. Artwork supplies richer color. All typography is sans-serif; display numbers are large, tightly tracked and tabular.

Avoid containers, borders and nested cards. Do not wrap sections, lists or forms in bordered panels. Separate stacked items with a single hairline (`border-t border-line`, `divide-y divide-line` or the `hairline` class). Use a translucent fill (`bg-surface`, `hover:bg-surface-hover`) only for interactive controls and the rare emphasized block; never outline them. Dropdowns and dialogs float on shadow alone. Imagery is rounded and unframed; text sits beneath it on the canvas.

Tokens: `bg-ink` = #0b0d12; `bg-ink-2` = #12141b; `bg-surface` = white 4%; `bg-surface-hover` = white 7%; `text-paper` = #f4f5f8; `text-paper-dim` = #b4b9c8; `text-muted` = #8e95a6; `border-line` = #1e222c (hairlines only); `text-amber` = #b7a6ff (legacy name, violet accent). Primary action uses near-black text on violet. Blur is reserved for the sticky top bar, mobile navigation and artwork overlays.

Root supplies shared CSS: `page-heading`, `page-subtitle`, `section-heading`, `eyebrow`; `button-primary`, `button-secondary` (soft fill), `button-ghost`, `icon-button`; `field`, `field-label`; `chip` (filters and tags, `aria-current` for the active one), `segmented` (sort toggles), `pill` (plain muted metadata text); `menu` and `menu-item` for floating dropdowns; `notice` and `notice-warn` for inline messages; `hairline`, `empty-state`, `nav-item`. `panel` and `ticket` remain only as soft fills with no border and should not be introduced in new layouts. Shared component classes are unlayered, so they win over Tailwind display utilities; wrap a control rather than combining `hidden` with a button class. Rounded corners 12–16px on controls, 20–24px on art and cards, comfortable minimum 44px touch targets. Avoid tiny uppercase text for functional content.

## App structure

Desktop uses a quiet 232px navigation rail with no border or distinct background, and a compact blurred top bar with global search. The main canvas fills the remaining width with a sensible maximum. Mobile uses a compact header and fixed lower navigation for Explore, Calendar, Saved and Create. Deep pages keep the same shell. Footer is a short utility row.

Discovery opens on useful countdown content, with one prominent featured moment and compact nearby dates. Filters and search results use a consistent toolbar. Cards prioritize the event, its date and its remaining time, with saving as a distinct control and future occurrences revealed within the card. Search stays URL-addressable and supports keyboard invocation.

Event and series views put the live countdown, date and actions above descriptive content. Artwork adds atmosphere while text stays legible. Status and date precision remain explicit. Series years become navigable date choices. Source details, calendar export, share and embed remain available without overwhelming the first viewport.

The personal space feels like a collection: empty state with useful actions, saved and created views, compact controls and visual previews. Creation should show a clear live preview and only relevant controls. Preserve storage recovery and share portability.

## Ownership

- Root: global styles, app shell/header/footer, home/discovery, EventCard/FallbackCard/FeaturedHero/Countdown, quick search, research synthesis and final verification.
- Detail work: event and series detail pages, EventTable, Breadcrumbs, StatusBadge, CalendarButtons, EmbedStudio, shared page-level errors.
- Personal work: CreateForm/create page, SavedList/saved page, MineList/MineEvent, SaveButton/ShareButton. Preserve exported contracts and data/storage logic.
- Browse work: category/country/tag/month and recurring-directory pages, Pager, about/attributions, OG/icons/manifest visual alignment. Preserve metadata and catalog reads.

## Constraints and verification

This is a visual and interaction rebuild. Keep the working data pipeline, applied recurring-search fix, all original dated URLs, cached bookmark IDs, metadata eligibility and calendar/embed safety. Do not write to the production database or add a backend merely to achieve a visual effect.

Respect reduced motion, keyboard focus and native dialog/disclosure behavior. No fabricated user counts, personal recommendations, progress percentages or account state. Verify home, Halloween search, More years, year-specific search, detail, creator/save/share, saved collection, browse directories and mobile navigation at 390px and desktop widths.
