# Claude への指示（キメ友SNS）

- 返答は日本語。ユーザーはプログラミング初心者なので、専門用語は短く言い換えて、平易に書く。
- ユーザーは Windows（Chrome・VS Code・Claude アプリ内の PowerShell）。プロジェクトは `C:\Users\USER\dev\kimetomo`。

## トークンの節約
- 用事が終わり次が別の話なら「新規作成で新しいチャットを始めると軽くなります」と一言すすめる。
- スクリーンショットは 1 回に 1 枚だけ頼む。文字で済む確認は文字で。
- 頼まれたことが何を指すか分からないときは、探し回らず先に短く聞く。
- 詳しい説明は別ファイル。必要なときだけ該当部分を検索して読む：
  - `docs/FILES.md`：js・css・sw.js のファイルごとの仕組みと経緯。**そのファイルを直す前に該当行を読む。**
  - `docs/SERVICES.md`：メール通知・問い合わせ窓口・予備の公開場所・バックアップ・Turnstile。

## コードの決まり
- `index.html`（と `dm.html`）は骨組みだけ。見た目は `css/`、動きは `js/` に機能ごとに分けてある。直すときは該当ファイルだけ読む。`js/app.js` は大きいので検索して必要な部分だけ読む。
- CSS は読み込み順で上書きが決まるので、ファイルの順番を変えない（最後のほうは `glow` → `insta` → `tap` → `page-fx`）。
- 色は「夜のローズ」（暗いボルドー＋ローズピンク）にそろえる。
- タブの切り替えはエフェクトなし・いちばん速く（ユーザーの決定。付け直さない）。
- `trade-guard` の言葉の一覧は、JS と SQL の `kimetomo_trade_patterns` を同じにそろえる。
- `css/` `js/` を直したら、commit の前に `python scripts/bump_version.py` を実行する。
- 画面の幅 390〜412px で見やすく作る（開発の目安。メンバーに機種名は出さない）。対応は iOS 16.4 以降の Safari・Android の最新 Chrome。

## 作業の分担
- コードの検索・書き換えは Claude が直接やる。`git add` / `commit` / `push` も Claude がやってよい。push の前に何を変えたかを一言伝える。
- Supabase はコネクタでつながっている（プロジェクト「キメ友」、ID `hazcwbczsswjptvblpwt`）。SQL の実行・確認は Claude が直接やる。
  - データを消す・書き換える・公開範囲を変える SQL は、実行前にユーザーに一言確認する。読むだけなら確認なし。
  - 新しい SQL は `supabase/` にファイルとしても残す。
- Cloudflare（DNS・Turnstile など）は Claude in Chrome でユーザーの Chrome を操作して行う。変える前に毎回「何をどう変えるか」を確認する。終わったらタブを閉じる。
- ユーザーにやってもらうのは、見た目・動作の確認と、ログインなど本人しかできない操作だけ。コマンドは 1 行ずつ別のコードブロックに入れる。

## 動作確認
- ローカルは `python -m http.server 8000` で `http://localhost:8000`（`.claude/launch.json` に登録済み）。
- 画面の確認は Claude in Chrome を使う（内蔵ブラウザは Turnstile でログインできない）。開いたタブは確認が終わったら必ず閉じる（ログインしてもらう間だけは開いたままでよい）。
- ログインはユーザー本人が行う。Claude はパスワードを入力しない。
- ローカルでもデータは本番の Supabase。投稿・削除・リアクションを試すときはユーザーに一言伝える。
- 公開は GitHub Pages（`kimetomo.com`）。`main` に push すると数分で反映。

## 画面の案内
- 最初に「そのページへ直接飛べるリンク」を出す。Supabase は `https://supabase.com/dashboard/project/_/...`、GitHub は `https://github.com/t08028149495-prog/kimetomo/...`。
- 入力する値は表にせず、値ごとに 1 つずつコードブロックに入れる。
- Claude はユーザーがログインしている画面（Supabase・Cloudflare など）を見られない。推測で長い手順を書かず、スクリーンショットに写っている言葉だけで、1〜2 手順ずつ案内する。分からなければ正直に言ってスクリーンショットを頼む（`PrtSc` か `Alt` + `PrtSc` → `Ctrl` + `V`）。

## 秘密の情報
- 秘密鍵などは Supabase の Edge Functions → Secrets に登録済み。ローカルには不要。
- 秘密鍵・パスワード・`.env` の中身はチャットに貼らないよう、ユーザーに注意する。
