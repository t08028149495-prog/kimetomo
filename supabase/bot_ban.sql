-- キメ友SNS: ボット候補をまとめて利用停止（BAN）にする
--   ・先に bot_check.sql を実行して、候補の一覧（kimetomo_bot_candidates）を作っておくこと
--   ・実行する時点で、もう一度「何も投稿・コメント・チャット・リアクションなどをしていないか」を確かめ、
--     そのあいだに使い始めた人と管理者は BAN しない
--   ・BAN はあとから戻せる（1 人ずつ：管理者メニューの「🚫 メンバー管理（BAN）」→「BAN解除」）
-- 何度実行しても大丈夫です。
--
-- 【この BAN をまとめて全部取り消すとき】下の 1 行を実行する
--   delete from public.kimetomo_bans where reason = 'ボット候補（まとめて利用停止）';

do $$
declare
  t record;
  q text := '';
  admin_id uuid;
  n int;
begin
  if to_regclass('public.kimetomo_bot_candidates') is null then
    raise exception '先に bot_check.sql を実行してください';
  end if;
  select user_id into admin_id from public.circle_profiles
  where is_admin and status = 'approved' order by user_id limit 1;

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
    insert into public.kimetomo_bans (user_id, banned_by, reason)
    select b.user_id, $1, 'ボット候補（まとめて利用停止）'
    from public.kimetomo_bot_candidates b
    where exists (select 1 from auth.users u where u.id = b.user_id)
      and not exists (select 1 from public.circle_profiles p where p.user_id = b.user_id and p.is_admin)
      and b.user_id not in (select uid from (%s) a where uid is not null)
    on conflict (user_id) do nothing
  $f$, q) using admin_id;
  get diagnostics n = row_count;
  raise notice '% 人を利用停止にしました', n;
end $$;

-- ========== 結果 ==========
select (select count(*) from public.kimetomo_bot_candidates) as ボット候補の数,
       (select count(*) from public.kimetomo_bans where reason = 'ボット候補（まとめて利用停止）') as 今回利用停止にした数,
       (select count(*) from public.kimetomo_bot_candidates b
         where not exists (select 1 from public.kimetomo_bans x where x.user_id = b.user_id)) as 使い始めていたので外した数;
