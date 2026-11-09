-- キメ友SNS: 自動投稿のキャラクターを「恋愛マスターひろし」にして、話題を恋愛だけにする（2026-11-09）
--   ・名前を「キメ友のぞう」→「恋愛マスターひろし」に変える（ログイン用のユーザー名は変えない。見える名前と自己紹介だけ）
--   ・話題は恋愛だけ（片思い・告白・デート・恋愛の本音・失恋など）。性的な話題は入れない
--   ・今までのアングラ系の話題は消さずに残し、設定 theme で切り替える（kimetomo_mascot_settings の theme = 'love'）
--   ・投稿の時間帯や回数（1日最大7回など）は今までと同じ。前置き・しめの言葉はひろしの口調にする
-- mascot_setup.sql・mascot_underground.sql の後に実行。何度実行しても大丈夫です。
--
-- 【アングラ系の話題に戻すとき】下の 1 行を実行する
--   update public.kimetomo_mascot_settings set value = 'underground' where key = 'theme';

insert into public.kimetomo_mascot_settings (key, value) values ('theme', 'love')
on conflict (key) do update set value = excluded.value;

-- 見える名前と自己紹介
update public.kimetomo_user_profiles
   set display_name = '恋愛マスターひろし',
       bio = '恋愛マスターひろしです💌 恋バナの話題をふるのが仕事！ 片思いも失恋も、気軽に答えてね'
 where user_id = public.kimetomo_mascot_id();
update public.circle_profiles set display_name = '恋愛マスターひろし' where user_id = public.kimetomo_mascot_id();

