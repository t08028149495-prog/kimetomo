-- キメ友SNS: グループチャットのメッセージにスタンプで反応する
-- 同じルームのメンバーだけが見られ、付けられる。自分のスタンプだけ外せる。

do $$
declare
  msg_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into msg_id_type
  from pg_attribute a
  where a.attrelid = 'public.circle_messages'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists public.kimetomo_chat_reactions (
      message_id %s not null references public.circle_messages(id) on delete cascade,
      user_id uuid not null references auth.users(id) on delete cascade,
      emoji text not null check (emoji in ('👍', '😂', '❤️', '😮', '😢', '🙏')),
      created_at timestamptz not null default now(),
      primary key (message_id, user_id, emoji)
    )$f$, msg_id_type);
end $$;

alter table public.kimetomo_chat_reactions enable row level security;

-- そのメッセージのルームに自分が入っているか
create or replace function public.kimetomo_chat_reaction_allowed(p_message anyelement)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.circle_messages m
    join public.circle_room_members r on r.room_id = m.room_id
    join public.circle_profiles p on p.user_id = r.user_id
    where m.id = p_message and r.user_id = auth.uid() and p.status = 'approved'
  );
$$;

drop policy if exists "chat reaction read" on public.kimetomo_chat_reactions;
drop policy if exists "chat reaction add own" on public.kimetomo_chat_reactions;
drop policy if exists "chat reaction remove own" on public.kimetomo_chat_reactions;
create policy "chat reaction read" on public.kimetomo_chat_reactions
  for select to authenticated using (public.kimetomo_chat_reaction_allowed(message_id));
create policy "chat reaction add own" on public.kimetomo_chat_reactions
  for insert to authenticated with check (user_id = auth.uid() and public.kimetomo_chat_reaction_allowed(message_id));
create policy "chat reaction remove own" on public.kimetomo_chat_reactions
  for delete to authenticated using (user_id = auth.uid());

-- BAN 機能を入れている場合は、BAN された人も止める
do $$
begin
  if to_regprocedure('public.kimetomo_is_banned(uuid)') is not null then
    execute 'drop policy if exists "kimetomo not banned" on public.kimetomo_chat_reactions';
    execute 'create policy "kimetomo not banned" on public.kimetomo_chat_reactions as restrictive for all to authenticated using (not public.kimetomo_is_banned()) with check (not public.kimetomo_is_banned())';
  end if;
end $$;

-- スタンプがリアルタイムで反映されるようにする
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'kimetomo_chat_reactions'
  ) then
    execute 'alter publication supabase_realtime add table public.kimetomo_chat_reactions';
  end if;
exception when undefined_object then null;
end $$;
