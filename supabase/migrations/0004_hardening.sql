-- 0004_hardening.sql: pin search_path on every function (advisor 0011) and index the remaining foreign keys (advisor 0001)
alter function public.tags_text(text[]) set search_path = public;
alter function public.source_rank(text) set search_path = public;
alter function public.events_before_write() set search_path = public;
alter function public.search_events(text, text, text, text, boolean, text[], text, int, int, int) set search_path = public;
alter function public.featured_upcoming(int) set search_path = public;
alter function public.soonest_upcoming(int) set search_path = public;
alter function public.related_events(text, int) set search_path = public;
alter function public.top_slugs(int) set search_path = public;
alter function public.category_counts() set search_path = public;
alter function public.popular_tags(int) set search_path = public;
alter function public.acquire_source_lease(text, interval) set search_path = public;
alter function public.release_source_lease(text, uuid) set search_path = public;
alter function public.mark_stale_records(text, timestamptz) set search_path = public;
alter function public.claim_enrichment_jobs(text, int) set search_path = public;

create index if not exists enrichment_jobs_event_idx on public.enrichment_jobs (event_id);
create index if not exists event_slugs_event_idx on public.event_slugs (event_id);
create index if not exists event_sources_source_idx on public.event_sources (source);
create index if not exists events_image_idx on public.events (image_id) where image_id is not null;
create index if not exists events_source_idx on public.events (source);
create index if not exists series_category_idx on public.series (category);
create index if not exists series_image_idx on public.series (image_id) where image_id is not null;
create index if not exists series_aliases_series_idx on public.series_aliases (series_slug);
