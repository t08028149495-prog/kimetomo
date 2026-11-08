-- キメ友SNS: 機能リクエストに「🤔 いらないかも」を追加する
--   ・1人が「👍 ほしい」か「🤔 いらないかも」のどちらか 1 つを選べる
--   ・もう一度押すと取り消し、反対側を押すと切り替わる
--   ・だれが押したかは管理者にも分からない
-- 何度実行しても大丈夫です。

alter table public.kimetomo_request_votes add column if not exists vote smallint not null default 1;
alter table public.kimetomo_request_votes drop constraint if exists kimetomo_request_votes_vote_check;
alter table public.kimetomo_request_votes add constraint kimetomo_request_votes_vote_check check (vote in (1, -1));

drop function if exists public.kimetomo_list_requests();
create function public.kimetomo_list_requests()
returns table (
  id bigint, title text, body text, status text, admin_reply text,
  created_at timestamptz, ups bigint, downs bigint, my_vote smallint, is_mine boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.kimetomo_req_member() then raise exception 'メンバーだけが使えます'; end if;
  return query
    select r.id, r.title, r.body, r.status, r.admin_reply, r.created_at,
           (select count(*) from public.kimetomo_request_votes v where v.request_id = r.id and v.vote = 1),
           (select count(*) from public.kimetomo_request_votes v where v.request_id = r.id and v.vote = -1),
           coalesce((select v.vote from public.kimetomo_request_votes v where v.request_id = r.id and v.user_id = auth.uid()), 0::smallint),
           r.author_id = auth.uid()
    from public.kimetomo_feature_requests r
    order by (r.status in ('done', 'declined')),
             (select coalesce(sum(v.vote), 0) from public.kimetomo_request_votes v where v.request_id = r.id) desc,
             r.created_at desc;
end $$;

create or replace function public.kimetomo_vote_request(p_request bigint, p_vote smallint)
returns void language plpgsql security definer set search_path = public as $$
declare
  cur smallint;
begin
  if not public.kimetomo_req_member() then raise exception 'メンバーだけが使えます'; end if;
  if p_vote not in (1, -1) then raise exception '選び方が正しくありません'; end if;
  select vote into cur from public.kimetomo_request_votes where request_id = p_request and user_id = auth.uid();
  if cur = p_vote then
    delete from public.kimetomo_request_votes where request_id = p_request and user_id = auth.uid();
  elsif cur is not null then
    update public.kimetomo_request_votes set vote = p_vote, created_at = now() where request_id = p_request and user_id = auth.uid();
  else
    insert into public.kimetomo_request_votes (request_id, user_id, vote) values (p_request, auth.uid(), p_vote);
  end if;
end $$;

-- 完成のお知らせは「ほしい」を押した人とリクエストした人だけに送る
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
    select distinct u.user_id, 'request_done', null::uuid, p_request::text, left(req_title, 80),
           '✅ リクエストした機能が完成しました：' || left(req_title, 30), './?tab=profile&requests=1'
    from (
      select author_id as user_id from public.kimetomo_feature_requests where id = p_request
      union
      select user_id from public.kimetomo_request_votes where request_id = p_request and vote = 1
    ) u
    where u.user_id <> auth.uid();
  end if;
end $$;

revoke all on function public.kimetomo_list_requests() from public, anon;
revoke all on function public.kimetomo_vote_request(bigint, smallint) from public, anon;
grant execute on function public.kimetomo_list_requests() to authenticated;
grant execute on function public.kimetomo_vote_request(bigint, smallint) to authenticated;
