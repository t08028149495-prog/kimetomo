# 外のサービスまわり（キメ友）

CLAUDE.md から移した説明。メール・問い合わせ窓口・予備の公開場所・バックアップを直すときに読む。

## メール通知
- プロフィールでメールアドレスを登録すると、コメント・返信と DM をメールでも知らせる（`supabase/email_notify.sql`、Edge Function `kimetomo-email`）。
- 送信は Resend（ドメイン kimetomo.com、DNS は Cloudflare で自動設定済み）。API キーは Supabase の Secrets `RESEND_API_KEY`。
- メールには内容を書かない。同じ種類は 10 分に 1 回まで。確認メールのリンクを押した人にだけ送る。
- ログイン画面の「パスワードを忘れた方」から、確認済みのメール通知アドレスに再設定リンクを送る（`supabase/password_reset.sql`。リンクは 1 時間・1 回だけ）。
- メールの中のリンクは kimetomo.com にそろえる（`?email_verify=` `?email_off=` `?pw_reset=` を画面で受け取る）。DMARC は `p=none` で設定済み。

## 規約・窓口・予備（2026-11-09）
- 利用規約・お問い合わせは `terms.html`。
- 削除依頼の窓口 `contact@kimetomo.com` は Cloudflare Email Routing → Email Worker `kimetomo-contact-autoreply`（`scripts/contact-autoreply/`）で `t08028149495@gmail.com` に転送し、送り主へ決まった文で自動返信（ログイン・登録のよくある質問。自動のメール・自動返信への返信には返さない）。
  - 転送先は Worker の秘密の変数 `FORWARD_TO`。直したらそのフォルダで `npx wrangler deploy`。
  - 止めるときは Email Routing の contact@ の行き先を「メールに送信」に戻す。
- 予備の公開場所は Cloudflare Pages の `kimetomo`（https://kimetomo.pages.dev、`main` への push で自動更新）。切り替え方は `docs/FAILOVER.md`。
- 毎日の暗号化バックアップを PC（`C:\Users\USER\kimetomo-backups`）と Google ドライブ（`kimetomo-backups`）に保存：`scripts/pc_backup.ps1`。

## 動作確認の細かい話
- Claude アプリの内蔵ブラウザでは Turnstile の検証が失敗してログインできない（2026-11-25 に再確認：チェック欄を押しても「トラブルシューティング」が出て通らない。ログイン前の画面だけなら内蔵ブラウザで見られる）。
- Turnstile のホスト名には `localhost` を登録済み。VS Code の Live Server（`http://127.0.0.1:5500`）でログインするには、Turnstile に `127.0.0.1` も登録が必要（登録済みかは未確認）。
