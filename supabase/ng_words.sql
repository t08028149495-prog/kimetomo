-- キメ友SNS: 薬物の名前を、ユーザー名・投稿・コメント・チャットなどに使えないようにする
--   ・使えない言葉の一覧（kimetomo_ng_words）に入っている言葉が含まれていたら、保存を止める
--   ・全角／半角、カタカナ／ひらがな、間に入れた空白や記号（例：覚 せ い 剤、コ・カ・イ・ン）も見つける
--   ・言葉を増やしたいときは、下の「言葉を追加する例」を実行する
-- 何度実行しても大丈夫です。

create table if not exists public.kimetomo_ng_words (
  word text primary key,
  -- 'ja'：文の途中に含まれていたら止める / 'en'：英単語として出てきたら止める（method などの一部では止めない）
  kind text not null default 'ja' check (kind in ('ja', 'en'))
);
alter table public.kimetomo_ng_words enable row level security;
revoke all on public.kimetomo_ng_words from anon, authenticated;

insert into public.kimetomo_ng_words (word, kind) values
  ('覚醒剤','ja'),('覚せい剤','ja'),('かくせいざい','ja'),('シャブ','ja'),('しゃぶ中','ja'),('シャブ中','ja'),
  ('メタンフェタミン','ja'),('アンフェタミン','ja'),('ヒロポン','ja'),
  ('大麻','ja'),('マリファナ','ja'),('マリワナ','ja'),('ガンジャ','ja'),('ハシシ','ja'),('ハシッシュ','ja'),('ウィード','ja'),
  ('麻薬','ja'),('まやく','ja'),('コカイン','ja'),('ヘロイン','ja'),('アヘン','ja'),('阿片','ja'),('モルヒネ','ja'),
  ('ケタミン','ja'),('フェンタニル','ja'),('エクスタシー','ja'),('ＭＤＭＡ','ja'),
  ('危険ドラッグ','ja'),('脱法ドラッグ','ja'),('脱法ハーブ','ja'),('合法ハーブ','ja'),('違法薬物','ja'),
  ('キメセク','ja'),('ドラッグ売','ja'),('薬物売','ja'),
  ('meth','en'),('methamphetamine','en'),('amphetamine','en'),('cocaine','en'),('heroin','en'),
  ('marijuana','en'),('cannabis','en'),('ganja','en'),('hashish','en'),('mdma','en'),('ecstasy','en'),
  ('lsd','en'),('thc','en'),('ketamine','en'),('fentanyl','en'),('opium','en'),('ghb','en')
on conflict (word) do nothing;

-- ひらがな → カタカナ、全角 → 半角などをそろえ、空白や記号を取り除く
create or replace function public.kimetomo_ng_normalize(p text, keep_spaces boolean default false)
returns text language sql immutable as $$
  select case when keep_spaces
    then lower(translate(normalize(coalesce(p, ''), NFKC),
      'ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔ',
      'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴ'))
    else regexp_replace(lower(translate(normalize(coalesce(p, ''), NFKC),
      'ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔ',
      'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴ')),
      '[\s・･\.\-_\*~〜ー―‐/\\|,、。!！?？☆★♪♡❤︎]+', '', 'g')
  end;
$$;

-- 含まれている使えない言葉を 1 つ返す（なければ null）
create or replace function public.kimetomo_ng_hit(p text)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  squeezed text;
  spaced text;
  w record;
begin
  if p is null or p = '' then return null; end if;
  -- 「しゃぶしゃぶ」（料理）は止めない
  squeezed := replace(public.kimetomo_ng_normalize(p), 'シャブシャブ', '');
  spaced := public.kimetomo_ng_normalize(p, true);
  for w in select word, kind from public.kimetomo_ng_words loop
    if w.kind = 'ja' then
      if position(replace(public.kimetomo_ng_normalize(w.word), 'シャブシャブ', '') in squeezed) > 0 then
        return w.word;
      end if;
    else
      if spaced ~* ('(^|[^a-z0-9])' || w.word || '([^a-z0-9]|$)') then
        return w.word;
      end if;
    end if;
  end loop;
  return null;
