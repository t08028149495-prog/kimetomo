-- キメ友SNS: 管理者メニューの追加機能
--   A. 管理者は、どの投稿・コメントでも削除できる
--   C. のぞう（自動投稿）を画面から操作する
--   D. 今日の様子（数字のまとめ）
-- 先に mascot_setup.sql をもう一度実行しておくこと。何度実行しても大丈夫です。

create or replace function public.kimetomo_caller_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.circle_profiles
    where user_id = auth.uid() and is_admin and status = 'approved'
  );
$$;

-- ========== A. 管理者による削除 ==========
drop policy if exists "kimetomo admin delete post" on public.kimetomo_timeline_posts;
create policy "kimetomo admin delete post" on public.kimetomo_timeline_posts
  for delete to authenticated using (public.kimetomo_caller_is_admin());

drop policy if exists "kimetomo admin delete comment" on public.kimetomo_timeline_comments;
create policy "kimetomo admin delete comment" on public.kimetomo_timeline_comments
  for delete to authenticated using (public.kimetomo_caller_is_admin());

-- ========== D. 今日の様子 ==========
create or replace function public.kimetomo_admin_stats()
returns table (members bigint, posts_today bigint, chats_today bigint, comments_today bigint,
               new_members_week bigint, open_requests bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  day_start timestamptz := date_trunc('day', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo';
  req bigint := null;
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  if to_regclass('public.kimetomo_feature_requests') is not null then
    execute $q$select count(*) from public.kimetomo_feature_requests where status in ('new', 'thinking', 'making')$q$ into req;
  end if;
  return query select
    (select count(*) from public.circle_profiles where status = 'approved'),
    (select count(*) from public.kimetomo_timeline_posts where created_at >= day_start),
    (select count(*) from public.circle_messages where created_at >= day_start),
    (select count(*) from public.kimetomo_timeline_comments where created_at >= day_start),
    (select count(*) from auth.users u join public.circle_profiles p on p.user_id = u.id
      where u.created_at >= now() - interval '7 days' and p.status = 'approved'),
    req;
end $$;

-- ========== C. のぞうの操作 ==========
create or replace function public.kimetomo_mascot_id()
returns uuid language sql stable security definer set search_path = public as $$
  select u.id from auth.users u
  where u.raw_user_meta_data->>'username' = public.kimetomo_mascot_setting('mascot_username', 'キメ友のぞう')
  limit 1;
$$;

create or replace function public.kimetomo_admin_mascot_status()
returns table (enabled text, has_account boolean, last_post_at timestamptz, recent jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  m uuid := public.kimetomo_mascot_id();
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  return query select
    public.kimetomo_mascot_setting('enabled', 'true'),
    m is not null,
    (select max(p.created_at) from public.kimetomo_timeline_posts p where p.author_id = m),
    coalesce((select jsonb_agg(jsonb_build_object('created_at', x.created_at, 'body', x.body) order by x.created_at desc)
              from (select p.created_at, p.body from public.kimetomo_timeline_posts p
                    where p.author_id = m order by p.created_at desc limit 5) x), '[]'::jsonb);
end $$;

create or replace function public.kimetomo_admin_mascot_set(p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  insert into public.kimetomo_mascot_settings (key, value) values ('enabled', case when p_enabled then 'true' else 'false' end)
  on conflict (key) do update set value = excluded.value;
end $$;

create or replace function public.kimetomo_admin_mascot_post_now()
returns text language plpgsql security definer set search_path = public as $$
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  return public.kimetomo_mascot_tick(true);
end $$;

revoke all on function public.kimetomo_admin_stats() from public, anon;
revoke all on function public.kimetomo_admin_mascot_status() from public, anon;
revoke all on function public.kimetomo_admin_mascot_set(boolean) from public, anon;
revoke all on function public.kimetomo_admin_mascot_post_now() from public, anon;
grant execute on function public.kimetomo_admin_stats() to authenticated;
grant execute on function public.kimetomo_admin_mascot_status() to authenticated;
grant execute on function public.kimetomo_admin_mascot_set(boolean) to authenticated;
grant execute on function public.kimetomo_admin_mascot_post_now() to authenticated;
