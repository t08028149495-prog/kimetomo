-- キメ友SNS: 🌷 女性だけの部屋に、管理者が条件なしでメンバーを追加する
--   ・登録日数・投稿回数・♀にしてからの日数の条件なしで、管理者がそのまま追加できる
--   ・ただし、プロフィールの性別が♀の人だけ（部屋の決まり：♀以外は入れない）
--   ・追加した人のベルに「参加できるようになりました」と届く
-- women_room.sql のあとに実行します。何度実行しても大丈夫です。

-- 管理者：名前でメンバーを探す
create or replace function public.kimetomo_admin_women_candidates(p_q text)
returns table(user_id uuid, name text, gender text, in_room boolean)
language plpgsql stable security definer set search_path to 'public'
as $$
declare q text := btrim(coalesce(p_q, ''));
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  if char_length(q) < 1 then return; end if;
  return query
  select u.user_id, coalesce(nullif(u.display_name, ''), 'メンバー'), u.gender,
         public.circle_in_room(public.kimetomo_women_room_id(), u.user_id)
  from public.kimetomo_user_profiles u
  join public.circle_profiles c on c.user_id = u.user_id and c.status = 'approved'
  where u.display_name ilike '%' || replace(replace(q, '%', ''), '_', '') || '%'
  order by (u.gender = 'female') desc nulls last, u.display_name
  limit 20;
end $$;

-- 管理者：条件なしで追加する
create or replace function public.kimetomo_admin_add_to_women_room(p_user uuid)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare r uuid := public.kimetomo_women_room_id();
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  if r is null then raise exception '部屋が見つかりません'; end if;
  if not exists (select 1 from public.circle_profiles where user_id = p_user and status = 'approved') then
    raise exception '承認済みのメンバーだけ追加できます';
  end if;
  if not exists (select 1 from public.kimetomo_user_profiles where user_id = p_user and gender = 'female') then
    raise exception 'プロフィールの性別が♀の人だけ追加できます（本人に♀を選んでもらってください）';
  end if;
  if public.circle_in_room(r, p_user) then raise exception 'もう参加しています'; end if;
  insert into public.circle_room_members (room_id, user_id) values (r, p_user) on conflict do nothing;
  -- 申請があれば「許可済み」にする（見送り済みの人も、管理者が追加したら参加できる）
  update public.kimetomo_room_requests set status = 'approved', decided_at = now(), decided_by = auth.uid()
   where room_id = r and user_id = p_user;
  insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
  values (p_user, 'admin_notice', auth.uid(), 'wroom_ok',
          'グループの画面で「🌷 女性だけの部屋」を選べるようになりました',
          '🌷 女性だけの部屋に参加できるようになりました', './?tab=chat&room=' || r::text);
end $$;

revoke all on function public.kimetomo_admin_women_candidates(text) from public, anon;
grant execute on function public.kimetomo_admin_women_candidates(text) to authenticated;
revoke all on function public.kimetomo_admin_add_to_women_room(uuid) from public, anon;
grant execute on function public.kimetomo_admin_add_to_women_room(uuid) to authenticated;

notify pgrst, 'reload schema';

select 'OK：管理者が女性だけの部屋にメンバーを追加できるようにしました' as 結果;
