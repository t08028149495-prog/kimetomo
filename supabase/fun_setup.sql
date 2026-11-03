-- キメ友SNS: 歓迎投稿 と 今日の気分ステータス

-- ========== 1. 新しいメンバーの歓迎投稿 ==========
-- 新しいメンバーが登録すると、タイムラインに歓迎の投稿が自動で入る。
-- 投稿者は管理者（BAN 解除のときは投稿しない）。
create or replace function public.kimetomo_welcome_post()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  poster uuid;
begin
  if new.status = 'approved'
     and (tg_op = 'INSERT' or old.status = 'pending') then
    poster := (select user_id from public.circle_profiles
               where is_admin and status = 'approved' and user_id <> new.user_id
               order by user_id limit 1);
    if poster is not null then
      perform public.kimetomo_insert_post_as(poster,
        '🎉 ' || coalesce(nullif(new.display_name, ''), '新しいメンバー') ||
        'さんが仲間入りしました！' || chr(10) || 'みんなでコメントして歓迎しよう👋');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists kimetomo_welcome_post on public.circle_profiles;
create trigger kimetomo_welcome_post after insert or update of status on public.circle_profiles
  for each row execute function public.kimetomo_welcome_post();

-- ========== 2. 今日の気分ステータス ==========
-- 1 人 1 つ。24 時間たつと表示されなくなる。
create table if not exists public.kimetomo_moods (
  user_id uuid primary key references auth.users(id) on delete cascade,
  emoji text not null,
  label text not null check (char_length(label) between 1 and 20),
  updated_at timestamptz not null default now()
);
alter table public.kimetomo_moods enable row level security;

create or replace function public.kimetomo_mood_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.circle_profiles where user_id = auth.uid() and status = 'approved');
$$;

drop policy if exists "mood read" on public.kimetomo_moods;
drop policy if exists "mood insert own" on public.kimetomo_moods;
drop policy if exists "mood update own" on public.kimetomo_moods;
drop policy if exists "mood delete own" on public.kimetomo_moods;
create policy "mood read" on public.kimetomo_moods
  for select to authenticated using (public.kimetomo_mood_member());
create policy "mood insert own" on public.kimetomo_moods
  for insert to authenticated with check (user_id = auth.uid() and public.kimetomo_mood_member());
create policy "mood update own" on public.kimetomo_moods
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.kimetomo_mood_member());
create policy "mood delete own" on public.kimetomo_moods
  for delete to authenticated using (user_id = auth.uid());

do $$
begin
  if to_regprocedure('public.kimetomo_is_banned(uuid)') is not null then
    execute 'drop policy if exists "kimetomo not banned" on public.kimetomo_moods';
    execute 'create policy "kimetomo not banned" on public.kimetomo_moods as restrictive for all to authenticated using (not public.kimetomo_is_banned()) with check (not public.kimetomo_is_banned())';
  end if;
end $$;
