-- キメ友SNS: グループチャットのプッシュ通知を押したら、そのチャットルームが開くようにする
-- （未読のあいだ 1 回だけ通知する仕組みはそのまま）
create or replace function public.kimetomo_bell_on_chat()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  select m.user_id, 'chat', new.sender_id, new.room_id::text, left(coalesce(new.body, ''), 80),
         public.kimetomo_bell_name(new.sender_id) || 'さんがグループチャットに投稿しました', './?tab=chat&room=' || new.room_id::text
  from public.circle_room_members m
  where m.room_id = new.room_id
    and m.user_id <> new.sender_id
    and not public.kimetomo_bell_blocked(m.user_id, new.sender_id)
    -- 同じルームの未読のチャット通知がある人には送らない（読むまで 1 回だけ）
    and not exists (
      select 1 from public.kimetomo_bell_notifications n
      where n.recipient_id = m.user_id and n.kind = 'chat'
        and n.ref_id = new.room_id::text and n.read_at is null
    );
  return new;
end $$;
