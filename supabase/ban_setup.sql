-- キメ友SNS: 管理者だけが使える BAN（利用停止）機能
-- BAN されたメンバーは、チャット・個人チャット・タイムライン・画像を
-- 読むことも書くこともできなくなる（データベース側で止める）。

create table if not exists public.kimetomo_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  banned_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.kimetomo_bans enable row level security;
-- 直接の読み書きは不可（下の関数からだけ操作する）

-- 自分（または指定した人）が BAN されているか
create or replace function public.kimetomo_is_banned(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.kimetomo_bans where user_id = uid);
$$;

-- 呼び出した人が承認済みの管理者か
create or replace function public.kimetomo_caller_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.circle_profiles
    where user_id = auth.uid() and is_admin and status = 'approved'
  );
$$;

-- 管理者用：メンバー一覧（BAN 状態つき）
create or replace function public.kimetomo_admin_members()
returns table (user_id uuid, display_name text, is_admin boolean, banned boolean, reason text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.kimetomo_caller_is_admin() then
    raise exception '管理者だけが使えます';
  end if;
  return query
    select p.user_id, p.display_name, p.is_admin, (b.user_id is not null), b.reason
    from public.circle_profiles p
    left join public.kimetomo_bans b on b.user_id = p.user_id
    where p.status = 'approved' or b.user_id is not null
    order by (b.user_id is not null) desc, p.display_name;
end $$;

-- 管理者用：BAN する
create or replace function public.kimetomo_admin_ban(p_user uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.kimetomo_caller_is_admin() then
    raise exception '管理者だけが使えます';
  end if;
  if p_user = auth.uid() then
    raise exception '自分自身は BAN できません';
  end if;
  if exists (select 1 from public.circle_profiles where user_id = p_user and is_admin) then
    raise exception '管理者は BAN できません';
  end if;

  insert into public.kimetomo_bans (user_id, banned_by, reason)
  values (p_user, auth.uid(), nullif(trim(coalesce(p_reason, '')), ''))
  on conflict (user_id) do update set banned_by = excluded.banned_by, reason = excluded.reason, created_at = now();

  update public.circle_profiles set status = 'rejected' where user_id = p_user;
  delete from public.kimetomo_push_subscriptions where user_id = p_user;

  -- ログイン状態を解除（失敗しても BAN 自体は有効）
  begin
    delete from auth.sessions where user_id = p_user;
  exception when others then null;
  end;
end $$;

-- 管理者用：BAN を解除する
create or replace function public.kimetomo_admin_unban(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.kimetomo_caller_is_admin() then
    raise exception '管理者だけが使えます';
  end if;
  delete from public.kimetomo_bans where user_id = p_user;
  update public.circle_profiles set status = 'approved' where user_id = p_user;
end $$;

revoke all on function public.kimetomo_admin_members() from public, anon;
revoke all on function public.kimetomo_admin_ban(uuid, text) from public, anon;
revoke all on function public.kimetomo_admin_unban(uuid) from public, anon;
grant execute on function public.kimetomo_admin_members() to authenticated;
grant execute on function public.kimetomo_admin_ban(uuid, text) to authenticated;
grant execute on function public.kimetomo_admin_unban(uuid) to authenticated;

-- BAN されたメンバーを、各機能から締め出す（既存のルールに「追加で」かかる制限）
do $$
declare
  t text;
begin
  foreach t in array array[
    'circle_messages', 'circle_media', 'circle_rooms', 'circle_room_members',
    'kimetomo_direct_conversations', 'kimetomo_direct_messages',
    'kimetomo_timeline_posts', 'kimetomo_timeline_comments',
    'kimetomo_timeline_likes', 'kimetomo_timeline_reactions'
  ] loop
    execute format('drop policy if exists "kimetomo not banned" on public.%I', t);
    execute format(
      'create policy "kimetomo not banned" on public.%I as restrictive for all to authenticated
         using (not public.kimetomo_is_banned()) with check (not public.kimetomo_is_banned())', t);
  end loop;
end $$;

-- 画像（チャットの画像）も同様
drop policy if exists "kimetomo not banned media" on storage.objects;
create policy "kimetomo not banned media" on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'circle-private-media' or not public.kimetomo_is_banned())
  with check (bucket_id <> 'circle-private-media' or not public.kimetomo_is_banned());