end $$;

-- 保存する前に確かめる（調べる列の名前をトリガーの引数で渡す）
create or replace function public.kimetomo_ng_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  col text;
  hit text;
  rec jsonb := to_jsonb(new);
begin
  foreach col in array tg_argv loop
    hit := public.kimetomo_ng_hit(rec ->> col);
    if hit is not null then
      raise exception '使えない言葉が含まれています（「%」）。内容を変えてからもう一度お試しください。', hit
        using errcode = 'P0001';
    end if;
  end loop;
  return new;
end $$;

-- 表ごとに取り付ける（表がない場合はとばす）
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('kimetomo_timeline_posts', 'body'),
      ('kimetomo_timeline_comments', 'body'),
      ('circle_messages', 'body'),
      ('kimetomo_direct_messages', 'body'),
      ('kimetomo_user_profiles', 'display_name,bio'),
      ('circle_profiles', 'display_name'),
      ('kimetomo_feature_requests', 'title,body'),
      ('kimetomo_timeline_polls', 'options'),
      ('circle_rooms', 'name')
    ) as x(tbl, cols)
  loop
    if to_regclass('public.' || t.tbl) is not null then
      execute format('drop trigger if exists kimetomo_ng_guard on public.%I', t.tbl);
      execute format(
        'create trigger kimetomo_ng_guard before insert or update on public.%I for each row execute function public.kimetomo_ng_guard(%s)',
        t.tbl, (select string_agg(quote_literal(c), ', ') from unnest(string_to_array(t.cols, ',')) c));
    end if;
  end loop;
end $$;

-- 新規登録のユーザー名も止める
create or replace function public.kimetomo_ng_guard_signup()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  hit text := coalesce(public.kimetomo_ng_hit(new.raw_user_meta_data ->> 'username'),
                       public.kimetomo_ng_hit(new.raw_user_meta_data ->> 'display_name'));
begin
  if hit is not null then
    raise exception '使えない言葉が含まれています（「%」）', hit using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists kimetomo_ng_guard_signup on auth.users;
create trigger kimetomo_ng_guard_signup before insert on auth.users
  for each row execute function public.kimetomo_ng_guard_signup();

-- ========== 確認 ==========
-- 正しく動くかのテスト（すべて「止める」「通す」の期待どおりなら OK）
select txt as テスト, coalesce(public.kimetomo_ng_hit(txt), '（通す）') as 結果
from (values ('覚 せ い 剤'), ('こかいん'), ('ｺｶｲﾝ'), ('今日はしゃぶしゃぶ食べた'), ('method'), ('MDMA'), ('今日の大麻'), ('アイス食べたい')) v(txt);

-- すでに保存されている内容のうち、使えない言葉を含むものの数（参考）
select 'ユーザー名' as 場所, count(*) as 件数 from public.circle_profiles where public.kimetomo_ng_hit(display_name) is not null
union all select '表示名・自己紹介', count(*) from public.kimetomo_user_profiles where public.kimetomo_ng_hit(display_name) is not null or public.kimetomo_ng_hit(bio) is not null
union all select 'タイムライン投稿', count(*) from public.kimetomo_timeline_posts where public.kimetomo_ng_hit(body) is not null
union all select 'コメント', count(*) from public.kimetomo_timeline_comments where public.kimetomo_ng_hit(body) is not null
union all select 'グループチャット', count(*) from public.circle_messages where public.kimetomo_ng_hit(body) is not null;

-- 言葉を追加する例（使うときは先頭の -- を消して実行）
-- insert into public.kimetomo_ng_words (word, kind) values ('追加したい言葉', 'ja') on conflict do nothing;
-- 言葉を外す例
-- delete from public.kimetomo_ng_words where word = '外したい言葉';
