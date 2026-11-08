-- キメ友SNS: 未成年を思わせる言葉（「jc」「中学生」「15歳」など）を含む書き込みを止める
--   ・タイムラインの投稿・コメント・グループチャット・プロフィールなどで、保存する前に止める
--   ・止めたときは「18歳未満の方の利用や、未成年を思わせる書き込みはできません」と表示する
--   ・個人チャット（DM）は対象外（今までどおり、薬物の名前だけを止める）
--   ・言葉は kimetomo_ng_words に level = 'minor' で追加・削除できる
--     （例）追加：insert into public.kimetomo_ng_words (word, kind, level) values ('〇〇', 'ja', 'minor');
--     （例）削除：delete from public.kimetomo_ng_words where word = '〇〇';
-- 先に ng_words.sql と ng_warn.sql を実行しておくこと。何度実行しても大丈夫です。

alter table public.kimetomo_ng_words drop constraint if exists kimetomo_ng_words_level_check;
alter table public.kimetomo_ng_words add constraint kimetomo_ng_words_level_check check (level in ('block', 'warn', 'minor'));

-- 'ja'：文の途中に含まれていたら止める / 'en'：英単語として出てきたら止める
insert into public.kimetomo_ng_words (word, kind, level) values
  ('中学生','ja','minor'),('小学生','ja','minor'),('女子高生','ja','minor'),('女子高校生','ja','minor'),('男子高校生','ja','minor'),
  ('高校生です','ja','minor'),('高校生だよ','ja','minor'),('現役高校生','ja','minor'),
  ('高1です','ja','minor'),('高2です','ja','minor'),('高3です','ja','minor'),
  ('中1です','ja','minor'),('中2です','ja','minor'),('中3です','ja','minor'),
  ('未成年です','ja','minor'),('未成年だよ','ja','minor'),
  ('12歳','ja','minor'),('13歳','ja','minor'),('14歳','ja','minor'),('15歳','ja','minor'),('16歳','ja','minor'),('17歳','ja','minor'),
  ('児童ポルノ','ja','minor'),('児ポ','ja','minor'),('ロリ画像','ja','minor'),('ロリ動画','ja','minor'),('ショタ','ja','minor'),
  ('jc','en','minor'),('jk','en','minor'),('jc1','en','minor'),('jc2','en','minor'),('jc3','en','minor'),
  ('jk1','en','minor'),('jk2','en','minor'),('jk3','en','minor'),('loli','en','minor'),('shota','en','minor')
on conflict (word) do update set level = excluded.level, kind = excluded.kind;

-- 保存する前の確認（ng_warn.sql の内容に「未成年」の確認を足したもの）
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

  -- 未成年を思わせる言葉は、保存しない
  foreach col in array tg_argv loop
    hit := public.kimetomo_ng_hit_level(rec ->> col, 'minor');
    if hit is not null then
      raise exception '18歳未満の方の利用や、未成年を思わせる書き込み（「%」）は、キメ友では投稿できません。内容を変えてください。', hit
        using errcode = 'P0001';
    end if;
  end loop;

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

-- ========== 確認 ==========
select public.kimetomo_ng_hit_level('関西 ♀️ jcですDMください', 'minor') as 例1_止まる言葉,
       public.kimetomo_ng_hit_level('ダイエット中なのでカロリー控えめ', 'minor') as 例2_止まらない（空ならOK）,
       (select count(*) from public.kimetomo_ng_words where level = 'minor') as 未成年の言葉の数,
       'OK：未成年を思わせる書き込みを止めるようにしました' as 結果;
