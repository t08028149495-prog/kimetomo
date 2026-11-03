-- キメ友SNS: マスコットキャラクター「キメ友のぞう」の自動投稿
--   ・朝7時〜夜中4時台まで、2時間ごとの枠（7-8時／9-10時／…／23-0時／1-2時／3-4時）。5〜6時台は投稿しない
--   ・その時間帯の中で、タイムラインに 20〜30 分（ランダム）だれも投稿していなければ話題をふる
--   ・1つの枠で投稿するのは 1 回まで（1日最大 11 回）
--   ・話題は時間帯・季節・アンケートなど約250種類＋前置き・しめの言葉の組み合わせ
-- 先に、キメ友の新規登録でユーザー名「キメ友のぞう」のアカウントを作っておくこと。
-- 何度実行しても大丈夫です。

create table if not exists public.kimetomo_mascot_settings (
  key text primary key,
  value text not null
);
alter table public.kimetomo_mascot_settings enable row level security;
revoke all on public.kimetomo_mascot_settings from anon, authenticated;

insert into public.kimetomo_mascot_settings (key, value) values
  ('mascot_username', 'キメ友のぞう'),
  ('enabled', 'true'),
  ('quiet_from', '1'),
  ('quiet_to', '6'),
  ('min_idle', '20'),
  ('max_idle', '30'),
  ('self_gap', '120')
on conflict (key) do nothing;

create table if not exists public.kimetomo_mascot_topics (
  id bigint generated always as identity primary key,
  slot text not null,
  body text not null,
  poll_options text[],
  last_used_at timestamptz,
  unique (slot, body)
);
alter table public.kimetomo_mascot_topics enable row level security;
revoke all on public.kimetomo_mascot_topics from anon, authenticated;

