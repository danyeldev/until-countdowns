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

create or replace function public.search_events(
  p_q text default null, p_category text default null, p_tag text default null, p_region text default null,
  p_featured boolean default false, p_region_codes text[] default '{}', p_sort text default 'soonest',
  p_min_popularity int default 0, p_page int default 1, p_page_size int default 24)
returns table (event jsonb, score int, total bigint)
language sql stable set search_path = public, extensions as $$
  with raw as (
    select nullif(lower(trim(coalesce(p_q, ''))), '') as needle
  ),
  parsed as (
    select needle,
      -- Alphanumeric words only, so anything reaching a regex or a tsquery below is already safe to
      -- interpolate. A query of pure punctuation leaves no words and is treated as no query at all.
      array(select w from unnest(regexp_split_to_array(needle, '[^a-z0-9]+')) w where length(w) > 0) as words
    from raw
  ),
  args as (
    select
      case when cardinality(words) = 0 then null else needle end as needle,
      words,
      coalesce(words[1], '') as head,
      case when cardinality(words) > 0
        -- Every word has to be there, and the last one a visitor typed may still be half-written,
        -- so each is a prefix: "chris" finds Christmas, "world cup 2027" needs all three.
        then to_tsquery('simple', array_to_string(array(select w || ':*' from unnest(words) w), ' & '))
      end as tsq
    from parsed
  ),
  candidates as (
    select pe, e.title as full_title, a.needle, a.words, a.head,
      lower(pe.title) as t,
      lower(pe.title) || ' ' || lower(array_to_string(pe.tags, ' ')) || ' ' || lower(coalesce(pe.description, '')) as hay,
      public.title_initials(e.title) as initials
    from public.events_public pe
    join public.events e on e.id = pe.id, args a
    where pe.sort_at > now() - interval '2 days'
      and (p_category is null or pe.category = p_category)
      and (p_tag is null or pe.tags @> array[p_tag])
      and (p_region is null or pe.regions @> array[upper(p_region)] or pe.regions @> array['GLOBAL'])
      and (not p_featured or pe.featured) and pe.popularity >= p_min_popularity
      and (
        a.needle is null
        -- Three indexed ways in, each on an index that already existed or is created above. Only
        -- what survives this gets the expensive scoring below.
        or e.search @@ a.tsq                                                        -- events_search_gin
        or (length(a.head) >= 2 and public.title_initials(e.title) like a.head || '%')  -- events_title_initials_idx
        or lower(e.title) % a.needle                                                -- events_title_trgm
      )
  ),
  scored as (
    select pe, case
      when needle is null then 1
      when t = needle then 100
      when t like needle || '%' then 85
      -- `\m` anchors to the start of a word, which is the whole difference between finding Grand
      -- Theft Auto and finding Wagtail.
      when public.words_all_present(t, words) then 75
      when length(head) >= 2 and initials like head || '%'
        and public.words_all_present(hay, words[2:]) then 70
      when public.words_all_present(hay, words) then 60
      when similarity(t, needle) >= 0.35 then 30
      when (pe).regions && p_region_codes or exists (select 1 from unnest((pe).regions) r where lower(r) = needle) then 20
      else 0 end as score
    from candidates
  )
  select to_jsonb(pe) as event, score, count(*) over () as total from scored where score > 0
  order by case when p_sort = 'popular' then (pe).popularity end desc nulls last,
           case when p_sort = 'latest' then (pe).sort_at end desc nulls last,
           case when p_sort not in ('popular','latest') then ((pe).sort_at < now() - interval '12 hours') end asc,
           -- Relevance leads, but popularity is what separates "Total Solar Eclipse" (93) from
           -- "Eclipse Temurin 26 end of life" (30) when both merely contain the word. Doubling the
           -- relevance keeps a title match ahead of a merely famous row that mentions the word.
           case when p_sort not in ('popular','latest') then score * 2 + (pe).popularity end desc,
           (pe).sort_at asc
  limit greatest(1, least(p_page_size, 100)) offset (greatest(p_page, 1) - 1) * greatest(1, least(p_page_size, 100));
$$;
