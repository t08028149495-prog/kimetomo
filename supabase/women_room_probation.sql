-- キメ友SNS: 🌷 女性だけの部屋をもう少し安全に
--   ① AIで確認して入る入口に、軽い条件を足す：登録から1日以上・投稿かコメントを1回以上
--      （使い捨てのアカウントで何度も試しにくくする。管理者への申請の条件は今のまま）
--   ② 入ってから7日間は「見習い期間」：部屋のチャットの写真を送れない・見られない
--      （どの入口から入った人も同じ。管理者は対象外。この SQL より前からいるメンバーも対象外）
-- women_room_ai.sql のあとに実行します。何度実行しても大丈夫です。

-- 部屋に入った時刻（今までのメンバーは空のまま＝見習い期間なし）
alter table public.circle_room_members add column if not exists joined_at timestamptz;
alter table public.circle_room_members alter column joined_at set default now();

-- 見習い期間の残り日数（0 なら見習いではない）
create or replace function public.kimetomo_wroom_probation_left(p_user uuid)
returns int language sql stable security definer set search_path to 'public'
as $$
  select coalesce((
    select greatest(0, ceil(extract(epoch from (m.joined_at + interval '7 days' - now())) / 86400))::int
    from public.circle_room_members m
    where m.room_id = public.kimetomo_women_room_id() and m.user_id = p_user and m.joined_at is not null
      and not exists (select 1 from public.circle_profiles p where p.user_id = p_user and p.is_admin and p.status = 'approved')
  ), 0)
$$;
revoke all on function public.kimetomo_wroom_probation_left(uuid) from public, anon;
grant execute on function public.kimetomo_wroom_probation_left(uuid) to authenticated;

-- 見習い期間の人は、女性だけの部屋の写真を送れない・見られない
drop policy if exists "kimetomo wroom probation media" on public.circle_media;
create policy "kimetomo wroom probation media" on public.circle_media
  as restrictive for all to authenticated
  using (room_id <> public.kimetomo_women_room_id() or (select public.kimetomo_wroom_probation_left(auth.uid())) = 0)
  with check (room_id <> public.kimetomo_women_room_id() or (select public.kimetomo_wroom_probation_left(auth.uid())) = 0);

drop policy if exists "kimetomo wroom probation media files" on storage.objects;
create policy "kimetomo wroom probation media files" on storage.objects
  as restrictive for all to authenticated
  using (bucket_id <> 'circle-private-media'
         or split_part(name, '/', 1) <> public.kimetomo_women_room_id()::text
         or (select public.kimetomo_wroom_probation_left(auth.uid())) = 0)
  with check (bucket_id <> 'circle-private-media'
         or split_part(name, '/', 1) <> public.kimetomo_women_room_id()::text
         or (select public.kimetomo_wroom_probation_left(auth.uid())) = 0);

-- AIの入口：使えるか（条件を足した版）
create or replace function public.kimetomo_wroom_ai_check(p_user uuid)
returns text language plpgsql stable security definer set search_path to 'public'
as $$
declare r uuid := public.kimetomo_women_room_id(); g text; em boolean; req text; done int; today int; joined timestamptz; acts int;
begin
  if p_user is null then return 'login'; end if;
  if not exists (select 1 from public.circle_profiles where user_id = p_user and status = 'approved') then return 'login'; end if;
  if r is null then return 'no_room'; end if;
  if public.circle_in_room(r, p_user) then return 'member'; end if;
  select gender, ever_male into g, em from public.kimetomo_user_profiles where user_id = p_user;
  if coalesce(em, false) then return 'ever_male'; end if;
  if g is distinct from 'female' then return 'not_female'; end if;
  select status into req from public.kimetomo_room_requests where room_id = r and user_id = p_user;
  if req = 'rejected' then return 'rejected'; end if;
  select count(*) filter (where result in ('pass', 'fail')),
         count(*) filter (where result in ('pass', 'fail')
                            and (used_at at time zone 'Asia/Tokyo')::date = (now() at time zone 'Asia/Tokyo')::date)
    into done, today
    from public.kimetomo_wroom_ai_tries where user_id = p_user;
  if done >= 3 then return 'used_up'; end if;
  select created_at into joined from auth.users where id = p_user;
  if joined > now() - interval '1 day' then return 'days'; end if;
  acts := (select count(*) from public.kimetomo_timeline_posts where author_id = p_user)
        + (select count(*) from public.kimetomo_timeline_comments where author_id = p_user);
  if acts < 1 then return 'acts'; end if;
  if today >= 1 then return 'today'; end if;
  return 'ok';
