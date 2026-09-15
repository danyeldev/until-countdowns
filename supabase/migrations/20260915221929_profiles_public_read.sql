-- Public profiles are addressed by handle. Incomplete rows (no handle) stay private.

drop policy profiles_select on public.profiles;

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy profiles_select_public on public.profiles
  for select to anon, authenticated using (handle is not null);

grant select on table public.profiles to anon;
