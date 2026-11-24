-- 個人チャット（dm.html）の「最近のやりとり」用：相手ごとの最後のメッセージを 1 件ずつ返す（2026-11-24）
--  ・今までは全員分の新しいメッセージ 300 件から相手を探していたので、DM の多い人は古い相手が一覧に出なかった
--  ・security invoker なので、今までどおり RLS（自分の会話だけ・ブロックなど）がそのままかかる
--  ・p_since を渡すと、それより新しいメッセージがある会話だけ返す（端末に覚えた分との差だけ読む）
--  ・本文は一覧の表示に使う最初の 80 文字だけ返す
create or replace function public.kimetomo_dm_latest(p_since timestamptz default null)
returns table(conversation_id uuid, sender_id uuid, body text, created_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select m.conversation_id, m.sender_id, left(m.body, 80), m.created_at
  from kimetomo_direct_conversations c
  cross join lateral (
    select d.conversation_id, d.sender_id, d.body, d.created_at
    from kimetomo_direct_messages d
    where d.conversation_id = c.id and (p_since is null or d.created_at > p_since)
    order by d.created_at desc
    limit 1
  ) m
  where (select auth.uid()) in (c.user_a, c.user_b)
$$;

revoke all on function public.kimetomo_dm_latest(timestamptz) from public, anon;
grant execute on function public.kimetomo_dm_latest(timestamptz) to authenticated;
