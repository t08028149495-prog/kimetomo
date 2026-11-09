-- キメ友SNS: 🤖 通報の一次仕分け（Edge Function kimetomo-report-ai とセット）
--   ・届いた通報（未対応のもの）を AI（Claude Haiku 5.5）が読み、4つに仕分けて短い理由を付ける
--       urgent    … 🚨 急ぎ（未成年・違法・薬物・脅し・個人情報のさらしなど）
--       violation … ⚠️ 違反の疑い（悪口・頼んでいない性的な内容・しつこい誘い・宣伝など）
--       unclear   … 🤔 判断が必要（これだけでは分からない）
--       ok        … 🙆 問題なさそう
--   ・最後に決めるのは管理者。AI は「対応した／問題なし」を勝手に押さない。通報した人・された人には何も知らせない
--   ・AI に送るのは、通報の種類・理由・くわしい内容・通報した時点の写し（今までも管理者が見ていたもの）だけ。名前は送らない
--   ・1件につき AI を呼ぶのは基本1回（うまくいかなかったときだけ3回まで）。通報が届いたときと、管理者が一覧を開いたときに仕分ける
--   ・管理者の一覧では、未対応の中で「急ぎ」が上に来る
-- reports.sql・report_quiet.sql の後に実行。何度実行しても大丈夫です。

alter table public.kimetomo_reports add column if not exists ai_label text check (ai_label in ('urgent', 'violation', 'unclear', 'ok'));
alter table public.kimetomo_reports add column if not exists ai_reason text check (ai_reason is null or char_length(ai_reason) <= 120);
alter table public.kimetomo_reports add column if not exists ai_at timestamptz;
alter table public.kimetomo_reports add column if not exists ai_tries int not null default 0;

-- Edge Function 用：まだ仕分けていない未対応の通報を、少しずつ取り出す（同じものを2人で同時に仕分けない）
create or replace function public.kimetomo_report_ai_claim(p_limit int default 5)
returns table (id bigint, kind text, reason text, note text, snapshot text)
language plpgsql security definer set search_path to 'public'
as $$
begin
  return query
    with picked as (
      update public.kimetomo_reports r set ai_tries = r.ai_tries + 1, ai_at = now()
       where r.id in (
         select x.id from public.kimetomo_reports x
          where x.status = 'new' and x.ai_label is null and x.ai_tries < 3
            and (x.ai_at is null or x.ai_at < now() - interval '2 minutes')
          order by x.created_at
          limit greatest(1, least(p_limit, 10))
          for update skip locked)
      returning r.id as rid, r.kind as rkind, r.reason as rreason, r.note as rnote, r.snapshot as rsnap)
    select p.rid, p.rkind, p.rreason, p.rnote, p.rsnap from picked p;
end $$;

-- Edge Function 用：仕分けの結果を保存する
create or replace function public.kimetomo_report_ai_save(p_id bigint, p_label text, p_reason text)
returns void language plpgsql security definer set search_path to 'public'
as $$
begin
  if p_label not in ('urgent', 'violation', 'unclear', 'ok') then raise exception 'bad label'; end if;
  update public.kimetomo_reports set ai_label = p_label, ai_reason = left(nullif(trim(coalesce(p_reason, '')), ''), 120), ai_at = now()
   where id = p_id;
end $$;

revoke all on function public.kimetomo_report_ai_claim(int) from public, anon, authenticated;
revoke all on function public.kimetomo_report_ai_save(bigint, text, text) from public, anon, authenticated;
grant execute on function public.kimetomo_report_ai_claim(int) to service_role;
grant execute on function public.kimetomo_report_ai_save(bigint, text, text) to service_role;

-- ========== 管理者：届いた通報（AIの仕分けを足す。未対応の中では急ぎを上に） ==========
drop function if exists public.kimetomo_admin_reports();
create function public.kimetomo_admin_reports()
returns table (id bigint, kind text, target_id uuid, post_id uuid, target_user uuid, reporter_name text, target_name text,
               reason text, note text, snapshot text, status text, created_at timestamptz, target_total bigint,
               reporter_dismissed bigint, quiet boolean, ai_label text, ai_reason text, ai_pending boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.circle_profiles cp where cp.user_id = auth.uid() and cp.is_admin and cp.status = 'approved') then
    raise exception '管理者だけが使えます';
  end if;
  return query
    select r.id, r.kind, r.target_id, r.post_id, r.target_user,
           coalesce((select nullif(u.display_name, '') from public.kimetomo_user_profiles u where u.user_id = r.reporter_id),
                    (select nullif(c.display_name, '') from public.circle_profiles c where c.user_id = r.reporter_id), 'メンバー'),
           coalesce((select nullif(u.display_name, '') from public.kimetomo_user_profiles u where u.user_id = r.target_user),
                    (select nullif(c.display_name, '') from public.circle_profiles c where c.user_id = r.target_user), 'メンバー'),
           r.reason, r.note, r.snapshot, r.status, r.created_at,
           (select count(*) from public.kimetomo_reports x where x.target_user = r.target_user),
           (select count(*) from public.kimetomo_reports x where x.reporter_id = r.reporter_id and x.status = 'dismissed'),
           r.quiet, r.ai_label, r.ai_reason,
           (r.status = 'new' and r.ai_label is null and r.ai_tries < 3)
    from public.kimetomo_reports r
    order by (r.status = 'new') desc,
             case when r.status = 'new' then case r.ai_label when 'urgent' then 0 when 'violation' then 1 when 'unclear' then 2 when 'ok' then 3 else 1 end end,
             r.created_at desc
    limit 60;
end $$;
revoke all on function public.kimetomo_admin_reports() from public, anon;
grant execute on function public.kimetomo_admin_reports() to authenticated;

select 'OK：🤖 通報の一次仕分けを入れました' as 結果;
