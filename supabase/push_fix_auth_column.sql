-- キメ友SNS: プッシュ通知が登録できない不具合の修正（2026-11-09 本番に実行済み）
--   本番の表の列名が auth_secret になっていて、アプリ（push.js）と送信の仕組み（send-push）が使う auth と合わず、
--   通知をオンにしても保存に失敗していた。列名を auth にそろえる。
-- 何度実行しても大丈夫です。

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'kimetomo_push_subscriptions' and column_name = 'auth_secret')
     and not exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'kimetomo_push_subscriptions' and column_name = 'auth') then
    alter table public.kimetomo_push_subscriptions rename column auth_secret to auth;
  end if;
end $$;
