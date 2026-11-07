-- キメ友SNS: 利用停止（BAN）中の人を、個人チャットのメンバー一覧に出さないようにする
--   ・承認済みのメンバーだけが使える
-- 何度実行しても大丈夫です。
create or replace function public.kimetomo_banned_member_ids()
returns table (user_id uuid) language sql stable security definer set search_path = public as $$
  select b.user_id from public.kimetomo_bans b
  where exists (select 1 from public.circle_profiles p where p.user_id = auth.uid() and p.status = 'approved');
$$;
revoke all on function public.kimetomo_banned_member_ids() from public, anon;
grant execute on function public.kimetomo_banned_member_ids() to authenticated;

select 'OK：BAN中の人を個人チャットの一覧に出さないようにしました' as 結果, count(*) as BAN中の人数 from public.kimetomo_bans;
