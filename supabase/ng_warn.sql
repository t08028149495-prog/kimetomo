-- キメ友SNS: 違法なことにつながりそうな言葉に「ゆるいフィルター」をかける
--   ・薬物の名前など（これまでの一覧）……保存を止める（今までどおり）
--   ・闇バイト・売買の誘いなど、違法につながりそうな言葉……保存は止めず、
--     管理者にお知らせして「気になる投稿」の一覧に残す（個人チャットは対象外）
--   ・言葉は kimetomo_ng_words に level = 'warn' で追加・削除できる
-- 先に ng_words.sql を実行しておくこと。何度実行しても大丈夫です。

alter table public.kimetomo_ng_words add column if not exists level text not null default 'block';
alter table public.kimetomo_ng_words drop constraint if exists kimetomo_ng_words_level_check;
alter table public.kimetomo_ng_words add constraint kimetomo_ng_words_level_check check (level in ('block', 'warn'));

insert into public.kimetomo_ng_words (word, kind, level) values
  ('闇バイト','ja','warn'),('裏バイト','ja','warn'),('ホワイト案件','ja','warn'),('高額案件','ja','warn'),
  ('受け子','ja','warn'),('出し子','ja','warn'),('掛け子','ja','warn'),('運び屋','ja','warn'),('叩き案件','ja','warn'),
  ('手押し','ja','warn'),('売人','ja','warn'),('野菜売','ja','warn'),('草売','ja','warn'),('冷たいの','ja','warn'),('ネタ売','ja','warn'),
  ('名義貸し','ja','warn'),('口座売','ja','warn'),('口座買','ja','warn'),('口座譲','ja','warn'),('携帯売','ja','warn'),('飛ばし携帯','ja','warn'),
  ('偽造','ja','warn'),('詐欺','ja','warn'),('リスト売','ja','warn'),('即金','ja','warn'),
  ('援交','ja','warn'),('円光','ja','warn'),('パパ活','ja','warn'),('ママ活','ja','warn'),('売春','ja','warn'),('買春','ja','warn'),
  ('拳銃','ja','warn'),('チャカ','ja','warn'),
  ('テレグラム','ja','warn'),('シグナルで','ja','warn'),('秘匿アプリ','ja','warn'),
  ('telegram','en','warn')
on conflict (word) do update set level = excluded.level, kind = excluded.kind;

-- 止める言葉（level = 'block'）だけを調べる
create or replace function public.kimetomo_ng_hit_level(p text, p_level text)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  squeezed text;
  spaced text;
  w record;
begin
  if p is null or p = '' then return null; end if;
  squeezed := replace(public.kimetomo_ng_normalize(p), 'シャブシャブ', '');
  spaced := public.kimetomo_ng_normalize(p, true);
  for w in select word, kind from public.kimetomo_ng_words where level = p_level loop
    if w.kind = 'ja' then
      if position(replace(public.kimetomo_ng_normalize(w.word), 'シャブシャブ', '') in squeezed) > 0 then
        return w.word;
      end if;
    else
      if spaced ~* ('(^|[^a-z0-9])' || w.word || '([^a-z0-9]|$)') then
        return w.word;
      end if;
    end if;
  end loop;
  return null;
end $$;

create or replace function public.kimetomo_ng_hit(p text)
returns text language sql stable security definer set search_path = public as $$
  select public.kimetomo_ng_hit_level(p, 'block');
$$;

-- 気になる投稿の記録
create table if not exists public.kimetomo_flagged (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id text,
  author_id uuid,
  word text not null,
  excerpt text,
  created_at timestamptz not null default now()
);
alter table public.kimetomo_flagged enable row level security;
revoke all on public.kimetomo_flagged from anon, authenticated;
create index if not exists km_flagged_created_idx on public.kimetomo_flagged (created_at desc);

-- 管理者用：最近の気になる投稿
create or replace function public.kimetomo_admin_flagged()
returns table (id bigint, table_name text, row_id text, author_name text, word text, excerpt text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.circle_profiles where user_id = auth.uid() and is_admin and status = 'approved') then
    raise exception '管理者だけが使えます';
  end if;
  return query
    select f.id, f.table_name, f.row_id,
           coalesce((select nullif(display_name, '') from public.kimetomo_user_profiles u where u.user_id = f.author_id),
                    (select nullif(display_name, '') from public.circle_profiles c where c.user_id = f.author_id), 'メンバー'),
           f.word, f.excerpt, f.created_at
    from public.kimetomo_flagged f
    order by f.created_at desc
    limit 50;
end $$;
revoke all on function public.kimetomo_admin_flagged() from public, anon;
grant execute on function public.kimetomo_admin_flagged() to authenticated;

-- 保存する前の確認：止める言葉なら止める／気になる言葉なら記録して管理者に知らせる
create or replace function public.kimetomo_ng_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  col text;
  hit text;
  rec jsonb := to_jsonb(new);
  author uuid;
  link text;
begin
  foreach col in array tg_argv loop
    hit := public.kimetomo_ng_hit_level(rec ->> col, 'block');
    if hit is not null then
      raise exception '使えない言葉が含まれています（「%」）。内容を変えてからもう一度お試しください。', hit
        using errcode = 'P0001';
    end if;
  end loop;

  -- 個人チャットは、管理者が読むことになるので対象外
  if tg_table_name = 'kimetomo_direct_messages' then return new; end if;

  foreach col in array tg_argv loop
    hit := public.kimetomo_ng_hit_level(rec ->> col, 'warn');
    if hit is not null then
      author := coalesce(rec ->> 'author_id', rec ->> 'sender_id', rec ->> 'user_id')::uuid;
      insert into public.kimetomo_flagged (table_name, row_id, author_id, word, excerpt)
      values (tg_table_name, rec ->> 'id', author, hit, left(rec ->> col, 120));
      link := case tg_table_name
                when 'kimetomo_timeline_posts' then './?post=' || coalesce(rec ->> 'id', '')
                when 'kimetomo_timeline_comments' then './?post=' || coalesce(rec ->> 'post_id', '')
                when 'circle_messages' then './?tab=chat'
                else './?tab=profile' end;
      -- 同じ人について、管理者へのお知らせは 1 時間に 1 回まで
      if not exists (select 1 from public.kimetomo_flagged f
                     where f.author_id is not distinct from author and f.created_at > now() - interval '1 hour'
                       and f.id <> (select max(id) from public.kimetomo_flagged)) then
        insert into public.kimetomo_bell_notifications (recipient_id, kind, actor_id, ref_id, body, push_text, url)
        select p.user_id, 'admin_notice', author, 'flag', left(rec ->> col, 80),
               '⚠️ 気になる言葉（「' || hit || '」）を含む投稿がありました', link
        from public.circle_profiles p
        where p.is_admin and p.status = 'approved' and p.user_id is distinct from author;
      end if;
      exit;
    end if;
  end loop;
  return new;
end $$;

-- 確認：言葉の数
select level, count(*) from public.kimetomo_ng_words group by level;
