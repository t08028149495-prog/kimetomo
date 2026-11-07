-- キメ友SNS: メンバーから運営への「不具合の報告」
--   ・メンバーはプロフィールタブの「🐞 不具合を報告する」から送る（1人1日5件まで）
--   ・届いたら管理者のベル（とプッシュ通知）でお知らせ
--   ・管理者は管理者メニューの「🐞 不具合の報告」で確認し、「確認中／直した／対応しない」と返事を付けられる
--   ・返事を付けると、報告した人のベルにお知らせが届く
-- 何度実行しても大丈夫です。

create table if not exists public.kimetomo_bug_reports (
  id bigint generated always as identity primary key,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  info text,
  status text not null default 'new' check (status in ('new', 'checking', 'fixed', 'closed')),
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists km_bug_author_idx on public.kimetomo_bug_reports (author_id, created_at desc);
create index if not exists km_bug_created_idx on public.kimetomo_bug_reports (created_at desc);
alter table public.kimetomo_bug_reports enable row level security;
revoke all on public.kimetomo_bug_reports from anon, authenticated;

create or replace function public.kimetomo_bug_status_label(p text)
returns text language sql immutable as $$
  select case p when 'new' then '🆕 受付' when 'checking' then '🔍 確認中'
                when 'fixed' then '✅ 直しました' when 'closed' then '🙏 対応しない' else p end;
$$;

-- ========== メンバー：報告を送る ==========
create or replace function public.kimetomo_report_bug(p_body text, p_info text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  b text := trim(coalesce(p_body, ''));
  new_id bigint;
begin
  if me is null or not exists (select 1 from public.circle_profiles where user_id = me and status = 'approved') then
    raise exception '承認されたメンバーだけが報告できます';
  end if;
  if to_regprocedure('public.kimetomo_is_banned(uuid)') is not null and public.kimetomo_is_banned(me) then
    raise exception '利用停止中のため報告できません';
  end if;
  if b = '' then raise exception 'どんなことが起きたかを書いてください'; end if;
  if char_length(b) > 1000 then raise exception '1000文字までにしてください'; end if;
  perform pg_advisory_xact_lock(hashtext('kimetomo_bug:' || me::text));
  if (select count(*) from public.kimetomo_bug_reports
      where author_id = me and created_at > now() - interval '1 day') >= 5 then
    raise exception '不具合の報告は1日5件までです。明日また送ってください。';
  end if;
  insert into public.kimetomo_bug_reports (author_id, body, info)
  values (me, b, left(p_info, 1000)) returning id into new_id;
  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  select p.user_id, 'admin_notice', me, 'bug', left(b, 80), '🐞 不具合の報告が届きました', './?tab=profile'
  from public.circle_profiles p
  where p.is_admin and p.status = 'approved' and p.user_id <> me;
  return new_id;
end $$;
revoke all on function public.kimetomo_report_bug(text, text) from public, anon;
grant execute on function public.kimetomo_report_bug(text, text) to authenticated;

-- ========== メンバー：自分が送った報告 ==========
create or replace function public.kimetomo_my_bug_reports()
returns table (id bigint, body text, status text, admin_reply text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.body, r.status, r.admin_reply, r.created_at
  from public.kimetomo_bug_reports r
  where r.author_id = auth.uid()
  order by r.created_at desc
  limit 20;
$$;
revoke all on function public.kimetomo_my_bug_reports() from public, anon;
grant execute on function public.kimetomo_my_bug_reports() to authenticated;

-- ========== 管理者：届いた報告 ==========
create or replace function public.kimetomo_admin_bug_reports()
returns table (id bigint, author_name text, body text, info text, status text, admin_reply text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.circle_profiles cp where cp.user_id = auth.uid() and cp.is_admin and cp.status = 'approved') then
    raise exception '管理者だけが使えます';
  end if;
  return query
    select r.id,
           coalesce((select nullif(u.display_name, '') from public.kimetomo_user_profiles u where u.user_id = r.author_id),
                    (select nullif(c.display_name, '') from public.circle_profiles c where c.user_id = r.author_id), 'メンバー'),
           r.body, r.info, r.status, r.admin_reply, r.created_at
    from public.kimetomo_bug_reports r
    order by (r.status in ('new', 'checking')) desc, r.created_at desc
    limit 50;
end $$;
revoke all on function public.kimetomo_admin_bug_reports() from public, anon;
grant execute on function public.kimetomo_admin_bug_reports() to authenticated;

-- ========== 管理者：状態と返事を付ける（報告した人にお知らせ） ==========
create or replace function public.kimetomo_admin_update_bug(p_id bigint, p_status text, p_reply text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.kimetomo_bug_reports;
begin
  if not exists (select 1 from public.circle_profiles where user_id = auth.uid() and is_admin and status = 'approved') then
    raise exception '管理者だけが使えます';
  end if;
  if p_status not in ('new', 'checking', 'fixed', 'closed') then raise exception '状態が正しくありません'; end if;
  update public.kimetomo_bug_reports
     set status = p_status, admin_reply = nullif(trim(coalesce(p_reply, '')), ''), updated_at = now()
   where id = p_id
  returning * into r;
  if not found then raise exception '報告が見つかりません'; end if;
  if r.author_id <> auth.uid() then
    insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
    values (r.author_id, 'admin_notice', auth.uid(), 'bugreply',
            left(coalesce(r.admin_reply, r.body), 80),
            case p_status when 'fixed' then '✅ 報告した不具合を直しました'
                          when 'checking' then '🔍 報告した不具合を確認しています'
                          when 'closed' then '🙏 報告した不具合について返事があります'
                          else '🐞 報告した不具合について返事があります' end,
            './?tab=profile');
  end if;
end $$;
revoke all on function public.kimetomo_admin_update_bug(bigint, text, text) from public, anon;
grant execute on function public.kimetomo_admin_update_bug(bigint, text, text) to authenticated;

select 'OK：不具合の報告を受け付けられるようにしました' as 結果;
