-- キメ友SNS: PayPay のリンク（Myコード）の有効期限が近づいたら、管理者に知らせる
--   ・リンクを保存してから 12 日たったら、ベル🔔とプッシュ通知で「貼り替えてね」と知らせる（1日1回まで）
--   ・14 日たって期限が切れたら、メンバーの画面では応援の欄を自動で隠す（画面側で処理）
-- 先に request_pause.sql と support_setup.sql を実行しておくこと。何度実行しても大丈夫です。

-- 通知の種類に「管理者へのお知らせ」を足す。
-- すでに保存されている通知の種類は、そのまま使えるように一覧に含める
do $$
declare
  kinds text;
begin
  select string_agg(quote_literal(k), ', ') into kinds from (
    select unnest(array['chat', 'dm', 'comment', 'reply', 'request_new', 'request_done', 'admin_notice']) as k
    union
    select distinct kind from public.kimetomo_bell_notifications where kind is not null
  ) x;
  alter table public.kimetomo_bell_notifications drop constraint if exists kimetomo_bell_notifications_kind_check;
  -- not valid：すでにある通知は確認せず、これから作る通知だけ確認する
  execute format('alter table public.kimetomo_bell_notifications add constraint kimetomo_bell_notifications_kind_check check (kind in (%s)) not valid', kinds);
end $$;

create or replace function public.kimetomo_support_reminder()
returns text language plpgsql security definer set search_path = public as $$
declare
  saved timestamptz;
  url text;
  days_left int;
begin
  select value, updated_at into url, saved from public.kimetomo_app_settings where key = 'support_paypay_url';
  if coalesce(url, '') = '' or saved is null then return 'not set'; end if;
  if now() < saved + interval '12 days' then return 'ok'; end if;
  -- 同じお知らせは 1 日 1 回まで
  if exists (select 1 from public.kimetomo_bell_notifications
             where kind = 'admin_notice' and ref_id = 'support_paypay' and created_at > now() - interval '20 hours') then
    return 'already notified';
  end if;
  days_left := ceil(extract(epoch from (saved + interval '14 days' - now())) / 86400);
  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  select p.user_id, 'admin_notice', null, 'support_paypay', '',
         case when days_left > 0
              then '💝 PayPayのリンクの期限があと' || days_left || '日です。新しいリンクに貼り替えてください'
              else '💝 PayPayのリンクの期限が切れました。新しいリンクに貼り替えてください' end,
         './?tab=profile&support=1'
  from public.circle_profiles p
  where p.is_admin and p.status = 'approved';
  return 'notified';
end $$;
revoke all on function public.kimetomo_support_reminder() from public, anon, authenticated;

create extension if not exists pg_cron;
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'kimetomo-support-reminder';
  -- 毎日 10:13（日本時間）= 1:13（UTC）
  perform cron.schedule('kimetomo-support-reminder', '13 1 * * *', 'select public.kimetomo_support_reminder()');
end $$;

-- 確認：今ある通知の種類と件数
select kind, count(*) from public.kimetomo_bell_notifications group by kind order by 2 desc;
