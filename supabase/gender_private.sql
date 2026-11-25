-- 性別を「表示しない」にした人の性別を、ほかのメンバーの端末に送らない（2026-11-25）
-- これまで：kimetomo_user_profiles の gender は、承認済みメンバーなら誰の分でも読めた（画面で隠していただけ）
-- これから：
--   ① 性別は関数 kimetomo_profile_tags で受け取る。隠している人の性別は、本人以外には空（null）で返す
--   ② 表から直接は gender・ever_male・gender_changed_at を読めなくする（ほかの列は今まで通り読める）
-- 画面側：js/app.js（kmWithGender）・js/gender-age.js・dm.html が①を使う。関数が無いときは前の読み方に戻る
-- 書き込み（プロフィールの保存・安心の設定）は今まで通り。ever_male と gender_changed_at はトリガーが決める

-- ① 名前の横の印・プロフィールで使う項目だけを返す関数
create or replace function public.kimetomo_profile_tags(p_ids uuid[])
returns table(user_id uuid, gender text, gender_hidden boolean, age_range text, prefecture text)
language sql stable security definer set search_path = public as $$
  select p.user_id,
         case when p.gender_hidden and p.user_id is distinct from auth.uid() then null else p.gender end,
         p.gender_hidden, p.age_range, p.prefecture
  from public.kimetomo_user_profiles p
  where p.user_id = any(p_ids[1:200])
    and public.kimetomo_mfa_ok()
    and (public.kimetomo_is_approved(auth.uid())
         or exists (select 1 from public.circle_profiles c where c.user_id = auth.uid() and c.status = 'approved'));
$$;
revoke all on function public.kimetomo_profile_tags(uuid[]) from public, anon;
grant execute on function public.kimetomo_profile_tags(uuid[]) to authenticated;

-- ② 表から直接読める列を決める（gender・ever_male・gender_changed_at は外す）
revoke select on public.kimetomo_user_profiles from anon, authenticated;
grant select (user_id, display_name, bio, avatar_path, updated_at, age_range, dm_policy, gender_hidden, women_badge, prefecture)
  on public.kimetomo_user_profiles to authenticated;

-- 元に戻すとき：
-- grant select on public.kimetomo_user_profiles to authenticated;
