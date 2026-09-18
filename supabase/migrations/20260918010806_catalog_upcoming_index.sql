-- Persist upcoming eligibility and region grouping so catalog RPCs can use
-- indexes instead of scanning events_public and computing CASE/now() per row.

create or replace function public.upcoming_until_for(
  p_precision text, p_starts_at timestamptz, p_starts_on date, p_period_end date)
returns timestamptz
language sql immutable parallel safe set search_path = public as $$
  -- Exclusive end: upcoming while upcoming_until > now(). Instant keeps the
  -- exact start instant by advancing one microsecond.
  select case
    when p_precision = 'instant' then p_starts_at + interval '1 microsecond'
    when p_precision = 'day' then ((p_starts_on + 1)::timestamp at time zone 'UTC')
    else ((coalesce(p_period_end, p_starts_on) + 1)::timestamp at time zone 'UTC')
  end;
$$;

create or replace function public.region_key_for(p text[])
returns text
language sql immutable parallel safe set search_path = public as $$
  select coalesce(
    array_to_string(
      array(
        select distinct upper(r)
        from unnest(coalesce(p, '{}'::text[])) r
        where btrim(r) <> ''
        order by 1
      ),
      ','),
    '');
$$;

create or replace function public.event_days_until(
  p_all_day boolean, p_starts_on date, p_starts_at timestamptz)
returns integer
language sql stable parallel safe set search_path = public as $$
  select case
    when p_all_day then (p_starts_on - current_date)
    else floor(extract(epoch from (p_starts_at - now())) / 86400)::int
  end;
$$;

alter table public.events
  add column if not exists upcoming_until timestamptz,
  add column if not exists region_key text generated always as (public.region_key_for(regions)) stored;

create or replace function public.events_before_write() returns trigger
language plpgsql set search_path to 'public' as $function$
begin
  if position('T' in new.date) > 0 then new.starts_at := new.date::timestamptz;
  else new.starts_at := (new.date || 'T00:00:00Z')::timestamptz; end if;

  if position('T' in new.date) > 0 and new.timezone is not null then
    begin
      new.starts_on := (new.starts_at at time zone new.timezone)::date;
    exception when others then
      new.starts_on := left(new.date, 10)::date;
    end;
  else
    new.starts_on := left(new.date, 10)::date;
  end if;

  new.period_end := public.period_end_for(new.starts_on, new.end_date, new.date_precision);
  new.sort_at := case when new.date_precision in ('instant', 'day') then new.starts_at
                      else greatest(new.starts_at, (new.period_end::text || 'T00:00:00Z')::timestamptz - interval '1 day') end;
  new.upcoming_until := public.upcoming_until_for(
    new.date_precision, new.starts_at, new.starts_on, new.period_end);
  if tg_op = 'INSERT' then new.id := coalesce(new.id, new.slug);
  else
    if new.date is distinct from old.date then
      new.date_history := old.date_history || jsonb_build_object('date', old.date, 'changed_at', now(), 'source', new.source);
    end if;
    if (to_jsonb(new) - 'last_seen_at' - 'updated_at' - 'search' - 'period_end' - 'sort_at' - 'upcoming_until' - 'region_key')
       is distinct from (to_jsonb(old) - 'last_seen_at' - 'updated_at' - 'search' - 'period_end' - 'sort_at' - 'upcoming_until' - 'region_key')
    then new.updated_at := now(); end if;
  end if;
  return new;
end $function$;

update public.events set date = date;
alter table public.events alter column upcoming_until set not null;

create or replace function public.event_is_upcoming(
  p_status text, p_precision text, p_starts_at timestamptz, p_starts_on date,
  p_period_end date, p_now timestamptz default now())
returns boolean language sql immutable parallel safe set search_path = public as $$
  select p_status not in ('done', 'cancelled', 'retired')
    and public.upcoming_until_for(p_precision, p_starts_at, p_starts_on, p_period_end) > p_now;
$$;

comment on function public.event_is_upcoming(text, text, timestamptz, date, date, timestamptz) is
  'Upcoming countdown eligibility from raw date fields. Listings should filter upcoming_until > now() so the partial indexes apply.';

