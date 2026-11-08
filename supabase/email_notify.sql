-- キメ友SNS: メール通知（任意）
--   ・プロフィールでメールアドレスを登録すると、確認メールのリンクを押したあとから通知が届く
--   ・「投稿へのコメント・返信」と「DM」が届いたとき、メールでも知らせる（それぞれオン／オフできる）
--   ・メールには内容は書かず、「〇〇さんからDMが届きました」などのお知らせだけを送る
--   ・同じ種類のメールは、1人につき10分に1回まで
--   ・メールアドレスは本人とサーバーだけが使い、ほかのメンバーには見えない
--   ・実際の送信は Edge Function「kimetomo-email」（Resend を使う）
-- 何度実行しても大丈夫です。

create table if not exists public.kimetomo_email_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (char_length(email) <= 254),
  verified_at timestamptz,
  verify_token text,
  verify_sent_at timestamptz,
  off_token text not null default replace(gen_random_uuid()::text, '-', ''),
  notify_reply boolean not null default true,
  notify_dm boolean not null default true,
  last_reply_mail_at timestamptz,
  last_dm_mail_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.kimetomo_email_settings enable row level security;
-- 直接の読み書きは不可（下の関数からだけ操作する）
revoke all on public.kimetomo_email_settings from anon, authenticated;
create index if not exists kimetomo_email_verify_idx on public.kimetomo_email_settings (verify_token) where verify_token is not null;
create index if not exists kimetomo_email_off_idx on public.kimetomo_email_settings (off_token);

-- ========== 本人が使う関数 ==========
-- 自分の設定を見る（メールアドレス・確認済みか・オン／オフ）
create or replace function public.kimetomo_my_email()
returns table (email text, verified boolean, notify_reply boolean, notify_dm boolean)
language sql stable security definer set search_path = public as $$
  select s.email, s.verified_at is not null, s.notify_reply, s.notify_dm
  from public.kimetomo_email_settings s where s.user_id = auth.uid();
$$;

-- メールアドレスを登録・変更する（空にすると登録をやめる）。'sent' のときは確認メールを送る
create or replace function public.kimetomo_set_email(p_email text)
returns text language plpgsql security definer set search_path = public as $$
declare
  e text := lower(trim(coalesce(p_email, '')));
  cur record;
begin
  if auth.uid() is null or not public.kimetomo_caller_is_member() then
    raise exception 'メンバーだけが使えます';
  end if;
  if e = '' then
    delete from public.kimetomo_email_settings where user_id = auth.uid();
    return 'removed';
  end if;
  if char_length(e) > 254 or e !~ '^[^@\s]+@[^@\s]+\.[a-z0-9-]{2,}$' then
    raise exception 'メールアドレスの形が正しくありません';
  end if;
  select * into cur from public.kimetomo_email_settings where user_id = auth.uid();
  if found and cur.email = e and cur.verified_at is not null then
    return 'unchanged';
  end if;
  if found and cur.verify_sent_at > now() - interval '1 minute' then
    raise exception '確認メールは1分に1回まで送れます。少し待ってから、もう一度お試しください。';
  end if;
  insert into public.kimetomo_email_settings (user_id, email, verify_token, verify_sent_at)
  values (auth.uid(), e, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), now())
  on conflict (user_id) do update
    set email = excluded.email, verified_at = null, verify_token = excluded.verify_token,
        verify_sent_at = now(), updated_at = now();
  return 'sent';
end $$;

-- 返信・DMのメール通知を、それぞれオン／オフする
create or replace function public.kimetomo_set_email_notify(p_reply boolean, p_dm boolean)
returns void language sql security definer set search_path = public as $$
  update public.kimetomo_email_settings
     set notify_reply = coalesce(p_reply, notify_reply), notify_dm = coalesce(p_dm, notify_dm), updated_at = now()
   where user_id = auth.uid();
$$;

revoke all on function public.kimetomo_my_email() from public, anon;
revoke all on function public.kimetomo_set_email(text) from public, anon;
revoke all on function public.kimetomo_set_email_notify(boolean, boolean) from public, anon;
grant execute on function public.kimetomo_my_email() to authenticated;
grant execute on function public.kimetomo_set_email(text) to authenticated;
grant execute on function public.kimetomo_set_email_notify(boolean, boolean) to authenticated;

-- ========== サーバー（Edge Function）だけが使う関数 ==========
-- ※ security_lints.sql を実行し直すと authenticated にも実行権限が付くため、中で service_role かどうかを確かめる

