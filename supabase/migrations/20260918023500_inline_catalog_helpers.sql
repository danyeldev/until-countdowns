-- SQL-language functions that carry a SET clause are never inlined by the
-- planner (inline_function() gives up as soon as pg_proc.proconfig is set), so
-- event_heat() and event_days_until() ran through the per-call SQL function
-- executor: ~250 µs per row, ~4 s across the upcoming set inside
-- featured_upcoming() and search_events(p_sort => 'hot').
--
-- These helpers only use pg_catalog operators and functions, so they do not
-- need a pinned search_path. Dropping it lets the planner fold their bodies
-- into the calling query. (The Supabase "function_search_path_mutable" lint
-- will list them; that advisory targets functions that resolve schema objects,
-- which none of these do.)
--
-- event_heat also moves its arithmetic to double precision: numeric exp()/ln()
-- cost ~55 µs per row (870 ms across the upcoming set) versus ~2 µs in float8.
-- The result is cast back to numeric so callers and src/lib/heat.ts (which
-- already mirrors the formula in JS doubles) see the same shape. The recency
-- exponent is clamped at 30000 days: float8 exp() raises "underflow" once the
-- result rounds to zero (~92 years out), whereas beyond ~700 days the term is
-- already below 1e-5 and irrelevant to ordering.
create or replace function public.event_heat(
  p_popularity integer,
  p_featured boolean,
  p_days_until integer,
  p_hype integer
) returns numeric
language sql
immutable
parallel safe
as $$
  select (
    38 * exp(-least(greatest(coalesce(p_days_until, 120), 0), 30000)::float8 / 45.0)
    + 34 * least(
        1.15::float8,
        greatest(coalesce(p_popularity, 0), 0)::float8 / 100.0
          + case when p_featured then 0.25 else 0 end
      )
    + 28 * least(
        1.15::float8,
        ln(1 + greatest(coalesce(p_hype, 0), 0)::float8) / ln(81.0::float8)
      )
  )::numeric;
$$;

alter function public.event_days_until(boolean, date, timestamptz) reset search_path;
alter function public.event_is_upcoming(text, text, timestamptz, date, date, timestamptz) reset search_path;
alter function public.upcoming_until_for(text, timestamptz, date, date) reset search_path;
