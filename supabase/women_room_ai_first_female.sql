-- 🌷 女性だけの部屋：初めて選んだ性別が♀の人は、条件なしでAIの入口を使える（2026-11-09）
--   ・なくす条件：登録から1日・投稿かコメント1回・性別を選んでから7日
--   ・「初めて♀」と分かるのは、「♂にしたことがある」印（ever_male）を付け始めた 2026-11-09 04:36（日本時間）より後に性別を選び、
--     印が付いていない人だけ。それより前に選んだ人は、今までどおり条件あり（管理者の「🤖 AIだけで入れる人」で個別に外せる）
--   ・残す条件：プロフィールが♀・♂にしたことがない・見送られていない・1日1回・合計3回まで
-- women_room_ai_free.sql のあとに実行します。何度実行しても大丈夫です。

create or replace function public.kimetomo_wroom_ai_check(p_user uuid)
returns text language plpgsql stable security definer set search_path to 'public'
as $$
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
  -- 初めて選んだ性別が♀（印を付け始めたあとに選び、♂にしたことがない）なら、下の日数・投稿の条件をとばす
  if gc > timestamptz '2026-11-09 04:36:35+09' then free := true; end if;
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
  -- 管理者が選んだ人・初めて♀を選んだ人は、ここから下の日数・投稿の条件をとばす
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
end $$;
revoke all on function public.kimetomo_wroom_ai_check(uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';

select 'OK：初めて選んだ性別が♀の人は、条件なしでAIの入口を使えるようにしました' as 結果;
