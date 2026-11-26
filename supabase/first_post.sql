-- 🔰 はじめての投稿（2026-11-25）
-- ・その人がキメ友ではじめてした投稿に「first_post = true」をつける（タイムラインに 🔰 を出す）
-- ・管理人にベル（とプッシュ）で「〇〇さんがはじめて投稿しました」と知らせる
-- ・投稿が消えても（24時間で消える投稿・削除）もう一度 🔰 がつかないよう、
--   「一度でも投稿した人」を kimetomo_posted_users に覚えておく
-- ・匿名の相談は対象外。女性だけの投稿は 🔰 はつくが、管理人へのベルは送らない

-- 1. 投稿に印の列を足す
alter table public.kimetomo_timeline_posts
  add column if not exists first_post boolean not null default false;

-- 2. 一度でも投稿した人（トリガーだけが読み書きする。画面からは見えない）
create table if not exists public.kimetomo_posted_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_post_id uuid,
  created_at timestamptz not null default now()
);
alter table public.kimetomo_posted_users enable row level security;

-- 今までに投稿したことがある人を入れておく（この人たちの次の投稿には 🔰 がつかない）
insert into public.kimetomo_posted_users (user_id, first_post_id, created_at)
select distinct on (author_id) author_id, id, created_at
from public.kimetomo_timeline_posts
order by author_id, created_at
on conflict do nothing;

-- 3. 投稿する直前に、はじめてかどうかを決める（ほかの「投稿前のチェック」より後に動くよう zz_ で始める）
create or replace function public.kimetomo_first_post_mark()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare n int;
begin
  new.first_post := false;  -- 自分で true にして送っても無効
  if new.anonymous or new.author_id = public.kimetomo_anon_carrier() then return new; end if;
  insert into public.kimetomo_posted_users (user_id, first_post_id)
  values (new.author_id, new.id) on conflict do nothing;
  get diagnostics n = row_count;
  new.first_post := (n = 1);
  return new;
end $$;
drop trigger if exists zz_kimetomo_first_post_mark on public.kimetomo_timeline_posts;
create trigger zz_kimetomo_first_post_mark before insert on public.kimetomo_timeline_posts
  for each row execute function public.kimetomo_first_post_mark();

-- 4. 管理人のベルで知らせる（押すとその投稿が開く。js/app.js の ref_id 'first:'）
create or replace function public.kimetomo_bell_on_first_post()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if not new.first_post or new.women_only then return new; end if;
  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  select p.user_id, 'admin_notice', new.author_id, 'first:' || new.id::text,
         case when new.body = '📷' then '' else left(coalesce(new.body, ''), 80) end,
         '🔰 ' || public.kimetomo_bell_name(new.author_id) || 'さんがはじめて投稿しました。反応してあげよう',
         './?post=' || new.id::text
  from public.circle_profiles p
  where p.is_admin and p.user_id <> new.author_id
    and not public.kimetomo_bell_blocked(p.user_id, new.author_id);
  return new;
end $$;
-- 2026-11-27：管理人へのベル（とプッシュ）は止めた（ユーザーの決定）。🔰 の印は今まで通りつく。
--   もう一度鳴らすときは、下の drop の後に次の2行を戻す：
--   create trigger kimetomo_bell_first_post after insert on public.kimetomo_timeline_posts
--     for each row execute function public.kimetomo_bell_on_first_post();
drop trigger if exists kimetomo_bell_first_post on public.kimetomo_timeline_posts;

-- 5. 投稿を直すときも、印は変えられないようにする（supabase/post_edit_expire.sql の続き）
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
  new.women_only := old.women_only;
  new.anonymous := old.anonymous;
  new.quote_post_id := old.quote_post_id;
  new.first_post := old.first_post;
  if new.body is distinct from old.body then
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  return new;
end;
$$;