insert into public.kimetomo_mascot_topics (slot, body, poll_options, theme) values
-- ===== 朝 =====
('morning','おはよう☀️ 好きな人から朝LINEが来たら、何分で返す？',null,'love'),
('morning','朝起きていちばんに連絡したい人っている？',null,'love'),
('morning','理想の朝デートってどんなの？',null,'love'),
('morning','おはよう！ 好きな人の夢を見たことある？ どんな夢だった？',null,'love'),
('morning','恋してると朝の目覚めが良くなる派？ 変わらない派？',null,'love'),
('morning','「おはよう」の一言でキュンとしたことある？',null,'love'),
('morning','好きな人に会う日の朝、いちばん気合いを入れるところは？',null,'love'),
('morning','寝起きの顔、恋人に見せられる？ 見せられない？',null,'love'),
('morning','おはよう！ 恋愛運を上げるために朝やってることある？',null,'love'),
('morning','朝の「おはよう」メッセージ、送る派？ 送られたい派？',null,'love'),
('morning','恋人と朝を過ごすなら、カフェ？ 散歩？ 家でゆっくり？',null,'love'),
('morning','好きな人に会えると思うと、早起きできるタイプ？',null,'love'),
('morning','おはよう💌 最近キュンとしたこと、朝から教えて！',null,'love'),
('morning','恋人と朝ごはんを食べるなら、何が食べたい？',null,'love'),
('morning','おはよう！ 今日、好きな人に会える予定ある？',null,'love'),
-- ===== 昼 =====
('noon','お昼休みに好きな人から連絡が来たらうれしい？',null,'love'),
('noon','恋人とランチするなら、どんなお店がいい？',null,'love'),
('noon','初デートのごはん、何を食べたら正解だと思う？',null,'love'),
('noon','食べ方で相手の印象って変わる？',null,'love'),
('noon','職場恋愛・バイト先の恋愛ってあり？ なし？',null,'love'),
('noon','お弁当を作ってもらいたい派？ 作ってあげたい派？',null,'love'),
('noon','初デートは割り勘？ おごり？',null,'love'),
('noon','人を好きになる瞬間って、どんなときが多い？',null,'love'),
('noon','一目惚れってしたことある？',null,'love'),
('noon','恋人に求めるもの、ひとつだけ選ぶなら？',null,'love'),
('noon','友達の恋バナ、聞くのは好き？',null,'love'),
('noon','好きな人のLINE、どのくらいで返すのがちょうどいい？',null,'love'),
('noon','お昼の恋バナタイム！ 最近いい出会いあった？',null,'love'),
('noon','「この人いいかも」って思うポイントはどこ？',null,'love'),
('noon','好きな人と好きな食べ物が同じだったらうれしい？',null,'love'),
-- ===== 午後 =====
('afternoon','告白はする派？ される派？',null,'love'),
('afternoon','告白するなら、直接？ LINE？ 電話？',null,'love'),
('afternoon','いちばん思い出に残ってるデート、どこに行った？',null,'love'),
('afternoon','好きな人の前だと素が出せる？ 出せない？',null,'love'),
('afternoon','恋人に言われてうれしかった言葉は？',null,'love'),
('afternoon','脈ありサインって、どうやって見分ける？',null,'love'),
('afternoon','恋人に「ここは直してほしい」って言えるタイプ？',null,'love'),
('afternoon','年上・年下・同い年、どれが好き？',null,'love'),
('afternoon','恋愛で「これだけは譲れない」ってことある？',null,'love'),
('afternoon','自分の恋愛、100点満点で何点？',null,'love'),
('afternoon','遠距離恋愛、できる？ できない？',null,'love'),
('afternoon','片思いと両思い、どっちの時期が好き？',null,'love'),
('afternoon','恋人と行ってみたい場所は？',null,'love'),
('afternoon','友達から恋人になったことある？',null,'love'),
('afternoon','好きな人にだけ見せる顔ってある？',null,'love'),
-- ===== 夕方〜夜 =====
('evening','夜ごはんデート、理想のお店は？',null,'love'),
('evening','おうちデートなら、何して過ごしたい？',null,'love'),
('evening','仕事や学校のあとに会いたくなる人っている？',null,'love'),
('evening','記念日って大事にする派？',null,'love'),
('evening','恋人へのプレゼントで、いちばん喜ばれたものは？🎁',null,'love'),
('evening','嫉妬しやすい？ しにくい？',null,'love'),
('evening','恋人のスマホ、見たいと思う？',null,'love'),
('evening','ケンカしたら、先に謝る派？',null,'love'),
('evening','恋人と連絡を取るのは、どのくらいの頻度がいい？',null,'love'),
('evening','恋人の友達とも仲良くしたい派？',null,'love'),
('evening','好きな人と電話するなら、何時間いける？📞',null,'love'),
('evening','好きな恋愛ドラマ・恋愛映画は？🎬',null,'love'),
('evening','恋人に「ありがとう」、ちゃんと伝えてる？',null,'love'),
('evening','夕暮れどきに思い出す恋ってある？',null,'love'),
('evening','今日、誰かにドキッとした？',null,'love'),
('evening','デートの帰り道、何を話すのが好き？',null,'love'),
-- ===== 夜中 =====
('night','夜になると好きな人のこと考えちゃう人〜？🌙',null,'love'),
('night','深夜の電話、好き？',null,'love'),
('night','元恋人のこと、まだ思い出すことある？',null,'love'),
('night','忘れられない恋ってある？',null,'love'),
('night','恋愛でいちばんの失敗談、こっそり教えて',null,'love'),
('night','好きな人に送れずに消したメッセージってある？',null,'love'),
('night','夜中に恋愛ソングを聴いて泣いたことある？ 何の曲？🎧',null,'love'),
('night','恋人と別れた理由、言える範囲で教えて',null,'love'),
('night','復縁ってあり？ なし？',null,'love'),
('night','好きなのに、気持ちを言えなかった人っている？',null,'love'),
('night','いちばん長く続いた恋愛は何年？',null,'love'),
('night','恋愛で後悔してること、ある？',null,'love'),
('night','初恋はいつ？ どんな人だった？',null,'love'),
('night','今の自分、恋愛したい？ それとも一人が楽？',null,'love'),
('night','恋人に「重い」って言われたことある？',null,'love'),
('night','深夜テンションで告白したことある？😂',null,'love'),
('night','恋人と夜ふかしするなら、何をする？',null,'love'),
('night','寝る前に「おやすみ」って送りたい人いる？',null,'love'),
('night','好きな人の写真、こっそり見返しちゃうタイプ？',null,'love'),
('night','失恋から立ち直る方法、教えて',null,'love'),
('night','「運命の人」っていると思う？',null,'love'),
('night','恋人に言えない、ちょっとした秘密ってある？',null,'love'),
('night','恋愛で泣いたこと、ある？',null,'love'),
('night','夜の恋バナしよ🌙 今いちばん気になってる人のこと、話せる範囲で',null,'love'),
('night','結婚願望ってある？',null,'love'),
('night','おやすみ前に、好きなタイプを一言で！',null,'love'),
-- ===== いつでも =====
('any','好きなタイプの芸能人は？',null,'love'),
('any','恋人に求める条件、ベスト3は？',null,'love'),
('any','自分は「恋愛体質」だと思う？',null,'love'),
('any','マッチングアプリで出会ったことある？',null,'love'),
('any','理想のプロポーズは？💍',null,'love'),
('any','恋人とのおそろいグッズ、あり？ なし？',null,'love'),
('any','恋愛相談するなら、誰にする？',null,'love'),
('any','束縛する派？ される派？ どっちもイヤ派？',null,'love'),
('any','恋人ができたらSNSに載せる派？',null,'love'),
('any','モテ期って来たことある？',null,'love'),
('any','恋愛で「これは冷めた」って瞬間は？',null,'love'),
('any','好きな人の前でやっちゃった、恥ずかしいことは？',null,'love'),
('any','飲み会での出会い、あり？',null,'love'),
('any','恋人の手料理、何が食べたい？',null,'love'),
('any','好きな人の「好きなところ」、3つ言える？',null,'love'),
('any','告白がうまくいくコツって何だと思う？',null,'love'),
('any','恋愛に年の差って関係ある？',null,'love'),
('any','ドラマみたいな恋の出来事、あったことある？',null,'love'),
('any','恋のキューピッドになったことある？',null,'love'),
('any','ひろしに恋愛相談したいこと、コメントで送って！ 本気で答えるよ💌',null,'love'),
('any','恋愛で大事なのはどれ？',array['見た目','性格','価値観','タイミング'],'love'),
('any','浮気の線引き、どこから？',array['2人きりでごはん','こまめなLINE','手をつなぐ','隠しごとをした時点'],'love'),
('any','初デートで行くならどこ？',array['カフェ','映画','水族館','居酒屋'],'love'),
('any','恋人との連絡、どれがちょうどいい？',array['1日中ずっと','朝と夜だけ','用事があるときだけ','電話派'],'love'),
('any','恋人とケンカしたらどうする？',array['すぐ話し合う','少し時間をおく','先に謝る','相手が謝るまで待つ'],'love'),
('any','好きな人ができたらどうする？',array['すぐアピール','様子を見る','友達に相談','気持ちを隠す'],'love'),
('any','恋人にいちばん求めるのは？',array['やさしさ','おもしろさ','安心感','尊敬できるところ'],'love'),
('any','記念日はどのくらい祝う？',array['毎月祝う','1年ごと','気が向いたら','祝わない'],'love'),
('any','元恋人とはどんな関係？',array['友達でいられる','連絡しない','たまに思い出す','完全に忘れた'],'love')
on conflict (slot, body) do nothing;

