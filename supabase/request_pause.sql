-- キメ友SNS: 機能リクエストの受付を「お休み」にできるようにする
--   ・受付の開始／お休みは、管理者が画面のボタンで切り替えられる
--   ・お休み中も、これまでのリクエストを見る・👍🤔を押すことはできる
-- このSQLを実行すると、受付は「お休み」になります。何度実行しても大丈夫です。

create table if not exists public.kimetomo_app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.kimetomo_app_settings enable row level security;
drop policy if exists "settings read" on public.kimetomo_app_settings;
create policy "settings read" on public.kimetomo_app_settings for select to authenticated using (true);
revoke insert, update, delete on public.kimetomo_app_settings from anon, authenticated;

insert into public.kimetomo_app_settings (key, value) values ('requests_open', 'false')
on conflict (key) do update set value = 'false', updated_at = now();

create or replace function public.kimetomo_setting(p_key text, p_default text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.kimetomo_app_settings where key = p_key), p_default);
$$;

create or replace function public.kimetomo_admin_set_setting(p_key text, p_value text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.circle_profiles where user_id = auth.uid() and is_admin and status = 'approved') then
    raise exception '管理者だけが使えます';
  end if;
  if p_key not in ('requests_open') then raise exception 'この設定は変更できません'; end if;
  insert into public.kimetomo_app_settings (key, value, updated_at) values (p_key, p_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;
revoke all on function public.kimetomo_admin_set_setting(text, text) from public, anon;
grant execute on function public.kimetomo_admin_set_setting(text, text) to authenticated;

-- お休み中は新しいリクエストを受け付けない
create or replace function public.kimetomo_create_request(p_title text, p_body text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  new_id bigint;
begin
  if not public.kimetomo_req_member() then raise exception 'メンバーだけが使えます'; end if;
  if public.kimetomo_setting('requests_open', 'true') <> 'true' then
    raise exception '機能リクエストの受付は、今お休みしています';
  end if;
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
