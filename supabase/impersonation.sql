-- キメ友SNS: 管理者へのなりすましを止める
--   ・管理者ではない人が、次のような名前にしようとしたら止める（新規登録・表示名の変更）
--       - 管理者の名前と同じ、または管理者の名前を含む名前（「ガラパイ くん」「ｶﾞﾗﾊﾟｲ君」「本物のガラパイ」など）
--       - 「管理者」「管理人」「運営」「公式」「admin」「スタッフ」などを含む名前
--   ・管理者ではない人が、管理者のふりをした書き方で投稿・コメント・チャットをしたら止める
--       （「【管理者】」「管理者より」「運営からのお知らせ」「管理者の私」など）
--   ・止めたときのメッセージ：「管理者になりすます事はできません。」
--   ・管理者は対象外
-- 先に ng_words.sql を実行しておくこと。何度実行しても大丈夫です。

-- 名前をくらべやすい形にする（全角・半角、ひらがな・カタカナ、空白や記号、「くん」「さん」などをそろえる）
create or replace function public.kimetomo_imp_norm(p text)
returns text language sql immutable as $$
  select regexp_replace(
           replace(public.kimetomo_ng_normalize(coalesce(p, '')), '君', 'クン'),
           '(クン|サン|チャン|サマ|様|タン|氏|殿)+$', '');
$$;

create or replace function public.kimetomo_is_admin_user(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null and exists (
    select 1 from public.circle_profiles where user_id = p_user and is_admin and status = 'approved');
$$;

-- 名前が、管理者のなりすましに当たるか
create or replace function public.kimetomo_imp_name_hit(p_name text, p_user uuid default null)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  n text := public.kimetomo_imp_norm(p_name);
  w text;
  core text;
begin
  if public.kimetomo_is_admin_user(p_user) then return false; end if;
  if n = '' then return false; end if;
  foreach w in array array['管理者', '管理人', '運営', '公式', 'アドミン', 'admin', 'staff', 'スタッフ', 'モデレーター', 'moderator'] loop
    if position(public.kimetomo_ng_normalize(w) in public.kimetomo_ng_normalize(p_name)) > 0 then return true; end if;
  end loop;
  for core in
    select distinct public.kimetomo_imp_norm(x.nm)
    from public.circle_profiles a
    cross join lateral (
      select a.display_name as nm
      union all select u.display_name from public.kimetomo_user_profiles u where u.user_id = a.user_id
      union all select au.raw_user_meta_data ->> 'username' from auth.users au where au.id = a.user_id
      union all select au.raw_user_meta_data ->> 'display_name' from auth.users au where au.id = a.user_id
    ) x
    where a.is_admin and a.status = 'approved' and a.user_id is distinct from p_user and x.nm is not null
  loop
    if char_length(core) >= 2 and position(core in n) > 0 then return true; end if;
  end loop;
  return false;
end $$;

-- 文章が、管理者のふりをした書き方に当たるか
create or replace function public.kimetomo_imp_body_hit(p_body text, p_user uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  b text := public.kimetomo_ng_normalize(coalesce(p_body, ''));
  w text;
begin
  if public.kimetomo_is_admin_user(p_user) or b = '' then return false; end if;
  foreach w in array array['【管理者】', '[管理者]', '【管理人】', '[管理人]', '【運営】', '[運営]', '【公式】', '[公式]',
                           '管理者より', '管理人より', '運営より', '管理者からのお知らせ', '管理人からのお知らせ', '運営からのお知らせ',
                           '管理者の私', '管理人の私', '管理者のガラパイ'] loop
    if position(public.kimetomo_ng_normalize(w) in b) > 0 then return true; end if;
  end loop;
  return false;
end $$;

-- 登録画面から使う確認（ログイン前でも使える）
create or replace function public.kimetomo_imp_name_ok(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select not public.kimetomo_imp_name_hit(p_name, auth.uid());
$$;
revoke all on function public.kimetomo_imp_name_ok(text) from public;
grant execute on function public.kimetomo_imp_name_ok(text) to anon, authenticated;
revoke all on function public.kimetomo_imp_name_hit(text, uuid) from public, anon, authenticated;
revoke all on function public.kimetomo_imp_body_hit(text, uuid) from public, anon, authenticated;

-- 保存する前の確認（引数：1つ目＝調べる列、2つ目＝書いた人の列、3つ目＝ name か body）
create or replace function public.kimetomo_imp_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  col text := tg_argv[0];
  who text := tg_argv[1];
  kind text := tg_argv[2];
  rec jsonb := to_jsonb(new);
  val text := rec ->> col;
  uid uuid := nullif(rec ->> who, '')::uuid;
begin
  -- 名前は、変えたときだけ確かめる
  if tg_op = 'UPDATE' and val is not distinct from (to_jsonb(old) ->> col) then return new; end if;
  if (kind = 'name' and public.kimetomo_imp_name_hit(val, uid))
     or (kind = 'body' and public.kimetomo_imp_body_hit(val, uid)) then
    raise exception '管理者になりすます事はできません。' using errcode = 'P0001';
  end if;
  return new;
end $$;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('kimetomo_user_profiles', 'display_name', 'user_id', 'name'),
      ('circle_profiles', 'display_name', 'user_id', 'name'),
      ('kimetomo_timeline_posts', 'body', 'author_id', 'body'),
      ('kimetomo_timeline_comments', 'body', 'author_id', 'body'),
      ('circle_messages', 'body', 'sender_id', 'body'),
      ('kimetomo_direct_messages', 'body', 'sender_id', 'body')
    ) as x(tbl, col, who, kind)
  loop
    if to_regclass('public.' || t.tbl) is not null then
      execute format('drop trigger if exists kimetomo_imp_guard on public.%I', t.tbl);
      execute format('create trigger kimetomo_imp_guard before insert or update on public.%I for each row execute function public.kimetomo_imp_guard(%L, %L, %L)',
                     t.tbl, t.col, t.who, t.kind);
    end if;
  end loop;
end $$;

-- 新規登録のユーザー名も確かめる
create or replace function public.kimetomo_imp_guard_signup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.kimetomo_imp_name_hit(new.raw_user_meta_data ->> 'username', null)
     or public.kimetomo_imp_name_hit(new.raw_user_meta_data ->> 'display_name', null) then
    raise exception '管理者になりすます事はできません。' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists kimetomo_imp_guard_signup on auth.users;
create trigger kimetomo_imp_guard_signup before insert on auth.users
  for each row execute function public.kimetomo_imp_guard_signup();

-- ========== 確認 ==========
-- すでに管理者に似た名前になっているメンバー（参考。名前の変更や BAN は管理者メニューから）
select coalesce(nullif(u.display_name, ''), p.display_name) as なりすましの疑いがある名前
from public.circle_profiles p
left join public.kimetomo_user_profiles u on u.user_id = p.user_id
where not p.is_admin
  and (public.kimetomo_imp_name_hit(coalesce(nullif(u.display_name, ''), p.display_name), p.user_id))
limit 50;