create index if not exists events_upcoming_until_idx
  on public.events (upcoming_until)
  where published;
create index if not exists events_upcoming_sort_idx
  on public.events (sort_at, id)
  where published and status not in ('done', 'cancelled', 'retired');
create index if not exists events_upcoming_category_sort_idx
  on public.events (category, sort_at)
  where published and status not in ('done', 'cancelled', 'retired');
create index if not exists events_upcoming_series_sort_idx
  on public.events (series_slug, sort_at, id)
  where published and status not in ('done', 'cancelled', 'retired');
create index if not exists events_upcoming_starts_on_idx
  on public.events (starts_on)
  where published and status not in ('done', 'cancelled', 'retired');
create index if not exists events_upcoming_group_idx
  on public.events (coalesce(series_slug, id), region_key, sort_at)
  where published and status not in ('done', 'cancelled', 'retired');
create index if not exists event_hype_points_idx
  on public.event_hype (points desc);

create or replace view public.events_public with (security_invoker = true) as
select e.id, e.slug, e.title, e.description, e.summary, e.date, e.end_date, e.all_day, e.timezone, e.starts_on, e.starts_at,
       e.category, e.tags, e.regions, e.source, src.label as source_label, e.source_url, e.external_ids, e.status, e.date_precision,
       e.date_history, e.featured, e.popularity, e.series_slug, s.title as series_title, e.location, e.jsonld_eligible, e.indexable,
       e.last_seen_at, e.updated_at,
       public.event_days_until(e.all_day, e.starts_on, e.starts_at) as days_until,
       case when i.id is null then null else jsonb_build_object('url', i.public_url, 'width', i.width, 'height', i.height,
         'thumbhash', i.thumbhash, 'color', i.dominant_color, 'credit', i.credit, 'author', i.author, 'license', i.license,
         'licenseUrl', i.license_url, 'originPage', i.origin_page, 'provider', i.provider) end as image,
       e.period_end, e.sort_at, e.upcoming_until, e.region_key
from public.events e
left join public.series s on s.slug = e.series_slug
left join public.images i on i.id = e.image_id
left join public.sources src on src.id = e.source
where e.published;

create materialized view public.events_next_occurrence as
select distinct on (coalesce(e.series_slug, e.id), e.region_key)
  e.id, e.slug, e.series_slug, e.region_key, e.date, e.all_day, e.date_precision,
  e.starts_on, e.sort_at, e.upcoming_until, e.title, e.category, e.tags, e.regions,
  e.source, e.status, e.featured, e.popularity, e.timezone
from public.events e
where e.published
  and e.status not in ('done', 'cancelled', 'retired')
  and e.upcoming_until > now()
order by coalesce(e.series_slug, e.id), e.region_key, e.sort_at, e.popularity desc, e.id;

create unique index events_next_occurrence_uniq
  on public.events_next_occurrence (coalesce(series_slug, id), region_key);
create index events_next_occurrence_series_idx
  on public.events_next_occurrence (series_slug, sort_at, id)
  where series_slug is not null;
create index events_next_occurrence_sort_idx
  on public.events_next_occurrence (sort_at, id);

grant select on public.events_next_occurrence to anon, authenticated, service_role;

create or replace view public.series_next with (security_invoker = true) as
select s.*, n.slug as next_slug, n.date as next_date, n.all_day as next_all_day, n.date_precision as next_precision,
       (n.starts_on - current_date) as days_until
from public.series s
left join lateral (
  select slug, date, all_day, starts_on, date_precision
  from public.events_next_occurrence nxt
  where nxt.series_slug = s.slug and nxt.upcoming_until > now()
  order by nxt.sort_at, nxt.id
  limit 1
) n on true
where s.published;

