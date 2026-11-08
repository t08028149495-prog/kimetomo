-- キメ友SNS: 「ロック画面に名前を出さない」通知設定（2026-11-09）
-- discreet = true の人には、プッシュ通知を「お知らせ／新しいお知らせがあります」だけで送る。
-- 送信係（Edge Function send-push）が送る前にこの列を見る。アプリ内のベルはそのまま。

alter table public.kimetomo_push_prefs
  add column if not exists discreet boolean not null default false;

create or replace function public.kimetomo_set_push_discreet(p_on boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  insert into public.kimetomo_push_prefs (user_id, discreet, updated_at)
  values (me, coalesce(p_on, false), now())
  on conflict (user_id) do update set discreet = excluded.discreet, updated_at = now();
  return coalesce(p_on, false);
end $$;

revoke all on function public.kimetomo_set_push_discreet(boolean) from public, anon;
grant execute on function public.kimetomo_set_push_discreet(boolean) to authenticated;
