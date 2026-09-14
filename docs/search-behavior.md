# Recurring search results

The Halloween report was caused by search displaying fifteen legitimate annual occurrences, 2026–2040, as fifteen cards. The live audit found one row per year, with no duplicate published title/date or series/date groups. Those annual rows support dated URLs, saved countdowns and the full recurring-event calendar.

`search_events` now filters first, selects the earliest matching occurrence per series and normalized country set, then counts and paginates. Unlinked events stay independent. Country variants keep separate representatives, and Popular/Furthest sorting does not replace the chosen next occurrence with a later year.

Full calendar-year words are understood as date filters, so `Halloween 2030` and `haloween 2030` find that date. Literal years in titles, such as Windows 2000, still match. Existing prefix, initials and typo matching remain supported.

Search cards expose a native **More years** disclosure with up to four later date links and an **All dates** link to the recurring page. Preview dates use a bounded batch read, keep the same regional scope, and begin after the displayed occurrence. All dates remains available when the preview has no further rows.

## Applied change and verification

`20260914220341_search_next_occurrences.sql` was applied to the connected `until` database on September 14, 2026. Its filename matches the version recorded by Supabase. The three earlier rebuild migrations remain pending; the pending upcoming migration no longer replaces the search function, so applying it later cannot undo this fix.

After application, `halloween` returns one Halloween card and two distinct upcoming television premieres. `Halloween 2030` returns the 2030 occurrence. The database still contains all 15 Halloween years and all 15,766 event records observed before the change.

SQL regression checks cover both a complete fresh migration chain and the deployed core plus this search migration alone. They exercise grouping, pagination totals, regional variants, filters, explicit years, literal title years, anonymous access and preserved date links. JavaScript checks cover ordered/bounded future previews, regional scope, duplicate dates and closed events.
