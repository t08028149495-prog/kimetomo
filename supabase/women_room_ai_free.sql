-- 🌷 女性だけの部屋：管理者が選んだ人は「登録から1日・投稿1回・性別を選んでから7日」の条件なしで、AIの入口を使える（2026-11-09）
--   ・残す条件：プロフィールが♀・♂にしたことがない・見送られていない・1日1回・合計3回まで
--   ・管理者画面の「🤖 AIだけで入れる人」で、名前で探して追加・外す
--   ・追加した人のベルに「AIで確認して入れるようになりました」と届く
-- women_room_ai_gender_days.sql のあとに実行します。何度実行しても大丈夫です。

create table if not exists public.kimetomo_wroom_ai_free (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid,
  created_at timestamptz not null default now()
);
alter table public.kimetomo_wroom_ai_free enable row level security;
revoke all on public.kimetomo_wroom_ai_free from public, anon, authenticated;

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
  -- 管理者が選んだ人は、ここから下の日数・投稿の条件をとばす
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

-- 管理者：AIだけで入れる人の一覧
create or replace function public.kimetomo_admin_wroom_ai_free_list()
returns table(user_id uuid, name text, gender text, in_room boolean, created_at timestamptz)
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  return query
  select f.user_id, coalesce(nullif(u.display_name, ''), 'メンバー'), u.gender,
         public.circle_in_room(public.kimetomo_women_room_id(), f.user_id), f.created_at
  from public.kimetomo_wroom_ai_free f
  left join public.kimetomo_user_profiles u on u.user_id = f.user_id
  order by f.created_at desc;
end $$;

-- 管理者：AIだけで入れる人に追加する（p_on = true）・外す（false）
create or replace function public.kimetomo_admin_set_wroom_ai_free(p_user uuid, p_on boolean)
returns void language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  if not coalesce(p_on, false) then
    delete from public.kimetomo_wroom_ai_free where user_id = p_user;
    return;
  end if;
  if not exists (select 1 from public.circle_profiles where user_id = p_user and status = 'approved') then
    raise exception '承認済みのメンバーだけ追加できます';
  end if;
  if not exists (select 1 from public.kimetomo_user_profiles where user_id = p_user and gender = 'female') then
    raise exception 'プロフィールの性別が♀の人だけ追加できます（本人に♀を選んでもらってください）';
  end if;
  if public.circle_in_room(public.kimetomo_women_room_id(), p_user) then raise exception 'もう参加しています'; end if;
  insert into public.kimetomo_wroom_ai_free (user_id, granted_by) values (p_user, auth.uid())
    on conflict (user_id) do nothing;
  if found then
    insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
    values (p_user, 'admin_notice', auth.uid(), 'wroom_ai_free',
            'グループの画面の「🌷 女性だけの部屋」から、AIで確認してすぐ入れるようになりました',
            '🌷 AIで確認して女性だけの部屋に入れるようになりました', './?tab=chat');
  end if;
end $$;

revoke all on function public.kimetomo_admin_wroom_ai_free_list() from public, anon;
grant execute on function public.kimetomo_admin_wroom_ai_free_list() to authenticated;
revoke all on function public.kimetomo_admin_set_wroom_ai_free(uuid, boolean) from public, anon;
grant execute on function public.kimetomo_admin_set_wroom_ai_free(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';

select 'OK：管理者が選んだ人は、日数・投稿の条件なしでAIの入口を使えるようにしました' as 結果;
