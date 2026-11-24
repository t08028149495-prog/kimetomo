-- ⏸ キメ友マスターの毎週の選出を休止（2026-11-24）
-- 予定（kimetomo-master、毎週日曜6時）は消さずにオフにするだけ。印の表示は js/master.js の PAUSED で止めている。
select cron.alter_job((select jobid from cron.job where jobname = 'kimetomo-master'), active := false);

-- 再開するとき（js/master.js の PAUSED も false にする）：
-- select cron.alter_job((select jobid from cron.job where jobname = 'kimetomo-master'), active := true);
