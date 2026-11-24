-- 🌷 女性だけの部屋のAIの入口：男性がくり返し試すのを防ぐ（2026-11-24）
--  1. AIに「男性に見える」（自信が中・高）と判定されたアカウントは、残り回数に関係なくAIの入口を終わりにする（'looked_male'）。
--     管理者にベルで知らせる。管理者への申請は今まで通りできる。
--  2. アカウントを作り直して試すのを防ぐ：試した「端末の印」と「ネットワーク（IP）の印」を残す。
--     どちらも元に戻せない形（ハッシュ）にしたもので、IPそのものは残さない（Edge Function kimetomo-wroom-ai で作る）。
--     - 同じ端末で、別のアカウントが「男性に見える」と判定されていたら（180日以内）→ 使えない（'device'）
--     - 同じネットワークで、別のアカウントが「男性に見える」と判定されていたら（7日以内）→ 使えない（'ip'）
--     - 同じ端末で、ほかに2つ以上のアカウントがAIの確認を使っていたら → 使えない（'device_many'）
--     止めたときも管理者にベルで知らせる（同じ人は1日1回まで）。
-- 写真・AIの文章は今まで通り残さない。

alter table public.kimetomo_wroom_ai_tries add column if not exists ip_hash text;
alter table public.kimetomo_wroom_ai_tries add column if not exists device_hash text;
create index if not exists kimetomo_wroom_ai_tries_ip_idx on public.kimetomo_wroom_ai_tries (ip_hash) where ip_hash is not null;
create index if not exists kimetomo_wroom_ai_tries_dev_idx on public.kimetomo_wroom_ai_tries (device_hash) where device_hash is not null;

-- 「男性に見える」と判定された回か（自信が「低」の回は、ふつうの不合格として数える）
create or replace function public.kimetomo_wroom_ai_looked_male(p_result text, p_checks jsonb)
returns boolean language sql immutable as $$
  select coalesce(p_result = 'fail' and (p_checks->>'appears_female') = 'false'
                  and (p_checks->>'confidence') in ('medium', 'high'), false)
$$;

-- 使えるかどうか（'looked_male' を追加。ほかは前と同じ）
create or replace function public.kimetomo_wroom_ai_check(p_user uuid)
returns text language plpgsql stable security definer set search_path to 'public' as $function$
declare r uuid := public.kimetomo_women_room_id(); g text; em boolean; gc timestamptz; req text; done int; today int; sent int; joined timestamptz; acts int;
  free boolean := exists (select 1 from public.kimetomo_wroom_ai_free where user_id = p_user);
begin
  if p_user is null then return 'login'; end if;
  if not exists (select 1 from public.circle_profiles where user_id = p_user and status = 'approved') then return 'login'; end if;
  if r is null then return 'no_room'; end if;
  if public.circle_in_room(r, p_user) then return 'member'; end if;
  select gender, ever_male, gender_changed_at into g, em, gc from public.kimetomo_user_profiles where user_id = p_user;
  if coalesce(em, false) then return 'ever_male'; end if;
  if g is distinct from 'female' then return 'not_female'; end if;
  if gc > timestamptz '2026-11-09 04:36:35+09' then free := true; end if;
  select status into req from public.kimetomo_room_requests where room_id = r and user_id = p_user;
  if req = 'rejected' then return 'rejected'; end if;
  if exists (select 1 from public.kimetomo_wroom_ai_tries
              where user_id = p_user and public.kimetomo_wroom_ai_looked_male(result, checks)) then
    return 'looked_male';
  end if;
  select count(*) filter (where result in ('pass', 'fail')),
         count(*) filter (where result in ('pass', 'fail')
                            and (used_at at time zone 'Asia/Tokyo')::date = (now() at time zone 'Asia/Tokyo')::date),
         count(*) filter (where used_at is not null
                            and (used_at at time zone 'Asia/Tokyo')::date = (now() at time zone 'Asia/Tokyo')::date)
    into done, today, sent
    from public.kimetomo_wroom_ai_tries where user_id = p_user;
  if done >= 3 then return 'used_up'; end if;
  if not free then
    select created_at into joined from auth.users where id = p_user;
    if joined > now() - interval '1 day' then return 'days'; end if;
    acts := (select count(*) from public.kimetomo_timeline_posts where author_id = p_user)
          + (select count(*) from public.kimetomo_timeline_comments where author_id = p_user);
    if acts < 1 then return 'acts'; end if;
    if gc is not null and gc > now() - interval '7 days' then return 'gender_days'; end if;
  end if;
  if today >= 1 then return 'today'; end if;
  if sent >= 3 then return 'errors'; end if;
  return 'ok';
