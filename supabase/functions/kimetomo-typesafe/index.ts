// キメ友SNS: 🤖 TypeSafe（Jev）で文章を見分ける Edge Function（supabase/typesafe_ai.sql とセット）
//   ・TypeSafe には「はい／いいえ」の判断だけをしてもらい、どうするかはこのファイルのコードで決める
//   ・質問の文章としきい値は、下の「質問」のところにまとめてある（直すときはここだけ）
//   mode "post"（データベースから呼ばれる。ID だけ受け取り、中身はここで読み直す）
//     ① 投稿・コメント・グループチャット → 疑いが強いものだけ「気になる投稿」とベルで管理者に知らせる
//     ③ 不具合の報告 → 種類と急ぎを付ける
//   mode "dm"（受け取った人の画面から呼ばれる。ログインが必要）
//     ② 個人チャット → 注意を出すかどうかを返すだけ。記録しない・管理者に知らせない
//   名前は送らない。ログにも中身は出さない。
// Supabase の Secrets に TYPESAFE_API_KEY を登録しておくこと。鍵がないあいだは何もしない。
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const KEY = (Deno.env.get("TYPESAFE_API_KEY") ?? "").trim();
const MODEL = "jev-1.14.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// ===================== 質問（ここにまとめる） =====================
type Q = { type: "noul"; instructions: string; criteria: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string> };

const YES = 0.7; // これより上を「はい」とみなす

// ① 投稿・コメント・グループチャット（state の `本文` について聞く）
const POST_Q: Record<string, Q> = {
  sell: {
    type: "noul",
    instructions: "`本文` の書き手は、違法な薬物や違法な物を、売る・買う・ゆずると持ちかけていますか？",
    criteria: {
      true: "薬物・偽造品・他人名義の口座や携帯などを、売る・買う・ゆずる・手に入れられると書いている",
      false: "薬物などの話題が出ても、体験談・ニュース・注意の呼びかけで、取引は持ちかけていない",
    },
  },
  job: {
    type: "noul",
    instructions: "`本文` は、闇バイトなどの違法な仕事に人を誘っていますか？",
    criteria: {
      true: "受け子・運び・名義貸しや、楽にすぐ大金がもらえる仕事に誘っている",
      false: "仕事の話題でも、違法な仕事や怪しい高収入の仕事には誘っていない",
    },
  },
  paid: {
    type: "noul",
    instructions: "`本文` の書き手は、お金と引きかえに会うことや性的な関係を持ちかけていますか？",
    criteria: {
      true: "パパ活・援助交際など、お金や物と引きかえに会う・性的な関係を持つことを持ちかけている",
      false: "恋愛や性の話題でも、お金と引きかえの関係は持ちかけていない",
    },
  },
  threat: {
    type: "noul",
    instructions: "`本文` は、だれかを脅していますか？",
    criteria: {
      true: "だれかに、危害を加える・さらす・仕返しするなどと脅している",
      false: "怒りやぐちを書いていても、だれかを脅してはいない",
    },
  },
  insult: {
    type: "noul",
    instructions: "`本文` は、特定の人をひどくけなしていますか？",
    criteria: {
      true: "特定のメンバーや人を、ばかにする・見た目や性格をひどく悪く言う",
      false: "意見のちがいや冗談で、特定の人をひどくけなしてはいない",
    },
  },
  doxx: {
    type: "noul",
    instructions: "`本文` は、ほかの人の本名・住所・電話番号・勤め先などを書いていますか？",
    criteria: {
      true: "書き手以外のだれかの本名・住所・電話番号・勤め先・学校などを書いている",
      false: "ほかの人の個人情報は書いていない（有名人の名前や、お店の住所などは除く）",
    },
  },
};
// 気になる投稿の一覧・ベルに出す名前（上にあるほど優先）
const POST_LABEL: [string, string][] = [
  ["sell", "違法な売り買い"],
  ["job", "闇バイトの勧誘"],
  ["paid", "お金と引きかえの関係"],
  ["threat", "脅し"],
  ["doxx", "個人情報のさらし"],
  ["insult", "悪口"],
];

