-- キメ友SNS: チャットの写真は 1 人 1 日 5 枚まで（日本時間の 0 時にリセット）
-- 容量と通信量の節約のため。anti_spam.sql の「10 分に 10 件まで」とは別に効く。
-- 枚数を変えるときは、下の 2 か所の 5 を書き換えて、もう一度実行する。

-- 今日（日本時間）すでに送った枚数
create or replace function public.kimetomo_chat_photos_today(p_user uuid)
 returns integer
 language sql
 stable
 security definer
 set search_path to ''
as $$
  select count(*)::integer from public.circle_media
  where sender_id = p_user
    and created_at >= (date_trunc('day', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo');
$$;
revoke all on function public.kimetomo_chat_photos_today(uuid) from public, anon, authenticated;

-- 送る前に断る
create or replace function public.kimetomo_chat_photo_daily_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $$
begin
  if public.kimetomo_chat_photos_today(new.sender_id) >= 5 then
    raise exception '写真は1日5枚までです。明日（日本時間の0時すぎ）にまた送れます。';
  end if;
  return new;
end;
$$;

drop trigger if exists kimetomo_chat_photo_daily_limit on public.circle_media;
create trigger kimetomo_chat_photo_daily_limit
  before insert on public.circle_media
  for each row execute function public.kimetomo_chat_photo_daily_guard();

-- 画面用：自分が今日あと何枚送れるか
create or replace function public.kimetomo_chat_photos_left()
 returns integer
 language sql
 stable
 security definer
 set search_path to ''
as $$
  select greatest(0, 5 - public.kimetomo_chat_photos_today((select auth.uid())));
$$;
revoke all on function public.kimetomo_chat_photos_left() from public, anon;
grant execute on function public.kimetomo_chat_photos_left() to authenticated;
