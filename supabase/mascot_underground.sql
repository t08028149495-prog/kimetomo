-- キメ友SNS: キメ友のぞうの話題を「アングラ系」に入れ替える
--   ・都市伝説、オカルト、心霊、廃墟、未解決ミステリー、ネットの怖い噂、サブカル、深夜テンションの話題
--   ・違法なこと・薬物・危ない行為をすすめる話題は入れていません
--   ・今までの話題は kimetomo_mascot_topics_backup に保存してから外します（下の方法で元に戻せます）
--   ・投稿の時間帯や回数（1日最大7回など）は今までと同じです
-- 何度実行しても大丈夫です。
--
-- 【今までの話題に戻すとき】下の 3 行を実行する
--   delete from public.kimetomo_mascot_topics where theme = 'underground';
--   insert into public.kimetomo_mascot_topics (slot, body, poll_options)
--     select slot, body, poll_options from public.kimetomo_mascot_topics_backup on conflict (slot, body) do nothing;

alter table public.kimetomo_mascot_topics add column if not exists theme text not null default 'normal';

create table if not exists public.kimetomo_mascot_topics_backup (
  slot text not null,
  body text not null,
  poll_options text[],
  unique (slot, body)
);
alter table public.kimetomo_mascot_topics_backup enable row level security;
revoke all on public.kimetomo_mascot_topics_backup from anon, authenticated;

insert into public.kimetomo_mascot_topics_backup (slot, body, poll_options)
select slot, body, poll_options from public.kimetomo_mascot_topics where theme = 'normal'
on conflict (slot, body) do nothing;
delete from public.kimetomo_mascot_topics where theme = 'normal';

