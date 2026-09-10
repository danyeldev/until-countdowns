-- 0005_precision.sql: coarse date precision (month/quarter/year/decade) must not make an event "past" on its placeholder date.
-- period_end = last day the event can still happen; sort_at = when it sorts among upcoming events.
alter table public.events add column if not exists period_end date, add column if not exists sort_at timestamptz;

create or replace function public.period_end_for(p_starts_on date, p_end_date text, p_precision text) returns date
language sql immutable parallel safe set search_path = public as $$
  select coalesce(
    case when p_end_date is not null then left(p_end_date, 10)::date end,
    case p_precision
      when 'month'   then (date_trunc('month',   p_starts_on::timestamp) + interval '1 month'  - interval '1 day')::date
      when 'quarter' then (date_trunc('quarter', p_starts_on::timestamp) + interval '3 month'  - interval '1 day')::date
      when 'year'    then (date_trunc('year',    p_starts_on::timestamp) + interval '1 year'   - interval '1 day')::date
      when 'decade'  then (date_trunc('year',    p_starts_on::timestamp) + interval '10 year'  - interval '1 day')::date
      else p_starts_on end)
$$;

create or replace function public.events_before_write() returns trigger language plpgsql set search_path = public as $$
begin
  if position('T' in new.date) > 0 then new.starts_at := new.date::timestamptz;
  else new.starts_at := (new.date || 'T00:00:00Z')::timestamptz; end if;
  new.starts_on := left(new.date, 10)::date;
  new.period_end := public.period_end_for(new.starts_on, new.end_date, new.date_precision);
  new.sort_at := case when new.date_precision in ('instant', 'day') then new.starts_at
                      else greatest(new.starts_at, (new.period_end::text || 'T00:00:00Z')::timestamptz - interval '1 day') end;
  if tg_op = 'INSERT' then new.id := coalesce(new.id, new.slug);
  else
    if new.date is distinct from old.date then
      new.date_history := old.date_history || jsonb_build_object('date', old.date, 'changed_at', now(), 'source', new.source);
    end if;
    if (to_jsonb(new) - 'last_seen_at' - 'updated_at' - 'search' - 'period_end' - 'sort_at')
       is distinct from (to_jsonb(old) - 'last_seen_at' - 'updated_at' - 'search' - 'period_end' - 'sort_at')
    then new.updated_at := now(); end if;
  end if;
  return new;
end $$;

update public.events set date = date;   -- backfill via trigger (no-op when empty)
alter table public.events alter column period_end set not null, alter column sort_at set not null;
create index if not exists events_sort_at_idx on public.events (sort_at) where published;
create index if not exists events_category_sort_idx on public.events (category, sort_at) where published;

-- view: expose the new columns (appended at the end so dependent functions stay valid)
create or replace view public.events_public with (security_invoker = true) as
select e.id, e.slug, e.title, e.description, e.summary, e.date, e.end_date, e.all_day, e.timezone, e.starts_on, e.starts_at,
       e.category, e.tags, e.regions, e.source, src.label as source_label, e.source_url, e.external_ids, e.status, e.date_precision,
       e.date_history, e.featured, e.popularity, e.series_slug, s.title as series_title, e.location, e.jsonld_eligible, e.indexable,
       e.last_seen_at, e.updated_at,
       case when e.all_day then (e.starts_on - current_date) else floor(extract(epoch from (e.starts_at - now())) / 86400)::int end as days_until,
       case when i.id is null then null else jsonb_build_object('url', i.public_url, 'width', i.width, 'height', i.height,
         'thumbhash', i.thumbhash, 'color', i.dominant_color, 'credit', i.credit, 'author', i.author, 'license', i.license,
         'licenseUrl', i.license_url, 'originPage', i.origin_page, 'provider', i.provider) end as image,
       e.period_end, e.sort_at
from public.events e
left join public.series s on s.slug = e.series_slug
left join public.images i on i.id = e.image_id
left join public.sources src on src.id = e.source
where e.published;

