-- キメ友SNS: 🌷 女性だけの部屋（グループチャット）
--   なりすまし対策：
--   ・参加は申請制。管理者が許可した人だけ入れる（管理者も、許可しただけでは部屋の中は見えない）
--   ・申請できる条件：性別が♀／登録から14日以上／投稿・コメントが合わせて3回以上／♀にしてから7日以上
--   ・性別を♀以外に変えると、自動で部屋から外れる
--   ・どんな方法でも、♀でない人は部屋のメンバーに入れない（データベースで止める）
--   ・部屋の中から「あやしい人」を管理者に知らせられる。管理者は部屋から外せる
-- 何度実行しても大丈夫です。

-- 部屋の印と、部屋そのもの
alter table public.circle_rooms add column if not exists women_only boolean not null default false;
insert into public.circle_rooms (name, women_only)
select '🌷 女性だけの部屋', true
where not exists (select 1 from public.circle_rooms where women_only);

create or replace function public.kimetomo_women_room_id()
returns uuid language sql stable security definer set search_path to 'public'
as $$ select id from public.circle_rooms where women_only order by created_at, id limit 1 $$;

-- 性別を変えた時刻（本人が直接書き換えられないよう、トリガーで決める）
alter table public.kimetomo_user_profiles add column if not exists gender_changed_at timestamptz;

create or replace function public.kimetomo_gender_changed_stamp()
returns trigger language plpgsql set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    new.gender_changed_at := case when new.gender is not null then now() end;
  elsif new.gender is distinct from old.gender then
    new.gender_changed_at := now();
  else
    new.gender_changed_at := old.gender_changed_at;
  end if;
  return new;
end $$;
drop trigger if exists kimetomo_gender_changed_stamp on public.kimetomo_user_profiles;
create trigger kimetomo_gender_changed_stamp before insert or update on public.kimetomo_user_profiles
  for each row execute function public.kimetomo_gender_changed_stamp();

-- ♀以外に変えたら、女性だけの部屋から外す（申請中のものも取り消す）
create or replace function public.kimetomo_gender_left_women_room()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if old.gender = 'female' and new.gender is distinct from 'female' then
    delete from public.circle_room_members m using public.circle_rooms r
      where m.room_id = r.id and r.women_only and m.user_id = new.user_id;
    delete from public.kimetomo_room_requests q
      where q.user_id = new.user_id and q.status = 'pending';
  end if;
  return new;
end $$;

-- 申請と通報の表（どちらも、画面からは下の関数を通してだけ使う）
create table if not exists public.kimetomo_room_requests (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.circle_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text check (message is null or char_length(message) <= 200),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid,
  unique (room_id, user_id)
);
alter table public.kimetomo_room_requests enable row level security;

create table if not exists public.kimetomo_room_reports (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.circle_rooms(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(btrim(reason)) between 1 and 300),
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);
alter table public.kimetomo_room_reports enable row level security;

drop trigger if exists kimetomo_gender_left_women_room on public.kimetomo_user_profiles;
create trigger kimetomo_gender_left_women_room after update of gender on public.kimetomo_user_profiles
  for each row execute function public.kimetomo_gender_left_women_room();

-- ♀でない人は、どんな方法でも女性だけの部屋のメンバーにできない
create or replace function public.kimetomo_women_room_guard()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if exists (select 1 from public.circle_rooms where id = new.room_id and women_only)
     and not exists (select 1 from public.kimetomo_user_profiles
                     where user_id = new.user_id and gender = 'female') then
    raise exception '女性だけの部屋には、性別が♀の人しか入れません';
  end if;
  return new;
end $$;
drop trigger if exists kimetomo_women_room_guard on public.circle_room_members;
create trigger kimetomo_women_room_guard before insert or update on public.circle_room_members
  for each row execute function public.kimetomo_women_room_guard();

-- 自分の状態（申請できるか・何が足りないか）
create or replace function public.kimetomo_women_room_status()
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
declare
  me uuid := auth.uid(); r uuid; g text; gc timestamptz; joined timestamptz; acts int; req text;
