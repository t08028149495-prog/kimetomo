-- 連続投稿（荒らし）対策
-- 本番で動いていた仕組みを、2026-11-09 に本番の定義から書き出して保存したもの。
-- 1 人あたり、決まった時間の中で書き込める回数を数えて、超えたら断る。
--   タイムラインの投稿 : 10 分に 5 件まで
--   コメント           : 5 分に 15 件まで
--   チャット           : 1 分に 30 件まで
--   DM                 : 1 分に 20 件まで
--   チャットの画像     : 10 分に 10 件まで
-- あわせて「本人の書き込みか」「承認済みメンバーか」も確かめる。
-- ※ 回数を変えるときは、下の関数の max_hits / window_length を書き換えて、もう一度実行する。

-- 回数を数えるための表（1 人 × 種類ごとに 1 行）
create table if not exists public.kimetomo_rate_limits (
  user_id      uuid        not null,
  action_name  text        not null,
  window_start timestamptz not null default now(),
  hit_count    integer     not null default 0,
  primary key (user_id, action_name)
);

-- アプリからは直接さわれないようにする（関数の中からだけ使う）
alter table public.kimetomo_rate_limits enable row level security;
revoke all on public.kimetomo_rate_limits from anon, authenticated;
-- ※ 本番にはこのほか、2段階認証用の「kimetomo mfa」ポリシーが付いている（2段階認証の SQL で全部の表に付けたもの）。

create or replace function public.kimetomo_guard_insert()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
DECLARE
  actor uuid;
  actor_text text;
  row_data jsonb;
  action_key text;
  max_hits integer;
  window_length interval;
  current_count integer;
  current_start timestamptz;
BEGIN
  row_data := to_jsonb(NEW);

  -- テーブルごとに正しい投稿者IDを取得
  CASE TG_TABLE_NAME

    WHEN 'kimetomo_timeline_posts' THEN
      actor_text := row_data ->> 'author_id';
      action_key := 'post';
      max_hits := 5;
      window_length := interval '10 minutes';

    WHEN 'kimetomo_timeline_comments' THEN
      actor_text := row_data ->> 'author_id';
      action_key := 'comment';
      max_hits := 15;
      window_length := interval '5 minutes';

    WHEN 'circle_messages' THEN
      actor_text := row_data ->> 'sender_id';
      action_key := 'chat';
      max_hits := 30;
      window_length := interval '1 minute';

    WHEN 'kimetomo_direct_messages' THEN
      actor_text := row_data ->> 'sender_id';
      action_key := 'dm';
      max_hits := 20;
      window_length := interval '1 minute';

    WHEN 'circle_media' THEN
      actor_text := COALESCE(
        row_data ->> 'sender_id',
        row_data ->> 'uploader_id',
        row_data ->> 'author_id',
        row_data ->> 'user_id'
      );
      action_key := 'media';
      max_hits := 10;
      window_length := interval '10 minutes';

    ELSE
      RAISE EXCEPTION
        '未対応のテーブルです: %',
        TG_TABLE_NAME;
  END CASE;

  -- 投稿者IDがない場合は拒否
  IF actor_text IS NULL THEN
    RAISE EXCEPTION
      '投稿者IDの列が見つかりません: %',
      TG_TABLE_NAME;
  END IF;

  actor := actor_text::uuid;

  -- 本人確認
  IF auth.uid() IS NULL
     OR actor IS DISTINCT FROM auth.uid()
  THEN
    RAISE EXCEPTION
      '送信ユーザーを確認できません'
      USING ERRCODE = '42501';
  END IF;

  -- 承認済みメンバーのみ利用可能
  IF NOT EXISTS (
    SELECT 1
    FROM public.circle_profiles p
    WHERE p.user_id = actor
      AND p.status = 'approved'
  ) THEN
    RAISE EXCEPTION
      '利用できないアカウントです'
      USING ERRCODE = '42501';
  END IF;

  -- 制限用レコードを作成
  INSERT INTO public.kimetomo_rate_limits
    (user_id, action_name, window_start, hit_count)
  VALUES
    (actor, action_key, clock_timestamp(), 0)
  ON CONFLICT (user_id, action_name)
  DO NOTHING;

  -- 同時投稿を安全にカウント
  SELECT hit_count, window_start
  INTO current_count, current_start
  FROM public.kimetomo_rate_limits
  WHERE user_id = actor
    AND action_name = action_key
  FOR UPDATE;

  IF current_start <=
     clock_timestamp() - window_length
  THEN

    UPDATE public.kimetomo_rate_limits
    SET window_start = clock_timestamp(),
        hit_count = 1
    WHERE user_id = actor
      AND action_name = action_key;

  ELSIF current_count >= max_hits THEN

    RAISE EXCEPTION
      '投稿が集中しています。少し時間をおいて再試行してください。'
      USING ERRCODE = 'P0001';

  ELSE

    UPDATE public.kimetomo_rate_limits
    SET hit_count = hit_count + 1
    WHERE user_id = actor
      AND action_name = action_key;

  END IF;

  RETURN NEW;
END;
$function$;

-- アプリから関数を直接呼べないようにする（書き込みのときに自動で動くだけ）
revoke execute on function public.kimetomo_guard_insert() from public, anon, authenticated;

-- 書き込みの直前に毎回チェックする
drop trigger if exists kimetomo_anti_spam_insert on public.kimetomo_timeline_posts;
create trigger kimetomo_anti_spam_insert before insert on public.kimetomo_timeline_posts
  for each row execute function public.kimetomo_guard_insert();

drop trigger if exists kimetomo_anti_spam_insert on public.kimetomo_timeline_comments;
create trigger kimetomo_anti_spam_insert before insert on public.kimetomo_timeline_comments
  for each row execute function public.kimetomo_guard_insert();

drop trigger if exists kimetomo_anti_spam_insert on public.circle_messages;
create trigger kimetomo_anti_spam_insert before insert on public.circle_messages
  for each row execute function public.kimetomo_guard_insert();

drop trigger if exists kimetomo_anti_spam_insert on public.kimetomo_direct_messages;
create trigger kimetomo_anti_spam_insert before insert on public.kimetomo_direct_messages
  for each row execute function public.kimetomo_guard_insert();

drop trigger if exists kimetomo_anti_spam_insert on public.circle_media;
create trigger kimetomo_anti_spam_insert before insert on public.circle_media
  for each row execute function public.kimetomo_guard_insert();
