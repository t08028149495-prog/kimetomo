-- キメ友SNS: 退会（自分のアカウントを消す）
--   Edge Function「kimetomo-delete-account」からだけ呼ぶ（service_role 専用。メンバーが直接は呼べない）
--   ・消すもの：アカウント・プロフィール・投稿・コメント・リアクション・アンケートの票・
--     グループチャットの発言と写真の記録・DM（相手側からも会話ごと消える）・通知・設定など、その人の記録すべて
--   ・残すもの：運営への通報の記録（通報された側の名前は消える）・招待コードの記録（「（退会済み）」と表示）
--   ・管理者は退会できない（先に管理者を外す）
--   ・途中でエラーが出たときは、何も消えずに元のままになる
--   写真のファイル本体は SQL では消せないので、Edge Function が kimetomo_account_files の一覧を使って消す。

-- 消す写真ファイルの一覧（プロフィール写真・投稿の画像・グループチャットの写真）
create or replace function public.kimetomo_account_files(p_uid uuid)
returns table (bucket_id text, name text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.bucket_id, o.name
  from storage.objects o
  where (o.bucket_id in ('kimetomo-profile-avatars', 'kimetomo-post-images')
         and split_part(o.name, '/', 1) = p_uid::text)
     or (o.bucket_id = 'circle-private-media' and split_part(o.name, '/', 2) = p_uid::text)
     or o.owner_id = p_uid::text
$$;

create or replace function public.kimetomo_account_delete(p_uid uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_uid is null or not exists (select 1 from auth.users where id = p_uid) then
    return 'not_found';
  end if;
  if exists (select 1 from public.circle_profiles where user_id = p_uid and is_admin) then
    return 'admin';
  end if;

  -- DM：その人との会話を丸ごと（メッセージ・リアクションも一緒に消える）
  delete from public.kimetomo_direct_conversations where user_a = p_uid or user_b = p_uid;
  delete from public.kimetomo_direct_messages where sender_id = p_uid;

  -- グループチャット：発言（リアクションも一緒に消える）と写真の記録
  delete from public.circle_messages where sender_id = p_uid;
  delete from public.circle_media where sender_id = p_uid;

  -- 外部キーのない表に残る、その人の記録
  delete from public.kimetomo_bell_notifications where actor_id = p_uid;
  delete from public.kimetomo_flagged where author_id = p_uid;
  delete from public.kimetomo_bot_candidates where user_id = p_uid;
  delete from public.kimetomo_rate_limits where user_id = p_uid;
  delete from public.kimetomo_invite_uses where user_id = p_uid;

  -- アカウント本体（プロフィール・投稿・コメント・リアクション・通知・設定などは一緒に消える）
  delete from auth.users where id = p_uid;
  return 'ok';
end $$;

revoke all on function public.kimetomo_account_files(uuid) from public, anon, authenticated;
revoke all on function public.kimetomo_account_delete(uuid) from public, anon, authenticated;
grant execute on function public.kimetomo_account_files(uuid) to service_role;
grant execute on function public.kimetomo_account_delete(uuid) to service_role;
