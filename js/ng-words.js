
/* 使えない言葉（薬物の名前）の確認。本当の確認はデータベースで行い、ここでは先に分かりやすく知らせるだけ */
(function(){
 const ja=['覚醒剤','覚せい剤','かくせいざい','シャブ','メタンフェタミン','アンフェタミン','ヒロポン','大麻','マリファナ','マリワナ','ガンジャ','ハシシ','ハシッシュ','ウィード','麻薬','まやく','コカイン','ヘロイン','アヘン','阿片','モルヒネ','ケタミン','フェンタニル','エクスタシー','mdma','危険ドラッグ','脱法ドラッグ','脱法ハーブ','合法ハーブ','違法薬物','キメセク'];
 const en=['meth','methamphetamine','amphetamine','cocaine','heroin','marijuana','cannabis','ganja','hashish','ecstasy','lsd','thc','ketamine','fentanyl','opium','ghb'];
 const kata=t=>t.replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+0x60));
 const norm=t=>kata((t||'').normalize('NFKC').toLowerCase());
 const squeeze=t=>norm(t).replace(/[\s・･.\-_*~〜ー―‐/\\|,、。!！?？☆★♪♡❤]+/g,'').replaceAll('シャブシャブ','');
 window.kmNgHit=text=>{
  const sq=squeeze(text),sp=norm(text);
  for(const w of ja)if(sq.includes(squeeze(w)))return w;
  for(const w of en)if(new RegExp('(^|[^a-z0-9])'+w+'([^a-z0-9]|$)').test(sp))return w;
  return null;
 };
 // 未成年を思わせる言葉（データベースの minor_guard.sql と同じ一覧）
 const minorJa=['中学生','小学生','女子高生','女子高校生','男子高校生','高校生です','高校生だよ','現役高校生','高1です','高2です','高3です','中1です','中2です','中3です','未成年です','未成年だよ','12歳','13歳','14歳','15歳','16歳','17歳','児童ポルノ','児ポ','ロリ画像','ロリ動画','ショタ'];
 const minorEn=['jc','jk','jc1','jc2','jc3','jk1','jk2','jk3','loli','shota'];
 // 「15歳の頃に〜」のような昔の話・「息子が中学生で〜」のような家族の話は止めない（supabase/minor_soften.sql と同じ決まり）
 const kw='(?:女子高校生|男子高校生|女子高生|現役高校生|中学生|小学生|高校生|中学|小学|高校|1[2-7]歳|中[1-3]|高[1-3])';
 const kws=kw+'(?:ト?'+kw+')*';
 const fam='(?:息子|ムスコ|娘|ムスメ|子供|子ドモ|コドモ|ウチノ子|ウチノコ|我ガ子|ワガ子|長男|長女|次男|次女|三男|三女|末ッ子|甥ッ子|姪ッ子|甥|姪|弟|妹|孫|オトウト|イモウト)(?:サン|クン|チャン)?';
 const kin='(?:息子|ムスコ|娘|ムスメ|甥ッ子|姪ッ子|甥|姪|弟|妹|孫|長男|長女|次男|次女|三男|三女)';
 const tim='(?:今年|来年|今|イマ|モウスグ|モウ)';
 const softRe=[
  new RegExp(kws+'(?:ノ?(?:頃|コロ|時代|時期|ジダイ|時|トキ)|ダッタ|デシタ|以来|イライ)','g'),
  new RegExp(fam+'(?:(?:ガ|ハ|モ|ノ)'+tim+'?|'+tim+')(?:デ|カラ)?'+kws+'(?:デス|ダヨ)?','g'),
  new RegExp(kws+'ノ'+kin,'g')
 ];
 window.kmMinorSoften=sq=>softRe.reduce((s,re)=>s.replace(re,'|'),sq);
 window.kmMinorHit=text=>{
  const sq=window.kmMinorSoften(squeeze(text)),sp=norm(text);
  for(const w of minorJa)if(sq.includes(squeeze(w)))return w;
  for(const w of minorEn)if(new RegExp('(^|[^a-z0-9])'+w+'([^a-z0-9]|$)').test(sp))return w;
  return null;
 };
 window.kmMinorMessage=w=>'18歳未満の方の利用や、未成年を思わせる書き込み（「'+w+'」）は、キメ友では投稿できません。\n内容を変えてください。';
})();
