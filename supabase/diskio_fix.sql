-- キメ友SNS: 「Disk IO Budget」（ディスクの読み書きの枠）の使いすぎを止める
--   1. 通知の表に索引を付ける（グループチャットのたびに全部を探していたのを止める）
--   2. 古い通知と、自動実行の記録を毎日お掃除する
--   3. のぞうの確認を 5 分ごと → 10 分ごとにする
--   4. 最後に、どの表が大きいかを表示する（結果のスクリーンショットを送ってください）
-- 何度実行しても大丈夫です。

-- ========== 1. 索引 ==========
create index if not exists km_bell_recipient_created_idx
  on public.kimetomo_bell_notifications (recipient_id, created_at desc);
create index if not exists km_bell_unread_idx
  on public.kimetomo_bell_notifications (recipient_id, kind, ref_id) where read_at is null;
create index if not exists km_bell_created_idx
  on public.kimetomo_bell_notifications (created_at);
do $$
begin
  if to_regclass('public.kimetomo_timeline_posts') is not null then
    create index if not exists km_posts_created_idx on public.kimetomo_timeline_posts (created_at desc);
    create index if not exists km_posts_author_idx on public.kimetomo_timeline_posts (author_id, created_at desc);
  end if;
  if to_regclass('public.circle_messages') is not null then
    create index if not exists km_messages_room_idx on public.circle_messages (room_id, created_at desc);
  end if;
  if to_regclass('public.circle_room_members') is not null then
    create index if not exists km_room_members_room_idx on public.circle_room_members (room_id);
    create index if not exists km_room_members_user_idx on public.circle_room_members (user_id);
  end if;
  if to_regclass('public.user_blocks') is not null then
    create index if not exists km_blocks_blocker_idx on public.user_blocks (blocker_id);
    create index if not exists km_blocks_blocked_idx on public.user_blocks (blocked_id);
  end if;
end $$;

-- ========== 2. 毎日のお掃除 ==========
create or replace function public.kimetomo_cleanup()
returns text language plpgsql security definer set search_path = public as $$
declare
  n1 bigint := 0;
  n2 bigint := 0;
begin
  -- 読んだ通知は 14 日、読んでいない通知も 30 日たったら消す
  delete from public.kimetomo_bell_notifications
  where (read_at is not null and created_at < now() - interval '14 days')
     or created_at < now() - interval '30 days';
  get diagnostics n1 = row_count;
  -- 自動実行（cron）の記録は 2 日分だけ残す
  begin
    delete from cron.job_run_details where end_time < now() - interval '2 days';
    get diagnostics n2 = row_count;
  exception when others then null;
  end;
  return format('通知 %s 件、自動実行の記録 %s 件を削除しました', n1, n2);
end $$;
revoke all on function public.kimetomo_cleanup() from public, anon, authenticated;

create extension if not exists pg_cron;
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'kimetomo-cleanup';
  -- 毎日 4:40（日本時間）= 19:40（UTC）
  perform cron.schedule('kimetomo-cleanup', '40 19 * * *', 'select public.kimetomo_cleanup()');
  -- のぞうの確認は 10 分ごと
  if exists (select 1 from cron.job where jobname = 'kimetomo-mascot') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'kimetomo-mascot';
    perform cron.schedule('kimetomo-mascot', '*/10 * * * *', 'select public.kimetomo_mascot_tick()');
  end if;
end $$;

-- 今すぐ 1 回お掃除する
select public.kimetomo_cleanup() as cleanup;

analyze;

-- ========== 4. 大きい表の一覧 ==========
select c.relname as table_name,
       c.reltuples::bigint as rows_estimate,
       pg_size_pretty(pg_total_relation_size(c.oid)) as total_size
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname in ('public', 'cron', 'auth', 'storage', 'realtime')
order by pg_total_relation_size(c.oid) desc
limit 12;
