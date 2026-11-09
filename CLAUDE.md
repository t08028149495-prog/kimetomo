# Claude への指示（キメ友SNS）

- 返答は日本語。ユーザーはプログラミング初心者なので、専門用語は短く言い換えて、平易に書く。
- ユーザーは Windows のパソコンで開発している（2026-11 に iPhone + Codespaces から移行）。
  - ブラウザは Chrome、エディタは VS Code、ターミナルは Claude アプリ内の PowerShell。
  - プロジェクトの場所は `C:\Users\USER\dev\kimetomo`。

## トークンの節約
- 1 つの用事が終わり、次が別の話になったら「新規作成で新しいチャットを始めると軽くなります」と一言すすめる（CLAUDE.md とメモで話は引き継がれる）。
- スクリーンショットは 1 回に 1 枚だけ頼む。文字で済む確認（「できた」・エラーの文章など）は文字で送ってもらう。
- 頼まれたことが何を指すか分からないときは、前の会話を長く探し回らず、先に短く聞く（例：「どのリストの 2 番ですか？」）。
- `index.html` は画面の骨組み（HTML）だけ。見た目は `css/`、動きは `js/` に機能ごとに分けてある。直すときは該当ファイルだけ読む。
  - `js/app.js`：本体（ログイン・プロフィール・タイムライン・コメント・リアクション・通知ベル・2段階認証・画像・チャット）。大きいので検索して必要な部分だけ読む。
  - ほかの `js/`：`tabs` タブ切替／`maintenance` メンテ表示／`monitoring` エラー報告・解析／`invite` 友達招待／`poll` アンケート／`topic` お題／`mood` 気分／`requests` 機能リクエスト／`inapp-browser` アプリ内ブラウザ案内／`update-notice` 更新のお知らせ／`pull-refresh` 引っぱって更新／`linkify` リンク化／`compose-toggle` 投稿欄の開閉・プロフィール編集／`quick-compose` いつでも投稿欄／`chat-latest` チャットの最新へ／`ng-words` 使えない言葉／`soft-filter` 注意する言葉／`pinned-notice` 固定のお知らせ／`bug-report` 不具合報告／`gender-age` 性別・年齢／`women-guide` ♀と性別を選んでいない人にプロフィールに固定で出す「女性に便利な機能紹介」の案内（DM対策・性別を隠す・ブロックなど）／`support` 応援／`live` リアルタイム更新（新しい投稿の案内・ベル）／`device-cache` 端末に覚えておく（名前・アイコン3時間、管理人の印1時間、メンバー一覧10分、DMの最新、自分の設定〔ブロック・ミュート・メール・プッシュ30分、プロフィール・安心の設定10分。自分で変えたら `kmDC.mine.forget` で消す〕、グループチャットの各ルームのメッセージ（10分以内に全部読んだものを土台に新しい分だけ読む）、DMの会話（新しい分だけ。1日1回全部読み直す）、入っているルーム一覧10分、アプリの設定〔固定のお知らせ・応援・機能リクエストの受付〕10分（`kmDC.setting`、管理者が保存したら `kmDC.del('set-キー')`）。パソコン版も同じコード。キーは `km-c-`、ログアウトで全部消す。Supabase の負担を減らすため）／`lite` 軽量モード（遅い端末だけ、ぼかし・動く背景の光・タブ切替の動き・きらめきを止める。メモリ4GB以下・4コア以下はすぐ、ほかは開いて約3秒なめらかさを測って3日覚える。プロフィールの「⚡ 軽量モード」で自動／いつも／使わないを選べる。キーは `km-lite` でログアウトしても消さない。`<head>` で読み込む。見た目は `glow.css` の最後）／`admin-ban` `admin-today` `admin-invite` `admin-tabs` 管理者メニュー。
  - `css/`：`base` 基本・タイムライン／`nav-profile` 下のタブ・ベル・プロフィール／`features` アンケート・お題・気分など／`login-misc` ログイン・パスワード・リアクション・リンク／`admin` 管理者／`tweaks` 後からの調整／`chat` チャット／`desktop` パソコン用（幅 900px 以上で左メニュー・大きい投稿欄、1200px 以上で通知を右に出す）／`motion` 画面の切り替えアニメ・夜のローズ（ピンク→ラベンダー）の飾り・きらめき／`glow` 2026-11 の新デザイン（ただよう背景の光・すりガラスの浮いた下タブ・下から出るプロフィール・パソコンの光る左メニュー。いちばん最後に読み込む。index.html と dm.html の両方）。色は「夜のローズ」（暗いボルドー＋ローズピンク）にそろえる。CSS は読み込み順で上書きが決まるので、ファイルの順番を変えない。
  - `css/` `js/` を直したら、commit の前に `python scripts/bump_version.py` を実行する（`index.html` の `?v=` が変わり、開きっぱなしのアプリに「更新する」が出る）。

## 推奨環境（2026-11-09）
- おすすめは iPhone 15 以降・Pixel 7 以降（画面の幅 393〜412px）。この幅で見やすいように作る。最低限の対応は iPhone の iOS 16.4 以降・Android の最新 Chrome（ログイン画面の「対応環境」と `terms.html` の 6 番に記載）。

