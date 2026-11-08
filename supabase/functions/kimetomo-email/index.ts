// キメ友SNS: メール通知の Edge Function（supabase/email_notify.sql とセット）
//   POST { action: "send_verify" }（ログイン中の本人）… 確認メールを送る
//   POST { action: "verify", token } ………………………… 確認リンク（kimetomo.com/?email_verify=… の画面から呼ぶ）
//   POST { action: "off", token, kind } …………………… 「この種類のメールを止める」（kimetomo.com/?email_off=… から呼ぶ）
//   POST { bell_id }（データベースのトリガーから）……… 返信・DMの通知メールを送る
//   POST { action: "pw_reset_request", login_email } … パスワード再設定のメールを送る（supabase/password_reset.sql）
//   POST { action: "pw_reset_check", token } ……………… 再設定リンクがまだ使えるか
//   POST { action: "pw_reset", token, password } ………… 新しいパスワードにする（変更のお知らせメールも送る）
//   POST { action: "waitlist_send", ids? }（管理者）…… 順番待ちの人に招待リンクを送る（supabase/waitlist.sql）
//   POST { action: "waitlist_auto" }（10分ごと）…… 管理者が送らなかった人へ自動で送る（supabase/waitlist_auto.sql）
//   GET  ?verify=… / ?off=…&kind=…………………………… 以前に送ったメールのリンク用（そのまま使えるように残す）
// メールの中のリンクは、迷惑メールと判断されにくいよう、差出人と同じ kimetomo.com にそろえる。
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
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// 見やすいメール（HTML）。文字だけのメールも一緒に送る
function htmlMail(o: { title: string; lead: string; button: string; link: string; notes: string[]; footer?: string }) {
  const notes = o.notes.map((n) => `<p style="margin:6px 0;color:#6b6480;font-size:13px;line-height:1.6">${esc(n)}</p>`).join("");
  return `<!doctype html><html lang="ja"><body style="margin:0;padding:0;background:#f4f2f8">
<div style="max-width:520px;margin:0 auto;padding:24px 16px;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Noto Sans JP',sans-serif">
<div style="background:#ffffff;border-radius:16px;padding:24px;border:1px solid #e6e1f0">
<p style="margin:0 0 4px;color:#7c5cd6;font-weight:700;font-size:14px">✦ キメ友SNS</p>
<h1 style="margin:0 0 12px;font-size:20px;color:#1d1830;line-height:1.4">${esc(o.title)}</h1>
<p style="margin:0 0 20px;color:#3a3450;font-size:15px;line-height:1.7">${esc(o.lead)}</p>
<p style="margin:0 0 20px"><a href="${esc(o.link)}" style="display:inline-block;background:#7c5cd6;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;font-size:15px">${esc(o.button)}</a></p>
${notes}
</div>
${o.footer ? `<p style="margin:14px 4px 0;color:#8a83a0;font-size:12px;line-height:1.6">${o.footer}</p>` : ""}
</div></body></html>`;
}

async function sendMail(
  to: string, subject: string, text: string, html: string, headers?: Record<string, string>,
  attachments?: { filename: string; content: string }[],
) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY が Supabase の Secrets に登録されていません");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: EMAIL_FROM, to: [to], subject, text, html,
      ...(headers ? { headers } : {}),
      ...(attachments?.length ? { attachments } : {}),
    }),
  });
  if (!res.ok) throw new Error(`メールを送れませんでした（Resend ${res.status}）: ${await res.text()}`);
}

