-- 🟢 管理者のログイン中の印（管理者の写真にだけ丸を出し、メンバー全員が見られる）
-- 管理者がアプリを画面に出している間、2 分ごとに「今いるよ」を記録する（kimetomo_presence_ping）。
-- 画面を隠した・ログアウトしたときは away=true にする。管理者以外は記録しない。
-- メンバーは kimetomo_admin_online で「管理者が今ログイン中か」だけを読める（最後に開いた時刻は出さない）。
-- テーブルは誰も直接読めない（ポリシーなし）。
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
  -- 管理者だけ記録する
  if not exists (select 1 from public.circle_profiles where user_id = auth.uid() and status = 'approved' and is_admin) then return; end if;
  insert into public.kimetomo_presence(user_id, seen_at, away) values (auth.uid(), now(), coalesce(p_away, false))
  on conflict (user_id) do update set seen_at = now(), away = excluded.away
  -- 書き込みを減らす：状態が変わったとき・前の記録から 50 秒以上たったときだけ
  where public.kimetomo_presence.away <> excluded.away
     or public.kimetomo_presence.seen_at < now() - interval '50 seconds';
end $$;

-- 承認済みのメンバーなら誰でも：管理者ごとに「今ログイン中か」だけを返す
create or replace function public.kimetomo_admin_online()
returns table(user_id uuid, online boolean)
language sql stable security definer set search_path = public as $$
  select c.user_id, coalesce(not p.away and p.seen_at > now() - interval '4 minutes', false)
  from public.circle_profiles c
  left join public.kimetomo_presence p on p.user_id = c.user_id
  where c.is_admin and c.status = 'approved'
    and exists (select 1 from public.circle_profiles me where me.user_id = auth.uid() and me.status = 'approved');
$$;

-- 前の形（管理者が全員の状態を見る）は使わない
drop function if exists public.kimetomo_admin_presence(uuid[]);

revoke execute on function public.kimetomo_presence_ping(boolean) from public, anon;
revoke execute on function public.kimetomo_admin_online() from public, anon;
grant execute on function public.kimetomo_presence_ping(boolean) to authenticated;
grant execute on function public.kimetomo_admin_online() to authenticated;
