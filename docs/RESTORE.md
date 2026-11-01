# キメ友SNS 復元手順書

毎日のバックアップ（GitHub Actions「Kimetomo encrypted backup」）から、
データを元に戻すための手順です。iPhone + Codespaces のターミナルで進める前提で書いています。

> ⚠️ この手順は、まだ本番で試していません。
> 本当に困ったときに慌てないよう、一度 **テスト用の Supabase プロジェクト** で練習しておくのがおすすめです（無料枠で 2 つまで作れます）。

---

## 0. 用意するもの

| もの | どこにあるか |
|---|---|
| バックアップのパスワード（16文字） | パスワードアプリ「kimetomo-backup」 |
| 復元先の DB 接続文字列（Session pooler） | Supabase → Project Settings → Database → Connection string |
| 復元先の Project URL と service_role キー | Supabase → Project Settings → API |

バックアップの中身：

```
backup/
  database.dump      … データベース（public / auth / storage）
  storage/           … 画像などのファイル と manifest.json
  source.bundle      … ソースコード一式（Git）
```

---

## 1. バックアップを取ってきて復号する

Codespaces のターミナルで実行します。

**① 使いたいバックアップの実行番号（Run ID）を調べる**
```
gh run list -w kimetomo-backup.yml -L 5
```
一番左の数字が Run ID です（新しいものが上）。

**② ダウンロード**（`RUN_ID` を ① の数字に置き換える）
```
gh run download RUN_ID -n kimetomo-full-backup -D /tmp/kb && ls -l /tmp/kb
```

**③ パスワードを入力**（画面には何も出ません）
```
read -rs PW; echo
```
確認：
```
printf '%s' "$PW" | wc -m
```
`16` と出れば OK。`32` なら 2 回入っているので ③ をやり直す。

**④ 復号して展開**
```
mkdir -p /tmp/restore && printf '%s' "$PW" | openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in /tmp/kb/kimetomo-backup.tar.gz.enc -pass stdin | tar -xzf - -C /tmp/restore && ls -R /tmp/restore | head -30
```
`backup/database.dump` などが見えれば成功。
```
unset PW
```

---

## 2. データベースを戻す

**① 接続文字列を入力**（画面には何も出ません）
```
read -rs DB; echo; export DB
```

**② 表・関数・ポリシー（public）を戻す**
```
docker run --rm --network host -e DB -v /tmp/restore/backup:/backup postgres:18 sh -c 'pg_restore --no-owner --no-acl --schema=public -d "$DB" /backup/database.dump'
```

**③ ユーザー情報とファイル情報（auth / storage のデータ）を戻す**
```
docker run --rm --network host -e DB -e PGOPTIONS="-c session_replication_role=replica" -v /tmp/restore/backup:/backup postgres:18 sh -c 'pg_restore --no-owner --no-acl --data-only --schema=auth --schema=storage -d "$DB" /backup/database.dump'
```
- `schema_migrations` や `migrations` に関する「duplicate key」エラーは、新しいプロジェクトに最初から入っている行と重なっただけなので無視して大丈夫です。
- それ以外のエラーが出たら、画面のスクリーンショットを Claude に見せてください。

**④ 手動で確認が必要なもの**
次の 2 つは ③ では戻りません。一覧を出して Claude に見せ、必要なものだけ戻します。
- Storage のアクセス権（storage.objects のポリシー）
- auth.users に付けたトリガー（新規登録時にプロフィールを作る処理など）
```
docker run --rm -v /tmp/restore/backup:/backup postgres:18 sh -c 'pg_restore -l /backup/database.dump' | grep -E 'POLICY|TRIGGER' | grep -E ' (auth|storage) '
```

---

## 3. 画像などのファイルを戻す

```
read -rs SUPABASE_SERVICE_ROLE_KEY; echo; export SUPABASE_SERVICE_ROLE_KEY
export SUPABASE_URL=https://xxxxx.supabase.co   # 復元先の Project URL
python scripts/restore_storage.py /tmp/restore/backup/storage
```
最後に `0 failed` と出れば成功です。

---

## 4. ソースコードを戻す（GitHub のリポジトリが消えたとき）

```
git clone /tmp/restore/backup/source.bundle kimetomo-restored
```
できたフォルダを新しいリポジトリにプッシュします。

---

## 5. アプリ側の設定

新しい Supabase プロジェクトに戻した場合は、アプリの接続先（Project URL と anon キー）を新しいものに変えます。
GitHub Secrets（`SUPABASE_DB_URL` / `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`）も新しいものに更新します。

---

## 6. 後片付け（必ず）

```
unset DB SUPABASE_SERVICE_ROLE_KEY; rm -rf /tmp/kb /tmp/restore
```
