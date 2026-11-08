-- キメ友SNS: 管理者の招待URL・QRコードから「ボット」が登録したら、その場で永久に利用停止（BAN）する
--   ボットと判断するのは、人ではまず起きない次のどれかのときだけ（名前の形や登録の多さでは判断しない）
--     1. 登録画面を通さずに登録した（画面が付ける目印がない）
--     2. 人には見えない「わな」の入力欄に何か入っている
--     3. 登録画面を開いてから 3 秒未満で登録ボタンが押された
--   ・対象は管理者の招待URL（kind = 'open'）からの登録だけ。メンバーの1回きりの招待リンクは今までどおり
--   ・BAN の理由は「🤖 招待URLからのボット登録（自動で永久停止）…」。期限はなく、自動では解除されない
--   ・もし人がまちがって止められたときは、管理者メニューの「🚫 メンバー管理（BAN）」から解除できる
--   ・この仕組みで何か失敗しても、登録そのものは止めない（ふつうの人が登録できなくなるのを防ぐ）
-- 先に ban_setup.sql と invites_open.sql を実行しておくこと。何度実行しても大丈夫です。
--
-- 【この自動停止をやめるとき】
--   drop trigger if exists kimetomo_open_invite_bot_ban on auth.users;

create or replace function public.kimetomo_open_invite_bot_ban()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  c text := lower(trim(coalesce(m ->> 'invite_code', '')));
  fill text := m ->> 'km_fill_ms';
  why text[] := '{}';
begin
  -- 管理者の招待URLからの登録だけを見る
  if not exists (select 1 from public.kimetomo_invites i where i.code = c and i.kind = 'open') then
    return new;
  end if;
  if coalesce(m ->> 'km_form', '') = '' then
    why := why || '登録画面を通さずに登録'::text;
  end if;
  if coalesce(m ->> 'km_hp', '') <> '' then
    why := why || '見えない欄に入力あり'::text;
  end if;
  if fill ~ '^-?[0-9]{1,12}$' and fill::bigint < 3000 then
    why := why || ('画面を開いて ' || round(greatest(fill::bigint, 0) / 1000.0, 1) || ' 秒で登録')::text;
  end if;
  if cardinality(why) = 0 then
    return new;
  end if;

  begin
    insert into public.kimetomo_bans (user_id, banned_by, reason)
    values (new.id, null, '🤖 招待URLからのボット登録（自動で永久停止）：' || array_to_string(why, '・'))
    on conflict (user_id) do update set reason = excluded.reason, created_at = now();
    -- circle_signup_trigger（名前順で先に動く）が作ったプロフィールを「利用停止」にする
    update public.circle_profiles set status = 'rejected' where user_id = new.id;
  exception when others then
    raise warning 'kimetomo_open_invite_bot_ban: %', sqlerrm;
  end;
  return new;
end $$;
revoke all on function public.kimetomo_open_invite_bot_ban() from public, anon, authenticated;

-- 名前順で circle_signup_trigger（プロフィール作成）のあとに動く
drop trigger if exists kimetomo_open_invite_bot_ban on auth.users;
create trigger kimetomo_open_invite_bot_ban after insert on auth.users
  for each row execute function public.kimetomo_open_invite_bot_ban();

-- ========== 管理者：招待URLから自動で止めたボットの数 ==========
create or replace function public.kimetomo_admin_open_invite_bots()
returns table (today_bans int, total_bans int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.circle_profiles cp where cp.user_id = auth.uid() and cp.is_admin and cp.status = 'approved') then
    raise exception '管理者だけが使えます';
  end if;
  return query
    select count(*) filter (where b.created_at >= public.kimetomo_jst_today_start())::int, count(*)::int
    from public.kimetomo_bans b
    where b.reason like '🤖 招待URLからのボット登録%';
end $$;
revoke all on function public.kimetomo_admin_open_invite_bots() from public, anon;
grant execute on function public.kimetomo_admin_open_invite_bots() to authenticated;

select 'OK：招待URLからのボット登録を自動で永久停止するようにしました' as 結果;