insert into public.kimetomo_mascot_topics (slot, body, poll_options) values
('morning','おはよう☀️ 今日の朝ごはん、何だった？',null),
('morning','おはよ〜！ 今朝は何時に起きた？',null),
('morning','朝はパン派？ごはん派？それとも食べない派？',null),
('morning','おはよう！ 今日の天気はどんな感じ？',null),
('morning','朝いちばんに飲むのは何？ コーヒー？お茶？水？',null),
('morning','おはよう🐘 今日やりたいことを1つだけ教えて！',null),
('morning','寝起きはいい方？ 悪い方？',null),
('morning','朝のルーティンってある？',null),
('morning','おはよう！ 今日のテンションを10点満点で言うと？',null),
('morning','今朝見た夢、覚えてる人いる？',null),
('morning','朝にテレビつける派？ 音楽流す派？ 静か派？',null),
('morning','おはよう！ 今日の服、何色？',null),
('morning','目覚ましは何回で起きられる？',null),
('morning','朝ごはんでいちばん好きなメニューは？',null),
('morning','おはよう☀️ 昨日はよく眠れた？',null),
('morning','朝の小さな幸せ、教えて！',null),
('morning','今日の予定、楽しみなことある？',null),
('morning','おはよう！ 今日がんばることをみんなで宣言しよう💪',null),
('morning','朝ドラとか、朝に見てる番組ある？',null),
('morning','おはよう🍞 好きなパンの種類は？',null),
('morning','朝の散歩ってしたことある？',null),
('morning','おはよう！ 今日の目標を一言で！',null),
('morning','朝シャワー派？ 夜お風呂派？',null),
('morning','おはよう！ 今日の運勢、おみくじ引いてみた？🎴',null),
('morning','寒い朝（暑い朝）、布団から出る方法教えて😂',null),
('morning','おはよう☕ 今日の1杯目は何飲む？',null),
('morning','朝ごはんに卵料理なら、目玉焼き？卵焼き？スクランブル？',null),
('morning','おはよう！ 今日は何曜日の気分？',null),
('morning','朝にやると調子がいいことってある？',null),
('morning','おはよう🌤 みんなの地域の今日の空はどう？',null),
('noon','お昼の時間🍙 今日のお昼ごはんは何？',null),
('noon','ランチ何食べた？ 写真なしでいいから教えて！',null),
('noon','お昼はお弁当派？ 外食派？ コンビニ派？',null),
('noon','お昼休み、何して過ごしてる？',null),
('noon','今日のお昼、いちばん食べたいものは？',null),
('noon','好きなコンビニのおにぎりの具は？🍙',null),
('noon','お昼のあと眠くなる人〜？😴',null),
('noon','ランチでよく行くお店のジャンルは？',null),
('noon','カップ麺ならどれが好き？',null),
('noon','お昼ごはんは軽め？ がっつり？',null),
('noon','今日の午前中、どうだった？',null),
('noon','麺類なら、ラーメン・うどん・そば・パスタ、どれ？',null),
('noon','お昼に甘いもの食べる派？',null),
('noon','最近食べたランチでいちばんおいしかったのは？',null),
('noon','お弁当に入ってたらうれしいおかずは？',null),
('noon','お昼ごはん、いつも何時ごろ？',null),
('noon','サンドイッチの具、何が好き？',null),
('noon','定食屋さんで頼みがちなメニューは？',null),
('noon','お昼休みの過ごし方で、おすすめある？',null),
('noon','今日のお昼ごはん、何点だった？',null),
('noon','丼ものなら何が好き？ 親子丼？ カツ丼？ 牛丼？',null),
('noon','お昼に飲むならどれ？ お茶・ジュース・コーヒー',null),
('noon','「午後もがんばろう」って気合い入れる方法ある？',null),
('noon','ランチ後のデザート、何が好き？',null),
('noon','お昼のBGM、何聴いてる？🎧',null),
('afternoon','おやつの時間🍪 今日は何食べる？',null),
('afternoon','午後の眠気、どうやって乗りこえてる？',null),
('afternoon','3時のおやつ、甘い派？しょっぱい派？',null),
('afternoon','最近ハマってるお菓子ある？',null),
('afternoon','午後のひと休み☕ みんな何してる？',null),
('afternoon','コンビニスイーツでおすすめは？',null),
('afternoon','今日あと半分！ ここまでどうだった？',null),
('afternoon','アイスなら何味が好き？🍨',null),
('afternoon','今ちょっと休憩中の人〜？',null),
('afternoon','最近買ってよかったもの、教えて！',null),
('afternoon','午後に聴きたい曲、おすすめある？',null),
('afternoon','お茶うけにするなら、せんべい？クッキー？チョコ？',null),
('afternoon','今日の空、どんな感じ？',null),
('afternoon','今週がんばってることある？',null),
('afternoon','ちょっと疲れた〜って人、ここで一息どうぞ🍵',null),
('afternoon','好きなグミはある？',null),
('afternoon','午後からやる気出すコツ、知りたい！',null),
('afternoon','最近見て笑った動画ある？',null),
('afternoon','今の気分を絵文字1つで表すと？',null),
('afternoon','今日の夜ごはん、もう決めた？',null),
('afternoon','最近気になってるお店ある？',null),
('afternoon','休憩のときにスマホで見がちなものは？',null),
('afternoon','今、何飲んでる？',null),
('afternoon','好きなチョコのお菓子は？🍫',null),
('afternoon','今日中にやりたいこと、あと1つだけ教えて！',null),
('evening','おつかれさま🌆 今日の夜ごはんは何？',null),
('evening','今日いちばん良かったことを教えて！',null),
('evening','晩ごはん、何食べたい気分？',null),
('evening','今日1日、何点だった？',null),
('evening','おつかれ〜！ 帰り道に寄りたくなるお店ある？',null),
('evening','夜ごはんは作る派？ 買う派？ 外食派？',null),
('evening','今日がんばった自分をほめよう👏 何をがんばった？',null),
('evening','お風呂は何分くらい入る？🛁',null),
('evening','今日の晩ごはん、おすすめのメニューある？',null),
('evening','夜に見てるドラマやアニメある？',null),
('evening','鍋ならどの鍋が好き？🍲',null),
('evening','今日あったちょっとした出来事、教えて！',null),
('evening','夜のお楽しみ、何かある？',null),
('evening','晩酌する人いる？ 何飲む？',null),
('evening','最近作った料理で、うまくいったものは？',null),
('evening','今日のごはん、いちばんおいしかったのは？',null),
('evening','カレーは甘口？中辛？辛口？🍛',null),
('evening','今夜は何して過ごす？',null),
('evening','今週の残り、楽しみなことある？',null),
('evening','おつかれさま！ 今日のMVPは何（誰）？',null),
('evening','今日いちばん笑ったこと、教えて😂',null),
('evening','好きな焼肉の部位は？🥩',null),
('evening','夜ごはんのあとのデザート、何が好き？',null),
('evening','今日の疲れ、何で回復する？',null),
('evening','最近見つけたおいしいもの、教えて！',null),
('night','夜ふかし中の人〜🌙',null),
('night','寝る前に何してる？',null),
('night','今日やり残したこと、ある？',null),
('night','明日の予定、楽しみなことある？',null),
('night','寝る前に聴く音楽ってある？',null),
('night','夜中にお腹すいたら何食べる？',null),
('night','眠れないときのおすすめの過ごし方は？',null),
('night','今日の1日を一言で表すと？',null),
('night','寝る前のスマホ、何見てる？',null),
('night','最近見た夢でおもしろかったのある？',null),
('night','今日もおつかれさま🌙 明日もよろしくね',null),
('night','夜型？ 朝型？',null),
('night','寝るときの姿勢、どれ派？ 仰向け・横向き・うつぶせ',null),
('night','寝る前に飲むなら何？',null),
('night','今いちばん欲しいものは？',null),
('night','もし明日休みなら、何する？',null),
('night','最近のマイブーム、教えて！',null),
('night','寝る前の小さな楽しみってある？',null),
('night','今週の思い出、1つ教えて！',null),
('night','もし1日だけ好きな場所に行けるなら、どこ行く？',null),
('night','夜にしか考えないこと、ある？😂',null),
('night','おやすみ前に、みんなに一言どうぞ',null),
('night','お気に入りのパジャマある？',null),
('night','寝る前に読む本・マンガある？',null),
('night','今日のよかったこと、3つ言える？',null),
('any','最近ハマってること、教えて！',null),
('any','好きな季節とその理由は？',null),
('any','行ってみたい場所はある？',null),
('any','子どもの頃の夢は何だった？',null),
('any','最近笑ったことある？',null),
('any','得意料理は？',null),
('any','好きな動物は？🐘',null),
('any','もし宝くじが当たったら何する？',null),
('any','無人島に1つだけ持っていくなら？',null),
('any','好きな言葉・座右の銘ある？',null),
('any','最近うれしかったこと、教えて！',null),
('any','地元の自慢を教えて！',null),
('any','最近覚えた豆知識ある？',null),
('any','苦手な食べ物ってある？',null),
('any','好きなキャラクターは？',null),
('any','カラオケの十八番は？🎤',null),
('any','推しはいる？',null),
('any','休みの日の過ごし方は？',null),
('any','人生でいちばんの思い出は？',null),
('any','最近始めたことある？',null),
('any','魔法が1つ使えるなら、何にする？',null),
('any','好きな色は？',null),
('any','おすすめのアプリある？',null),
('any','好きな映画やドラマは？',null),
('any','最近の小さな幸せ、教えて！',null),
('any','今いちばん会いたい人は？',null),
('any','好きなお寿司のネタは？🍣',null),
('any','旅行するなら海外？ 国内？',null),
('any','ストレス解消法は？',null),
('any','好きなゲームはある？🎮',null),
('any','猫派？ 犬派？',null),
('any','最近買ったもので一番満足してるのは？',null),
('any','雨の日の過ごし方は？☔',null),
('any','好きな飲み物は？',null),
('any','もらってうれしかった言葉は？',null),
('any','今の待ち受け画面、何にしてる？',null),
('any','タイムマシンがあったら、過去と未来どっち行く？',null),
('any','好きなラーメンの味は？🍜',null),
('any','最近がんばった自分をほめて！',null),
('any','今年中にやりたいことある？',null),
('m1','今年の目標は？',null),
('m1','初夢、何か見た？',null),
('m1','お正月、何食べた？',null),
('m1','冬の楽しみは何？⛄',null),
('m1','今年行きたい場所は？',null),
('m2','寒さ対策、何してる？',null),
('m2','好きなチョコは？🍫',null),
('m2','こたつ派？ ストーブ派？',null),
('m2','冬に食べたくなるものは？',null),
('m2','雪は好き？',null),
('m3','春になったらしたいことは？🌸',null),
('m3','卒業・入学の思い出ある？',null),
('m3','花粉症の人いる？🤧',null),
('m3','好きな春の食べ物は？',null),
('m3','春に聴きたい曲は？',null),
('m4','お花見に行った？🌸',null),
('m4','新しく始めたいことある？',null),
('m4','春の服、何色が好き？',null),
('m4','最近あったかくなってきたね、何したい？',null),
('m4','GWの予定、もう決めた？',null),
('m5','GWはどう過ごした？',null),
('m5','新緑の季節🌿 出かけたい場所ある？',null),
('m5','五月病、大丈夫？',null),
('m5','好きな初夏の食べ物は？',null),
('m5','最近の楽しみは何？',null),
('m6','雨の日の過ごし方は？☔',null),
('m6','お気に入りの傘ある？',null),
('m6','じめじめ対策、何してる？',null),
('m6','梅雨に聴きたい曲ある？',null),
('m6','あじさい見に行った？',null),
('m7','夏休みの予定は？🌻',null),
('m7','好きなアイスは？🍦',null),
('m7','夏といえば何を思い出す？',null),
('m7','海派？ 山派？',null),
('m7','七夕の願い事、何にする？🎋',null),
('m8','夏祭りに行った？🏮',null),
('m8','花火見た？🎆',null),
('m8','好きなかき氷の味は？',null),
('m8','暑さ対策、何してる？',null),
('m8','夏バテしてない？',null),
('m9','秋といえば何の秋？🍁',null),
('m9','お月見したことある？🎑',null),
('m9','好きな秋の味覚は？',null),
('m9','読書の秋、おすすめの本ある？',null),
('m9','秋の服、楽しみ？',null),
('m10','紅葉見に行く予定ある？🍁',null),
('m10','ハロウィン、仮装するなら何になる？🎃',null),
('m10','新米食べた？🍚',null),
('m10','秋にやりたいことは？',null),
('m10','スポーツの秋、何か体動かしてる？',null),
('m11','最近寒くなってきたね、何で温まる？',null),
('m11','好きな鍋は？🍲',null),
('m11','今年もあと少し、やり残したことある？',null),
('m11','冬支度してる？',null),
('m11','温泉行きたい人〜？♨️',null),
('m12','クリスマスの予定は？🎄',null),
('m12','今年いちばんの思い出は？',null),
('m12','大掃除した？',null),
('m12','年越しそば食べる派？',null),
('m12','来年やりたいことは？',null),
('any','📊 アンケート！ 今夜食べたいのはどれ？',array['カレー','ラーメン','お寿司','焼肉']::text[]),
('any','📊 アンケート！ 朝ごはんは？',array['パン','ごはん','食べない']::text[]),
('any','📊 アンケート！ 好きなおにぎりの具は？',array['鮭','ツナマヨ','梅','昆布']::text[]),
('any','📊 アンケート！ 猫派？犬派？',array['猫','犬','どっちも好き']::text[]),
('any','📊 アンケート！ 夏と冬、好きなのは？',array['夏','冬']::text[]),
('any','📊 アンケート！ 休みの日は？',array['家でのんびり','お出かけ','その日次第']::text[]),
('any','📊 アンケート！ カレーの辛さは？',array['甘口','中辛','辛口']::text[]),
('any','📊 アンケート！ 麺類なら？',array['ラーメン','うどん','そば','パスタ']::text[]),
('any','📊 アンケート！ 朝型？夜型？',array['朝型','夜型','どっちでもない']::text[]),
('any','📊 アンケート！ 飲むならどれ？',array['コーヒー','お茶','ジュース','水']::text[]),
('any','📊 アンケート！ 旅行するなら？',array['海','山','街','温泉']::text[]),
('any','📊 アンケート！ 好きなお菓子のタイプは？',array['チョコ系','スナック系','グミ系','和菓子']::text[]),
('any','📊 アンケート！ 目玉焼きにかけるのは？',array['しょうゆ','ソース','塩こしょう','ケチャップ']::text[]),
('any','📊 アンケート！ お風呂は？',array['シャワー派','湯船派']::text[]),
('any','📊 アンケート！ 映画を見るなら？',array['映画館','家で配信','あまり見ない']::text[]),
('any','📊 アンケート！ きのこ派？たけのこ派？',array['きのこ','たけのこ','どっちも']::text[]),
('any','📊 アンケート！ 唐揚げにレモンは？',array['かける','かけない','人に聞く']::text[]),
('any','📊 アンケート！ 好きな季節は？',array['春','夏','秋','冬']::text[]),
('any','📊 アンケート！ 連絡はどれが多い？',array['LINE','電話','キメ友','その他']::text[]),
('any','📊 アンケート！ 寝るときは？',array['真っ暗','少し明るい','テレビつけたまま']::text[]),
('any','📊 アンケート！ アイスなら？',array['バニラ','チョコ','抹茶','いちご']::text[]),
('any','📊 アンケート！ おでんで一番好きなのは？',array['大根','たまご','ちくわ','こんにゃく']::text[]),
('any','📊 アンケート！ お寿司で最初に食べるのは？',array['マグロ','サーモン','たまご','えび']::text[]),
('any','📊 アンケート！ 夜ごはんのあとは？',array['すぐお風呂','ちょっと休む','デザート']::text[]),
('any','📊 アンケート！ 今の気分は？',array['元気','ねむい','まったり','おなかすいた']::text[])
on conflict (slot, body) do nothing;

