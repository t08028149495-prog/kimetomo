# Claude への指示（キメ友SNS）

- 返答は日本語。Claude が行った作業の説明は書かず、ユーザーがやることだけを書く。
- 画面の操作を案内するときは、必ず最初に「そのページへ直接飛べるリンク」を出す。
  - Supabase は `https://supabase.com/dashboard/project/_/...`（`_` でプロジェクト選択になる）を使う。
  - GitHub は `https://github.com/t08028149495-prog/kimetomo/...` を使う。
- メニューの場所を言葉で説明するのは、リンクで飛べないときだけ。
- ユーザーは iPhone（Firefox）と GitHub Codespaces のターミナルで作業する。
- 入力する値は表にまとめない。値ごとに 1 つずつコードブロックに入れて、そのままコピーできるようにする。
