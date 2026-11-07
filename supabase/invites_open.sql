-- キメ友SNS: 管理者専用の「何人でも使える招待URL・QRコード」
--   ・管理者メニューの「📣 管理者の招待URL・QRコード」で表示・作り直しができる
--   ・このURLからの新規登録は「1日○人まで」（はじめは10人。管理者メニューで変更できる）
--   ・作り直すと、前のURLとQRコードは使えなくなる
--   ・メンバーの1回きりの招待リンク（1人1日3件まで）は今までどおり
-- 先に invites.sql を実行しておくこと。何度実行しても大丈夫です。

alter table public.kimetomo_invites add column if not exists kind text not null default 'single';
alter table public.kimetomo_invites add column if not exists daily_limit int;
alter table public.kimetomo_invites add column if not exists revoked boolean not null default false;
alter table public.kimetomo_invites drop constraint if exists kimetomo_invites_kind_check;
alter table public.kimetomo_invites add constraint kimetomo_invites_kind_check check (kind in ('single', 'open'));

create table if not exists public.kimetomo_invite_uses (
  id bigint generated always as identity primary key,
  code text not null references public.kimetomo_invites(code) on delete cascade,
  user_id uuid not null,
  used_at timestamptz not null default now()
);
create index if not exists km_invite_uses_code_idx on public.kimetomo_invite_uses (code, used_at desc);
alter table public.kimetomo_invite_uses enable row level security;
revoke all on public.kimetomo_invite_uses from anon, authenticated;

-- 今日（日本時間）この招待URLから登録した人数
create or replace function public.kimetomo_invite_today_uses(p_code text)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.kimetomo_invite_uses u
  where u.code = p_code and u.used_at >= public.kimetomo_jst_today_start();
$$;
revoke all on function public.kimetomo_invite_today_uses(text) from public, anon, authenticated;

-- ========== 登録画面：招待リンクの状態 ==========
--   ok：使える（1回きり） / ok_open：使える（管理者の招待URL） / used：使用済み
--   expired：期限切れ・作り直し済み / full：今日の受付人数がいっぱい / none：見つからない
create or replace function public.kimetomo_invite_status(p_code text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when i.revoked or i.expires_at <= now() then 'expired'
      when i.kind = 'single' and i.used_by is not null then 'used'
      when i.kind = 'single' then 'ok'
      when public.kimetomo_invite_today_uses(i.code) >= coalesce(i.daily_limit, 10) then 'full'
      else 'ok_open' end
    from public.kimetomo_invites i where i.code = lower(trim(p_code))), 'none');
$$;
revoke all on function public.kimetomo_invite_status(text) from public;
grant execute on function public.kimetomo_invite_status(text) to anon, authenticated;

