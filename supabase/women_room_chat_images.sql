-- キメ友SNS: 「女性だけの部屋」のチャットでだけ、写真を送れるようにする
-- ほかのチャットルームは、これまでどおり写真を送れない（disable_chat_images.sql の制限を置き換える）。
-- 写真はスマホの中で JPEG（3MB 以下）に縮めてから送る。
-- 部屋のメンバーかどうかは、もとからある circle_media_send / circle_private_media_insert の条件で確かめている。

drop policy if exists "kimetomo no new chat images" on public.circle_media;
drop policy if exists "kimetomo chat images women room only" on public.circle_media;
create policy "kimetomo chat images women room only" on public.circle_media
  as restrictive for insert to authenticated with check (
    room_id = public.kimetomo_women_room_id()
    and mime_type = 'image/jpeg'
    and file_size <= 3145728
  );

drop policy if exists "kimetomo no new chat image files" on storage.objects;
drop policy if exists "kimetomo chat image files women room only" on storage.objects;
create policy "kimetomo chat image files women room only" on storage.objects
  as restrictive for insert to authenticated with check (
    bucket_id <> 'circle-private-media'
    or (
      split_part(name, '/', 1) = public.kimetomo_women_room_id()::text
      and lower(storage.extension(name)) = 'jpg'
    )
  );
