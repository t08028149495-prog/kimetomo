-- キメ友SNS: ベル通知とプッシュ通知の対象を 3 つに限定する
--   1. グループチャット（リアルタイムチャット）に新しいメッセージ
--   2. 個人チャット（DM）が届いた
--   3. 自分のタイムライン投稿にコメントが付いた
-- この表に行が追加されたときだけ、Webhook 経由でプッシュ通知を送る。

create table if not exists public.kimetomo_bell_notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('chat', 'dm', 'comment')),
  actor_id uuid,
  ref_id text,
  body text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

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

-- 1. グループチャット
create or replace function public.kimetomo_bell_on_chat()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body)
  select m.user_id, 'chat', new.sender_id, new.room_id::text, left(coalesce(new.body, ''), 80)
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
    insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body)
    values (target, 'dm', new.sender_id, new.sender_id::text, left(coalesce(new.body, ''), 80));
  end if;
  return new;
end $$;

drop trigger if exists kimetomo_bell_dm on public.kimetomo_direct_messages;
create trigger kimetomo_bell_dm after insert on public.kimetomo_direct_messages
  for each row execute function public.kimetomo_bell_on_dm();

-- 3. 自分の投稿へのコメント
create or replace function public.kimetomo_bell_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
begin
  select p.author_id into owner from public.kimetomo_timeline_posts p where p.id = new.post_id;

  if owner is not null and owner <> new.author_id
     and not public.kimetomo_bell_blocked(owner, new.author_id) then
    insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body)
    values (owner, 'comment', new.author_id, new.post_id::text, left(coalesce(new.body, ''), 80));
  end if;
  return new;
end $$;

drop trigger if exists kimetomo_bell_comment on public.kimetomo_timeline_comments;
create trigger kimetomo_bell_comment after insert on public.kimetomo_timeline_comments
  for each row execute function public.kimetomo_bell_on_comment();
