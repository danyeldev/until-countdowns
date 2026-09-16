-- Public countdown collections. Identity comes from profiles, never user_metadata.
-- Anyone can read a collection. Only the owner can write it.

create table public.event_collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  slug text not null,
  title text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug),
  constraint event_collections_slug_format check (slug ~ '^[a-z][a-z0-9-]{1,59}$'),
  constraint event_collections_title_len check (char_length(title) between 1 and 80),
  constraint event_collections_description_len check (char_length(description) <= 500)
);

create table public.event_collection_items (
  collection_id uuid not null references public.event_collections (id) on delete cascade,
  event_key text not null,
  snapshot jsonb not null,
  position int not null default 0,
  added_at timestamptz not null default now(),
  primary key (collection_id, event_key),
  constraint event_collection_items_key_format check (
    event_key ~ '^[a-z0-9-]{1,200}$'
    and event_key not like 'share-%'
  ),
  constraint event_collection_items_position_ok check (position >= 0)
);

create table public.event_collection_images (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.event_collections (id) on delete cascade,
  path text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (collection_id, path),
  constraint event_collection_images_path_format check (
    path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9._-]{1,80}$'
  ),
  constraint event_collection_images_position_ok check (position >= 0)
);

create index event_collections_owner_created_idx
  on public.event_collections (owner_id, created_at desc);
create index event_collection_items_collection_pos_idx
  on public.event_collection_items (collection_id, position, added_at);
create index event_collection_images_collection_pos_idx
  on public.event_collection_images (collection_id, position);

create trigger event_collections_touch
  before update on public.event_collections
  for each row execute function public.touch_user_collection();

create function private.event_collections_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_handle text;
  v_count int;
begin
  select handle into v_handle
  from public.profiles
  where id = new.owner_id;

  if v_handle is null then
    raise exception 'profile_incomplete' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    select count(*) into v_count
    from public.event_collections
    where owner_id = new.owner_id;
    if v_count >= 20 then
      raise exception 'collection_limit' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.event_collections_before_write() from public, anon, authenticated;

create trigger event_collections_before_write
  before insert or update on public.event_collections
  for each row execute function private.event_collections_before_write();

create function private.event_collection_items_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if jsonb_typeof(new.snapshot) is distinct from 'object' then
    raise exception 'invalid_snapshot' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    select count(*) into v_count
    from public.event_collection_items
    where collection_id = new.collection_id;
    if v_count >= 50 then
      raise exception 'collection_items_limit' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.event_collection_items_before_write() from public, anon, authenticated;

create trigger event_collection_items_before_write
  before insert or update on public.event_collection_items
  for each row execute function private.event_collection_items_before_write();

create function private.event_collection_images_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_count int;
begin
  select owner_id into v_owner
  from public.event_collections
  where id = new.collection_id;

  if v_owner is null
     or split_part(new.path, '/', 1) is distinct from v_owner::text
     or split_part(new.path, '/', 2) is distinct from new.collection_id::text then
    raise exception 'invalid_image_path' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    select count(*) into v_count
    from public.event_collection_images
    where collection_id = new.collection_id;
    if v_count >= 6 then
      raise exception 'collection_images_limit' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.event_collection_images_before_write() from public, anon, authenticated;

create trigger event_collection_images_before_write
  before insert or update on public.event_collection_images
  for each row execute function private.event_collection_images_before_write();

alter table public.event_collections enable row level security;
alter table public.event_collection_items enable row level security;
alter table public.event_collection_images enable row level security;

create policy event_collections_select_public on public.event_collections
  for select to anon, authenticated
  using (true);
create policy event_collections_insert_own on public.event_collections
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy event_collections_update_own on public.event_collections
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy event_collections_delete_own on public.event_collections
  for delete to authenticated
  using ((select auth.uid()) = owner_id);

create policy event_collection_items_select_public on public.event_collection_items
  for select to anon, authenticated
  using (true);
create policy event_collection_items_insert_own on public.event_collection_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.event_collections c
      where c.id = collection_id and c.owner_id = (select auth.uid())
    )
  );
create policy event_collection_items_update_own on public.event_collection_items
  for update to authenticated
  using (
    exists (
      select 1 from public.event_collections c
      where c.id = collection_id and c.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.event_collections c
      where c.id = collection_id and c.owner_id = (select auth.uid())
    )
  );
create policy event_collection_items_delete_own on public.event_collection_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.event_collections c
      where c.id = collection_id and c.owner_id = (select auth.uid())
    )
  );

create policy event_collection_images_select_public on public.event_collection_images
  for select to anon, authenticated
  using (true);
create policy event_collection_images_insert_own on public.event_collection_images
  for insert to authenticated
  with check (
    exists (
      select 1 from public.event_collections c
      where c.id = collection_id and c.owner_id = (select auth.uid())
    )
  );
create policy event_collection_images_update_own on public.event_collection_images
  for update to authenticated
  using (
    exists (
      select 1 from public.event_collections c
      where c.id = collection_id and c.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.event_collections c
      where c.id = collection_id and c.owner_id = (select auth.uid())
    )
  );
create policy event_collection_images_delete_own on public.event_collection_images
  for delete to authenticated
  using (
    exists (
      select 1 from public.event_collections c
      where c.id = collection_id and c.owner_id = (select auth.uid())
    )
  );

revoke all on table public.event_collections from anon, public;
revoke all on table public.event_collection_items from anon, public;
revoke all on table public.event_collection_images from anon, public;
grant select on table public.event_collections to anon, authenticated;
grant select on table public.event_collection_items to anon, authenticated;
grant select on table public.event_collection_images to anon, authenticated;
grant insert, update, delete on table public.event_collections to authenticated;
grant insert, update, delete on table public.event_collection_items to authenticated;
grant insert, update, delete on table public.event_collection_images to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'collection-images',
  'collection-images',
  true,
  5242880,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy collection_images_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'collection-images');
create policy collection_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'collection-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy collection_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'collection-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'collection-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy collection_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'collection-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

notify pgrst, 'reload schema';