begin
  if me is null or not public.kimetomo_is_active_member() then return null; end if;
  r := public.kimetomo_women_room_id();
  if r is null then return null; end if;
  select gender, gender_changed_at into g, gc from public.kimetomo_user_profiles where user_id = me;
  select created_at into joined from auth.users where id = me;
  acts := (select count(*) from public.kimetomo_timeline_posts where author_id = me)
        + (select count(*) from public.kimetomo_timeline_comments where author_id = me);
  select status into req from public.kimetomo_room_requests where room_id = r and user_id = me;
  return jsonb_build_object(
    'room_id', r,
    'female', coalesce(g = 'female', false),
    'member', public.circle_in_room(r, me),
    'request', req,
    'days_left', greatest(0, ceil(extract(epoch from (joined + interval '14 days' - now())) / 86400))::int,
    'acts', acts,
    'acts_need', 3,
    'gender_days_left', case when gc is null then 0
                             else greatest(0, ceil(extract(epoch from (gc + interval '7 days' - now())) / 86400))::int end
  );
end $$;

-- 参加を申請する
create or replace function public.kimetomo_women_room_apply(p_message text)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  me uuid := auth.uid(); s jsonb := public.kimetomo_women_room_status(); r uuid; msg text := nullif(btrim(coalesce(p_message, '')), '');
  old_status text;
begin
  if s is null then raise exception 'いまは申請できません'; end if;
  r := (s ->> 'room_id')::uuid;
  if not (s ->> 'female')::boolean then raise exception 'プロフィールの性別が♀の人だけ申請できます'; end if;
  if (s ->> 'member')::boolean then raise exception 'もう参加しています'; end if;
  if (s ->> 'days_left')::int > 0 then raise exception '登録から14日たつと申請できます（あと%日）', s ->> 'days_left'; end if;
  if (s ->> 'acts')::int < 3 then raise exception '投稿・コメントが合わせて3回以上になると申請できます'; end if;
  if (s ->> 'gender_days_left')::int > 0 then raise exception '性別を♀にしてから7日たつと申請できます（あと%日）', s ->> 'gender_days_left'; end if;
  if msg is not null and char_length(msg) > 200 then raise exception 'ひとことは200文字までです'; end if;
  select status into old_status from public.kimetomo_room_requests where room_id = r and user_id = me;
  if old_status = 'pending' then raise exception 'もう申請しています。管理者の確認をお待ちください'; end if;
  if old_status = 'rejected' then raise exception '今回は参加を見送らせていただきました'; end if;
  insert into public.kimetomo_room_requests (room_id, user_id, message) values (r, me, msg)
  on conflict (room_id, user_id) do update set status = 'pending', message = excluded.message,
    created_at = now(), decided_at = null, decided_by = null;
  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  select p.user_id, 'admin_notice', me, 'wroom', left(coalesce(msg, '（ひとことなし）'), 80),
         '🌷 女性だけの部屋に参加申請が届きました', './?tab=admin'
  from public.circle_profiles p where p.is_admin and p.status = 'approved' and p.user_id <> me;
end $$;

-- 管理者：申請の一覧
create or replace function public.kimetomo_admin_room_requests()
returns table(id bigint, user_id uuid, name text, gender text, message text, status text,
              created_at timestamptz, joined_at timestamptz, posts bigint, comments bigint, gender_changed_at timestamptz)
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  return query
  select q.id, q.user_id,
         coalesce((select nullif(u.display_name, '') from public.kimetomo_user_profiles u where u.user_id = q.user_id), 'メンバー'),
         (select u.gender from public.kimetomo_user_profiles u where u.user_id = q.user_id),
         q.message, q.status, q.created_at,
         (select a.created_at from auth.users a where a.id = q.user_id),
         (select count(*) from public.kimetomo_timeline_posts t where t.author_id = q.user_id),
         (select count(*) from public.kimetomo_timeline_comments c where c.author_id = q.user_id),
         (select u.gender_changed_at from public.kimetomo_user_profiles u where u.user_id = q.user_id)
  from public.kimetomo_room_requests q
  where q.status = 'pending' or q.decided_at > now() - interval '30 days'
  order by (q.status = 'pending') desc, q.created_at desc;
end $$;

-- 管理者：許可する／見送る
create or replace function public.kimetomo_admin_decide_room_request(p_id bigint, p_approve boolean)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare q public.kimetomo_room_requests;
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  select * into q from public.kimetomo_room_requests where id = p_id for update;
  if q.id is null then raise exception '申請が見つかりません'; end if;
  if p_approve then
    insert into public.circle_room_members (room_id, user_id) values (q.room_id, q.user_id) on conflict do nothing;
  end if;
  update public.kimetomo_room_requests
     set status = case when p_approve then 'approved' else 'rejected' end, decided_at = now(), decided_by = auth.uid()
   where id = p_id;
  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  values (q.user_id, 'admin_notice', auth.uid(), case when p_approve then 'wroom_ok' else 'wroom_ng' end,
          case when p_approve then 'グループの画面で「🌷 女性だけの部屋」を選べるようになりました'
               else '今回は参加を見送らせていただきました' end,
          case when p_approve then '🌷 女性だけの部屋に参加できるようになりました'
               else '🌷 女性だけの部屋への申請について' end,
          case when p_approve then './?tab=chat&room=' || q.room_id::text else './' end);
