-- Run both directly after the current core migrations and after the full pending chain.
-- Fixtures and assertions are rolled back, including every dated event and alias.
begin;
set local timezone = 'UTC';

create function pg_temp.search_case(p_id text, p_title text, p_day date,
  p_series text default null, p_regions text[] default array['GLOBAL']) returns void
language sql as $$
  insert into public.events (id, slug, title, date, all_day, date_precision, category,
    source, source_url, source_key, series_slug, regions, tags, popularity, description)
  values (p_id, p_id, p_title, p_day::text, true, 'day', 'culture', 'curated',
    'https://example.com/calendar', 'curated:' || p_id, p_series, p_regions,
    array['verify-recurrence'], 50, 'Independent SQL fixture for recurring countdown search.');
$$;

insert into public.series (slug, title, category) values
  ('verify-search-halloween', 'Halloween', 'culture'),
  ('verify-search-mothers', 'Mother''s Day', 'culture');

do $$
declare y int := extract(year from now())::int + 1;
begin
  for offset_year in 0..14 loop
    perform pg_temp.search_case('verify-search-halloween-' || offset_year, 'Halloween',
      make_date(y + offset_year, 10, 31), 'verify-search-halloween');
  end loop;
  -- Filters must be applied before choosing the next matching occurrence.
  update public.events set popularity = 10 where id = 'verify-search-halloween-0';
  update public.events set featured = true, tags = tags || array['later-only']
    where id = 'verify-search-halloween-1';
  update public.events set category = 'holidays' where id = 'verify-search-halloween-2';
  perform pg_temp.search_case('verify-search-mothers-us-0', 'Mother''s Day', make_date(y, 5, 10),
    'verify-search-mothers', array['US', 'CA']);
  perform pg_temp.search_case('verify-search-mothers-us-1', 'Mother''s Day', make_date(y + 1, 5, 9),
    'verify-search-mothers', array['CA', 'US', 'US']);
  perform pg_temp.search_case('verify-search-mothers-gb-0', 'Mother''s Day', make_date(y, 3, 10),
    'verify-search-mothers', array['GB']);
  perform pg_temp.search_case('verify-search-mothers-gb-1', 'Mother''s Day', make_date(y + 1, 3, 15),
    'verify-search-mothers', array['GB']);
  perform pg_temp.search_case('verify-search-single-0', 'Halloween reunion', make_date(y, 10, 30));
  perform pg_temp.search_case('verify-search-single-1', 'Halloween reunion', make_date(y + 1, 10, 30));
  perform pg_temp.search_case('verify-search-gta', 'Grand Theft Auto VI', make_date(y, 11, 1));
  perform pg_temp.search_case('verify-search-cancelled', 'Halloween', make_date(y, 1, 1), 'verify-search-halloween');
  update public.events set status = 'cancelled' where id = 'verify-search-cancelled';
  perform pg_temp.search_case('verify-search-past', 'Halloween', (now() - interval '1 day')::date, 'verify-search-halloween');
end $$;
insert into public.event_slugs (slug, event_id) values ('verify-search-old-link', 'verify-search-halloween-14');

do $$
declare
  n int;
  ids text[];
  y int := extract(year from now())::int + 1;
