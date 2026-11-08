-- キメ友SNS: メンバーから運営への「🚩 通報」（2026-11-09）
--   ・投稿・コメント・DM のメッセージ・グループチャットのメッセージ・メンバー（プロフィール）を通報できる
--   ・通報した時点の内容を写しとして残す（あとで消されても、管理者が確認できる）
--   ・相手には知らされない。1人1日10件まで。同じものを2回は通報できない。自分は通報できない
--   ・届いたら管理者のベル（とプッシュ通知）でお知らせ。管理者は管理者メニュー「🚩 通報」で確認する
--   ・管理者が「対応した／問題なし」にすると、通報した人のベルに「確認しました」と届く（どう対応したかは書かない）
--   ・DM は、通報されたメッセージ1通だけを写す（ほかのやりとりは管理者に見えない）
-- 何度実行しても大丈夫です。

create table if not exists public.kimetomo_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('post', 'comment', 'dm', 'chat', 'user')),
  target_id uuid not null,
  target_user uuid references auth.users(id) on delete set null,
  post_id uuid,
  reason text not null check (reason in ('sexual', 'harass', 'abuse', 'minor', 'illegal', 'spam', 'other')),
  note text check (note is null or char_length(note) <= 300),
  snapshot text,
  status text not null default 'new' check (status in ('new', 'done', 'dismissed')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  unique (reporter_id, kind, target_id)
);
create index if not exists km_reports_created_idx on public.kimetomo_reports (created_at desc);
create index if not exists km_reports_target_user_idx on public.kimetomo_reports (target_user);
alter table public.kimetomo_reports enable row level security;
revoke all on public.kimetomo_reports from anon, authenticated;

create or replace function public.kimetomo_report_reason_label(p text)
returns text language sql immutable as $$
  select case p when 'sexual' then '頼んでいない性的なメッセージ・画像'
                when 'harass' then 'しつこい誘い・つきまとい'
                when 'abuse' then '悪口・いやがらせ'
                when 'minor' then '未成年かもしれない'
                when 'illegal' then '違法なこと'
                when 'spam' then '宣伝・スパム・なりすまし'
                else 'その他' end;
$$;

