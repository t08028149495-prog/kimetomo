"""キメ友SNS: 毎週月曜に「今週のキメ友まとめ」をタイムラインへ投稿する。

環境変数: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DRY_RUN（"true" なら投稿せず表示だけ）
"""
import datetime as dt
import os
import sys

import requests

URL = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1"
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
DRY_RUN = os.environ.get("DRY_RUN", "false").lower() == "true"
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
DIGEST_MARK = "🏆 今週のキメ友まとめ"
JST = dt.timezone(dt.timedelta(hours=9))


def get(table, params):
    r = requests.get(f"{URL}/{table}", headers=H, params=params, timeout=60)
    r.raise_for_status()
    return r.json()


def count(table, params):
    r = requests.get(f"{URL}/{table}", headers={**H, "Prefer": "count=exact", "Range": "0-0"},
                     params={**params, "select": "id"}, timeout=60)
    r.raise_for_status()
    total = r.headers.get("Content-Range", "*/0").split("/")[-1]
    return int(total) if total.isdigit() else 0


def in_list(values):
    return "in.(" + ",".join(str(v) for v in values) + ")"


def short(text, n=40):
    text = " ".join((text or "").split())
    return text if len(text) <= n else text[: n - 1] + "…"


now = dt.datetime.now(JST)
end = now.replace(hour=0, minute=0, second=0, microsecond=0)
start = end - dt.timedelta(days=7)
since, until = start.isoformat(), end.isoformat()
period = f"{start:%-m/%-d}〜{(end - dt.timedelta(days=1)):%-m/%-d}"
window = {"and": f"(created_at.gte.{since},created_at.lt.{until})"}

posts = [p for p in get("kimetomo_timeline_posts", {"select": "id,author_id,body,created_at", **window})
         if not (p.get("body") or "").startswith(DIGEST_MARK)]
comment_total = count("kimetomo_timeline_comments", window)
chat_total = count("circle_messages", window)

if not posts and not chat_total:
    print("今週は投稿もチャットもなかったので、まとめは投稿しません。")
    sys.exit(0)

ids = [p["id"] for p in posts]
reactions, comments, polls, votes = [], [], [], []
if ids:
    reactions = get("kimetomo_timeline_reactions", {"select": "post_id", "post_id": in_list(ids)})
    comments = get("kimetomo_timeline_comments", {"select": "post_id", "post_id": in_list(ids)})
    try:
        polls = get("kimetomo_timeline_polls", {"select": "post_id,options", "post_id": in_list(ids)})
        if polls:
            votes = get("kimetomo_timeline_poll_votes",
                        {"select": "post_id,option_index", "post_id": in_list([p["post_id"] for p in polls])})
    except requests.HTTPError:
        polls, votes = [], []


def score(post):
    r = sum(1 for x in reactions if x["post_id"] == post["id"])
    c = sum(1 for x in comments if x["post_id"] == post["id"])
    return r, c


authors = {p["author_id"] for p in posts}
names = {}
if authors:
    for row in get("circle_profiles", {"select": "user_id,display_name", "user_id": in_list(authors)}):
        names[row["user_id"]] = row.get("display_name")
    for row in get("kimetomo_user_profiles", {"select": "user_id,display_name", "user_id": in_list(authors)}):
        if row.get("display_name"):
            names[row["user_id"]] = row["display_name"]

lines = [f"{DIGEST_MARK}（{period}）",
         f"📝 投稿 {len(posts)}件　💬 コメント {comment_total}件　🗨️ チャット {chat_total}件"]

if posts:
    best = max(posts, key=lambda p: (sum(score(p)), p["created_at"]))
    r, c = score(best)
    if r + c > 0:
        who = names.get(best["author_id"]) or "メンバー"
        lines += ["", "⭐ いちばん盛り上がった投稿",
                  f"{who}さん「{short(best['body'])}」（リアクション{r}・コメント{c}）"]

for poll in polls:
    opts = poll.get("options") or []
    tally = [sum(1 for v in votes if v["post_id"] == poll["post_id"] and v["option_index"] == i)
             for i in range(len(opts))]
    if opts and sum(tally) > 0:
        top = max(range(len(opts)), key=lambda i: tally[i])
        question = next((short(p["body"], 30) for p in posts if p["id"] == poll["post_id"]), "アンケート")
        lines += ["", f"📊 アンケート「{question}」→「{opts[top]}」が1位（{tally[top]}票）"]
        break

lines += ["", "今週もキメ友で楽しもう！"]
body = "\n".join(lines)
print(body)

if DRY_RUN:
    print("\n（お試し実行なので、投稿はしていません）")
    sys.exit(0)

admins = get("circle_profiles", {"select": "user_id", "is_admin": "eq.true", "status": "eq.approved",
                                 "order": "user_id", "limit": "1"})
if not admins:
    print("管理者が見つからないため、投稿できませんでした。")
    sys.exit(1)

r = requests.post(f"{URL}/kimetomo_timeline_posts", headers={**H, "Content-Type": "application/json",
                  "Prefer": "return=minimal"}, json={"author_id": admins[0]["user_id"], "body": body}, timeout=60)
r.raise_for_status()
print("\nタイムラインに投稿しました。")