end $$;

-- 部屋の中から「あやしい人」を管理者に知らせる
create or replace function public.kimetomo_room_report(p_target uuid, p_reason text)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare me uuid := auth.uid(); r uuid := public.kimetomo_women_room_id(); why text := btrim(coalesce(p_reason, ''));
begin
  if me is null or r is null or not public.circle_in_room(r, me) then raise exception '部屋のメンバーだけが知らせられます'; end if;
  if p_target = me or not public.circle_in_room(r, p_target) then raise exception 'この人は選べません'; end if;
  if char_length(why) not between 1 and 300 then raise exception '理由を1〜300文字で書いてください'; end if;
  if (select count(*) from public.kimetomo_room_reports where reporter_id = me and created_at > now() - interval '1 day') >= 5 then
    raise exception '1日に知らせられるのは5回までです';
  end if;
  insert into public.kimetomo_room_reports (room_id, reporter_id, target_id, reason) values (r, me, p_target, why);
  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  select p.user_id, 'admin_notice', me, 'wroomflag', left(why, 80),
         '🚩 女性だけの部屋から知らせが届きました', './?tab=admin'
  from public.circle_profiles p where p.is_admin and p.status = 'approved' and p.user_id <> me;
end $$;

-- 管理者：知らせの一覧
create or replace function public.kimetomo_admin_room_reports()
returns table(id bigint, target_id uuid, target_name text, target_gender text, target_in_room boolean,
              reporter_name text, reason text, status text, created_at timestamptz)
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  return query
  select x.id, x.target_id,
         coalesce((select nullif(u.display_name, '') from public.kimetomo_user_profiles u where u.user_id = x.target_id), 'メンバー'),
         (select u.gender from public.kimetomo_user_profiles u where u.user_id = x.target_id),
         public.circle_in_room(x.room_id, x.target_id),
         coalesce((select nullif(u.display_name, '') from public.kimetomo_user_profiles u where u.user_id = x.reporter_id), 'メンバー'),
         x.reason, x.status, x.created_at
  from public.kimetomo_room_reports x
  where x.status = 'open' or x.created_at > now() - interval '30 days'
  order by (x.status = 'open') desc, x.created_at desc;
end $$;

-- 管理者：部屋のメンバー一覧
create or replace function public.kimetomo_admin_women_room_members()
returns table(user_id uuid, name text, gender text)
language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  return query
  select m.user_id,
         coalesce((select nullif(u.display_name, '') from public.kimetomo_user_profiles u where u.user_id = m.user_id), 'メンバー'),
         (select u.gender from public.kimetomo_user_profiles u where u.user_id = m.user_id)
  from public.circle_room_members m
  where m.room_id = public.kimetomo_women_room_id()
  order by 2;
end $$;

-- 管理者：部屋から外す（もう一度申請はできない）。その人への知らせは「対応済み」にする
create or replace function public.kimetomo_admin_room_kick(p_user uuid)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare r uuid := public.kimetomo_women_room_id();
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  delete from public.circle_room_members where room_id = r and user_id = p_user;
  update public.kimetomo_room_requests set status = 'rejected', decided_at = now(), decided_by = auth.uid()
   where room_id = r and user_id = p_user;
  update public.kimetomo_room_reports set status = 'done' where room_id = r and target_id = p_user and status = 'open';
end $$;

-- 管理者：知らせを「対応済み」にする（外さない場合）
create or replace function public.kimetomo_admin_room_report_done(p_id bigint)
returns void language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  update public.kimetomo_room_reports set status = 'done' where id = p_id;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'kimetomo_women_room_id()', 'kimetomo_women_room_status()', 'kimetomo_women_room_apply(text)',
    'kimetomo_admin_room_requests()', 'kimetomo_admin_decide_room_request(bigint, boolean)',
    'kimetomo_room_report(uuid, text)', 'kimetomo_admin_room_reports()', 'kimetomo_admin_women_room_members()',
    'kimetomo_admin_room_kick(uuid)', 'kimetomo_admin_room_report_done(bigint)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

notify pgrst, 'reload schema';

select 'OK：🌷 女性だけの部屋（申請制・通報つき）を作りました' as 結果;
