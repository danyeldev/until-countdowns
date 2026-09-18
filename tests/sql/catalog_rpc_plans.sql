-- Indexed catalog RPCs must complete well under the 3s anon statement_timeout.
-- Empty-catalog plans still exercise the function bodies after the upcoming_until rewrite.
\timing on
select count(*) from public.featured_upcoming(8);
select count(*) from (select * from public.series_next limit 8) series_next;
select count(*) from public.search_events(null, null, null, null, false, '{}', 'soonest', 0, 1, 12);
select count(*) from public.related_events('00000000-0000-0000-0000-000000000001', 6);
