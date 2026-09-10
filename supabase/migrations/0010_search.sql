-- Search that finds things.
--
-- `search_events` matched the whole query as one literal substring: `p_q` became `%gta vi%` and was
-- run against the title with LIKE. Three consequences, all of them reproducible against the live
-- catalog before this migration:
--
--   * "GTA vi" returned nothing at all, though Grand Theft Auto VI is in the catalog — no title
--     contains that substring, and `plainto_tsquery` wanted both 'gta' and 'vi' as tokens.
--   * "gta" returned four Wagtail end-of-life dates, because `%gta%` matches "wa(gta)il". Substring
--     matching has no idea where a word starts.
--   * "haloween" returned nothing, though pg_trgm has been installed since 0001 and the trigram
--     index on lower(title) has existed just as long. Nothing ever used it.
--
-- The indexes to do this properly were all built in 0001 — `events_search_gin` over the weighted
-- tsvector and `events_title_trgm` over lower(title). The function reached for neither: the
-- tsvector was a low-priority scoring tier behind the LIKE, and the trigram index was dead weight.
--
-- So: match through the indexes, three ways in, then score the survivors.

-- Initials of a title: "Grand Theft Auto VI" -> "gtav". The one thing an index cannot give us for
-- free, and the reason "GTA" can reach a game whose title never contains those three letters
-- together. Immutable so it can carry an expression index.
create or replace function public.title_initials(p_title text) returns text
language sql immutable parallel safe as $$
  select array_to_string(array(
    select left(w, 1)
    from unnest(regexp_split_to_array(lower(coalesce(p_title, '')), '[^a-z0-9]+')) w
    where length(w) > 0
  ), '');
$$;

comment on function public.title_initials(text) is
  'Lowercase initials of each alphanumeric word in a title, for acronym search ("gta" -> Grand Theft Auto VI).';

-- An expression index rather than a stored generated column on purpose: a generated column is NULL
-- inside `events_before_write`, so it would differ from OLD on every write and bump `updated_at` on
-- rows that did not change — which is why that trigger already subtracts `search`. This keeps the
-- ingest's unchanged/updated counts and the sitemap's lastmod honest.
create index if not exists events_title_initials_idx
  on public.events (public.title_initials(title) text_pattern_ops)
  where published;

-- Every word present, each at the start of a word in the haystack. An empty word list is vacuously
-- true, which only happens for the tail of a one-word query.
create or replace function public.words_all_present(p_haystack text, p_words text[])
returns boolean language sql immutable parallel safe as $$
  select coalesce(bool_and(p_haystack ~ ('\m' || w)), true) from unnest(p_words) w;
$$;

-- plpgsql rather than a `language sql` body, and a UNION rather than an OR, both for the planner's
-- sake. Parsed values have to be local variables or they arrive as columns of a joined CTE and can
-- never become index quals; and three different index types will not combine into one BitmapOr, so
-- an OR is answered with a sequential scan that runs title_initials() over all 15k rows. Measured
-- on the live catalog: 669 ms as a joined CTE with an OR, 17 ms like this.
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
  v_size   int := greatest(1, least(p_page_size, 100));
  v_skip   int;
begin
  v_needle := nullif(lower(trim(coalesce(p_q, ''))), '');
  -- Alphanumeric words only, so nothing reaching a regex or a tsquery below needs escaping. A query
  -- of pure punctuation leaves no words and is treated as no query at all.
  v_words  := array(select w from unnest(regexp_split_to_array(coalesce(v_needle, ''), '[^a-z0-9]+')) w
                    where length(w) > 0);
  if cardinality(v_words) = 0 then v_needle := null; end if;
  v_head := coalesce(v_words[1], '');
  v_skip := (greatest(p_page, 1) - 1) * v_size;

  -- No free text: a plain filtered listing, and a plan of its own rather than one shared with the
  -- search path, where the index quals below would be dead weight.
  if v_needle is null then
    return query
    select to_jsonb(pe), 1, count(*) over ()
    from public.events_public pe
    where pe.sort_at > now() - interval '2 days'
      and (p_category is null or pe.category = p_category)
      and (p_tag is null or pe.tags @> array[p_tag])
      and (p_region is null or pe.regions @> array[upper(p_region)] or pe.regions @> array['GLOBAL'])
      and (not p_featured or pe.featured) and pe.popularity >= p_min_popularity
    order by case when p_sort = 'popular' then pe.popularity end desc nulls last,
             case when p_sort = 'latest' then pe.sort_at end desc nulls last,
             case when p_sort not in ('popular','latest') then (pe.sort_at < now() - interval '12 hours') end asc,
             pe.sort_at asc
    limit v_size offset v_skip;
    return;
  end if;

  -- Every word has to be there, and the last one a visitor typed may still be half-written, so each
  -- is a prefix: "chris" finds Christmas, "world cup 2027" needs all three.
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
    where pe.sort_at > now() - interval '2 days'
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
  )
  select to_jsonb(s.pe), s.score, count(*) over ()
  from scored s where s.score > 0
  order by case when p_sort = 'popular' then (s.pe).popularity end desc nulls last,
           case when p_sort = 'latest' then (s.pe).sort_at end desc nulls last,
           case when p_sort not in ('popular','latest') then ((s.pe).sort_at < now() - interval '12 hours') end asc,
           -- Relevance leads, but popularity is what separates "Total Solar Eclipse" (93) from
           -- "Eclipse Temurin 26 end of life" (30) when both merely contain the word.
           case when p_sort not in ('popular','latest') then s.score * 2 + (s.pe).popularity end desc,
           (s.pe).sort_at asc
  limit v_size offset v_skip;
end
$fn$;