end $$;
revoke all on function public.kimetomo_wroom_ai_check(uuid) from public, anon, authenticated;

-- 画面用：お題をもらう（条件が足りないときの文を足した版）
create or replace function public.kimetomo_wroom_ai_start()
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  me uuid := auth.uid(); s text := public.kimetomo_wroom_ai_check(auth.uid()); v_id bigint; v_pose text;
  fingers text[] := array['1本', '2本', '3本', '4本', '5本（パー）'];
  others text[] := array['親指を立てて👍', 'OKサイン👌を作って', '手のひらを頬にあてて', 'こぶし✊をあごの下に置いて'];
begin
  if s <> 'ok' then raise exception '%', case s
    when 'member' then 'もう参加しています'
    when 'ever_male' then 'この方法では参加できません。管理者への申請をご利用ください'
    when 'not_female' then 'プロフィールの性別が♀の人だけ使えます'
    when 'rejected' then 'この方法では参加できません'
    when 'used_up' then 'AIでの確認は3回までです。管理者への申請をご利用ください'
    when 'days' then '登録から1日たつと使えます'
    when 'acts' then '投稿かコメントを1回すると使えます'
    when 'today' then 'AIでの確認は1日1回までです。また明日お試しください'
    else 'いまは使えません' end;
  end if;
  if (select count(*) from public.kimetomo_wroom_ai_tries where user_id = me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'お題を出しすぎています。また明日お試しください';
  end if;
  v_pose := '片手で指を' || fingers[1 + floor(random() * array_length(fingers, 1))::int]
       || '立てて顔の横に出し、もう片方の手で' || others[1 + floor(random() * array_length(others, 1))::int] || 'ください';
  insert into public.kimetomo_wroom_ai_tries (user_id, pose) values (me, v_pose) returning kimetomo_wroom_ai_tries.id into v_id;
  return jsonb_build_object('id', v_id, 'pose', v_pose);
end $$;
revoke all on function public.kimetomo_wroom_ai_start() from public, anon;
grant execute on function public.kimetomo_wroom_ai_start() to authenticated;

-- 自分の状態に「見習い期間の残り日数」を足す（women_room_relax.sql の版＋probation_left）
create or replace function public.kimetomo_women_room_status()
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare
  me uuid := auth.uid(); r uuid; g text; gc timestamptz; joined timestamptz; acts int; req text;
begin
  if me is null or not public.kimetomo_is_active_member() then return null; end if;
  r := public.kimetomo_women_room_id();
  if r is null then return null; end if;
  select gender, gender_changed_at into g, gc from public.kimetomo_user_profiles where user_id = me;
  select created_at into joined from auth.users where id = me;
  acts := (select count(*) from public.kimetomo_timeline_posts where author_id = me)
        + (select count(*) from public.kimetomo_timeline_comments where author_id = me);
  select status into req from public.kimetomo_room_requests where room_id = r and user_id = me;
  return jsonb_build_object(
    'room_id', r,
    'admin', public.kimetomo_caller_is_admin(),
    'female', coalesce(g = 'female', false),
    'member', public.circle_in_room(r, me),
    'request', req,
    'days_need', 3,
    'days_left', greatest(0, ceil(extract(epoch from (joined + interval '3 days' - now())) / 86400))::int,
    'acts', acts,
    'acts_need', 1,
    'gender_days_need', 2,
    'gender_days_left', case when gc is null then 0
                             else greatest(0, ceil(extract(epoch from (gc + interval '2 days' - now())) / 86400))::int end,
    'probation_left', public.kimetomo_wroom_probation_left(me)
  );
end $$;

notify pgrst, 'reload schema';

select 'OK：AIの入口に条件を足し、7日間の見習い期間を作りました' as 結果;