// ② 個人チャット（state の `やりとり` について、「相手」のことを聞く）
const DM_Q: Record<string, Q> = {
  contact: {
    type: "noul",
    instructions: "`やりとり` の中で、相手は、あなたの連絡先を聞いたり、ほかのアプリへ移ろうと誘ったりしていますか？",
    criteria: {
      true: "相手が、LINE の ID・電話番号・メールなどを聞いている、またはほかのアプリで話そうと誘っている",
      false: "相手は、キメ友の中だけで話している",
    },
  },
  meet: {
    type: "noul",
    instructions: "`やりとり` の中で、相手は、あなたに会おうと誘っていますか？",
    criteria: {
      true: "相手が、会う・遊ぶ・飲みに行くなど、直接会うことを誘っている",
      false: "相手は、直接会うことは誘っていない",
    },
  },
  sexual: {
    type: "noul",
    instructions: "`やりとり` の中で、相手は、性的なことを書いていますか？",
    criteria: {
      true: "相手が、体・性行為・下着などの性的な話や誘いを書いている",
      false: "相手は、性的な話は書いていない",
    },
  },
  money: {
    type: "noul",
    instructions: "`やりとり` の中で、相手は、お金・投資・副業・物の売り買いの話を持ちかけていますか？",
    criteria: {
      true: "相手が、もうけ話・投資・副業・お金の貸し借り・物の売り買いを持ちかけている",
      false: "相手は、お金の話を持ちかけていない",
    },
  },
  pushy: {
    type: "noul",
    instructions: "`やりとり` の中で、相手は、あなたが断ったあとも、同じ誘いやお願いをくり返していますか？",
    criteria: {
      true: "あなたが断ったり話をそらしたりしたのに、相手が同じ誘いやお願いを何度も送っている",
      false: "相手は、同じ誘いやお願いをくり返していない",
    },
  },
  hurt: {
    type: "noul",
    instructions: "`やりとり` の中で、相手は、あなたをけなしたり、脅したりしていますか？",
    criteria: {
      true: "相手が、あなたをばかにする・ひどく悪く言う・脅す",
      false: "相手は、あなたをけなしたり脅したりしていない",
    },
  },
};

// ③ 不具合の報告（state の `報告` について聞く）
const BUG_Q: Record<string, Q> = {
  kind: {
    type: "choice",
    instructions: "`報告` は、どんな内容ですか？",
    criteria: {
      bug: "アプリが思ったとおりに動かない、表示がおかしい、エラーが出るという報告",
      request: "新しい機能や、変えてほしいことのお願い",
      question: "使い方についての質問",
      other: "あいさつ・お礼・感想など、アプリの不具合でもお願いでも質問でもないもの",
    },
  },
  urgent: {
    type: "noul",
    instructions: "`報告` を書いた人は、ログイン・投稿・チャットなど、アプリの大事な部分が使えなくて困っていますか？",
    criteria: {
      true: "ログインできない、投稿・チャット・通知が使えない、画面が開かないなど、ふだんの使い方ができない",
      false: "一部の見た目や小さな動きの困りごと、またはお願い・質問",
    },
  },
  safety: {
    type: "noul",
    instructions: "`報告` を書いた人は、ほかのメンバーからのいやがらせや、危ない目にあっていることを伝えていますか？",
    criteria: {
      true: "ほかのメンバーにつきまとわれる・いやなことを言われる・脅されるなどを伝えている",
      false: "アプリの動きについての報告やお願いで、人とのトラブルではない",
    },
  },
};

// ===================== TypeSafe を呼ぶ =====================
type Answer = { type: string; noul?: number; choice?: string; probabilities?: Record<string, number> };

async function ask(state: unknown, questions: Record<string, Q>): Promise<Record<string, Answer>> {
  const res = await fetch("https://api.typesafe.ai/v1/systemone", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, state, questions }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error("typesafe " + res.status); // 失敗は「いいえ」にしない
  const out = await res.json();
  return out.answers ?? {};
}
const p = (a: Record<string, Answer>, id: string) => (typeof a[id]?.noul === "number" ? a[id].noul! : 0);

// ===================== ① 投稿・コメント・グループチャット =====================
const POST_TABLES: Record<string, { author: string }> = {
  kimetomo_timeline_posts: { author: "author_id" },
  kimetomo_timeline_comments: { author: "author_id" },
  circle_messages: { author: "sender_id" },
};

// 1回だけ調べるための印。もう印があれば false
async function claim(table: string, id: string): Promise<boolean> {
  const { data, error } = await db.from("kimetomo_ai_checks")
    .upsert({ table_name: table, row_id: id }, { onConflict: "table_name,row_id", ignoreDuplicates: true })
    .select("row_id");
  if (error) throw new Error("claim " + error.code);
  return (data ?? []).length > 0;
}
const fresh = (at: string) => Date.now() - new Date(at).getTime() < 10 * 60e3;

async function checkPost(table: string, id: string) {
  const cols = `id,body,created_at,${POST_TABLES[table].author}` +
    (table === "kimetomo_timeline_comments" ? ",post_id" : table === "circle_messages" ? ",room_id" : "");
  // deno-lint-ignore no-explicit-any
  const { data: row } = await db.from(table).select(cols).eq("id", id).maybeSingle() as { data: any };
  if (!row?.body || !fresh(row.created_at)) return "skip";
  // 言葉の一覧でもう引っかかったものは調べない
  const { count } = await db.from("kimetomo_flagged").select("id", { count: "exact", head: true })
    .eq("table_name", table).eq("row_id", id);
  if (count) return "skip";
  if (!(await claim(table, id))) return "skip";

  // 判断に必要なものだけ送る
  // deno-lint-ignore no-explicit-any
  const state: Record<string, any> = { 本文: row.body.slice(0, 1500) };
  if (table === "kimetomo_timeline_comments" && row.post_id) {
    const { data: post } = await db.from("kimetomo_timeline_posts").select("body").eq("id", row.post_id).maybeSingle();
    if (post?.body) state["コメントされた元の投稿"] = post.body.slice(0, 500);
  }
  if (table === "circle_messages" && row.room_id) {
    const { data: prev } = await db.from("circle_messages").select("body,sender_id").eq("room_id", row.room_id)
      .lt("created_at", row.created_at).order("created_at", { ascending: false }).limit(3);
    if (prev?.length) {
      state["直前の会話"] = prev.reverse().map((m) => ({
        送った人: m.sender_id === row.sender_id ? "書き手" : "ほかのメンバー",
        本文: (m.body ?? "").slice(0, 300),
      }));
    }
  }

  const a = await ask(state, POST_Q);
  const hit = POST_LABEL.find(([k]) => p(a, k) > YES);
  if (!hit) return "ok";
  const link = table === "kimetomo_timeline_posts" ? `./?post=${row.id}`
    : table === "kimetomo_timeline_comments" ? `./?post=${row.post_id ?? ""}` : "./?tab=chat";
  const { error } = await db.rpc("kimetomo_ai_flag", {
    p_table: table, p_row: String(row.id), p_author: row[POST_TABLES[table].author],
    p_word: "🤖 " + hit[1], p_excerpt: row.body, p_link: link,
  });
  if (error) throw new Error("flag " + error.code);
  return "flagged";
}

