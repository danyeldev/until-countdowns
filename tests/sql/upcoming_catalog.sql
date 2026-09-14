-- Execute after the catalog migrations in a disposable local database.
-- Every mutation is rolled back; SQL errors make psql exit nonzero.
begin;
set local timezone = 'UTC';

create function pg_temp.catalog_case(p_id text, p_title text, p_at timestamptz,
  p_precision text default 'instant', p_status text default 'scheduled') returns void
language plpgsql as $$
begin
  insert into public.events (id, slug, title, date, all_day, date_precision, category,
    source, source_url, source_key, status, featured, popularity, tags, description)
  values (p_id, p_id, p_title,
    case when p_precision = 'instant' then to_char(p_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
      else to_char(p_at, 'YYYY-MM-DD') end,
    p_precision <> 'instant', p_precision, 'sports', 'curated', 'https://example.com/schedule',
    'curated:' || p_id, p_status, true, 65, array['verification'],
    'A published schedule used to verify that countdown listings preserve their date precision and only show upcoming events.');
end $$;

select pg_temp.catalog_case('verify-expired', 'Pilot premiere past', now() - interval '1 hour');
select pg_temp.catalog_case('verify-future', 'Pilot premiere future', now() + interval '1 hour');
select pg_temp.catalog_case('verify-today', 'Today all-day event', now(), 'day');
select pg_temp.catalog_case('verify-yesterday', 'Yesterday all-day event', now() - interval '1 day', 'day');
select pg_temp.catalog_case('verify-coarse', 'Expected this year', date_trunc('year', now()), 'year', 'tentative');
select pg_temp.catalog_case('verify-old-coarse', 'Expected last year', date_trunc('year', now()) - interval '1 year', 'year', 'tentative');
select pg_temp.catalog_case('verify-cancelled', 'Cancelled future event', now() + interval '1 day', 'instant', 'cancelled');
select pg_temp.catalog_case('verify-done', 'Completed future event', now() + interval '1 day', 'instant', 'done');
select pg_temp.catalog_case('verify-retired', 'Retired future event', now() + interval '1 day', 'instant', 'retired');
select pg_temp.catalog_case('verify-postponed', 'Postponed future event', now() + interval '1 day', 'instant', 'postponed');
select pg_temp.catalog_case('verify-gta', 'Grand Theft Auto VI', now() + interval '3 days');
select pg_temp.catalog_case('verify-halloween', 'Halloween', now() + interval '5 days', 'day');

insert into public.series (slug, title, category) values ('verify-series', 'Pilot premieres', 'sports');
update public.events set series_slug = 'verify-series' where id in ('verify-expired', 'verify-future');

do $$
declare
  n int;
  ids text[];
begin
  select count(*) into n from public.search_events(p_page_size => 100);
  if n <> 6 then raise exception 'browse: expected 6 upcoming rows, got %', n; end if;
  select array_agg(event->>'id') into ids from public.search_events(p_page_size => 100);
  if not ids @> array['verify-today', 'verify-coarse', 'verify-future', 'verify-postponed'] then
    raise exception 'browse lost today, coarse precision, postponed or future rows: %', ids;
  end if;
  if ids && array['verify-expired', 'verify-yesterday', 'verify-old-coarse', 'verify-cancelled', 'verify-done', 'verify-retired'] then
    raise exception 'browse includes expired/closed rows: %', ids;
  end if;

  select count(*) into n from public.search_events(p_q => 'pilot');
  if n <> 1 then raise exception 'text search includes an expired premiere'; end if;
  select count(*) into n from public.search_events(p_q => 'gta vi');
  if n <> 1 then raise exception 'acronym + tail search regressed'; end if;
  select count(*) into n from public.search_events(p_q => 'haloween');
  if n <> 1 then raise exception 'fuzzy search regressed'; end if;
  select count(*) into n from public.search_events(p_q => '!!!', p_page_size => 100);
  if n <> 6 then raise exception 'punctuation browse does not use upcoming policy'; end if;
  select count(*) into n from public.search_events(p_page => 2, p_page_size => 2) where total = 6;
  if n <> 2 then raise exception 'pagination totals regressed'; end if;

  select count(*) into n from public.featured_upcoming(100);
  if n <> 6 then raise exception 'featured listing disagrees with browse'; end if;
  select count(*) into n from public.soonest_upcoming(100);
  if n <> 6 then raise exception 'soonest listing disagrees with browse'; end if;
  select count(*) into n from public.top_slugs(100);
  if n <> 6 then raise exception 'top slugs disagree with browse'; end if;
  select sum(c.n) into n from public.category_counts() c;
  if n <> 6 then raise exception 'category counts include elapsed events'; end if;
  select t.n into n from public.popular_tags(100) t where t.tag = 'verification';
  if n <> 6 then raise exception 'tag counts include elapsed events'; end if;
  if exists (select 1 from public.related_events('verify-expired', 100) where status in ('done','cancelled','retired') or id = 'verify-yesterday') then
    raise exception 'related events include elapsed/closed events';
  end if;
  if (select next_slug from public.series_next where slug = 'verify-series') <> 'verify-future' then
    raise exception 'series next still chooses the elapsed premiere';
  end if;

  -- Permalinks remain readable; browsing eligibility never changes publication.
  if not exists (select 1 from public.events_public where id = 'verify-expired') then
    raise exception 'past event permalink was removed';
  end if;

  perform public.finalize_catalog();
  select count into n from public.catalog_stats where id;
  if n <> 6 then raise exception 'finalize stats disagree with browse: %', n; end if;
  if (select (by_src->>'curated')::int from public.catalog_stats where id) <> 6 then
    raise exception 'source stats disagree with browse';
  end if;
  if (select (by_country->>'GLOBAL')::int from public.catalog_stats where id) <> 6 then
    raise exception 'country stats disagree with browse';
  end if;
  if has_function_privilege('anon', 'public.finalize_catalog()', 'EXECUTE') then
    raise exception 'anonymous users can invoke maintenance';
  end if;

  if public.event_is_upcoming('scheduled', 'instant', '2026-09-14T12:00:00Z', '2026-09-14', '2026-09-14', '2026-09-14T12:00:00Z') is not true then
    raise exception 'exact start boundary should remain upcoming';
  end if;
  if public.event_is_upcoming('tentative', 'month', '2026-09-01T00:00:00Z', '2026-09-01', '2026-09-30', '2026-09-30T23:59:59Z') is not true then
    raise exception 'coarse dates must survive their final day';
  end if;
  if public.event_is_upcoming('tentative', 'month', '2026-09-01T00:00:00Z', '2026-09-01', '2026-09-30', '2026-10-01T00:00:00Z') is not false then
    raise exception 'coarse dates must expire after their final day';
  end if;

  if not exists (select 1 from public.sources where id = 'f1calendar' and rank = 6 and license = 'MIT') then
    raise exception 'F1Calendar source registration missing';
  end if;
  raise notice 'Upcoming catalog regression checks passed (browse, search, pagination, related, series, stats, permissions, boundaries).';
end $$;
rollback;