-- 投稿者本人として投稿する（タイムラインの本人確認を通すため）
create or replace function public.kimetomo_insert_post_as(p_author uuid, p_body text)
returns text language plpgsql security definer set search_path = public as $$
declare
  old_sub text := current_setting('request.jwt.claim.sub', true);
  old_claims text := current_setting('request.jwt.claims', true);
  old_role text := current_setting('request.jwt.claim.role', true);
  new_id text;
begin
  perform set_config('request.jwt.claim.sub', p_author::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_author, 'role', 'authenticated')::text, true);
  begin
    insert into public.kimetomo_timeline_posts (author_id, body)
    values (p_author, left(p_body, 1000))
    returning id::text into new_id;
  exception when others then
    perform set_config('request.jwt.claim.sub', coalesce(old_sub, ''), true);
    perform set_config('request.jwt.claim.role', coalesce(old_role, ''), true);
    perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
    raise;
  end;
  perform set_config('request.jwt.claim.sub', coalesce(old_sub, ''), true);
  perform set_config('request.jwt.claim.role', coalesce(old_role, ''), true);
  perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
  return new_id;
end $$;

revoke all on function public.kimetomo_insert_post_as(uuid, text) from public, anon, authenticated;
grant execute on function public.kimetomo_insert_post_as(uuid, text) to service_role;