create or replace function public.featured_upcoming(p_limit int default 5)
returns setof public.events_public
language sql
stable
set search_path = public
as $$
  with scored as (
    select e.id, e.title, e.sort_at,
      public.event_heat(
        e.popularity,
        e.featured,
        public.event_days_until(e.all_day, e.starts_on, e.starts_at),
        coalesce(hid.points, 0)
          + case when e.slug is distinct from e.id then coalesce(hsl.points, 0) else 0 end
      ) as heat
    from public.events e
    left join public.event_hype hid on hid.event_key = e.id
    left join public.event_hype hsl
      on hsl.event_key = e.slug and e.slug is distinct from e.id
    where e.published
      and e.status not in ('done', 'cancelled', 'retired')
      and e.upcoming_until > now()
      and e.category <> 'history'
      and (
        e.featured
        or e.popularity >= 42
        or coalesce(hid.points, 0)
          + case when e.slug is distinct from e.id then coalesce(hsl.points, 0) else 0 end >= 8
      )
      and (
        public.event_days_until(e.all_day, e.starts_on, e.starts_at) <= 240
        or e.featured
        or e.popularity >= 70
      )
  ),
  one_title as (
    select distinct on (lower(s.title)) s.id, s.heat, s.sort_at
    from scored s
    order by lower(s.title), s.heat desc, s.sort_at, s.id
  )
  select pe.*
  from one_title d
  join public.events_public pe on pe.id = d.id
  order by d.heat desc, d.sort_at, d.id
  limit p_limit;
$$;

create or replace function public.soonest_upcoming(p_limit int default 8)
returns setof public.events_public
language sql stable set search_path = public as $$
  select pe.*
  from public.events e
  join public.events_public pe on pe.id = e.id
  where e.published
    and e.status not in ('done', 'cancelled', 'retired')
    and e.upcoming_until > now()
  order by e.sort_at, e.popularity desc, e.id
  limit p_limit;
$$;

create or replace function public.related_events(p_id text, p_limit int default 6)
returns setof public.events_public
language sql stable set search_path = public as $$
  with me as (select * from public.events where id = p_id),
  cand as (
    select pe.id,
      ((case when pe.category = me.category then 5 else 0 end)
        + 3 * cardinality(array(select unnest(pe.tags) intersect select unnest(me.tags)))
        + (case when pe.featured then 2 else 0 end) + pe.popularity / 50.0) as score,
      pe.sort_at
    from public.events pe, me
    where pe.published
      and pe.id <> me.id
      and pe.status not in ('done', 'cancelled', 'retired')
      and pe.upcoming_until > now()
      and pe.starts_on >= me.starts_on
      and (pe.tags && me.tags or pe.category = me.category)
    order by pe.sort_at, pe.id
    limit 300
  )
  select pe.*
  from cand
  join public.events_public pe on pe.id = cand.id
  order by cand.score desc, cand.sort_at, cand.id
  limit p_limit;
$$;

create or replace function public.top_slugs(p_limit int default 500)
returns table (slug text)
language sql stable set search_path = public as $$
  select e.slug
  from public.events e
  where e.published
    and e.status not in ('done', 'cancelled', 'retired')
    and e.upcoming_until > now()
  order by e.popularity desc, e.sort_at, e.id
  limit p_limit;
$$;

create or replace function public.category_counts()
returns table (category text, n bigint)
language sql stable set search_path = public as $$
  select e.category, count(*)
  from public.events e
  where e.published
    and e.status not in ('done', 'cancelled', 'retired')
    and e.upcoming_until > now()
  group by 1;
$$;

create or replace function public.popular_tags(p_limit int default 18)
returns table (tag text, n bigint)
language sql stable set search_path = public as $$
  select t, count(*)
  from public.events e, unnest(e.tags) t
  where e.published
    and e.status not in ('done', 'cancelled', 'retired')
    and e.upcoming_until > now()
    and t not in ('wikipedia', 'wikidata')
  group by t
  order by 2 desc
  limit p_limit;
$$;

create or replace function public.events_within_days(
  p_min_days int default 0,
  p_max_days int default 7,
  p_category text default null,
  p_sort text default 'soonest',
  p_limit int default 24)
returns setof public.events_public
language sql stable set search_path = public as $$
  select pe.*
  from public.events e
  join public.events_public pe on pe.id = e.id
  where e.published
    and e.status not in ('done', 'cancelled', 'retired')
    and e.upcoming_until > now()
    and e.date_precision in ('instant', 'day')
    and e.starts_on >= current_date + p_min_days
    and e.starts_on <= current_date + p_max_days
    and (p_category is null or e.category = p_category)
  order by
    case when p_sort = 'popular' then e.popularity end desc nulls last,
    e.starts_on,
    case when p_sort <> 'popular' then e.popularity end desc nulls last,
    e.id
  limit greatest(1, least(p_limit, 1000));
