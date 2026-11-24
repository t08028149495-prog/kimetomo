-- 🟢 管理者のログイン中の印：端末（タブ）ごとに記録する（2026-11-25）
-- 前は管理者ごとに 1 行だけだったので、スマホの画面を消すと PC で開いていても「離れた」になり、
-- 画面の移動（タイムライン → 個人チャット）でも一瞬「離れた」になっていた。
-- 端末ごとに 1 行にして、「どれか 1 つでも、離れていなくて 4 分以内に記録がある」ならログイン中にする。
-- 1 日以上記録のない端末の行は、ping のときに消す。

alter table public.kimetomo_presence add column if not exists device text not null default '';
alter table public.kimetomo_presence drop constraint if exists kimetomo_presence_pkey;
alter table public.kimetomo_presence add primary key (user_id, device);

-- 前の形（端末なし）は消す。古いアプリからの呼び出し（p_away だけ）は新しい形がそのまま受ける
drop function if exists public.kimetomo_presence_ping(boolean);

create or replace function public.kimetomo_presence_ping(p_away boolean default false, p_device text default '')
returns void language plpgsql security definer set search_path = public as $$
declare v_dev text := left(coalesce(p_device, ''), 40);
begin
  if auth.uid() is null then return; end if;
  -- 管理者だけ記録する
  if not exists (select 1 from public.circle_profiles where user_id = auth.uid() and status = 'approved' and is_admin) then return; end if;
  insert into public.kimetomo_presence(user_id, device, seen_at, away) values (auth.uid(), v_dev, now(), coalesce(p_away, false))
  on conflict (user_id, device) do update set seen_at = now(), away = excluded.away
  -- 書き込みを減らす：状態が変わったとき・前の記録から 50 秒以上たったときだけ
  where public.kimetomo_presence.away <> excluded.away
     or public.kimetomo_presence.seen_at < now() - interval '50 seconds';
  -- 使わなくなった端末の行を消す
  delete from public.kimetomo_presence where user_id = auth.uid() and seen_at < now() - interval '1 day';
end $$;

-- 承認済みのメンバーなら誰でも：管理者ごとに「今ログイン中か」だけを返す
create or replace function public.kimetomo_admin_online()
returns table(user_id uuid, online boolean)
language sql stable security definer set search_path = public as $$
  select c.user_id,
         exists (select 1 from public.kimetomo_presence p
                 where p.user_id = c.user_id and not p.away and p.seen_at > now() - interval '4 minutes')
  from public.circle_profiles c
  where c.is_admin and c.status = 'approved'
    and exists (select 1 from public.circle_profiles me where me.user_id = auth.uid() and me.status = 'approved');
$$;

revoke execute on function public.kimetomo_presence_ping(boolean, text) from public, anon;
revoke execute on function public.kimetomo_admin_online() from public, anon;
grant execute on function public.kimetomo_presence_ping(boolean, text) to authenticated;
grant execute on function public.kimetomo_admin_online() to authenticated;
