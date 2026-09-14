-- Upcoming lists stop showing elapsed start times. Direct event URLs remain readable.
-- All-day dates remain today through the UTC catalog day; coarse dates survive until
-- their published period ends. This helper is shared by RPCs, stats, and direct reads.
create or replace function public.event_is_upcoming(
  p_status text, p_precision text, p_starts_at timestamptz, p_starts_on date,
  p_period_end date, p_now timestamptz default now())
returns boolean language sql stable parallel safe set search_path = public as $$
  select p_status not in ('done', 'cancelled', 'retired') and case
    when p_precision = 'instant' then p_starts_at >= p_now
    when p_precision = 'day' then p_starts_on >= (p_now at time zone 'UTC')::date
    else p_period_end >= (p_now at time zone 'UTC')::date
  end;
$$;

comment on function public.event_is_upcoming(text, text, timestamptz, date, date, timestamptz) is
  'Upcoming countdown eligibility: future instants, today/future all-day dates, or an unexpired coarse period; no completed, cancelled or retired rows.';

-- Search is defined in 20260914220341_search_next_occurrences.sql, which is also
-- safe to apply independently. Keep it there so a later rollout of this migration
-- cannot restore repeated annual rows in search results.

create or replace function public.featured_upcoming(p_limit int default 5) returns setof public.events_public language sql stable set search_path = public as $$
  with future as (select * from public.events_public where featured and public.event_is_upcoming(status, date_precision, starts_at, starts_on, period_end)),
  curated as (select * from future where source = 'curated' and category <> 'history' order by sort_at, popularity desc limit p_limit),
  fallback as (select * from future where not exists (select 1 from curated) order by sort_at limit p_limit)
  select * from (select * from curated union all select * from fallback) u order by sort_at, popularity desc limit p_limit; $$;

create or replace function public.soonest_upcoming(p_limit int default 8) returns setof public.events_public language sql stable set search_path = public as $$
  select * from public.events_public where public.event_is_upcoming(status, date_precision, starts_at, starts_on, period_end) order by sort_at, popularity desc limit p_limit; $$;

create or replace function public.related_events(p_id text, p_limit int default 6) returns setof public.events_public language sql stable set search_path = public as $$
  with me as (select * from public.events where id = p_id)
  select pe.* from public.events_public pe, me
  where pe.id <> me.id and pe.starts_on >= me.starts_on and public.event_is_upcoming(pe.status, pe.date_precision, pe.starts_at, pe.starts_on, pe.period_end)
  order by ((case when pe.category = me.category then 5 else 0 end)
    + 3 * cardinality(array(select unnest(pe.tags) intersect select unnest(me.tags)))
    + (case when pe.featured then 2 else 0 end) + pe.popularity / 50.0) desc, pe.sort_at asc
  limit p_limit; $$;

create or replace function public.top_slugs(p_limit int default 500) returns table (slug text) language sql stable set search_path = public as $$
  select slug from public.events where published and public.event_is_upcoming(status, date_precision, starts_at, starts_on, period_end) order by popularity desc, sort_at limit p_limit; $$;
create or replace function public.category_counts() returns table (category text, n bigint) language sql stable set search_path = public as $$
  select category, count(*) from public.events where published and public.event_is_upcoming(status, date_precision, starts_at, starts_on, period_end) group by 1; $$;
create or replace function public.popular_tags(p_limit int default 18) returns table (tag text, n bigint) language sql stable set search_path = public as $$
  select t, count(*) from public.events, unnest(tags) t where published and public.event_is_upcoming(status, date_precision, starts_at, starts_on, period_end)
  and t not in ('wikipedia','wikidata') group by t order by 2 desc limit p_limit; $$;


create or replace view public.series_next with (security_invoker = true) as
select s.*, n.slug as next_slug, n.date as next_date, n.all_day as next_all_day, n.date_precision as next_precision,
       (n.starts_on - current_date) as days_until
from public.series s left join lateral (
  select slug, date, all_day, starts_on, date_precision from public.events
  where series_slug = s.slug and published and public.event_is_upcoming(status, date_precision, starts_at, starts_on, period_end) order by sort_at, id limit 1) n on true
