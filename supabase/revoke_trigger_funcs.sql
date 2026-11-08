-- キメ友SNS: 裏で自動で動く関数（トリガー用）を、外から呼べないようにする（2026-11-09）
-- トリガーは EXECUTE 権限がなくても動くので、アプリの動きは変わらない。
-- ログイン前に使う関数（招待コードの確認・新規登録・順番待ちなど）はそのまま。
revoke execute on function public.kimetomo_gender_left_women_room() from public, anon, authenticated;
revoke execute on function public.kimetomo_women_room_guard() from public, anon, authenticated;
revoke execute on function public.kimetomo_bell_on_women_post() from public, anon, authenticated;
revoke execute on function public.kimetomo_bell_on_anon_comment() from public, anon, authenticated;
revoke execute on function public.kimetomo_chat_photo_daily_guard() from public, anon, authenticated;
