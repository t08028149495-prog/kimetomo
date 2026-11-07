-- キメ友SNS: タイムラインの一番上に、管理者のお知らせを 3 日間だけ固定する
--   ・管理者メニューの「📌 お知らせの固定」から書く・外す
--   ・保存した時刻から 3 日たつと、自動で表示されなくなる
-- 先に request_pause.sql と support_setup.sql を実行しておくこと。何度実行しても大丈夫です。

create or replace function public.kimetomo_admin_set_setting(p_key text, p_value text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.circle_profiles where user_id = auth.uid() and is_admin and status = 'approved') then
    raise exception '管理者だけが使えます';
  end if;
  if p_key not in ('requests_open', 'support_paypay_url', 'pinned_notice') then raise exception 'この設定は変更できません'; end if;
  -- PayPay のリンク以外は保存しない
  if p_key = 'support_paypay_url' and coalesce(p_value, '') <> ''
     and p_value !~ '^https://([a-z0-9-]+\.)*paypay\.ne\.jp/' then
    raise exception 'PayPayのリンク（https://…paypay.ne.jp/…）を入れてください';
  end if;
  if p_key = 'pinned_notice' and char_length(coalesce(p_value, '')) > 300 then
    raise exception 'お知らせは300文字までにしてください';
  end if;
  insert into public.kimetomo_app_settings (key, value, updated_at) values (p_key, coalesce(p_value, ''), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;
revoke all on function public.kimetomo_admin_set_setting(text, text) from public, anon;
grant execute on function public.kimetomo_admin_set_setting(text, text) to authenticated;

select 'OK：お知らせを固定できるようにしました' as 結果;
