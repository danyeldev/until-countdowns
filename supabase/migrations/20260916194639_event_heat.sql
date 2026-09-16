-- Live hype joins catalog ranking. `event_heat` is the same blend the app
-- uses: soonness, editorial quality, log-scaled attention.

create or replace function public.event_heat(
  p_popularity integer,
  p_featured boolean,
  p_days_until integer,
  p_hype integer
) returns numeric
language sql
immutable
parallel safe
set search_path = public
as $$
  select
    38 * exp(-greatest(coalesce(p_days_until, 120), 0) / 45.0)
    + 34 * least(
        1.15,
        greatest(coalesce(p_popularity, 0), 0) / 100.0
          + case when p_featured then 0.25 else 0 end
      )
    + 28 * least(
        1.15,
        ln(1 + greatest(coalesce(p_hype, 0), 0)) / ln(81.0)
      );
$$;

comment on function public.event_heat(integer, boolean, integer, integer) is
  'Home/search blend: 38*exp(-days/45) + 34*quality + 28*log hype. Mirrors src/lib/heat.ts.';

grant execute on function public.event_heat(integer, boolean, integer, integer)
  to anon, authenticated;

create or replace function public.featured_upcoming(p_limit int default 5)
returns setof public.events_public
language sql
stable
set search_path = public
as $$
  with scored as (
    select pe,
      public.event_heat(
        pe.popularity,
        pe.featured,
        pe.days_until,
        coalesce(hid.points, 0)
          + case when pe.slug is distinct from pe.id then coalesce(hsl.points, 0) else 0 end
      ) as heat
    from public.events_public pe
    left join public.event_hype hid on hid.event_key = pe.id
    left join public.event_hype hsl
      on hsl.event_key = pe.slug and pe.slug is distinct from pe.id
    where public.event_is_upcoming(
        pe.status, pe.date_precision, pe.starts_at, pe.starts_on, pe.period_end
      )
      and pe.category <> 'history'
      and (
        pe.featured
        or pe.popularity >= 42
        or coalesce(hid.points, 0)
          + case when pe.slug is distinct from pe.id then coalesce(hsl.points, 0) else 0 end >= 8
      )
      and (
        pe.days_until is null
        or pe.days_until <= 240
        or pe.featured
        or pe.popularity >= 70
      )
  ),
  one_title as (
    select distinct on (lower((s.pe).title)) s.pe, s.heat
    from scored s
    order by lower((s.pe).title), s.heat desc, (s.pe).sort_at, (s.pe).id
  )
  select (d.pe).*
  from one_title d
  order by d.heat desc, (d.pe).sort_at, (d.pe).id
  limit p_limit;
$$;

