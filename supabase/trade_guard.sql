-- キメ友SNS: 売り買い（お金やモノのやりとり）を思わせる書き込みを止める（2026-11-26）
--   ・投稿・コメント・グループチャット・個人チャット・プロフィールの自己紹介が対象
--   ・アプリでは送る前に js/trade-guard.js が知らせて止める。ここはアプリを通らない書き込みも止める本当の確認
--   ・言葉は「ひらがな→カタカナ・全角→半角・小文字・空白や記号（ー も）を取り除く」にそろえた文に、
--     下の一覧の正規表現（決まった形の文字の並び）が見つかったら止める
--   ・一覧を変えたら js/trade-guard.js も同じに直すこと
--   ・すでにある書き込みは消さない。書き直したときだけ調べる
-- 先に ng_words.sql（kimetomo_ng_normalize）を実行しておくこと。何度実行しても大丈夫です。
-- 止めるのをやめるとき：下の「元に戻す」を実行する。

create table if not exists public.kimetomo_trade_patterns (
  pattern text primary key
);
alter table public.kimetomo_trade_patterns enable row level security;
revoke all on public.kimetomo_trade_patterns from anon, authenticated;

-- 一覧を入れ直す（js/trade-guard.js と同じ）
delete from public.kimetomo_trade_patterns;
insert into public.kimetomo_trade_patterns (pattern) values
  ('(?:売|ウ)リ(?:マス|マセンカ|タイ|マショウカ)'),
  ('(?:売|ウ)ッテ(?:クダサイ|下サイ|クレ|ホシイ|欲シイ|モラエ|モライタイ|イタダケ|クレル|クレマセンカ)'),
  ('売ッテル(?:人|方|ヒト|カタ)'),
  ('販売(?:シマス|中|シテマス|シテイマス|可|シテル)'),
  ('売ルヨ'),
  ('売リ手'),
  ('売買(?:シマス|シマセンカ|シタイ|希望|可|オ願)'),
  ('(?:買|カ)イ(?:取|ト)リ'),
  ('買取'),
  ('買イ(?:マセンカ|手)'),
  ('買ッテ(?:クダサイ|下サイ|クレ|ホシイ|欲シイ|モラエ|モライタイ|イタダケ|クレル|クレマセンカ)'),
  ('購入(?:希望|シタイ人|デキル)'),
  ('(?:譲|ユズ)(?:リマス|レマス|リタイ|ルヨ|リマショウカ|ッテ(?:クダサイ|下サイ|クレ|ホシイ|欲シイ|モラエ|モライタイ|イタダケ|クレル|クレマセンカ))'),
  ('譲渡'),
  ('オ譲リ'),
  ('(?:譲|求)\)'),
  ('取リ?引キ?(?:シマセンカ|シマショ|シタイ|シテクレ|シテクダサイ|シテ下サイ|シヨ|希望|可|デキマス|デキル|オ願)'),
  ('(?:着|前|先)払イ(?:デ|ナラ|可|ok|オ願|ノミ|限定|ダケ|デキ)'),
  ('振込先'),
  ('振リ?込ン?デ(?:クダサイ|下サイ|クレ|ホシイ|モラエ|イタダケ)'),
  ('送金(?:シテクダサイ|シテ下サイ|シテクレ|シテホシイ|オ願|先)'),
  ('口座(?:ヲ)?(?:教エテ|番号教)'),
  ('(?:paypay|ペイペイ|linepay|ラインペイ|メルペイ|楽天ペイ|aupay|d払イ|kyash|アマギフ|amazonギフト|アマゾンギフト|ギフトカド|ギフト券|itunesカド|googleplayカド|プリペイドカド|ウェブマネ|webmoney|ビットコイン|btc)(?:デ|ニ|ヲ)?(?:送ッテ|払ッテ|振リ?込ンデ|送金シテ)(?:クダサイ|下サイ|クレ|ホシイ|欲シイ|モラエ|モライタイ|イタダケ|クレル|クレマセンカ)'),
  ('(?:paypay|ペイペイ|linepay|ラインペイ|メルペイ|楽天ペイ|aupay|d払イ|kyash|アマギフ|amazonギフト|アマゾンギフト|ギフトカド|ギフト券|itunesカド|googleplayカド|プリペイドカド|ウェブマネ|webmoney|ビットコイン|btc)(?:デ|ノ)?(?:支払|決済|払イ)?(?:オ願|可|ok|デ大丈夫|デイイ|モ可|ノミ|限定)'),
  ('手渡シ(?:可|ok|デキ|ナラ|希望|ノミ|限定|オ願|デオ願|デ取リ?引|デ売|デ譲)'),
  ('(?:郵送|発送)(?:シマス|可|デキ|シテクレ|シテクダサイ|シテ下サイ)'),
  ('匿名配送'),
  ('即(?:納|日発送)'),
  ('在庫(?:アリマス|アルヨ|有リマス)'),
  ('値(?:下ゲ|引キ)(?:可|シマス|ok|デキ)'),
  ('卸(?:シマス|値|売)'),
  ('言イ値'),
  ('\d+(?:万円?|千円?|円|k)デ(?:売|譲|買|ドウ(?!ニ|シ|ヤ|モ|セ|イウ|カシ)|イカガ|可|ok|取リ?引|手渡|オ願|ユズ|ウリ|ウッ)'),
  ('(?:g|グラム)(?:単価|イクラ|何円|ナンエン)'),
  ('\dパケ(?!ット)'),
  ('パケ(?:売|イクラ|何円|ナンエン)')
