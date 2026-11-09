-- 🌷 女性だけの部屋：AIの確認で、どの点が合わなかったかを記録する（2026-11-09）
--   ・写真・AIの返事の文章は今までどおり保存しない。残すのは5つの○×と自信の度合いだけ
--     { pose_matches, live_photo, single_person, appears_female, confidence }
--   ・落ちた理由を管理者（Claude）が調べられるようにするため。画面からは読めない
-- women_room_ai.sql のあとに実行します。何度実行しても大丈夫です。

alter table public.kimetomo_wroom_ai_tries add column if not exists checks jsonb;

-- Edge Function 用：AIの○×を記録（結果を記録する前に呼ぶ）
create or replace function public.kimetomo_wroom_ai_note(p_id bigint, p_checks jsonb)
returns void language plpgsql security definer set search_path to 'public'
as $$
begin
  update public.kimetomo_wroom_ai_tries
     set checks = jsonb_build_object(
       'pose_matches',   (p_checks->>'pose_matches')::boolean,
       'live_photo',     (p_checks->>'live_photo')::boolean,
       'single_person',  (p_checks->>'single_person')::boolean,
       'appears_female', (p_checks->>'appears_female')::boolean,
       'confidence',     case when p_checks->>'confidence' in ('low', 'medium', 'high') then p_checks->>'confidence' end)
   where id = p_id and used_at is not null and result is null;
end $$;
revoke all on function public.kimetomo_wroom_ai_note(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.kimetomo_wroom_ai_note(bigint, jsonb) to service_role;

notify pgrst, 'reload schema';

select 'OK：AIの確認の○×を記録するようにしました' as 結果;