create or replace function public.kimetomo_check_invite(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.kimetomo_invite_status(p_code) in ('ok', 'ok_open');
$$;

-- ========== 新規登録のとき：招待を確かめて記録する ==========
create or replace function public.kimetomo_invite_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c text := lower(trim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
  inv public.kimetomo_invites;
begin
  select * into inv from public.kimetomo_invites where code = c for update;
  if not found or inv.revoked or inv.expires_at <= now() then
    raise exception '招待リンクが無効です（期限切れ・入力まちがい）' using errcode = 'P0001';
  end if;
  if inv.kind = 'open' then
    if public.kimetomo_invite_today_uses(c) >= coalesce(inv.daily_limit, 10) then
      raise exception '今日の受付人数がいっぱいです' using errcode = 'P0001';
    end if;
    insert into public.kimetomo_invite_uses (code, user_id) values (c, new.id);
  else
    if inv.used_by is not null then
      raise exception '招待リンクは使用済みです' using errcode = 'P0001';
    end if;
    update public.kimetomo_invites set used_by = new.id, used_at = now() where code = c;
  end if;
  return new;
end $$;
drop trigger if exists kimetomo_invite_guard on auth.users;
create trigger kimetomo_invite_guard before insert on auth.users
  for each row execute function public.kimetomo_invite_guard();

-- ========== メンバーの 1 回きりの招待リンク（管理者の招待URLは数えない） ==========
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
  perform pg_advisory_xact_lock(hashtext('kimetomo_invite:' || me::text));
  select count(*) into used_today from public.kimetomo_invites i
  where i.created_by = me and i.kind = 'single' and i.created_at >= public.kimetomo_jst_today_start();
  if not admin and used_today >= public.kimetomo_invite_daily_limit() then
    raise exception '今日作れる招待リンクは % 件までです。明日また作れます。', public.kimetomo_invite_daily_limit();
  end if;
  new_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  insert into public.kimetomo_invites (code, created_by) values (new_code, me);
  return query select new_code, now() + interval '7 days',
    case when admin then -1 else public.kimetomo_invite_daily_limit() - used_today - 1 end;
end $$;

create or replace function public.kimetomo_my_invites()
returns table (code text, created_at timestamptz, expires_at timestamptz, used boolean, remaining int)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  admin boolean := exists (select 1 from public.circle_profiles p where p.user_id = me and p.is_admin and p.status = 'approved');
  used_today int;
begin
  select count(*) into used_today from public.kimetomo_invites i
  where i.created_by = me and i.kind = 'single' and i.created_at >= public.kimetomo_jst_today_start();
  return query
    select i.code, i.created_at, i.expires_at, (i.used_by is not null),
           case when admin then -1 else greatest(public.kimetomo_invite_daily_limit() - used_today, 0) end
    from public.kimetomo_invites i
    where i.created_by = me and i.kind = 'single' and i.created_at > now() - interval '7 days'
    order by i.created_at desc
    limit 20;
  if not found then
    return query select null::text, null::timestamptz, null::timestamptz, null::boolean,
      case when admin then -1 else greatest(public.kimetomo_invite_daily_limit() - used_today, 0) end;
  end if;
end $$;

-- ========== 管理者の招待URL ==========
create or replace function public.kimetomo_admin_open_invite()
returns table (code text, daily_limit int, today_uses int, total_uses int)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  inv public.kimetomo_invites;
begin
  if not exists (select 1 from public.circle_profiles cp where cp.user_id = me and cp.is_admin and cp.status = 'approved') then
    raise exception '管理者だけが使えます';
  end if;
  select * into inv from public.kimetomo_invites i
  where i.kind = 'open' and not i.revoked and i.expires_at > now()
  order by i.created_at desc limit 1;
  if not found then
    insert into public.kimetomo_invites (code, created_by, kind, daily_limit, expires_at)
    values (substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), me, 'open', 10, now() + interval '100 years')
    returning * into inv;
  end if;
  return query select inv.code, coalesce(inv.daily_limit, 10), public.kimetomo_invite_today_uses(inv.code),
    (select count(*)::int from public.kimetomo_invite_uses u where u.code = inv.code);
end $$;
revoke all on function public.kimetomo_admin_open_invite() from public, anon;
grant execute on function public.kimetomo_admin_open_invite() to authenticated;

-- 作り直す（前の URL と QR コードは使えなくなる）
create or replace function public.kimetomo_admin_open_invite_reset()
returns void language plpgsql security definer set search_path = public as $$
declare
  lim int;
begin
  if not exists (select 1 from public.circle_profiles cp where cp.user_id = auth.uid() and cp.is_admin and cp.status = 'approved') then
    raise exception '管理者だけが使えます';
  end if;
  select i.daily_limit into lim from public.kimetomo_invites i
  where i.kind = 'open' and not i.revoked order by i.created_at desc limit 1;
  update public.kimetomo_invites set revoked = true where kind = 'open' and not revoked;
  insert into public.kimetomo_invites (code, created_by, kind, daily_limit, expires_at)
  values (substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), auth.uid(), 'open', coalesce(lim, 10), now() + interval '100 years');
end $$;
revoke all on function public.kimetomo_admin_open_invite_reset() from public, anon;
grant execute on function public.kimetomo_admin_open_invite_reset() to authenticated;

-- 1日の上限人数を変える（1〜100人）
create or replace function public.kimetomo_admin_open_invite_limit(p_limit int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.circle_profiles cp where cp.user_id = auth.uid() and cp.is_admin and cp.status = 'approved') then
    raise exception '管理者だけが使えます';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100 then raise exception '1〜100人で入れてください'; end if;
  update public.kimetomo_invites set daily_limit = p_limit where kind = 'open' and not revoked;
end $$;
revoke all on function public.kimetomo_admin_open_invite_limit(int) from public, anon;
grant execute on function public.kimetomo_admin_open_invite_limit(int) to authenticated;

-- ========== 管理者：だれの招待で入ったか（管理者の招待URLからの登録も含む） ==========
create or replace function public.kimetomo_admin_invites()
returns table (inviter text, invitee text, used_at timestamptz, unused_today bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.circle_profiles cp where cp.user_id = auth.uid() and cp.is_admin and cp.status = 'approved') then
    raise exception '管理者だけが使えます';
  end if;
  return query
    with x as (
      select i.created_by as by_id, i.used_by as new_id, i.used_at as at, false as via_open
      from public.kimetomo_invites i where i.kind = 'single' and i.used_by is not null
      union all
      select i.created_by, u.user_id, u.used_at, true
      from public.kimetomo_invite_uses u join public.kimetomo_invites i on i.code = u.code
    )
    select coalesce((select nullif(display_name, '') from public.kimetomo_user_profiles p where p.user_id = x.by_id),
                    (select nullif(display_name, '') from public.circle_profiles c where c.user_id = x.by_id), 'メンバー')
             || case when x.via_open then '（招待URL・QR）' else '' end,
           coalesce((select nullif(display_name, '') from public.kimetomo_user_profiles p where p.user_id = x.new_id),
                    (select nullif(display_name, '') from public.circle_profiles c where c.user_id = x.new_id), '（退会済み）'),
           x.at,
           (select count(*) from public.kimetomo_invites y where y.kind = 'single' and y.used_by is null
              and y.created_at >= public.kimetomo_jst_today_start())
    from x
    order by x.at desc
    limit 50;
end $$;

select 'OK：管理者の招待URL・QRコードを使えるようにしました' as 結果;
