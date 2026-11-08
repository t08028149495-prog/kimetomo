-- キメ友SNS: いたずら通報の対策（2026-11-09）
--   ・「問題なし」にされた通報が 3件以上あり、しかも「対応した」より多い人の通報は、
--     管理者のベル（とプッシュ通知）を鳴らさず、記録だけ残す（quiet = true）
--   ・ただし「未成年かもしれない」「違法なこと」は大事なので、だれからでも必ず鳴らす
--   ・管理者の通報一覧に「この人の通報：問題なし○件」と「🔕 ベルなし」を出せるようにする
--   ・通報した人には今までどおり何も変わらない（ベルが鳴らなかったことは知らされない）
--   ・1人が通報できるのは 1日5件まで（前は10件）
-- reports.sql の後に実行。何度実行しても大丈夫です。

alter table public.kimetomo_reports add column if not exists quiet boolean not null default false;

-- ========== メンバー：通報する（ベルを鳴らすかの判定を追加） ==========
create or replace function public.kimetomo_report(p_kind text, p_target uuid, p_reason text, p_note text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  who uuid;
  snap text;
  pid uuid;
  n text := nullif(trim(coalesce(p_note, '')), '');
  new_id bigint;
  n_dismissed int;
  n_done int;
  is_quiet boolean := false;
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
      where reporter_id = me and created_at > now() - interval '1 day') >= 5 then
    raise exception '通報は1日5件までです。急ぎのときは、ブロックも使ってください';
  end if;

  -- 「問題なし」が多い人の通報は、ベルを鳴らさない（未成年・違法は必ず鳴らす）
  select count(*) filter (where status = 'dismissed'), count(*) filter (where status = 'done')
    into n_dismissed, n_done
    from public.kimetomo_reports where reporter_id = me;
  is_quiet := n_dismissed >= 3 and n_dismissed > n_done and p_reason not in ('minor', 'illegal');

  insert into public.kimetomo_reports (reporter_id, kind, target_id, target_user, post_id, reason, note, snapshot, quiet)
  values (me, p_kind, p_target, who, pid, p_reason, n, snap, is_quiet)
  returning id into new_id;

  if not is_quiet then
    insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
    select p.user_id, 'admin_notice', me, 'report', public.kimetomo_report_reason_label(p_reason),
           '🚩 通報が届きました', './?tab=profile'
    from public.circle_profiles p
    where p.is_admin and p.status = 'approved' and p.user_id <> me;
  end if;
  return new_id;
end $$;
revoke all on function public.kimetomo_report(text, uuid, text, text) from public, anon;
grant execute on function public.kimetomo_report(text, uuid, text, text) to authenticated;

-- ========== 管理者：届いた通報（通報した人の「問題なし」件数・ベルなしを追加） ==========
drop function if exists public.kimetomo_admin_reports();
create function public.kimetomo_admin_reports()
returns table (id bigint, kind text, target_id uuid, post_id uuid, target_user uuid, reporter_name text, target_name text,
               reason text, note text, snapshot text, status text, created_at timestamptz, target_total bigint,
               reporter_dismissed bigint, quiet boolean)
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
           r.quiet
    from public.kimetomo_reports r
    order by (r.status = 'new') desc, r.created_at desc
    limit 60;
end $$;
revoke all on function public.kimetomo_admin_reports() from public, anon;
grant execute on function public.kimetomo_admin_reports() to authenticated;

select 'OK：いたずら通報の対策を入れました' as 結果;
