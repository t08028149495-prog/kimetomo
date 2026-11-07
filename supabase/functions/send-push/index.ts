// キメ友SNS: 新しいメッセージが届いたら Push 通知を送る Edge Function
// Database Webhook（INSERT）から呼び出される。
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// 公開鍵は vapid-public.js と同じもの（公開してよい値）
const VAPID_PUBLIC_KEY =
  "BP2u06CNbXV8s8pr1z7wwj2xdHcv1l8V2xGkFc4jpoItGEQvrVI2ZRBQE7tG81KZO9UF8UsyKL-hfHZn3FDJ-WE";

// コピー時に紛れ込んだ空白・改行・引用符などを取り除く
const cleanKey = (v: string | undefined) => (v ?? "").replace(/[^A-Za-z0-9_-]/g, "");

webpush.setVapidDetails(
  (Deno.env.get("VAPID_SUBJECT") ?? "").trim(),
  VAPID_PUBLIC_KEY,
  cleanKey(Deno.env.get("VAPID_PRIVATE_KEY")),
);

const WEBHOOK_SECRET = (Deno.env.get("WEBHOOK_SECRET") ?? "").trim();

type Payload = {
  type: string;
  table: string;
  record: Record<string, unknown>;
};

async function senderName(userId: string): Promise<string> {
  const { data } = await sb
    .from("circle_profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.display_name as string) || "友達";
}

// ベル通知の種類ごとの文言と開くページ（本文はロック画面に出さない）
function describe(kind: string, name: string, actorId: string, refId: string) {
  if (kind === "chat") {
    return { body: `${name}さんがグループチャットに投稿しました`, url: "./?tab=chat" };
  }
  if (kind === "dm") {
    return { body: `${name}さんから個人チャットが届きました`, url: `./dm.html?to=${encodeURIComponent(actorId)}` };
  }
  if (kind === "reply") {
    return { body: `${name}さんがあなたのコメントに返信しました`, url: `./?post=${encodeURIComponent(refId)}` };
  }
  if (kind === "comment") {
    return { body: `${name}さんがあなたの投稿にコメントしました`, url: `./?post=${encodeURIComponent(refId)}` };
  }
  return null;
}

// 管理者に個人チャット（DM）が届いたら、メールでも知らせる（Resend を使う）
// 必要な秘密の値：RESEND_API_KEY と ADMIN_NOTIFY_EMAIL（Edge Functions → Secrets に登録）
const RESEND_API_KEY = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
const ADMIN_NOTIFY_EMAIL = (Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "").trim();
const SITE_URL = "https://kimetomo.com/";

async function maybeEmailAdmin(r: Record<string, unknown>, name: string) {
  if (!RESEND_API_KEY || !ADMIN_NOTIFY_EMAIL || r.kind !== "dm") return;
  const recipientId = r.recipient_id as string;
  const actorId = (r.actor_id as string) ?? "";
  const { data: prof } = await sb.from("circle_profiles").select("is_admin").eq("user_id", recipientId).maybeSingle();
  if (!prof?.is_admin) return;
  // 同じ人から10分以内に続けて届いたときは、最初の1通だけメールする（メールが多くなりすぎないように）
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await sb.from("kimetomo_bell_notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", recipientId).eq("kind", "dm").eq("actor_id", actorId)
    .gte("created_at", since).neq("id", r.id as number);
  if ((count ?? 0) > 0) return;
  const link = SITE_URL + "dm.html?to=" + encodeURIComponent(actorId);
  const safe = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "キメ友SNS <onboarding@resend.dev>",
        to: [ADMIN_NOTIFY_EMAIL],
        subject: `✉️ ${name}さんから個人チャットが届きました（キメ友SNS）`,
        html: `<p>${safe(name)}さんから、キメ友SNSの個人チャットが届きました。</p>` +
          `<p><a href="${link}">キメ友SNSで開く</a></p>` +
          `<p style="color:#888;font-size:12px">このメールは、管理者に届いた個人チャットのお知らせです。</p>`,
      }),
    });
    if (!res.ok) console.error("email failed", res.status, await res.text());
  } catch (e) {
    console.error("email failed", e);
  }
}

Deno.serve(async (req) => {
  if (!WEBHOOK_SECRET || (req.headers.get("x-webhook-secret") ?? "").trim() !== WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  const payload = (await req.json()) as Payload;
  if (payload.type !== "INSERT" || payload.table !== "kimetomo_bell_notifications") {
    return new Response("ignored");
  }

  const r = payload.record;
  const recipientId = r.recipient_id as string;
  const actorId = (r.actor_id as string) ?? "";
  const name = actorId ? await senderName(actorId) : "友達";
  // 文言とリンクはデータベース側（bell_setup.sql）で作る。無い場合だけここで作る
  const info = r.push_text
    ? { body: String(r.push_text), url: String(r.url ?? "./") }
    : describe(r.kind as string, name, actorId, String(r.ref_id ?? ""));
  if (!recipientId || !info) return new Response("ignored");

  await maybeEmailAdmin(r, name);

  const { data: subs } = await sb
    .from("kimetomo_push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("user_id", recipientId);

  const message = JSON.stringify({ title: "キメ友SNS", body: info.body, url: info.url });

  let sent = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        message,
      );
      sent++;
    } catch (error) {
      const code = (error as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        // 期限切れの購読は削除
        await sb.from("kimetomo_push_subscriptions").delete().eq("endpoint", s.endpoint);
      } else {
        console.error("push failed", code, error);
      }
    }
  }

  return new Response(JSON.stringify({ sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
