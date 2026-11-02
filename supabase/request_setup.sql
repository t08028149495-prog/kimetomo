-- キメ友SNS: 機能リクエスト（匿名）
--   ・メンバーは匿名でほしい機能をリクエストできる
--   ・ほかの人のリクエストに「👍 わたしもほしい」を押せる
--   ・管理者は状態とひとことコメントを付けられる
--   ・新しいリクエストは管理者に、完成したらリクエストした人と👍した人に通知
-- 何度実行しても大丈夫です。

create table if not exists public.kimetomo_feature_requests (
  id bigint generated always as identity primary key,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 40),
  body text not null default '' check (char_length(body) <= 300),
  status text not null default 'new' check (status in ('new', 'thinking', 'making', 'done', 'declined')),
  admin_reply text not null default '' check (char_length(admin_reply) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kimetomo_request_votes (
  request_id bigint not null references public.kimetomo_feature_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

-- 表は直接読ませない（匿名を守るため、下の関数からだけ使う）
alter table public.kimetomo_feature_requests enable row level security;
alter table public.kimetomo_request_votes enable row level security;
revoke all on public.kimetomo_feature_requests from anon, authenticated;
revoke all on public.kimetomo_request_votes from anon, authenticated;

create or replace function public.kimetomo_req_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.circle_profiles where user_id = auth.uid() and status = 'approved');
$$;

create or replace function public.kimetomo_req_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.circle_profiles where user_id = auth.uid() and status = 'approved' and is_admin);
$$;

-- 一覧（だれが出したかは返さない。自分のものかどうかだけ返す）
create or replace function public.kimetomo_list_requests()
returns table (
  id bigint, title text, body text, status text, admin_reply text,
  created_at timestamptz, votes bigint, my_vote boolean, is_mine boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.kimetomo_req_member() then raise exception 'メンバーだけが使えます'; end if;
  return query
    select r.id, r.title, r.body, r.status, r.admin_reply, r.created_at,
           (select count(*) from public.kimetomo_request_votes v where v.request_id = r.id),
           exists (select 1 from public.kimetomo_request_votes v where v.request_id = r.id and v.user_id = auth.uid()),
           r.author_id = auth.uid()
    from public.kimetomo_feature_requests r
    order by (r.status in ('done', 'declined')), 7 desc, r.created_at desc;
end $$;

-- 新しいリクエスト（1 日 5 件まで）
create or replace function public.kimetomo_create_request(p_title text, p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  new_id bigint;
begin
  if not public.kimetomo_req_member() then raise exception 'メンバーだけが使えます'; end if;
  if (select count(*) from public.kimetomo_feature_requests
      where author_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'リクエストは1日5件までです。また明日お願いします';
  end if;
  insert into public.kimetomo_feature_requests (author_id, title, body)
  values (auth.uid(), trim(p_title), trim(coalesce(p_body, '')))
  returning id into new_id;

  -- 管理者に知らせる（名前は出さない）
  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  select p.user_id, 'request_new', null, new_id::text, left(trim(p_title), 80),
         '💡 新しい機能リクエストが届きました：' || left(trim(p_title), 30), './?tab=profile&requests=1'
  from public.circle_profiles p
  where p.is_admin and p.status = 'approved' and p.user_id <> auth.uid();

  return new_id;
end $$;

-- 👍 を付ける／外す
create or replace function public.kimetomo_toggle_request_vote(p_request bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.kimetomo_req_member() then raise exception 'メンバーだけが使えます'; end if;
  if exists (select 1 from public.kimetomo_request_votes where request_id = p_request and user_id = auth.uid()) then
    delete from public.kimetomo_request_votes where request_id = p_request and user_id = auth.uid();
  else
    insert into public.kimetomo_request_votes (request_id, user_id) values (p_request, auth.uid());
  end if;
end $$;

-- 自分のリクエストを消す（管理者はどれでも消せる）
create or replace function public.kimetomo_delete_request(p_request bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.kimetomo_feature_requests
  where id = p_request and (author_id = auth.uid() or public.kimetomo_req_admin());
end $$;

-- 管理者：状態とコメントを更新。完成にしたら関係者に通知
create or replace function public.kimetomo_admin_update_request(p_request bigint, p_status text, p_reply text)
returns void language plpgsql security definer set search_path = public as $$
declare
  old_status text;
  req_title text;
begin
  if not public.kimetomo_req_admin() then raise exception '管理者だけが使えます'; end if;
  select status, title into old_status, req_title from public.kimetomo_feature_requests where id = p_request;
  if old_status is null then raise exception 'リクエストが見つかりません'; end if;

  update public.kimetomo_feature_requests
  set status = p_status, admin_reply = left(trim(coalesce(p_reply, '')), 200), updated_at = now()
  where id = p_request;

  if p_status = 'done' and old_status <> 'done' then
    insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
    select distinct u.user_id, 'request_done', null, p_request::text, left(req_title, 80),
           '✅ リクエストした機能が完成しました：' || left(req_title, 30), './?tab=profile&requests=1'
    from (
      select author_id as user_id from public.kimetomo_feature_requests where id = p_request
      union
      select user_id from public.kimetomo_request_votes where request_id = p_request
    ) u
    where u.user_id <> auth.uid();
  end if;
end $$;

revoke all on function public.kimetomo_list_requests() from public, anon;
revoke all on function public.kimetomo_create_request(text, text) from public, anon;
revoke all on function public.kimetomo_toggle_request_vote(bigint) from public, anon;
revoke all on function public.kimetomo_delete_request(bigint) from public, anon;
revoke all on function public.kimetomo_admin_update_request(bigint, text, text) from public, anon;
grant execute on function public.kimetomo_list_requests() to authenticated;
grant execute on function public.kimetomo_create_request(text, text) to authenticated;
grant execute on function public.kimetomo_toggle_request_vote(bigint) to authenticated;
grant execute on function public.kimetomo_delete_request(bigint) to authenticated;
grant execute on function public.kimetomo_admin_update_request(bigint, text, text) to authenticated;

-- ベル通知の種類に「リクエスト」を追加
alter table public.kimetomo_bell_notifications drop constraint if exists kimetomo_bell_notifications_kind_check;
alter table public.kimetomo_bell_notifications add constraint kimetomo_bell_notifications_kind_check
  check (kind in ('chat', 'dm', 'comment', 'reply', 'request_new', 'request_done'));
