-- キメ友SNS: 表示名を変えた人も「今の名前」でログインできるようにする（2026-11-09）
-- ログインは、登録したときの名前（ログインID）から作ったアドレスで行っている。
-- 名前を変えた人がログアウトされると、今の名前ではログインできなかった。
-- ここでは「入力された名前 → ログインに使うアドレス」を探して返す。
--   1) ログインIDとして登録されていれば、それ（今までどおり）
--   2) そうでなければ、今の表示名がひとりだけ一致する人のアドレス
-- メールアドレスで登録した人（管理者など）の本物のアドレスは返さない。

create or replace function public.kimetomo_login_email(p_name text, p_email text)
returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v text := lower(btrim(coalesce(p_name, '')));
  e text;
  n int;
begin
  if char_length(v) < 1 or char_length(v) > 60 then return null; end if;
  -- 1) ログインIDで入力された（画面で作ったアドレスが存在する）
  if p_email like '%@users.kimetomo.example'
     and exists (select 1 from auth.users u where u.email = lower(p_email)) then
    return lower(p_email);
  end if;
  -- 2) 今の表示名で探す（同じ名前が2人以上いるときは決められないので返さない）
  select count(*), min(u.email) into n, e
  from auth.users u
  left join public.kimetomo_user_profiles k on k.user_id = u.id
  left join public.circle_profiles c on c.user_id = u.id
  where lower(btrim(coalesce(k.display_name, c.display_name, u.raw_user_meta_data->>'display_name'))) = v
    and u.email like '%@users.kimetomo.example';
  if n = 1 then return e; end if;
  return null;
end $$;
revoke all on function public.kimetomo_login_email(text, text) from public;
grant execute on function public.kimetomo_login_email(text, text) to anon, authenticated, service_role;

-- 名前がほかの人と重ならないか（ほかの人の今の表示名・ログインID）。
-- 重なると、その名前でのログイン先が決められなくなるため、新しく付ける名前で確認する。
create or replace function public.kimetomo_name_taken(p_name text)
returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v text := lower(btrim(coalesce(p_name, '')));
begin
  if v = '' then return false; end if;
  return exists (
    select 1
    from auth.users u
    left join public.kimetomo_user_profiles k on k.user_id = u.id
    left join public.circle_profiles c on c.user_id = u.id
    where u.id is distinct from auth.uid()
      and (lower(btrim(coalesce(k.display_name, c.display_name, u.raw_user_meta_data->>'display_name'))) = v
           or lower(u.raw_user_meta_data->>'username') = v)
  );
end $$;
revoke all on function public.kimetomo_name_taken(text) from public;
grant execute on function public.kimetomo_name_taken(text) to anon, authenticated, service_role;