-- reads now use sort_at (period-aware) instead of starts_at
create or replace function public.search_events(
  p_q text default null, p_category text default null, p_tag text default null, p_region text default null,
  p_featured boolean default false, p_region_codes text[] default '{}', p_sort text default 'soonest',
  p_min_popularity int default 0, p_page int default 1, p_page_size int default 24)
returns table (event jsonb, score int, total bigint) language sql stable set search_path = public as $$
  with q as (select nullif(lower(trim(coalesce(p_q, ''))), '') as needle),
  scored as (
    select pe, case
      when q.needle is null then 1
      when lower(pe.title) = q.needle then 100
      when lower(pe.title) like q.needle || '%' then 80
      when lower(pe.title) like '%' || q.needle || '%' then 60
      when exists (select 1 from unnest(pe.tags) t where t like '%' || q.needle || '%') then 40
      when e.search @@ plainto_tsquery('simple', q.needle) then 30
      when lower(pe.description) like '%' || q.needle || '%' then 25
      when pe.regions && p_region_codes or exists (select 1 from unnest(pe.regions) r where lower(r) = q.needle) then 20
      else 0 end as score
    from public.events_public pe join public.events e on e.id = pe.id, q
    where pe.sort_at > now() - interval '2 days'
      and (p_category is null or pe.category = p_category)
      and (p_tag is null or pe.tags @> array[p_tag])
      and (p_region is null or pe.regions @> array[upper(p_region)] or pe.regions @> array['GLOBAL'])
      and (not p_featured or pe.featured) and pe.popularity >= p_min_popularity)
  select to_jsonb(pe) as event, score, count(*) over () as total from scored where score > 0
  order by case when p_sort = 'popular' then (pe).popularity end desc nulls last,
           case when p_sort = 'latest' then (pe).sort_at end desc nulls last,
           case when p_sort not in ('popular','latest') then ((pe).sort_at < now() - interval '12 hours') end asc,
           case when p_sort not in ('popular','latest') then score end desc,
           (pe).sort_at asc
  limit greatest(1, least(p_page_size, 100)) offset (greatest(p_page, 1) - 1) * greatest(1, least(p_page_size, 100));
$$;

create or replace function public.featured_upcoming(p_limit int default 5) returns setof public.events_public language sql stable set search_path = public as $$
  with future as (select * from public.events_public where featured and sort_at > now() - interval '6 hours'),
  curated as (select * from future where source = 'curated' and category <> 'history' order by sort_at, popularity desc limit p_limit),
  fallback as (select * from future where not exists (select 1 from curated) order by sort_at limit p_limit)
  select * from (select * from curated union all select * from fallback) u order by sort_at, popularity desc limit p_limit; $$;

create or replace function public.soonest_upcoming(p_limit int default 8) returns setof public.events_public language sql stable set search_path = public as $$
  select * from public.events_public where sort_at > now() - interval '6 hours' order by sort_at, popularity desc limit p_limit; $$;

create or replace function public.related_events(p_id text, p_limit int default 6) returns setof public.events_public language sql stable set search_path = public as $$
  with me as (select * from public.events where id = p_id)
  select pe.* from public.events_public pe, me
  where pe.id <> me.id and pe.starts_on >= me.starts_on and pe.sort_at > now()
  order by ((case when pe.category = me.category then 5 else 0 end)
    + 3 * cardinality(array(select unnest(pe.tags) intersect select unnest(me.tags)))
    + (case when pe.featured then 2 else 0 end) + pe.popularity / 50.0) desc, pe.sort_at asc
  limit p_limit; $$;

create or replace function public.top_slugs(p_limit int default 500) returns table (slug text) language sql stable set search_path = public as $$
  select slug from public.events where published and sort_at > now() order by popularity desc, sort_at limit p_limit; $$;
create or replace function public.category_counts() returns table (category text, n bigint) language sql stable set search_path = public as $$
  select category, count(*) from public.events where published and sort_at > now() - interval '2 days' group by 1; $$;
