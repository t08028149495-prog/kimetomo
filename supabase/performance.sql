-- キメ友SNS: メンバーが増えても重くならないようにする（データベースの高速化）
--   1. よく使う検索に「索引（インデックス）」を付ける
--   2. 利用停止（BAN）などの確認を、1行ごとではなく1回の問い合わせにつき1回だけにする
-- データは変わりません。何度実行しても大丈夫です。

-- ========== 1. 索引 ==========
do $$
declare
  stmt text;
begin
  foreach stmt in array array[
    'create index if not exists km_posts_created_idx on public.kimetomo_timeline_posts (created_at desc)',
    'create index if not exists km_posts_author_idx on public.kimetomo_timeline_posts (author_id, created_at desc)',
    'create index if not exists km_comments_post_idx on public.kimetomo_timeline_comments (post_id, created_at)',
    'create index if not exists km_comments_parent_idx on public.kimetomo_timeline_comments (parent_id)',
    'create index if not exists km_reactions_post_idx on public.kimetomo_timeline_reactions (post_id)',
    'create index if not exists km_messages_room_idx on public.circle_messages (room_id, created_at desc)',
    'create index if not exists km_room_members_user_idx on public.circle_room_members (user_id)',
    'create index if not exists km_room_members_room_idx on public.circle_room_members (room_id)',
    'create index if not exists km_dm_conv_idx on public.kimetomo_direct_messages (conversation_id, created_at desc)',
    'create index if not exists km_dm_conv_a_idx on public.kimetomo_direct_conversations (user_a)',
    'create index if not exists km_dm_conv_b_idx on public.kimetomo_direct_conversations (user_b)',
    'create index if not exists km_blocks_blocker_idx on public.user_blocks (blocker_id)',
    'create index if not exists km_blocks_blocked_idx on public.user_blocks (blocked_id)',
    'create index if not exists km_bell_unread_idx on public.kimetomo_bell_notifications (recipient_id, kind, ref_id) where read_at is null',
    'create index if not exists km_moods_updated_idx on public.kimetomo_moods (updated_at desc)',
    'create index if not exists km_profiles_status_idx on public.circle_profiles (status)',
    'create index if not exists km_request_votes_req_idx on public.kimetomo_request_votes (request_id)'
  ] loop
    begin
      execute stmt;
    exception when undefined_table or undefined_column then
      raise notice 'skip: %', stmt;
    end;
  end loop;
end $$;

-- ========== 2. 確認を1回にまとめる ==========
-- 「(select 関数())」と書くと、1回の問い合わせにつき1回だけ計算される
do $$
declare
  t text;
begin
  if to_regprocedure('public.kimetomo_is_banned(uuid)') is null then
    return;
  end if;
  foreach t in array array[
    'circle_messages', 'circle_media', 'circle_rooms', 'circle_room_members',
    'kimetomo_direct_conversations', 'kimetomo_direct_messages',
    'kimetomo_timeline_posts', 'kimetomo_timeline_comments',
    'kimetomo_timeline_likes', 'kimetomo_timeline_reactions',
    'kimetomo_timeline_polls', 'kimetomo_timeline_poll_votes',
    'kimetomo_chat_reactions', 'kimetomo_moods'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "kimetomo not banned" on public.%I', t);
      execute format(
        'create policy "kimetomo not banned" on public.%I as restrictive for all to authenticated
           using (not (select public.kimetomo_is_banned())) with check (not (select public.kimetomo_is_banned()))', t);
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('public.kimetomo_timeline_polls') is not null then
    drop policy if exists "poll read" on public.kimetomo_timeline_polls;
    create policy "poll read" on public.kimetomo_timeline_polls
      for select to authenticated using ((select public.kimetomo_poll_member()));
  end if;
  if to_regclass('public.kimetomo_timeline_poll_votes') is not null then
    drop policy if exists "vote read" on public.kimetomo_timeline_poll_votes;
    create policy "vote read" on public.kimetomo_timeline_poll_votes
      for select to authenticated using ((select public.kimetomo_poll_member()));
  end if;
  if to_regclass('public.kimetomo_moods') is not null then
    drop policy if exists "mood read" on public.kimetomo_moods;
    create policy "mood read" on public.kimetomo_moods
      for select to authenticated using ((select public.kimetomo_mood_member()));
  end if;
end $$;

analyze;
