-- 0001_core.sql
create extension if not exists pg_trgm with schema extensions;

-- array_to_string() is STABLE; generated columns require IMMUTABLE expressions
create or replace function public.tags_text(p text[]) returns text
language sql immutable parallel safe as $$ select coalesce(array_to_string(p, ' '), '') $$;

create table public.categories (
  slug text primary key, label text not null, blurb text not null default '',
  sort int not null default 100, enabled boolean not null default true);

create table public.sources (
  id text primary key, label text not null,
  rank smallint not null default 4,           -- merge precedence; strict '>' wins (ports seed.mjs mergeAll)
  homepage text, license text, attribution text, enabled boolean not null default true);

create or replace function public.source_rank(p_source text) returns int
language sql stable as $$ select coalesce((select rank from public.sources where id = p_source), 0)::int $$;

create table public.images (
  id uuid primary key default gen_random_uuid(), sha256 text not null unique,
  storage_path text not null, public_url text not null, width int not null, height int not null,
  thumbhash text, dominant_color text, provider text not null, origin_url text not null, origin_page text,
  license text not null, license_url text, author text, credit text not null, attribution_required boolean not null default true,
  last_checked_at timestamptz, created_at timestamptz not null default now());

create table public.series (
  slug text primary key, title text not null, description text not null default '', summary text,
  category text not null references public.categories(slug), tags text[] not null default '{}',
  regions text[] not null default '{GLOBAL}', recurrence jsonb, wikidata_qid text,
  image_id uuid references public.images(id) on delete set null, featured boolean not null default false,
  popularity int not null default 40, faq jsonb not null default '[]', published boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.series_aliases (alias text primary key, series_slug text not null references public.series(slug) on delete cascade);

create table public.events (
  id text primary key,                         -- first slug ever assigned; immutable (Save ids, ICS UID)
  slug text not null unique,                   -- slugify(title)-YYYY-MM-DD (same as seed.mjs makeEvent)
  title text not null check (length(title) between 2 and 200),
  description text not null default '', summary text,
  date text not null check (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'),   -- canonical string consumed by eventInstant()
  end_date text check (end_date is null or end_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'),
  all_day boolean not null default true,
  timezone text,                               -- IANA zone for local-time events; null = per-viewer date; UTC instants use date with 'T'
  starts_on date not null, starts_at timestamptz not null,   -- derived by trigger
  category text not null references public.categories(slug),
  tags text[] not null default '{}', regions text[] not null default '{GLOBAL}',
  source text not null references public.sources(id), source_url text,
  source_key text not null unique,             -- '<source>:<stable external id>' of the primary source
  external_ids jsonb not null default '{}'::jsonb,   -- {qid, ll2, tvmaze, ...}
  status text not null default 'scheduled' check (status in ('scheduled','tentative','postponed','cancelled','done','retired')),
  date_precision text not null default 'day' check (date_precision in ('instant','day','month','quarter','year','decade')),
  date_history jsonb not null default '[]'::jsonb,   -- [{date, changed_at, source, note}] for 'date changed' notices and previousStartDate
  confidence numeric(3,2) not null default 1.0,
  featured boolean not null default false, popularity int not null default 20 check (popularity between 0 and 100),
  series_slug text references public.series(slug) on delete set null,
  location jsonb,                              -- {name, city, country, lat, lng, url}
  jsonld_eligible boolean not null default false, indexable boolean not null default true,
  published boolean not null default true,
  image_id uuid references public.images(id) on delete set null,
  image_candidate_url text, image_candidate_meta jsonb,
  image_status text not null default 'none' check (image_status in ('none','pending','ok','failed','skip')),
  content_hash text,
  first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', public.tags_text(tags)), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')) stored,
  constraint events_slug_not_reserved check (slug not like 'mine-%' and slug not like 'share-%'),
  constraint events_end_after_start check (end_date is null or left(end_date, 10) >= left(date, 10)));

create or replace function public.events_before_write() returns trigger language plpgsql as $$
begin
  if position('T' in new.date) > 0 then new.starts_at := new.date::timestamptz;
  else new.starts_at := (new.date || 'T00:00:00Z')::timestamptz; end if;
  new.starts_on := left(new.date, 10)::date;
  if tg_op = 'INSERT' then new.id := coalesce(new.id, new.slug);
  else
    if new.date is distinct from old.date then
      new.date_history := old.date_history || jsonb_build_object('date', old.date, 'changed_at', now(), 'source', new.source);
    end if;
    if (to_jsonb(new) - 'last_seen_at' - 'updated_at' - 'search') is distinct from (to_jsonb(old) - 'last_seen_at' - 'updated_at' - 'search')
    then new.updated_at := now(); end if;
  end if;
  return new;
end $$;
create trigger events_before_write before insert or update on public.events for each row execute function public.events_before_write();

create index events_starts_at_idx on public.events (starts_at) where published;
create index events_category_starts_idx on public.events (category, starts_at) where published;
create index events_popularity_idx on public.events (popularity desc, starts_at) where published;
create index events_featured_idx on public.events (starts_at) where published and featured;
create index events_series_idx on public.events (series_slug, starts_on);
create index events_qid_idx on public.events ((external_ids->>'qid')) where external_ids ? 'qid';
create index events_tags_gin on public.events using gin (tags);
create index events_regions_gin on public.events using gin (regions);
create index events_search_gin on public.events using gin (search);
create index events_title_trgm on public.events using gin (lower(title) extensions.gin_trgm_ops);
create index events_image_pending_idx on public.events (popularity desc) where image_status = 'pending';
create index events_sitemap_idx on public.events (starts_on) where published and indexable;

create table public.event_sources (
  source_key text primary key, source text not null references public.sources(id),
  event_id text not null references public.events(id) on delete cascade,
  content_hash text not null, source_url text, raw jsonb,
  first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now());
create index event_sources_event_idx on public.event_sources (event_id);

create table public.event_slugs (slug text primary key, event_id text not null references public.events(id) on delete cascade, created_at timestamptz not null default now());

create table public.ingest_state (
  source text primary key, cursor jsonb, pass_started_at timestamptz, last_success_at timestamptz,
  consecutive_failures int not null default 0, backoff_until timestamptz,
  lease_token uuid, lease_expires_at timestamptz, updated_at timestamptz not null default now());

create table public.ingest_runs (
  id bigint generated always as identity primary key, source text not null, trigger text not null default 'cron',
  started_at timestamptz not null default now(), finished_at timestamptz,
  status text not null default 'running' check (status in ('running','ok','partial','error','skipped')),
  fetched int not null default 0, inserted int not null default 0, updated int not null default 0,
  unchanged int not null default 0, drifted int not null default 0, errors jsonb not null default '[]'::jsonb,
  cursor_out jsonb, duration_ms int);
create index ingest_runs_source_idx on public.ingest_runs (source, started_at desc);

create table public.enrichment_jobs (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('wikipedia_summary','image')),
  event_id text not null references public.events(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','done','failed','skipped')),
  attempts int not null default 0, next_attempt_at timestamptz not null default now(), last_error text,
  unique (kind, event_id));
create index enrichment_due_idx on public.enrichment_jobs (next_attempt_at) where status = 'pending';

create table public.catalog_stats (
  id boolean primary key default true check (id), count int not null default 0, featured int not null default 0,
  series_count int not null default 0, by_cat jsonb not null default '{}'::jsonb, by_src jsonb not null default '{}'::jsonb,
  by_country jsonb not null default '{}'::jsonb, top_tags jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now());
insert into public.catalog_stats (id) values (true);

create table public.search_log (id bigint generated always as identity primary key, q text not null, results int not null, at timestamptz not null default now());

create or replace view public.events_public with (security_invoker = true) as
select e.id, e.slug, e.title, e.description, e.summary, e.date, e.end_date, e.all_day, e.timezone, e.starts_on, e.starts_at,
       e.category, e.tags, e.regions, e.source, src.label as source_label, e.source_url, e.external_ids, e.status, e.date_precision,
       e.date_history, e.featured, e.popularity, e.series_slug, s.title as series_title, e.location, e.jsonld_eligible, e.indexable,
       e.last_seen_at, e.updated_at,
       case when e.all_day then (e.starts_on - current_date) else floor(extract(epoch from (e.starts_at - now())) / 86400)::int end as days_until,
       case when i.id is null then null else jsonb_build_object('url', i.public_url, 'width', i.width, 'height', i.height,
         'thumbhash', i.thumbhash, 'color', i.dominant_color, 'credit', i.credit, 'author', i.author, 'license', i.license,
         'licenseUrl', i.license_url, 'originPage', i.origin_page, 'provider', i.provider) end as image
from public.events e
left join public.series s on s.slug = e.series_slug
left join public.images i on i.id = e.image_id
left join public.sources src on src.id = e.source
where e.published;

create or replace view public.series_next with (security_invoker = true) as
select s.*, n.slug as next_slug, n.date as next_date, n.all_day as next_all_day, n.date_precision as next_precision,
       (n.starts_on - current_date) as days_until
from public.series s left join lateral (
  select slug, date, all_day, starts_on, date_precision from public.events
  where series_slug = s.slug and published and starts_on >= current_date order by starts_on limit 1) n on true
where s.published;

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
      title = case when source_rank(excluded.source) > source_rank(events.source) then excluded.title else events.title end,
      description = case when source_rank(excluded.source) > source_rank(events.source) and excluded.description <> '' then excluded.description
                         when events.description = '' then excluded.description else events.description end,
      summary = coalesce(events.summary, excluded.summary),
      category = case when source_rank(excluded.source) > source_rank(events.source) then excluded.category else events.category end,
      date = case when source_rank(excluded.source) > source_rank(events.source)
                    or (position('T' in excluded.date) > 0 and position('T' in events.date) = 0) then excluded.date else events.date end,
      all_day = case when source_rank(excluded.source) > source_rank(events.source)
                    or (position('T' in excluded.date) > 0 and position('T' in events.date) = 0) then excluded.all_day else events.all_day end,
      timezone = coalesce(events.timezone, excluded.timezone),
      end_date = case when source_rank(excluded.source) > source_rank(events.source) then coalesce(excluded.end_date, events.end_date) else coalesce(events.end_date, excluded.end_date) end,
      date_precision = case when source_rank(excluded.source) > source_rank(events.source) then excluded.date_precision else events.date_precision end,
      confidence = greatest(events.confidence, excluded.confidence),
      status = case when excluded.status in ('cancelled', 'postponed') then excluded.status
                    when source_rank(excluded.source) > source_rank(events.source) then excluded.status else events.status end,
      source = case when source_rank(excluded.source) > source_rank(events.source) then excluded.source else events.source end,
      source_url = case when source_rank(excluded.source) > source_rank(events.source) then coalesce(excluded.source_url, events.source_url) else coalesce(events.source_url, excluded.source_url) end,
      source_key = case when source_rank(excluded.source) > source_rank(events.source) then excluded.source_key else events.source_key end,
      content_hash = case when source_rank(excluded.source) > source_rank(events.source) then excluded.content_hash else events.content_hash end,
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

-- reads (port matchesQuery/searchEvents: 2-day window, past-12h rows sorted last for 'soonest')
create or replace function public.search_events(
  p_q text default null, p_category text default null, p_tag text default null, p_region text default null,
  p_featured boolean default false, p_region_codes text[] default '{}', p_sort text default 'soonest',
  p_min_popularity int default 0, p_page int default 1, p_page_size int default 24)
returns table (event jsonb, score int, total bigint) language sql stable as $$
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
    where pe.starts_at > now() - interval '2 days'
      and (p_category is null or pe.category = p_category)
      and (p_tag is null or pe.tags @> array[p_tag])
      and (p_region is null or pe.regions @> array[upper(p_region)] or pe.regions @> array['GLOBAL'])
      and (not p_featured or pe.featured) and pe.popularity >= p_min_popularity)
  select to_jsonb(pe) as event, score, count(*) over () as total from scored where score > 0
  order by case when p_sort = 'popular' then (pe).popularity end desc nulls last,
           case when p_sort = 'latest' then (pe).starts_at end desc nulls last,
           case when p_sort not in ('popular','latest') then ((pe).starts_at < now() - interval '12 hours') end asc,
           case when p_sort not in ('popular','latest') then score end desc,
           (pe).starts_at asc
  limit greatest(1, least(p_page_size, 100)) offset (greatest(p_page, 1) - 1) * greatest(1, least(p_page_size, 100));