// ===================== ③ 不具合の報告 =====================
async function checkBug(id: string) {
  const { data: row } = await db.from("kimetomo_bug_reports").select("id,body,created_at").eq("id", id).maybeSingle();
  if (!row?.body || !fresh(row.created_at)) return "skip";
  if (!(await claim("kimetomo_bug_reports", id))) return "skip";
  const a = await ask({ 報告: row.body.slice(0, 1000) }, BUG_Q);
  const kind = a.kind?.choice;
  const { error } = await db.from("kimetomo_bug_reports").update({
    ai_kind: ["bug", "request", "question", "other"].includes(kind ?? "") ? kind : null,
    ai_urgent: p(a, "urgent") > YES,
    ai_safety: p(a, "safety") > YES,
  }).eq("id", id);
  if (error) throw new Error("bug save " + error.code);
  return "ok";
}

// ===================== ② 個人チャット =====================
// 出す注意（上にあるほど優先）。どれに当てはまるかはコードで決める
function dmWarn(a: Record<string, Answer>, myReplies: number): string | null {
  if (p(a, "money") > YES) return "money";
  if (p(a, "hurt") > YES) return "hurt";
  if (p(a, "pushy") > YES) return "pushy";
  if (p(a, "sexual") > YES && myReplies === 0) return "sexual";
  if (p(a, "contact") > YES && myReplies <= 1) return "contact";
  if (p(a, "meet") > YES && myReplies === 0) return "meet";
  return null;
}

async function checkDm(req: Request, convId: string) {
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: who, error: authError } = await db.auth.getUser(jwt);
  if (authError || !who?.user) return json({ error: "ログインしてください" }, 401);
  const me = who.user.id;
  const { data: conv } = await db.from("kimetomo_direct_conversations").select("user_a,user_b").eq("id", convId).maybeSingle();
  if (!conv || (conv.user_a !== me && conv.user_b !== me)) return json({ error: "見られません" }, 403);
  const other = conv.user_a === me ? conv.user_b : conv.user_a;
  const { data: prof } = await db.from("circle_profiles").select("status,is_admin,user_id").in("user_id", [me, other]);
  if (prof?.find((x) => x.user_id === me)?.status !== "approved") return json({ error: "承認されたメンバーだけが使えます" }, 403);
  if (prof?.find((x) => x.user_id === other)?.is_admin) return json({ warn: null }); // 管理者からの DM は調べない

  const { data: msgs } = await db.from("kimetomo_direct_messages").select("id,sender_id,body").eq("conversation_id", convId)
    .order("created_at", { ascending: false }).limit(10);
  const list = (msgs ?? []).reverse();
  const last = [...list].reverse().find((m) => m.sender_id === other); // 相手からの最新
  if (!last) return json({ warn: null, last: null });

  const myReplies = list.filter((m) => m.sender_id === me).length;
  const state = {
    やりとり: list.map((m) => ({ 送った人: m.sender_id === me ? "あなた" : "相手", 本文: (m.body ?? "").slice(0, 400) })),
  };
  const a = await ask(state, DM_Q);
  return json({ warn: dmWarn(a, myReplies), last: last.id });
}

// ===================== 入口 =====================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST だけ使えます" }, 405);
  let body: { mode?: string; table?: string; id?: string; conversation_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "形がちがいます" }, 400);
  }
  if (!KEY) return json({ skipped: "no key", warn: null });
  try {
    if (body.mode === "dm" && body.conversation_id) return await checkDm(req, String(body.conversation_id));
    if (body.mode === "post" && body.id) {
      const id = String(body.id);
      if (body.table === "kimetomo_bug_reports") return json({ result: await checkBug(id) });
      if (body.table && POST_TABLES[body.table]) return json({ result: await checkPost(body.table, id) });
    }
    return json({ error: "形がちがいます" }, 400);
  } catch (e) {
    console.error("typesafe:", (e as Error)?.message ?? "unknown");
    return json({ error: "調べられませんでした" }, 502);
  }
});
