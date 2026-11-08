-- キメ友SNS: 🌷 女性だけの場所をもっと使いやすく（3つ）
--   1. 名前を出さずに相談できる（匿名の相談）
--      ・女性だけの部屋のメンバーだけが使える。女性だけに見せる投稿になる
--      ・投稿者の名前の代わりに「🌷 匿名の相談」と出る（入れ物として、マスコットのアカウントを使う）
--      ・相談した本人は、自分の相談に名前を出さずにコメントできる（「🌷 相談した人」と出る）
--      ・誰が書いたかは、管理者だけが分かる
--   2. 女性だけに見せる投稿なら、部屋のメンバーも写真を付けられる
--      ・写真の投稿のお知らせは、みんなには送らない
--   3. 女性だけの新しい投稿を、部屋のメンバーのベルで知らせる（読むまで1件にまとめる）
--      ・匿名の相談にコメントがついたら、相談した本人のベルに知らせる
-- women_posts.sql のあとに実行します。何度実行しても大丈夫です。

alter table public.kimetomo_timeline_posts add column if not exists anonymous boolean not null default false;

-- 誰が書いたかの記録（画面からは読めない。下の関数だけが使う）
create table if not exists public.kimetomo_anon_owners (
  kind text not null check (kind in ('post', 'comment')),
  ref_id uuid not null,
  real_author uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (kind, ref_id)
);
alter table public.kimetomo_anon_owners enable row level security;

-- 名前を隠すための入れ物（マスコットのアカウント）
create or replace function public.kimetomo_anon_carrier()
returns uuid language sql stable security definer set search_path to 'public'
as $$
  select u.id from auth.users u
  where u.raw_user_meta_data->>'username' = public.kimetomo_mascot_setting('mascot_username', 'キメ友のぞう')
  limit 1
$$;

-- 画面用：入れ物のID（部屋のメンバーだけ）
create or replace function public.kimetomo_anon_carrier_id()
returns uuid language sql stable security definer set search_path to 'public'
as $$ select case when public.kimetomo_is_active_member() then public.kimetomo_anon_carrier() end $$;

-- 編集しても「匿名」は変わらない
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
  new.anonymous := old.anonymous;
  if new.body is distinct from old.body then
    new.edited_at := now();
  else
    new.edited_at := old.edited_at;
  end if;
  return new;
end;
$$;

-- ふつうの投稿で「匿名」は付けられない（匿名は下の関数からだけ）
drop policy if exists "kimetomo anon post via rpc" on public.kimetomo_timeline_posts;
create policy "kimetomo anon post via rpc" on public.kimetomo_timeline_posts
  as restrictive for insert to authenticated
  with check (not anonymous);

-- この処理の中だけ、ログイン中の人を入れ替える（kimetomo_insert_post_as と同じしくみ）。
-- 戻すときは、入れ替える前の情報をそのまま戻す
create or replace function public.kimetomo_act_as(p_user uuid)
returns text[] language plpgsql set search_path to 'public'
as $$
declare saved text[] := array[current_setting('request.jwt.claim.sub', true), current_setting('request.jwt.claim.role', true), current_setting('request.jwt.claims', true)];
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  return saved;
end $$;
create or replace function public.kimetomo_act_restore(p_saved text[])
returns void language plpgsql set search_path to 'public'
as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_saved[1], ''), true);
  perform set_config('request.jwt.claim.role', coalesce(p_saved[2], ''), true);
  perform set_config('request.jwt.claims', coalesce(p_saved[3], ''), true);
end $$;
revoke all on function public.kimetomo_act_as(uuid) from public, anon, authenticated;
revoke all on function public.kimetomo_act_restore(text[]) from public, anon, authenticated;

-- 1. 匿名で相談する
create or replace function public.kimetomo_anon_post(p_body text)
returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare me uuid := auth.uid(); carrier uuid := public.kimetomo_anon_carrier(); v_id uuid := gen_random_uuid(); b text := btrim(coalesce(p_body, '')); saved text[];
begin
  if me is null or not public.kimetomo_is_active_member() or public.kimetomo_is_banned() then raise exception 'いまは投稿できません'; end if;
  if not public.kimetomo_women_member() then raise exception '女性だけの部屋のメンバーだけが使えます'; end if;
  if carrier is null then raise exception 'いまは匿名の相談が使えません（管理者に知らせてください）'; end if;
  if char_length(b) not between 1 and 1000 then raise exception '本文は1〜1000文字で書いてください'; end if;
  if (select count(*) from public.kimetomo_anon_owners where real_author = me and kind = 'post' and created_at > now() - interval '10 minutes') >= 3 then
    raise exception '匿名の相談は10分に3回までです';
  end if;
  insert into public.kimetomo_anon_owners (kind, ref_id, real_author) values ('post', v_id, me);
  -- 投稿の「本人確認」は入れ物として通す（マスコットの投稿と同じやり方）。終わったら元に戻す
  saved := public.kimetomo_act_as(carrier);
  begin
    insert into public.kimetomo_timeline_posts (id, author_id, body, women_only, anonymous) values (v_id, carrier, b, true, true);
  exception when others then perform public.kimetomo_act_restore(saved); raise;
  end;
  perform public.kimetomo_act_restore(saved);
  return v_id;
