-- 0009_indexable_summary.sql: the publication gate counts an enrichment summary as body text
-- (Wikidata/Wikipedia rows carry placeholder descriptions until the Wikipedia summary job fills `summary`).
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
grant execute on function public.finalize_catalog() to service_role;