-- ========== メンバー：通報する ==========
create or replace function public.kimetomo_report(p_kind text, p_target uuid, p_reason text, p_note text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  who uuid;
  snap text;
  pid uuid;
  n text := nullif(trim(coalesce(p_note, '')), '');
  new_id bigint;
begin
  if me is null or not exists (select 1 from public.circle_profiles where user_id = me and status = 'approved') then
    raise exception '承認されたメンバーだけが通報できます';
  end if;
  if to_regprocedure('public.kimetomo_is_banned(uuid)') is not null and public.kimetomo_is_banned(me) then
    raise exception '利用停止中のため通報できません';
  end if;
  if p_reason not in ('sexual', 'harass', 'abuse', 'minor', 'illegal', 'spam', 'other') then
    raise exception '理由を選んでください';
  end if;
  if char_length(coalesce(n, '')) > 300 then raise exception 'くわしい内容は300文字までにしてください'; end if;

  if p_kind = 'post' then
    select author_id, left(body, 1000), id into who, snap, pid from public.kimetomo_timeline_posts where id = p_target;
  elsif p_kind = 'comment' then
    select author_id, left(body, 1000), post_id into who, snap, pid from public.kimetomo_timeline_comments where id = p_target;
  elsif p_kind = 'dm' then
    -- 自分が入っている会話の、相手が送ったメッセージだけ
    select m.sender_id, left(m.body, 1000) into who, snap
      from public.kimetomo_direct_messages m
      join public.kimetomo_direct_conversations c on c.id = m.conversation_id
     where m.id = p_target and me in (c.user_a, c.user_b);
  elsif p_kind = 'chat' then
    select sender_id, left(body, 1000) into who, snap from public.circle_messages where id = p_target;
  elsif p_kind = 'user' then
    select p.user_id,
           '名前：' || coalesce(nullif(u.display_name, ''), nullif(p.display_name, ''), 'メンバー')
           || coalesce(E'\n自己紹介：' || nullif(u.bio, ''), '')
      into who, snap
      from public.circle_profiles p
      left join public.kimetomo_user_profiles u on u.user_id = p.user_id
     where p.user_id = p_target;
  else
    raise exception '通報できない種類です';
  end if;
  if who is null then raise exception '通報するものが見つかりません（消されたかもしれません）'; end if;
  if who = me then raise exception '自分のものは通報できません'; end if;

  perform pg_advisory_xact_lock(hashtext('kimetomo_report:' || me::text));
  if exists (select 1 from public.kimetomo_reports where reporter_id = me and kind = p_kind and target_id = p_target) then
    raise exception 'これはもう通報しています。運営が確認するまでお待ちください';
  end if;
  if (select count(*) from public.kimetomo_reports
      where reporter_id = me and created_at > now() - interval '1 day') >= 10 then
    raise exception '通報は1日10件までです。急ぎのときは、ブロックも使ってください';
  end if;

  insert into public.kimetomo_reports (reporter_id, kind, target_id, target_user, post_id, reason, note, snapshot)
  values (me, p_kind, p_target, who, pid, p_reason, n, snap)
  returning id into new_id;

  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  select p.user_id, 'admin_notice', me, 'report', public.kimetomo_report_reason_label(p_reason),
         '🚩 通報が届きました', './?tab=profile'
  from public.circle_profiles p
  where p.is_admin and p.status = 'approved' and p.user_id <> me;
  return new_id;
end $$;
revoke all on function public.kimetomo_report(text, uuid, text, text) from public, anon;
grant execute on function public.kimetomo_report(text, uuid, text, text) to authenticated;

-- ========== 管理者：届いた通報 ==========
create or replace function public.kimetomo_admin_reports()
returns table (id bigint, kind text, target_id uuid, post_id uuid, target_user uuid, reporter_name text, target_name text,
               reason text, note text, snapshot text, status text, created_at timestamptz, target_total bigint)
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
           (select count(*) from public.kimetomo_reports x where x.target_user = r.target_user)
    from public.kimetomo_reports r
    order by (r.status = 'new') desc, r.created_at desc
    limit 60;
end $$;
revoke all on function public.kimetomo_admin_reports() from public, anon;
grant execute on function public.kimetomo_admin_reports() to authenticated;

-- ========== 管理者：対応した／問題なし（通報した人に「確認しました」） ==========
create or replace function public.kimetomo_admin_handle_report(p_id bigint, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.kimetomo_reports;
  was text;
begin
  if not exists (select 1 from public.circle_profiles where user_id = auth.uid() and is_admin and status = 'approved') then
    raise exception '管理者だけが使えます';
  end if;
  if p_status not in ('new', 'done', 'dismissed') then raise exception '状態が正しくありません'; end if;
  select status into was from public.kimetomo_reports where id = p_id;
  update public.kimetomo_reports
     set status = p_status, handled_at = case when p_status = 'new' then null else now() end
   where id = p_id
  returning * into r;
  if not found then raise exception '通報が見つかりません'; end if;
  if was = 'new' and p_status <> 'new' and r.reporter_id <> auth.uid() then
    insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
    values (r.reporter_id, 'admin_notice', auth.uid(), 'reportdone',
            '通報してくれた内容を運営が確認しました。教えてくれてありがとうございます。',
            '🚩 通報した内容を運営が確認しました', './?tab=profile');
  end if;
end $$;
revoke all on function public.kimetomo_admin_handle_report(bigint, text) from public, anon;
grant execute on function public.kimetomo_admin_handle_report(bigint, text) to authenticated;

select 'OK：通報を受け付けられるようにしました' as 結果;
