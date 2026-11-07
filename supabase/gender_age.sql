-- キメ友SNS: プロフィールに「性別」と「年齢」を追加する（どちらも任意）
--   ・性別：選択しない／♂／♀（♂・♀を選んだ人は、投稿やチャットなどで名前の横に表示）
--   ・年齢：選択しない／18〜25／26〜30／31〜37／38〜43／44〜50／それ以上（プロフィールにだけ表示）
-- 何度実行しても大丈夫です。

alter table public.kimetomo_user_profiles add column if not exists gender text;
alter table public.kimetomo_user_profiles add column if not exists age_range text;
alter table public.kimetomo_user_profiles drop constraint if exists kimetomo_user_profiles_gender_check;
alter table public.kimetomo_user_profiles add constraint kimetomo_user_profiles_gender_check
  check (gender is null or gender in ('male', 'female'));
alter table public.kimetomo_user_profiles drop constraint if exists kimetomo_user_profiles_age_range_check;
alter table public.kimetomo_user_profiles add constraint kimetomo_user_profiles_age_range_check
  check (age_range is null or age_range in ('18-25', '26-30', '31-37', '38-43', '44-50', '51+'));

notify pgrst, 'reload schema';

select 'OK：性別と年齢を選べるようにしました' as 結果;
