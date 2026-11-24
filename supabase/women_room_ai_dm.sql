-- 🌷 女性トークルームに「AIの確認ですぐ入れる」状態になった人へ、管理者から自動でDM（個人チャット）で案内する
--  ・入れるかどうかは kimetomo_wroom_ai_check(人) = 'ok'（AIの入口の条件をそのまま使う）
--  ・1人に1回だけ（kimetomo_wroom_ai_dm_sent に記録）。AIをもう試した人・申請したことがある人には送らない
--  ・送り主はいちばん古い管理者。相手が管理者をブロックしていたら送らない
--  ・10分ごと（9〜21時だけ）に、1回5人まで送る
--  ・止めるとき：insert into public.kimetomo_app_settings (key, value) values ('wroom_ai_dm', 'off')
--               on conflict (key) do update set value = 'off', updated_at = now();
--  ・何人に送られるかだけ見る：select public.kimetomo_wroom_ai_dm_tick(true);

create table if not exists public.kimetomo_wroom_ai_dm_sent (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now(),
  error text
);
alter table public.kimetomo_wroom_ai_dm_sent enable row level security;
revoke all on public.kimetomo_wroom_ai_dm_sent from public, anon, authenticated;

create or replace function public.kimetomo_wroom_ai_dm_tick(p_dry boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare
  admin uuid;
  r uuid := public.kimetomo_women_room_id();
  t record;
  conv uuid;
  n int := 0;
  h int := extract(hour from now() at time zone 'Asia/Tokyo');
  old_sub text := current_setting('request.jwt.claim.sub', true);
  old_claims text := current_setting('request.jwt.claims', true);
  old_role text := current_setting('request.jwt.claim.role', true);
  msg text := '🌷 女性トークルームのご案内' || E'\n\n'
    || 'キメ友には、確認された女性だけが入れるグループチャット「女性トークルーム」があります。あなたは今、入れる条件を満たしています。' || E'\n\n'
    || 'プロフィールを開くと、いちばん上に「🌷 女性だけの部屋に入る」ボタンがあります。AIでその場の写真を確認すると、すぐに入れます（写真はキメ友に保存されません）。' || E'\n'
    || 'https://kimetomo.com/?tab=profile' || E'\n\n'
    || '※このメッセージは自動で送っています。興味がなければ、そのままで大丈夫です。';
begin
  if coalesce((select value from public.kimetomo_app_settings where key = 'wroom_ai_dm'), 'on') = 'off' then return 'off'; end if;
  if r is null then return 'no room'; end if;
  select p.user_id into admin from public.circle_profiles p
   where p.is_admin and p.status = 'approved' order by p.created_at limit 1;
  if admin is null then return 'no admin'; end if;
  if not p_dry and h not between 9 and 21 then return 'outside hours'; end if;

  for t in
    select p.user_id from public.circle_profiles p
     where p.status = 'approved' and p.user_id <> admin
       and not exists (select 1 from public.kimetomo_wroom_ai_dm_sent s where s.user_id = p.user_id)
       and not exists (select 1 from public.kimetomo_wroom_ai_tries x where x.user_id = p.user_id)
       and not exists (select 1 from public.kimetomo_room_requests q where q.room_id = r and q.user_id = p.user_id)
       and not public.kimetomo_bell_blocked(p.user_id, admin)
       and public.kimetomo_wroom_ai_check(p.user_id) = 'ok'
     order by p.created_at
     limit case when p_dry then 1000 else 5 end
  loop
    n := n + 1;
    continue when p_dry;
    begin
      insert into public.kimetomo_direct_conversations (user_a, user_b)
      values (least(admin, t.user_id), greatest(admin, t.user_id))
      on conflict (user_a, user_b) do nothing;
      select c.id into conv from public.kimetomo_direct_conversations c
       where c.user_a = least(admin, t.user_id) and c.user_b = greatest(admin, t.user_id);
      -- DMの見張り（本人確認）を通すため、送るあいだだけ管理者として書く
      perform set_config('request.jwt.claim.sub', admin::text, true);
      perform set_config('request.jwt.claim.role', 'authenticated', true);
      perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
      insert into public.kimetomo_direct_messages (conversation_id, sender_id, body) values (conv, admin, msg);
      perform set_config('request.jwt.claim.sub', coalesce(old_sub, ''), true);
      perform set_config('request.jwt.claim.role', coalesce(old_role, ''), true);
      perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
      insert into public.kimetomo_wroom_ai_dm_sent (user_id) values (t.user_id);
    exception when others then
      perform set_config('request.jwt.claim.sub', coalesce(old_sub, ''), true);
      perform set_config('request.jwt.claim.role', coalesce(old_role, ''), true);
      perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
      insert into public.kimetomo_wroom_ai_dm_sent (user_id, error) values (t.user_id, left(sqlerrm, 200))
      on conflict (user_id) do nothing;
    end;
  end loop;
  return case when p_dry then 'would send ' else 'sent ' end || n;
end $$;

revoke all on function public.kimetomo_wroom_ai_dm_tick(boolean) from public, anon, authenticated;

select cron.unschedule('kimetomo-wroom-ai-dm') where exists (select 1 from cron.job where jobname = 'kimetomo-wroom-ai-dm');
select cron.schedule('kimetomo-wroom-ai-dm', '*/10 * * * *', 'select public.kimetomo_wroom_ai_dm_tick()');
