-- キメ友SNS: 機能リクエストをタイムラインに自動で投稿する
--   ・新しいリクエストが届いたとき
--   ・管理者が状態やコメントを更新したとき
-- だれがリクエストしたかは書かない（匿名のまま）。投稿者は管理者になる。
-- 何度実行しても大丈夫です。

create or replace function public.kimetomo_request_status_label(p text)
returns text language sql immutable as $$
  select case p
    when 'new' then '🆕 新着'
    when 'thinking' then '🤔 検討中'
    when 'making' then '🛠 作成中'
    when 'done' then '✅ 完成'
    when 'declined' then '🙏 見送り'
    else p
  end;
$$;

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

drop trigger if exists kimetomo_request_to_timeline on public.kimetomo_feature_requests;
create trigger kimetomo_request_to_timeline
  after insert or update of status, admin_reply on public.kimetomo_feature_requests
  for each row execute function public.kimetomo_request_to_timeline();