end $$;

-- 1. 自分の匿名の相談に、名前を出さずにコメントする
create or replace function public.kimetomo_anon_comment(p_post uuid, p_parent uuid, p_body text)
returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare me uuid := auth.uid(); carrier uuid := public.kimetomo_anon_carrier(); v_id uuid := gen_random_uuid(); b text := btrim(coalesce(p_body, '')); saved text[];
begin
  if me is null or public.kimetomo_is_banned() then raise exception 'いまはコメントできません'; end if;
  if not exists (select 1 from public.kimetomo_anon_owners where kind = 'post' and ref_id = p_post and real_author = me) then
    raise exception '自分の匿名の相談にだけ使えます';
  end if;
  if char_length(b) not between 1 and 500 then raise exception 'コメントは1〜500文字で書いてください'; end if;
  if (select count(*) from public.kimetomo_anon_owners where real_author = me and kind = 'comment' and created_at > now() - interval '5 minutes') >= 15 then
    raise exception '少し時間をおいてからコメントしてください';
  end if;
  insert into public.kimetomo_anon_owners (kind, ref_id, real_author) values ('comment', v_id, me);
  saved := public.kimetomo_act_as(carrier);
  begin
    insert into public.kimetomo_timeline_comments (id, post_id, parent_id, author_id, body) values (v_id, p_post, p_parent, carrier, b);
  exception when others then perform public.kimetomo_act_restore(saved); raise;
  end;
  perform public.kimetomo_act_restore(saved);
  -- ふつうの返信通知は入れ物の名前で届いてしまうので、言いかえる
  update public.kimetomo_bell_notifications
     set kind = 'admin_notice', actor_id = null, ref_id = 'wcom:' || p_post::text, push_text = '🌷 相談した人が返信しました'
   where actor_id = carrier and created_at = now();
  return v_id;
end $$;

-- 1. 自分が書いた匿名の投稿・コメントはどれか（画面で「削除」を出すため）
create or replace function public.kimetomo_anon_mine(p_ids uuid[])
returns table(kind text, ref_id uuid) language sql stable security definer set search_path to 'public'
as $$ select o.kind, o.ref_id from public.kimetomo_anon_owners o where o.real_author = auth.uid() and o.ref_id = any (p_ids) $$;

-- 1. 自分の匿名の投稿・コメントを消す
create or replace function public.kimetomo_anon_delete(p_kind text, p_id uuid)
returns void language plpgsql security definer set search_path to 'public'
as $$
begin
  if not exists (select 1 from public.kimetomo_anon_owners where kind = p_kind and ref_id = p_id and real_author = auth.uid()) then
    raise exception '自分が書いたものだけ消せます';
  end if;
  if p_kind = 'post' then delete from public.kimetomo_timeline_posts where id = p_id;
  else delete from public.kimetomo_timeline_comments where id = p_id; end if;
  delete from public.kimetomo_anon_owners where kind = p_kind and ref_id = p_id;
  -- 消えたコメントの記録も片付ける（投稿を消すと、コメントもいっしょに消えるため）
  delete from public.kimetomo_anon_owners o where o.kind = 'comment'
     and not exists (select 1 from public.kimetomo_timeline_comments c where c.id = o.ref_id);
end $$;

-- 1. 管理者だけ：誰が書いたか
create or replace function public.kimetomo_admin_anon_authors(p_ids uuid[])
returns table(kind text, ref_id uuid, user_id uuid, name text) language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  return query
  select o.kind, o.ref_id, o.real_author,
         coalesce((select nullif(u.display_name, '') from public.kimetomo_user_profiles u where u.user_id = o.real_author), 'メンバー')
  from public.kimetomo_anon_owners o where o.ref_id = any (p_ids);
end $$;

-- 2. 写真：女性だけに見せる投稿なら、部屋のメンバーも付けられる
drop policy if exists "kimetomo image post admin only" on public.kimetomo_timeline_posts;
create policy "kimetomo image post admin only" on public.kimetomo_timeline_posts
  as restrictive for insert to authenticated
  with check (image_path is null or public.kimetomo_caller_is_admin() or (women_only and public.kimetomo_women_member()));
drop policy if exists "kimetomo image post admin only update" on public.kimetomo_timeline_posts;
create policy "kimetomo image post admin only update" on public.kimetomo_timeline_posts
  as restrictive for update to authenticated
  using (true)
  with check (image_path is null or public.kimetomo_caller_is_admin() or (women_only and public.kimetomo_women_member()));
