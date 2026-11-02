-- キメ友SNS: ベル通知とプッシュ通知の対象を 3 つに限定する
--   1. グループチャット（リアルタイムチャット）に新しいメッセージ
--   2. 個人チャット（DM）が届いた
--   3. 自分のタイムライン投稿にコメントが付いた
--   4. 自分のコメントに返信が付いた
-- この表に行が追加されたときだけ、Webhook 経由でプッシュ通知を送る。

create table if not exists public.kimetomo_bell_notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  actor_id uuid,
  ref_id text,
  body text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- 何度実行しても大丈夫なように、列と種類の制限をここで整える
alter table public.kimetomo_bell_notifications add column if not exists push_text text;
alter table public.kimetomo_bell_notifications add column if not exists url text;
alter table public.kimetomo_bell_notifications drop constraint if exists kimetomo_bell_notifications_kind_check;
alter table public.kimetomo_bell_notifications add constraint kimetomo_bell_notifications_kind_check
  check (kind in ('chat', 'dm', 'comment', 'reply'));

create index if not exists kimetomo_bell_recipient_idx
  on public.kimetomo_bell_notifications (recipient_id, created_at desc);

alter table public.kimetomo_bell_notifications enable row level security;

drop policy if exists "bell own select" on public.kimetomo_bell_notifications;
drop policy if exists "bell own update" on public.kimetomo_bell_notifications;
create policy "bell own select" on public.kimetomo_bell_notifications
  for select to authenticated using (auth.uid() = recipient_id);
create policy "bell own update" on public.kimetomo_bell_notifications
  for update to authenticated using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);

-- 受信者が送信者をブロックしているか
create or replace function public.kimetomo_bell_blocked(recipient uuid, actor uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_blocks where blocker_id = recipient and blocked_id = actor);
$$;

-- 通知に表示する名前
create or replace function public.kimetomo_bell_name(uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select display_name from public.circle_profiles where user_id = uid), '友達');
$$;

-- 1. グループチャット
create or replace function public.kimetomo_bell_on_chat()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  select m.user_id, 'chat', new.sender_id, new.room_id::text, left(coalesce(new.body, ''), 80),
         public.kimetomo_bell_name(new.sender_id) || 'さんがグループチャットに投稿しました', './?tab=chat'
  from public.circle_room_members m
  where m.room_id = new.room_id
    and m.user_id <> new.sender_id
    and not public.kimetomo_bell_blocked(m.user_id, new.sender_id);
  return new;
end $$;

drop trigger if exists kimetomo_bell_chat on public.circle_messages;
create trigger kimetomo_bell_chat after insert on public.circle_messages
  for each row execute function public.kimetomo_bell_on_chat();

-- 2. 個人チャット
create or replace function public.kimetomo_bell_on_dm()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid;
begin
  select case when c.user_a = new.sender_id then c.user_b else c.user_a end
    into target
  from public.kimetomo_direct_conversations c
  where c.id = new.conversation_id;

  if target is not null and target <> new.sender_id
     and not public.kimetomo_bell_blocked(target, new.sender_id) then
    insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
    values (target, 'dm', new.sender_id, new.sender_id::text, left(coalesce(new.body, ''), 80),
            public.kimetomo_bell_name(new.sender_id) || 'さんから個人チャットが届きました',
            './dm.html?to=' || new.sender_id::text);
  end if;
  return new;
end $$;

drop trigger if exists kimetomo_bell_dm on public.kimetomo_direct_messages;
create trigger kimetomo_bell_dm after insert on public.kimetomo_direct_messages
  for each row execute function public.kimetomo_bell_on_dm();

-- 3. 自分の投稿へのコメント / 4. 自分のコメントへの返信
create or replace function public.kimetomo_bell_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  parent_author uuid;
  who text := public.kimetomo_bell_name(new.author_id);
  link text := './?post=' || new.post_id::text;
  snippet text := left(coalesce(new.body, ''), 80);
begin
  select p.author_id into owner from public.kimetomo_timeline_posts p where p.id = new.post_id;

  if owner is not null and owner <> new.author_id
     and not public.kimetomo_bell_blocked(owner, new.author_id) then
    insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
    values (owner, 'comment', new.author_id, new.post_id::text, snippet,
            who || 'さんがあなたの投稿にコメントしました', link);
  end if;

  if new.parent_id is not null then
    select c.author_id into parent_author from public.kimetomo_timeline_comments c where c.id = new.parent_id;
    -- 投稿者本人への通知と重ならないようにする
    if parent_author is not null and parent_author <> new.author_id
       and parent_author is distinct from owner
       and not public.kimetomo_bell_blocked(parent_author, new.author_id) then
      insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
      values (parent_author, 'reply', new.author_id, new.post_id::text, snippet,
              who || 'さんがあなたのコメントに返信しました', link);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists kimetomo_bell_comment on public.kimetomo_timeline_comments;
create trigger kimetomo_bell_comment after insert on public.kimetomo_timeline_comments
  for each row execute function public.kimetomo_bell_on_comment();
