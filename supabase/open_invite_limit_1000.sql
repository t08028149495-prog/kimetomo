-- キメ友SNS: 先着登録（管理者の招待URLと共通の枠）の1日の上限を、管理者メニューで 1000 人まで選べるようにする
--   2026-11-24：上限を 100 → 300 人にするため。今の上限も 300 人にする
-- 先に invites_open.sql を実行しておくこと。何度実行しても大丈夫です。

create or replace function public.kimetomo_admin_open_invite_limit(p_limit int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.circle_profiles cp where cp.user_id = auth.uid() and cp.is_admin and cp.status = 'approved') then
    raise exception '管理者だけが使えます';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 1000 then raise exception '1〜1000人で入れてください'; end if;
  update public.kimetomo_invites set daily_limit = p_limit where kind = 'open' and not revoked;
end $$;
revoke all on function public.kimetomo_admin_open_invite_limit(int) from public, anon;
grant execute on function public.kimetomo_admin_open_invite_limit(int) to authenticated;

update public.kimetomo_invites set daily_limit = 300 where kind = 'open' and not revoked;
