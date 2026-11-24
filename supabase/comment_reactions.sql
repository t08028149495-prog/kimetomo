-- 💬 コメント・返信へのリアクション（2026-11-25）
-- 投稿のリアクション（kimetomo_timeline_reactions）と同じ 6 種類の絵文字を、コメント・返信にも付けられるようにする。
-- 画面は js/comment-reactions.js。付けられたコメントの人にはベル（プッシュ）で知らせる（メールは送らない）。
-- 何度実行しても同じ結果になる。

create table if not exists public.kimetomo_comment_reactions (
  comment_id uuid not null,
  post_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id, emoji),
  -- コメントと投稿の組み合わせが本物であること（コメントが消えたらリアクションも消える）
  foreign key (comment_id, post_id) references public.kimetomo_timeline_comments(id, post_id) on delete cascade,
  constraint km_comment_react_emoji check (emoji = any (array['❤️','😂','😮','😢','🔥','👏']))
);
create index if not exists km_comment_reactions_post on public.kimetomo_comment_reactions (post_id);
create index if not exists km_comment_reactions_user on public.kimetomo_comment_reactions (user_id);

alter table public.kimetomo_comment_reactions enable row level security;
revoke all on public.kimetomo_comment_reactions from anon;
grant select, insert, delete on public.kimetomo_comment_reactions to authenticated;

-- 決まり（投稿のリアクションとそろえる）
drop policy if exists "km_comment_reactions_select" on public.kimetomo_comment_reactions;
drop policy if exists "km_comment_reactions_insert" on public.kimetomo_comment_reactions;
drop policy if exists "km_comment_reactions_delete" on public.kimetomo_comment_reactions;
drop policy if exists "kimetomo mfa" on public.kimetomo_comment_reactions;
drop policy if exists "kimetomo not banned" on public.kimetomo_comment_reactions;
drop policy if exists "kimetomo women post only" on public.kimetomo_comment_reactions;
create policy "km_comment_reactions_select" on public.kimetomo_comment_reactions
  for select to authenticated using ((select public.kimetomo_is_active_member()));
create policy "km_comment_reactions_insert" on public.kimetomo_comment_reactions
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.kimetomo_is_active_member()));
create policy "km_comment_reactions_delete" on public.kimetomo_comment_reactions
  for delete to authenticated using (user_id = (select auth.uid()) and (select public.kimetomo_is_active_member()));
create policy "kimetomo mfa" on public.kimetomo_comment_reactions as restrictive for all to authenticated
  using ((select public.kimetomo_mfa_ok())) with check ((select public.kimetomo_mfa_ok()));
create policy "kimetomo not banned" on public.kimetomo_comment_reactions as restrictive for all to authenticated
  using (not (select public.kimetomo_is_banned())) with check (not (select public.kimetomo_is_banned()));
create policy "kimetomo women post only" on public.kimetomo_comment_reactions as restrictive for all to authenticated
  using (public.kimetomo_post_visible(post_id)) with check (public.kimetomo_post_visible(post_id));

-- 🔔 コメントを書いた人に知らせる（同じ人・同じコメントは 24 時間に 1 回まで。匿名の相談の「相談した人」には送らない）
create or replace function public.kimetomo_bell_on_comment_reaction()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  author uuid;
  snippet text;
begin
  select c.author_id, left(coalesce(c.body, ''), 60) into author, snippet
    from public.kimetomo_timeline_comments c where c.id = new.comment_id;
  if author is null or author = new.user_id then return new; end if;
  if author = public.kimetomo_anon_carrier() then return new; end if;
  if public.kimetomo_bell_blocked(author, new.user_id) then return new; end if;
  if exists (select 1 from public.kimetomo_bans b where b.user_id = new.user_id) then return new; end if;
  if exists (select 1 from public.kimetomo_bell_notifications n
              where n.recipient_id = author and n.kind = 'reaction' and n.actor_id = new.user_id
                and n.ref_id = 'rcom:' || new.comment_id::text and n.created_at > now() - interval '24 hours') then
    return new;
  end if;
  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  values (author, 'reaction', new.user_id, 'rcom:' || new.comment_id::text, new.emoji || ' ' || snippet,
          public.kimetomo_bell_name(new.user_id) || 'さんがあなたのコメントに ' || new.emoji || ' しました',
          './?post=' || new.post_id::text);
  return new;
end $$;
revoke all on function public.kimetomo_bell_on_comment_reaction() from public, anon, authenticated;

drop trigger if exists kimetomo_bell_comment_reaction on public.kimetomo_comment_reactions;
create trigger kimetomo_bell_comment_reaction after insert on public.kimetomo_comment_reactions
  for each row execute function public.kimetomo_bell_on_comment_reaction();
