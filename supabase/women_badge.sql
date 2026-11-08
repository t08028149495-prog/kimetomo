-- キメ友SNS: 🌷 確認済みの女性の印
--   ・名前の横に🌷を出せる。出すかどうかは本人が選ぶ（初めは出さない）
--   ・🌷が出るのは「女性だけの部屋のメンバー（管理者が許可した人）で、性別が♀」の人だけ
--     → ♀を選んだだけの人や、部屋から外れた人には出ない（自動で消える）
-- women_room.sql のあとに実行します。何度実行しても大丈夫です。

alter table public.kimetomo_user_profiles add column if not exists women_badge boolean not null default false;

-- 指定した人のうち、🌷を出す人を返す
create or replace function public.kimetomo_women_badges(p_ids uuid[])
returns setof uuid language sql stable security definer set search_path to 'public'
as $$
  select u.user_id
  from public.kimetomo_user_profiles u
  where public.kimetomo_is_active_member()
    and coalesce(array_length(p_ids, 1), 0) <= 200
    and u.user_id = any (p_ids)
    and u.women_badge
    and u.gender = 'female'
    and public.circle_in_room(public.kimetomo_women_room_id(), u.user_id);
$$;
revoke all on function public.kimetomo_women_badges(uuid[]) from public, anon;
grant execute on function public.kimetomo_women_badges(uuid[]) to authenticated;

notify pgrst, 'reload schema';

select 'OK：🌷 確認済みの女性の印を使えるようにしました' as 結果;