;

-- 含まれている売り買いの言葉を 1 つ返す（なければ null）
create or replace function public.kimetomo_trade_hit(p text)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  squeezed text;
  r record;
  m text;
begin
  if p is null or p = '' then return null; end if;
  squeezed := public.kimetomo_ng_normalize(p);
  for r in select pattern from public.kimetomo_trade_patterns loop
    m := substring(squeezed from r.pattern);
    if m is not null then
      -- カタカナをひらがなに戻して見やすくする
      return translate(m,
        'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴ',
        'ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔ');
    end if;
  end loop;
  m := substring(public.kimetomo_ng_normalize(p, true) from '(?:^|[^a-z0-9])(wts|wtb|for sale)(?:[^a-z0-9]|$)');
  return m;
end $$;
revoke all on function public.kimetomo_trade_hit(text) from public, anon;

-- 保存する前に確かめる（調べる列の名前をトリガーの引数で渡す）
create or replace function public.kimetomo_trade_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  col text;
  hit text;
  rec jsonb := to_jsonb(new);
begin
  foreach col in array tg_argv loop
    -- 書き直しでは、その列が変わったときだけ調べる（前からある書き込みのせいで、ほかの更新が止まらないように）
    if tg_op = 'UPDATE' and (to_jsonb(old) ->> col) is not distinct from (rec ->> col) then continue; end if;
    hit := public.kimetomo_trade_hit(rec ->> col);
    if hit is not null then
      raise exception '売り買いを思わせる言葉（「%」）が含まれているため、送れません。キメ友では、メンバー同士の売り買いは禁止です。', hit
        using errcode = 'P0001';
    end if;
  end loop;
  return new;
end $$;

do $$
declare t record;
begin
  for t in
    select * from (values
      ('kimetomo_timeline_posts', 'body'),
      ('kimetomo_timeline_comments', 'body'),
      ('circle_messages', 'body'),
      ('kimetomo_direct_messages', 'body'),
      ('kimetomo_user_profiles', 'bio')
    ) as x(tbl, cols)
  loop
    if to_regclass('public.' || t.tbl) is not null then
      execute format('drop trigger if exists kimetomo_trade_guard on public.%I', t.tbl);
      execute format(
        'create trigger kimetomo_trade_guard before insert or update on public.%I for each row execute function public.kimetomo_trade_guard(%s)',
        t.tbl, (select string_agg(quote_literal(c), ', ') from unnest(string_to_array(t.cols, ',')) c));
    end if;
  end loop;
end $$;

-- 確認：言葉の数と、ためしの判定
select count(*) as patterns,
       public.kimetomo_trade_hit('これ5000円で売ります') as should_hit,
       public.kimetomo_trade_hit('コンビニでアイス買った') as should_be_null
from public.kimetomo_trade_patterns;

-- 元に戻す（止めるのをやめる）ときは、次の 5 行を実行する
-- drop trigger if exists kimetomo_trade_guard on public.kimetomo_timeline_posts;
-- drop trigger if exists kimetomo_trade_guard on public.kimetomo_timeline_comments;
-- drop trigger if exists kimetomo_trade_guard on public.circle_messages;
-- drop trigger if exists kimetomo_trade_guard on public.kimetomo_direct_messages;
-- drop trigger if exists kimetomo_trade_guard on public.kimetomo_user_profiles;
