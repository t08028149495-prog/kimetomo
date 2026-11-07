-- キメ友SNS: 招待リンク制
--   ・新規登録は、メンバーが作った招待リンクからだけできる
--   ・招待リンクは 1 回使ったら使えなくなる（1 つのリンクで作れるアカウントは 1 個だけ）
--   ・招待リンクの有効期限は 7 日
--   ・メンバーが作れる招待リンクは 1 日（日本時間）3 件まで。管理者は無制限
--   ・だれの招待で入ったかを管理者メニューで見られる
-- 何度実行しても大丈夫です。
--
-- 【一時的に招待なしで登録できるように戻すとき】
--   drop trigger if exists kimetomo_invite_guard on auth.users;
-- 【招待リンク制に戻すとき】このファイルをもう一度実行する

create table if not exists public.kimetomo_invites (
  code text primary key,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid,
  used_at timestamptz
);
create index if not exists km_invites_created_by_idx on public.kimetomo_invites (created_by, created_at desc);
create index if not exists km_invites_used_at_idx on public.kimetomo_invites (used_at desc) where used_by is not null;
alter table public.kimetomo_invites enable row level security;
revoke all on public.kimetomo_invites from anon, authenticated;

-- 1 日に作れる数（管理者は無制限）
create or replace function public.kimetomo_invite_daily_limit()
returns int language sql immutable as $$ select 3 $$;

-- 今日（日本時間）の 0 時
create or replace function public.kimetomo_jst_today_start()
returns timestamptz language sql stable as $$
  select (date_trunc('day', now() at time zone 'Asia/Tokyo')) at time zone 'Asia/Tokyo';
$$;

-- ========== メンバー：招待リンクを作る ==========
create or replace function public.kimetomo_create_invite()
returns table (code text, expires_at timestamptz, remaining int)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  admin boolean;
  used_today int;
  new_code text;
begin
  if me is null then raise exception 'ログインしてください'; end if;
  select p.is_admin into admin from public.circle_profiles p where p.user_id = me and p.status = 'approved';
  if not found then raise exception '承認されたメンバーだけが招待できます'; end if;
  if to_regprocedure('public.kimetomo_is_banned(uuid)') is not null and public.kimetomo_is_banned(me) then
    raise exception '利用停止中のため招待できません';
  end if;
  -- 同じ人が同時に押しても、上限を超えないようにする
  perform pg_advisory_xact_lock(hashtext('kimetomo_invite:' || me::text));
  select count(*) into used_today from public.kimetomo_invites i
  where i.created_by = me and i.created_at >= public.kimetomo_jst_today_start();
  if not admin and used_today >= public.kimetomo_invite_daily_limit() then
    raise exception '今日作れる招待リンクは % 件までです。明日また作れます。', public.kimetomo_invite_daily_limit();
  end if;
  new_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  insert into public.kimetomo_invites (code, created_by) values (new_code, me);
  return query select new_code, now() + interval '7 days',
    case when admin then -1 else public.kimetomo_invite_daily_limit() - used_today - 1 end;
end $$;
revoke all on function public.kimetomo_create_invite() from public, anon;
grant execute on function public.kimetomo_create_invite() to authenticated;

-- ========== メンバー：今日作った招待リンク ==========
create or replace function public.kimetomo_my_invites()
returns table (code text, created_at timestamptz, expires_at timestamptz, used boolean, remaining int)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  admin boolean := exists (select 1 from public.circle_profiles p where p.user_id = me and p.is_admin and p.status = 'approved');
  used_today int;
begin
  select count(*) into used_today from public.kimetomo_invites i
  where i.created_by = me and i.created_at >= public.kimetomo_jst_today_start();
  return query
    select i.code, i.created_at, i.expires_at, (i.used_by is not null),
           case when admin then -1 else greatest(public.kimetomo_invite_daily_limit() - used_today, 0) end
    from public.kimetomo_invites i
    where i.created_by = me and i.created_at > now() - interval '7 days'
    order by i.created_at desc
    limit 20;
  if not found then
    return query select null::text, null::timestamptz, null::timestamptz, null::boolean,
      case when admin then -1 else greatest(public.kimetomo_invite_daily_limit() - used_today, 0) end;
  end if;
end $$;
revoke all on function public.kimetomo_my_invites() from public, anon;
grant execute on function public.kimetomo_my_invites() to authenticated;

-- ========== 登録画面：招待リンクが使えるか ==========
create or replace function public.kimetomo_check_invite(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.kimetomo_invites i
                 where i.code = lower(trim(p_code)) and i.used_by is null and i.expires_at > now());
$$;
revoke all on function public.kimetomo_check_invite(text) from public;
grant execute on function public.kimetomo_check_invite(text) to anon, authenticated;

-- ========== 新規登録のとき：招待リンクを確かめて「使用済み」にする ==========
create or replace function public.kimetomo_invite_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c text := lower(trim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
begin
  update public.kimetomo_invites
     set used_by = new.id, used_at = now()
   where code = c and used_by is null and expires_at > now();
  if not found then
    raise exception '招待リンクが無効です（使用済み・期限切れ・入力まちがい）' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists kimetomo_invite_guard on auth.users;
create trigger kimetomo_invite_guard before insert on auth.users
  for each row execute function public.kimetomo_invite_guard();

-- ========== 管理者：だれの招待で入ったか ==========
create or replace function public.kimetomo_admin_invites()
returns table (inviter text, invitee text, used_at timestamptz, unused_today bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.circle_profiles where user_id = auth.uid() and is_admin and status = 'approved') then
    raise exception '管理者だけが使えます';
  end if;
  return query
    select coalesce((select nullif(display_name, '') from public.kimetomo_user_profiles u where u.user_id = i.created_by),
                    (select nullif(display_name, '') from public.circle_profiles c where c.user_id = i.created_by), 'メンバー'),
           coalesce((select nullif(display_name, '') from public.kimetomo_user_profiles u where u.user_id = i.used_by),
                    (select nullif(display_name, '') from public.circle_profiles c where c.user_id = i.used_by), '（退会済み）'),
           i.used_at,
           (select count(*) from public.kimetomo_invites x where x.used_by is null and x.created_at >= public.kimetomo_jst_today_start())
    from public.kimetomo_invites i
    where i.used_by is not null
    order by i.used_at desc
    limit 50;
end $$;
revoke all on function public.kimetomo_admin_invites() from public, anon;
grant execute on function public.kimetomo_admin_invites() to authenticated;

select 'OK：招待リンク制を設定しました' as 結果;
