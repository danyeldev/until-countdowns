-- Account-owned collection: catalog bookmarks and personal countdowns.
-- RLS is the access control. Anon has no policies and no grants.

create table public.user_countdowns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  slug text not null,
  title text not null,
  description text not null default '',
  date text not null,
  category text not null references public.categories (slug),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug),
  constraint user_countdowns_slug_format check (slug ~ '^mine-[a-z0-9-]{1,200}$'),
  constraint user_countdowns_title_len check (char_length(title) between 1 and 120),
  constraint user_countdowns_description_len check (char_length(description) <= 500),
  constraint user_countdowns_date_iso check (date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and date::date is not null)
);

create table public.user_saved (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  event_id text not null,
  snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id),
  constraint user_saved_event_id_format check (
    event_id ~ '^[a-zA-Z0-9_-]{1,200}$'
    and event_id not like 'mine-%'
    and event_id not like 'share-%'
  )
);

create or replace function public.touch_user_collection()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_countdowns_touch before update on public.user_countdowns
  for each row execute function public.touch_user_collection();
create trigger user_saved_touch before update on public.user_saved
  for each row execute function public.touch_user_collection();

create or replace function public.enforce_user_collection_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  n int;
begin
  if tg_table_name = 'user_saved' then
    select count(*) into n from public.user_saved where user_id = new.user_id;
  else
    select count(*) into n from public.user_countdowns where user_id = new.user_id;
  end if;
  if n >= 200 then
    raise exception 'collection_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger user_countdowns_limit before insert on public.user_countdowns
  for each row execute function public.enforce_user_collection_limit();
create trigger user_saved_limit before insert on public.user_saved
  for each row execute function public.enforce_user_collection_limit();

alter table public.user_countdowns enable row level security;
alter table public.user_saved enable row level security;

create policy user_countdowns_select on public.user_countdowns
  for select to authenticated using ((select auth.uid()) = user_id);
create policy user_countdowns_insert on public.user_countdowns
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_countdowns_update on public.user_countdowns
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy user_countdowns_delete on public.user_countdowns
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy user_saved_select on public.user_saved
  for select to authenticated using ((select auth.uid()) = user_id);
create policy user_saved_insert on public.user_saved
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_saved_update on public.user_saved
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy user_saved_delete on public.user_saved
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.user_countdowns from anon, public;
revoke all on table public.user_saved from anon, public;
grant select, insert, update, delete on table public.user_countdowns to authenticated;
grant select, insert, update, delete on table public.user_saved to authenticated;