$$;

create or replace function public.featured_upcoming(p_limit int default 5) returns setof public.events_public language sql stable as $$
  with future as (select * from public.events_public where featured and starts_at > now() - interval '6 hours'),
  curated as (select * from future where source = 'curated' and category <> 'history' order by starts_at, popularity desc limit p_limit),
  fallback as (select * from future where not exists (select 1 from curated) order by starts_at limit p_limit)
  select * from (select * from curated union all select * from fallback) u order by starts_at, popularity desc limit p_limit; $$;

create or replace function public.soonest_upcoming(p_limit int default 8) returns setof public.events_public language sql stable as $$
  select * from public.events_public where starts_at > now() - interval '6 hours' order by starts_at, popularity desc limit p_limit; $$;

create or replace function public.related_events(p_id text, p_limit int default 6) returns setof public.events_public language sql stable as $$
  with me as (select * from public.events where id = p_id)
  select pe.* from public.events_public pe, me
  where pe.id <> me.id and pe.starts_on >= me.starts_on and pe.starts_at > now()
  order by ((case when pe.category = me.category then 5 else 0 end)
    + 3 * cardinality(array(select unnest(pe.tags) intersect select unnest(me.tags)))
    + (case when pe.featured then 2 else 0 end) + pe.popularity / 50.0) desc, pe.starts_at asc
  limit p_limit; $$;

