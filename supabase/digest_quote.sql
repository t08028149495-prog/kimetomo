-- キメ友SNS: 「今週のキメ友まとめ」に、いちばん盛り上がった投稿を引用カードで付ける
-- （カードを押すとその投稿へ移動する。動きは js/quote.js と app.js の kmJumpToPost）
-- kimetomo_insert_post_as と同じく、その一瞬だけ投稿者本人として投稿する。
-- 女性だけの投稿・匿名の相談は、引用の見張り（kimetomo_quote_guard）が止める。
-- 何度実行しても大丈夫です。

create or replace function public.kimetomo_insert_post_as_quote(p_author uuid, p_body text, p_quote uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  old_sub text := current_setting('request.jwt.claim.sub', true);
  old_claims text := current_setting('request.jwt.claims', true);
  old_role text := current_setting('request.jwt.claim.role', true);
  new_id text;
begin
  perform set_config('request.jwt.claim.sub', p_author::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_author, 'role', 'authenticated')::text, true);
  begin
    insert into public.kimetomo_timeline_posts (author_id, body, quote_post_id)
    values (p_author, left(p_body, 1000), p_quote)
    returning id::text into new_id;
  exception when others then
    perform set_config('request.jwt.claim.sub', coalesce(old_sub, ''), true);
    perform set_config('request.jwt.claim.role', coalesce(old_role, ''), true);
    perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
    raise;
  end;
  perform set_config('request.jwt.claim.sub', coalesce(old_sub, ''), true);
  perform set_config('request.jwt.claim.role', coalesce(old_role, ''), true);
  perform set_config('request.jwt.claims', coalesce(old_claims, ''), true);
  return new_id;
end $$;

revoke all on function public.kimetomo_insert_post_as_quote(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.kimetomo_insert_post_as_quote(uuid, text, uuid) to service_role;
