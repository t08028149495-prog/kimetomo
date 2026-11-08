-- キメ友SNS: 投稿の編集と、24時間で消える投稿
--   1. 投稿した本人は、あとから本文を直せる（直すと「編集済み」と出る）
--      ・直せるのは本文だけ（画像・コメント設定などは変えられない）
--      ・使えない言葉のチェックは、直したときにも働く（もともとの kimetomo_ng_guard）
--   2. 「24時間で消える投稿」：24時間たつと誰にも見えなくなり、1時間ごとの片付けで削除される
--      （コメント・リアクション・アンケートもいっしょに消える）
-- 何度実行しても大丈夫です。

alter table public.kimetomo_timeline_posts add column if not exists edited_at timestamptz;
alter table public.kimetomo_timeline_posts add column if not exists expires_at timestamptz;
create index if not exists kimetomo_timeline_posts_expires_idx
  on public.kimetomo_timeline_posts (expires_at) where expires_at is not null;

-- 投稿するとき：消える時刻は、サーバーの時計でちょうど24時間後にそろえる
create or replace function public.kimetomo_post_expire_fix()
returns trigger language plpgsql
set search_path to 'public'
as $$
begin
  if new.expires_at is not null then
    new.expires_at := now() + interval '24 hours';
  end if;
  new.edited_at := null;
  return new;
end;
$$;
drop trigger if exists kimetomo_post_expire_fix on public.kimetomo_timeline_posts;
create trigger kimetomo_post_expire_fix before insert on public.kimetomo_timeline_posts
  for each row execute function public.kimetomo_post_expire_fix();

-- 直すとき：本文以外は元のまま。本文が変わったら「編集済み」の時刻を入れる
create or replace function public.kimetomo_post_edit_guard()
returns trigger language plpgsql
set search_path to 'public'
as $$
begin
  new.id := old.id;
  new.author_id := old.author_id;
  new.created_at := old.created_at;
  new.image_path := old.image_path;
  new.comments_off := old.comments_off;
  new.expires_at := old.expires_at;
  if new.body is distinct from old.body then
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  return new;
end;
$$;
drop trigger if exists kimetomo_post_edit_guard on public.kimetomo_timeline_posts;
create trigger kimetomo_post_edit_guard before update on public.kimetomo_timeline_posts
  for each row execute function public.kimetomo_post_edit_guard();

drop policy if exists "kimetomo post edit own" on public.kimetomo_timeline_posts;
create policy "kimetomo post edit own" on public.kimetomo_timeline_posts
  for update to authenticated
  using (author_id = (select auth.uid()) and (select public.kimetomo_is_active_member()))
  with check (author_id = (select auth.uid()) and (select public.kimetomo_is_active_member()));

-- 24時間たった投稿は見えなくする
drop policy if exists "kimetomo post not expired" on public.kimetomo_timeline_posts;
create policy "kimetomo post not expired" on public.kimetomo_timeline_posts
  as restrictive for select to authenticated
  using (expires_at is null or expires_at > now());

-- 消えた投稿にはコメントできない（コメントを受け付けない投稿のチェックに足す）
create or replace function public.kimetomo_comments_open(p_post uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select not exists (
    select 1 from public.kimetomo_timeline_posts p
    where p.id = p_post
      and ((p.comments_off and p.author_id <> auth.uid())
           or (p.expires_at is not null and p.expires_at <= now()))
  );
$$;

-- 1時間ごとに、24時間たった投稿を削除する
select cron.unschedule(jobid) from cron.job where jobname = 'kimetomo-expire-posts';
select cron.schedule('kimetomo-expire-posts', '7 * * * *',
  $$delete from public.kimetomo_timeline_posts where expires_at is not null and expires_at <= now()$$);

notify pgrst, 'reload schema';

select 'OK：投稿の編集と、24時間で消える投稿を使えるようにしました' as 結果;