create or replace function public.top_slugs(p_limit int default 500) returns table (slug text) language sql stable as $$
  select slug from public.events where published and starts_at > now() order by popularity desc, starts_at limit p_limit; $$;
create or replace function public.category_counts() returns table (category text, n bigint) language sql stable as $$
  select category, count(*) from public.events where published and starts_at > now() - interval '2 days' group by 1; $$;
create or replace function public.popular_tags(p_limit int default 18) returns table (tag text, n bigint) language sql stable as $$
  select t, count(*) from public.events, unnest(tags) t where published and starts_at > now() - interval '2 days'
  and t not in ('wikipedia','wikidata') group by t order by 2 desc limit p_limit; $$;
create or replace function public.log_search(p_q text, p_results int) returns void language sql security definer set search_path = public as $$
  insert into public.search_log (q, results) select left(trim(p_q), 80), greatest(0, p_results) where length(trim(p_q)) between 2 and 80; $$;

-- ingestion helpers (service role only)
create or replace function public.acquire_source_lease(p_source text, p_ttl interval default interval '10 minutes') returns uuid language plpgsql as $$
declare tok uuid := gen_random_uuid();
begin
  insert into public.ingest_state (source) values (p_source) on conflict (source) do nothing;
  update public.ingest_state set lease_token = tok, lease_expires_at = now() + p_ttl, updated_at = now()
   where source = p_source and (lease_expires_at is null or lease_expires_at < now());
  if not found then return null; end if;
  return tok;
