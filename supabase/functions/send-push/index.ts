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

async function recipientsFor(p: Payload): Promise<{ ids: string[]; url: string; kind: string }> {
  const r = p.record;
  if (p.table === "kimetomo_direct_messages") {
    const { data } = await sb
      .from("kimetomo_direct_conversations")
      .select("user_a,user_b")
      .eq("id", r.conversation_id)
      .maybeSingle();
    if (!data) return { ids: [], url: "./dm.html", kind: "" };
    const ids = [data.user_a, data.user_b].filter((id) => id && id !== r.sender_id);
    return { ids, url: "./dm.html", kind: "個人チャット" };
  }
  if (p.table === "circle_messages") {
    const { data } = await sb
      .from("circle_room_members")
      .select("user_id")
      .eq("room_id", r.room_id);
    const ids = (data ?? []).map((m) => m.user_id).filter((id) => id !== r.sender_id);
    return { ids, url: "./?tab=chat", kind: "グループチャット" };
  }
  return { ids: [], url: "./", kind: "" };
}

Deno.serve(async (req) => {
  if (!WEBHOOK_SECRET || (req.headers.get("x-webhook-secret") ?? "").trim() !== WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  const payload = (await req.json()) as Payload;
  if (payload.type !== "INSERT") return new Response("ignored");

  const senderId = payload.record.sender_id as string;
  const { ids, url, kind } = await recipientsFor(payload);
  if (!senderId || ids.length === 0) return new Response("no recipients");

  // 送信者をブロックしている人には送らない
  const { data: blocks } = await sb
    .from("user_blocks")
    .select("blocker_id")
    .eq("blocked_id", senderId)
    .in("blocker_id", ids);
  const blocked = new Set((blocks ?? []).map((b) => b.blocker_id));
  const targets = ids.filter((id) => !blocked.has(id));
  if (targets.length === 0) return new Response("no recipients");

  const { data: subs } = await sb
    .from("kimetomo_push_subscriptions")
    .select("endpoint,p256dh,auth")
    .in("user_id", targets);

  const name = await senderName(senderId);
  // メッセージ本文はロック画面に出さない（プライバシー保護）
  const message = JSON.stringify({
    title: "キメ友SNS",
    body: `${name}さんから${kind}にメッセージが届きました`,
    url,
  });

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