comment on function public.featured_upcoming(int) is
  'Upcoming rail: featured, strong editorial rows, or live hype, ranked by event_heat.';

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
    with ranked as (
      select pe,
        coalesce(hid.points, 0)
          + case when pe.slug is distinct from pe.id then coalesce(hsl.points, 0) else 0 end as hype,
        row_number() over (
        partition by
          case when p_sort in ('hot', 'hype') then lower(pe.title) else pe.series_slug end,
          case
            when p_sort in ('hot', 'hype') then null::text
            when pe.series_slug is null then pe.id
          end,
          case
            when p_sort in ('hot', 'hype') then null::text[]
            else array(select distinct upper(r) from unnest(pe.regions) r order by 1)
          end
        order by
          case when p_sort = 'hype' then coalesce(hid.points, 0)
            + case when pe.slug is distinct from pe.id then coalesce(hsl.points, 0) else 0 end
          end desc nulls last,
          case when p_sort = 'hot' then public.event_heat(
            pe.popularity, pe.featured, pe.days_until,
            coalesce(hid.points, 0)
              + case when pe.slug is distinct from pe.id then coalesce(hsl.points, 0) else 0 end
          ) end desc nulls last,
          pe.sort_at, pe.popularity desc, pe.id
      ) as occurrence_rank
      from public.events_public pe
      left join public.event_hype hid on hid.event_key = pe.id
      left join public.event_hype hsl
        on hsl.event_key = pe.slug and pe.slug is distinct from pe.id
      where public.event_is_upcoming(pe.status, pe.date_precision, pe.starts_at, pe.starts_on, pe.period_end)
        and (cardinality(v_years) = 0 or exists (select 1 from unnest(v_years) y
          where (pe.starts_on < make_date(y + 1, 1, 1) and pe.period_end >= make_date(y, 1, 1))
            or pe.title ~ ('\m' || y::text || '\M')))
        and (p_category is null or pe.category = p_category)
        and (p_tag is null or pe.tags @> array[p_tag])
        and (p_region is null or pe.regions @> array[upper(p_region)] or pe.regions @> array['GLOBAL'])
        and (not p_featured or pe.featured) and pe.popularity >= p_min_popularity
    )
    select to_jsonb(r.pe) || jsonb_build_object('hype', r.hype), 1, count(*) over ()
    from ranked r where r.occurrence_rank = 1
    order by case when p_sort = 'popular' then (r.pe).popularity end desc nulls last,
             case when p_sort = 'hype' then r.hype end desc nulls last,
             case when p_sort = 'hot' then public.event_heat((r.pe).popularity, (r.pe).featured, (r.pe).days_until, r.hype) end desc nulls last,
             case when p_sort = 'latest' then (r.pe).sort_at end desc nulls last,
             (r.pe).sort_at asc, (r.pe).id asc
    limit v_size offset v_skip;
    return;
  end if;

  v_tsq := to_tsquery('simple', array_to_string(array(select w || ':*' from unnest(v_words) w), ' & '));

  return query
  with hits as (
    select e.id from public.events e where e.published and e.search @@ v_tsq
    union
    select e.id from public.events e
      where e.published and length(v_head) >= 2 and public.title_initials(e.title) like v_head || '%'
    union
    select e.id from public.events e where e.published and lower(e.title) % v_needle
  ),
  candidates as (
    select pe,
      lower(pe.title) as t,
      lower(pe.title) || ' ' || lower(array_to_string(pe.tags, ' ')) || ' ' || lower(coalesce(pe.description, '')) as hay,
      public.title_initials(pe.title) as initials,
      coalesce(hid.points, 0)
        + case when pe.slug is distinct from pe.id then coalesce(hsl.points, 0) else 0 end as hype
    from public.events_public pe
    join hits h on h.id = pe.id
    left join public.event_hype hid on hid.event_key = pe.id
    left join public.event_hype hsl
      on hsl.event_key = pe.slug and pe.slug is distinct from pe.id
    where public.event_is_upcoming(pe.status, pe.date_precision, pe.starts_at, pe.starts_on, pe.period_end)
      and (cardinality(v_years) = 0 or exists (select 1 from unnest(v_years) y
        where (pe.starts_on < make_date(y + 1, 1, 1) and pe.period_end >= make_date(y, 1, 1))
            or pe.title ~ ('\m' || y::text || '\M')))
      and (p_category is null or pe.category = p_category)
      and (p_tag is null or pe.tags @> array[p_tag])
      and (p_region is null or pe.regions @> array[upper(p_region)] or pe.regions @> array['GLOBAL'])
      and (not p_featured or pe.featured) and pe.popularity >= p_min_popularity
  ),
  scored as (
    select c.pe, c.hype, case
      when c.t = v_needle then 100
      when c.t like v_needle || '%' then 85
      when public.words_all_present(c.t, v_words) then 75
      when length(v_head) >= 2 and c.initials like v_head || '%'
        and public.words_all_present(c.hay, v_words[2:]) then 70
      when public.words_all_present(c.hay, v_words) then 60
      when similarity(c.t, v_needle) >= 0.35 then 30
      when (c.pe).regions && p_region_codes
        or exists (select 1 from unnest((c.pe).regions) r where lower(r) = v_needle) then 20
      else 0 end as score
    from candidates c
  ),
  ranked as (
    select s.pe, s.score, s.hype, row_number() over (
      partition by
        case when p_sort in ('hot', 'hype') then lower((s.pe).title) else (s.pe).series_slug end,
        case
          when p_sort in ('hot', 'hype') then null::text
          when (s.pe).series_slug is null then (s.pe).id
        end,
        case
          when p_sort in ('hot', 'hype') then null::text[]
          else array(select distinct upper(r) from unnest((s.pe).regions) r order by 1)
        end
      order by
        case when p_sort = 'hype' then s.hype end desc nulls last,
        case when p_sort = 'hot' then public.event_heat((s.pe).popularity, (s.pe).featured, (s.pe).days_until, s.hype) end desc nulls last,
        (s.pe).sort_at, s.score desc, (s.pe).popularity desc, (s.pe).id
    ) as occurrence_rank
    from scored s where s.score > 0
  )
  select to_jsonb(s.pe) || jsonb_build_object('hype', s.hype), s.score, count(*) over ()
  from ranked s where s.occurrence_rank = 1
  order by case when p_sort = 'popular' then (s.pe).popularity end desc nulls last,
           case when p_sort = 'hype' then s.hype end desc nulls last,
           case when p_sort = 'hot' then public.event_heat((s.pe).popularity, (s.pe).featured, (s.pe).days_until, s.hype) end desc nulls last,
           case when p_sort = 'latest' then (s.pe).sort_at end desc nulls last,
           case when p_sort not in ('popular','latest','hype','hot') then s.score * 2 + (s.pe).popularity end desc,
           (s.pe).sort_at asc, (s.pe).id asc
  limit v_size offset v_skip;
end
$fn$;

comment on function public.search_events(text,text,text,text,boolean,text[],text,int,int,int) is
  'Next matching upcoming occurrence per series and country set. Sorts: soonest, hot, hype, popular, latest. Event JSON includes live hype.';
