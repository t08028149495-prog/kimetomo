-- キメ友SNS: Supabase の Advisors（Performance）の指摘を直す（2026-11-09）
--   1. 同じ索引（検索用の目次）が 2 つずつある → 片方を消す
--   2. 同じ内容のルール（RLS）が重なっている → 1 つにまとめる
--   3. 「本人か確認」（auth.uid()）を 1 行ごとに計算している → 1 回だけにする
--   4. 索引のない「つながり」（外部キー）に索引を足す
-- 「だれが何を見られる・できるか」は変わりません。データも変わりません。
-- 何度実行しても大丈夫です。

begin;

-- ========== 1. 重複した索引を消す（km_ で始まる方を残す） ==========
drop index if exists public.circle_messages_room_time_idx;          -- = km_messages_room_idx
drop index if exists public.kimetomo_bell_recipient_idx;            -- = km_bell_recipient_created_idx
drop index if exists public.kimetomo_dm_conversations_user_b;       -- = km_dm_conv_b_idx
drop index if exists public.kimetomo_dm_messages_lookup;            -- = km_dm_conv_idx
drop index if exists public.km_comments_post_date_idx;              -- = km_comments_post_idx
drop index if exists public.kimetomo_timeline_posts_created_at_idx; -- = km_posts_created_idx
drop index if exists public.user_blocks_blocked_idx;                -- = km_blocks_blocked_idx

-- ========== 2. 重なっているルールを 1 つにする ==========
-- 通知の登録：「Push subscription self ...」と全く同じなので消す
drop policy if exists "push own select" on public.kimetomo_push_subscriptions;
drop policy if exists "push own insert" on public.kimetomo_push_subscriptions;
drop policy if exists "push own update" on public.kimetomo_push_subscriptions;
drop policy if exists "push own delete" on public.kimetomo_push_subscriptions;

-- ブロック：「View / Remove / Create own blocks」と同じ（または、それより狭い）ので消す
drop policy if exists "kimetomo block read own" on public.user_blocks;
drop policy if exists "kimetomo block remove own" on public.user_blocks;
drop policy if exists "kimetomo block add own" on public.user_blocks;

-- 投稿の削除：自分の投稿 または 管理者
drop policy if exists "kimetomo admin delete post" on public.kimetomo_timeline_posts;
drop policy if exists timeline_posts_delete on public.kimetomo_timeline_posts;
create policy timeline_posts_delete on public.kimetomo_timeline_posts
  as permissive for delete to authenticated
  using ((author_id = (select auth.uid())) or (select public.kimetomo_caller_is_admin()));

-- コメントの削除：自分のコメント（利用中のメンバー） または 管理者
drop policy if exists "kimetomo admin delete comment" on public.kimetomo_timeline_comments;
drop policy if exists km_comments_delete on public.kimetomo_timeline_comments;
create policy km_comments_delete on public.kimetomo_timeline_comments
  as permissive for delete to authenticated
  using (((author_id = (select auth.uid())) and (select public.kimetomo_is_active_member()))
         or (select public.kimetomo_caller_is_admin()));

-- プロフィールを読む：承認済みのメンバー
drop policy if exists "kimetomo profile read approved" on public.kimetomo_user_profiles;
drop policy if exists kimetomo_member_profiles_read on public.kimetomo_user_profiles;
create policy kimetomo_member_profiles_read on public.kimetomo_user_profiles
  as permissive for select to authenticated
  using ((select public.kimetomo_is_approved((select auth.uid())))
         or exists (select 1 from public.circle_profiles p
                    where p.user_id = (select auth.uid()) and p.status = 'approved'));

-- ========== 3. auth.uid() を 1 回だけ計算する ==========
alter policy "bell own select" on public.kimetomo_bell_notifications
  using ((select auth.uid()) = recipient_id);
alter policy "bell own update" on public.kimetomo_bell_notifications
  using ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);

alter policy "chat reaction remove own" on public.kimetomo_chat_reactions
  using (user_id = (select auth.uid()));
alter policy "chat reaction add own" on public.kimetomo_chat_reactions
  with check ((user_id = (select auth.uid())) and public.kimetomo_chat_reaction_allowed(message_id));

alter policy dm_conversations_insert on public.kimetomo_direct_conversations
  with check ((((select auth.uid()) = user_a) or ((select auth.uid()) = user_b))
              and public.kimetomo_is_approved((select auth.uid()))
              and public.kimetomo_is_approved(user_a) and public.kimetomo_is_approved(user_b));
alter policy dm_conversations_select on public.kimetomo_direct_conversations
  using ((((select auth.uid()) = user_a) or ((select auth.uid()) = user_b))
         and public.kimetomo_is_approved((select auth.uid()))
         and public.kimetomo_is_approved(user_a) and public.kimetomo_is_approved(user_b));

alter policy dm_messages_insert on public.kimetomo_direct_messages
  with check ((sender_id = (select auth.uid())) and public.kimetomo_can_access_dm(conversation_id));

alter policy "mood delete own" on public.kimetomo_moods
  using (user_id = (select auth.uid()));
alter policy "mood insert own" on public.kimetomo_moods
  with check ((user_id = (select auth.uid())) and public.kimetomo_mood_member());
alter policy "mood update own" on public.kimetomo_moods
  using (user_id = (select auth.uid()))
  with check ((user_id = (select auth.uid())) and public.kimetomo_mood_member());

