-- キメ友SNS: 🌷 女性だけに見せる投稿
--   ・投稿するときに選ぶと、「女性だけの部屋」のメンバーにだけ見える投稿になる
--     （部屋に入っている管理者は見える。入っていない人は、管理者でも見えない）
--   ・投稿できるのも、部屋のメンバーだけ。画像付きにはできない
--   ・コメント・リアクション・アンケートも、見える人だけが読める・付けられる
--   ・あとから「女性だけ」を外したり付けたりはできない（編集で変わらない）
-- women_room.sql・post_edit_expire.sql のあとに実行します。何度実行しても大丈夫です。

alter table public.kimetomo_timeline_posts add column if not exists women_only boolean not null default false;

-- 自分が女性だけの部屋のメンバーか
create or replace function public.kimetomo_women_member()
returns boolean language sql stable security definer set search_path to 'public'
as $$ select coalesce(public.circle_in_room(public.kimetomo_women_room_id(), auth.uid()), false) $$;

-- この投稿を自分が見てよいか
create or replace function public.kimetomo_post_visible(p_post uuid)
returns boolean language sql stable security definer set search_path to 'public'
as $$
  select not exists (select 1 from public.kimetomo_timeline_posts p where p.id = p_post and p.women_only)
         or public.kimetomo_women_member();
$$;

revoke all on function public.kimetomo_women_member() from public, anon;
grant execute on function public.kimetomo_women_member() to authenticated;
revoke all on function public.kimetomo_post_visible(uuid) from public, anon;
grant execute on function public.kimetomo_post_visible(uuid) to authenticated;

-- 投稿：見えるのは部屋のメンバーだけ。投稿できるのも部屋のメンバーだけ（画像なし）
drop policy if exists "kimetomo women post visible" on public.kimetomo_timeline_posts;
create policy "kimetomo women post visible" on public.kimetomo_timeline_posts
  as restrictive for select to authenticated
  using (not women_only or (select public.kimetomo_women_member()));

drop policy if exists "kimetomo women post insert" on public.kimetomo_timeline_posts;
create policy "kimetomo women post insert" on public.kimetomo_timeline_posts
  as restrictive for insert to authenticated
  with check (not women_only or ((select public.kimetomo_women_member()) and image_path is null));

-- コメント・リアクション・いいね・アンケート・投票・コメント通知も、投稿が見える人だけ
do $$
declare t text;
begin
  foreach t in array array['kimetomo_timeline_comments', 'kimetomo_timeline_reactions', 'kimetomo_timeline_likes',
                           'kimetomo_timeline_polls', 'kimetomo_timeline_poll_votes', 'kimetomo_comment_notifications'] loop
    execute format('drop policy if exists "kimetomo women post only" on public.%I', t);
    execute format('create policy "kimetomo women post only" on public.%I as restrictive for all to authenticated
                    using (public.kimetomo_post_visible(post_id)) with check (public.kimetomo_post_visible(post_id))', t);
  end loop;
end $$;

-- 編集しても「女性だけ」は変わらない（post_edit_expire.sql の決まりに足す）
create or replace function public.kimetomo_post_edit_guard()
returns trigger language plpgsql
set search_path to 'public'
as $$
begin
  new.id := old.id;
  new.author_id := old.author_id;
  new.created_at := old.created_at;
  new.image_path := old.image_path;
  new.comments_off := old.comments_off;
  new.expires_at := old.expires_at;
  new.women_only := old.women_only;
  if new.body is distinct from old.body then
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';

select 'OK：🌷 女性だけに見せる投稿を使えるようにしました' as 結果;
