# キメ友SNS Push通知 設定手順

## 1. 表を作る（Supabase）
1. Codespaces で `code supabase/push_setup.sql` を実行し、開いたファイルの中身をすべてコピー
2. Supabase → **SQL Editor** → New query に貼り付けて **Run**
3. `Success. No rows returned` と出ればOK

## 2. Edge Function を作る（Supabase）
1. Codespaces で `code supabase/functions/send-push/index.ts` を実行し、中身をすべてコピー
2. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**
3. 関数名を `send-push` にして、中身を貼り付けて **Deploy**

## 3. 秘密の値を登録（Supabase）
Supabase → **Edge Functions** → **Secrets** に 4 つ追加：

| 名前 | 値 |
|---|---|
| `VAPID_PUBLIC_KEY` | `vapid-public.js` の `"` と `"` の間の文字列 |
| `VAPID_PRIVATE_KEY` | `.secrets/` に保存した秘密鍵 |
| `VAPID_SUBJECT` | `mailto:自分のメールアドレス` |
| `WEBHOOK_SECRET` | Codespaces で `openssl rand -hex 24` を実行して出た文字列 |

`WEBHOOK_SECRET` の値は 4 でも使うので、パスワードアプリに保存しておく。

## 4. Webhook を作る（Supabase）
Supabase → **Database** → **Webhooks** → **Create a new hook** を 2 回：

| 項目 | 1つ目 | 2つ目 |
|---|---|---|
| Name | `push-dm` | `push-circle` |
| Table | `kimetomo_direct_messages` | `circle_messages` |
| Events | Insert | Insert |
| Type | Supabase Edge Functions | Supabase Edge Functions |
| Function | `send-push` | `send-push` |

両方とも HTTP Headers で：
- **Add auth header with service key** を押す
- **Add a new header** → 名前 `x-webhook-secret`、値は 3 の `WEBHOOK_SECRET`

## 5. 動作確認
1. iPhone のホーム画面から キメ友SNS を開く
2. プロフィール画面の「通知」→ **🔔 通知をオンにする** → 許可
3. 別の人（または別の端末）からメッセージを送ってもらう
4. 通知が届けば完了

届かない場合：Supabase → Edge Functions → send-push → **Logs** のスクリーンショットを Claude に送る。
