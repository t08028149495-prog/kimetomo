-- 🌷 女性だけの部屋：AIの確認のお題から「ウインク」を外す（2026-11-09）
--   ・ウインクは苦手な人が多い（メンバーから「難しい」と言われた）ため
--   ・顔のしぐさは「首をかしげる・口を開ける・ほっぺをふくらませる」の3つに
-- women_room_ai_gender_days.sql のあとに実行します。何度実行しても大丈夫です。

create or replace function public.kimetomo_wroom_ai_start()
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
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

notify pgrst, 'reload schema';

select 'OK：お題からウインクを外しました' as 結果;
