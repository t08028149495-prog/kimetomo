-- 🌷 AIの入口：初めて選んだ性別が♀の新しいアカウントにも「登録から1日」の待ち時間を付ける（2026-11-24）
-- アカウントを作ってすぐに試すこと（作り直して何度も試すこと）を防ぐ。
-- 投稿・コメントの条件と「性別を選んでから7日」は、今まで通りなし。
-- 管理者が「🤖 AIだけで入れる人」に追加した人は、今まで通り待ち時間なし。
create or replace function public.kimetomo_wroom_ai_check(p_user uuid)
returns text language plpgsql stable security definer set search_path to 'public' as $function$
declare r uuid := public.kimetomo_women_room_id(); g text; em boolean; gc timestamptz; req text; done int; today int; sent int; joined timestamptz; acts int;
  admin_free boolean := exists (select 1 from public.kimetomo_wroom_ai_free where user_id = p_user);
  first_female boolean := false;
begin
  if p_user is null then return 'login'; end if;
  if not exists (select 1 from public.circle_profiles where user_id = p_user and status = 'approved') then return 'login'; end if;
  if r is null then return 'no_room'; end if;
  if public.circle_in_room(r, p_user) then return 'member'; end if;
  select gender, ever_male, gender_changed_at into g, em, gc from public.kimetomo_user_profiles where user_id = p_user;
  if coalesce(em, false) then return 'ever_male'; end if;
  if g is distinct from 'female' then return 'not_female'; end if;
  if gc > timestamptz '2026-11-09 04:36:35+09' then first_female := true; end if;
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
  if not admin_free then
    select created_at into joined from auth.users where id = p_user;
    if joined > now() - interval '1 day' then return 'days'; end if;
    if not first_female then
      acts := (select count(*) from public.kimetomo_timeline_posts where author_id = p_user)
            + (select count(*) from public.kimetomo_timeline_comments where author_id = p_user);
      if acts < 1 then return 'acts'; end if;
      if gc is not null and gc > now() - interval '7 days' then return 'gender_days'; end if;
    end if;
  end if;
  if today >= 1 then return 'today'; end if;
  if sent >= 3 then return 'errors'; end if;
  return 'ok';
end $function$;
