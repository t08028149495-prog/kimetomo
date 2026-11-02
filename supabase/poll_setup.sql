-- キメ友SNS: タイムラインのアンケート投稿
-- 投稿 1 件にアンケートを 1 つ付けられる（選択肢は 2〜4 個）。
-- 投票は 1 人 1 票。あとから選び直したり、取り消したりできる。

do $$
declare
  post_id_type text;
begin
  -- 投稿の id と同じ型で作る
  select format_type(a.atttypid, a.atttypmod) into post_id_type
  from pg_attribute a
  where a.attrelid = 'public.kimetomo_timeline_posts'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists public.kimetomo_timeline_polls (
      post_id %s primary key references public.kimetomo_timeline_posts(id) on delete cascade,
      options text[] not null check (array_length(options, 1) between 2 and 4),
      created_at timestamptz not null default now()
    )$f$, post_id_type);

  execute format($f$
    create table if not exists public.kimetomo_timeline_poll_votes (
      post_id %s not null references public.kimetomo_timeline_polls(post_id) on delete cascade,
      user_id uuid not null references auth.users(id) on delete cascade,
      option_index smallint not null check (option_index between 0 and 3),
      created_at timestamptz not null default now(),
      primary key (post_id, user_id)
    )$f$, post_id_type);
end $$;

alter table public.kimetomo_timeline_polls enable row level security;
alter table public.kimetomo_timeline_poll_votes enable row level security;

-- 承認済みメンバーか
create or replace function public.kimetomo_poll_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.circle_profiles where user_id = auth.uid() and status = 'approved');
$$;

drop policy if exists "poll read" on public.kimetomo_timeline_polls;
drop policy if exists "poll create by author" on public.kimetomo_timeline_polls;
create policy "poll read" on public.kimetomo_timeline_polls
  for select to authenticated using (public.kimetomo_poll_member());
create policy "poll create by author" on public.kimetomo_timeline_polls
  for insert to authenticated with check (
    public.kimetomo_poll_member()
    and exists (select 1 from public.kimetomo_timeline_posts p where p.id = post_id and p.author_id = auth.uid())
  );

drop policy if exists "vote read" on public.kimetomo_timeline_poll_votes;
drop policy if exists "vote insert own" on public.kimetomo_timeline_poll_votes;
drop policy if exists "vote update own" on public.kimetomo_timeline_poll_votes;
drop policy if exists "vote delete own" on public.kimetomo_timeline_poll_votes;
create policy "vote read" on public.kimetomo_timeline_poll_votes
  for select to authenticated using (public.kimetomo_poll_member());
create policy "vote insert own" on public.kimetomo_timeline_poll_votes
  for insert to authenticated with check (user_id = auth.uid() and public.kimetomo_poll_member());
create policy "vote update own" on public.kimetomo_timeline_poll_votes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.kimetomo_poll_member());
create policy "vote delete own" on public.kimetomo_timeline_poll_votes
  for delete to authenticated using (user_id = auth.uid());

-- 選択肢の数を超える番号には投票できない
create or replace function public.kimetomo_poll_vote_check()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  select array_length(options, 1) into n from public.kimetomo_timeline_polls where post_id = new.post_id;
  if n is null or new.option_index >= n then
    raise exception 'その選択肢はありません';
  end if;
  return new;
end $$;

drop trigger if exists kimetomo_poll_vote_check on public.kimetomo_timeline_poll_votes;
create trigger kimetomo_poll_vote_check before insert or update on public.kimetomo_timeline_poll_votes
  for each row execute function public.kimetomo_poll_vote_check();

-- BAN 機能を入れている場合は、BAN された人の投票も止める
do $$
begin
  if to_regprocedure('public.kimetomo_is_banned(uuid)') is not null then
    execute 'drop policy if exists "kimetomo not banned" on public.kimetomo_timeline_polls';
    execute 'create policy "kimetomo not banned" on public.kimetomo_timeline_polls as restrictive for all to authenticated using (not public.kimetomo_is_banned()) with check (not public.kimetomo_is_banned())';
    execute 'drop policy if exists "kimetomo not banned" on public.kimetomo_timeline_poll_votes';
    execute 'create policy "kimetomo not banned" on public.kimetomo_timeline_poll_votes as restrictive for all to authenticated using (not public.kimetomo_is_banned()) with check (not public.kimetomo_is_banned())';
  end if;
end $$;
