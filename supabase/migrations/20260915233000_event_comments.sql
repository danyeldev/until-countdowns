-- Public conversation on countdown pages. Authorization uses profiles + auth.uid(),
-- never user_metadata.

create table public.event_comments (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  parent_id uuid references public.event_comments (id) on delete cascade,
  body text not null,
  vote_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_comments_event_key_format check (event_key ~ '^[a-z0-9-]{1,200}$'),
  constraint event_comments_body_len check (char_length(btrim(body)) between 1 and 2000),
  constraint event_comments_vote_count_nonneg check (vote_count >= 0)
);

create index event_comments_event_created_idx
  on public.event_comments (event_key, created_at desc);
create index event_comments_parent_idx
  on public.event_comments (parent_id)
  where parent_id is not null;
create index event_comments_author_idx
  on public.event_comments (author_id);

create table public.event_comment_votes (
  comment_id uuid not null references public.event_comments (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index event_comment_votes_user_idx on public.event_comment_votes (user_id);

create table public.event_comment_mentions (
  comment_id uuid not null references public.event_comments (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (comment_id, profile_id)
);

create trigger event_comments_touch before update on public.event_comments
  for each row execute function public.touch_user_collection();

create function private.event_comments_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_event text;
  v_parent_parent uuid;
  v_count integer;
begin
  if not exists (
    select 1
    from public.profiles
    where id = new.author_id
      and handle is not null
  ) then
    raise exception 'profile_incomplete' using errcode = 'P0001';
  end if;

  if new.parent_id is not null then
    select event_key, parent_id
      into v_parent_event, v_parent_parent
    from public.event_comments
    where id = new.parent_id;

    if not found then
      raise exception 'comment_parent_missing' using errcode = 'P0001';
    end if;
    if v_parent_event is distinct from new.event_key then
      raise exception 'comment_parent_mismatch' using errcode = 'P0001';
    end if;
    if v_parent_parent is not null then
      raise exception 'comment_reply_depth' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'INSERT' then
    select count(*) into v_count
    from public.event_comments
    where event_key = new.event_key
      and author_id = new.author_id;
    if v_count >= 50 then
      raise exception 'comment_limit' using errcode = 'P0001';
    end if;
  end if;

  new.body := btrim(new.body);
  return new;
end;
$$;

revoke all on function private.event_comments_before_write() from public, anon, authenticated;

create trigger event_comments_before_write
  before insert or update of body, parent_id, event_key, author_id
  on public.event_comments
  for each row execute function private.event_comments_before_write();

create function private.sync_comment_vote_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.event_comments
      set vote_count = vote_count + 1
      where id = new.comment_id;
    return new;
  end if;
  if tg_op = 'DELETE' then
    update public.event_comments
      set vote_count = greatest(vote_count - 1, 0)
      where id = old.comment_id;
    return old;
  end if;
  return null;
end;
$$;

revoke all on function private.sync_comment_vote_count() from public, anon, authenticated;

create trigger event_comment_votes_count
  after insert or delete on public.event_comment_votes
  for each row execute function private.sync_comment_vote_count();

alter table public.event_comments enable row level security;
alter table public.event_comment_votes enable row level security;
alter table public.event_comment_mentions enable row level security;

create policy event_comments_select on public.event_comments
  for select to anon, authenticated using (true);
create policy event_comments_insert on public.event_comments
  for insert to authenticated
  with check ((select auth.uid()) = author_id);
create policy event_comments_delete on public.event_comments
  for delete to authenticated
  using ((select auth.uid()) = author_id);

create policy event_comment_votes_select_own on public.event_comment_votes
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy event_comment_votes_insert on public.event_comment_votes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy event_comment_votes_delete on public.event_comment_votes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy event_comment_mentions_select on public.event_comment_mentions
  for select to anon, authenticated using (true);
create policy event_comment_mentions_insert on public.event_comment_mentions
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.event_comments
      where id = comment_id
        and author_id = (select auth.uid())
    )
  );

revoke all on table public.event_comments from anon, public;
revoke all on table public.event_comment_votes from anon, public;
revoke all on table public.event_comment_mentions from anon, public;

grant select on table public.event_comments to anon, authenticated;
grant insert, delete on table public.event_comments to authenticated;

grant select, insert, delete on table public.event_comment_votes to authenticated;

grant select on table public.event_comment_mentions to anon, authenticated;
grant insert on table public.event_comment_mentions to authenticated;
