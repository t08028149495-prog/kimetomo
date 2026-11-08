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

// 本人が「通知しない」にした種類か（設定は kimetomo_push_prefs。supabase/push_prefs.sql）
async function isOff(userId: string, kind: string): Promise<boolean> {
  const { data } = await sb
    .from("kimetomo_push_prefs")
    .select("off_kinds")
    .eq("user_id", userId)
    .maybeSingle();
  return ((data?.off_kinds as string[] | null) ?? []).includes(kind);
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

  if (await isOff(recipientId, String(r.kind ?? ""))) return new Response("off");

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
