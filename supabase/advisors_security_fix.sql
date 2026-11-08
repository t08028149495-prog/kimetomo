-- Supabase Advisors（安全）の点検 2026-11-09
--
-- 直したもの
--   function_search_path_mutable：通報理由の表示名を返す関数の search_path を固定する。
--   （中身は文字の置き換えだけで、表を読まないので '' で動く）
alter function public.kimetomo_report_reason_label(text) set search_path = '';

-- 直さず、そのままにしたもの（理由）
--   rls_enabled_no_policy（13件・INFO）
--     RLS がオンでルールが無い＝外からは誰も読めない・書けない「鍵のかかった表」。
--     中身は特別な権限の関数からだけ使う設計なので、これが正しい状態。
--   anon_security_definer_function_executable（8件）
--     ログイン前の画面で必要なもの：招待コードの確認（check_invite / invite_status）、
--     新規登録の空き状況（public_signup）、ユーザー名が使われているか（username_exists）、
--     なりすまし名の確認（imp_name_ok）、順番待ちの登録（waitlist_join）。
--     mfa_ok / pre_request は毎回のアクセスで 2段階認証を確かめる仕組みで、ログイン前の人にも必要。
--   authenticated_security_definer_function_executable（97件）
--     アプリから呼ぶ関数と、ルール（RLS）の中で使う確認用の関数。
--     管理者用の関数はすべて中で管理者かどうかを確かめている（admin_update_request は kimetomo_req_admin）。
--     他人の情報を返しうる関数（women_badges・wroom_probation_left など）も、会員本人に限る・本人分だけに限る条件が入っている。
