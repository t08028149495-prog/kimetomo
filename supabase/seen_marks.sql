-- 👀 「どこまで見たか」を端末どうしでそろえる（2026-11-27）
-- 下のタブの赤い数字（タイムライン・グループ・管理の「気になる投稿」）は、今まで端末ごとにしか覚えていなかった。
-- そのため PC で見ても iPhone では「まだ見ていない」ままになっていた。1 人 1 行だけの小さな表に覚えて、端末どうしでそろえる。
-- 画面は js/live.js（kmSeenPush・読み込み）、js/poll.js、js/topic.js、js/soft-filter.js、js/admin-tabs.js。
-- 何度実行しても同じ結果になる。

create table if not exists public.kimetomo_seen_marks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tl_seen_at timestamptz,     -- タイムライン：ここまでの投稿は見た
  chat_seen_at timestamptz,   -- グループチャット：ここまでのメッセージは見た
  flag_seen_id bigint,        -- 管理者の「気になる投稿」：この番号までは見た
  updated_at timestamptz not null default now()
);

alter table public.kimetomo_seen_marks enable row level security;
revoke all on public.kimetomo_seen_marks from anon;
grant select, insert, update on public.kimetomo_seen_marks to authenticated;

-- 決まり：自分の行だけ読める・書ける
drop policy if exists "km_seen_marks_select" on public.kimetomo_seen_marks;
drop policy if exists "km_seen_marks_insert" on public.kimetomo_seen_marks;
drop policy if exists "km_seen_marks_update" on public.kimetomo_seen_marks;
drop policy if exists "kimetomo mfa" on public.kimetomo_seen_marks;
create policy "km_seen_marks_select" on public.kimetomo_seen_marks
  for select to authenticated using (user_id = (select auth.uid()));
create policy "km_seen_marks_insert" on public.kimetomo_seen_marks
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "km_seen_marks_update" on public.kimetomo_seen_marks
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "kimetomo mfa" on public.kimetomo_seen_marks as restrictive for all to authenticated
  using ((select public.kimetomo_mfa_ok())) with check ((select public.kimetomo_mfa_ok()));

-- 「ここまで見た」を進める。古い値を送っても戻らない（いちばん進んでいる値を残す）。
-- 端末の時計がずれていても先の時刻にはしない。変わらないときは書きこまない（ほかの端末への知らせも飛ばない）。
-- 返すのは今の行（古い端末は、これで新しい値に追いつく）。
create or replace function public.kimetomo_mark_seen(
  p_tl timestamptz default null,
  p_chat timestamptz default null,
  p_flag bigint default null
) returns setof public.kimetomo_seen_marks
language sql security invoker set search_path = public as $$
  insert into public.kimetomo_seen_marks as m (user_id, tl_seen_at, chat_seen_at, flag_seen_id)
  select auth.uid(),
         case when p_tl is null then null else least(p_tl, now()) end,
         case when p_chat is null then null else least(p_chat, now()) end,
         p_flag
  where auth.uid() is not null
  on conflict (user_id) do update set
    tl_seen_at = greatest(m.tl_seen_at, excluded.tl_seen_at),
    chat_seen_at = greatest(m.chat_seen_at, excluded.chat_seen_at),
    flag_seen_id = greatest(m.flag_seen_id, excluded.flag_seen_id),
    updated_at = now()
  where (excluded.tl_seen_at is not null and (m.tl_seen_at is null or excluded.tl_seen_at > m.tl_seen_at))
     or (excluded.chat_seen_at is not null and (m.chat_seen_at is null or excluded.chat_seen_at > m.chat_seen_at))
     or (excluded.flag_seen_id is not null and (m.flag_seen_id is null or excluded.flag_seen_id > m.flag_seen_id));
  select * from public.kimetomo_seen_marks where user_id = auth.uid();
$$;
revoke all on function public.kimetomo_mark_seen(timestamptz, timestamptz, bigint) from public, anon;
grant execute on function public.kimetomo_mark_seen(timestamptz, timestamptz, bigint) to authenticated;

-- リアルタイム更新に加える（ほかの端末で見たら、こちらの赤い数字もすぐ消える）
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'kimetomo_seen_marks') then
    alter publication supabase_realtime add table public.kimetomo_seen_marks;
  end if;
end $$;

select 'OK：「どこまで見たか」を端末どうしでそろえる表を用意しました' as 結果;
