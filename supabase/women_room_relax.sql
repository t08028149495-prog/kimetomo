-- キメ友SNS: 🌷 女性だけの部屋の「申請できる条件」をゆるめる
--   登録から 14日 → 3日／投稿・コメント 3回 → 1回／性別を♀にしてから 7日 → 2日
--   （申請はすべて管理者が確認して許可するので、自動の条件は軽めにする）
-- women_room.sql・women_room_admin.sql のあとに実行します。何度実行しても大丈夫です。

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
    'admin', public.kimetomo_caller_is_admin(),
    'female', coalesce(g = 'female', false),
    'member', public.circle_in_room(r, me),
    'request', req,
    'days_need', 3,
    'days_left', greatest(0, ceil(extract(epoch from (joined + interval '3 days' - now())) / 86400))::int,
    'acts', acts,
    'acts_need', 1,
    'gender_days_need', 2,
    'gender_days_left', case when gc is null then 0
                             else greatest(0, ceil(extract(epoch from (gc + interval '2 days' - now())) / 86400))::int end
  );
end $$;

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
  if (s ->> 'days_left')::int > 0 then raise exception '登録から3日たつと申請できます（あと%日）', s ->> 'days_left'; end if;
  if (s ->> 'acts')::int < 1 then raise exception '投稿かコメントを1回以上すると申請できます'; end if;
  if (s ->> 'gender_days_left')::int > 0 then raise exception '性別を♀にしてから2日たつと申請できます（あと%日）', s ->> 'gender_days_left'; end if;
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

notify pgrst, 'reload schema';

select 'OK：申請できる条件を、登録3日・投稿コメント1回・♀にして2日にしました' as 結果;
