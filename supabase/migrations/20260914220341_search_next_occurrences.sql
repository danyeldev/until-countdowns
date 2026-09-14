-- Search/browse show the next matching occurrence of each recurring series.
-- Dates remain separate published events: this is presentation grouping, not data deletion.
-- Filter before choosing the next occurrence; count and paginate after grouping. Different
-- country sets keep separate representatives (for example Mother's Day in the US and GB).
-- Region array order/duplicates are irrelevant, but GLOBAL and a country remain distinct.
-- This migration can also run directly after 0012; it deliberately carries its own upcoming
-- helper and changes no feeds, event rows, series pages, aliases, views or function signatures.

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
  -- Alphanumeric words only, so nothing reaching a regex or a tsquery below needs escaping. A query
  -- of pure punctuation leaves no words and is treated as no query at all.
  v_words  := array(select w from unnest(regexp_split_to_array(coalesce(v_needle, ''), '[^a-z0-9]+')) w
                    where length(w) > 0);
  -- A complete calendar-year word is an occurrence filter, not a required title word:
  -- generated titles are "Halloween", never "Halloween 2030". A year that is literally
  -- in an event title (Windows 2000) remains a match even when its date is another year.
  -- Partial numbers remain text.
  v_years := array(select distinct w::int from unnest(v_words) w where w ~ '^(19|20|21)[0-9]{2}$');
  if cardinality(v_years) > 0 then
    v_words := array(select w from unnest(v_words) w where w !~ '^(19|20|21)[0-9]{2}$');
    v_needle := nullif(array_to_string(v_words, ' '), '');
  end if;
  if cardinality(v_words) = 0 then v_needle := null; end if;
  v_head := coalesce(v_words[1], '');
  v_skip := (greatest(p_page, 1) - 1) * v_size;

  -- No free text: a plain filtered listing, and a plan of its own rather than one shared with the
  -- search path, where the index quals below would be dead weight.
  if v_needle is null then
    return query
    with ranked as (
      select pe, row_number() over (
        partition by pe.series_slug, case when pe.series_slug is null then pe.id end,
          array(select distinct upper(r) from unnest(pe.regions) r order by 1)
        order by pe.sort_at, pe.popularity desc, pe.id
      ) as occurrence_rank
      from public.events_public pe
      where public.event_is_upcoming(pe.status, pe.date_precision, pe.starts_at, pe.starts_on, pe.period_end)
        and (cardinality(v_years) = 0 or exists (select 1 from unnest(v_years) y
          where (pe.starts_on < make_date(y + 1, 1, 1) and pe.period_end >= make_date(y, 1, 1))
            or pe.title ~ ('\m' || y::text || '\M')))
        and (p_category is null or pe.category = p_category)
        and (p_tag is null or pe.tags @> array[p_tag])
        and (p_region is null or pe.regions @> array[upper(p_region)] or pe.regions @> array['GLOBAL'])
        and (not p_featured or pe.featured) and pe.popularity >= p_min_popularity
    )
    select to_jsonb(r.pe), 1, count(*) over ()
    from ranked r where r.occurrence_rank = 1
    order by case when p_sort = 'popular' then (r.pe).popularity end desc nulls last,
             case when p_sort = 'latest' then (r.pe).sort_at end desc nulls last,
             (r.pe).sort_at asc, (r.pe).id asc
    limit v_size offset v_skip;
    return;
  end if;

  -- Every word has to be there, and the last one a visitor typed may still be half-written, so each
  -- is a prefix: "chris" finds Christmas; "world cup 2027" matches both words in that year.
  v_tsq := to_tsquery('simple', array_to_string(array(select w || ':*' from unnest(v_words) w), ' & '));

  return query
  with hits as (
    select e.id from public.events e where e.published and e.search @@ v_tsq                     -- events_search_gin
    union
    select e.id from public.events e
      where e.published and length(v_head) >= 2 and public.title_initials(e.title) like v_head || '%'  -- events_title_initials_idx
    union
    select e.id from public.events e where e.published and lower(e.title) % v_needle             -- events_title_trgm
  ),
  candidates as (
    select pe,
      lower(pe.title) as t,
      lower(pe.title) || ' ' || lower(array_to_string(pe.tags, ' ')) || ' ' || lower(coalesce(pe.description, '')) as hay,
      public.title_initials(pe.title) as initials
    from public.events_public pe
    join hits h on h.id = pe.id
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
    select c.pe, case
      when c.t = v_needle then 100
      when c.t like v_needle || '%' then 85
      -- `\m` anchors to the start of a word, which is the whole difference between finding Grand
      -- Theft Auto and finding Wagtail.
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
    select s.pe, s.score, row_number() over (
      partition by (s.pe).series_slug, case when (s.pe).series_slug is null then (s.pe).id end,
        array(select distinct upper(r) from unnest((s.pe).regions) r order by 1)
      order by (s.pe).sort_at, s.score desc, (s.pe).popularity desc, (s.pe).id
    ) as occurrence_rank
    from scored s where s.score > 0
  )
  select to_jsonb(s.pe), s.score, count(*) over ()
  from ranked s where s.occurrence_rank = 1
  order by case when p_sort = 'popular' then (s.pe).popularity end desc nulls last,
           case when p_sort = 'latest' then (s.pe).sort_at end desc nulls last,
           -- Relevance leads, but popularity is what separates "Total Solar Eclipse" (93) from
           -- "Eclipse Temurin 26 end of life" (30) when both merely contain the word.
           case when p_sort not in ('popular','latest') then s.score * 2 + (s.pe).popularity end desc,
           (s.pe).sort_at asc, (s.pe).id asc
  limit v_size offset v_skip;
end
$fn$;

comment on function public.search_events(text,text,text,text,boolean,text[],text,int,int,int) is
  'Next matching upcoming occurrence per series and country set, with full calendar-year query filters (1900-2199); totals and pagination count representatives. Dated event rows remain intact.';
