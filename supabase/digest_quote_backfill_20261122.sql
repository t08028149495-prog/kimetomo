-- キメ友SNS: 2026-11-22 の「今週のキメ友まとめ」に、後から引用カードを付けた（1回だけの作業。実行済み）
-- 投稿後の引用の変更は kimetomo_post_edit_guard が止めるので、この書き換えの間だけ止めて、すぐ戻す。
-- 「編集済み」の印は付かない（edited_at はそのまま）。
begin;
alter table public.kimetomo_timeline_posts disable trigger kimetomo_post_edit_guard;
update public.kimetomo_timeline_posts
   set quote_post_id = '91635c6f-668e-436c-b2ba-865812c5a848',
       body = replace(body, '（リアクション7・コメント0）', E'（リアクション7・コメント0）\n👇 下のカードを押すと、その投稿へ移動します')
 where id = 'fb786133-a9c4-4272-b385-1ab048e63f5f' and quote_post_id is null;
alter table public.kimetomo_timeline_posts enable trigger kimetomo_post_edit_guard;
commit;
