-- キメ友SNS: 個人チャット（DM）のメッセージにリアクション（❤️ 😂 👍 😮 😢 🙏）を付ける
-- ・付けられるのは「相手のメッセージ」だけ。1つのメッセージに 1 人 1 つ（選び直すと置きかわる）。
-- ・外すときは行を消さずに emoji を空（null）にする。
--   （リアルタイムの「消した」知らせは見る権利の確認ができないため、「書きかえ」だけで相手に届ける）
-- ・見られるのは、その会話の 2 人だけ。ブロック中・BAN 中・2段階認証の未確認では使えない。

create table if not exists public.kimetomo_dm_reactions (
  message_id uuid not null references public.kimetomo_direct_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.kimetomo_direct_conversations(id) on delete cascade,
  emoji text check (emoji is null or emoji in ('❤️', '😂', '👍', '😮', '😢', '🙏')),
  updated_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists kimetomo_dm_reactions_conv on public.kimetomo_dm_reactions (conversation_id);
create index if not exists kimetomo_dm_reactions_user on public.kimetomo_dm_reactions (user_id);

alter table public.kimetomo_dm_reactions enable row level security;
revoke all on public.kimetomo_dm_reactions from anon;
grant select, insert, update on public.kimetomo_dm_reactions to authenticated;

-- そのメッセージがこの会話のもので、送ったのが相手（自分ではない）か
create or replace function public.kimetomo_dm_reaction_ok(p_message uuid, p_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.kimetomo_can_access_dm(p_conversation)
    and exists (
      select 1 from public.kimetomo_direct_messages m
      where m.id = p_message and m.conversation_id = p_conversation and m.sender_id <> auth.uid()
    );
$$;
revoke execute on function public.kimetomo_dm_reaction_ok(uuid, uuid) from public, anon;
grant execute on function public.kimetomo_dm_reaction_ok(uuid, uuid) to authenticated;

drop policy if exists "dm reaction read" on public.kimetomo_dm_reactions;
drop policy if exists "dm reaction add own" on public.kimetomo_dm_reactions;
drop policy if exists "dm reaction change own" on public.kimetomo_dm_reactions;
drop policy if exists "kimetomo not banned" on public.kimetomo_dm_reactions;
drop policy if exists "kimetomo mfa" on public.kimetomo_dm_reactions;
drop policy if exists "dm reaction not blocked" on public.kimetomo_dm_reactions;

create policy "dm reaction read" on public.kimetomo_dm_reactions
  for select to authenticated using (public.kimetomo_can_access_dm(conversation_id));
create policy "dm reaction add own" on public.kimetomo_dm_reactions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.kimetomo_dm_reaction_ok(message_id, conversation_id));
create policy "dm reaction change own" on public.kimetomo_dm_reactions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.kimetomo_dm_reaction_ok(message_id, conversation_id));

-- BAN 中・2段階認証が済んでいない・ブロックし合っているときは使えない
create policy "kimetomo not banned" on public.kimetomo_dm_reactions as restrictive for all to authenticated
  using (not (select public.kimetomo_is_banned())) with check (not (select public.kimetomo_is_banned()));
create policy "kimetomo mfa" on public.kimetomo_dm_reactions as restrictive for all to authenticated
  using ((select public.kimetomo_mfa_ok())) with check ((select public.kimetomo_mfa_ok()));
create policy "dm reaction not blocked" on public.kimetomo_dm_reactions as restrictive for insert to authenticated
  with check (public.kimetomo_dm_not_blocked(conversation_id));
drop policy if exists "dm reaction not blocked update" on public.kimetomo_dm_reactions;
create policy "dm reaction not blocked update" on public.kimetomo_dm_reactions as restrictive for update to authenticated
  using (true) with check (public.kimetomo_dm_not_blocked(conversation_id));

-- 相手が付けたリアクションがリアルタイムで見えるようにする（付ける・選び直す・外す＝すべて insert か update）
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'kimetomo_dm_reactions'
  ) then
    execute 'alter publication supabase_realtime add table public.kimetomo_dm_reactions';
  end if;
exception when undefined_object then null;
end $$;
