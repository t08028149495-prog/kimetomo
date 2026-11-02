-- キメ友SNS: チャットへの画像送信を廃止する
-- 新しい画像は誰も送れなくなる（これまでに送られた画像はそのまま見られる）。

drop policy if exists "kimetomo no new chat images" on public.circle_media;
create policy "kimetomo no new chat images" on public.circle_media
  as restrictive for insert to authenticated with check (false);

drop policy if exists "kimetomo no new chat image files" on storage.objects;
create policy "kimetomo no new chat image files" on storage.objects
  as restrictive for insert to authenticated with check (bucket_id <> 'circle-private-media');