begin
  select array_agg(event->>'id') into ids
    from public.search_events(p_q => 'halloween', p_tag => 'verify-recurrence', p_page_size => 100);
  if cardinality(ids) <> 3 or not ids @> array['verify-search-halloween-0', 'verify-search-single-0', 'verify-search-single-1'] then
    raise exception 'search must keep next series occurrence and both independent events: %', ids;
  end if;
  select count(*) into n from public.search_events(p_q => 'halloween', p_tag => 'verify-recurrence', p_page_size => 100) where total = 3;
  if n <> 3 then raise exception 'search total counts annual rows instead of representatives'; end if;
  select array_agg(event->>'id') into ids
    from public.search_events(p_q => 'halloween', p_tag => 'verify-recurrence', p_page_size => 1, p_page => 2);
  if cardinality(ids) <> 1 or ids[1] = 'verify-search-halloween-0' then
    raise exception 'pagination repeated the selected series occurrence: %', ids;
  end if;

  select count(*) into n from public.search_events(p_tag => 'verify-recurrence', p_page_size => 100) where total = 6;
  if n <> 6 then raise exception 'browse must group before totals/pagination'; end if;
  select count(*) into n from public.search_events(p_q => '!!!', p_tag => 'verify-recurrence', p_page_size => 100) where total = 6;
  if n <> 6 then raise exception 'punctuation-only browse regressed'; end if;
  select count(*) into n from public.search_events(p_tag => 'verify-recurrence', p_page_size => 2, p_page => 3) where total = 6;
  if n <> 2 then raise exception 'browse pagination has missing or extra rows'; end if;

  select array_agg(event->>'id') into ids from public.search_events(p_q => 'mother', p_tag => 'verify-recurrence');
  if cardinality(ids) <> 2 or not ids @> array['verify-search-mothers-us-0', 'verify-search-mothers-gb-0'] then
    raise exception 'different countries/dates must survive, region array order must not duplicate: %', ids;
  end if;
  select array_agg(event->>'id') into ids from public.search_events(p_q => 'mother', p_tag => 'verify-recurrence', p_region => 'gb');
  if ids is distinct from array['verify-search-mothers-gb-0'] then raise exception 'country filter regressed: %', ids; end if;

  select array_agg(event->>'id') into ids from public.search_events(p_q => 'halloween', p_tag => 'later-only');
  if ids is distinct from array['verify-search-halloween-1'] then raise exception 'tag filter ran after grouping: %', ids; end if;
  select array_agg(event->>'id') into ids from public.search_events(p_q => 'halloween', p_tag => 'verify-recurrence', p_featured => true);
  if ids is distinct from array['verify-search-halloween-1'] then raise exception 'featured filter ran after grouping: %', ids; end if;
  select array_agg(event->>'id') into ids from public.search_events(p_q => 'halloween', p_tag => 'verify-recurrence', p_category => 'holidays');
  if ids is distinct from array['verify-search-halloween-2'] then raise exception 'category filter ran after grouping: %', ids; end if;
  select count(*) into n from public.search_events(p_q => 'halloween', p_tag => 'verify-recurrence', p_min_popularity => 20)
    where event->>'id' = 'verify-search-halloween-1';
  if n <> 1 then raise exception 'popularity filter ran after grouping'; end if;
  select count(*) into n from public.search_events(p_q => 'halloween', p_tag => 'verify-recurrence', p_sort => 'popular')
    where event->>'id' = 'verify-search-halloween-0';
  if n <> 1 then raise exception 'popular sort picked a more popular later occurrence'; end if;
  select count(*) into n from public.search_events(p_q => 'halloween', p_tag => 'verify-recurrence', p_sort => 'latest')
    where event->>'id' = 'verify-search-halloween-0';
  if n <> 1 then raise exception 'latest sort picked the final year of a series'; end if;

  select array_agg(event->>'id') into ids from public.search_events(p_q => 'Halloween ' || (y + 4), p_tag => 'verify-recurrence');
  if ids is distinct from array['verify-search-halloween-4'] then raise exception 'explicit occurrence year was ignored: %', ids; end if;
  select array_agg(event->>'id') into ids from public.search_events(p_q => (y + 4)::text, p_tag => 'verify-recurrence');
  if ids is distinct from array['verify-search-halloween-4'] then raise exception 'year-only search failed: %', ids; end if;
  select count(*) into n from public.search_events(p_q => 'halloween ' || (y + 50), p_tag => 'verify-recurrence');
  if n <> 0 then raise exception 'fuzzy title match leaked into an unrelated year'; end if;
  select count(*) into n from public.search_events(p_q => 'haloween ' || (y + 4), p_tag => 'verify-recurrence');
  if n <> 1 then raise exception 'fuzzy title plus year search regressed'; end if;
  select array_agg(event->>'id') into ids from public.search_events(p_q => 'gta vi', p_tag => 'verify-recurrence');
  if ids is distinct from array['verify-search-gta'] then raise exception 'initials plus tail search regressed: %', ids; end if;

  -- A title's literal year can be an edition/product name, not its scheduled date.
  perform pg_temp.search_case('verify-search-windows', 'Windows 2000 end of support', make_date(y + 6, 1, 1));
  perform pg_temp.search_case('verify-search-odyssey', '2001: A Space Odyssey screening', make_date(y + 7, 1, 1));
  perform pg_temp.search_case('verify-search-number-boundary', 'Windows 20000 support', make_date(y + 6, 1, 1));
  select array_agg(event->>'id') into ids from public.search_events(p_q => 'windows 2000', p_tag => 'verify-recurrence');
  if ids is distinct from array['verify-search-windows'] then raise exception 'literal product year or whole-word boundary regressed: %', ids; end if;
  select array_agg(event->>'id') into ids from public.search_events(p_q => '2001 space odyssey', p_tag => 'verify-recurrence');
  if ids is distinct from array['verify-search-odyssey'] then raise exception 'literal movie title year regressed: %', ids; end if;

  select count(*) into n from public.events_public where series_slug = 'verify-search-halloween' and status = 'scheduled';
  if n <> 16 then raise exception 'search removed dated or past event pages'; end if;
  if (select event_id from public.event_slugs where slug = 'verify-search-old-link') <> 'verify-search-halloween-14' then
    raise exception 'search changed a permalink alias';
  end if;
  if not has_function_privilege('anon', 'public.search_events(text,text,text,text,boolean,text[],text,int,int,int)', 'EXECUTE') then
    raise exception 'anonymous search permission was lost';
  end if;
  raise notice 'Recurring search, explicit years, regional variants, filters, pagination, relevance and permalink assertions passed.';
end $$;

-- Also exercise the exact anonymous role used by the website.
set local role anon;
select count(*) from public.search_events(p_q => 'halloween', p_tag => 'verify-recurrence');
reset role;
rollback;