insert into public.kimetomo_mascot_topics (slot, body, poll_options, theme) values
-- ===== 朝 =====
('morning','おはよう…。今日見た夢、ちょっと怖くなかった？ 覚えてたら教えて🌫',null,'underground'),
('morning','朝からなんだけど、今まで見た中でいちばん意味わからない夢ってどんなの？',null,'underground'),
('morning','おはよう☀️ 「朝起きたら部屋の物の位置が変わってた」系の体験ある？',null,'underground'),
('morning','金縛りって、なったことある？ そのとき何か見えた？👁',null,'underground'),
('morning','おはよ。正夢を見たことある人いる？ 当たった話を聞かせて',null,'underground'),
('morning','朝のニュースで見た、ちょっと不気味な話ってある？',null,'underground'),
('morning','同じ夢を何回も見ることある？ どんな夢？',null,'underground'),
('morning','おはよう🐘 寝てる間に、聞こえるはずのない音で起きたことある？',null,'underground'),
('morning','朝の通学路・通勤路で「ここ、なんか空気が違う」って場所ある？',null,'underground'),
('morning','夢の中で「これは夢だ」って気づいたことある？ そのあと何した？',null,'underground'),
('morning','おはよう。デジャヴ（前にも同じことがあった気がする）って、よく起きる？',null,'underground'),
('morning','朝からごめん、子どものころ信じてた怖い言い伝えってある？',null,'underground'),
('morning','おはよう。夢占いって信じる派？ 最近見た夢、占ってみる？',null,'underground'),
('morning','寝言で変なこと言ってたって言われたことある？😂',null,'underground'),
('morning','朝起きたら、知らない番号から着信があった…みたいな経験ある？',null,'underground'),
-- ===== 昼 =====
('noon','お昼休みの暇つぶしに、知ってる都市伝説をひとつ教えて🕳',null,'underground'),
('noon','学校の七不思議、みんなの学校には何があった？',null,'underground'),
('noon','ネットで見つけた「これ本当？」っていう怖い噂ある？',null,'underground'),
('noon','昔のテレビで、子どもながらにトラウマになった番組やCMってある？📺',null,'underground'),
('noon','「絶対に検索してはいけない言葉」系、どこまで知ってる？（貼るのはナシで！）',null,'underground'),
('noon','お昼の話題に、ちょっと不思議な実話を聞かせて',null,'underground'),
('noon','地元に伝わる怖い話や、近づいちゃダメって言われてた場所ある？',null,'underground'),
('noon','好きなB級映画・カルト映画を教えて🎬',null,'underground'),
('noon','UFOやUMA（未確認生物）、どれがいちばんいると思う？',null,'underground'),
('noon','「昔あったのに、急に消えたお店・サービス」で謎だったものってある？',null,'underground'),
('noon','ネットの古い掲示板の名作スレ、覚えてるのある？',null,'underground'),
('noon','知る人ぞ知るマイナーなバンドやアーティスト、こっそり教えて🎧',null,'underground'),
('noon','お昼に聞くのもアレだけど、心霊写真って撮れたことある？',null,'underground'),
('noon','都市伝説の中で「これはガチかも」って思うのはどれ？',null,'underground'),
('noon','人に話しても信じてもらえなかった体験ってある？',null,'underground'),
-- ===== 午後 =====
('afternoon','午後の眠い時間に…未解決ミステリーで気になってるのある？🔍',null,'underground'),
('afternoon','廃墟の写真って見るの好き？ 行ってみたい（見てみたい）廃墟ある？',null,'underground'),
('afternoon','昔のゲームの怖い噂（裏技・呪いのデータとか）、覚えてる？🎮',null,'underground'),
('afternoon','陰謀論で「ちょっとおもしろい」と思うのはどれ？（ネタとして！）',null,'underground'),
('afternoon','サブカル好きな人〜！ 最近ハマってる漫画・アニメ・同人ある？',null,'underground'),
('afternoon','「これは見ない方がよかった…」って後悔した動画や映画ある？',null,'underground'),
('afternoon','パワースポットと心霊スポット、行くならどっち？',null,'underground'),
('afternoon','地図アプリで変なもの見つけたことある？🗺',null,'underground'),
('afternoon','都市伝説「きさらぎ駅」みたいな異世界系の話、好き？',null,'underground'),
('afternoon','子どものころの「見えないお友達」の話、聞いたことある？',null,'underground'),
('afternoon','ちょっと不気味なのに、なぜか好きなキャラクターっている？',null,'underground'),
('afternoon','昔流行ったチェーンメールや「回さないと不幸になる」系、覚えてる？',null,'underground'),
('afternoon','好きな怪談師やホラー系の配信者いる？👻',null,'underground'),
('afternoon','「これはさすがに偶然じゃない」と思った出来事ある？',null,'underground'),
('afternoon','夜中の学校やビルって、なんであんなに怖いんだろうね。怖い場所ランキング作るなら1位どこ？',null,'underground'),
-- ===== 夕方・夜 =====
('evening','夕方の「逢魔が時」って言葉、知ってた？ 夕方にゾッとしたことある？🌆',null,'underground'),
('evening','今夜観るなら、ホラー映画とミステリー映画どっち？ おすすめも教えて',null,'underground'),
('evening','帰り道で、ずっと後ろに誰かいる気がしたことある？',null,'underground'),
('evening','晩ごはん食べながら聞ける、ゆるめの怖い話ある？',null,'underground'),
('evening','あなたの住んでる地域の、ちょっと変わった風習ってある？',null,'underground'),
('evening','エレベーターの都市伝説（異世界に行く方法とか）、試したことある？（やらなくていいよ！）',null,'underground'),
('evening','テレビの心霊特番、昔見てた？ 印象に残ってる回ある？',null,'underground'),
('evening','「この家、なんか変」って思った家・部屋に住んだことある？🏚',null,'underground'),
('evening','人間がいちばん怖い…って思った話ある？（重すぎない範囲で）',null,'underground'),
('evening','夜の神社やお寺って、行ける派？ 行けない派？',null,'underground'),
('evening','今まで行った中で、いちばん雰囲気がヤバかった場所は？',null,'underground'),
('evening','好きな怖い漫画・ホラー小説を教えて📚',null,'underground'),
('evening','占いやおまじない、こっそり信じてるのある？',null,'underground'),
('evening','もし幽霊が見えるようになったら、まず何する？',null,'underground'),
('evening','「開けてはいけない」と言われてた押し入れや部屋、実家にあった？',null,'underground'),
-- ===== 深夜 =====
('night','こんな時間に起きてる人〜🌙 深夜にしか話せない話、しよ',null,'underground'),
('night','深夜テンションで聞くけど、今までで一番ゾッとした体験は？',null,'underground'),
('night','夜中にふと鏡を見るのが怖いの、わかる人いる？🪞',null,'underground'),
('night','深夜のコンビニで見た、ちょっと不思議な光景ある？',null,'underground'),
('night','夜中の2時〜3時って「丑三つ時」って言うらしいよ。今起きてる人、何してる？',null,'underground'),
('night','深夜ラジオ聴く人いる？ おすすめ教えて📻',null,'underground'),
('night','眠れない夜に読む（見る）ホラー、何がおすすめ？',null,'underground'),
('night','夜中に聞こえる謎の音、みんなの家でもある？（ラップ音とか）',null,'underground'),
('night','深夜の散歩って好き？ 夜の街の好きなところ教えて🌃',null,'underground'),
('night','誰にも言ってない小さな秘密、匿名っぽく言えるとしたら？（言える範囲で）',null,'underground'),
('night','黒歴史ってある？ 今だから笑える話、深夜だけ聞かせて🫣',null,'underground'),
('night','夜中に急に不安になること、何かある？ ここで吐き出してもいいよ',null,'underground'),
('night','この時間に聴きたい、ちょっとダークな曲を教えて🎵',null,'underground'),
('night','「深夜に検索して後悔したこと」ってある？（貼るのはナシで）',null,'underground'),
('night','夢と現実の区別がつかなくなったこと、ある？',null,'underground'),
('night','もし「この世のどこかの裏側」に行けるなら、どんな世界がいい？',null,'underground'),
('night','夜中に知らない人から届いた謎のメッセージ、もらったことある？',null,'underground'),
('night','真夜中に見ちゃダメな動画・ゲームってなんだと思う？',null,'underground'),
('night','深夜って、昼間には言えない本音が出るよね。今の本音を一言どうぞ',null,'underground'),
('night','寝る前に怖い話を聞くと眠れなくなる派？ 逆にぐっすり派？',null,'underground'),
('night','暗闇でいちばん怖いのって、何がいると思っちゃう？',null,'underground'),
('night','夜の電車や駅で、ちょっと変わった体験したことある？🚉',null,'underground'),
('night','「ここだけの話」があったら、ちょっとだけ聞かせて（人を傷つけない範囲で！）',null,'underground'),
('night','もうすぐ朝だね…。夜ふかし仲間、今日は何してた？',null,'underground'),
('night','こんな時間だけど、今いちばん気になってる謎って何？',null,'underground'),
-- ===== いつでも =====
('any','世界の未解決事件・ミステリーで、いちばん気になるのは？',null,'underground'),
('any','都市伝説「口裂け女」「人面犬」世代？ それとももっと新しい派？',null,'underground'),
('any','インターネットの古いホームページ文化、覚えてる？ キリ番とか掲示板とか💾',null,'underground'),
('any','「実は〇〇は存在しない」系のネタ、何か知ってる？（ネタとして！）',null,'underground'),
('any','タイムトラベラーの話、信じる？ 未来から来た人がいたら何を聞く？',null,'underground'),
('any','知る人ぞ知る、ちょっと変わった趣味を持ってる人いる？',null,'underground'),
('any','好きなホラーゲームある？ 怖くて最後までできなかったゲームも教えて',null,'underground'),
('any','もし秘密結社に入れるとしたら、どんな結社がいい？😂',null,'underground'),
('any','昔の雑誌の怪しい通販広告（幸運のブレスレットとか）、覚えてる？',null,'underground'),
('any','「呪いの〇〇」系の話で知ってるのある？',null,'underground'),
('any','奇妙な偶然が重なった体験ってある？',null,'underground'),
('any','宇宙人がもう地球にいるとしたら、どこに隠れてると思う？👽',null,'underground'),
('any','世界の不思議な場所（ナスカの地上絵とか）で、行ってみたいところは？',null,'underground'),
('any','「昔の写真に写ってる人が誰かわからない」みたいな体験ある？',null,'underground'),
('any','好きな妖怪っている？ 推し妖怪を教えて',null,'underground'),
('any','もし1日だけ透明人間になれたら、どこに行く？（いたずらはほどほどに）',null,'underground'),
('any','インディーズやアングラなライブ・イベントに行ったことある？',null,'underground'),
('any','怖いけどつい見ちゃう、事故物件系の話ってどう？',null,'underground'),
('any','ネットで有名な「怖い話」で、いちばん好きなのは？',null,'underground'),
('any','もし地下に秘密の部屋があったら、何に使う？',null,'underground'),
('any','「知らなきゃよかった雑学」を1つ教えて🧠',null,'underground'),
('any','ドッペルゲンガー（自分そっくりの人）を見たことある人いる？',null,'underground'),
('any','予言やノストラダムス系の話、どれくらい信じてる？',null,'underground'),
('any','夢の中でだけ行ける場所ってある？',null,'underground'),
('any','もし怪談を1つ作るなら、どんな話にする？ 書き出しだけでも！',null,'underground'),
-- ===== アンケート =====
('any','幽霊って、いると思う？👻',array['いると思う','いないと思う','見たことある','わからない'],'underground'),
('any','いちばん怖いのはどれ？',array['幽霊','人間','宇宙人','虫'],'underground'),
('any','心霊スポット、誘われたら行く？',array['喜んで行く','昼なら行く','絶対行かない'],'underground'),
('any','UFOって、いると思う？🛸',array['いる','いない','もう来てる','どうでもいい'],'underground'),
('any','ホラー映画は好き？',array['大好き','たまに観る','苦手','観たことない'],'underground'),
('night','この時間まで起きてる理由は？',array['眠れない','夜型','仕事・作業','なんとなく'],'underground'),
('night','夜中の怖い話、聞きたい？',array['聞きたい','ちょっとだけ','やめて'],'underground'),
('any','都市伝説、どれくらい信じる？',array['けっこう信じる','半分くらい','ほぼ信じない','ネタとして楽しむ'],'underground'),
('evening','今夜の気分は？',array['ホラー','ミステリー','ゆるい話','寝る'],'underground'),
('any','タイムマシンがあったら？',array['過去に行く','未来に行く','行かない'],'underground')
on conflict (slot, body) do update set theme = 'underground', poll_options = excluded.poll_options;

-- ========== 確認 ==========
select theme as 種類, count(*) as 話題の数 from public.kimetomo_mascot_topics group by theme
union all
select '保存した今までの話題', count(*) from public.kimetomo_mascot_topics_backup;
