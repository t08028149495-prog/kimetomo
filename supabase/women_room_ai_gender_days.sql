-- 🌷 女性だけの部屋：AIの入口は「性別を選んで（変えて）から7日たった人」だけにする（2026-11-09）
-- 「♂にしたことがある」印（ever_male）は women_room_ai.sql を入れたとき（2026-11-08ごろ）からしか付いていない。
-- それより前に ♂→♀ に変えた人を見分けられないので、性別を選んだ・変えたばかりの人はAIの入口を使えないようにする。
-- （初めて♀を選んだ人も同じく7日待つ。待っている間も管理者への申請は使える）
-- あわせて、今♂になっている人にも ever_male の印を付けておく（あとで♀に変えてもAIの入口は使えない）。
-- women_room_ai_errors.sql のあとに実行します。何度実行しても大丈夫です。

-- 今♂の人に印を付ける（トリガーが ever_male を true にする）。
-- 名前の見張り（ng_guard など）に引っかかる人がいても止まらないよう、1人ずつ行う
do $$
declare u uuid; n int := 0;
begin
  for u in select user_id from public.kimetomo_user_profiles where gender = 'male' and not ever_male loop
    begin
      update public.kimetomo_user_profiles set ever_male = true where user_id = u;
      n := n + 1;
    exception when others then
      raise notice 'skip %', u;
    end;
  end loop;
  raise notice 'ever_male を付けた人：%', n;
end $$;

create or replace function public.kimetomo_wroom_ai_check(p_user uuid)
returns text language plpgsql stable security definer set search_path to 'public'
as $$
declare r uuid := public.kimetomo_women_room_id(); g text; em boolean; gc timestamptz; req text; done int; today int; sent int; joined timestamptz; acts int;
begin
  if p_user is null then return 'login'; end if;
  if not exists (select 1 from public.circle_profiles where user_id = p_user and status = 'approved') then return 'login'; end if;
  if r is null then return 'no_room'; end if;
  if public.circle_in_room(r, p_user) then return 'member'; end if;
  select gender, ever_male, gender_changed_at into g, em, gc from public.kimetomo_user_profiles where user_id = p_user;
  if coalesce(em, false) then return 'ever_male'; end if;
  if g is distinct from 'female' then return 'not_female'; end if;
  select status into req from public.kimetomo_room_requests where room_id = r and user_id = p_user;
  if req = 'rejected' then return 'rejected'; end if;
  select count(*) filter (where result in ('pass', 'fail')),
         count(*) filter (where result in ('pass', 'fail')
                            and (used_at at time zone 'Asia/Tokyo')::date = (now() at time zone 'Asia/Tokyo')::date),
         count(*) filter (where used_at is not null
                            and (used_at at time zone 'Asia/Tokyo')::date = (now() at time zone 'Asia/Tokyo')::date)
    into done, today, sent
    from public.kimetomo_wroom_ai_tries where user_id = p_user;
  if done >= 3 then return 'used_up'; end if;
  select created_at into joined from auth.users where id = p_user;
  if joined > now() - interval '1 day' then return 'days'; end if;
  acts := (select count(*) from public.kimetomo_timeline_posts where author_id = p_user)
        + (select count(*) from public.kimetomo_timeline_comments where author_id = p_user);
  if acts < 1 then return 'acts'; end if;
  -- 性別を選んだ・変えたのが7日以内なら、まだ使えない
  if gc is not null and gc > now() - interval '7 days' then return 'gender_days'; end if;
  if today >= 1 then return 'today'; end if;
  if sent >= 3 then return 'errors'; end if;
  return 'ok';
end $$;
revoke all on function public.kimetomo_wroom_ai_check(uuid) from public, anon, authenticated;

-- 画面用：あと何日で使えるか（gender_days のときだけ）も返す
create or replace function public.kimetomo_wroom_ai_status()
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare me uuid := auth.uid(); done int; gc timestamptz;
begin
  if me is null then return null; end if;
  select count(*) into done from public.kimetomo_wroom_ai_tries where user_id = me and result in ('pass', 'fail');
  select gender_changed_at into gc from public.kimetomo_user_profiles where user_id = me;
  return jsonb_build_object('state', public.kimetomo_wroom_ai_check(me), 'left', greatest(0, 3 - done),
    'gender_days_left', case when gc is null then 0
      else greatest(0, ceil(extract(epoch from (gc + interval '7 days' - now())) / 86400))::int end);
end $$;
revoke all on function public.kimetomo_wroom_ai_status() from public, anon;
grant execute on function public.kimetomo_wroom_ai_status() to authenticated;

create or replace function public.kimetomo_wroom_ai_start()
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  me uuid := auth.uid(); s text := public.kimetomo_wroom_ai_check(auth.uid()); v_id bigint; v_pose text;
  fingers text[] := array['1本', '2本', '3本', '4本', '5本（パー）'];
  faces text[] := array['首を少しかしげて', '口を「あ」の形に大きく開けて', 'ほっぺをふくらませて', '片目を閉じて（ウインク）'];
begin
  if s <> 'ok' then raise exception '%', case s
    when 'member' then 'もう参加しています'
    when 'ever_male' then 'この方法では参加できません。管理者への申請をご利用ください'
    when 'not_female' then 'プロフィールの性別が♀の人だけ使えます'
    when 'rejected' then 'この方法では参加できません'
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
end $$;
revoke all on function public.kimetomo_wroom_ai_start() from public, anon;
grant execute on function public.kimetomo_wroom_ai_start() to authenticated;

notify pgrst, 'reload schema';

select 'OK：AIの入口は、性別を選んで（変えて）から7日たった人だけにしました' as 結果;
