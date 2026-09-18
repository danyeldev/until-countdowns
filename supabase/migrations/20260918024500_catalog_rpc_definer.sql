-- Catalog RPCs ran under the caller's row-level security (anon: events.published).
-- Beneath a security-barrier qual Postgres only accepts *leakproof* operators as
-- index quals, and tsvector @@, pg_trgm %, array && and the regexp_* calls inside
-- title_initials() are not leakproof. search_events / related_events therefore
-- sequential-scanned every published row (1-3 s on 15k events) even though the
-- GIN, trigram and expression indexes exist.
--
-- Every function below restricts itself to published rows, so it can run as its
-- owner and bypass RLS: SECURITY DEFINER with the search_path already pinned.
-- search_events additionally pages the grouped candidates *before* joining
-- events_public; the previous shape joined all ~7k groups to the view (a merge
-- join across the whole events_pkey index) and only then applied LIMIT. Its
-- DISTINCT ON keys are compared under COLLATE "C": they only need equality, and
-- byte-order comparison makes the 15k-row grouping sort ~7x cheaper than the
-- en_US.UTF-8 default. days_until is computed only for the hot sort, the sole
-- consumer inside the function.

alter function public.soonest_upcoming(int) security definer;
alter function public.top_slugs(int) security definer;
alter function public.category_counts() security definer;
alter function public.popular_tags(int) security definer;
alter function public.events_within_days(int, int, text, text, int) security definer;
alter function public.series_occurrence_index(int, int) security definer;

create or replace function public.featured_upcoming(p_limit int default 5)
returns setof public.events_public
language sql stable security definer set search_path = public as $$
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
    select distinct on (lower(s.title) collate "C") s.id, s.heat, s.sort_at
    from scored s
    order by lower(s.title) collate "C", s.heat desc, s.sort_at, s.id
  )
  select pe.*
  from one_title d
  join public.events_public pe on pe.id = d.id
  order by d.heat desc, d.sort_at, d.id
  limit p_limit;
$$;

create or replace function public.related_events(p_id text, p_limit int default 6)
returns setof public.events_public
language sql stable security definer set search_path = public as $$
  with me as (select * from public.events where id = p_id and published),
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

create or replace function public.search_events(
  p_q text default null, p_category text default null, p_tag text default null, p_region text default null,
  p_featured boolean default false, p_region_codes text[] default '{}', p_sort text default 'soonest',
  p_min_popularity int default 0, p_page int default 1, p_page_size int default 24)
returns table (event jsonb, score int, total bigint)
language plpgsql stable security definer set search_path = public, extensions as $fn$
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
        case when p_sort = 'hot'
          then public.event_days_until(e.all_day, e.starts_on, e.starts_at) end as days_until,
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
    picked as materialized (
      select distinct on (
        (case when p_sort in ('hot', 'hype') then lower(b.title) else coalesce(b.series_slug, b.id) end) collate "C",
        (case when p_sort in ('hot', 'hype') then '' else b.region_key end) collate "C"
      ) b.*
      from base b
      order by
        (case when p_sort in ('hot', 'hype') then lower(b.title) else coalesce(b.series_slug, b.id) end) collate "C",
        (case when p_sort in ('hot', 'hype') then '' else b.region_key end) collate "C",
        case when p_sort = 'hype' then b.hype end desc nulls last,
        case when p_sort = 'hot' then public.event_heat(b.popularity, b.featured, b.days_until, b.hype) end desc nulls last,
        b.sort_at, b.popularity desc, b.id
    ),
    totals as (select count(*) as n from picked),
    page as (
      select p.*
      from picked p
      order by case when p_sort = 'popular' then p.popularity end desc nulls last,
               case when p_sort = 'hype' then p.hype end desc nulls last,
               case when p_sort = 'hot' then public.event_heat(p.popularity, p.featured, p.days_until, p.hype) end desc nulls last,
               case when p_sort = 'latest' then p.sort_at end desc nulls last,
               p.sort_at asc, p.id asc
      limit v_size offset v_skip
    )
    select to_jsonb(pe) || jsonb_build_object('hype', p.hype), 1, totals.n
    from page p
    cross join totals
    join public.events_public pe on pe.id = p.id
    order by case when p_sort = 'popular' then p.popularity end desc nulls last,
             case when p_sort = 'hype' then p.hype end desc nulls last,
             case when p_sort = 'hot' then public.event_heat(p.popularity, p.featured, p.days_until, p.hype) end desc nulls last,
             case when p_sort = 'latest' then p.sort_at end desc nulls last,
             p.sort_at asc, p.id asc;
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
  picked as materialized (
    select distinct on (
      (case when p_sort in ('hot', 'hype') then lower(s.title) else coalesce(s.series_slug, s.id) end) collate "C",
      (case when p_sort in ('hot', 'hype') then '' else s.region_key end) collate "C"
    ) s.*
    from scored s
    where s.score > 0
    order by
      (case when p_sort in ('hot', 'hype') then lower(s.title) else coalesce(s.series_slug, s.id) end) collate "C",
      (case when p_sort in ('hot', 'hype') then '' else s.region_key end) collate "C",
      case when p_sort = 'hype' then s.hype end desc nulls last,
      case when p_sort = 'hot' then public.event_heat(s.popularity, s.featured, s.days_until, s.hype) end desc nulls last,
      s.sort_at, s.score desc, s.popularity desc, s.id
  ),
  totals as (select count(*) as n from picked),
  page as (
    select p.*
    from picked p
    order by case when p_sort = 'popular' then p.popularity end desc nulls last,
             case when p_sort = 'hype' then p.hype end desc nulls last,
             case when p_sort = 'hot' then public.event_heat(p.popularity, p.featured, p.days_until, p.hype) end desc nulls last,
             case when p_sort = 'latest' then p.sort_at end desc nulls last,
             case when p_sort not in ('popular','latest','hype','hot') then p.score * 2 + p.popularity end desc,
             p.sort_at asc, p.id asc
    limit v_size offset v_skip
  )
  select to_jsonb(pe) || jsonb_build_object('hype', p.hype), p.score, totals.n
  from page p
  cross join totals
  join public.events_public pe on pe.id = p.id
  order by case when p_sort = 'popular' then p.popularity end desc nulls last,
           case when p_sort = 'hype' then p.hype end desc nulls last,
           case when p_sort = 'hot' then public.event_heat(p.popularity, p.featured, p.days_until, p.hype) end desc nulls last,
           case when p_sort = 'latest' then p.sort_at end desc nulls last,
           case when p_sort not in ('popular','latest','hype','hot') then p.score * 2 + p.popularity end desc,
           p.sort_at asc, p.id asc;
end
$fn$;

comment on function public.search_events(text,text,text,text,boolean,text[],text,int,int,int) is
  'Next matching upcoming occurrence per series and country set. Runs as owner so GIN/trigram indexes apply; pages grouped candidates before joining events_public.';
