-- キメ友SNS: Supabase の「Security Advisor」の注意（Warnings）を減らす
--   1. 関数の search_path（探す場所）を固定する
--   2. ログイン前の人（anon）が呼べる関数を、本当に必要なものだけにする
--   3. トリガー専用の関数は、だれも直接呼べないようにする（トリガーとしては今までどおり動く）
--   ※ 管理者用・メンバー用の関数は、中で「管理者か」「メンバーか」を確かめているので、そのままで大丈夫です
-- 何度実行しても大丈夫です。

-- ========== 1. search_path を固定 ==========
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname like any (array['kimetomo%', 'circle%'])
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end $$;

-- ========== 2・3. 呼べる人をしぼる ==========
do $$
declare
  f record;
  -- ログイン前（新規登録・ログイン画面）でも使う関数
  anon_ok text[] := array['kimetomo_check_invite', 'kimetomo_invite_status', 'kimetomo_imp_name_ok',
                          'kimetomo_username_exists', 'kimetomo_mfa_ok', 'kimetomo_pre_request',
                          'kimetomo_login_email', 'kimetomo_name_taken'];
begin
  for f in
    select p.oid::regprocedure as sig, p.proname, p.prorettype = 'trigger'::regtype as is_trigger
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef
      and p.proname like any (array['kimetomo%', 'circle%'])
  loop
    if f.is_trigger then
      execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    elsif not (f.proname = any (anon_ok)) then
      execute format('revoke all on function %s from public, anon', f.sig);
      execute format('grant execute on function %s to authenticated, service_role', f.sig);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ========== 確認 ==========
select (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')
          and p.proname like any (array['kimetomo%', 'circle%'])) as ログイン前でも呼べる関数の数,
       'OK：Security Advisor の注意を減らしました' as 結果;
