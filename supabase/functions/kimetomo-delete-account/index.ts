// キメ友SNS: 退会 Edge Function（supabase/delete_account.sql とセット）
//   POST { confirm: "退会する" }（ログインしている本人だけ。消すのは自分のアカウントだけ）
//   → { ok: true } / { error: "..." }
//   1. 消す写真ファイルの一覧を取る（プロフィール写真・投稿の画像・グループチャットの写真）
//   2. kimetomo_account_delete でアカウントと記録をまとめて消す（途中で失敗したら何も消えない）
//   3. 写真ファイル本体を消す（SQL では消せないため。失敗してもアカウントはもう消えているのでログだけ残す）
//   ログに名前や中身は出さない。
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST だけ使えます" }, 405);

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: who, error: authError } = await db.auth.getUser(jwt);
  if (authError || !who?.user) return json({ error: "ログインし直してから、もう一度お試しください。" }, 401);
  const uid = who.user.id;

  let body: { confirm?: string } = {};
  try { body = await req.json(); } catch { /* 空のとき */ }
  if ((body.confirm ?? "").trim() !== "退会する") return json({ error: "「退会する」と入力してください。" }, 400);

  const { data: files, error: listError } = await db.rpc("kimetomo_account_files", { p_uid: uid });
  if (listError) {
    console.error("delete-account: list error", listError.code);
    return json({ error: "退会できませんでした。時間をおいてもう一度お試しください。" }, 500);
  }

  const { data: result, error: delError } = await db.rpc("kimetomo_account_delete", { p_uid: uid });
  if (delError) {
    console.error("delete-account: delete error", delError.code);
    return json({ error: "退会できませんでした。時間をおいてもう一度お試しください。" }, 500);
  }
  if (result === "admin") return json({ error: "管理者は退会できません。先に管理者を外してください。" }, 403);
  if (result !== "ok") return json({ error: "アカウントが見つかりませんでした。" }, 404);

  // 写真ファイル本体（バケットごとに 100 件ずつ）
  const byBucket = new Map<string, string[]>();
  for (const f of (files as { bucket_id: string; name: string }[] ?? [])) {
    byBucket.set(f.bucket_id, [...(byBucket.get(f.bucket_id) ?? []), f.name]);
  }
  for (const [bucket, names] of byBucket) {
    for (let i = 0; i < names.length; i += 100) {
      const { error } = await db.storage.from(bucket).remove(names.slice(i, i + 100));
      if (error) console.error("delete-account: storage error", bucket, error.message);
    }
  }
  return json({ ok: true });
});
