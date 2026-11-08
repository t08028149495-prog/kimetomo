-- キメ友SNS: 順番待ちの人へ、管理者が送らなかったら自動で招待リンク（URL・QRコード）を送る
--   ・順番待ちに入ってから 60 分たっても管理者が送っていない人に、10 分ごとに自動で送る
--   ・自動で送るのは 1 日（日本時間）50 人まで（メール送信 Resend の無料枠は 1 日 100 通のため）
--   ・送るメールの差出人は noreply@kimetomo.com。管理者のメールアドレスは相手に見えない
--   ・自動で送ったら、管理者にベルで知らせる（3 時間に 1 回まで）
--   ・変えるとき（例：30 分にする・止める）:
--       insert into public.kimetomo_app_settings (key, value) values ('waitlist_auto_minutes', '30')
--       on conflict (key) do update set value = excluded.value, updated_at = now();
--     '0' にすると自動では送らない。1 日の上限は 'waitlist_auto_daily'
-- 先に waitlist.sql を実行しておくこと。何度実行しても大丈夫です。

create table if not exists public.kimetomo_waitlist_auto_days (
  day date primary key,
  sent int not null default 0
);
alter table public.kimetomo_waitlist_auto_days enable row level security;
revoke all on public.kimetomo_waitlist_auto_days from anon, authenticated;

create or replace function public.kimetomo_waitlist_auto_setting(p_key text, p_default int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select case when s.value ~ '^[0-9]{1,6}$' then s.value::int end
                   from public.kimetomo_app_settings s where s.key = p_key), p_default);
$$;
revoke all on function public.kimetomo_waitlist_auto_setting(text, int) from public, anon, authenticated;

-- 自動で送る相手を選んで、招待を作る（Edge Function から。service role だけ）
create or replace function public.kimetomo_waitlist_take_auto()
returns table (id bigint, email text, code text)
language plpgsql security definer set search_path = public as $$
declare
  mins int := public.kimetomo_waitlist_auto_setting('waitlist_auto_minutes', 60);
  daily int := public.kimetomo_waitlist_auto_setting('waitlist_auto_daily', 50);
  today date := (now() at time zone 'Asia/Tokyo')::date;
  done_today int;
  room int;
  adm uuid;
  w record;
  c text;
  n int := 0;
begin
  if mins <= 0 or daily <= 0 then return; end if;
  perform pg_advisory_xact_lock(hashtext('kimetomo_waitlist_auto'));
  select coalesce((select d.sent from public.kimetomo_waitlist_auto_days d where d.day = today), 0) into done_today;
  room := least(20, daily - done_today);
  if room <= 0 then return; end if;
  select p.user_id into adm from public.circle_profiles p
  where p.is_admin and p.status = 'approved' order by p.created_at limit 1;
  if adm is null then return; end if;
  for w in
    select x.id, x.email from public.kimetomo_waitlist x
    where x.created_at < now() - make_interval(mins => mins)
      and (x.sending_at is null or x.sending_at < now() - interval '10 minutes')
    order by x.created_at
    limit room
    for update skip locked
  loop
    c := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    insert into public.kimetomo_invites (code, created_by) values (c, adm);
    update public.kimetomo_waitlist set sending_at = now() where kimetomo_waitlist.id = w.id;
    n := n + 1;
    id := w.id; email := w.email; code := c;
    return next;
  end loop;
  if n > 0 then
    insert into public.kimetomo_waitlist_auto_days (day, sent) values (today, n)
    on conflict (day) do update set sent = kimetomo_waitlist_auto_days.sent + excluded.sent;
    if not exists (select 1 from public.kimetomo_bell_notifications b
                   where b.kind = 'admin_notice' and b.ref_id = 'waitlist_auto' and b.created_at > now() - interval '3 hours') then
      insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
      select p.user_id, 'admin_notice', null, 'waitlist_auto',
             '順番待ちの人へ、自動で招待リンクを送りました（今日 ' || (done_today + n) || ' 人）',
             '📨 順番待ちの人へ、自動で招待を送りました', './?tab=profile'
      from public.circle_profiles p
      where p.is_admin and p.status = 'approved';
    end if;
  end if;
end $$;
revoke all on function public.kimetomo_waitlist_take_auto() from public, anon, authenticated;

-- 10 分ごと：自動で送る相手がいるときだけ、Edge Function を呼ぶ
create or replace function public.kimetomo_waitlist_auto_tick()
returns void language plpgsql security definer set search_path = public as $$
declare
  mins int := public.kimetomo_waitlist_auto_setting('waitlist_auto_minutes', 60);
begin
  if mins <= 0 then return; end if;
  if exists (select 1 from public.kimetomo_waitlist x
             where x.created_at < now() - make_interval(mins => mins)
               and (x.sending_at is null or x.sending_at < now() - interval '10 minutes')) then
    perform net.http_post(
      url := 'https://hazcwbczsswjptvblpwt.supabase.co/functions/v1/kimetomo-email',
      body := jsonb_build_object('action', 'waitlist_auto'),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 60000);
  end if;
end $$;
revoke all on function public.kimetomo_waitlist_auto_tick() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'kimetomo-waitlist-auto') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'kimetomo-waitlist-auto';
  end if;
  perform cron.schedule('kimetomo-waitlist-auto', '*/10 * * * *', 'select public.kimetomo_waitlist_auto_tick()');
end $$;

select 'OK：順番待ちの自動送信を使えるようにしました' as 結果;
