-- In-app inbox. First kinds are comment reply and mention.
-- Authorization uses profiles + auth.uid(), never user_metadata.
-- Rows are written only by security-definer triggers.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  event_key text not null,
  comment_id uuid not null references public.event_comments (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_kind_known check (kind in ('comment_reply', 'comment_mention')),
  constraint notifications_event_key_format check (event_key ~ '^[a-z0-9-]{1,200}$'),
  constraint notifications_not_self check (user_id <> actor_id),
  constraint notifications_unique_event unique (user_id, comment_id, kind)
);

create index notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

create function private.notify_comment_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_author uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select author_id into v_parent_author
  from public.event_comments
  where id = new.parent_id;

  if v_parent_author is null or v_parent_author = new.author_id then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, kind, event_key, comment_id)
  values (v_parent_author, new.author_id, 'comment_reply', new.event_key, new.id)
  on conflict (user_id, comment_id, kind) do nothing;

  return new;
end;
$$;

revoke all on function private.notify_comment_reply() from public, anon, authenticated;

create trigger event_comments_notify_reply
  after insert on public.event_comments
  for each row execute function private.notify_comment_reply();

create function private.notify_comment_mention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
  v_event text;
  v_parent uuid;
  v_parent_author uuid;
begin
  select author_id, event_key, parent_id
    into v_author, v_event, v_parent
  from public.event_comments
  where id = new.comment_id;

  if v_author is null or v_author = new.profile_id then
    return new;
  end if;

  if v_parent is not null then
    select author_id into v_parent_author
    from public.event_comments
    where id = v_parent;
    if v_parent_author = new.profile_id then
      return new;
    end if;
  end if;

  insert into public.notifications (user_id, actor_id, kind, event_key, comment_id)
  values (new.profile_id, v_author, 'comment_mention', v_event, new.comment_id)
  on conflict (user_id, comment_id, kind) do nothing;

  return new;
end;
$$;

revoke all on function private.notify_comment_mention() from public, anon, authenticated;

create trigger event_comment_mentions_notify
  after insert on public.event_comment_mentions
  for each row execute function private.notify_comment_mention();

create function private.notifications_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := old.user_id;
  new.actor_id := old.actor_id;
  new.kind := old.kind;
  new.event_key := old.event_key;
  new.comment_id := old.comment_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

revoke all on function private.notifications_before_update() from public, anon, authenticated;

create trigger notifications_before_update
  before update on public.notifications
  for each row execute function private.notifications_before_update();

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy notifications_update_own on public.notifications
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.notifications from anon, public;
grant select, update, delete on table public.notifications to authenticated;

notify pgrst, 'reload schema';
