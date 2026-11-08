-- キメ友SNS: パスワードを忘れたときの再設定（メール通知に登録して確認済みのメールアドレスに送る）
--   ・ログイン画面の「パスワードを忘れた方」から、ユーザー名（またはログイン用メールアドレス）を入れて申し込む
--   ・確認済みのメール通知アドレスがある人にだけ、再設定のリンクを送る（ない人には何も送らない）
--   ・リンクは1時間だけ・1回だけ使える。同じ人への再設定メールは10分に1回まで
--   ・BAN 中の人には送らない
--   ・実際の送信とパスワードの変更は Edge Function「kimetomo-email」が行う
-- 先に email_notify.sql を実行しておくこと。何度実行しても大丈夫です。

create table if not exists public.kimetomo_pw_resets (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
alter table public.kimetomo_pw_resets enable row level security;
-- 直接の読み書きは不可（下の関数からだけ操作する）
revoke all on public.kimetomo_pw_resets from anon, authenticated;
create index if not exists kimetomo_pw_resets_user_idx on public.kimetomo_pw_resets (user_id, created_at desc);

-- ※ どれもサーバー（Edge Function）だけが使う。security_lints.sql を実行し直しても大丈夫なよう、中で service_role かどうかを確かめる

-- 申し込み：送り先のメールアドレスと、再設定用のトークンを返す（送れない場合は何も返さない）
create or replace function public.kimetomo_pw_reset_request(p_login_email text)
returns table (email text, token text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  uid uuid;
  dest text;
  t text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'サーバーだけが使えます'; end if;
  select u.id into uid from auth.users u where lower(u.email) = lower(trim(coalesce(p_login_email, '')));
  if uid is null then return; end if;
  if exists (select 1 from public.kimetomo_bans b where b.user_id = uid) then return; end if;
  select s.email into dest from public.kimetomo_email_settings s where s.user_id = uid and s.verified_at is not null;
  if dest is null then return; end if;
  if exists (select 1 from public.kimetomo_pw_resets r where r.user_id = uid and r.created_at > now() - interval '10 minutes') then return; end if;
  t := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.kimetomo_pw_resets (token, user_id) values (t, uid);
  delete from public.kimetomo_pw_resets r where r.created_at < now() - interval '7 days';
  return query select dest, t;
end $$;

-- リンクがまだ使えるか（使える場合は、その人の ID と通知先のメールアドレスを返す。使用済みにはしない）
create or replace function public.kimetomo_pw_reset_peek(p_token text)
returns table (user_id uuid, email text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'サーバーだけが使えます'; end if;
  return query
    select r.user_id, s.email
    from public.kimetomo_pw_resets r
    left join public.kimetomo_email_settings s on s.user_id = r.user_id and s.verified_at is not null
    where r.token = p_token and r.used_at is null and r.created_at > now() - interval '1 hour'
      and not exists (select 1 from public.kimetomo_bans b where b.user_id = r.user_id);
end $$;

-- パスワードを変えたあと、リンクを使用済みにする（その人の、ほかの未使用リンクも無効にする）
create or replace function public.kimetomo_pw_reset_use(p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'サーバーだけが使えます'; end if;
  update public.kimetomo_pw_resets set used_at = now()
   where token = p_token and used_at is null
  returning user_id into uid;
  if uid is null then return false; end if;
  update public.kimetomo_pw_resets set used_at = now() where user_id = uid and used_at is null;
  return true;
end $$;

revoke all on function public.kimetomo_pw_reset_request(text) from public, anon, authenticated;
revoke all on function public.kimetomo_pw_reset_peek(text) from public, anon, authenticated;
revoke all on function public.kimetomo_pw_reset_use(text) from public, anon, authenticated;
grant execute on function public.kimetomo_pw_reset_request(text) to service_role;
grant execute on function public.kimetomo_pw_reset_peek(text) to service_role;
grant execute on function public.kimetomo_pw_reset_use(text) to service_role;

notify pgrst, 'reload schema';

select 'OK：パスワードの再設定の準備ができました' as 結果;
