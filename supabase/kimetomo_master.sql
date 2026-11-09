-- 🏅 キメ友マスター（2026-11-09）
-- 毎週日曜 10:00（日本時間）に、前の1週間（日曜10:00〜日曜10:00）の活動を点数にして、
-- 基準を超えた人に「キメ友マスター」の称号を1週間つける（管理者の王冠の位置に、紫の印で出す）。
--   点数：投稿 3点（1日5件まで・匿名は数えない）／ほかの人の投稿へのコメント・返信 2点（1日10件まで）
--         ／リアクション・グループチャット 1点。DM は数えない。
--   条件：合計 score 点以上・活動した日 days 日以上・ほかの人へのコメント comments 件以上
--   数字は kimetomo_app_settings の master_rules（管理者メニュー「運営」で変えられる）。
--   管理者・BAN された人・承認されていない人は対象外。

create table if not exists public.kimetomo_masters (
  user_id uuid primary key,
  score int not null,
  week_start timestamptz not null,
  until timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.kimetomo_masters enable row level security;
-- 中身は下の関数からだけ読む（点数は見せない）
revoke all on public.kimetomo_masters from anon, authenticated;

insert into public.kimetomo_app_settings (key, value, updated_at)
values ('master_rules', '{"score":30,"days":2,"comments":3}', now())
on conflict (key) do nothing;

-- 集計して称号をつけ直す（cron から呼ぶ。直前の「日曜10:00」までの1週間を数える）
create or replace function public.kimetomo_award_masters()
returns int language plpgsql security definer set search_path = public as $$
declare
  loc timestamp := (now() at time zone 'Asia/Tokyo') - interval '10 hours';
  w_end timestamptz := ((date_trunc('day', loc) - (extract(dow from loc)::int * interval '1 day')) + interval '10 hours') at time zone 'Asia/Tokyo';
  w_start timestamptz := w_end - interval '7 days';
  r jsonb;
  v_count int;
begin
  begin r := public.kimetomo_setting('master_rules', '{}')::jsonb; exception when others then r := '{}'; end;
  delete from public.kimetomo_masters where true;
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
  )
  insert into public.kimetomo_masters (user_id, score, week_start, until)
  select u.uid, (u.posts * 3 + u.com * 2 + u.rc)::int, w_start, w_end + interval '7 days'
  from u
  join public.circle_profiles cp on cp.user_id = u.uid and cp.status = 'approved' and not coalesce(cp.is_admin, false)
  where not exists (select 1 from public.kimetomo_bans b where b.user_id = u.uid)
    and u.posts * 3 + u.com * 2 + u.rc >= coalesce((r->>'score')::int, 30)
    and u.days >= coalesce((r->>'days')::int, 2)
    and u.com >= coalesce((r->>'comments')::int, 3);
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.kimetomo_award_masters() from public, anon, authenticated;

-- 今キメ友マスターの人（ログインして承認された人だけが見られる。王冠と同じ）
create or replace function public.kimetomo_master_badges()
returns table(user_id uuid) language sql stable security definer set search_path = '' as $$
  select m.user_id from public.kimetomo_masters m
  where m.until > now()
    and exists (select 1 from public.circle_profiles v where v.user_id = auth.uid() and v.status = 'approved');
$$;
revoke all on function public.kimetomo_master_badges() from public, anon;
grant execute on function public.kimetomo_master_badges() to authenticated;

-- 管理者メニュー用：今のマスターの名前と点数
create or replace function public.kimetomo_admin_masters()
returns table(user_id uuid, display_name text, score int, until timestamptz) language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.circle_profiles a where a.user_id = auth.uid() and a.is_admin and a.status = 'approved') then
    raise exception '管理者だけが使えます';
  end if;
  return query select m.user_id, coalesce(p.display_name, cp.display_name, 'メンバー'), m.score, m.until
    from public.kimetomo_masters m
    left join public.kimetomo_user_profiles p on p.user_id = m.user_id
    left join public.circle_profiles cp on cp.user_id = m.user_id
    where m.until > now() order by m.score desc;
end $$;
revoke all on function public.kimetomo_admin_masters() from public, anon;
grant execute on function public.kimetomo_admin_masters() to authenticated;

-- 設定の保存に master_rules を追加（数字だけ・範囲を確認）
create or replace function public.kimetomo_admin_set_setting(p_key text, p_value text)
returns void language plpgsql security definer set search_path = public as $$
declare j jsonb;
begin
  if not exists (select 1 from public.circle_profiles where user_id = auth.uid() and is_admin and status = 'approved') then
    raise exception '管理者だけが使えます';
  end if;
  if p_key not in ('requests_open', 'support_paypay_url', 'pinned_notice', 'master_rules') then raise exception 'この設定は変更できません'; end if;
  -- PayPay のリンク以外は保存しない
  if p_key = 'support_paypay_url' and coalesce(p_value, '') <> ''
     and p_value !~ '^https://([a-z0-9-]+\.)*paypay\.ne\.jp/' then
    raise exception 'PayPayのリンク（https://…paypay.ne.jp/…）を入れてください';
  end if;
  if p_key = 'pinned_notice' and char_length(coalesce(p_value, '')) > 300 then
    raise exception 'お知らせは300文字までにしてください';
  end if;
  if p_key = 'master_rules' then
    begin j := p_value::jsonb; exception when others then raise exception '数字を入れてください'; end;
    if (j->>'score') !~ '^\d{1,4}$' or (j->>'days') !~ '^[1-7]$' or (j->>'comments') !~ '^\d{1,3}$' then
      raise exception '点数は0〜9999、日数は1〜7、コメントは0〜999で入れてください';
    end if;
    p_value := jsonb_build_object('score', (j->>'score')::int, 'days', (j->>'days')::int, 'comments', (j->>'comments')::int)::text;
  end if;
  insert into public.kimetomo_app_settings (key, value, updated_at) values (p_key, coalesce(p_value, ''), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;
revoke all on function public.kimetomo_admin_set_setting(text, text) from public, anon;
grant execute on function public.kimetomo_admin_set_setting(text, text) to authenticated;

-- 毎週日曜 10:01（日本時間）= 日曜 01:01（UTC）
select cron.unschedule('kimetomo-master') where exists (select 1 from cron.job where jobname = 'kimetomo-master');
select cron.schedule('kimetomo-master', '1 1 * * 0', 'select public.kimetomo_award_masters()');

-- 初回：先週（11/1〜11/8）の分で今すぐつける（11/15 10:00 まで）
select public.kimetomo_award_masters() as 今回のマスターの人数;
