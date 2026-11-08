-- キメ友SNS: プッシュ通知を種類ごとにオン／オフできるようにする
-- off_kinds に入っている種類は、プッシュ通知を送らない（ベルのお知らせはそのまま出る）。
-- 送信係（Edge Function send-push）が送る前にこの表を見る。

create table if not exists public.kimetomo_push_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  off_kinds text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.kimetomo_push_prefs enable row level security;

-- 自分の設定だけ読める（書き込みは下の関数から）
drop policy if exists "push prefs: read own" on public.kimetomo_push_prefs;
create policy "push prefs: read own" on public.kimetomo_push_prefs
  for select to authenticated using (user_id = auth.uid());

-- 自分の「通知しない種類」を保存する。知らない種類は捨てる
create or replace function public.kimetomo_set_push_off(p_kinds text[])
returns text[] language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  kinds text[];
begin
  if me is null then raise exception 'not signed in'; end if;
  select coalesce(array_agg(distinct k order by k), '{}') into kinds
    from unnest(coalesce(p_kinds, '{}')) as k
   where k in ('chat', 'dm', 'image_post', 'comment', 'reply', 'reaction',
               'request_new', 'request_done', 'admin_notice');
  insert into public.kimetomo_push_prefs (user_id, off_kinds, updated_at)
  values (me, kinds, now())
  on conflict (user_id) do update set off_kinds = excluded.off_kinds, updated_at = now();
  return kinds;
end $$;

revoke all on function public.kimetomo_set_push_off(text[]) from public, anon;
grant execute on function public.kimetomo_set_push_off(text[]) to authenticated;
