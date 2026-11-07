-- キメ友SNS: ボットと思われるアカウントを探す（このファイルでは何も削除しません）
--   次の条件で「ボット候補」を選び、一覧を表示します。
--   ・管理者ではない
--   ・投稿・コメント・チャット・個人チャット・リアクション・気分・アンケート・機能リクエストを 1 回もしていない
--   ・そのうえで、次のどれかに当てはまる
--       A. 前後 10 分以内に、ほかにも 2 人以上が新規登録している（まとめて作られた）
--       B. 登録してから 1 日以上たつのに、登録した日のあと一度も使っていない
--       C. ユーザー名が機械的（英字のあとに数字がたくさん、10 文字以上の英数字だけ など）
--   選んだ候補は kimetomo_bot_candidates という表に保存します（削除は次の手順で、確認してから行います）。
-- 何度実行しても大丈夫です（実行するたびに候補を選び直します）。

drop table if exists public.kimetomo_bot_candidates;
create table public.kimetomo_bot_candidates (
  user_id uuid primary key,
  login_id text,
  display_name text,
  registered_at timestamptz,
  last_sign_in_at timestamptz,
  burst int,
  reasons text
);
alter table public.kimetomo_bot_candidates enable row level security;
revoke all on public.kimetomo_bot_candidates from anon, authenticated;

do $$
declare
  t record;
  q text := '';
begin
  -- 活動の記録がある表・列だけを集める（ない表はとばす）
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
    with active as (select distinct uid from (%s) a where uid is not null),
    u as (
      select au.id, au.created_at,
             greatest(au.last_sign_in_at, (select max(se.updated_at) from auth.sessions se where se.user_id = au.id)) as last_sign_in_at,
             coalesce(au.raw_user_meta_data ->> 'username', au.raw_user_meta_data ->> 'display_name', '') as login_id,
             p.display_name, coalesce(p.is_admin, false) as is_admin
      from auth.users au
      left join public.circle_profiles p on p.user_id = au.id
    ),
    s as (
      select u.*,
             (select count(*) - 1 from u u2 where u2.created_at between u.created_at - interval '10 minutes'
                                                               and u.created_at + interval '10 minutes')::int as burst
      from u
      where not u.is_admin and u.id not in (select uid from active)
    )
    insert into public.kimetomo_bot_candidates
    select id, login_id, display_name, created_at, last_sign_in_at, burst,
           concat_ws('・',
             case when burst >= 2 then 'A:まとめて登録（前後10分に' || burst || '人）' end,
             case when created_at < now() - interval '1 day'
                   and (last_sign_in_at is null or last_sign_in_at < created_at + interval '1 day') then 'B:登録した日のあと使っていない' end,
             case when login_id ~* '^[a-z]+[0-9]{3,}$' or login_id ~* '^[a-z0-9]{10,}$' or login_id ~* '^[a-z]{1,3}[0-9]{4,}' then 'C:機械的な名前' end)
    from s
    where burst >= 2
       or (created_at < now() - interval '1 day' and (last_sign_in_at is null or last_sign_in_at < created_at + interval '1 day'))
       or login_id ~* '^[a-z]+[0-9]{3,}$' or login_id ~* '^[a-z0-9]{10,}$' or login_id ~* '^[a-z]{1,3}[0-9]{4,}'
  $f$, q);
end $$;

-- ========== 結果 ==========
-- 1. 数のまとめ
select (select count(*) from auth.users) as 全アカウント数,
       (select count(*) from public.kimetomo_bot_candidates) as ボット候補の数;

-- 2. ボット候補の一覧（新しい順）
select row_number() over (order by registered_at desc) as 番号,
       login_id as ユーザー名,
       display_name as 表示名,
       to_char(registered_at at time zone 'Asia/Tokyo', 'MM/DD HH24:MI') as 登録日時,
       coalesce(to_char(last_sign_in_at at time zone 'Asia/Tokyo', 'MM/DD HH24:MI'), 'なし') as 最後に使った日時,
       reasons as 理由
from public.kimetomo_bot_candidates
order by registered_at desc;
