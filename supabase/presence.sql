-- 🟢 ログイン中の印（管理者だけが見られる）
-- アプリを画面に出している間、2 分ごとに「今いるよ」を記録する（kimetomo_presence_ping）。
-- 画面を隠した・ログアウトしたときは away=true にする。
-- 管理者だけが kimetomo_admin_presence で読める。テーブルは誰も直接読めない（ポリシーなし）。
-- 「ログイン中」= away でなく、最後の記録が 4 分以内。

create table if not exists public.kimetomo_presence(
  user_id uuid primary key references auth.users(id) on delete cascade,
  seen_at timestamptz not null default now(),
  away boolean not null default false
);
alter table public.kimetomo_presence enable row level security;
revoke all on public.kimetomo_presence from anon, authenticated;

create or replace function public.kimetomo_presence_ping(p_away boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if not exists (select 1 from public.circle_profiles where user_id = auth.uid() and status = 'approved') then return; end if;
  insert into public.kimetomo_presence(user_id, seen_at, away) values (auth.uid(), now(), coalesce(p_away, false))
  on conflict (user_id) do update set seen_at = now(), away = excluded.away
  -- 書き込みを減らす：状態が変わったとき・前の記録から 50 秒以上たったときだけ
  where public.kimetomo_presence.away <> excluded.away
     or public.kimetomo_presence.seen_at < now() - interval '50 seconds';
end $$;

create or replace function public.kimetomo_admin_presence(p_ids uuid[])
returns table(user_id uuid, online boolean, seen_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  return query
    select p.user_id, (not p.away and p.seen_at > now() - interval '4 minutes'), p.seen_at
    from public.kimetomo_presence p
    where p.user_id = any((p_ids)[1:200]);
end $$;

revoke execute on function public.kimetomo_presence_ping(boolean) from public, anon;
revoke execute on function public.kimetomo_admin_presence(uuid[]) from public, anon;
grant execute on function public.kimetomo_presence_ping(boolean) to authenticated;
grant execute on function public.kimetomo_admin_presence(uuid[]) to authenticated;
