-- File a timed event under the day it happens, not the day UTC happens to be on.
--
-- `starts_on` was `left(date, 10)` — the UTC prefix of the instant. That is right for an all-day
-- date, which belongs to no zone in particular, and wrong for an instant: a 22:00 premiere in New
-- York is on the 12th where it airs, but its instant is `2026-09-13T02:00:00Z`, so it was filed,
-- slugged and listed on the 13th.
--
-- Adapters worked around it by throwing the time away. tvmaze kept an episode's `airstamp` only
-- while its UTC day still matched the local air day, which is why 95 of its 199 all-day rows have a
-- real `airtime` recorded in `event_sources.raw` and no time in the catalog. The workaround is
-- removed in the same change; this is what makes removing it safe.
--
-- `catalogDay()` in src/lib/time.ts computes the same day for the slug and for every listing. The
-- two definitions have to agree, so if you change one, change the other.

create or replace function public.events_before_write() returns trigger
language plpgsql set search_path to 'public' as $function$
begin
  if position('T' in new.date) > 0 then new.starts_at := new.date::timestamptz;
  else new.starts_at := (new.date || 'T00:00:00Z')::timestamptz; end if;

  if position('T' in new.date) > 0 and new.timezone is not null then
    begin
      new.starts_on := (new.starts_at at time zone new.timezone)::date;
    exception when others then
      -- An unrecognised zone must not fail a whole upsert batch; UTC is the honest fallback, and
      -- the same one `catalogDay()` takes.
      new.starts_on := left(new.date, 10)::date;
    end;
  else
    new.starts_on := left(new.date, 10)::date;
  end if;

  new.period_end := public.period_end_for(new.starts_on, new.end_date, new.date_precision);
  new.sort_at := case when new.date_precision in ('instant', 'day') then new.starts_at
                      else greatest(new.starts_at, (new.period_end::text || 'T00:00:00Z')::timestamptz - interval '1 day') end;
  if tg_op = 'INSERT' then new.id := coalesce(new.id, new.slug);
  else
    if new.date is distinct from old.date then
      new.date_history := old.date_history || jsonb_build_object('date', old.date, 'changed_at', now(), 'source', new.source);
    end if;
    if (to_jsonb(new) - 'last_seen_at' - 'updated_at' - 'search' - 'period_end' - 'sort_at')
       is distinct from (to_jsonb(old) - 'last_seen_at' - 'updated_at' - 'search' - 'period_end' - 'sort_at')
    then new.updated_at := now(); end if;
  end if;
  return new;
end $function$;

-- Rows already stored under the wrong day. A no-op assignment re-runs the trigger above; at the
-- time of writing this is 5 rows out of 416 timed ones, because most timed events are UTC-morning
-- launches and sky events whose UTC day was already their local day.
update public.events e
set date = e.date
where e.all_day = false
  and e.timezone is not null
  and exists (select 1 from pg_timezone_names z where z.name = e.timezone)
  and (e.starts_at at time zone e.timezone)::date <> e.starts_on;