end $function$;

-- お題をもらうとき（'looked_male' のことばを追加。ほかは前と同じ）
create or replace function public.kimetomo_wroom_ai_start()
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  me uuid := auth.uid(); s text := public.kimetomo_wroom_ai_check(auth.uid()); v_id bigint; v_pose text;
  fingers text[] := array['1本', '2本', '3本', '4本', '5本（パー）'];
  faces text[] := array['首を少しかしげて', '口を「あ」の形に大きく開けて', 'ほっぺをふくらませて'];
begin
  if s <> 'ok' then raise exception '%', case s
    when 'member' then 'もう参加しています'
    when 'ever_male' then 'この方法では参加できません。管理者への申請をご利用ください'
    when 'not_female' then 'プロフィールの性別が♀の人だけ使えます'
    when 'rejected' then 'この方法では参加できません'
    when 'looked_male' then 'AIでの確認は終わりました。管理者への申請をご利用ください'
    when 'used_up' then 'AIでの確認は3回までです。管理者への申請をご利用ください'
    when 'days' then '登録から1日たつと使えます'
    when 'acts' then '投稿かコメントを1回すると使えます'
    when 'gender_days' then '性別を選んで（変えて）から7日たつと使えます'
    when 'today' then 'AIでの確認は1日1回までです。また明日お試しください'
    when 'errors' then '今日はAIがうまく確認できませんでした。また明日お試しください'
    else 'いまは使えません' end;
  end if;
  if (select count(*) from public.kimetomo_wroom_ai_tries where user_id = me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'お題を出しすぎています。また明日お試しください';
  end if;
  v_pose := 'スマホを持っていないほうの手で指を' || fingers[1 + floor(random() * array_length(fingers, 1))::int]
       || '立てて顔の横に出し、' || faces[1 + floor(random() * array_length(faces, 1))::int] || 'ください';
  insert into public.kimetomo_wroom_ai_tries (user_id, pose) values (me, v_pose) returning kimetomo_wroom_ai_tries.id into v_id;
  return jsonb_build_object('id', v_id, 'pose', v_pose);
end $function$;

-- 端末・ネットワークの確認（Edge Function が、お題を使う前に呼ぶ）。'ok' 以外なら止める
create or replace function public.kimetomo_wroom_ai_guard(p_user uuid, p_ip text, p_device text)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare s text;
begin
  if p_device is not null and exists (
       select 1 from public.kimetomo_wroom_ai_tries
        where device_hash = p_device and user_id <> p_user and used_at > now() - interval '180 days'
          and public.kimetomo_wroom_ai_looked_male(result, checks)) then
    s := 'device';
  elsif p_ip is not null and exists (
       select 1 from public.kimetomo_wroom_ai_tries
        where ip_hash = p_ip and user_id <> p_user and used_at > now() - interval '7 days'
          and public.kimetomo_wroom_ai_looked_male(result, checks)) then
    s := 'ip';
  elsif p_device is not null and (
       select count(distinct user_id) from public.kimetomo_wroom_ai_tries
        where device_hash = p_device and user_id <> p_user and result in ('pass', 'fail')) >= 2 then
    s := 'device_many';
  else
    return 'ok';
  end if;
  -- 管理者に知らせる（同じ人は1日1回まで）
  if not exists (select 1 from public.kimetomo_bell_notifications
                  where kind = 'admin_notice' and ref_id = 'wroom_guard' and actor_id = p_user
                    and created_at > now() - interval '1 day') then
    insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
    select p.user_id, 'admin_notice', p_user, 'wroom_guard',
           '📷 AIの確認を止めました：' || case s
             when 'device' then '同じ端末で、別のアカウントが「男性に見える」と判定されています'
             when 'ip' then '同じネットワークで、別のアカウントが「男性に見える」と判定されています'
             else '同じ端末で、ほかに2つ以上のアカウントがAIの確認を使っています' end,
           '🌷 ' || public.kimetomo_bell_name(p_user) || 'さんのAIの確認を止めました（アカウントの作り直しのうたがい）',
           './?tab=admin'
      from public.circle_profiles p where p.is_admin and p.status = 'approved' and p.user_id <> p_user;
  end if;
  return s;
end $function$;

-- お題を使用済みにする（端末・ネットワークの印もいっしょに残す）
drop function if exists public.kimetomo_wroom_ai_claim(uuid, bigint);
create or replace function public.kimetomo_wroom_ai_claim(p_user uuid, p_id bigint, p_ip text default null, p_device text default null)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare t public.kimetomo_wroom_ai_tries; s text := public.kimetomo_wroom_ai_check(p_user);
begin
  select * into t from public.kimetomo_wroom_ai_tries where id = p_id and user_id = p_user for update;
  if t.id is null then raise exception 'お題が見つかりません。もう一度はじめからお試しください'; end if;
  if t.used_at is not null then raise exception 'このお題はもう使われています。もう一度はじめからお試しください'; end if;
  if t.expires_at <= now() then raise exception 'お題の時間（5分）が過ぎました。もう一度はじめからお試しください'; end if;
  if s <> 'ok' then raise exception 'いまは使えません（%）', s; end if;
  update public.kimetomo_wroom_ai_tries set used_at = now(), ip_hash = p_ip, device_hash = p_device where id = p_id;
  return t.pose;
end $function$;

-- 結果を残す（「男性に見える」と判定されたら、管理者に知らせる。ほかは前と同じ）
create or replace function public.kimetomo_wroom_ai_finish(p_id bigint, p_result text)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare t public.kimetomo_wroom_ai_tries; r uuid := public.kimetomo_women_room_id();
begin
  if p_result not in ('pass', 'fail', 'error') then raise exception 'bad result'; end if;
  select * into t from public.kimetomo_wroom_ai_tries where id = p_id for update;
  if t.id is null or t.used_at is null or t.result is not null then raise exception 'bad try'; end if;
  update public.kimetomo_wroom_ai_tries set result = p_result where id = p_id;
  if p_result = 'fail' and public.kimetomo_wroom_ai_looked_male(p_result, t.checks) then
    insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
    select p.user_id, 'admin_notice', t.user_id, 'wroom_male',
           '📷 AIの確認で「男性に見える」と判定されました。この人はもうAIの入口を使えません（写真は保存していません）',
           '🌷 AIの確認で、' || public.kimetomo_bell_name(t.user_id) || 'さんが「男性に見える」と判定されました',
           './?tab=admin'
      from public.circle_profiles p where p.is_admin and p.status = 'approved' and p.user_id <> t.user_id;
  end if;
  if p_result <> 'pass' then return null; end if;
  if not exists (select 1 from public.kimetomo_user_profiles where user_id = t.user_id and gender = 'female' and not ever_male)
     or exists (select 1 from public.kimetomo_room_requests where room_id = r and user_id = t.user_id and status = 'rejected') then
    update public.kimetomo_wroom_ai_tries set result = 'fail' where id = p_id;
    return null;
  end if;
  insert into public.circle_room_members (room_id, user_id) values (r, t.user_id) on conflict do nothing;
  insert into public.kimetomo_room_requests (room_id, user_id, message, status, decided_at)
  values (r, t.user_id, '📷 AIで確認して参加しました', 'approved', now())
  on conflict (room_id, user_id) do update set status = 'approved', message = excluded.message, decided_at = now(), decided_by = null;
  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  select p.user_id, 'admin_notice', t.user_id, 'wroom', '📷 AIの確認で参加（写真は保存していません）',
         '🌷 AIの確認で、' || public.kimetomo_bell_name(t.user_id) || 'さんが女性トークルームに入りました', './?tab=admin'
  from public.circle_profiles p where p.is_admin and p.status = 'approved' and p.user_id <> t.user_id;
  return r;
end $function$;

revoke all on function public.kimetomo_wroom_ai_looked_male(text, jsonb) from public, anon, authenticated;
revoke all on function public.kimetomo_wroom_ai_guard(uuid, text, text) from public, anon, authenticated;
revoke all on function public.kimetomo_wroom_ai_claim(uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.kimetomo_wroom_ai_finish(bigint, text) from public, anon, authenticated;
grant execute on function public.kimetomo_wroom_ai_guard(uuid, text, text) to service_role;
grant execute on function public.kimetomo_wroom_ai_claim(uuid, bigint, text, text) to service_role;
grant execute on function public.kimetomo_wroom_ai_finish(bigint, text) to service_role;
revoke all on function public.kimetomo_wroom_ai_start() from public, anon;
grant execute on function public.kimetomo_wroom_ai_start() to authenticated;