$$;

create or replace function public.series_occurrence_index(
  p_horizon_days int default 800,
  p_limit int default 5000)
returns table (
  slug text,
  series_slug text,
  date text,
  all_day boolean,
  date_precision text,
  days_until integer,
  regions text[],
  source text,
  starts_on date,
  timezone text,
  status text
)
language sql stable set search_path = public as $$
  select e.slug, e.series_slug, e.date, e.all_day, e.date_precision,
         public.event_days_until(e.all_day, e.starts_on, e.starts_at),
         e.regions, e.source, e.starts_on, e.timezone, e.status
  from public.events e
  where e.published
    and e.series_slug is not null
    and e.status not in ('done', 'cancelled', 'retired')
    and e.upcoming_until > now()
    and e.starts_on <= current_date + greatest(p_horizon_days, 0)
  order by e.starts_on, e.slug
  limit greatest(1, least(p_limit, 20000));
$$;

create or replace function public.search_events(
  p_q text default null, p_category text default null, p_tag text default null, p_region text default null,
  p_featured boolean default false, p_region_codes text[] default '{}', p_sort text default 'soonest',
  p_min_popularity int default 0, p_page int default 1, p_page_size int default 24)
returns table (event jsonb, score int, total bigint)
language plpgsql stable set search_path = public, extensions as $fn$
#variable_conflict use_column
declare
  v_needle text;
  v_words  text[];
  v_head   text;
  v_tsq    tsquery;
  v_years  int[];
  v_size   int := greatest(1, least(p_page_size, 100));
  v_skip   int;