// 順番待ちの人へ、招待リンク（URL と QR コードの画像）を送る。送れたらメールアドレスを消す
//   差出人は noreply@kimetomo.com。管理者のメールアドレスは相手に見えない
async function qrPng(link: string): Promise<string | null> {
  try {
    const QR = (await import("npm:qrcode@1.5.4")).default;
    const url: string = await QR.toDataURL(link, { width: 360, margin: 2 });
    return url.replace(/^data:image\/png;base64,/, "");
  } catch (e) {
    console.error("QRコードを作れませんでした", e);
    return null;
  }
}
async function sendWaitlistInvites(rows: { id: number; email: string; code: string }[]) {
  let sent = 0;
  const failed: string[] = [];
  for (const r of rows) {
    const link = `${SITE}?invite=${encodeURIComponent(r.code)}`;
    const qr = await qrPng(link);
    const text =
      "キメ友SNSの順番待ちに登録いただき、ありがとうございます。招待リンクをお送りします。\n\n" +
      "下のリンクを開いて「新規登録」から登録してください（7日間・1回だけ使えます）。\n" + link + "\n\n" +
      (qr ? "パソコンで見ている場合は、添付の QR コードをスマホで読み取ってください。\n\n" : "") +
      "※ このメールアドレスは、送信後にキメ友から削除しました。\n" +
      "※ このメールは送信専用です。返信しても届きません。\n" +
      "心当たりがない場合は、このメールを無視してください。";
    const html = htmlMail({
      title: "招待リンクが届きました",
      lead: "キメ友SNSの順番待ちに登録いただき、ありがとうございます。下のボタンを押して「新規登録」から登録してください。",
      button: "キメ友に登録する",
      link,
      notes: [
        "このリンクは7日間・1回だけ使えます。",
        ...(qr ? ["パソコンで見ている場合は、添付の QR コードをスマホで読み取ってください。"] : []),
        "このメールアドレスは、送信後にキメ友から削除しました。",
        "このメールは送信専用です。返信しても届きません。",
        "心当たりがない場合は、このメールを無視してください。",
      ],
    });
    try {
      const files = qr ? [{ filename: "kimetomo-qr.png", content: qr }] : undefined;
      try {
        await sendMail(r.email, "【キメ友】招待リンクが届きました", text, html, undefined, files);
      } catch (e) {
        if (!files) throw e;
        console.error("QRコード付きで送れなかったので、URLだけで送り直します", e);
        await sendMail(r.email, "【キメ友】招待リンクが届きました", text, html);
      }
      await db.rpc("kimetomo_waitlist_done", { p_id: r.id });
      sent++;
    } catch (e) {
      console.error(e);
      failed.push(e instanceof Error ? e.message : String(e));
    }
    await new Promise((ok) => setTimeout(ok, 600)); // Resend は 1 秒に 2 通まで
  }
  return { sent, failed: failed.length, error: failed[0] ?? null };
}

