-- キメ友SNS: 🌷 女性だけの部屋に、管理者だけは条件なしで参加できるようにする
--   ・管理者は、性別や登録日数などの条件なしで「管理者として参加する」ボタンから入れる
--   ・管理者は、性別を変えても部屋から自動では外れない
--   women_room.sql のあとに実行します。何度実行しても大丈夫です。

-- ♀でない人は入れない。ただし管理者は入れる
create or replace function public.kimetomo_women_room_guard()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if exists (select 1 from public.circle_rooms where id = new.room_id and women_only)
     and not exists (select 1 from public.kimetomo_user_profiles
                     where user_id = new.user_id and gender = 'female')
     and not exists (select 1 from public.circle_profiles
                     where user_id = new.user_id and is_admin and status = 'approved') then
    raise exception '女性だけの部屋には、性別が♀の人しか入れません';
  end if;
  return new;
end $$;

-- ♀以外に変えたら外す。ただし管理者は外さない
create or replace function public.kimetomo_gender_left_women_room()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if old.gender = 'female' and new.gender is distinct from 'female'
     and not exists (select 1 from public.circle_profiles
                     where user_id = new.user_id and is_admin and status = 'approved') then
    delete from public.circle_room_members m using public.circle_rooms r
      where m.room_id = r.id and r.women_only and m.user_id = new.user_id;
    delete from public.kimetomo_room_requests q
      where q.user_id = new.user_id and q.status = 'pending';
  end if;
  return new;
end $$;

-- 自分の状態に「管理者かどうか」を足す
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
    'days_left', greatest(0, ceil(extract(epoch from (joined + interval '14 days' - now())) / 86400))::int,
    'acts', acts,
    'acts_need', 3,
    'gender_days_left', case when gc is null then 0
                             else greatest(0, ceil(extract(epoch from (gc + interval '7 days' - now())) / 86400))::int end
  );
end $$;

-- 管理者として参加する
create or replace function public.kimetomo_admin_join_women_room()
returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare r uuid := public.kimetomo_women_room_id();
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  if r is null then raise exception '部屋が見つかりません'; end if;
  insert into public.circle_room_members (room_id, user_id) values (r, auth.uid()) on conflict do nothing;
  return r;
end $$;
revoke all on function public.kimetomo_admin_join_women_room() from public, anon;
grant execute on function public.kimetomo_admin_join_women_room() to authenticated;

notify pgrst, 'reload schema';

select 'OK：管理者は条件なしで女性だけの部屋に参加できるようになりました' as 結果;