begin
  v_needle := nullif(lower(trim(coalesce(p_q, ''))), '');
  v_words  := array(select w from unnest(regexp_split_to_array(coalesce(v_needle, ''), '[^a-z0-9]+')) w
                    where length(w) > 0);
  v_years := array(select distinct w::int from unnest(v_words) w where w ~ '^(19|20|21)[0-9]{2}$');
  if cardinality(v_years) > 0 then
    v_words := array(select w from unnest(v_words) w where w !~ '^(19|20|21)[0-9]{2}$');
    v_needle := nullif(array_to_string(v_words, ' '), '');
  end if;
  if cardinality(v_words) = 0 then v_needle := null; end if;
  v_head := coalesce(v_words[1], '');
  v_skip := (greatest(p_page, 1) - 1) * v_size;

  if v_needle is null then
    return query
    with base as (
      select e.id, e.slug, e.title, e.series_slug, e.region_key, e.sort_at, e.popularity, e.featured,
        public.event_days_until(e.all_day, e.starts_on, e.starts_at) as days_until,
        coalesce(hid.points, 0)
          + case when e.slug is distinct from e.id then coalesce(hsl.points, 0) else 0 end as hype
      from public.events e
      left join public.event_hype hid on hid.event_key = e.id
      left join public.event_hype hsl
        on hsl.event_key = e.slug and e.slug is distinct from e.id
      where e.published
        and e.status not in ('done', 'cancelled', 'retired')
        and e.upcoming_until > now()
        and (cardinality(v_years) = 0 or exists (select 1 from unnest(v_years) y
          where (e.starts_on < make_date(y + 1, 1, 1) and e.period_end >= make_date(y, 1, 1))
            or e.title ~ ('\m' || y::text || '\M')))
        and (p_category is null or e.category = p_category)
        and (p_tag is null or e.tags @> array[p_tag])
        and (p_region is null or e.regions @> array[upper(p_region)] or e.regions @> array['GLOBAL'])
        and (not p_featured or e.featured) and e.popularity >= p_min_popularity
    ),
    picked as (
      select distinct on (
        case when p_sort in ('hot', 'hype') then lower(b.title) else coalesce(b.series_slug, b.id) end,
        case when p_sort in ('hot', 'hype') then '' else b.region_key end
      ) b.*
      from base b
      order by
        case when p_sort in ('hot', 'hype') then lower(b.title) else coalesce(b.series_slug, b.id) end,
        case when p_sort in ('hot', 'hype') then '' else b.region_key end,
        case when p_sort = 'hype' then b.hype end desc nulls last,
        case when p_sort = 'hot' then public.event_heat(b.popularity, b.featured, b.days_until, b.hype) end desc nulls last,
        b.sort_at, b.popularity desc, b.id
    ),
    totals as (select count(*) as n from picked)
    select to_jsonb(pe) || jsonb_build_object('hype', p.hype), 1, totals.n
    from picked p
    cross join totals
    join public.events_public pe on pe.id = p.id
    order by case when p_sort = 'popular' then p.popularity end desc nulls last,
             case when p_sort = 'hype' then p.hype end desc nulls last,
             case when p_sort = 'hot' then public.event_heat(p.popularity, p.featured, p.days_until, p.hype) end desc nulls last,
             case when p_sort = 'latest' then p.sort_at end desc nulls last,
             p.sort_at asc, p.id asc
    limit v_size offset v_skip;
    return;
  end if;

  v_tsq := to_tsquery('simple', array_to_string(array(select w || ':*' from unnest(v_words) w), ' & '));

  return query
  with hits as (
    select e.id from public.events e
      where e.published and e.status not in ('done', 'cancelled', 'retired')
        and e.upcoming_until > now() and e.search @@ v_tsq
    union
    select e.id from public.events e
      where e.published and e.status not in ('done', 'cancelled', 'retired')
        and e.upcoming_until > now()
        and length(v_head) >= 2 and public.title_initials(e.title) like v_head || '%'
    union
    select e.id from public.events e
      where e.published and e.status not in ('done', 'cancelled', 'retired')
        and e.upcoming_until > now() and lower(e.title) % v_needle
  ),
  candidates as (
    select e.id, e.slug, e.title, e.series_slug, e.region_key, e.sort_at, e.popularity, e.featured,
      lower(e.title) as t,
      lower(e.title) || ' ' || lower(array_to_string(e.tags, ' ')) || ' ' || lower(coalesce(e.description, '')) as hay,
      public.title_initials(e.title) as initials,
      public.event_days_until(e.all_day, e.starts_on, e.starts_at) as days_until,
      coalesce(hid.points, 0)
        + case when e.slug is distinct from e.id then coalesce(hsl.points, 0) else 0 end as hype
    from public.events e
    join hits h on h.id = e.id
    left join public.event_hype hid on hid.event_key = e.id
    left join public.event_hype hsl
      on hsl.event_key = e.slug and e.slug is distinct from e.id
    where (cardinality(v_years) = 0 or exists (select 1 from unnest(v_years) y
        where (e.starts_on < make_date(y + 1, 1, 1) and e.period_end >= make_date(y, 1, 1))
            or e.title ~ ('\m' || y::text || '\M')))
      and (p_category is null or e.category = p_category)
      and (p_tag is null or e.tags @> array[p_tag])
      and (p_region is null or e.regions @> array[upper(p_region)] or e.regions @> array['GLOBAL'])
      and (not p_featured or e.featured) and e.popularity >= p_min_popularity
  ),
  scored as (
    select c.*, case
      when c.t = v_needle then 100
      when c.t like v_needle || '%' then 85
      when public.words_all_present(c.t, v_words) then 75
      when length(v_head) >= 2 and c.initials like v_head || '%'
        and public.words_all_present(c.hay, v_words[2:]) then 70
      when public.words_all_present(c.hay, v_words) then 60
      when similarity(c.t, v_needle) >= 0.35 then 30
      when exists (select 1 from public.events e where e.id = c.id and e.regions && p_region_codes)
        or exists (select 1 from public.events e, unnest(e.regions) r
                   where e.id = c.id and lower(r) = v_needle) then 20
      else 0 end as score
    from candidates c
  ),
  picked as (
    select distinct on (
      case when p_sort in ('hot', 'hype') then lower(s.title) else coalesce(s.series_slug, s.id) end,
      case when p_sort in ('hot', 'hype') then '' else s.region_key end
    ) s.*
    from scored s
    where s.score > 0
    order by
      case when p_sort in ('hot', 'hype') then lower(s.title) else coalesce(s.series_slug, s.id) end,
      case when p_sort in ('hot', 'hype') then '' else s.region_key end,
      case when p_sort = 'hype' then s.hype end desc nulls last,
      case when p_sort = 'hot' then public.event_heat(s.popularity, s.featured, s.days_until, s.hype) end desc nulls last,
      s.sort_at, s.score desc, s.popularity desc, s.id
  ),
  totals as (select count(*) as n from picked)
  select to_jsonb(pe) || jsonb_build_object('hype', p.hype), p.score, totals.n
  from picked p
  cross join totals
  join public.events_public pe on pe.id = p.id
  order by case when p_sort = 'popular' then p.popularity end desc nulls last,
           case when p_sort = 'hype' then p.hype end desc nulls last,
           case when p_sort = 'hot' then public.event_heat(p.popularity, p.featured, p.days_until, p.hype) end desc nulls last,
           case when p_sort = 'latest' then p.sort_at end desc nulls last,
           case when p_sort not in ('popular','latest','hype','hot') then p.score * 2 + p.popularity end desc,
           p.sort_at asc, p.id asc
  limit v_size offset v_skip;
