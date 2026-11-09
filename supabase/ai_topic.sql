-- キメ友SNS: ✨ AIが毎日「今日のお題」を作る（Edge Function kimetomo-ai-topic とセット）
--   ・1日1回だけ AI（Claude Haiku 5.5）に3つ作ってもらい、ここに保存する。みんな同じお題を見る
--   ・普通の質問は出さず、本音・ぶっちゃけ・ちょっと攻めた問いにする。3つのうち2つは「大人の本音」（恋愛の本音・黒歴史など。性的なことは入れない）、1つは「アングラ寄り」（ネットの闇・都市伝説など）
--   ・その日いちばん最初にアプリを開いた人のときに作る（同時に開いても1回しか作らない）
--   ・作れなかった日は、今までの決まったお題の一覧がそのまま出る
-- 何度実行しても大丈夫です。

create table if not exists public.kimetomo_ai_topics (
  day date primary key,                       -- 日本時間の日付
  topics jsonb,                               -- [{"e":"🍙","t":"好きなおにぎりの具は？"}, ...]
  status text not null default 'making' check (status in ('making', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.kimetomo_ai_topics enable row level security;
revoke all on public.kimetomo_ai_topics from public, anon, authenticated;

-- Edge Function 用：その日のお題を作る係を1人だけに決める（作れたら true）
--   作っている途中で止まった（5分）・失敗した（10分たった）ときは、もう一度作り直せる
create or replace function public.kimetomo_ai_topic_claim(p_day date)
returns boolean language plpgsql security definer set search_path to 'public'
as $$
declare got date;
begin
  insert into public.kimetomo_ai_topics (day) values (p_day)
  on conflict (day) do update set status = 'making', updated_at = now()
    where (kimetomo_ai_topics.status = 'making' and kimetomo_ai_topics.updated_at < now() - interval '5 minutes')
       or (kimetomo_ai_topics.status = 'failed' and kimetomo_ai_topics.updated_at < now() - interval '10 minutes')
  returning day into got;
  return got is not null;
end $$;

revoke all on function public.kimetomo_ai_topic_claim(date) from public, anon, authenticated;
grant execute on function public.kimetomo_ai_topic_claim(date) to service_role;
grant select, insert, update on public.kimetomo_ai_topics to service_role;

-- 古いお題は60日で消す（新しく作るときに一緒に掃除する）
create or replace function public.kimetomo_ai_topic_cleanup()
returns void language sql security definer set search_path to 'public'
as $$ delete from public.kimetomo_ai_topics where day < (now() at time zone 'Asia/Tokyo')::date - 60 $$;
revoke all on function public.kimetomo_ai_topic_cleanup() from public, anon, authenticated;
grant execute on function public.kimetomo_ai_topic_cleanup() to service_role;

select 'OK：✨ AIの今日のお題の保存場所を作りました' as 結果;
