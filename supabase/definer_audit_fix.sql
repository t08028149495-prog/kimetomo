-- キメ友SNS: 特別な権限で動く関数（SECURITY DEFINER）の点検で見つかった穴をふさぐ（2026-11-09）
-- 1) アプリから直接呼ばない内部用の関数を、外（REST の rpc）から呼べないようにする。
--    中で呼んでいる関数はすべて SECURITY DEFINER（postgres 権限）なので、動きは変わらない。
--    特に kimetomo_insert_post_as は「誰にでもなりすまして投稿できる」状態だった。
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'kimetomo_insert_post_as', 'kimetomo_mascot_tick', 'kimetomo_cleanup', 'kimetomo_support_reminder',
      'kimetomo_bell_blocked', 'kimetomo_bell_name', 'kimetomo_mascot_id', 'kimetomo_mascot_setting',
      'kimetomo_setting', 'kimetomo_ng_hit', 'kimetomo_ng_hit_level', 'kimetomo_imp_name_hit',
      'kimetomo_imp_body_hit', 'kimetomo_is_admin_user', 'kimetomo_invite_today_uses',
      'kimetomo_req_admin', 'kimetomo_req_member', 'kimetomo_toggle_request_vote',
      'circle_review_user', 'circle_pending_users')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- 2) 「この人はこの部屋にいるか」を、本人・管理者・同じ部屋の人だけが調べられるようにする。
--    （これまでは誰でも、女性専用ルームに誰がいるか＝誰が女性かを調べられた）
--    auth.uid() が空＝サーバー側（Edge Function・cron）からの呼び出しはそのまま。
create or replace function public.circle_in_room(p_room uuid, p_user uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.circle_room_members
    where room_id = p_room and user_id = p_user
  ) and (
    auth.uid() is null
    or p_user = auth.uid()
    or public.circle_is_admin(auth.uid())
    or exists (select 1 from public.circle_room_members where room_id = p_room and user_id = auth.uid())
  );
$$;

-- 女性バッジ：上の変更で部屋の外の人から circle_in_room が使えなくなるので、直接たしかめる
create or replace function public.kimetomo_women_badges(p_ids uuid[])
returns setof uuid language sql stable security definer set search_path to 'public' as $$
  select u.user_id
  from public.kimetomo_user_profiles u
  where public.kimetomo_is_active_member()
    and coalesce(array_length(p_ids, 1), 0) <= 200
    and u.user_id = any (p_ids)
    and u.women_badge
    and u.gender = 'female'
    and exists (select 1 from public.circle_room_members m
                where m.room_id = public.kimetomo_women_room_id() and m.user_id = u.user_id);
$$;

-- 女性専用ルームの「お試し期間の残り日数」は本人の分だけ
create or replace function public.kimetomo_wroom_probation_left(p_user uuid)
returns integer language sql stable security definer set search_path to 'public' as $$
  select coalesce((
    select greatest(0, ceil(extract(epoch from (m.joined_at + interval '7 days' - now())) / 86400))::int
    from public.circle_room_members m
    where m.room_id = public.kimetomo_women_room_id() and m.user_id = p_user and m.joined_at is not null
      and (auth.uid() is null or p_user = auth.uid())
      and not exists (select 1 from public.circle_profiles p where p.user_id = p_user and p.is_admin and p.status = 'approved')
  ), 0)
$$;

-- 3) DM のブロック・受け取り設定の確認は、その会話の 2 人のときだけ答える
create or replace function public.kimetomo_dm_blocked(p_conversation anyelement, p_sender uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1
    from public.kimetomo_direct_conversations c
    join public.user_blocks b
      on b.blocked_id = p_sender
     and b.blocker_id = case when c.user_a = p_sender then c.user_b else c.user_a end
    where c.id = p_conversation
      and (auth.uid() is null or auth.uid() in (c.user_a, c.user_b))
  );
$$;

create or replace function public.kimetomo_dm_allowed(p_conversation uuid, p_sender uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
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
            from public.kimetomo_direct_conversations c
            where c.id = p_conversation
              and (auth.uid() is null or auth.uid() in (c.user_a, c.user_b))) r
      left join public.kimetomo_user_profiles pr on pr.user_id = r.rcpt
    ), true);
$$;

-- 4) なりすまし名前チェックで、管理者の「ログインID」と比べない
--    （新規登録画面から少しずつ試すと、管理者のログインIDを当てられたため）
create or replace function public.kimetomo_imp_name_hit(p_name text, p_user uuid default null)
returns boolean language plpgsql stable security definer set search_path to 'public' as $$
declare
  n text := public.kimetomo_imp_norm(p_name);
  w text;
  core text;
begin
  if public.kimetomo_is_admin_user(p_user) then return false; end if;
  if n = '' then return false; end if;
  foreach w in array array['管理者', '管理人', '運営', '公式', 'アドミン', 'admin', 'staff', 'スタッフ', 'モデレーター', 'moderator'] loop
    if position(public.kimetomo_ng_normalize(w) in public.kimetomo_ng_normalize(p_name)) > 0 then return true; end if;
  end loop;
  for core in
    select distinct public.kimetomo_imp_norm(x.nm)
    from public.circle_profiles a
    cross join lateral (
      select a.display_name as nm
      union all select u.display_name from public.kimetomo_user_profiles u where u.user_id = a.user_id
      union all select au.raw_user_meta_data ->> 'display_name' from auth.users au where au.id = a.user_id
    ) x
    where a.is_admin and a.status = 'approved' and a.user_id is distinct from p_user and x.nm is not null
  loop
    if char_length(core) >= 2 and position(core in n) > 0 then return true; end if;
  end loop;
  return false;
end $$;
-- create or replace は権限を引き継ぐが、念のため内部用のまま閉じておく
revoke execute on function public.kimetomo_imp_name_hit(text, uuid) from public, anon, authenticated;
