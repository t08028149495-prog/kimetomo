-- キメ友SNS: タイムラインの画像投稿（管理者だけ）
--   ・画像付きの投稿ができるのは管理者だけ（データベース側で止める）
--   ・画像は非公開の保管場所に置き、承認済みメンバーだけが見られる
--   ・BAN されたメンバーは見られない
-- 何度実行しても大丈夫です。

-- 呼び出した人が承認済みの管理者か（他のSQLと同じ定義）
create or replace function public.kimetomo_caller_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.circle_profiles
    where user_id = auth.uid() and is_admin and status = 'approved'
  );
$$;

-- 呼び出した人が承認済みのメンバーで、BAN されていないか
create or replace function public.kimetomo_caller_is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.circle_profiles
    where user_id = auth.uid() and status = 'approved'
  ) and not exists (
    select 1 from public.kimetomo_bans where user_id = auth.uid()
  );
$$;
revoke all on function public.kimetomo_caller_is_member() from public, anon;
grant execute on function public.kimetomo_caller_is_member() to authenticated;

-- 投稿に画像の場所を入れる列
alter table public.kimetomo_timeline_posts add column if not exists image_path text;

-- 画像付きの投稿・画像の付け替えは管理者だけ（既存のルールに「追加で」かかる制限）
drop policy if exists "kimetomo image post admin only" on public.kimetomo_timeline_posts;
create policy "kimetomo image post admin only" on public.kimetomo_timeline_posts
  as restrictive for insert to authenticated
  with check (image_path is null or public.kimetomo_caller_is_admin());

drop policy if exists "kimetomo image post admin only update" on public.kimetomo_timeline_posts;
create policy "kimetomo image post admin only update" on public.kimetomo_timeline_posts
  as restrictive for update to authenticated
  using (true)
  with check (image_path is null or public.kimetomo_caller_is_admin());

-- 画像の保管場所（非公開・JPEGだけ・1枚3MBまで）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kimetomo-post-images', 'kimetomo-post-images', false, 3145728, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 画像を置けるのは管理者だけ
drop policy if exists "kimetomo post images admin upload" on storage.objects;
create policy "kimetomo post images admin upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'kimetomo-post-images' and public.kimetomo_caller_is_admin());

-- 画像を消せるのも管理者だけ
drop policy if exists "kimetomo post images admin delete" on storage.objects;
create policy "kimetomo post images admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'kimetomo-post-images' and public.kimetomo_caller_is_admin());

-- 画像を見られるのは承認済みメンバー（BAN された人は除く）
drop policy if exists "kimetomo post images members read" on storage.objects;
create policy "kimetomo post images members read" on storage.objects
  for select to authenticated
  using (bucket_id = 'kimetomo-post-images' and public.kimetomo_caller_is_member());
