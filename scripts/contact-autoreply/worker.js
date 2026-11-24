// 📮 contact@kimetomo.com に届いたメールを、①管理人の Gmail へ転送し、②送り主へ決まった文で自動返信する
// Cloudflare Email Routing の「Email Worker」。デプロイ：scripts/contact-autoreply で npx wrangler deploy
// 転送先は Worker の変数 FORWARD_TO（コードには書かない）。
import { EmailMessage } from "cloudflare:email";

const SUBJECT = "【キメ友SNS】お問い合わせを受け付けました（自動返信）";
const MARK = "お問い合わせを受け付けました"; // 自動返信への返信には、もう一度返さない

const BODY = `このメールは自動で送っています。

キメ友SNSへのお問い合わせ、ありがとうございます。
内容を確認し、必要に応じて運営からご連絡します（数日かかることがあります）。

――――――――――――――――
ログイン・新規登録でお困りの方へ（よくあるご質問）
――――――――――――――――

■ 新規登録できない
・キメ友は招待制です。メンバーからもらった「招待リンク」を開いてから登録してください。
・ユーザー名は、日本語・半角英数字の3〜20文字です（空白・記号は使えません）。
・パスワードは8文字以上です。簡単すぎるもの（12345678 など）は使えません。

■ ログインできない
・ユーザー名には「今の名前」か「登録したときの名前」を入れてください。
・パスワードを忘れたときは、ログイン画面の「パスワードを忘れた方」から再設定できます。
　（プロフィールでメール通知のアドレスを登録し、確認まで済ませた方だけ使えます）

■「ロボットでないことの確認」で先へ進めない
・LINE・Instagram などのアプリの中で開いているときは、Safari か Chrome で開き直してください。
・確認が終わるまで少し待ってから、もう一度ボタンを押してください。

■ 対応している環境
・iPhone：iOS 16.4 以降（Safari）
・Android：最新の Chrome

それでも解決しないときは、このメールにそのまま返信して、
・画面に出ている文章（スクリーンショットでも大丈夫です）
・お使いの機種（例：iPhone 15）
を教えてください。

※パスワードは、メールに書かないでください。

キメ友SNS 運営
https://kimetomo.com
`;

export default {
  async email(message, env, ctx) {
    try {
      if (shouldReply(message, env)) await message.reply(buildReply(message));
    } catch (e) {
      console.error("auto-reply failed", e && (e.message || e));
    }
    if (env.FORWARD_TO) await message.forward(env.FORWARD_TO);
    else console.error("FORWARD_TO is not set");
  },
};

// 返信しない：自動のメール・メルマガ・エラー通知・自分のドメイン・自動返信への返信
function shouldReply(message, env) {
  const h = message.headers;
  const from = String(message.from || "").toLowerCase();
  const subject = decodeSubject(h.get("subject") || "");
  const auto = (h.get("auto-submitted") || "").toLowerCase();
  const prec = (h.get("precedence") || "").toLowerCase();
  if (!from || !h.get("message-id")) return false;
  if (auto && auto !== "no") return false;
  if (/^(bulk|junk|list|auto_reply)$/.test(prec)) return false;
  if (h.get("list-id") || h.get("list-unsubscribe") || h.get("x-auto-response-suppress")) return false;
  if (/(^|[.+_-])(no-?reply|mailer-daemon|postmaster|bounce)/.test(from.split("@")[0])) return false;
  if (from.endsWith("@kimetomo.com")) return false;
  if (env.FORWARD_TO && from === String(env.FORWARD_TO).toLowerCase()) return false;
  if (subject.includes(MARK)) return false;
  return true;
}

function buildReply(message) {
  const orig = message.headers.get("message-id");
  const refs = [message.headers.get("references"), orig].filter(Boolean).join(" ");
  const domain = String(message.to).split("@")[1] || "kimetomo.com";
  const raw = [
    `From: ${encodeWords("キメ友SNS")} <${message.to}>`,
    `To: <${message.from}>`,
    `Subject: ${encodeWords(SUBJECT)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    `In-Reply-To: ${orig}`,
    `References: ${refs}`,
    "Auto-Submitted: auto-replied",
    "X-Auto-Response-Suppress: All",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(BODY.replace(/\r?\n/g, "\r\n")).replace(/.{1,76}/g, "$&\r\n"),
  ].join("\r\n");
  return new EmailMessage(message.to, message.from, raw);
}

function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

// 件名などの日本語をメールの決まり（RFC 2047）で包む。長い件名は短く分ける
function encodeWords(str) {
  const chars = [...str], parts = [];
  for (let i = 0; i < chars.length; i += 12) parts.push(`=?UTF-8?B?${b64(chars.slice(i, i + 12).join(""))}?=`);
  return parts.join("\r\n ");
}

// 届いた件名（=?UTF-8?B?...?= の形でもよい）を読める文字に戻す
function decodeSubject(s) {
  return s.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_, cs, enc, txt) => {
    try {
      const bin = enc.toUpperCase() === "B" ? atob(txt)
        : txt.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_, x) => String.fromCharCode(parseInt(x, 16)));
      return new TextDecoder(cs).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    } catch { return txt; }
  });
}
