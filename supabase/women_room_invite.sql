-- キメ友SNS: 🌷 女性トークルーム専用の招待リンク・QRコード（管理者だけが作れる）
--   ・1つのリンクは1回だけ使える。7日で使えなくなる。管理者はいつでも取り消せる
--   ・まだキメ友に登録していない人にも使える（リンクにキメ友の招待コードもいっしょに入れる）
--   ・リンクを開いた人が、プロフィールの性別を♀にして「参加する」を押すと、条件なしで部屋に入れる
--     （部屋の決まり：♀以外は入れない、はそのまま）
--   ・使われたら、管理者のベルに知らせる
-- women_room.sql・invites.sql のあとに実行します。何度実行しても大丈夫です。

create table if not exists public.kimetomo_wroom_invites (
  code text primary key,
  signup_code text,
  note text check (note is null or char_length(note) <= 40),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  revoked boolean not null default false
);
alter table public.kimetomo_wroom_invites enable row level security;

-- 管理者：招待リンクを作る（キメ友の登録用の招待コードもいっしょに作る）
create or replace function public.kimetomo_admin_create_wroom_invite(p_note text)
returns table(code text, signup_code text, expires_at timestamptz)
language plpgsql security definer set search_path to 'public'
as $$
declare me uuid := auth.uid(); c text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
        s text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12); n text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  if n is not null and char_length(n) > 40 then raise exception 'メモは40文字までです'; end if;
  insert into public.kimetomo_invites (code, created_by) values (s, me);
  insert into public.kimetomo_wroom_invites (code, signup_code, note, created_by) values (c, s, n, me);
  return query select c, s, now() + interval '7 days';
end $$;

-- 管理者：作った招待リンクの一覧
create or replace function public.kimetomo_admin_wroom_invites()
returns table(code text, signup_code text, note text, created_at timestamptz, expires_at timestamptz,
              used_at timestamptz, used_name text, revoked boolean)
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  return query
  select i.code, i.signup_code, i.note, i.created_at, i.expires_at, i.used_at,
         (select coalesce(nullif(u.display_name, ''), 'メンバー') from public.kimetomo_user_profiles u where u.user_id = i.used_by),
         i.revoked
  from public.kimetomo_wroom_invites i
  where i.created_at > now() - interval '30 days'
  order by i.created_at desc
  limit 30;
end $$;

-- 管理者：取り消す（登録用の招待コードも使えなくする。もう使われていれば、その人はそのまま）
create or replace function public.kimetomo_admin_revoke_wroom_invite(p_code text)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare s text;
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  update public.kimetomo_wroom_invites set revoked = true where code = p_code and used_by is null returning signup_code into s;
  if s is not null then update public.kimetomo_invites set revoked = true where code = s and used_by is null; end if;
end $$;

-- リンクを開いた人：使えるリンクか確かめる
create or replace function public.kimetomo_wroom_invite_status(p_code text)
returns text language sql stable security definer set search_path to 'public'
as $$
  select case
    when i.code is null then 'bad'
    when i.used_by = auth.uid() then 'mine'
    when i.used_by is not null then 'used'
    when i.revoked or i.expires_at <= now() then 'expired'
    else 'ok' end
  from (select 1) x left join public.kimetomo_wroom_invites i on i.code = lower(btrim(coalesce(p_code, '')))
$$;

-- リンクを開いた人：参加する
create or replace function public.kimetomo_wroom_redeem(p_code text)
returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare me uuid := auth.uid(); r uuid := public.kimetomo_women_room_id(); inv public.kimetomo_wroom_invites;
begin
  if me is null or not public.kimetomo_is_active_member() then raise exception 'ログインしてから使ってください'; end if;
  if r is null then raise exception '部屋が見つかりません'; end if;
  select * into inv from public.kimetomo_wroom_invites where code = lower(btrim(coalesce(p_code, ''))) for update;
  if inv.code is null then raise exception '招待リンクが見つかりません'; end if;
  if public.circle_in_room(r, me) then return r; end if;
  if inv.used_by is not null then raise exception 'この招待リンクは、もう使われています'; end if;
  if inv.revoked or inv.expires_at <= now() then raise exception 'この招待リンクは期限切れです。管理者に新しいリンクをもらってください'; end if;
  if not exists (select 1 from public.kimetomo_user_profiles where user_id = me and gender = 'female') then
    raise exception 'プロフィールの性別を♀にすると参加できます';
  end if;
  insert into public.circle_room_members (room_id, user_id) values (r, me) on conflict do nothing;
  update public.kimetomo_wroom_invites set used_by = me, used_at = now() where code = inv.code;
  update public.kimetomo_room_requests set status = 'approved', decided_at = now(), decided_by = inv.created_by
   where room_id = r and user_id = me;
  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  select p.user_id, 'admin_notice', me, 'wroom', coalesce('メモ：' || inv.note, ''),
         '🌷 招待リンクから、' || public.kimetomo_bell_name(me) || 'さんが女性トークルームに入りました', './?tab=admin'
  from public.circle_profiles p where p.is_admin and p.status = 'approved' and p.user_id <> me;
  return r;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'kimetomo_admin_create_wroom_invite(text)', 'kimetomo_admin_wroom_invites()', 'kimetomo_admin_revoke_wroom_invite(text)',
    'kimetomo_wroom_invite_status(text)', 'kimetomo_wroom_redeem(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';

select 'OK：女性トークルーム専用の招待リンクを作れるようにしました' as 結果;
