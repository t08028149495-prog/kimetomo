-- キメ友SNS: 画像付きの投稿がされたら、メンバー全員にお知らせする
--   ・ベル通知（🔔）に追加され、プッシュ通知も届く（既存の Webhook がそのまま送る）
--   ・投稿した本人、BAN された人、投稿者をブロックしている人には送らない
-- 先に admin_images.sql を実行しておくこと。何度実行しても大丈夫です。

alter table public.kimetomo_timeline_posts add column if not exists image_path text;

-- ベル通知の種類に「画像投稿」を追加
alter table public.kimetomo_bell_notifications drop constraint if exists kimetomo_bell_notifications_kind_check;
alter table public.kimetomo_bell_notifications add constraint kimetomo_bell_notifications_kind_check
  check (kind in ('chat', 'dm', 'comment', 'reply', 'request_new', 'request_done', 'image_post'));

create or replace function public.kimetomo_bell_on_image_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.image_path is null then
    return new;
  end if;

  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  select p.user_id, 'image_post', new.author_id, new.id::text,
         case when new.body = '📷' then '' else left(coalesce(new.body, ''), 80) end,
         public.kimetomo_bell_name(new.author_id) || 'さんが画像を投稿しました',
         './?post=' || new.id::text
  from public.circle_profiles p
  where p.status = 'approved'
    and p.user_id <> new.author_id
    and not public.kimetomo_is_banned(p.user_id)
    and not public.kimetomo_bell_blocked(p.user_id, new.author_id);
  return new;
end $$;

drop trigger if exists kimetomo_bell_image_post on public.kimetomo_timeline_posts;
create trigger kimetomo_bell_image_post after insert on public.kimetomo_timeline_posts
  for each row execute function public.kimetomo_bell_on_image_post();
