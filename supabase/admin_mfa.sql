-- キメ友SNS: 2段階認証（認証アプリ）を設定した人は、確認コードを入れるまで何もできないようにする
--   ・2段階認証を設定するのは管理者だけ（管理者メニューの「🔐 2段階認証」から設定）
--   ・パスワードだけでログインした状態では、データの読み書き・管理者の操作・画像のアップロードをすべて止める
--   ・2段階認証を設定していないメンバーには、何も変わりません
-- 何度実行しても大丈夫です。
--
-- 【もしものとき】iPhone をなくすなどして確認コードが出せなくなったら、
--   下の 1 行を SQL Editor で実行すると、管理者の 2 段階認証を外せます（そのあとパスワードだけでログインできます）。
--   delete from auth.mfa_factors where user_id in (select user_id from public.circle_profiles where is_admin);
--
-- 【元に戻すとき】この仕組みごと止めたいときは、下の 2 行を実行します。
--   alter role authenticator reset pgrst.db_pre_request;
--   notify pgrst, 'reload config';

-- ========== 1. 確認コードまで済んでいるか ==========
-- ・ログインしていない / 2段階認証を設定していない / 確認コードまで済んでいる → true
create or replace function public.kimetomo_mfa_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is null
      or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f
                     where f.user_id = auth.uid() and f.status = 'verified');
$$;
revoke all on function public.kimetomo_mfa_ok() from public;
grant execute on function public.kimetomo_mfa_ok() to anon, authenticated;

-- ========== 2. データの読み書き・関数の呼び出しの前に毎回確かめる ==========
create or replace function public.kimetomo_pre_request()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.kimetomo_mfa_ok() then
    raise exception '2段階認証の確認コードを入力してください' using errcode = '42501';
  end if;
end $$;
revoke all on function public.kimetomo_pre_request() from public;
grant execute on function public.kimetomo_pre_request() to anon, authenticated;

do $$
declare
  cur text;
begin
  select substring(c from '^pgrst\.db_pre_request=(.*)$') into cur
  from pg_roles r, unnest(r.rolconfig) c
  where r.rolname = 'authenticator' and c like 'pgrst.db_pre_request=%';
  if cur is not null and cur not in ('public.kimetomo_pre_request', 'kimetomo_pre_request') then
    raise exception 'すでに別の確認（%）が設定されているため止めました。この画面のスクリーンショットを送ってください。', cur;
  end if;
end $$;
alter role authenticator set pgrst.db_pre_request to 'public.kimetomo_pre_request';
notify pgrst, 'reload config';

-- ========== 3. 管理者の確認にも 2段階認証を含める（画像のアップロードなど） ==========
create or replace function public.kimetomo_caller_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.circle_profiles
    where user_id = auth.uid() and is_admin and status = 'approved'
  ) and public.kimetomo_mfa_ok();
$$;

-- ========== 4. リアルタイム更新・画像の保存場所にも同じ確認を付ける ==========
do $$
declare
  t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists "kimetomo mfa" on public.%I', t.relname);
    execute format(
      'create policy "kimetomo mfa" on public.%I as restrictive for all to authenticated
         using ((select public.kimetomo_mfa_ok())) with check ((select public.kimetomo_mfa_ok()))', t.relname);
  end loop;
end $$;

drop policy if exists "kimetomo mfa" on storage.objects;
create policy "kimetomo mfa" on storage.objects as restrictive for all to authenticated
  using ((select public.kimetomo_mfa_ok())) with check ((select public.kimetomo_mfa_ok()));

-- ========== 確認 ==========
select 'OK：2段階認証の仕組みを設定しました' as 結果,
       (select count(*) from auth.mfa_factors f join public.circle_profiles p on p.user_id = f.user_id
        where p.is_admin and f.status = 'verified') as 設定済みの管理者の数;
