-- 🏅 キメ友マスター：ランダム人数版（2026-11-09。kimetomo_master.sql の選び方を置きかえる）
-- 毎週日曜 6:00（日本時間）に、前の1週間（日曜6:00〜日曜6:00）の活動を点数にして、
-- 1〜4人のうちランダムな人数 N を決め、点数の高い順に N 人を選ぶ（＝N番目の人の点数が、その週の基準になる）。
-- 選ばれた人には、その日の 10:00 から次の日曜 10:00 まで称号が出る（6時〜10時は前の週の人がそのまま）。
--   点数の数え方は前と同じ：投稿 3点（1日5件まで・匿名は数えない）／ほかの人の投稿へのコメント・返信 2点（1日10件まで）
--   ／リアクション・グループチャット 1点。DM は数えない。
--   管理者・BAN された人・承認されていない人・0点の人・ボット（恋愛マスターひろし）は対象外。同じ点数なら、活動した日が多い人→くじ引き。

-- 表示を始める時刻を覚える欄（前の週の人と次の週の人が、6時〜10時に一緒に入っているため）
alter table public.kimetomo_masters add column if not exists starts_at timestamptz;
update public.kimetomo_masters set starts_at = week_start + interval '7 days' where starts_at is null;
alter table public.kimetomo_masters alter column starts_at set not null;
-- 同じ人が2週続けて選ばれても入るように、「人＋始まる時刻」で1行にする
alter table public.kimetomo_masters drop constraint if exists kimetomo_masters_pkey;
alter table public.kimetomo_masters add primary key (user_id, starts_at);

create or replace function public.kimetomo_award_masters()
returns int language plpgsql security definer set search_path = public as $$
declare
  loc timestamp := (now() at time zone 'Asia/Tokyo') - interval '6 hours';
  sun date := (date_trunc('day', loc) - (extract(dow from loc)::int * interval '1 day'))::date;  -- 直前の日曜
  w_end timestamptz := (sun + time '06:00') at time zone 'Asia/Tokyo';
  w_start timestamptz := w_end - interval '7 days';
  v_start timestamptz := (sun + time '10:00') at time zone 'Asia/Tokyo';
  v_n int := 1 + floor(random() * 4)::int;   -- 今週の人数（1〜4人）
  v_count int;
begin
  -- 同じ週をやり直したときはその週の分を入れ直す。終わって1日たった古い分も片づける
  delete from public.kimetomo_masters where starts_at = v_start or until < now() - interval '1 day';
  with ev as (
    select author_id uid, created_at t, 'post' k from public.kimetomo_timeline_posts
      where not coalesce(anonymous, false) and created_at >= w_start and created_at < w_end
    union all
    select c.author_id, c.created_at, 'com' from public.kimetomo_timeline_comments c
      join public.kimetomo_timeline_posts p on p.id = c.post_id
      where p.author_id is distinct from c.author_id and c.created_at >= w_start and c.created_at < w_end
    union all
    select user_id, created_at, 'rc' from public.kimetomo_timeline_reactions where created_at >= w_start and created_at < w_end
    union all
    select sender_id, created_at, 'rc' from public.circle_messages where created_at >= w_start and created_at < w_end
  ), d as (
    select uid, (t at time zone 'Asia/Tokyo')::date dd, k, count(*) n from ev where uid is not null group by 1, 2, 3
  ), u as (
    select uid, count(distinct dd) days,
      coalesce(sum(least(n, 5)) filter (where k = 'post'), 0) posts,
      coalesce(sum(least(n, 10)) filter (where k = 'com'), 0) com,
      coalesce(sum(n) filter (where k = 'rc'), 0) rc
    from d group by uid
  ), s as (
    select u.uid, (u.posts * 3 + u.com * 2 + u.rc)::int sc, u.days
    from u
    join public.circle_profiles cp on cp.user_id = u.uid and cp.status = 'approved' and not coalesce(cp.is_admin, false)
    where not exists (select 1 from public.kimetomo_bans b where b.user_id = u.uid)
      and u.uid is distinct from public.kimetomo_mascot_id()   -- ボット（恋愛マスターひろし）は数えない
  )
  insert into public.kimetomo_masters (user_id, score, week_start, until, starts_at)
  select s.uid, s.sc, w_start, v_start + interval '7 days', v_start
  from s where s.sc > 0
  order by s.sc desc, s.days desc, random()
  limit v_n;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.kimetomo_award_masters() from public, anon, authenticated;

-- 今キメ友マスターの人（10時の発表より前は、前の週の人のまま）
create or replace function public.kimetomo_master_badges()
returns table(user_id uuid) language sql stable security definer set search_path = '' as $$
  select distinct m.user_id from public.kimetomo_masters m
  where m.starts_at <= now() and m.until > now()
    and exists (select 1 from public.circle_profiles v where v.user_id = auth.uid() and v.status = 'approved');
$$;
revoke all on function public.kimetomo_master_badges() from public, anon;
grant execute on function public.kimetomo_master_badges() to authenticated;

-- 管理者メニュー用：今のマスターと、10時に発表される次のマスター（名前・点数・期間）
drop function if exists public.kimetomo_admin_masters();
create function public.kimetomo_admin_masters()
returns table(user_id uuid, display_name text, score int, starts_at timestamptz, until timestamptz) language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.circle_profiles a where a.user_id = auth.uid() and a.is_admin and a.status = 'approved') then
    raise exception '管理者だけが使えます';
  end if;
  return query select m.user_id, coalesce(p.display_name, cp.display_name, 'メンバー'), m.score, m.starts_at, m.until
    from public.kimetomo_masters m
    left join public.kimetomo_user_profiles p on p.user_id = m.user_id
    left join public.circle_profiles cp on cp.user_id = m.user_id
    where m.until > now() order by m.starts_at, m.score desc;
end $$;
revoke all on function public.kimetomo_admin_masters() from public, anon;
grant execute on function public.kimetomo_admin_masters() to authenticated;

-- 毎週日曜 6:00（日本時間）= 土曜 21:00（UTC）に集計。発表（印が出る）は 10:00
select cron.unschedule('kimetomo-master') where exists (select 1 from cron.job where jobname = 'kimetomo-master');
select cron.schedule('kimetomo-master', '0 21 * * 6', 'select public.kimetomo_award_masters()');
