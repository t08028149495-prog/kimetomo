-- リアルタイム更新：新しい投稿の案内と、通知ベルの数をすぐ更新する（js/live.js）
-- 表をリアルタイムの配信に加えるだけ。誰に届くかは今までどおり RLS（見てよい人だけ）で決まる。
-- ・投稿：女性だけの投稿は女性だけの部屋のメンバーにだけ、BAN された人には届かない
-- ・ベル：本人あての通知だけが本人に届く
alter publication supabase_realtime add table public.kimetomo_timeline_posts;
alter publication supabase_realtime add table public.kimetomo_bell_notifications;

-- 元に戻すとき
-- alter publication supabase_realtime drop table public.kimetomo_timeline_posts;
-- alter publication supabase_realtime drop table public.kimetomo_bell_notifications;
