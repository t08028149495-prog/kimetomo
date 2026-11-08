-- キメ友SNS: 管理者が「作り直した」古い招待URL・QRコードから来た人は、先着の枠では登録させず、順番待ちだけにする
--   ・作り直しは「変な人に広まったURLを止める」ためなので、古いURLからは先着登録できないようにする
--   ・その人には順番待ち（Gmail）の欄を出す → 管理者が送るか、60分後の自動送信で 1 回きりの招待が届く
--   ・ふつうに使用済み・期限切れになったリンクは今までどおり（先着の枠が空いていれば、その場で登録できる）
-- 先に invites_open.sql・public_signup.sql・waitlist.sql を実行しておくこと。何度実行しても大丈夫です。

-- 招待リンクの状態に revoked（管理者が作り直して止めたもの）を足す
create or replace function public.kimetomo_invite_status(p_code text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when i.revoked then 'revoked'
      when i.expires_at <= now() then 'expired'
      when i.kind = 'single' and i.used_by is not null then 'used'
      when i.kind = 'single' then 'ok'
      when public.kimetomo_invite_today_uses(i.code) >= coalesce(i.daily_limit, 10) then 'full'
      else 'ok_open' end
    from public.kimetomo_invites i where i.code = lower(trim(p_code))), 'none');
$$;
revoke all on function public.kimetomo_invite_status(text) from public;
grant execute on function public.kimetomo_invite_status(text) to anon, authenticated;

-- 順番待ち：止めた古いURLから来た人は、先着の枠が空いていても順番待ちに入れる
drop function if exists public.kimetomo_waitlist_join(text, int, text);
create or replace function public.kimetomo_waitlist_join(p_email text, p_fill_ms int default null, p_hp text default null, p_code text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  e text := lower(trim(coalesce(p_email, '')));
  n int;
  from_revoked boolean := public.kimetomo_invite_status(coalesce(p_code, '')) = 'revoked';
begin
  if not from_revoked and (select s.status from public.kimetomo_public_signup() s limit 1) = 'ok' then
    return 'open';
  end if;
  if length(e) > 254 or e !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' then
    return 'bad';
  end if;
  if split_part(e, '@', 2) not in ('gmail.com', 'googlemail.com') then
    return 'notgmail';
  end if;
  if coalesce(p_hp, '') <> '' or coalesce(p_fill_ms, 99999) < 2000 then
    return 'ok';
  end if;
  perform public.kimetomo_waitlist_cleanup();
  perform pg_advisory_xact_lock(hashtext('kimetomo_waitlist'));
  select count(*) into n from public.kimetomo_waitlist;
  if n >= 500 then
    return 'many';
  end if;
  insert into public.kimetomo_waitlist (email) values (e) on conflict do nothing;
  if not found then
    return 'ok';
  end if;
  if not exists (select 1 from public.kimetomo_bell_notifications b
                 where b.kind = 'admin_notice' and b.ref_id = 'waitlist' and b.created_at > now() - interval '3 hours') then
    insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
    select p.user_id, 'admin_notice', null, 'waitlist',
           '順番待ち ' || (n + 1) || ' 人。管理者メニューの「📩 順番待ち」から招待を送れます',
           '📩 新規登録の順番待ちが ' || (n + 1) || ' 人になりました', './?tab=profile'
    from public.circle_profiles p
    where p.is_admin and p.status = 'approved';
  end if;
  return 'ok';
end $$;
revoke all on function public.kimetomo_waitlist_join(text, int, text, text) from public;
grant execute on function public.kimetomo_waitlist_join(text, int, text, text) to anon, authenticated;

select 'OK：作り直した古いURLからは順番待ちだけにしました' as 結果;
