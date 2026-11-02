-- キメ友SNS: 通知に出る名前を「プロフィールで設定した表示名」に合わせる
-- （プロフィール画面で名前を変えると、通知にも新しい名前が出るようにする）
create or replace function public.kimetomo_bell_name(uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select nullif(display_name, '') from public.kimetomo_user_profiles where user_id = uid),
    (select nullif(display_name, '') from public.circle_profiles where user_id = uid),
    '友達'
  );
$$;
