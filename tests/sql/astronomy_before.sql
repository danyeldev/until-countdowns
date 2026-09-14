-- Seed representative pre-rebuild states before the astronomy correction migration.
insert into public.series(slug,title,category,recurrence) values
  ('september-equinox','September equinox','astronomy','{"kind":"fixed","month":9,"day":22}'),
  ('northern-hemisphere-summer-solstice','Northern Hemisphere summer solstice','astronomy','{"kind":"fixed","month":6,"day":21}');

insert into public.events(id,slug,title,date,all_day,date_precision,category,source,source_key,series_slug,featured) values
  ('verify-astro-drift','september-equinox-2026-09-22','September equinox','2026-09-22',true,'day','astronomy','curated','curated:september-equinox-2026-09-22','september-equinox',true),
  ('verify-astro-duplicate','northern-hemisphere-summer-solstice-2027-06-21','Northern Hemisphere summer solstice','2027-06-21',true,'day','astronomy','curated','curated:northern-hemisphere-summer-solstice-2027-06-21','northern-hemisphere-summer-solstice',true),
  ('verify-astro-computed','june-solstice-2027-06-21','June solstice','2027-06-21T14:10:34Z',false,'instant','astronomy','astronomy','astronomy:season:2027:jun-solstice',null,false),
  ('verify-astro-merged','september-equinox-2027-09-23','September equinox','2027-09-23T06:01:18Z',false,'day','astronomy','curated','curated:september-equinox-2027-09-23','september-equinox',true),
  ('verify-astro-reviewed','september-equinox-2028-09-22','September equinox','2028-09-22',true,'day','astronomy','curated','curated:september-equinox-2028-09-22','september-equinox',true),
  ('verify-astro-hidden','september-equinox-2029-09-22','September equinox','2029-09-22',true,'day','astronomy','curated','curated:september-equinox-2029-09-22','september-equinox',false),
  ('verify-astro-cancelled','september-equinox-2030-09-22','September equinox','2030-09-22',true,'day','astronomy','curated','curated:september-equinox-2030-09-22','september-equinox',false);
update public.events set source_url='https://example.com/independently-reviewed-date' where id='verify-astro-reviewed';
update public.events set source_url='https://github.com/cosinekitty/astronomy' where id='verify-astro-merged';
update public.events set published=false where id='verify-astro-hidden';
update public.events set status='cancelled' where id='verify-astro-cancelled';

-- This hash already matches the computed adapter payload. A hash-only ingestion
-- shortcut must not keep the row's stale curated ownership or day precision.
insert into public.event_sources(source_key,source,event_id,content_hash) values
  ('astronomy:season:2027:sep-equinox','astronomy','verify-astro-merged','d8ad5925cb956d1c3f24e62cc4a8a491e0f733a2718ec92a68026816f08c079b');