create or replace function public.popular_tags(p_limit int default 18) returns table (tag text, n bigint) language sql stable set search_path = public as $$
  select t, count(*) from public.events, unnest(tags) t where published and sort_at > now() - interval '2 days'
  and t not in ('wikipedia','wikidata') group by t order by 2 desc limit p_limit; $$;

create or replace function public.finalize_catalog() returns void language plpgsql security definer set search_path = public as $$
begin
  update public.events set status = 'done' where status not in ('done','cancelled','retired') and period_end < current_date - 1;
  update public.events set indexable =
      length(description) >= 80 and source_url is not null and confidence >= 0.6
      and (date_precision in ('instant','day') or status = 'tentative')
      and status not in ('cancelled','retired') and period_end >= current_date - 365 and published
      and series_slug is null;
  with cand as (
    select regexp_replace(slug, '-[0-9]{4}-[0-9]{2}-[0-9]{2}$', '') as base, category, min(title) as title,
           count(distinct extract(year from starts_on)) as years, max(popularity) as pop
    from public.events where published and series_slug is null and source in ('holidays','curated','observances','astronomy','hebcal','aladhan')
    group by 1, 2 having count(distinct extract(year from starts_on)) >= 2)
  insert into public.series (slug, title, category, popularity) select base, title, category, pop from cand on conflict (slug) do nothing;
  update public.events e set series_slug = s.slug from public.series s
    where e.series_slug is null and e.published and e.source in ('holidays','curated','observances','astronomy','hebcal','aladhan')
      and regexp_replace(e.slug, '-[0-9]{4}-[0-9]{2}-[0-9]{2}$', '') = s.slug;
  insert into public.enrichment_jobs (kind, event_id)
    select k.kind, e.id from public.events e cross join (values ('wikipedia_summary'), ('image')) k(kind)
    where e.published and e.sort_at > now() and (e.featured or e.popularity >= 45 or e.series_slug is not null)
      and (k.kind <> 'image' or e.image_id is null) and (k.kind <> 'wikipedia_summary' or e.summary is null)
    on conflict (kind, event_id) do nothing;
  insert into public.catalog_stats (id, count, featured, series_count, by_cat, by_src, by_country, top_tags, generated_at)
  select true,
    (select count(*) from public.events where published and sort_at > now() - interval '2 days'),
    (select count(*) from public.events where published and featured and sort_at > now() - interval '2 days'),
    (select count(*) from public.series where published),
    coalesce((select jsonb_object_agg(category, n) from public.category_counts()), '{}'::jsonb),
    coalesce((select jsonb_object_agg(source, n) from (select source, count(*) n from public.events where published and sort_at > now() - interval '2 days' group by 1) s), '{}'::jsonb),
    coalesce((select jsonb_object_agg(r, n) from (select r, count(*) n from public.events, unnest(regions) r where published and sort_at > now() - interval '2 days' group by r) c), '{}'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('tag', tag, 'count', n)) from public.popular_tags(40)), '[]'::jsonb), now()
  on conflict (id) do update set count = excluded.count, featured = excluded.featured, series_count = excluded.series_count,
    by_cat = excluded.by_cat, by_src = excluded.by_src, by_country = excluded.by_country, top_tags = excluded.top_tags, generated_at = excluded.generated_at;
end $$;

create or replace function public.mark_stale_records(p_source text, p_pass_started timestamptz) returns int language sql set search_path = public as $$
  with u as (update public.events e set status = case when e.status = 'scheduled' then 'tentative' else e.status end, featured = false
    from public.event_sources es where es.event_id = e.id and es.source = p_source and e.source = p_source
      and es.last_seen_at < p_pass_started and e.sort_at > now() returning 1)
  select count(*)::int from u; $$;

grant execute on all functions in schema public to service_role;
revoke execute on function public.period_end_for(date, text, text) from public, anon, authenticated;