## 作業の分担
- コードの検索・書き換えは Claude が直接やる（ユーザーに手作業で置換させない）。
- `git add` / `git commit` / `git push` も Claude が実行してよい。push する前に、何を変えたかを一言伝える。
- Supabase は Claude のコネクタでつながっている（プロジェクト「キメ友」、ID `hazcwbczsswjptvblpwt`）。SQL の実行・データの確認は Claude が直接やる。
  - データを消す・書き換える・公開範囲を変える SQL は、実行する前にユーザーに一言確認する。読むだけの SQL は確認なしでよい。
  - 新しい SQL は `supabase/` にファイルとしても残す。
- Cloudflare（DNS・Turnstile など。kimetomo.com の DNS は Cloudflare）は、Claude が Claude in Chrome でユーザーの Chrome（ログイン済み）を操作して行う。
  - 設定を変える前に、毎回「何をどう変えるか」をユーザーに確認してから実行する。終わったらタブを閉じる。
- ユーザーにやってもらうのは、ブラウザでの見た目・動作の確認と、ログインなど本人しかできない操作だけ。
- ユーザーにコマンドを実行してもらうときは、1 行ずつ別のコードブロックに入れる。

## 動作確認
- ローカル確認は `python -m http.server 8000` で `http://localhost:8000` を開く（`.claude/launch.json` に登録済み）。
  - Claude が画面を確認するときは、Claude in Chrome（ユーザーの Chrome）を使う。Claude アプリの内蔵ブラウザでは Turnstile の検証が失敗してログインできない。
  - Chrome で Claude が開いたタブ（タブグループ）は、確認が終わったら毎回必ず閉じる。ユーザーにログインしてもらう間だけは開いたままでよい。
- ログイン画面には Cloudflare Turnstile がある。Turnstile のホスト名には `localhost` を登録済み。
  - VS Code の Live Server（`http://127.0.0.1:5500`）でログインするには、Turnstile に `127.0.0.1` も登録が必要（登録済みかは未確認）。
- ログインはユーザー本人が行う。Claude はパスワードを入力しない。
- ローカルでもデータは本番の Supabase につながっている。投稿・削除・リアクションは本番に反映されるので、試すときはユーザーに一言伝える。
- 公開は GitHub Pages（`kimetomo.com`）。`main` に push すると数分で反映される。

## 画面の案内
- 画面の操作を案内するときは、必ず最初に「そのページへ直接飛べるリンク」を出す。
  - Supabase は `https://supabase.com/dashboard/project/_/...`（`_` でプロジェクト選択になる）を使う。
  - GitHub は `https://github.com/t08028149495-prog/kimetomo/...` を使う。
- メニューの場所を言葉で説明するのは、リンクで飛べないときだけ。
- 入力する値は表にまとめない。値ごとに 1 つずつコードブロックに入れて、そのままコピーできるようにする。
- Claude はユーザーがログインしている画面（Supabase・Cloudflare・XServer など）を直接見ることができない（Computer use が使えるチャットでは、許可をもらえば見られる）。
  - 画面の様子を推測して長い手順を書かない。送られたスクリーンショットに写っている言葉・ボタン名だけを使って説明する。
  - 初めての画面では 1〜2 手順ずつ案内し、次の画面のスクリーンショットをもらってから続ける。
  - 画面が分からないときは、分からないと正直に伝えてスクリーンショットを頼む。
  - スクリーンショットは `PrtSc`（画面全体）か `Alt` + `PrtSc`（今のウィンドウだけ）でコピーし、チャットに `Ctrl` + `V` で貼ってもらう。

## メール通知
- プロフィールでメールアドレスを登録すると、コメント・返信と DM をメールでも知らせる（`supabase/email_notify.sql`、Edge Function `kimetomo-email`）。
- 送信は Resend（ドメイン kimetomo.com、DNS は Cloudflare で自動設定済み）。API キーは Supabase の Secrets `RESEND_API_KEY`。
- メールには内容を書かない。同じ種類は 10 分に 1 回まで。確認メールのリンクを押した人にだけ送る。
- ログイン画面の「パスワードを忘れた方」から、確認済みのメール通知アドレスに再設定リンクを送る（`supabase/password_reset.sql`。リンクは 1 時間・1 回だけ）。
- メールの中のリンクは kimetomo.com にそろえる（`?email_verify=` `?email_off=` `?pw_reset=` を画面で受け取る）。DMARC は `p=none` で設定済み。

## 規約・窓口・予備（2026-11-09）
- 利用規約・お問い合わせは `terms.html`。削除依頼の窓口 `contact@kimetomo.com` は Cloudflare Email Routing で `t08028149495@gmail.com` に転送。
- 予備の公開場所は Cloudflare Pages の `kimetomo`（https://kimetomo.pages.dev、`main` への push で自動更新）。切り替え方は `docs/FAILOVER.md`。
- 毎日の暗号化バックアップを PC（`C:\Users\USER\kimetomo-backups`）と Google ドライブ（`kimetomo-backups`）に保存：`scripts/pc_backup.ps1`。

## 秘密の情報
- VAPID 秘密鍵などは Supabase の Edge Functions → Secrets に登録済み。ローカルには不要。
- 秘密鍵・パスワード・`.env` の中身はチャットに貼らないよう、ユーザーに注意する。
