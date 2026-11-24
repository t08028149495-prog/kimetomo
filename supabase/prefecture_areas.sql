-- キメ友SNS: 住んでいる地域に「大まかな地域」も選べるようにする（2026-11-25）
--   ・47都道府県に加えて、全国・北海道・東北・関東・中部・関西・中国・四国・九州・沖縄 を選べる
--   ・列は今までと同じ prefecture（「名前＠関東」のように表示）
-- 何度実行しても大丈夫です。

alter table public.kimetomo_user_profiles drop constraint if exists kimetomo_user_profiles_prefecture_check;
alter table public.kimetomo_user_profiles add constraint kimetomo_user_profiles_prefecture_check
  check (prefecture is null or prefecture in (
    '全国','北海道・東北','関東','中部','関西','中国・四国','九州・沖縄',
    '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
    '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
    '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県',
    '三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
    '鳥取県','島根県','岡山県','広島県','山口県',
    '徳島県','香川県','愛媛県','高知県',
    '福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'
  ));

notify pgrst, 'reload schema';

select 'OK：大まかな地域も選べるようにしました' as 結果;
