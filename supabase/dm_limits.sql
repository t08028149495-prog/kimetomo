-- DMの送りすぎを防ぐ制限（2026-11-09）
--  1. 相手から一度も返事が来ていない会話では、3通までしか送れない
--  2. まだ話したことのない人に自分から最初のDMを送れるのは、24時間で5人まで
--  ・相手が先に送ってくれた会話への返信は、どちらの制限も受けない
--  ・管理者（運営からのお知らせDM）は対象外

create index if not exists km_dm_sender_idx
  on public.kimetomo_direct_messages (sender_id, created_at desc);

create or replace function public.kimetomo_dm_limits()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  rcpt uuid;
  sent_count integer;
  new_people integer;
begin
  -- 管理者は対象外
  if exists (select 1 from public.circle_profiles p
             where p.user_id = new.sender_id and p.is_admin and p.status = 'approved') then
    return new;
  end if;

  select case when c.user_a = new.sender_id then c.user_b else c.user_a end
    into rcpt
    from public.kimetomo_direct_conversations c
   where c.id = new.conversation_id;
  if rcpt is null then
    return new;
  end if;

  -- 相手が一度でも送ってくれていれば制限なし
  if exists (select 1 from public.kimetomo_direct_messages m
             where m.conversation_id = new.conversation_id and m.sender_id = rcpt) then
    return new;
  end if;

  select count(*) into sent_count
    from public.kimetomo_direct_messages m
   where m.conversation_id = new.conversation_id and m.sender_id = new.sender_id;

  -- 1. 返事が来るまで3通まで
  if sent_count >= 3 then
    raise exception '相手から返事が来るまでは、3通までしか送れません。返事を待ってください。'
      using errcode = 'P0001';
  end if;

  -- 2. 新しい相手は24時間で5人まで
  if sent_count = 0 then
    select count(*) into new_people
      from (
        select distinct on (m.conversation_id) m.sender_id, m.created_at
          from public.kimetomo_direct_messages m
         where m.conversation_id in (
                 select x.conversation_id from public.kimetomo_direct_messages x
                  where x.sender_id = new.sender_id
                    and x.created_at > now() - interval '24 hours')
         order by m.conversation_id, m.created_at
      ) first_msg
     where first_msg.sender_id = new.sender_id
       and first_msg.created_at > now() - interval '24 hours';

    if new_people >= 5 then
      raise exception '新しい相手に送れるDMは、24時間で5人までです。時間をおいてから送ってください。'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.kimetomo_dm_limits() from public, anon, authenticated;

drop trigger if exists kimetomo_dm_limits on public.kimetomo_direct_messages;
create trigger kimetomo_dm_limits
  before insert on public.kimetomo_direct_messages
  for each row execute function public.kimetomo_dm_limits();
