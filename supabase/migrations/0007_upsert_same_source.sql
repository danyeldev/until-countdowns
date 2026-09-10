-- 0007_upsert_same_source.sql: a source re-ingesting the row it already owns (same source_key) is authoritative for its own fields,
-- so corrections (category, title, dates) from the primary source are applied even though its rank did not increase.
-- idempotent bulk upsert (rows = snake_case IngestEvent)
create or replace function public.upsert_events(p_rows jsonb)
returns table (inserted int, updated int, unchanged int, drifted int)
language plpgsql security definer set search_path = public as $$
declare v_unchanged int := 0; v_drift int := 0; v_ins int := 0; v_upd int := 0;
begin
  create temp table _src on commit drop as
  select * from jsonb_to_recordset(p_rows) as r(
    slug text, title text, description text, summary text, date text, end_date text, all_day boolean, timezone text,
    category text, tags text[], regions text[], source text, source_url text, source_key text,
    external_ids jsonb, status text, date_precision text, confidence numeric, featured boolean, popularity int,
    series_slug text, location jsonb, jsonld_eligible boolean,
    image_candidate_url text, image_candidate_meta jsonb, content_hash text, raw jsonb);
  delete from _src where slug is null or date is null or source_key is null or content_hash is null
                      or slug like 'mine-%' or slug like 'share-%';
  delete from _src a using _src b where a.source_key = b.source_key and a.ctid < b.ctid;

  -- 0) unchanged since last run: bump last_seen_at only
  update public.event_sources es set last_seen_at = now() from _src s
    where es.source_key = s.source_key and es.content_hash = s.content_hash;
  get diagnostics v_unchanged = row_count;
  update public.events e set last_seen_at = now()
    from public.event_sources es join _src s on s.source_key = es.source_key and s.content_hash = es.content_hash
    where e.id = es.event_id;
  delete from _src s using public.event_sources es where es.source_key = s.source_key and es.content_hash = s.content_hash;

  -- 1) same source_key, drifted slug, this source is primary: update in place, keep id, remember old slug
  create temp table _drift on commit drop as
  select e.id as event_id, e.slug as old_slug, s.* from _src s join public.events e on e.source_key = s.source_key
  where e.slug <> s.slug and e.source = s.source and not exists (select 1 from public.events x where x.slug = s.slug);
  insert into public.event_slugs (slug, event_id) select old_slug, event_id from _drift on conflict do nothing;
  update public.events e set
    slug = d.slug, title = d.title, description = coalesce(nullif(d.description, ''), e.description),
    summary = coalesce(d.summary, e.summary), date = d.date, end_date = d.end_date,
    all_day = coalesce(d.all_day, e.all_day), timezone = coalesce(d.timezone, e.timezone), status = coalesce(d.status, e.status),
    date_precision = coalesce(d.date_precision, e.date_precision), confidence = coalesce(d.confidence, e.confidence),
    source_url = coalesce(d.source_url, e.source_url),
    external_ids = e.external_ids || coalesce(d.external_ids, '{}'::jsonb),
    tags = (select array_agg(distinct t) from unnest(e.tags || coalesce(d.tags, '{}')) t),
    regions = (select array_agg(distinct r) from unnest(e.regions || coalesce(d.regions, '{}')) r),
    popularity = greatest(e.popularity, coalesce(d.popularity, 0)), featured = e.featured or coalesce(d.featured, false),
    location = coalesce(d.location, e.location), jsonld_eligible = e.jsonld_eligible or coalesce(d.jsonld_eligible, false),
    series_slug = coalesce(e.series_slug, d.series_slug),
    image_candidate_url = coalesce(e.image_candidate_url, d.image_candidate_url),
    image_candidate_meta = coalesce(e.image_candidate_meta, d.image_candidate_meta),
    content_hash = d.content_hash, last_seen_at = now()
  from _drift d where e.id = d.event_id;
  get diagnostics v_drift = row_count;
  insert into public.event_sources (source_key, source, event_id, content_hash, source_url, raw)
    select source_key, source, event_id, content_hash, source_url, raw from _drift
    on conflict (source_key) do update set content_hash = excluded.content_hash, source_url = excluded.source_url, raw = excluded.raw, last_seen_at = now();
  delete from _src s using _drift d where s.source_key = d.source_key;
  delete from _src s using public.events e where e.source_key = s.source_key and e.slug <> s.slug;  -- slug taken: skip

  -- 2) normal path: conflict on slug with rank-aware merge (strict '>' like seed.mjs)
  create temp table _up on commit drop as
  with up as (
    insert into public.events (id, slug, title, description, summary, date, end_date, all_day, timezone, category, tags, regions,
      source, source_url, source_key, external_ids, status, date_precision, confidence, featured, popularity, series_slug, location,
      jsonld_eligible, image_candidate_url, image_candidate_meta, image_status, content_hash)
    select s.slug, s.slug, s.title, coalesce(s.description, ''), s.summary, s.date, s.end_date, coalesce(s.all_day, true), s.timezone,
      s.category, coalesce(s.tags, '{}'), coalesce(s.regions, '{GLOBAL}'), s.source, s.source_url, s.source_key,
      coalesce(s.external_ids, '{}'::jsonb), coalesce(s.status, 'scheduled'), coalesce(s.date_precision, 'day'), coalesce(s.confidence, 1.0),
      coalesce(s.featured, false), coalesce(s.popularity, 20), s.series_slug, s.location, coalesce(s.jsonld_eligible, false),
      s.image_candidate_url, s.image_candidate_meta,
      case when s.image_candidate_url is not null then 'pending' else 'none' end, s.content_hash
    from _src s
    on conflict (slug) do update set
      title = case when (source_rank(excluded.source) > source_rank(events.source) or excluded.source_key = events.source_key) then excluded.title else events.title end,
      description = case when (source_rank(excluded.source) > source_rank(events.source) or excluded.source_key = events.source_key) and excluded.description <> '' then excluded.description
                         when events.description = '' then excluded.description else events.description end,
      summary = coalesce(events.summary, excluded.summary),
      category = case when (source_rank(excluded.source) > source_rank(events.source) or excluded.source_key = events.source_key) then excluded.category else events.category end,
      date = case when (source_rank(excluded.source) > source_rank(events.source) or excluded.source_key = events.source_key)
                    or (position('T' in excluded.date) > 0 and position('T' in events.date) = 0) then excluded.date else events.date end,
      all_day = case when (source_rank(excluded.source) > source_rank(events.source) or excluded.source_key = events.source_key)
                    or (position('T' in excluded.date) > 0 and position('T' in events.date) = 0) then excluded.all_day else events.all_day end,
      timezone = coalesce(events.timezone, excluded.timezone),
      end_date = case when (source_rank(excluded.source) > source_rank(events.source) or excluded.source_key = events.source_key) then coalesce(excluded.end_date, events.end_date) else coalesce(events.end_date, excluded.end_date) end,
      date_precision = case when (source_rank(excluded.source) > source_rank(events.source) or excluded.source_key = events.source_key) then excluded.date_precision else events.date_precision end,
      confidence = greatest(events.confidence, excluded.confidence),
      status = case when excluded.status in ('cancelled', 'postponed') then excluded.status
                    when (source_rank(excluded.source) > source_rank(events.source) or excluded.source_key = events.source_key) then excluded.status else events.status end,
      source = case when (source_rank(excluded.source) > source_rank(events.source) or excluded.source_key = events.source_key) then excluded.source else events.source end,
      source_url = case when (source_rank(excluded.source) > source_rank(events.source) or excluded.source_key = events.source_key) then coalesce(excluded.source_url, events.source_url) else coalesce(events.source_url, excluded.source_url) end,
      source_key = case when (source_rank(excluded.source) > source_rank(events.source) or excluded.source_key = events.source_key) then excluded.source_key else events.source_key end,
      content_hash = case when (source_rank(excluded.source) > source_rank(events.source) or excluded.source_key = events.source_key) then excluded.content_hash else events.content_hash end,
      external_ids = events.external_ids || excluded.external_ids,
      tags = (select array_agg(distinct t) from unnest(events.tags || excluded.tags) t),
      regions = (select array_agg(distinct r) from unnest(events.regions || excluded.regions) r),
      popularity = greatest(events.popularity, excluded.popularity),
      featured = events.featured or excluded.featured,
      series_slug = coalesce(events.series_slug, excluded.series_slug),
      location = coalesce(events.location, excluded.location),
      jsonld_eligible = events.jsonld_eligible or excluded.jsonld_eligible,
      image_candidate_url = coalesce(events.image_candidate_url, excluded.image_candidate_url),
      image_candidate_meta = coalesce(events.image_candidate_meta, excluded.image_candidate_meta),
      image_status = case when events.image_status = 'none' and excluded.image_candidate_url is not null then 'pending' else events.image_status end,
      last_seen_at = now()
    returning (xmax = 0) as is_insert, id, slug)
  select * from up;
  select count(*) filter (where is_insert), count(*) filter (where not is_insert) into v_ins, v_upd from _up;
  insert into public.event_sources (source_key, source, event_id, content_hash, source_url, raw)
    select s.source_key, s.source, u.id, s.content_hash, s.source_url, s.raw from _src s join _up u on u.slug = s.slug
    on conflict (source_key) do update set event_id = excluded.event_id, content_hash = excluded.content_hash,
      source_url = excluded.source_url, raw = excluded.raw, last_seen_at = now();
  return query select v_ins, v_upd, v_unchanged, v_drift;
end $$;
grant execute on function public.upsert_events(jsonb) to service_role;
