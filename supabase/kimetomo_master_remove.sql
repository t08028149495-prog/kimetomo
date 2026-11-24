-- 🗑 キメ友マスターの称号を削除（2026-11-24 実行済み）
-- 画面側は js/master.js ごと削除済み。前の作り方（kimetomo_master.sql・kimetomo_master_random.sql）は git の履歴に残っている。
-- ※ kimetomo_admin_set_setting は固定のお知らせ・応援でも使うので残す（'master_rules' を受け付けるが、使う画面はもうない）。
begin;
select cron.unschedule('kimetomo-master') where exists (select 1 from cron.job where jobname = 'kimetomo-master');
drop function if exists public.kimetomo_award_masters();
drop function if exists public.kimetomo_master_badges();
drop function if exists public.kimetomo_admin_masters();
drop table if exists public.kimetomo_masters;
delete from public.kimetomo_app_settings where key = 'master_rules';
commit;
