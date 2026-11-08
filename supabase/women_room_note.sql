-- キメ友SNS: 🌷 女性だけの部屋の「固定メッセージ」
--   ・部屋のいちばん上に、管理者が書いたメッセージを固定して出す
--   ・読めるのは部屋のメンバーだけ（部屋の情報は、もともとメンバーにしか見えない）
--   ・書きかえ・消すのは管理者だけ（空にすると消える）
-- women_room.sql のあとに実行します。何度実行しても大丈夫です。

alter table public.circle_rooms add column if not exists pinned_note text;
alter table public.circle_rooms drop constraint if exists circle_rooms_pinned_note_check;
alter table public.circle_rooms add constraint circle_rooms_pinned_note_check
  check (pinned_note is null or char_length(pinned_note) <= 800);

create or replace function public.kimetomo_admin_set_women_room_note(p_note text)
returns void language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.kimetomo_caller_is_admin() then raise exception '管理者だけが使えます'; end if;
  if char_length(coalesce(p_note, '')) > 800 then raise exception '固定メッセージは800文字までです'; end if;
  update public.circle_rooms set pinned_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = public.kimetomo_women_room_id();
end $$;
revoke all on function public.kimetomo_admin_set_women_room_note(text) from public, anon;
grant execute on function public.kimetomo_admin_set_women_room_note(text) to authenticated;

notify pgrst, 'reload schema';

select 'OK：女性だけの部屋に固定メッセージを出せるようにしました' as 結果;
