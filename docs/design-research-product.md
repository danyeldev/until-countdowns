# Recent product design patterns for Until

Until should become a coherent place to discover and keep future dates: a stable navigation frame, a clear view of what happens next, and focused detail surfaces. The recommended direction combines the speed of a search tool with the temporal structure of a calendar. This is a design judgment, not a claim that any reference product has proved the same approach will work for Until.

## Evidence and scope

The evidence covers releases from April 2025 through August 2026, reviewed on September 14, 2026. All seven sources below are first-party product announcements or release notes. The Linear, Raycast, Notion Mail, and Craft reference images were visually inspected. They are vendor-published product visuals rather than screenshots from authenticated accounts. Dia's behaviors are documented release features; its interactions were not independently exercised. Published intentions and observed layouts are distinguished from recommendations throughout.

The evidence supports interaction and information architecture decisions. It does not establish conversion gains, accessibility conformance, measured latency, or a universal preference for dark interfaces. The dated release visuals also do not prove every pixel is unchanged in today's installed applications.

| Source | Publication date | Relevant evidence | Visual coverage |
| --- | --- | --- | --- |
| Linear, *A calmer interface for a product in motion*[^1] | March 12, 2026 | Navigation hierarchy, consistent controls, restrained separators | Official sidebar comparison inspected |
| Raycast, *The New Raycast*[^2] | May 14, 2026 | Unified root search, familiar interaction surface, shared composer | Official search/hotkey image inspected |
| Raycast, *Raycast 2.0 is out of Beta!*[^3] | August 25, 2026 | Current release status; clearer error recovery and state retention | Release text |
| Raycast, *A Technical Deep Dive Into the New Raycast*[^4] | May 14, 2026 | Flicker, transitions, rendering readiness, platform conventions | Technical account; no independent timing measurement |
| Notion, *Introducing Notion Mail, a new inbox that thinks like you*[^5] | April 15, 2025 | Custom views, keyboard navigation, scheduling in context | Official animated custom-view demo inspected |
| Craft, *Sidebar customization, Reminders and 15+ other improvements*[^6] | May 4, 2026 | Optional navigation, lifecycle groups, persistent side panel | Official customization visual inspected |
| Dia, *Dia 1.14.0 for macOS*[^7] | January 14, 2026 | Context groups, countdown relevance, automatic cleanup | Release text |

## Product observations

### Linear: stable places for navigation and actions

**Published facts.** The 2026 refresh reduces the prominence of navigation, compacts desktop tabs, reduces unnecessary icon treatment, and softens separators. The article identifies controls appearing in unpredictable locations as a problem introduced by product growth.[^1]

**Visual observation.** The comparison retains the sidebar's structure while making inactive items quieter. The selected Inbox remains immediately legible. Smaller icons coexist with additional vertical spacing between groups; density is not achieved simply by shrinking everything.

**Until judgment.** Keep global navigation, current-view controls, and event actions in consistent locations. Let titles, dates, and selected content receive the strongest emphasis. Avoid turning every category, count, and secondary link into a competing outlined tile.