-- 自動投稿：設定のテーマ（theme）の話題だけを使う。前置き・しめの言葉はひろしの口調
create or replace function public.kimetomo_mascot_tick(p_force boolean default false)
returns text language plpgsql security definer set search_path to 'public'
as $function$
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
  th text := public.kimetomo_mascot_setting('theme', 'love');
  pre text[] := array['', '', '', 'ねえねえ、', 'みんなに質問！ ', 'ふと気になったんだけど、', 'ちょっと聞いて〜 ', 'ひろしから恋の質問💌 ', '恋バナしよ！ ', 'みんなの本音が聞きたい！ '];
  post text[] := array['', '', '', ' 💌', ' コメントで教えてね！', ' 気軽に答えてね〜', ' ひとことでもOK！', ' みんなの答え、楽しみにしてる！', ' ひろしも気になる💘'];
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

  -- 毎回同じ時刻（7:00, 10:00…）にならないよう、枠ごとに 0〜89 分のずれを入れる
  if ((h - (7 + 3 * substr(win, 2)::int) + 48) % 24) * 60 + extract(minute from now() at time zone 'Asia/Tokyo')::int
     < abs(hashtext(today::text || win)) % 90 then
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
  where t.theme = th and t.slot = want and (t.last_used_at is null or t.last_used_at < now() - interval '10 days')
  order by random() limit 1;
  if not found then
    select * into pick from public.kimetomo_mascot_topics t
    where t.theme = th and t.slot in (slot_now, 'any', 'm' || mon)
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
end $function$;

select 'OK：自動投稿を「恋愛マスターひろし」の恋愛の話題にしました' as 結果;
