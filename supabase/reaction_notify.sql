-- キメ友SNS: タイムラインの投稿にリアクション（絵文字）が付いたら、投稿した人のベルとプッシュ通知で知らせる
--   ・「〇〇さんがあなたの投稿に ❤️ しました」と、だれが押したかが分かる
--   ・自分で自分の投稿に押したとき、ブロックしている人・BAN 中の人が押したときは知らせない
--   ・同じ人が同じ投稿に押した通知は、24時間に1回まで（付けたり外したりで何度も届かないように）
--   ・メール通知の対象にはしない（コメント・返信・DM だけ）
-- 何度実行しても大丈夫です。

-- 通知の種類に「reaction」を足す（今ある種類はそのまま）
alter table public.kimetomo_bell_notifications drop constraint if exists kimetomo_bell_notifications_kind_check;
alter table public.kimetomo_bell_notifications add constraint kimetomo_bell_notifications_kind_check
  check (kind in ('admin_notice', 'chat', 'comment', 'dm', 'image_post', 'reply', 'request_done', 'request_new', 'reaction')) not valid;

create or replace function public.kimetomo_bell_on_reaction()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  author uuid;
  snippet text;
begin
  select p.author_id, left(coalesce(p.body, ''), 60) into author, snippet
    from public.kimetomo_timeline_posts p where p.id = new.post_id;
  if author is null or author = new.user_id then return new; end if;
  if public.kimetomo_bell_blocked(author, new.user_id) then return new; end if;
  if exists (select 1 from public.kimetomo_bans b where b.user_id = new.user_id) then return new; end if;
  if exists (select 1 from public.kimetomo_bell_notifications n
              where n.recipient_id = author and n.kind = 'reaction' and n.actor_id = new.user_id
                and n.ref_id = new.post_id::text and n.created_at > now() - interval '24 hours') then
    return new;
  end if;
  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  values (author, 'reaction', new.user_id, new.post_id::text, new.emoji || ' ' || snippet,
          public.kimetomo_bell_name(new.user_id) || 'さんがあなたの投稿に ' || new.emoji || ' しました',
          './?post=' || new.post_id::text);
  return new;
end $$;
revoke all on function public.kimetomo_bell_on_reaction() from public, anon, authenticated;

drop trigger if exists kimetomo_bell_reaction on public.kimetomo_timeline_reactions;
create trigger kimetomo_bell_reaction after insert on public.kimetomo_timeline_reactions
  for each row execute function public.kimetomo_bell_on_reaction();

select 'OK：リアクションが付いたら、ベルとプッシュ通知で知らせるようにしました' as 結果;
