-- People can flag a public countdown or suggest a correction.
-- Authorization uses profiles + auth.uid(), never user_metadata.

create table public.event_reports (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.events (id) on delete cascade,
  event_key text not null,
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null,
  body text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint event_reports_event_id_format check (
    event_id ~ '^[a-z0-9-]{1,200}$' and event_id !~ '^(mine|share)-'
  ),
  constraint event_reports_event_key_format check (
    event_key ~ '^[a-z0-9-]{1,200}$' and event_key !~ '^(mine|share)-'
  ),
  constraint event_reports_kind check (kind in ('wrong_date', 'wrong_details', 'outdated', 'other')),
  constraint event_reports_body_len check (char_length(btrim(body)) between 8 and 1000),
  constraint event_reports_status check (status in ('open', 'closed'))
);

create index event_reports_event_idx on public.event_reports (event_id, created_at desc);
create index event_reports_reporter_idx on public.event_reports (reporter_id, created_at desc);

create function private.event_reports_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_published boolean;
  v_event_count integer;
  v_day_count integer;
begin
  if not exists (select 1 from public.profiles where id = new.reporter_id) then
    raise exception 'profile_missing' using errcode = 'P0001';
  end if;

  select published into v_published
  from public.events
  where id = new.event_id;

  if not found or v_published is distinct from true then
    raise exception 'event_missing' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    select count(*) into v_event_count
    from public.event_reports
    where event_id = new.event_id
      and reporter_id = new.reporter_id;
    if v_event_count >= 3 then
      raise exception 'report_event_limit' using errcode = 'P0001';
    end if;

    select count(*) into v_day_count
    from public.event_reports
    where reporter_id = new.reporter_id
      and created_at > now() - interval '24 hours';
    if v_day_count >= 10 then
      raise exception 'report_day_limit' using errcode = 'P0001';
    end if;
  end if;

  new.body := btrim(new.body);
  return new;
end;
$$;

revoke all on function private.event_reports_before_write() from public, anon, authenticated;

create trigger event_reports_before_write
  before insert or update of body, kind, event_id, event_key, reporter_id
  on public.event_reports
  for each row execute function private.event_reports_before_write();

alter table public.event_reports enable row level security;

create policy event_reports_select_own on public.event_reports
  for select to authenticated
  using ((select auth.uid()) = reporter_id);
create policy event_reports_insert on public.event_reports
  for insert to authenticated
  with check ((select auth.uid()) = reporter_id);

revoke all on table public.event_reports from anon, public;
grant select, insert on table public.event_reports to authenticated;
