-- キメ友SNS: Push通知の購読情報を保存する表
create table if not exists public.kimetomo_push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.kimetomo_push_subscriptions enable row level security;

drop policy if exists "push own select" on public.kimetomo_push_subscriptions;
drop policy if exists "push own insert" on public.kimetomo_push_subscriptions;
drop policy if exists "push own update" on public.kimetomo_push_subscriptions;
drop policy if exists "push own delete" on public.kimetomo_push_subscriptions;

create policy "push own select" on public.kimetomo_push_subscriptions
  for select to authenticated using (auth.uid() = user_id);
create policy "push own insert" on public.kimetomo_push_subscriptions
  for insert to authenticated with check (auth.uid() = user_id);
create policy "push own update" on public.kimetomo_push_subscriptions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "push own delete" on public.kimetomo_push_subscriptions
  for delete to authenticated using (auth.uid() = user_id);