where s.published;


create or replace function public.finalize_catalog() returns void language plpgsql security definer set search_path = public as $$
begin
  update public.events set status = 'done' where status not in ('done','cancelled','retired') and period_end < current_date - 1;
  update public.events e set indexable = v.next_indexable
    from (select id,
                 ((length(description) >= 80 or length(coalesce(summary, '')) >= 80) and source_url is not null and confidence >= 0.6
                  and (date_precision in ('instant','day') or status = 'tentative')
                  and status not in ('cancelled','retired') and period_end >= current_date - 365 and published
                  and series_slug is null) as next_indexable
          from public.events) v
    where v.id = e.id and e.indexable is distinct from v.next_indexable;
  with cand as (
    select regexp_replace(slug, '-[0-9]{4}-[0-9]{2}-[0-9]{2}$', '') as base, category, min(title) as title,
           count(distinct extract(year from starts_on)) as years, max(popularity) as pop
    from public.events where published and series_slug is null
      and source in ('holidays','curated','observances','astronomy','hebcal','aladhan','hindu','curiosities','openholidays')
      and regexp_replace(slug, '-[0-9]{4}-[0-9]{2}-[0-9]{2}$', '') ~ '^[a-z0-9]'
    group by 1, 2 having count(distinct extract(year from starts_on)) >= 2)
  insert into public.series (slug, title, category, popularity) select base, title, category, pop from cand on conflict (slug) do nothing;
  update public.events e set series_slug = s.slug from public.series s
    where e.series_slug is null and e.published
      and e.source in ('holidays','curated','observances','astronomy','hebcal','aladhan','hindu','curiosities','openholidays')
      and regexp_replace(e.slug, '-[0-9]{4}-[0-9]{2}-[0-9]{2}$', '') = s.slug;
  insert into public.enrichment_jobs (kind, event_id)
    select k.kind, e.id from public.events e cross join (values ('wikipedia_summary'), ('image')) k(kind)
    where e.published and public.event_is_upcoming(e.status, e.date_precision, e.starts_at, e.starts_on, e.period_end) and (e.featured or e.popularity >= 45 or e.series_slug is not null)
      and (k.kind <> 'image' or e.image_id is null) and (k.kind <> 'wikipedia_summary' or e.summary is null)
    on conflict (kind, event_id) do nothing;
  insert into public.catalog_stats (id, count, featured, series_count, by_cat, by_src, by_country, top_tags, generated_at)
  select true,
    (select count(*) from public.events where published and public.event_is_upcoming(status, date_precision, starts_at, starts_on, period_end)),
    (select count(*) from public.events where published and featured and public.event_is_upcoming(status, date_precision, starts_at, starts_on, period_end)),
    (select count(*) from public.series where published),
    coalesce((select jsonb_object_agg(category, n) from public.category_counts()), '{}'::jsonb),
    coalesce((select jsonb_object_agg(source, n) from (select source, count(*) n from public.events where published and public.event_is_upcoming(status, date_precision, starts_at, starts_on, period_end) group by 1) s), '{}'::jsonb),
    coalesce((select jsonb_object_agg(r, n) from (select r, count(*) n from public.events, unnest(regions) r where published and public.event_is_upcoming(status, date_precision, starts_at, starts_on, period_end) group by r) c), '{}'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('tag', tag, 'count', n)) from public.popular_tags(40)), '[]'::jsonb), now()
  on conflict (id) do update set count = excluded.count, featured = excluded.featured, series_count = excluded.series_count,
    by_cat = excluded.by_cat, by_src = excluded.by_src, by_country = excluded.by_country, top_tags = excluded.top_tags, generated_at = excluded.generated_at;
end $$;
grant execute on function public.finalize_catalog() to service_role;

-- Preserve the maintenance function's existing service-role-only access.
revoke execute on function public.finalize_catalog() from public, anon, authenticated;
grant execute on function public.finalize_catalog() to service_role;
