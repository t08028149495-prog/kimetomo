-- キメ友SNS: 管理者のメンバー一覧に「ログインID」を表示する
-- （ユーザー名を忘れたメンバーに、管理者が教えられるようにする）
drop function if exists public.kimetomo_admin_members();
create function public.kimetomo_admin_members()
returns table (user_id uuid, display_name text, is_admin boolean, banned boolean, reason text, login_id text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.circle_profiles where circle_profiles.user_id = auth.uid() and circle_profiles.is_admin and circle_profiles.status = 'approved') then
    raise exception '管理者だけが使えます';
  end if;
  return query
    select p.user_id, p.display_name, p.is_admin, (b.user_id is not null), b.reason,
           coalesce(u.raw_user_meta_data->>'username', u.raw_user_meta_data->>'display_name')
    from public.circle_profiles p
    join auth.users u on u.id = p.user_id
    left join public.kimetomo_bans b on b.user_id = p.user_id
    where p.status = 'approved' or b.user_id is not null
    order by (b.user_id is not null) desc, p.display_name;
end $$;
revoke all on function public.kimetomo_admin_members() from public, anon;
grant execute on function public.kimetomo_admin_members() to authenticated;