create or replace function public.kimetomo_mascot_setting(p_key text, p_default text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.kimetomo_mascot_settings where key = p_key), p_default);
$$;

-- 日本時間の「時」から、投稿してよい時間帯の名前を返す（対象外は null）
create or replace function public.kimetomo_mascot_window(h int)
returns text language sql immutable as $$
  -- 7時を起点に 2 時間ずつの枠。5〜6時台は対象外
  select case when h in (5, 6) then null
              else 'w' || (((h - 7 + 24) % 24) / 2)::text end;
$$;

drop function if exists public.kimetomo_mascot_tick();
-- p_force = true のときは、時間帯や待ち時間を無視してすぐ投稿する（管理者の「今すぐ投稿」用）
create or replace function public.kimetomo_mascot_tick(p_force boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare
  mascot uuid;
  last_at timestamptz;
  last_id text;
  last_author uuid;
  wait_min int;
  h int;
  mon int;
  want text;
  slot_now text;
  win text;
  today date;
  pick record;
  r double precision;
  pre text[] := array['', '', '', 'ねえねえ、', 'みんなに質問！ ', 'ふと気になったんだけど、', 'ちょっと聞いて〜 ', 'ぞうから質問🐘 ', 'ひまな人いる？ ', 'みんなの意見が聞きたい！ '];
  post text[] := array['', '', '', ' 🐘', ' コメントで教えてね！', ' 気軽に答えてね〜', ' ひとことでもOK！', ' みんなの答え、楽しみにしてる！', ' ぞうも気になる🐘'];
  body text;
  new_id text;
begin
  if not p_force and public.kimetomo_mascot_setting('enabled', 'true') <> 'true' then return 'off'; end if;

  select u.id into mascot from auth.users u
  where u.raw_user_meta_data->>'username' = public.kimetomo_mascot_setting('mascot_username', 'キメ友のぞう')
  limit 1;
  if mascot is null then return 'no mascot account'; end if;

  h := extract(hour from now() at time zone 'Asia/Tokyo');
  mon := extract(month from now() at time zone 'Asia/Tokyo');
  today := ((now() at time zone 'Asia/Tokyo') - interval '5 hours')::date;
  -- 投稿してよい時間帯（日本時間）
  win := public.kimetomo_mascot_window(h);
  if not p_force then
  if win is null then return 'outside hours'; end if;

  -- 毎回同じ時刻（7:00, 9:00…）にならないよう、枠ごとに 0〜59 分のずれを入れる
  if ((h - (7 + 2 * substr(win, 2)::int) + 48) % 24) * 60 + extract(minute from now() at time zone 'Asia/Tokyo')::int
     < abs(hashtext(today::text || win)) % 60 then
    return 'waiting';
  end if;

  -- 同じ時間帯で今日すでに投稿していたら、次の時間帯まで待つ
  if exists (
    select 1 from public.kimetomo_timeline_posts p
    where p.author_id = mascot
      and ((p.created_at at time zone 'Asia/Tokyo') - interval '5 hours')::date = today
      and public.kimetomo_mascot_window(extract(hour from p.created_at at time zone 'Asia/Tokyo')::int) = win
  ) then
    return 'already posted in this window';
  end if;

  select p.created_at, p.id::text, p.author_id into last_at, last_id, last_author
  from public.kimetomo_timeline_posts p order by p.created_at desc limit 1;

  -- 最後の投稿ごとに 20〜30 分のどこかを「待ち時間」として決める（同じ投稿なら同じ値）
  wait_min := public.kimetomo_mascot_setting('min_idle', '20')::int
            + abs(hashtext(coalesce(last_id, 'none')))
              % (public.kimetomo_mascot_setting('max_idle', '30')::int - public.kimetomo_mascot_setting('min_idle', '20')::int + 1);
  if last_at is not null and now() - last_at < make_interval(mins => wait_min) then
    return 'waiting';
  end if;
  end if;

  slot_now := case when h between 7 and 10 then 'morning'
                   when h between 11 and 13 then 'noon'
                   when h between 14 and 17 then 'afternoon'
                   when h between 18 and 21 then 'evening'
                   else 'night' end;
  r := random();
  want := case when r < 0.55 then slot_now when r < 0.70 then 'm' || mon else 'any' end;

  select * into pick from public.kimetomo_mascot_topics t
  where t.slot = want and (t.last_used_at is null or t.last_used_at < now() - interval '10 days')
  order by random() limit 1;
  if not found then
    select * into pick from public.kimetomo_mascot_topics t
    where t.slot in (slot_now, 'any', 'm' || mon)
    order by t.last_used_at nulls first, random() limit 1;
  end if;
  if not found then return 'no topics'; end if;

  if pick.poll_options is not null then
    body := pick.body;
  else
    body := pre[1 + floor(random() * array_length(pre, 1))::int] || pick.body
         || post[1 + floor(random() * array_length(post, 1))::int];
  end if;

  new_id := public.kimetomo_insert_post_as(mascot, body);

  if pick.poll_options is not null then
    begin
      insert into public.kimetomo_timeline_polls (post_id, options)
      select p.id, pick.poll_options from public.kimetomo_timeline_posts p where p.id::text = new_id;
    exception when others then null;
    end;
  end if;

  update public.kimetomo_mascot_topics set last_used_at = now() where id = pick.id;
  return 'posted';
end $$;

revoke all on function public.kimetomo_mascot_tick(boolean) from public, anon, authenticated;

-- 5 分ごとに自動で確認する（Supabase の pg_cron を使う）
create extension if not exists pg_cron;
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'kimetomo-mascot';
  perform cron.schedule('kimetomo-mascot', '*/5 * * * *', 'select public.kimetomo_mascot_tick()');
end $$;
