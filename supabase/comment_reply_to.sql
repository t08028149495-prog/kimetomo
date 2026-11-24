-- ↩️ 返信への返信（2026-11-25）
-- コメントの段は今まで通り 1 段まで（返信は、いちばん上のコメントの下に並べる）。
-- 返信の「返信する」から書いたときは reply_to_id に「返信した相手のコメント」を入れ、
-- その人にもベル（→プッシュ・メールも）で知らせる。

alter table public.kimetomo_timeline_comments
  add column if not exists reply_to_id uuid
  references public.kimetomo_timeline_comments(id) on delete set null;

-- 入力のチェック：reply_to_id は「同じ流れ（いちばん上のコメントか、その返信）」のコメントだけ
create or replace function public.kimetomo_validate_comment()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
declare
  parent_parent uuid;
begin
  if tg_op = 'UPDATE' then
    raise exception 'コメントの編集には対応していません';
  end if;

  if new.parent_id is not null then
    select parent_id into parent_parent
    from public.kimetomo_timeline_comments
    where id = new.parent_id
      and post_id = new.post_id;

    if not found then
      raise exception '返信先が見つかりません';
    end if;

    if parent_parent is not null then
      raise exception '返信への再返信はできません';
    end if;
  end if;

  if new.reply_to_id is not null then
    if new.parent_id is null or not exists (
      select 1 from public.kimetomo_timeline_comments c
      where c.id = new.reply_to_id
        and c.post_id = new.post_id
        and (c.id = new.parent_id or c.parent_id = new.parent_id)
    ) then
      raise exception '返信先が見つかりません';
    end if;
  end if;

  return new;
end;
$function$;

-- ベル：返信した相手（reply_to_id のコメントを書いた人）にも知らせる
create or replace function public.kimetomo_bell_on_comment()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  owner uuid;
  parent_author uuid;
  target uuid;
  who text := public.kimetomo_bell_name(new.author_id);
  link text := './?post=' || new.post_id::text;
  snippet text := left(coalesce(new.body, ''), 80);
begin
  select p.author_id into owner from public.kimetomo_timeline_posts p where p.id = new.post_id;

  if owner is not null and owner <> new.author_id
     and not public.kimetomo_bell_blocked(owner, new.author_id) then
    insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
    values (owner, 'comment', new.author_id, new.post_id::text, snippet,
            who || 'さんがあなたの投稿にコメントしました', link);
  end if;

  if new.parent_id is not null then
    select c.author_id into parent_author from public.kimetomo_timeline_comments c where c.id = new.parent_id;
    -- 投稿者本人への通知と重ならないようにする
    if parent_author is not null and parent_author <> new.author_id
       and parent_author is distinct from owner
       and not public.kimetomo_bell_blocked(parent_author, new.author_id) then
      insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
      values (parent_author, 'reply', new.author_id, new.post_id::text, snippet,
              who || 'さんがあなたのコメントに返信しました', link);
    end if;
  end if;

  -- 返信への返信：その返信を書いた人にも（上の 2 人と重ならないように）
  if new.reply_to_id is not null then
    select c.author_id into target from public.kimetomo_timeline_comments c where c.id = new.reply_to_id;
    if target is not null and target <> new.author_id
       and target is distinct from owner
       and target is distinct from parent_author
       and target is distinct from public.kimetomo_anon_carrier()
       and not public.kimetomo_bell_blocked(target, new.author_id) then
      insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
      values (target, 'reply', new.author_id, new.post_id::text, snippet,
              who || 'さんがあなたのコメントに返信しました', link);
    end if;
  end if;
  return new;
end $function$;