alter policy "push prefs: read own" on public.kimetomo_push_prefs
  using (user_id = (select auth.uid()));

alter policy timeline_likes_delete on public.kimetomo_timeline_likes
  using (user_id = (select auth.uid()));
alter policy timeline_likes_insert on public.kimetomo_timeline_likes
  with check ((user_id = (select auth.uid()))
              and exists (select 1 from public.circle_profiles p
                          where p.user_id = (select auth.uid()) and p.status = 'approved')
              and exists (select 1 from public.kimetomo_timeline_posts post
                          where post.id = kimetomo_timeline_likes.post_id));
alter policy timeline_likes_read on public.kimetomo_timeline_likes
  using (exists (select 1 from public.circle_profiles p
                 where p.user_id = (select auth.uid()) and p.status = 'approved'));

alter policy "vote delete own" on public.kimetomo_timeline_poll_votes
  using (user_id = (select auth.uid()));
alter policy "vote insert own" on public.kimetomo_timeline_poll_votes
  with check ((user_id = (select auth.uid())) and public.kimetomo_poll_member());
alter policy "vote update own" on public.kimetomo_timeline_poll_votes
  using (user_id = (select auth.uid()))
  with check ((user_id = (select auth.uid())) and public.kimetomo_poll_member());

alter policy "poll create by author" on public.kimetomo_timeline_polls
  with check (public.kimetomo_poll_member()
              and exists (select 1 from public.kimetomo_timeline_posts p
                          where p.id = kimetomo_timeline_polls.post_id
                            and p.author_id = (select auth.uid())));

alter policy timeline_posts_insert on public.kimetomo_timeline_posts
  with check ((author_id = (select auth.uid()))
              and exists (select 1 from public.circle_profiles p
                          where p.user_id = (select auth.uid()) and p.status = 'approved'));
alter policy timeline_posts_read on public.kimetomo_timeline_posts
  using (exists (select 1 from public.circle_profiles p
                 where p.user_id = (select auth.uid()) and p.status = 'approved'));

alter policy "kimetomo profile insert own" on public.kimetomo_user_profiles
  with check ((user_id = (select auth.uid())) and public.kimetomo_is_approved((select auth.uid())));
alter policy "kimetomo profile update own" on public.kimetomo_user_profiles
  using ((user_id = (select auth.uid())) and public.kimetomo_is_approved((select auth.uid())))
  with check ((user_id = (select auth.uid())) and public.kimetomo_is_approved((select auth.uid())));

alter policy "kimetomo wroom probation media" on public.circle_media
  using ((room_id <> public.kimetomo_women_room_id())
         or ((select public.kimetomo_wroom_probation_left((select auth.uid()))) = 0))
  with check ((room_id <> public.kimetomo_women_room_id())
              or ((select public.kimetomo_wroom_probation_left((select auth.uid()))) = 0));

-- ========== 4. 外部キーに索引を足す ==========
create index if not exists km_fk_circle_media_sender on public.circle_media (sender_id);
create index if not exists km_fk_circle_messages_sender on public.circle_messages (sender_id);
create index if not exists km_fk_anon_owners_real_author on public.kimetomo_anon_owners (real_author);
create index if not exists km_fk_bans_banned_by on public.kimetomo_bans (banned_by);
create index if not exists km_fk_chat_reactions_user on public.kimetomo_chat_reactions (user_id);
create index if not exists km_fk_comment_notif_actor on public.kimetomo_comment_notifications (actor_id);
create index if not exists km_fk_comment_notif_post on public.kimetomo_comment_notifications (post_id);
create index if not exists km_fk_feature_requests_author on public.kimetomo_feature_requests (author_id);
create index if not exists km_fk_request_votes_user on public.kimetomo_request_votes (user_id);
create index if not exists km_fk_room_reports_reporter on public.kimetomo_room_reports (reporter_id);
create index if not exists km_fk_room_reports_room on public.kimetomo_room_reports (room_id);
create index if not exists km_fk_room_reports_target on public.kimetomo_room_reports (target_id);
create index if not exists km_fk_room_requests_user on public.kimetomo_room_requests (user_id);
create index if not exists km_fk_comments_author on public.kimetomo_timeline_comments (author_id);
create index if not exists km_fk_comments_parent_post on public.kimetomo_timeline_comments (parent_id, post_id);
create index if not exists km_fk_poll_votes_user on public.kimetomo_timeline_poll_votes (user_id);
create index if not exists km_fk_reactions_user on public.kimetomo_timeline_reactions (user_id);
create index if not exists km_fk_user_mutes_muted on public.kimetomo_user_mutes (muted_id);
create index if not exists km_fk_wroom_invites_created_by on public.kimetomo_wroom_invites (created_by);
create index if not exists km_fk_wroom_invites_used_by on public.kimetomo_wroom_invites (used_by);

commit;

-- ========== 5. のぞうの「前の話題」の予備の表に主キーを付ける ==========
-- （中身 255 件はそのまま。元の話題に戻すときに使うので消さない）
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.kimetomo_mascot_topics_backup'::regclass and contype = 'p') then
    alter table public.kimetomo_mascot_topics_backup add primary key (slot, body);
    alter table public.kimetomo_mascot_topics_backup drop constraint if exists kimetomo_mascot_topics_backup_slot_body_key;
  end if;
end $$;