drop policy if exists "kimetomo women post insert" on public.kimetomo_timeline_posts;
create policy "kimetomo women post insert" on public.kimetomo_timeline_posts
  as restrictive for insert to authenticated
  with check (not women_only or (select public.kimetomo_women_member()));

drop policy if exists "kimetomo post images women upload" on storage.objects;
create policy "kimetomo post images women upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'kimetomo-post-images' and public.kimetomo_women_member()
              and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "kimetomo post images own delete" on storage.objects;
create policy "kimetomo post images own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'kimetomo-post-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- 2. 写真の投稿のお知らせ：女性だけの投稿は、みんなには送らない
create or replace function public.kimetomo_bell_on_image_post()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.image_path is null or new.women_only then return new; end if;
  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  select p.user_id, 'image_post', new.author_id, new.id::text,
         case when new.body = '📷' then '' else left(coalesce(new.body, ''), 80) end,
         public.kimetomo_bell_name(new.author_id) || 'さんが画像を投稿しました',
         './?post=' || new.id::text
  from public.circle_profiles p
  where p.status = 'approved' and p.user_id <> new.author_id
    and not public.kimetomo_is_banned(p.user_id)
    and not public.kimetomo_bell_blocked(p.user_id, new.author_id);
  return new;
end $$;

-- 3. 女性だけの新しい投稿を、部屋のメンバーのベルで知らせる（読むまで1件）
create or replace function public.kimetomo_bell_on_women_post()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare real uuid; who uuid;
begin
  if not new.women_only then return new; end if;
  if new.anonymous then select o.real_author into real from public.kimetomo_anon_owners o where o.kind = 'post' and o.ref_id = new.id; end if;
  who := coalesce(real, new.author_id);
  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  select m.user_id, 'admin_notice', case when new.anonymous then null else new.author_id end, 'wpost:' || new.id::text,
         case when new.body = '📷' then '' else left(coalesce(new.body, ''), 80) end,
         case when new.anonymous then '🌷 匿名の相談が届きました'
              when new.image_path is not null then '🌷 ' || public.kimetomo_bell_name(new.author_id) || 'さんが女性だけの写真を投稿しました'
              else '🌷 ' || public.kimetomo_bell_name(new.author_id) || 'さんが女性だけの投稿をしました' end,
         './?post=' || new.id::text
  from public.circle_room_members m
  where m.room_id = public.kimetomo_women_room_id()
    and m.user_id <> new.author_id and m.user_id <> who
    and not public.kimetomo_bell_blocked(m.user_id, who)
    and not exists (select 1 from public.kimetomo_bell_notifications b
                    where b.recipient_id = m.user_id and b.kind = 'admin_notice'
                      and b.ref_id like 'wpost:%' and b.read_at is null);
  return new;
end $$;
drop trigger if exists kimetomo_bell_women_post on public.kimetomo_timeline_posts;
create trigger kimetomo_bell_women_post after insert on public.kimetomo_timeline_posts
  for each row execute function public.kimetomo_bell_on_women_post();

-- 3. 匿名の相談にコメントがついたら、相談した本人に知らせる
create or replace function public.kimetomo_bell_on_anon_comment()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare real uuid;
begin
  if not exists (select 1 from public.kimetomo_timeline_posts p where p.id = new.post_id and p.anonymous) then return new; end if;
  select o.real_author into real from public.kimetomo_anon_owners o where o.kind = 'post' and o.ref_id = new.post_id;
  if real is null or new.author_id = real or new.author_id = public.kimetomo_anon_carrier()
     or public.kimetomo_bell_blocked(real, new.author_id) then return new; end if;
  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  values (real, 'admin_notice', new.author_id, 'wcom:' || new.post_id::text, left(coalesce(new.body, ''), 80),
          '🌷 あなたの匿名の相談にコメントがつきました', './?post=' || new.post_id::text);
  return new;
end $$;
drop trigger if exists kimetomo_bell_anon_comment on public.kimetomo_timeline_comments;
create trigger kimetomo_bell_anon_comment after insert on public.kimetomo_timeline_comments
  for each row execute function public.kimetomo_bell_on_anon_comment();

do $$
declare f text;
begin
  foreach f in array array[
    'kimetomo_anon_carrier()', 'kimetomo_anon_carrier_id()', 'kimetomo_anon_post(text)', 'kimetomo_anon_comment(uuid, uuid, text)',
    'kimetomo_anon_mine(uuid[])', 'kimetomo_anon_delete(text, uuid)', 'kimetomo_admin_anon_authors(uuid[])'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- 入れ物のIDそのものは、関数の中だけで使う
  revoke execute on function public.kimetomo_anon_carrier() from authenticated;
end $$;

notify pgrst, 'reload schema';

select 'OK：匿名の相談・女性だけの写真・女性だけの投稿のお知らせを使えるようにしました' as 結果;
