-- キメ友SNS: チャットで送った写真を消せるようにする
-- 送った本人と管理者だけが消せる（行と写真ファイルの両方）。
-- 画面では、先に circle_media の行を消してから、ファイルを消す。

grant delete on public.circle_media to authenticated;

drop policy if exists "circle_media_delete_own_or_admin" on public.circle_media;
create policy "circle_media_delete_own_or_admin" on public.circle_media
  for delete to authenticated using (
    sender_id = (select auth.uid()) or public.kimetomo_caller_is_admin()
  );

drop policy if exists "circle_private_media_delete_own_or_admin" on storage.objects;
create policy "circle_private_media_delete_own_or_admin" on storage.objects
  for delete to authenticated using (
    bucket_id = 'circle-private-media'
    and (split_part(name, '/', 2) = (select auth.uid())::text or public.kimetomo_caller_is_admin())
  );