end
$fn$;

comment on function public.search_events(text,text,text,text,boolean,text[],text,int,int,int) is
  'Next matching upcoming occurrence per series and country set. Browse path uses upcoming_until and region_key; total is a separate count.';

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
    where e.published
      and e.status not in ('done', 'cancelled', 'retired')
      and e.upcoming_until > now()
      and (e.featured or e.popularity >= 45 or e.series_slug is not null)
      and (k.kind <> 'image' or e.image_id is null) and (k.kind <> 'wikipedia_summary' or e.summary is null)
    on conflict (kind, event_id) do nothing;
  insert into public.catalog_stats (id, count, featured, series_count, by_cat, by_src, by_country, top_tags, generated_at)
  select true,
    (select count(*) from public.events where published and status not in ('done','cancelled','retired') and upcoming_until > now()),
    (select count(*) from public.events where published and featured and status not in ('done','cancelled','retired') and upcoming_until > now()),
    (select count(*) from public.series where published),
    coalesce((select jsonb_object_agg(category, n) from public.category_counts()), '{}'::jsonb),
    coalesce((select jsonb_object_agg(source, n) from (select source, count(*) n from public.events where published and status not in ('done','cancelled','retired') and upcoming_until > now() group by 1) s), '{}'::jsonb),
    coalesce((select jsonb_object_agg(r, n) from (select r, count(*) n from public.events, unnest(regions) r where published and status not in ('done','cancelled','retired') and upcoming_until > now() group by r) c), '{}'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('tag', tag, 'count', n)) from public.popular_tags(40)), '[]'::jsonb), now()
  on conflict (id) do update set count = excluded.count, featured = excluded.featured, series_count = excluded.series_count,
    by_cat = excluded.by_cat, by_src = excluded.by_src, by_country = excluded.by_country, top_tags = excluded.top_tags, generated_at = excluded.generated_at;
  refresh materialized view public.events_next_occurrence;
end $$;

revoke execute on function public.finalize_catalog() from public, anon, authenticated;
grant execute on function public.finalize_catalog() to service_role;

grant execute on function public.upcoming_until_for(text, timestamptz, date, date) to anon, authenticated, service_role;
grant execute on function public.region_key_for(text[]) to anon, authenticated, service_role;
grant execute on function public.event_days_until(boolean, date, timestamptz) to anon, authenticated, service_role;
grant execute on function public.events_within_days(int, int, text, text, int) to anon, authenticated, service_role;
grant execute on function public.series_occurrence_index(int, int) to anon, authenticated, service_role;
grant execute on function public.search_events(text, text, text, text, boolean, text[], text, int, int, int) to anon, authenticated, service_role;
grant execute on function public.featured_upcoming(int) to anon, authenticated, service_role;
grant execute on function public.soonest_upcoming(int) to anon, authenticated, service_role;
grant execute on function public.related_events(text, int) to anon, authenticated, service_role;
grant execute on function public.top_slugs(int) to anon, authenticated, service_role;
grant execute on function public.category_counts() to anon, authenticated, service_role;
grant execute on function public.popular_tags(int) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
