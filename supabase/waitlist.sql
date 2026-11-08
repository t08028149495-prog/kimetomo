-- キメ友SNS: 新規登録の「順番待ち」（先着の受付が終わった日に、メールアドレスを預かる）
--   ・新規登録の画面で、今日の受付（先着）が終わっているときだけ、メールアドレスを入れられる
--   ・管理者には ベルで「📩 順番待ちが N 人」と知らせる（前のお知らせから 3 時間たつまでは、次を出さない）
--   ・管理者メニューの「📩 順番待ち」で「招待を送る」を押すと、1回きりの招待リンク（7日間）をメールで送る
--     → 送れたら、そのメールアドレスはすぐ消す（Edge Function kimetomo-email の waitlist_send）
--   ・招待を送らなかったメールアドレスも、14 日たったら消す
--   ・メールアドレスは管理者にも一部だけ見せる（例：ab•••@gmail.com）
-- 先に invites.sql・invites_open.sql・public_signup.sql を実行しておくこと。何度実行しても大丈夫です。

create table if not exists public.kimetomo_waitlist (
  id bigint generated always as identity primary key,
  email text not null,
  created_at timestamptz not null default now(),
  sending_at timestamptz
);
create unique index if not exists km_waitlist_email_idx on public.kimetomo_waitlist (lower(email));
alter table public.kimetomo_waitlist enable row level security;
revoke all on public.kimetomo_waitlist from anon, authenticated;

-- 古いもの（14日）を消す
create or replace function public.kimetomo_waitlist_cleanup()
returns void language sql security definer set search_path = public as $$
  delete from public.kimetomo_waitlist where created_at < now() - interval '14 days';
$$;
revoke all on function public.kimetomo_waitlist_cleanup() from public, anon, authenticated;

-- 管理者かどうか
create or replace function public.kimetomo_waitlist_is_admin(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.circle_profiles p where p.user_id = p_user and p.is_admin and p.status = 'approved');
$$;
revoke all on function public.kimetomo_waitlist_is_admin(uuid) from public, anon, authenticated;

-- ========== 新規登録の画面：順番待ちに入る ==========
--   返す値：ok（受け付けた。同じアドレスがもうあっても ok） / open（今日はまだ先着で登録できる）
--           bad（メールアドレスの形がおかしい） / many（順番待ちがいっぱい）
create or replace function public.kimetomo_waitlist_join(p_email text, p_fill_ms int default null, p_hp text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  e text := lower(trim(coalesce(p_email, '')));
  n int;
begin
  if (select s.status from public.kimetomo_public_signup() s limit 1) = 'ok' then
    return 'open';
  end if;
  if length(e) > 254 or e !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' then
    return 'bad';
  end if;
  -- ボットらしいもの（見えない欄に入力・2秒未満）は、保存せずに ok を返す
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
  -- 管理者へのお知らせ（前のお知らせから 3 時間たつまでは出さない）
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
revoke all on function public.kimetomo_waitlist_join(text, int, text) from public;
grant execute on function public.kimetomo_waitlist_join(text, int, text) to anon, authenticated;

-- ========== 管理者：順番待ちの一覧（アドレスは一部だけ） ==========
create or replace function public.kimetomo_admin_waitlist()
returns table (id bigint, email_hint text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.kimetomo_waitlist_is_admin(auth.uid()) then raise exception '管理者だけが使えます'; end if;
  perform public.kimetomo_waitlist_cleanup();
  return query
    select w.id,
           left(split_part(w.email, '@', 1), 2) || '•••@' || split_part(w.email, '@', 2),
           w.created_at
    from public.kimetomo_waitlist w
    order by w.created_at
    limit 200;
end $$;
revoke all on function public.kimetomo_admin_waitlist() from public, anon;
grant execute on function public.kimetomo_admin_waitlist() to authenticated;

-- 管理者：順番待ちから消す（いたずらのアドレスなど）
create or replace function public.kimetomo_admin_waitlist_delete(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.kimetomo_waitlist_is_admin(auth.uid()) then raise exception '管理者だけが使えます'; end if;
  delete from public.kimetomo_waitlist where id = p_id;
end $$;
revoke all on function public.kimetomo_admin_waitlist_delete(bigint) from public, anon;
grant execute on function public.kimetomo_admin_waitlist_delete(bigint) to authenticated;

-- ========== Edge Function 用：招待を作って、送る相手を返す（service role だけ） ==========
--   p_ids が null なら古い順に。1回に 20 人まで。送っている途中（10分以内）のものは選ばない
create or replace function public.kimetomo_waitlist_take(p_admin uuid, p_ids bigint[] default null)
returns table (id bigint, email text, code text)
language plpgsql security definer set search_path = public as $$
declare
  w record;
  c text;
begin
  if not public.kimetomo_waitlist_is_admin(p_admin) then raise exception '管理者だけが使えます'; end if;
  for w in
    select x.id, x.email from public.kimetomo_waitlist x
    where (p_ids is null or x.id = any(p_ids))
      and (x.sending_at is null or x.sending_at < now() - interval '10 minutes')
    order by x.created_at
    limit 20
    for update skip locked
  loop
    c := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    insert into public.kimetomo_invites (code, created_by) values (c, p_admin);
    update public.kimetomo_waitlist set sending_at = now() where kimetomo_waitlist.id = w.id;
    id := w.id; email := w.email; code := c;
    return next;
  end loop;
end $$;
revoke all on function public.kimetomo_waitlist_take(uuid, bigint[]) from public, anon, authenticated;

-- 送れたら、メールアドレスを消す（service role だけ）
create or replace function public.kimetomo_waitlist_done(p_id bigint)
returns void language sql security definer set search_path = public as $$
  delete from public.kimetomo_waitlist where id = p_id;
$$;
revoke all on function public.kimetomo_waitlist_done(bigint) from public, anon, authenticated;

select 'OK：順番待ちを使えるようにしました' as 結果;
