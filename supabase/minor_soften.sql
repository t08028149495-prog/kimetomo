-- キメ友SNS: 未成年の言葉のチェックを少しやわらかくする
--   ・「15歳の頃に〜」「中学生のとき〜」のような昔の話は止めない
--   ・「息子が中学生で〜」「うちの子は高1です」「高校生の娘が〜」のような家族の話は止めない
--   ・jk / jc / ロリ / ショタ / 児ポ などは今までどおり必ず止める
--   ・やわらかくして通した書き込みは、管理者メニューの「気になる投稿」に記録する（ベルのお知らせは出さない）
--   ・画面側（js/ng-words.js の kmMinorSoften）も同じ決まりにしてある
-- minor_guard.sql のあとに実行すること。何度実行しても大丈夫です。

-- 文の中から「昔の話」「家族の話」の部分を消す（消した部分は | にして、前後がくっつかないようにする）
--   ※ 文字は kimetomo_ng_normalize のあと（ひらがな → カタカナ、空白や記号なし）で考える
create or replace function public.kimetomo_minor_soften(s text)
returns text language plpgsql immutable set search_path = public as $$
declare
  kw  text := '(?:女子高校生|男子高校生|女子高生|現役高校生|中学生|小学生|高校生|中学|小学|高校|1[2-7]歳|中[1-3]|高[1-3])';
  kws text;
  fam text := '(?:息子|ムスコ|娘|ムスメ|子供|子ドモ|コドモ|ウチノ子|ウチノコ|我ガ子|ワガ子|長男|長女|次男|次女|三男|三女|末ッ子|甥ッ子|姪ッ子|甥|姪|弟|妹|孫|オトウト|イモウト)(?:サン|クン|チャン)?';
  kin text := '(?:息子|ムスコ|娘|ムスメ|甥ッ子|姪ッ子|甥|姪|弟|妹|孫|長男|長女|次男|次女|三男|三女)';
  tim text := '(?:今年|来年|今|イマ|モウスグ|モウ)';
begin
  if s is null then return null; end if;
  kws := kw || '(?:ト?' || kw || ')*';
  -- 昔の話：「15歳ノ頃」「中学生ノトキ」「高校生時代」「中3ダッタ」など
  s := regexp_replace(s, kws || '(?:ノ?(?:頃|コロ|時代|時期|ジダイ|時|トキ)|ダッタ|デシタ|以来|イライ)', '|', 'g');
  -- 家族の話（前）：「息子ガ中学生」「ウチノ子ハ高1デス」「娘ガ今年デ15歳」など
  s := regexp_replace(s, fam || '(?:(?:ガ|ハ|モ|ノ)' || tim || '?|' || tim || ')(?:デ|カラ)?' || kws || '(?:デス|ダヨ)?', '|', 'g');
  -- 家族の話（後）：「高校生ノ娘」「15歳ノ息子」など
  s := regexp_replace(s, kws || 'ノ' || kin, '|', 'g');
  return s;
end $$;

-- 言葉のチェック本体（'minor' のときだけ上のやわらかくする処理を通す。'minor_raw' はやわらかくしない）
create or replace function public.kimetomo_ng_hit_level(p text, p_level text)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  squeezed text;
  spaced text;
  lvl text := case when p_level = 'minor_raw' then 'minor' else p_level end;
  w record;
begin
  if p is null or p = '' then return null; end if;
  squeezed := replace(public.kimetomo_ng_normalize(p), 'シャブシャブ', '');
  if p_level = 'minor' then squeezed := public.kimetomo_minor_soften(squeezed); end if;
  spaced := public.kimetomo_ng_normalize(p, true);
  for w in select word, kind from public.kimetomo_ng_words where level = lvl loop
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

-- 保存する前の確認（minor_guard.sql の内容に「やわらかくして通したものを記録する」を足したもの）
create or replace function public.kimetomo_ng_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  col text;
  hit text;
  rec jsonb := to_jsonb(new);
  author uuid;
  link text;
begin
  foreach col in array tg_argv loop
    hit := public.kimetomo_ng_hit_level(rec ->> col, 'block');
    if hit is not null then
      raise exception '使えない言葉が含まれています（「%」）。内容を変えてからもう一度お試しください。', hit
        using errcode = 'P0001';
    end if;
  end loop;

  -- 個人チャットは、管理者が読むことになるので対象外
  if tg_table_name = 'kimetomo_direct_messages' then return new; end if;

  -- 未成年を思わせる言葉は、保存しない
  foreach col in array tg_argv loop
    hit := public.kimetomo_ng_hit_level(rec ->> col, 'minor');
    if hit is not null then
      raise exception '18歳未満の方の利用や、未成年を思わせる書き込み（「%」）は、キメ友では投稿できません。内容を変えてください。', hit
        using errcode = 'P0001';
    end if;
  end loop;

  author := coalesce(rec ->> 'author_id', rec ->> 'sender_id', rec ->> 'user_id')::uuid;

  foreach col in array tg_argv loop
    hit := public.kimetomo_ng_hit_level(rec ->> col, 'warn');
    if hit is not null then
      insert into public.kimetomo_flagged (table_name, row_id, author_id, word, excerpt)
      values (tg_table_name, rec ->> 'id', author, hit, left(rec ->> col, 120));
      link := case tg_table_name
                when 'kimetomo_timeline_posts' then './?post=' || coalesce(rec ->> 'id', '')
                when 'kimetomo_timeline_comments' then './?post=' || coalesce(rec ->> 'post_id', '')
                when 'circle_messages' then './?tab=chat'
                else './?tab=profile' end;
      -- 同じ人について、管理者へのお知らせは 1 時間に 1 回まで
      if not exists (select 1 from public.kimetomo_flagged f
                     where f.author_id is not distinct from author and f.created_at > now() - interval '1 hour'
                       and f.id <> (select max(id) from public.kimetomo_flagged)) then
        insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
        select p.user_id, 'admin_notice', author, 'flag', left(rec ->> col, 80),
               '⚠️ 気になる言葉（「' || hit || '」）を含む投稿がありました', link
        from public.circle_profiles p
        where p.is_admin and p.status = 'approved' and p.user_id is distinct from author;
      end if;
      exit;
    end if;
  end loop;

  -- 「昔の話」「家族の話」として通したものは、気になる投稿の一覧にだけ残す（ベルは鳴らさない）
  foreach col in array tg_argv loop
    hit := public.kimetomo_ng_hit_level(rec ->> col, 'minor_raw');
    if hit is not null then
      insert into public.kimetomo_flagged (table_name, row_id, author_id, word, excerpt)
      values (tg_table_name, rec ->> 'id', author, hit || '（昔・家族の話として通過）', left(rec ->> col, 120));
      exit;
    end if;
  end loop;
  return new;
end $$;

-- ========== 確認 ==========
select t as 文, coalesce(public.kimetomo_ng_hit_level(t, 'minor'), '（通る）') as 結果
from unnest(array[
  '15歳の頃にはじめて行った',
  '中学生のとき部活ばっかりしてた',
  '息子が中学生で反抗期',
  'うちの子は高1です',
  '娘が今年で15歳になります',
  '高校生の娘がいます',
  '15歳です、よろしく',
  '中学生です',
  '関西 jk です',
  'ロリ画像ください',
  '息子が中学生と小学生'
]) as t;
