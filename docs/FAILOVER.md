# キメ友SNS 予備の公開場所への切り替え手順

GitHub（GitHub Pages）が使えなくなったときに、kimetomo.com を Cloudflare Pages の予備に切り替える手順です。

## ふだんの状態
- 本番：GitHub Pages（`main` に push すると数分で kimetomo.com に反映）
- 予備：Cloudflare Pages のプロジェクト `kimetomo`（https://kimetomo.pages.dev）
  - `main` に push するたびに、自動で同じ中身に更新される
  - `scripts/build_pages.py` が、開発用ファイル（CLAUDE.md・docs・supabase・scripts）を外して `dist/` に集める
  - GitHub が止まっても、最後に作られた予備はそのまま残る
- 予備の `pages.dev` ではログインできない（Turnstile に `kimetomo.pages.dev` を登録していないため）。切り替えて kimetomo.com で開けばログインできる。

## 切り替え方（Cloudflare）
1. https://dash.cloudflare.com/?to=/:account/workers-and-pages を開き、プロジェクト `kimetomo` →「カスタム ドメイン」→「カスタム ドメインを設定」で `kimetomo.com` を追加する。
2. 今の DNS（GitHub Pages を指している `kimetomo.com` の A / CNAME レコード）と重なっていると言われたら、案内にしたがって置き換える。
   - メールのレコード（MX・`send` で始まるもの・`_dmarc`・`resend._domainkey`・`cf2024-1._domainkey`・SPF の TXT）は消さない。
3. 数分〜数十分で kimetomo.com が予備に切り替わる。ログイン・投稿・通知は Supabase につながっているので、そのまま使える。

## GitHub が使えなくなったときのコード・データ
- コード：PC の `C:\Users\USER\dev\kimetomo` と、毎日の暗号化バックアップの中の `source.bundle`
- データ：Supabase はそのまま。バックアップは PC の `C:\Users\USER\kimetomo-backups`（30日分）と Google ドライブの `kimetomo-backups`（14日分）
  - PC への保存は `scripts/pc_backup.ps1`（Windows のタスク「KimetomoBackup」で毎朝 8 時とログイン時）。GitHub が止まると新しいバックアップは作られないので、そのときは手元の最新のものを使う。
- 復元のしかたは `docs/RESTORE.md`
