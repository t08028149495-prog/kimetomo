-- キメ友SNS: 女性が安心して使えるようにする3つの設定
--   1. 個人チャット（DM）を受け取る相手を選べる
--        all   = 誰からでも受け取る（いままでどおり）
--        known = 自分から一度でも送った相手からだけ受け取る（知らない人からは届かない。管理者からは届く）
--   2. 性別（♂・♀）を名前の横に表示しない
--   3. コメントを受け付けない投稿（投稿した本人だけはコメントできる）
-- 何度実行しても大丈夫です。いまの使い方は何も変わりません（全部「いままでどおり」が初期値）。

alter table public.kimetomo_user_profiles add column if not exists dm_policy text not null default 'all';
alter table public.kimetomo_user_profiles drop constraint if exists kimetomo_user_profiles_dm_policy_check;
alter table public.kimetomo_user_profiles add constraint kimetomo_user_profiles_dm_policy_check
  check (dm_policy in ('all', 'known'));
alter table public.kimetomo_user_profiles add column if not exists gender_hidden boolean not null default false;
alter table public.kimetomo_timeline_posts add column if not exists comments_off boolean not null default false;

-- 1. DM：受け取る人の設定に合っているか
create or replace function public.kimetomo_dm_allowed(p_conversation uuid, p_sender uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select
    exists (select 1 from public.circle_profiles
            where user_id = p_sender and is_admin and status = 'approved')
    or coalesce((
      select case coalesce(pr.dm_policy, 'all')
               when 'all' then true
               else exists (select 1 from public.kimetomo_direct_messages m
                            where m.conversation_id = p_conversation and m.sender_id = r.rcpt)
             end
      from (select case when c.user_a = p_sender then c.user_b else c.user_a end as rcpt
            from public.kimetomo_direct_conversations c where c.id = p_conversation) r
      left join public.kimetomo_user_profiles pr on pr.user_id = r.rcpt
    ), true);
$$;
revoke all on function public.kimetomo_dm_allowed(uuid, uuid) from public, anon;
grant execute on function public.kimetomo_dm_allowed(uuid, uuid) to authenticated;

drop policy if exists "kimetomo dm receive setting" on public.kimetomo_direct_messages;
create policy "kimetomo dm receive setting" on public.kimetomo_direct_messages
  as restrictive for insert to authenticated
  with check (public.kimetomo_dm_allowed(conversation_id, sender_id));

-- 3. コメントを受け付けない投稿
create or replace function public.kimetomo_comments_open(p_post uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select not exists (
    select 1 from public.kimetomo_timeline_posts p
    where p.id = p_post and p.comments_off and p.author_id <> auth.uid()
  );
$$;
revoke all on function public.kimetomo_comments_open(uuid) from public, anon;
grant execute on function public.kimetomo_comments_open(uuid) to authenticated;

drop policy if exists "kimetomo comments off" on public.kimetomo_timeline_comments;
create policy "kimetomo comments off" on public.kimetomo_timeline_comments
  as restrictive for insert to authenticated
  with check (public.kimetomo_comments_open(post_id));

notify pgrst, 'reload schema';

select 'OK：DMの受け取り設定・性別を表示しない・コメントを受け付けない投稿を追加しました' as 結果;
