// キメ友SNS: メール通知の Edge Function（supabase/email_notify.sql とセット）
//   POST { action: "send_verify" }（ログイン中の本人）… 確認メールを送る
//   POST { bell_id }（データベースのトリガーから）……… 返信・DMの通知メールを送る
//   GET  ?verify=トークン ………………………………………… 確認リンク（登録を完了する）
//   GET  ?off=トークン&kind=dm|reply ……………………… メールの「この種類のメールを止める」リンク
// 送信には Resend を使う。Supabase の Secrets に RESEND_API_KEY を登録しておくこと。
// （任意）EMAIL_FROM で差出人を変えられる。例：キメ友 <noreply@kimetomo.com>
// メールには内容を書かず、お知らせだけを送る。verify_jwt は false（中で確かめる）。
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const db = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const RESEND_API_KEY = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
const EMAIL_FROM = (Deno.env.get("EMAIL_FROM") ?? "").trim() || "キメ友 <noreply@kimetomo.com>";
const SITE = "https://kimetomo.com/";
const SELF = `${SUPABASE_URL}/functions/v1/kimetomo-email`;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const backToSite = (result: string) =>
  new Response(null, { status: 302, headers: { Location: `${SITE}?email=${encodeURIComponent(result)}` } });
const first = <T>(data: T | T[] | null): T | null => (Array.isArray(data) ? data[0] ?? null : data);

async function sendMail(to: string, subject: string, text: string) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY が Supabase の Secrets に登録されていません");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, text }),
  });
  if (!res.ok) throw new Error(`メールを送れませんでした（Resend ${res.status}）: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  try {
    if (req.method === "GET") {
      const verify = url.searchParams.get("verify");
      if (verify) {
        const { data, error } = await db.rpc("kimetomo_email_verify", { p_token: verify });
        return backToSite(!error && data ? "verified" : "invalid");
      }
      const off = url.searchParams.get("off");
      const kind = url.searchParams.get("kind");
      if (off && (kind === "dm" || kind === "reply")) {
        const { data, error } = await db.rpc("kimetomo_email_off", { p_token: off, p_kind: kind });
        return backToSite(!error && data ? `off-${kind}` : "invalid");
      }
      return new Response("Not found", { status: 404, headers: cors });
    }

    const body = await req.json().catch(() => ({}));

    // 確認メール（ログイン中の本人だけ）
    if (body?.action === "send_verify") {
      const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: who, error: authError } = await db.auth.getUser(jwt);
      if (authError || !who?.user) return json({ error: "ログインしてください" }, 401);
      const { data, error } = await db.rpc("kimetomo_email_pending", { p_user: who.user.id });
      if (error) throw error;
      const row = first(data as { email: string; verify_token: string }[] | null);
      if (!row?.email) return json({ error: "確認待ちのメールアドレスがありません" }, 400);
      const link = `${SELF}?verify=${encodeURIComponent(row.verify_token)}`;
      await sendMail(
        row.email,
        "【キメ友】メールアドレスの確認",
        "キメ友のメール通知に、このメールアドレスが登録されました。\n\n" +
          "下のリンクを押すと、登録が完了します（24時間有効）。\n" + link + "\n\n" +
          "心当たりがない場合は、このメールを無視してください。リンクを押さなければ、通知は届きません。",
      );
      return json({ ok: true });
    }

    // 返信・DMの通知メール（データベースのトリガーから。送ってよいかはデータベースで確かめる）
    if (body?.bell_id) {
      const { data, error } = await db.rpc("kimetomo_email_claim", { p_bell_id: Number(body.bell_id) });
      if (error) throw error;
      const row = first(data as { email: string; off_token: string; kind: string; actor_name: string; url: string | null }[] | null);
      if (!row?.email) return json({ skipped: true });
      const name = row.actor_name || "メンバー";
      const what = row.kind === "dm"
        ? `${name}さんからDMが届きました`
        : row.kind === "comment"
        ? `あなたの投稿に${name}さんがコメントしました`
        : `あなたのコメントに${name}さんが返信しました`;
      const open = row.kind === "dm" ? `${SITE}dm.html` : SITE + (row.url ?? "").replace(/^\.\//, "");
      const offKind = row.kind === "dm" ? "dm" : "reply";
      await sendMail(
        row.email,
        `【キメ友】${what}`,
        `${what}。\n\nキメ友を開いて確認してください。\n${open}\n\n` +
          "※ やりとりの内容は、メールには書いていません。\n" +
          "※ 同じ種類のお知らせメールは、10分に1回までにまとめています。\n\n" +
          `この種類のメール（${offKind === "dm" ? "DM" : "コメント・返信"}）を止める：\n${SELF}?off=${row.off_token}&kind=${offKind}\n\n` +
          "メール通知の設定は、キメ友のプロフィール画面からいつでも変えられます。",
      );
      return json({ ok: true });
    }

    return json({ error: "bad request" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
