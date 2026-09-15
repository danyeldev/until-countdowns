-- Display name and unique handle for each account.
-- Authorization never reads these values from user_metadata.

create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  handle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_name_len check (char_length(name) <= 80),
  constraint profiles_handle_format check (handle is null or handle ~ '^[a-z][a-z0-9_]{2,19}$')
);

create unique index profiles_handle_unique on public.profiles (handle) where handle is not null;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_user_collection();

alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke all on table public.profiles from anon, public;
grant select, insert, update on table public.profiles to authenticated;

create or replace function private.sync_profile_from_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_handle text;
begin
  v_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')), '');
  if v_name is not null and char_length(v_name) > 80 then
    v_name := left(v_name, 80);
  end if;
  v_handle := lower(nullif(btrim(coalesce(new.raw_user_meta_data ->> 'handle', '')), ''));
  if v_handle is not null and v_handle !~ '^[a-z][a-z0-9_]{2,19}$' then
    v_handle := null;
  end if;
  insert into public.profiles (id, name, handle)
  values (new.id, coalesce(v_name, ''), v_handle);
  return new;
exception
  when unique_violation then
    raise exception 'handle_taken' using errcode = 'P0001';
end;
$$;

revoke all on function private.sync_profile_from_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.sync_profile_from_user();

-- Boolean-only uniqueness check. Does not expose other profile rows.
create function public.handle_available(p_handle text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1
    from public.profiles
    where handle = lower(nullif(btrim(p_handle), ''))
  );
$$;

revoke all on function public.handle_available(text) from public;
grant execute on function public.handle_available(text) to anon, authenticated;

insert into public.profiles (id, name)
select
  id,
  left(coalesce(nullif(btrim(coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', '')), ''), ''), 80)
from auth.users
on conflict (id) do nothing;
