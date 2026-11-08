-- キメ友SNS: 招待リンクがなくても「先着で登録」できるようにする
--   ・ログイン画面の新規登録で、招待リンクを持っていない人にも「今日の受付：あと N 人」を出す
--   ・中身は「管理者の招待URL・QRコード」の枠をそのまま使う（1日の上限人数も共通）
--     → 上限は管理者メニューの「📣 管理者の招待URL・QRコード」で変えられる
--   ・ボット対策（Turnstile・同じスマホ1日1人・open_invite_bot_ban.sql の自動停止）もそのまま効く
--   ・先着登録を止めたいとき（招待リンクだけに戻す）:
--       insert into public.kimetomo_app_settings (key, value) values ('public_signup', 'false')
--       on conflict (key) do update set value = excluded.value, updated_at = now();
--     また始めるときは 'false' を 'true' にして同じ SQL を実行する
-- 先に invites.sql と invites_open.sql を実行しておくこと。何度実行しても大丈夫です。

-- 返す値
--   status：ok（登録できる） / full（今日の受付がいっぱい） / off（先着登録を止めている・招待URLがない）
--   remaining：今日あと何人登録できるか
--   code：登録に使う招待URLのコード（ok のときだけ）
create or replace function public.kimetomo_public_signup()
returns table (status text, remaining int, code text)
language plpgsql stable security definer set search_path = public as $$
declare
  inv public.kimetomo_invites;
  used int;
  lim int;
begin
  if coalesce((select s.value from public.kimetomo_app_settings s where s.key = 'public_signup'), 'true') = 'false' then
    return query select 'off'::text, 0, null::text;
    return;
  end if;
  select * into inv from public.kimetomo_invites i
  where i.kind = 'open' and not i.revoked and i.expires_at > now()
  order by i.created_at desc limit 1;
  if not found then
    return query select 'off'::text, 0, null::text;
    return;
  end if;
  lim := coalesce(inv.daily_limit, 10);
  used := public.kimetomo_invite_today_uses(inv.code);
  if used >= lim then
    return query select 'full'::text, 0, null::text;
    return;
  end if;
  return query select 'ok'::text, lim - used, inv.code;
end $$;
revoke all on function public.kimetomo_public_signup() from public;
grant execute on function public.kimetomo_public_signup() to anon, authenticated;

select 'OK：招待リンクがなくても先着で登録できるようにしました' as 結果;