async function verifyToken(token: string) {
  const { data, error } = await db.rpc("kimetomo_email_verify", { p_token: token });
  return !error && !!data;
}
async function turnOff(token: string, kind: string) {
  const { data, error } = await db.rpc("kimetomo_email_off", { p_token: token, p_kind: kind });
  return !error && !!data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  try {
    if (req.method === "GET") {
      const verify = url.searchParams.get("verify");
      if (verify) return backToSite((await verifyToken(verify)) ? "verified" : "invalid");
      const off = url.searchParams.get("off");
      const kind = url.searchParams.get("kind");
      if (off && (kind === "dm" || kind === "reply")) return backToSite((await turnOff(off, kind)) ? `off-${kind}` : "invalid");
      return new Response("Not found", { status: 404, headers: cors });
    }

    const body = await req.json().catch(() => ({}));

    // kimetomo.com の画面から：確認リンク・停止リンク
    if (body?.action === "verify" && typeof body.token === "string") {
      return json({ ok: await verifyToken(body.token) });
    }
    if (body?.action === "off" && typeof body.token === "string" && (body.kind === "dm" || body.kind === "reply")) {
      return json({ ok: await turnOff(body.token, body.kind) });
    }

    // パスワードの再設定：申し込み（だれのアドレスがあるかを知られないよう、結果はいつも同じ返事にする）
    if (body?.action === "pw_reset_request" && typeof body.login_email === "string") {
      const { data, error } = await db.rpc("kimetomo_pw_reset_request", { p_login_email: body.login_email.slice(0, 320) });
      if (error) throw error;
      const row = first(data as { email: string; token: string }[] | null);
      if (row?.email) {
        const link = `${SITE}?pw_reset=${encodeURIComponent(row.token)}`;
        await sendMail(
          row.email,
          "【キメ友】パスワードの再設定",
          "キメ友のパスワードを再設定するためのメールです。\n\n" +
            "下のリンクを押して、新しいパスワードを決めてください（1時間だけ・1回だけ使えます）。\n" + link + "\n\n" +
            "心当たりがない場合は、このメールを無視してください。リンクを押さなければ、パスワードは変わりません。",
          htmlMail({
            title: "パスワードの再設定",
            lead: "キメ友のパスワードを再設定するためのメールです。下のボタンを押して、新しいパスワードを決めてください。",
            button: "新しいパスワードを決める",
            link,
            notes: [
              "このリンクは1時間だけ、1回だけ使えます。",
              "心当たりがない場合は、このメールを無視してください。ボタンを押さなければ、パスワードは変わりません。",
            ],
          }),
        );
      }
      return json({ ok: true });
    }

    // パスワードの再設定：リンクがまだ使えるか
    if (body?.action === "pw_reset_check" && typeof body.token === "string") {
      const { data, error } = await db.rpc("kimetomo_pw_reset_peek", { p_token: body.token });
      return json({ ok: !error && !!first(data as { user_id: string }[] | null)?.user_id });
    }

    // パスワードの再設定：新しいパスワードにする
    if (body?.action === "pw_reset" && typeof body.token === "string" && typeof body.password === "string") {
      const password = body.password;
      if (password.length < 8 || password.length > 72) return json({ error: "パスワードは8〜72文字にしてください。" }, 400);
      const { data, error } = await db.rpc("kimetomo_pw_reset_peek", { p_token: body.token });
      if (error) throw error;
      const row = first(data as { user_id: string; email: string | null }[] | null);
      if (!row?.user_id) return json({ error: "再設定のリンクが無効か、期限（1時間）が切れています。もう一度「パスワードを忘れた方」からお試しください。" }, 400);
      const { error: updateError } = await db.auth.admin.updateUserById(row.user_id, { password });
      if (updateError) {
        const m = updateError.message || "";
        if (/weak|pwned|leak|compromised/i.test(m)) {
          return json({ error: "このパスワードは使えません（よく使われている、または過去に流出したことがあるパスワードです）。別のパスワードにしてください。" }, 400);
        }
        throw updateError;
      }
      await db.rpc("kimetomo_pw_reset_use", { p_token: body.token });
      if (row.email) {
        await sendMail(
          row.email,
          "【キメ友】パスワードを変更しました",
          "キメ友のパスワードが変更されました。\n\n" +
            "心当たりがない場合は、すぐに「パスワードを忘れた方」から再設定し、管理者に知らせてください。\n" + SITE,
          htmlMail({
            title: "パスワードを変更しました",
            lead: "キメ友のパスワードが変更されました。新しいパスワードでログインしてください。",
            button: "キメ友を開く",
            link: SITE,
            notes: ["心当たりがない場合は、すぐに「パスワードを忘れた方」から再設定し、管理者に知らせてください。"],
          }),
        ).catch((e) => console.error(e));
      }
      return json({ ok: true });
    }

    // 確認メール（ログイン中の本人だけ）
    if (body?.action === "send_verify") {
      const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: who, error: authError } = await db.auth.getUser(jwt);
      if (authError || !who?.user) return json({ error: "ログインしてください" }, 401);
      const { data, error } = await db.rpc("kimetomo_email_pending", { p_user: who.user.id });
      if (error) throw error;
      const row = first(data as { email: string; verify_token: string }[] | null);
      if (!row?.email) return json({ error: "確認待ちのメールアドレスがありません" }, 400);
      const link = `${SITE}?email_verify=${encodeURIComponent(row.verify_token)}`;
      await sendMail(
        row.email,
        "【キメ友】メールアドレスの確認",
        "キメ友のメール通知に、このメールアドレスが登録されました。\n\n" +
          "下のリンクを押すと、登録が完了します（24時間有効）。\n" + link + "\n\n" +
          "心当たりがない場合は、このメールを無視してください。リンクを押さなければ、通知は届きません。",
        htmlMail({
          title: "メールアドレスの確認",
          lead: "キメ友のメール通知に、このメールアドレスが登録されました。下のボタンを押すと、登録が完了します。",
          button: "登録を完了する",
          link,
          notes: [
            "このリンクは24時間有効です。",
            "このメールが迷惑メールのフォルダに入っていた場合は、「迷惑メールではない」を押してください。次から通知メールも普通に届きます。",
            "心当たりがない場合は、このメールを無視してください。ボタンを押さなければ、通知は届きません。",
          ],
        }),
      );
      return json({ ok: true });
    }

    // 順番待ちの人に招待リンクを送る（管理者だけ。supabase/waitlist.sql）
    //   送れたら、そのメールアドレスはすぐ消す。送れなかったものは残して、あとでもう一度送れる
    if (body?.action === "waitlist_send") {
      const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: who, error: authError } = await db.auth.getUser(jwt);
      if (authError || !who?.user) return json({ error: "ログインしてください" }, 401);
      const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter((n: number) => Number.isFinite(n)).slice(0, 20) : null;
      const { data, error } = await db.rpc("kimetomo_waitlist_take", { p_admin: who.user.id, p_ids: ids && ids.length ? ids : null });
      if (error) return json({ error: error.message }, 403);
      const rows = (data ?? []) as { id: number; email: string; code: string }[];
      return json({ ok: true, ...(await sendWaitlistInvites(rows)) });
    }

    // 順番待ちの人へ自動で招待を送る（10分ごとにデータベースから。supabase/waitlist_auto.sql）
    //   管理者が送らないまま一定時間（はじめは60分）たった人だけ。1日の上限もデータベースで確かめる
    if (body?.action === "waitlist_auto") {
      const { data, error } = await db.rpc("kimetomo_waitlist_take_auto");
      if (error) throw error;
      const rows = (data ?? []) as { id: number; email: string; code: string }[];
      return json({ ok: true, ...(await sendWaitlistInvites(rows)) });
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
      const offLabel = offKind === "dm" ? "DM" : "コメント・返信";
      const offLink = `${SITE}?email_off=${encodeURIComponent(row.off_token)}&kind=${offKind}`;
      await sendMail(
        row.email,
        `【キメ友】${what}`,
        `${what}。\n\nキメ友を開いて確認してください。\n${open}\n\n` +
          "※ やりとりの内容は、メールには書いていません。\n" +
          "※ 同じ種類のお知らせメールは、10分に1回までにまとめています。\n\n" +
          `この種類のメール（${offLabel}）を止める：\n${offLink}\n\n` +
          "メール通知の設定は、キメ友のプロフィール画面からいつでも変えられます。",
        htmlMail({
          title: what,
          lead: "キメ友を開いて確認してください。",
          button: "キメ友を開く",
          link: open,
          notes: [
            "やりとりの内容は、メールには書いていません。",
            "同じ種類のお知らせメールは、10分に1回までにまとめています。",
          ],
          footer: `この種類のメール（${esc(offLabel)}）を止めるときは <a href="${esc(offLink)}" style="color:#7c5cd6">こちら</a>。メール通知の設定は、キメ友のプロフィール画面からいつでも変えられます。`,
        }),
        { "List-Unsubscribe": `<${offLink}>` },
      );
      return json({ ok: true });
    }

    return json({ error: "bad request" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
