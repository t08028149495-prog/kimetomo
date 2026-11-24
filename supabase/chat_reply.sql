-- ↩️ グループチャットの返信（2026-11-24）
-- ・circle_messages に「どのメッセージへの返信か」（reply_to）を足す
-- ・返信先は同じルームのメッセージだけ（ちがうルームは送れない）
-- ・返信された本人にベル通知（kind = 'chat_reply'）とプッシュ通知
--   - 自分への返信・ブロックしている相手からの返信・もうルームにいない人には送らない
--   - 同じ人から同じルームで、まだ読んでいない返信通知が 10 分以内にあれば、もう送らない（通知が多くなりすぎないように）
--   - 返信された人には、ふつうの「グループチャットに投稿しました」（chat）は送らない（二重にしない）
--   - プッシュ通知の文には内容を書かない（女性だけの部屋も同じ）

alter table public.circle_messages add column if not exists reply_to uuid;

-- ベル通知の種類に 'chat_reply' を足す
alter table public.kimetomo_bell_notifications drop constraint if exists kimetomo_bell_notifications_kind_check;
alter table public.kimetomo_bell_notifications add constraint kimetomo_bell_notifications_kind_check
  check (kind = any (array['admin_notice', 'chat', 'chat_reply', 'comment', 'dm', 'image_post', 'reply',
                           'request_done', 'request_new', 'reaction'])) not valid;

-- 返信先が同じルームのメッセージかを確かめる
create or replace function public.kimetomo_chat_reply_check()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.reply_to is not null and not exists (
       select 1 from public.circle_messages m
        where m.id = new.reply_to and m.room_id = new.room_id) then
    raise exception '返信先のメッセージが見つかりません';
  end if;
  return new;
end $$;

drop trigger if exists kimetomo_chat_reply_check on public.circle_messages;
create trigger kimetomo_chat_reply_check
  before insert on public.circle_messages
  for each row execute function public.kimetomo_chat_reply_check();
revoke execute on function public.kimetomo_chat_reply_check() from public, anon, authenticated;

-- ベル通知（今までの「グループチャットに投稿しました」に、返信の通知を足した）
create or replace function public.kimetomo_bell_on_chat()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  target uuid;
begin
  if new.reply_to is not null then
    select m.sender_id into target from public.circle_messages m where m.id = new.reply_to;
    if target is not null and target <> new.sender_id
       and exists (select 1 from public.circle_room_members r where r.room_id = new.room_id and r.user_id = target)
       and not public.kimetomo_bell_blocked(target, new.sender_id) then
      if not exists (
           select 1 from public.kimetomo_bell_notifications n
            where n.recipient_id = target and n.kind = 'chat_reply'
              and n.actor_id = new.sender_id and n.ref_id = new.room_id::text
              and n.read_at is null and n.created_at > now() - interval '10 minutes') then
        insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
        values (target, 'chat_reply', new.sender_id, new.room_id::text, left(coalesce(new.body, ''), 80),
                public.kimetomo_bell_name(new.sender_id) || 'さんがグループチャットであなたに返信しました',
                './?tab=chat&room=' || new.room_id::text || '&msg=' || new.id::text);
      end if;
    else
      target := null;
    end if;
  end if;

  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  select m.user_id, 'chat', new.sender_id, new.room_id::text, left(coalesce(new.body, ''), 80),
         public.kimetomo_bell_name(new.sender_id) || 'さんがグループチャットに投稿しました', './?tab=chat&room=' || new.room_id::text
  from public.circle_room_members m
  where m.room_id = new.room_id
    and m.user_id <> new.sender_id
    and m.user_id is distinct from target
    and not public.kimetomo_bell_blocked(m.user_id, new.sender_id)
    -- 同じルームの未読のチャット通知がある人には送らない（読むまで 1 回だけ）
    and not exists (
      select 1 from public.kimetomo_bell_notifications n
      where n.recipient_id = m.user_id and n.kind = 'chat'
        and n.ref_id = new.room_id::text and n.read_at is null
    );
  return new;
end $$;

-- プッシュ通知の種類のオン／オフに 'chat_reply' を足す
create or replace function public.kimetomo_set_push_off(p_kinds text[])
returns text[]
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me uuid := auth.uid();
  kinds text[];
begin
  if me is null then raise exception 'not signed in'; end if;
  select coalesce(array_agg(distinct k order by k), '{}') into kinds
    from unnest(coalesce(p_kinds, '{}')) as k
   where k in ('chat', 'chat_reply', 'dm', 'image_post', 'comment', 'reply', 'reaction',
               'request_new', 'request_done', 'admin_notice');
  insert into public.kimetomo_push_prefs (user_id, off_kinds, updated_at)
  values (me, kinds, now())
  on conflict (user_id) do update set off_kinds = excluded.off_kinds, updated_at = now();
  return kinds;
end $$;
