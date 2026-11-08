
/* 違法につながりそうな言葉のゆるいフィルター（投稿前に確認する。本当の記録はデータベースで行う） */
(function(){
 const warn=['闇バイト','裏バイト','ホワイト案件','高額案件','受け子','出し子','掛け子','運び屋','叩き案件','手押し','売人','野菜売','草売','冷たいの','ネタ売','名義貸し','口座売','口座買','口座譲','携帯売','飛ばし携帯','偽造','詐欺','リスト売','即金','援交','円光','パパ活','ママ活','売春','買春','拳銃','チャカ','テレグラム','シグナルで','秘匿アプリ'];
 const kata=t=>t.replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+0x60));
 const sq=t=>kata((t||'').normalize('NFKC').toLowerCase()).replace(/[\s・･.\-_*~〜ー―‐/\\|,、。!！?？☆★♪♡❤]+/g,'');
 window.kmWarnHit=text=>{const t=sq(text);for(const w of warn)if(t.includes(sq(w)))return w;if(/(^|[^a-z0-9])telegram([^a-z0-9]|$)/i.test((text||'').normalize('NFKC')))return 'telegram';return null};
 window.kmWarnOk=text=>{
  const ng=window.kmNgHit?.(text);
  if(ng){alert('使えない言葉（「'+ng+'」）が含まれています。内容を変えてください。');return false}
  const minor=window.kmMinorHit?.(text);
  if(minor){alert(window.kmMinorMessage(minor));return false}
  const w=window.kmWarnHit(text);
  if(!w)return true;
  return confirm('「'+w+'」のような言葉は、違法な取引や勧誘につながるおそれがあります。\nキメ友では、違法なやりとりは禁止です。\n\nこのまま投稿しますか？（管理者にお知らせされます）');
 };
 // 管理者メニュー：気になる投稿の一覧
 const fold=document.getElementById('km-flag-fold'),list=document.getElementById('km-flag-list');
 if(!fold)return;
 const where={kimetomo_timeline_posts:'タイムライン',kimetomo_timeline_comments:'コメント',circle_messages:'グループ',kimetomo_user_profiles:'プロフィール',circle_profiles:'ユーザー名',kimetomo_feature_requests:'機能リクエスト',kimetomo_timeline_polls:'アンケート',circle_rooms:'ルーム名'};
 fold.addEventListener('toggle',async()=>{
  if(!fold.open)return;
  list.textContent='読み込み中…';
  const {data,error}=await client.rpc('kimetomo_admin_flagged');
  if(error){list.textContent='読み込めません（SQLが未実行の可能性があります）';return}
  list.replaceChildren();
  // ここまで見た印を覚える（「対応が必要なこと」の件数から外す。js/admin-tabs.js）
  const top=Math.max(0,...(data||[]).map(x=>Number(x.id)||0));
  try{if(top>Number(localStorage.getItem('km-flag-seen')||0))localStorage.setItem('km-flag-seen',String(top))}catch{}
  window.kmLoadAdminTodo?.();
  if(!data?.length){list.textContent='気になる投稿はありません 👍';return}
  for(const f of data){
   const d=document.createElement('div');d.className='km-mascot-item';
   const h=document.createElement('span');h.className='small';h.textContent=(window.kmTimeAgo?window.kmTimeAgo(f.created_at):f.created_at)+'・'+(where[f.table_name]||f.table_name)+'・'+f.author_name+'・「'+f.word+'」';
   const b=document.createElement('div');b.textContent=f.excerpt||'';
   d.append(h,b);list.append(d);
  }
 });
})();
