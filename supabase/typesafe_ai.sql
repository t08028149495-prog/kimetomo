-- キメ友SNS: 🤖 TypeSafe（Jev）で文章を見分ける（Edge Function kimetomo-typesafe とセット）
--   ① 投稿・コメント・グループチャット：保存したあとで調べ、違法な売り買い・闇バイト・お金と引きかえの関係・
--      脅し・悪口・個人情報のさらしの疑いが強いものだけ、管理者の「気になる投稿」とベルに出す（投稿は止めない・待たせない）
--   ② 個人チャット（DM）：受け取った人の画面でだけ注意を出す。管理者には知らせず、データベースにも記録しない（dm.html → js/dm-safety.js）
--   ③ 不具合の報告：「不具合／要望／質問／その他」と「急ぎ」を付けて、管理者の一覧で急ぎを上に出す
--   ・1つの投稿・報告を調べるのは1回だけ（kimetomo_ai_checks で覚える）
--   ・TypeSafe に送るのは本文と、判断に必要な前後の文章だけ。名前は送らない
-- Supabase の Secrets に TYPESAFE_API_KEY を登録しておくこと。鍵がないあいだは何もしない。
-- ng_warn.sql・bug_reports.sql の後に実行。何度実行しても大丈夫です。

-- 調べ終わった印（同じものを2回調べない）
create table if not exists public.kimetomo_ai_checks (
  table_name text not null,
  row_id text not null,
  checked_at timestamptz not null default now(),
  primary key (table_name, row_id)
);
alter table public.kimetomo_ai_checks enable row level security;
revoke all on public.kimetomo_ai_checks from anon, authenticated;

-- 古い印は30日で消す（毎日）
do $$ begin
  perform cron.unschedule('kimetomo-ai-checks-cleanup');
exception when others then null; end $$;
select cron.schedule('kimetomo-ai-checks-cleanup', '17 4 * * *',
  $$delete from public.kimetomo_ai_checks where checked_at < now() - interval '30 days'$$);

-- ========== ① 保存されたら Edge Function を呼ぶ（ID だけを渡す。中身は Edge Function が読み直す） ==========
create or replace function public.kimetomo_ai_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if char_length(coalesce(new.body, '')) >= 6 then
    perform net.http_post(
      url := 'https://hazcwbczsswjptvblpwt.supabase.co/functions/v1/kimetomo-typesafe',
      body := jsonb_build_object('mode', 'post', 'table', tg_table_name, 'id', new.id::text),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 5000);
  end if;
  return new;
end $$;
revoke all on function public.kimetomo_ai_on_insert() from public, anon, authenticated;

drop trigger if exists kimetomo_ai_check on public.kimetomo_timeline_posts;
create trigger kimetomo_ai_check after insert on public.kimetomo_timeline_posts
  for each row execute function public.kimetomo_ai_on_insert();
drop trigger if exists kimetomo_ai_check on public.kimetomo_timeline_comments;
create trigger kimetomo_ai_check after insert on public.kimetomo_timeline_comments
  for each row execute function public.kimetomo_ai_on_insert();
drop trigger if exists kimetomo_ai_check on public.circle_messages;
create trigger kimetomo_ai_check after insert on public.circle_messages
  for each row execute function public.kimetomo_ai_on_insert();
drop trigger if exists kimetomo_ai_check on public.kimetomo_bug_reports;
create trigger kimetomo_ai_check after insert on public.kimetomo_bug_reports
  for each row execute function public.kimetomo_ai_on_insert();

-- Edge Function 用：気になる投稿として記録し、管理者に知らせる（同じ人について 1 時間に 1 回まで。ng_warn.sql と同じ決まり）
create or replace function public.kimetomo_ai_flag(p_table text, p_row text, p_author uuid, p_word text, p_excerpt text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.kimetomo_flagged (table_name, row_id, author_id, word, excerpt)
  values (p_table, p_row, p_author, left(p_word, 40), left(p_excerpt, 120));
  if not exists (select 1 from public.kimetomo_flagged f
                 where f.author_id is not distinct from p_author and f.created_at > now() - interval '1 hour'
                   and f.id <> (select max(id) from public.kimetomo_flagged)) then
    insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
    select p.user_id, 'admin_notice', p_author, 'flag', left(p_excerpt, 80),
           '🤖 ' || p_word || ' の疑いがある投稿がありました', p_link
    from public.circle_profiles p
    where p.is_admin and p.status = 'approved' and p.user_id is distinct from p_author;
  end if;
end $$;
revoke all on function public.kimetomo_ai_flag(text, text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.kimetomo_ai_flag(text, text, uuid, text, text, text) to service_role;

-- ========== ③ 不具合の報告の仕分け ==========
alter table public.kimetomo_bug_reports add column if not exists ai_kind text check (ai_kind in ('bug', 'request', 'question', 'other'));
alter table public.kimetomo_bug_reports add column if not exists ai_urgent boolean;
alter table public.kimetomo_bug_reports add column if not exists ai_safety boolean;

drop function if exists public.kimetomo_admin_bug_reports();
create function public.kimetomo_admin_bug_reports()
returns table (id bigint, author_name text, body text, info text, status text, admin_reply text, created_at timestamptz,
               ai_kind text, ai_urgent boolean, ai_safety boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.circle_profiles cp where cp.user_id = auth.uid() and cp.is_admin and cp.status = 'approved') then
    raise exception '管理者だけが使えます';
  end if;
  return query
    select r.id,
           coalesce((select nullif(u.display_name, '') from public.kimetomo_user_profiles u where u.user_id = r.author_id),
                    (select nullif(c.display_name, '') from public.circle_profiles c where c.user_id = r.author_id), 'メンバー'),
           r.body, r.info, r.status, r.admin_reply, r.created_at, r.ai_kind, r.ai_urgent, r.ai_safety
    from public.kimetomo_bug_reports r
    order by (r.status in ('new', 'checking')) desc,
             case when r.status in ('new', 'checking') then (coalesce(r.ai_safety, false) or coalesce(r.ai_urgent, false)) end desc,
             r.created_at desc
    limit 50;
end $$;
revoke all on function public.kimetomo_admin_bug_reports() from public, anon;
grant execute on function public.kimetomo_admin_bug_reports() to authenticated;

notify pgrst, 'reload schema';

select 'OK：🤖 TypeSafe の見分けを入れました（Secrets に TYPESAFE_API_KEY が必要です）' as 結果;