end $$;
create or replace function public.release_source_lease(p_source text, p_token uuid) returns void language sql as $$
  update public.ingest_state set lease_token = null, lease_expires_at = null, updated_at = now() where source = p_source and lease_token = p_token; $$;
create or replace function public.mark_stale_records(p_source text, p_pass_started timestamptz) returns int language sql as $$
  with u as (update public.events e set status = case when e.status = 'scheduled' then 'tentative' else e.status end, featured = false
    from public.event_sources es where es.event_id = e.id and es.source = p_source and e.source = p_source
      and es.last_seen_at < p_pass_started and e.starts_at > now() returning 1)
  select count(*)::int from u; $$;
create or replace function public.claim_enrichment_jobs(p_kind text, p_limit int default 60) returns setof public.enrichment_jobs language sql as $$
  update public.enrichment_jobs j set attempts = j.attempts + 1, next_attempt_at = now() + interval '30 minutes'
  where j.id in (select id from public.enrichment_jobs where status = 'pending' and kind = p_kind and next_attempt_at <= now()
                 order by next_attempt_at for update skip locked limit p_limit)
  returning j.*; $$;

-- nightly: statuses, indexability (publication gate), series linking, enrichment queue, stats
create or replace function public.finalize_catalog() returns void language plpgsql security definer set search_path = public as $$
begin
  update public.events set status = 'done' where status not in ('done','cancelled','retired') and coalesce(left(end_date, 10)::date, starts_on) < current_date - 1;
  -- publication gate: enough description, known precision (or labelled), attribution, not cancelled, not a series member (the series page is canonical)
  update public.events set indexable =
      length(description) >= 80 and source_url is not null and confidence >= 0.6
      and (date_precision in ('instant','day') or status = 'tentative')
      and status not in ('cancelled','retired') and starts_on >= current_date - 365 and published
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
    where e.published and e.starts_at > now() and (e.featured or e.popularity >= 45 or e.series_slug is not null)
      and (k.kind <> 'image' or e.image_id is null) and (k.kind <> 'wikipedia_summary' or e.summary is null)
    on conflict (kind, event_id) do nothing;
  insert into public.catalog_stats (id, count, featured, series_count, by_cat, by_src, by_country, top_tags, generated_at)
  select true,
    (select count(*) from public.events where published and starts_at > now() - interval '2 days'),
    (select count(*) from public.events where published and featured and starts_at > now() - interval '2 days'),
    (select count(*) from public.series where published),
    coalesce((select jsonb_object_agg(category, n) from public.category_counts()), '{}'::jsonb),
    coalesce((select jsonb_object_agg(source, n) from (select source, count(*) n from public.events where published and starts_at > now() - interval '2 days' group by 1) s), '{}'::jsonb),
    coalesce((select jsonb_object_agg(r, n) from (select r, count(*) n from public.events, unnest(regions) r where published and starts_at > now() - interval '2 days' group by r) c), '{}'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('tag', tag, 'count', n)) from public.popular_tags(40)), '[]'::jsonb), now()
  on conflict (id) do update set count = excluded.count, featured = excluded.featured, series_count = excluded.series_count,
    by_cat = excluded.by_cat, by_src = excluded.by_src, by_country = excluded.by_country, top_tags = excluded.top_tags, generated_at = excluded.generated_at;
