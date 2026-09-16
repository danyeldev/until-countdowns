-- Live hype totals for countdown pages. Authorization uses visitor ids minted
-- by the API (cookie or signed-in user), never user_metadata.

create schema if not exists private;

create table public.event_hype (
  event_key text primary key,
  points integer not null default 0,
  last_kind text,
  last_points integer,
  updated_at timestamptz not null default now(),
  constraint event_hype_event_key_format check (event_key ~ '^[a-z0-9-]{1,200}$'),
  constraint event_hype_points_nonneg check (points >= 0),
  constraint event_hype_last_kind_ok check (
    last_kind is null
    or last_kind in ('visit', 'save', 'calendar', 'share', 'comment')
  )
);

create table public.event_hype_actions (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  kind text not null,
  points integer not null,
  visitor_id text not null,
  created_at timestamptz not null default now(),
  constraint event_hype_actions_event_key_format check (event_key ~ '^[a-z0-9-]{1,200}$'),
  constraint event_hype_actions_kind_ok check (kind in ('visit', 'save', 'calendar', 'share', 'comment')),
  constraint event_hype_actions_points_pos check (points > 0),
  constraint event_hype_actions_visitor_format check (visitor_id ~ '^(u|v):[a-z0-9-]{8,80}$')
);

create unique index event_hype_visit_daily_idx
  on public.event_hype_actions (event_key, visitor_id, ((timezone('utc', created_at))::date))
  where kind = 'visit';

create unique index event_hype_once_idx
  on public.event_hype_actions (event_key, visitor_id, kind)
  where kind in ('save', 'calendar', 'share');

create index event_hype_actions_visitor_hour_idx
  on public.event_hype_actions (visitor_id, created_at desc);

create function private.apply_event_hype(p_event_key text, p_kind text, p_visitor_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_points integer;
  v_added integer := 0;
  v_total integer := 0;
  v_hour integer;
begin
  if p_event_key is null or p_event_key !~ '^[a-z0-9-]{1,200}$' then
    raise exception 'hype_event_key' using errcode = 'P0001';
  end if;
  if p_kind not in ('visit', 'save', 'calendar', 'share', 'comment') then
    raise exception 'hype_kind' using errcode = 'P0001';
  end if;
  if p_visitor_id is null or p_visitor_id !~ '^(u|v):[a-z0-9-]{8,80}$' then
    raise exception 'hype_visitor' using errcode = 'P0001';
  end if;

  v_points := case p_kind
    when 'visit' then 1
    when 'save' then 5
    when 'calendar' then 10
    when 'share' then 15
    when 'comment' then 20
  end;

  select count(*) into v_hour
  from public.event_hype_actions
  where visitor_id = p_visitor_id
    and created_at > now() - interval '1 hour';
  if v_hour >= 40 then
    select points into v_total from public.event_hype where event_key = p_event_key;
    return jsonb_build_object('points', coalesce(v_total, 0), 'added', 0, 'kind', p_kind);
  end if;

  begin
    insert into public.event_hype_actions (event_key, kind, points, visitor_id)
    values (p_event_key, p_kind, v_points, p_visitor_id);
    v_added := v_points;
  exception
    when unique_violation then
      select points into v_total from public.event_hype where event_key = p_event_key;
      return jsonb_build_object('points', coalesce(v_total, 0), 'added', 0, 'kind', p_kind);
  end;

  insert into public.event_hype as totals (event_key, points, last_kind, last_points, updated_at)
  values (p_event_key, v_points, p_kind, v_points, now())
  on conflict (event_key) do update
    set points = totals.points + excluded.points,
        last_kind = excluded.last_kind,
        last_points = excluded.last_points,
        updated_at = now();

  select points into v_total from public.event_hype where event_key = p_event_key;
  return jsonb_build_object('points', v_total, 'added', v_added, 'kind', p_kind);
end;
$$;

revoke all on function private.apply_event_hype(text, text, text) from public, anon, authenticated;

create function public.record_event_hype(p_event_key text, p_kind text, p_visitor_id text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.apply_event_hype(p_event_key, p_kind, p_visitor_id);
$$;

revoke all on function public.record_event_hype(text, text, text) from public;
grant execute on function public.record_event_hype(text, text, text) to anon, authenticated;

create function private.event_comments_award_hype()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.apply_event_hype(new.event_key, 'comment', 'u:' || new.author_id::text);
  return new;
exception
  when others then
    return new;
end;
$$;

revoke all on function private.event_comments_award_hype() from public, anon, authenticated;

create trigger event_comments_award_hype
  after insert on public.event_comments
  for each row execute function private.event_comments_award_hype();

create function private.user_saved_award_hype()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  select slug into v_key from public.events where id = new.event_id;
  v_key := lower(coalesce(v_key, new.event_id));
  if v_key !~ '^[a-z0-9-]{1,200}$' then
    return new;
  end if;
  perform private.apply_event_hype(v_key, 'save', 'u:' || new.user_id::text);
  return new;
exception
  when others then
    return new;
end;
$$;

revoke all on function private.user_saved_award_hype() from public, anon, authenticated;

create trigger user_saved_award_hype
  after insert on public.user_saved
  for each row execute function private.user_saved_award_hype();

alter table public.event_hype enable row level security;
alter table public.event_hype_actions enable row level security;

create policy event_hype_select on public.event_hype
  for select to anon, authenticated using (true);

revoke all on table public.event_hype from anon, public;
revoke all on table public.event_hype_actions from anon, public, authenticated;
grant select on table public.event_hype to anon, authenticated;

alter publication supabase_realtime add table public.event_hype;

notify pgrst, 'reload schema';
