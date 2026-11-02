-- キメ友SNS: 見直し後の追加設定
--   A. メンバーをブロックできるようにする
--   B. 「♡いいね」を「❤️リアクション」にまとめる
--   D. グループチャットの通知は、未読があるあいだ 1 回だけにする
-- 何度実行しても大丈夫です。

-- ========== A. ブロック ==========
alter table public.user_blocks enable row level security;

drop policy if exists "kimetomo block add own" on public.user_blocks;
create policy "kimetomo block add own" on public.user_blocks
  for insert to authenticated
  with check (blocker_id = auth.uid() and blocked_id <> auth.uid());

drop policy if exists "kimetomo block read own" on public.user_blocks;
create policy "kimetomo block read own" on public.user_blocks
  for select to authenticated using (blocker_id = auth.uid());

drop policy if exists "kimetomo block remove own" on public.user_blocks;
create policy "kimetomo block remove own" on public.user_blocks
  for delete to authenticated using (blocker_id = auth.uid());

-- ブロックしてきた相手には、個人チャットを送れないようにする
create or replace function public.kimetomo_dm_blocked(p_conversation anyelement, p_sender uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.kimetomo_direct_conversations c
    join public.user_blocks b
      on b.blocked_id = p_sender
     and b.blocker_id = case when c.user_a = p_sender then c.user_b else c.user_a end
    where c.id = p_conversation
  );
$$;

drop policy if exists "kimetomo dm not blocked" on public.kimetomo_direct_messages;
create policy "kimetomo dm not blocked" on public.kimetomo_direct_messages
  as restrictive for insert to authenticated
  with check (not public.kimetomo_dm_blocked(conversation_id, sender_id));

-- ========== B. いいね → ❤️リアクション ==========
-- これまでの「いいね」を ❤️ リアクションとして引き継ぐ
insert into public.kimetomo_timeline_reactions (post_id, user_id, emoji)
select l.post_id, l.user_id, '❤️'
from public.kimetomo_timeline_likes l
on conflict do nothing;

-- ========== D. グループチャットの通知をまとめる ==========
create or replace function public.kimetomo_bell_on_chat()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  select m.user_id, 'chat', new.sender_id, new.room_id::text, left(coalesce(new.body, ''), 80),
         public.kimetomo_bell_name(new.sender_id) || 'さんがグループチャットに投稿しました', './?tab=chat'
  from public.circle_room_members m
  where m.room_id = new.room_id
    and m.user_id <> new.sender_id
    and not public.kimetomo_bell_blocked(m.user_id, new.sender_id)
    -- 同じルームの未読のチャット通知がある人には送らない（読むまで 1 回だけ）
    and not exists (
      select 1 from public.kimetomo_bell_notifications n
      where n.recipient_id = m.user_id and n.kind = 'chat'
        and n.ref_id = new.room_id::text and n.read_at is null
    );
  return new;
end $$;