-- 確認メールを送るための情報
create or replace function public.kimetomo_email_pending(p_user uuid)
returns table (email text, verify_token text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'サーバーだけが使えます'; end if;
  return query select s.email, s.verify_token from public.kimetomo_email_settings s
    where s.user_id = p_user and s.verified_at is null and s.verify_token is not null;
end $$;

-- 確認メールのリンクが押された（24時間有効）
create or replace function public.kimetomo_email_verify(p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'サーバーだけが使えます'; end if;
  update public.kimetomo_email_settings
     set verified_at = now(), verify_token = null, updated_at = now()
   where verify_token = p_token and verify_sent_at > now() - interval '24 hours';
  return found;
end $$;

-- メールの「この種類のメールを止める」リンクが押された
create or replace function public.kimetomo_email_off(p_token text, p_kind text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'サーバーだけが使えます'; end if;
  update public.kimetomo_email_settings
     set notify_dm = case when p_kind = 'dm' then false else notify_dm end,
         notify_reply = case when p_kind = 'reply' then false else notify_reply end,
         updated_at = now()
   where off_token = p_token and p_kind in ('dm', 'reply');
  return found;
end $$;

-- 通知メールを送ってよいか確かめて、送る相手を返す（10分に1回までに絞る）
create or replace function public.kimetomo_email_claim(p_bell_id bigint)
returns table (email text, off_token text, kind text, actor_name text, url text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  b record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'サーバーだけが使えます'; end if;
  select n.* into b from public.kimetomo_bell_notifications n
   where n.id = p_bell_id and n.created_at > now() - interval '10 minutes';
  if not found or b.kind not in ('comment', 'reply', 'dm') then return; end if;
  if exists (select 1 from public.kimetomo_bans x where x.user_id = b.recipient_id) then return; end if;
  if b.kind = 'dm' then
    return query
      update public.kimetomo_email_settings s set last_dm_mail_at = now()
       where s.user_id = b.recipient_id and s.verified_at is not null and s.notify_dm
         and (s.last_dm_mail_at is null or s.last_dm_mail_at < now() - interval '10 minutes')
      returning s.email, s.off_token, b.kind::text, public.kimetomo_bell_name(b.actor_id), b.url::text;
  else
    return query
      update public.kimetomo_email_settings s set last_reply_mail_at = now()
       where s.user_id = b.recipient_id and s.verified_at is not null and s.notify_reply
         and (s.last_reply_mail_at is null or s.last_reply_mail_at < now() - interval '10 minutes')
      returning s.email, s.off_token, b.kind::text, public.kimetomo_bell_name(b.actor_id), b.url::text;
  end if;
end $$;

revoke all on function public.kimetomo_email_pending(uuid) from public, anon, authenticated;
revoke all on function public.kimetomo_email_verify(text) from public, anon, authenticated;
revoke all on function public.kimetomo_email_off(text, text) from public, anon, authenticated;
revoke all on function public.kimetomo_email_claim(bigint) from public, anon, authenticated;
grant execute on function public.kimetomo_email_pending(uuid) to service_role;
grant execute on function public.kimetomo_email_verify(text) to service_role;
grant execute on function public.kimetomo_email_off(text, text) to service_role;
grant execute on function public.kimetomo_email_claim(bigint) to service_role;

-- ========== 通知が作られたら、メールの Edge Function を呼ぶ ==========
-- 送る ID だけを渡し、Edge Function 側でデータベースを読み直して確かめる（秘密の値は入れない）
create or replace function public.kimetomo_email_on_bell()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind in ('comment', 'reply', 'dm') and exists (
       select 1 from public.kimetomo_email_settings s
        where s.user_id = new.recipient_id and s.verified_at is not null
          and (case when new.kind = 'dm' then s.notify_dm else s.notify_reply end)) then
    perform net.http_post(
      url := 'https://hazcwbczsswjptvblpwt.supabase.co/functions/v1/kimetomo-email',
      body := jsonb_build_object('bell_id', new.id),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 5000);
  end if;
  return new;
end $$;
revoke all on function public.kimetomo_email_on_bell() from public, anon, authenticated;

drop trigger if exists kimetomo_email_bell on public.kimetomo_bell_notifications;
create trigger kimetomo_email_bell after insert on public.kimetomo_bell_notifications
  for each row execute function public.kimetomo_email_on_bell();

notify pgrst, 'reload schema';

select 'OK：メール通知の準備ができました（送信には Resend の設定が必要です）' as 結果;
