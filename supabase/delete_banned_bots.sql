-- キメ友SNS: まとめて BAN したボット候補のアカウントを、完全に削除する
--   ・対象は bot_ban.sql で「ボット候補（まとめて利用停止）」として BAN した人だけ
--     （1 人ずつ BAN した人や、あとで BAN 解除した人は消しません）
--   ・実行する時点で、もう一度「何も投稿・コメント・チャット・リアクションなどをしていないか」を確かめ、
--     活動の記録がある人と管理者は消さない
--   ・途中でエラーが出たときは、何も消えずに元のままになります
-- ※ 削除したアカウントは元に戻せません。

drop table if exists km_del;
create temporary table km_del (user_id uuid primary key);

do $$
declare
  t record;
  q text := '';
  n_target int;
  n_deleted int;
begin
  -- 今の時点で活動している人を集める
  for t in
    select c.table_name, c.column_name
    from information_schema.columns c
    join (values
      ('kimetomo_timeline_posts','author_id'), ('kimetomo_timeline_comments','author_id'),
      ('circle_messages','sender_id'), ('kimetomo_direct_messages','sender_id'),
      ('kimetomo_timeline_reactions','user_id'), ('kimetomo_timeline_likes','user_id'),
      ('kimetomo_chat_reactions','user_id'), ('kimetomo_moods','user_id'),
      ('kimetomo_timeline_poll_votes','user_id'), ('kimetomo_feature_requests','author_id'),
      ('kimetomo_request_votes','user_id'), ('circle_media','uploader_id'), ('circle_media','user_id')
    ) as v(tbl, col) on v.tbl = c.table_name and v.col = c.column_name
    where c.table_schema = 'public'
  loop
    q := q || format(' union all select %I::uuid as uid from public.%I', t.column_name, t.table_name);
  end loop;
  if q = '' then q := ' union all select null::uuid as uid where false'; end if;
  q := substr(q, 12);

  execute format($f$
    insert into km_del (user_id)
    select b.user_id from public.kimetomo_bans b
    where b.reason = 'ボット候補（まとめて利用停止）'
      and not exists (select 1 from public.circle_profiles p where p.user_id = b.user_id and p.is_admin)
      and b.user_id not in (select uid from (%s) a where uid is not null)
  $f$, q);
  select count(*) into n_target from km_del;

  -- その人との個人チャット（相手が送れなかったものなど）を先に消す
  if to_regclass('public.kimetomo_direct_conversations') is not null then
    if to_regclass('public.kimetomo_direct_messages') is not null then
      delete from public.kimetomo_direct_messages where conversation_id in (
        select id from public.kimetomo_direct_conversations
        where user_a in (select user_id from km_del) or user_b in (select user_id from km_del));
    end if;
    delete from public.kimetomo_direct_conversations
    where user_a in (select user_id from km_del) or user_b in (select user_id from km_del);
  end if;

  -- auth.users を参照している表のうち、「一緒に消える」設定になっていないものは先に消す
  for t in
    select n.nspname, c.relname, a.attname
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
    where con.contype = 'f' and con.confrelid = 'auth.users'::regclass
      and array_length(con.conkey, 1) = 1
      and con.confdeltype in ('a', 'r')
      and n.nspname not in ('auth')
  loop
    execute format('delete from %I.%I where %I in (select user_id from km_del)', t.nspname, t.relname, t.attname);
  end loop;

  -- 外部キーのない表に残る、その人あての記録も消す
  for t in
    select c.table_name, c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name in ('user_id', 'recipient_id', 'actor_id', 'blocker_id', 'blocked_id', 'created_by')
      and c.data_type = 'uuid'
      and c.table_name in (select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE')
  loop
    execute format('delete from public.%I where %I in (select user_id from km_del)', t.table_name, t.column_name);
  end loop;

  -- アカウント本体を消す（ログイン情報なども一緒に消える）
  delete from auth.users where id in (select user_id from km_del);
  get diagnostics n_deleted = row_count;
  raise notice '対象 % 人のうち、% 人のアカウントを削除しました', n_target, n_deleted;
end $$;

-- ========== 結果 ==========
select (select count(*) from km_del) as 今回削除した数,
       (select count(*) from public.kimetomo_bans where reason = 'ボット候補（まとめて利用停止）') as 残っているまとめてBANの数,
       (select count(*) from auth.users) as 残っている全アカウント数;

drop table if exists km_del;
