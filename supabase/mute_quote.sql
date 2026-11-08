-- 🔇 ミュート と 🔁 引用して投稿
-- Supabase の SQL Editor で 1 回実行する（何回実行しても大丈夫）

-- ===== 🔇 ミュート =====
-- ミュートした人の投稿は、自分のタイムラインに出なくなる（コメント・チャット・通知はそのまま）。
-- 相手には分からない。自分の行だけ読める・足せる・消せる。
create table if not exists public.kimetomo_user_mutes (
  muter_id uuid not null references auth.users(id) on delete cascade,
  muted_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);
alter table public.kimetomo_user_mutes enable row level security;
revoke all on public.kimetomo_user_mutes from anon;
grant select, insert, delete on public.kimetomo_user_mutes to authenticated;

drop policy if exists "kimetomo mute read own" on public.kimetomo_user_mutes;
create policy "kimetomo mute read own" on public.kimetomo_user_mutes
  for select to authenticated using (muter_id = (select auth.uid()));
drop policy if exists "kimetomo mute add own" on public.kimetomo_user_mutes;
create policy "kimetomo mute add own" on public.kimetomo_user_mutes
  for insert to authenticated with check (muter_id = (select auth.uid()));
drop policy if exists "kimetomo mute remove own" on public.kimetomo_user_mutes;
create policy "kimetomo mute remove own" on public.kimetomo_user_mutes
  for delete to authenticated using (muter_id = (select auth.uid()));

-- ===== 🔁 引用して投稿 =====
-- 投稿に「引用した投稿の id」を持たせる。元の投稿の本文はコピーしない
-- （元が消えたら「見られません」と出るだけ。見る人に見る権利がない投稿も表示されない）。
alter table public.kimetomo_timeline_posts add column if not exists quote_post_id uuid;
create index if not exists km_posts_quote_idx on public.kimetomo_timeline_posts (quote_post_id)
  where quote_post_id is not null;

-- 引用できるのは、書く人に見えている「ふつうの投稿」だけ
-- （女性だけの投稿・匿名の相談は引用できない）。
-- security invoker なので、書く人の見る権利（RLS）のまま確かめる。
create or replace function public.kimetomo_quote_guard()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  if new.quote_post_id is null then
    return new;
  end if;
  if new.anonymous then
    raise exception '匿名の相談では引用できません';
  end if;
  if not exists (
    select 1 from public.kimetomo_timeline_posts p
    where p.id = new.quote_post_id and not p.women_only and not p.anonymous
  ) then
    raise exception 'この投稿は引用できません';
  end if;
  return new;
end;
$$;
drop trigger if exists kimetomo_quote_guard on public.kimetomo_timeline_posts;
create trigger kimetomo_quote_guard before insert on public.kimetomo_timeline_posts
  for each row execute function public.kimetomo_quote_guard();

-- 投稿を直すとき、引用先は変えられない（本文だけ直せる：post_edit_expire.sql の続き）
create or replace function public.kimetomo_post_edit_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.id := old.id;
  new.author_id := old.author_id;
  new.created_at := old.created_at;
  new.image_path := old.image_path;
  new.comments_off := old.comments_off;
  new.expires_at := old.expires_at;
  new.women_only := old.women_only;
  new.anonymous := old.anonymous;
  new.quote_post_id := old.quote_post_id;
  if new.body is distinct from old.body then
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  return new;
end;
$$;