[Official before/after sidebar image](https://webassets.linear.app/images/ornj730p/production/b6d6be14c96978b10553cfb9205be1065087e793-3904x2720.png?auto=format&dpr=2&q=95).

### Raycast: one entrance, then the appropriate amount of interface

**Published facts.** The May redesign brings files, folders, and contacts into the same root search as commands and applications. Quick AI and longer conversations share a composer. The August release confirms v2 superseded v1 and documents more actionable errors and fixes to retained interface state.[^2][^3]

**Visual observation.** The inspected image shows a persistent query, a labeled Files group, a clear selected row, and secondary path information. The hotkey surface exposes its close action and Escape key. Compactness still leaves room to explain what will happen.

**Until judgment.** Search should find countdowns, recurring series, and saved dates from one visible entry. Separate result kinds with small labels, keep the query on screen, and disclose secondary actions after selection. Keyboard shortcuts should accelerate visible controls. Avoid making a command palette the only way to discover basic features.

[Official root-search/hotkey image](https://www.raycast.com/uploads/blog-new-raycast/new-features.png).

### Raycast's implementation account: motion quality includes the missing frames

**Published facts.** The technical article describes work to remove blank frames during expansion, prevent stale flashes when opening windows, and maintain drawing during resizing. It also describes desktop-specific conventions, including native popovers and the absence of pointer cursors on controls.[^4]

**Until judgment.** Treat a detail panel opening with its content ready as a design requirement. Preserve list position and focus when it closes. Animate meaningful changes of state, not every component on load. Until is a website, so copying desktop cursor or hover conventions would be inappropriate. A polished browser experience should retain recognizable links, visible focus, and expected Back behavior.

### Notion Mail: navigation represents purposes as well as content types

**Published facts.** The launch describes custom views that filter and sort mail around personal priorities, plus shortcuts and scheduling connected to Notion Calendar.[^5]

**Visual observation.** The inspected animation shows a persistent labeled sidebar, a highlighted Support view, and a main list divided into Unread and Read. Sender and subject occupy stable columns. Small colored icons help identify destinations without replacing their labels.

**Until judgment.** Offer useful starting views such as This week, In my region, and Saved alongside topic discovery. A purposeful view is more useful than an enormous undifferentiated catalog. Avoid requiring people to construct filters or configure a workspace before they see a compelling date.

[Official custom-view animation](https://images.ctfassets.net/spoqsaf9291f/6taJIVY0e2uRLgdLvUORxU/c8b4554349500bbb97bc4b6ef8b0caea/Mail_CustomViews_Professionals_v001.gif).

### Craft: organize by lifecycle and keep auxiliary work nearby

**Published facts.** The release adds options to hide sidebar/home sections, groups reminders into overdue, upcoming, and resolved states, hides resolved reminders initially, and allows the Mac assistant panel to stay pinned beside a document.[^6]

**Visual observation.** The customization surface separates visibility toggles from reorderable sections. Labels remain explicit; drag handles indicate which items can move. The image does not imply every destination must be customizable.

**Until judgment.** Separate upcoming saved dates from past ones and make past dates retrievable. Put date explanation, source details, and export options beside the selected event when space permits. Avoid a settings project in the first redesign: clear defaults matter before customizable navigation.

[Official sidebar customization image](https://www.craft.do/images/content/blog/craft-update-3-4-2/customize-sidebar.jpeg).

### Dia: time changes which context deserves attention

**Published facts.** Meeting tab groups collect the call and associated links, can show time remaining near the meeting's end, and become normal groups afterward with cleanup behavior. The same release expands tab search across all profile windows.[^7]

**Until judgment.** Countdown presentation should respond to relevance: Today, This week, Later, and Past are more meaningful states than identical timers attached to every item. Keep related dates and sources with their event. Avoid continually escalating visual urgency for distant or approximate dates, and do not erase saved history when an event passes.

## Recommended architecture

These proposals are an application of the evidence to Until, not descriptions of shipped reference-product features.

| Area | Adopt for Until | Avoid |
| --- | --- | --- |
| Navigation | A small persistent set: Discover, Calendar, Saved; a visible create action; a search entry in a predictable place | Listing every category as a top-level destination or rebuilding navigation on each page |
| Discovery | A short editorial selection followed by chronological groups; a visibly selected horizon and region | A hero that consumes the first screen without useful dates; fifteen annual versions competing in one results list |
| Search | Results grouped by kind; exact year intent; nearest recurring occurrence with access to other years | Sending simple lookups into separate category tools or hiding relevant date/status distinctions |
| Detail | Event title, date, countdown/state, Save, then source and calendar actions; optional adjacent preview on wide screens | Replacing the results list with an unrelated full-screen composition and losing the query or scroll position |
| Density | Consistent date/title/status columns in compact views; richer imagery where it helps discovery | A uniform giant-card grid for every result, or ultra-small text to compensate for a crowded layout |
| Progressive disclosure | Show primary action immediately; reveal sources, history, exports, and advanced creation fields when needed | Hiding core actions behind unlabeled icons; showing every technical field at once |
| Motion | Short feedback for selection, save, and panel changes; stable dimensions; reduced-motion behavior | Endless decorative movement, list reordering while reading, or count animations that imply false precision |
| Persistent context | Retain filters, query, selected event, and list position through preview and Back | Resetting a browsing session whenever a date is opened |

### First visit

The opening screen should answer three questions immediately: what is coming soon, why it might interest me, and how I keep it. A compact feature area can provide character, while a chronological stream provides utility. A visible region choice and horizon control should affect the same content area, with an understandable result count.

Until needs emotional appeal as well as search efficiency. Use event imagery and typography to make a few dates desirable; use calm rows to make many dates comparable. This hybrid is preferable to importing an enterprise issue table wholesale. The product's distinctive element should be anticipation over time, not the imitation of another app's sidebar.

### Browse to detail

Selecting an event should preserve the discovery context. On a wide screen, an adjacent detail surface could expose a larger countdown, the date's precision, short context, and Save. A clear full-page link should remain available for sharing and direct navigation. On a narrow screen, a dedicated detail page or full-height sheet can use the same content order and retain an obvious way back.

Only precise active dates should present a ticking clock. Postponed dates need a state explanation, and month/year estimates need readable uncertainty. Source attribution belongs near the explanation of the date, not in an operations dashboard. The appearance should make confidence and availability understandable without teaching the ingestion system.

### Search and saved dates

Search should feel useful before a long query is complete, but it should never move the focused result unexpectedly. Keep the active query visible, distinguish series from individual events, and make the chosen year explicit. A recurring result can show the next occurrence plus a secondary route to all dates.

Saved dates should feel like a personal timeline. Upcoming items lead; Today and date changes receive clear attention; Past remains accessible. One coherent empty state should offer discovery and creation. There is no need to require an account or setup sequence merely to demonstrate the value of keeping a date.

### Creation and motion

Begin creation with title and date, immediately show the resulting countdown, and then offer time zone, appearance, and sharing options. Users should be able to recognize and correct the date they entered before they configure presentation.

A reasonable initial motion hypothesis is approximately 140–220 ms for ordinary panel and selection transitions, with instant feedback for key navigation. Those numbers are proposed design values, not measurements of the reference apps. Verify them with real content and reduced-motion settings. A countdown's numerals should reserve stable space; second-by-second movement should be concentrated in the active detail view rather than competing across an entire catalog.

## Evaluation criteria

The redesign should be tested on tasks rather than resemblance to its references. Can someone find Halloween in a particular year, understand which occurrence is next, save it, inspect its date source, return to the same results, and export the precise date? Can they accomplish the same task on a phone and with a keyboard? Does a postponed event remain comprehensible without a misleading timer?

Compare a small number of genuinely different compositions using identical real content. Assess orientation, first useful action, retained context, readability, and perceived character. Vendor release posts establish that the reference teams invested in these patterns; they do not substitute for observing Until's own users.

## Sources

[^1]: Charlie Aufmann and Maxime Heckel, Linear. [A calmer interface for a product in motion](https://linear.app/now/behind-the-latest-design-refresh). March 12, 2026.
[^2]: Thomas Paul Mann, Raycast. [The New Raycast](https://www.raycast.com/blog/the-new-raycast). May 14, 2026. The beta status described here is superseded by source 3.
[^3]: Raycast. [Raycast 2.0 is out of Beta!](https://www.raycast.com/changelog/macos/2-0). August 25, 2026.
[^4]: Raycast. [A Technical Deep Dive Into the New Raycast](https://www.raycast.com/blog/a-technical-deep-dive-into-the-new-raycast). May 14, 2026. Used for the published account of rendering and interaction work, not current memory or performance estimates.
[^5]: Andrew Milich and Jason Ginsberg, Notion. [Introducing Notion Mail, a new inbox that thinks like you](https://www.notion.com/blog/introducing-notion-mail). April 15, 2025.
[^6]: Craft Team. [Craft update — Sidebar customization, Reminders and 15+ other improvements](https://www.craft.do/blog/craft-update-3-4-2). May 4, 2026.
[^7]: The Browser Company, Dia. [Dia 1.14.0 for macOS](https://www.diabrowser.com/changelog/mac/1-14-0). January 14, 2026.
