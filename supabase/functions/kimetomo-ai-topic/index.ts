// キメ友SNS: ✨ AIの「今日のお題」Edge Function（supabase/ai_topic.sql とセット）
//   POST（ログイン中の人なら誰でも）→ { topics: [{ e, t }, ...] } か { topics: null }（作っている途中・作れなかった）
//   その日のお題がまだなければ、1人だけが AI（Claude Haiku 5.5）に3つ作ってもらって保存する。
//   1日に AI を呼ぶのは基本1回だけ（失敗したときだけ10分あけてやり直す）。
// Supabase の Secrets に ANTHROPIC_API_KEY を登録しておくこと（女性だけの部屋の AI 確認と同じ鍵）。
import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const ANTHROPIC_API_KEY = (Deno.env.get("ANTHROPIC_API_KEY") ?? "").trim();
const MODEL = "claude-haiku-5-5"; // 安いAI（ユーザーの希望）

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Topic = { e: string; t: string };

const SYSTEM = `あなたは、日本の小さなSNS「キメ友」で、毎日の「今日のお題」を考える係です。
お題は、タイムラインに気軽に投稿してもらうための、短い質問です。答えやすくて、ほかの人の答えも見たくなるものにしてください。

このSNSは18歳以上の大人向けで、「アングラ寄り」の雰囲気が好きな人が集まっています。3つのうち：
- 1つ目と2つ目：軽い大人の話。恋愛のあるある・好きなタイプ・デートの思い出・夜ふかし・お酒の席のちょっとした失敗談・大人になって分かったことなど、居酒屋で気軽に話せる程度のもの。
- 3つ目：アングラ寄りのお題。都市伝説・オカルト・心霊・廃墟・未解決ミステリー・ネットの怖い噂・UMA・陰謀論ネタ（ネタとして楽しむもの）・サブカル・深夜テンション・ちょっと変わった体験など。

決まり：
- 日本語で、1つ30文字以内。「？」で終わる質問の形にする。
- 誰でも1〜2行で答えられるものにする。答えやすく、ほかの人の答えも見たくなる問いにする。
- 季節・曜日・行事に合わせられるときは合わせる（夏なら怪談、など）。
- 性的なこと・体の関係・下ネタは入れない。
- 違法なこと・薬物・危ない行為・自分や人を傷つけることを、すすめたり、体験を聞いたりしない。
- 住所・本名・学校名・勤め先・顔写真・連絡先など、答えると身元が分かることを聞かない。
- お金のやりとり、政治、宗教、病気、実際の事件や亡くなった人、だれかの悪口になる話題は避ける。
- 最近出したお題と同じ・よく似たものは出さない。
- e には、お題に合う絵文字を1つだけ入れる。`;

const SCHEMA = {
  type: "object",
  properties: {
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: { e: { type: "string" }, t: { type: "string" } },
        required: ["e", "t"],
        additionalProperties: false,
      },
    },
  },
  required: ["topics"],
  additionalProperties: false,
};

// 日本時間の今日（YYYY-MM-DD）と、AIに伝える日付の言葉
function today() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  const day = d.toISOString().slice(0, 10);
  const week = "日月火水木金土"[d.getUTCDay()];
  return { day, label: `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${week}曜日）` };
}

// AIの答えを確かめて、使えるものだけ残す
function clean(list: unknown): Topic[] {
  if (!Array.isArray(list)) return [];
  const out: Topic[] = [];
  for (const x of list) {
    const t = String((x as Topic)?.t ?? "").replace(/\s+/g, " ").trim();
    const e = String((x as Topic)?.e ?? "").trim();
    if (t.length < 4 || t.length > 40 || /https?:|www\.|@/.test(t)) continue;
    if (out.some((o) => o.t === t)) continue;
    out.push({ e: [...e].slice(0, 2).join("") || "💡", t });
    if (out.length >= 3) break;
  }
  return out;
}

async function askAI(label: string, recent: string[]): Promise<Topic[]> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  // deno-lint-ignore no-explicit-any
  const params: any = {
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    messages: [{
      role: "user",
      content: `今日は ${label} です。今日のお題を3つ考えてください。\n最近出したお題：\n${
        recent.length ? recent.map((t) => "- " + t).join("\n") : "（まだありません）"
      }`,
    }],
  };
  const res = await client.messages.create(params);
  if (res.stop_reason !== "end_turn") {
    console.error("ai-topic: stop_reason", res.stop_reason);
    return [];
  }
  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return [];
  try {
    return clean(JSON.parse(text.text).topics);
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST だけ使えます" }, 405);

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: who, error: authError } = await db.auth.getUser(jwt);
  if (authError || !who?.user) return json({ error: "ログインしてください" }, 401);

  const { day, label } = today();
  const { data: row } = await db.from("kimetomo_ai_topics").select("topics,status").eq("day", day).maybeSingle();
  if (row?.status === "ready") return json({ day, topics: row.topics });
  if (!ANTHROPIC_API_KEY) return json({ day, topics: null });

  // 作る係になれなかった（ほかの人のときに作っている途中・少し前に失敗した）ら、今は決まったお題を使ってもらう
  const { data: claimed } = await db.rpc("kimetomo_ai_topic_claim", { p_day: day });
  if (claimed !== true) return json({ day, topics: null });

  const { data: past } = await db.from("kimetomo_ai_topics").select("topics").eq("status", "ready")
    .lt("day", day).order("day", { ascending: false }).limit(14);
  const recent = (past ?? []).flatMap((r) => (Array.isArray(r.topics) ? r.topics : []).map((x: Topic) => x.t));

  let topics: Topic[] = [];
  try {
    topics = await askAI(label, recent);
  } catch (e) {
    console.error("ai-topic: AI error", (e as { status?: number })?.status ?? "unknown");
  }
  const ok = topics.length > 0;
  await db.from("kimetomo_ai_topics").update({ topics: ok ? topics : null, status: ok ? "ready" : "failed", updated_at: new Date().toISOString() }).eq("day", day);
  if (ok) await db.rpc("kimetomo_ai_topic_cleanup");
  return json({ day, topics: ok ? topics : null });
});
