// キメ友SNS: 🌷 女性だけの部屋に「AIで確認して入る」Edge Function（supabase/women_room_ai.sql とセット）
//   POST { id, image }（ログイン中の本人）
//     id    … kimetomo_wroom_ai_start() でもらったお題の番号
//     image … その場で撮った写真（JPEG を base64 にしたもの）
//   → { result: "pass" | "fail" | "error" }
// 写真は AI（Anthropic の Claude Haiku 5.5）に送るだけで、どこにも保存しない。ログにも出さない。
// 管理者も写真を見られない。データベースに残すのは「合格／不合格・日時」だけ。
// Supabase の Secrets に ANTHROPIC_API_KEY を登録しておくこと。
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

const SYSTEM = `あなたは、日本の小さなSNS「キメ友」で、女性だけのグループチャットに入るための確認を手伝う係です。
利用者は、この確認のために自分の写真1枚をAIに送ることに同意しています。写真は確認のあとすぐに捨てられ、人には見せません。
あなたの役目は、なりすまし（男性が女性のふりをして入ること）を防ぐことです。
写真に写っている人がだれかを特定したり、名前を推測したりしてはいけません。

写真と、利用者に出した「お題（ポーズ）」を見て、次の5つを答えてください。
- pose_matches: 写真の人が、お題のポーズをしているか。お題に出てくるしぐさ（指の本数と、顔のしぐさ、または手のしぐさ）が全部合っていれば true。
  利用者はスマホを片手で持って自撮りしているので、お題に出てこない手は写っていなくてかまいません。
  インカメラで撮るので、左右が反転していることがあります。左右のちがいは気にしないでください。
  指の立て方（どの指を立てたか）は問いません。本数が合っていれば OK です。
  顔のしぐさは、はっきり分かる程度にできていれば OK です（大げさでなくてかまいません）。
- live_photo: その場でカメラで撮った、本物の人の写真に見えるか。
  画面やモニターを撮った写真、印刷した写真、イラスト、AIで作ったような不自然な画像（指の数や形がおかしい、肌や背景が不自然になめらか、など）なら false。
- single_person: 顔がはっきり写っている人が1人だけか。
- appears_female: 写っている人が、女性に見えるか。
- confidence: ここまでの判断にどのくらい自信があるか（low / medium / high）。

迷ったときや、暗い・ぼやけている・顔が隠れているなどで判断できないときは、false にするか、confidence を low にしてください。`;

const SCHEMA = {
  type: "object",
  properties: {
    pose_matches: { type: "boolean" },
    live_photo: { type: "boolean" },
    single_person: { type: "boolean" },
    appears_female: { type: "boolean" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["pose_matches", "live_photo", "single_person", "appears_female", "confidence"],
  additionalProperties: false,
};

type Verdict = {
  pose_matches: boolean;
  live_photo: boolean;
  single_person: boolean;
  appears_female: boolean;
  confidence: "low" | "medium" | "high";
};

// AIに聞く。判定できなかったとき（エラー・断られた等）は null
async function askAI(image: string, pose: string): Promise<Verdict | null> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  // deno-lint-ignore no-explicit-any
  const params: any = {
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
        { type: "text", text: `お題：${pose}` },
      ],
    }],
  };
  const res = await client.messages.create(params);
  if (res.stop_reason !== "end_turn") {
    console.error("wroom-ai: stop_reason", res.stop_reason); // 写真やAIの返事は出さない
    return null;
  }
  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return null;
  try {
    return JSON.parse(text.text) as Verdict;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST だけ使えます" }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: "準備中です（AIの鍵が登録されていません）" }, 503);

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: who, error: authError } = await db.auth.getUser(jwt);
  if (authError || !who?.user) return json({ error: "ログインしてください" }, 401);

  let body: { id?: unknown; image?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "送り方が正しくありません" }, 400);
  }
  const id = Number(body.id);
  const image = typeof body.image === "string" ? body.image : "";
  // JPEG（base64 は /9j/ で始まる）で、大きすぎないものだけ
  if (!Number.isSafeInteger(id) || id <= 0) return json({ error: "お題が見つかりません" }, 400);
  if (!image.startsWith("/9j/") || image.length > 3_000_000 || !/^[A-Za-z0-9+/=]+$/.test(image)) {
    return json({ error: "写真を読み込めませんでした。もう一度撮ってください" }, 400);
  }

  // お題を使用済みにする（本人のもの・5分以内・まだ使える人か、をデータベースが確かめる）
  const { data: pose, error: claimError } = await db.rpc("kimetomo_wroom_ai_claim", { p_user: who.user.id, p_id: id });
  if (claimError || typeof pose !== "string") {
    return json({ error: claimError?.message ?? "いまは使えません" }, 400);
  }

  let verdict: Verdict | null = null;
  try {
    verdict = await askAI(image, pose);
  } catch (e) {
    console.error("wroom-ai: AI error", (e as { status?: number })?.status ?? "unknown");
  }

  // 判定できなかった回は「error」として記録し、回数には数えない
  const result = !verdict ? "error"
    : verdict.pose_matches && verdict.live_photo && verdict.single_person && verdict.appears_female &&
        verdict.confidence !== "low"
    ? "pass"
    : "fail";

  const { data: room, error: finishError } = await db.rpc("kimetomo_wroom_ai_finish", { p_id: id, p_result: result });
  if (finishError) {
    console.error("wroom-ai: finish error", finishError.code);
    return json({ error: "結果を記録できませんでした。時間をおいてお試しください" }, 500);
  }
  // 合格でも、最後の確認で外れた（♀でなくなった等）ときは room が空になる
  return json({ result: result === "pass" && !room ? "fail" : result, room: room ?? null });
});
