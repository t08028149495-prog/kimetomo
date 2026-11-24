-- 2026-11-25 毎日のお掃除（kimetomo_cleanup）に、増え続けるものを追加する
-- 前の版は diskio_fix.sql。毎日 4:40（日本時間）に自動で動く（cron は diskio_fix.sql で登録済み）。
--   A. Webhook の呼び出し記録（supabase_functions.hooks）は 7 日分だけ残す
--   B. 連投防止の記録（kimetomo_rate_limits）は 1 日より古いものを消す（区切りは最長 10 分）
--   C. 使えなくなったログインの鍵（auth.refresh_tokens の revoked）は 7 日たったら消す
--   D. DM・グループチャットのメッセージは 90 日たったら消す（リアクションも一緒に消える）
--      利用規約 terms.html の 4 番に書いてある。日数を変えるときは両方直す。

create or replace function public.kimetomo_cleanup()
returns text language plpgsql security definer set search_path = public as $$
declare
  n1 bigint := 0;
  n2 bigint := 0;
  n3 bigint := 0;
  n4 bigint := 0;
  n5 bigint := 0;
  n6 bigint := 0;
  n7 bigint := 0;
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

  -- A. Webhook の呼び出し記録は 7 日分だけ残す
  begin
    delete from supabase_functions.hooks where created_at < now() - interval '7 days';
    get diagnostics n3 = row_count;
  exception when others then null;
  end;

  -- B. 連投防止の記録は 1 日より古いものを消す
  delete from public.kimetomo_rate_limits where window_start < now() - interval '1 day';
  get diagnostics n4 = row_count;

  -- C. 使えなくなったログインの鍵は 7 日たったら消す（使える鍵は消さない）
  begin
    delete from auth.refresh_tokens
    where revoked = true and coalesce(updated_at, created_at) < now() - interval '7 days';
    get diagnostics n5 = row_count;
  exception when others then null;
  end;

  -- D. DM・グループチャットは 90 日たったら消す
  delete from public.kimetomo_direct_messages where created_at < now() - interval '90 days';
  get diagnostics n6 = row_count;
  delete from public.circle_messages where created_at < now() - interval '90 days';
  get diagnostics n7 = row_count;

  return format('通知 %s 件、自動実行の記録 %s 件、Webhook の記録 %s 件、連投防止の記録 %s 件、古いログインの鍵 %s 件、DM %s 件、グループチャット %s 件を削除しました',
                n1, n2, n3, n4, n5, n6, n7);
end $$;
revoke all on function public.kimetomo_cleanup() from public, anon, authenticated;

-- 今すぐ 1 回お掃除する
select public.kimetomo_cleanup() as cleanup;
