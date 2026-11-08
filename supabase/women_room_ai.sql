-- キメ友SNS: 🌷 女性だけの部屋に「AIで確認して入る」入口（Edge Function kimetomo-wroom-ai とセット）
--   ・その場で撮った写真1枚と、毎回ちがう「お題（ポーズ）」をAIが確認する。管理者は写真を見ない。写真はどこにも保存しない
--   ・使えるのは、性別が♀で、一度も♂にしたことがない人だけ（男性は申請できない）
--   ・試せるのは 1日1回・合計3回まで（AIの不具合で判定できなかった回は数えない）
--   ・登録日数などの条件はなし。部屋から外された人・申請を見送られた人は使えない
-- women_room.sql・women_room_invite.sql のあとに実行します。何度実行しても大丈夫です。

-- 「♂にしたことがある」印。トリガーで自動で付き、本人は書きかえられない
alter table public.kimetomo_user_profiles add column if not exists ever_male boolean not null default false;

create or replace function public.kimetomo_ever_male_stamp()
returns trigger language plpgsql set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    new.ever_male := coalesce(new.gender = 'male', false);
  else
    new.ever_male := old.ever_male or coalesce(old.gender = 'male', false) or coalesce(new.gender = 'male', false);
  end if;
  return new;
end $$;
drop trigger if exists kimetomo_ever_male_stamp on public.kimetomo_user_profiles;
create trigger kimetomo_ever_male_stamp before insert or update on public.kimetomo_user_profiles
  for each row execute function public.kimetomo_ever_male_stamp();

-- お題と、試した記録（写真は入れない）。画面からは下の関数を通してだけ使う
create table if not exists public.kimetomo_wroom_ai_tries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pose text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '5 minutes',
  used_at timestamptz,
  result text check (result in ('pass', 'fail', 'error'))
);
create index if not exists kimetomo_wroom_ai_tries_user on public.kimetomo_wroom_ai_tries (user_id, created_at desc);
alter table public.kimetomo_wroom_ai_tries enable row level security;
revoke all on public.kimetomo_wroom_ai_tries from public, anon, authenticated;

-- その人が今AIの入口を使えるか（'ok' か、使えない理由）。中だけで使う
create or replace function public.kimetomo_wroom_ai_check(p_user uuid)
returns text language plpgsql stable security definer set search_path to 'public'
as $$
declare r uuid := public.kimetomo_women_room_id(); g text; em boolean; req text; done int; today int;
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
  if today >= 1 then return 'today'; end if;
  return 'ok';
end $$;

-- 画面用：使えるか・あと何回か
create or replace function public.kimetomo_wroom_ai_status()
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare me uuid := auth.uid(); done int;
begin
  if me is null then return null; end if;
  select count(*) into done from public.kimetomo_wroom_ai_tries where user_id = me and result in ('pass', 'fail');
  return jsonb_build_object('state', public.kimetomo_wroom_ai_check(me), 'left', greatest(0, 3 - done));
end $$;

-- 画面用：お題をもらう（5分だけ使える）
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

-- Edge Function 用：お題を使用済みにして、中身を返す（1回だけ）
create or replace function public.kimetomo_wroom_ai_claim(p_user uuid, p_id bigint)
returns text language plpgsql security definer set search_path to 'public'
as $$
declare t public.kimetomo_wroom_ai_tries; s text := public.kimetomo_wroom_ai_check(p_user);
begin
  select * into t from public.kimetomo_wroom_ai_tries where id = p_id and user_id = p_user for update;
  if t.id is null then raise exception 'お題が見つかりません。もう一度はじめからお試しください'; end if;
  if t.used_at is not null then raise exception 'このお題はもう使われています。もう一度はじめからお試しください'; end if;
  if t.expires_at <= now() then raise exception 'お題の時間（5分）が過ぎました。もう一度はじめからお試しください'; end if;
  if s <> 'ok' then raise exception 'いまは使えません（%）', s; end if;
  update public.kimetomo_wroom_ai_tries set used_at = now() where id = p_id;
  return t.pose;
end $$;

-- Edge Function 用：結果を記録。合格なら部屋に入れて、管理者にお知らせ
create or replace function public.kimetomo_wroom_ai_finish(p_id bigint, p_result text)
returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare t public.kimetomo_wroom_ai_tries; r uuid := public.kimetomo_women_room_id();
begin
  if p_result not in ('pass', 'fail', 'error') then raise exception 'bad result'; end if;
  select * into t from public.kimetomo_wroom_ai_tries where id = p_id for update;
  if t.id is null or t.used_at is null or t.result is not null then raise exception 'bad try'; end if;
  update public.kimetomo_wroom_ai_tries set result = p_result where id = p_id;
  if p_result <> 'pass' then return null; end if;
  -- 念のため、入れる直前にもう一度だけ確かめる（♀・♂にしたことがない・外されていない）
  if not exists (select 1 from public.kimetomo_user_profiles where user_id = t.user_id and gender = 'female' and not ever_male)
     or exists (select 1 from public.kimetomo_room_requests where room_id = r and user_id = t.user_id and status = 'rejected') then
    update public.kimetomo_wroom_ai_tries set result = 'fail' where id = p_id;
    return null;
  end if;
  insert into public.circle_room_members (room_id, user_id) values (r, t.user_id) on conflict do nothing;
  -- 申請の記録にも残す（管理者の一覧に「AIで確認」と出る。外されたら、ほかの入口と同じく見送りになる）
  insert into public.kimetomo_room_requests (room_id, user_id, message, status, decided_at)
  values (r, t.user_id, '📷 AIで確認して参加しました', 'approved', now())
  on conflict (room_id, user_id) do update set status = 'approved', message = excluded.message, decided_at = now(), decided_by = null;
  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  select p.user_id, 'admin_notice', t.user_id, 'wroom', '📷 AIの確認で参加（写真は保存していません）',
         '🌷 AIの確認で、' || public.kimetomo_bell_name(t.user_id) || 'さんが女性トークルームに入りました', './?tab=admin'
  from public.circle_profiles p where p.is_admin and p.status = 'approved' and p.user_id <> t.user_id;
  return r;
end $$;

revoke all on function public.kimetomo_ever_male_stamp() from public, anon, authenticated;
revoke all on function public.kimetomo_wroom_ai_check(uuid) from public, anon, authenticated;
revoke all on function public.kimetomo_wroom_ai_claim(uuid, bigint) from public, anon, authenticated;
revoke all on function public.kimetomo_wroom_ai_finish(bigint, text) from public, anon, authenticated;
grant execute on function public.kimetomo_wroom_ai_claim(uuid, bigint) to service_role;
grant execute on function public.kimetomo_wroom_ai_finish(bigint, text) to service_role;
revoke all on function public.kimetomo_wroom_ai_status() from public, anon;
revoke all on function public.kimetomo_wroom_ai_start() from public, anon;
grant execute on function public.kimetomo_wroom_ai_status() to authenticated;
grant execute on function public.kimetomo_wroom_ai_start() to authenticated;

notify pgrst, 'reload schema';

select 'OK：🌷 女性だけの部屋に「AIで確認して入る」入口を作りました' as 結果;