end $$;

-- RLS: public read on catalog tables; ingestion tables service-role only
alter table public.categories enable row level security; alter table public.sources enable row level security;
alter table public.images enable row level security; alter table public.series enable row level security;
alter table public.series_aliases enable row level security; alter table public.events enable row level security;
alter table public.event_sources enable row level security; alter table public.event_slugs enable row level security;
alter table public.ingest_state enable row level security; alter table public.ingest_runs enable row level security;
alter table public.enrichment_jobs enable row level security; alter table public.catalog_stats enable row level security;
alter table public.search_log enable row level security;
create policy public_read on public.categories for select to anon, authenticated using (enabled);
create policy public_read on public.sources for select to anon, authenticated using (true);
create policy public_read on public.images for select to anon, authenticated using (true);
create policy public_read on public.series for select to anon, authenticated using (published);
create policy public_read on public.series_aliases for select to anon, authenticated using (true);
create policy public_read on public.events for select to anon, authenticated using (published);
create policy public_read on public.event_slugs for select to anon, authenticated using (true);
create policy public_read on public.catalog_stats for select to anon, authenticated using (true);
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
grant execute on function public.search_events(text, text, text, text, boolean, text[], text, int, int, int),
  public.featured_upcoming(int), public.soonest_upcoming(int), public.related_events(text, int),
  public.top_slugs(int), public.category_counts(), public.popular_tags(int), public.log_search(text, int)
  to anon, authenticated;
