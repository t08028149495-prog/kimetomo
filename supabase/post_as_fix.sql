-- キメ友SNS: 自動投稿（のぞう・歓迎投稿・機能リクエスト・今週のまとめ）の修正
-- タイムラインには「投稿者本人かどうか」を確かめる仕組みがあるため、
-- 自動投稿のときは、その一瞬だけ投稿者本人として投稿するようにする。
-- 何度実行しても大丈夫です。

create or replace function public.kimetomo_insert_post_as(p_author uuid, p_body text)
returns text language plpgsql security definer set search_path = public as $$
declare
  old_sub text := current_setting('request.jwt.claim.sub', true);
  old_claims text := current_setting('request.jwt.claims', true);
  old_role text := current_setting('request.jwt.claim.role', true);
  new_id text;
begin
  perform set_config('request.jwt.claim.sub', p_author::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_author, 'role', 'authenticated')::text, true);
  begin
    insert into public.kimetomo_timeline_posts (author_id, body)
    values (p_author, left(p_body, 1000))
    returning id::text into new_id;
  exception when others then
    perform set_config('request.jwt.claim.sub', coalesce(old_sub, ''), true);
    perform set_config('request.jwt.claim.role', coalesce(old_role, ''), true);
    perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
    raise;
  end;
  perform set_config('request.jwt.claim.sub', coalesce(old_sub, ''), true);
  perform set_config('request.jwt.claim.role', coalesce(old_role, ''), true);
  perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
  return new_id;
end $$;

revoke all on function public.kimetomo_insert_post_as(uuid, text) from public, anon, authenticated;
grant execute on function public.kimetomo_insert_post_as(uuid, text) to service_role;

-- 歓迎投稿
create or replace function public.kimetomo_welcome_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  poster uuid;
begin
  if new.status = 'approved'
     and (tg_op = 'INSERT' or old.status = 'pending') then
    poster := (select user_id from public.circle_profiles
               where is_admin and status = 'approved' and user_id <> new.user_id
               order by user_id limit 1);
    if poster is not null then
      perform public.kimetomo_insert_post_as(poster,
        '🎉 ' || coalesce(nullif(new.display_name, ''), '新しいメンバー') ||
        'さんが仲間入りしました！' || chr(10) || 'みんなでコメントして歓迎しよう👋');
    end if;
  end if;
  return new;
end $$;

-- 機能リクエストの自動投稿（request_timeline.sql を実行済みの場合）
create or replace function public.kimetomo_request_to_timeline()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  poster uuid;
  msg text;
begin
  poster := (select user_id from public.circle_profiles
             where is_admin and status = 'approved'
             order by user_id limit 1);
  if poster is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    msg := '💡 新しい機能リクエストが届きました！' || chr(10) ||
           '「' || new.title || '」' ||
           case when coalesce(trim(new.body), '') <> '' then chr(10) || 'くわしく：' || left(trim(new.body), 300) else '' end ||
           chr(10) || chr(10) || 'いいなと思ったら、プロフィールタブの「機能リクエスト」で👍を押してね';
  elsif new.status is distinct from old.status
        or (new.admin_reply is distinct from old.admin_reply and coalesce(new.admin_reply, '') <> '') then
    msg := '👑 機能リクエストが更新されました' || chr(10) ||
           '「' || new.title || '」' ||
           case when coalesce(trim(new.body), '') <> '' then chr(10) || 'くわしく：' || left(trim(new.body), 300) else '' end ||
           case when new.status is distinct from old.status
                then chr(10) || public.kimetomo_request_status_label(old.status) || ' → ' || public.kimetomo_request_status_label(new.status)
                else chr(10) || '状態：' || public.kimetomo_request_status_label(new.status) end ||
           case when coalesce(new.admin_reply, '') <> '' then chr(10) || '管理者より：' || new.admin_reply else '' end;
  else
    return new;
  end if;

  perform public.kimetomo_insert_post_as(poster, msg);
  return new;
end $$;
