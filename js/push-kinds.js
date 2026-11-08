/* プッシュ通知を種類ごとにオン／オフ（設定は Supabase の kimetomo_push_prefs。supabase/push_prefs.sql） */
(function(){
 const box=document.getElementById('km-push-kinds'),list=document.getElementById('km-push-kinds-list'),state=document.getElementById('km-push-kinds-state');
 if(!box||!list||!state)return;
 // [種類, 表示名, 管理者だけに出すか]
 const KINDS=[
  ['chat','💬 グループチャットの新着'],
  ['dm','✉️ 個人チャット（DM）'],
  ['comment','🗨️ 自分の投稿へのコメント'],
  ['reply','↩️ 自分のコメントへの返信'],
  ['reaction','❤️ 自分の投稿へのリアクション'],
  ['image_post','🖼️ 画像つきの新しい投稿'],
  ['request_done','✅ リクエストした機能の完成'],
  ['request_new','💡 新しい機能リクエスト',true],
  ['admin_notice','📢 その他のお知らせ（運営からの返事など）']
 ];
 let off=new Set(),discreet=false,loadedFor=null,saving=Promise.resolve();
 // 「ロック画面に名前を出さない」設定（supabase/push_discreet.sql）
 const dRow=document.createElement('label');dRow.className='km-email-toggle';dRow.style.marginTop='10px';
 const dCb=document.createElement('input');dCb.type='checkbox';
 const dText=document.createElement('span');dText.textContent='🤫 ロック画面に名前を出さない（「お知らせ：新しいお知らせがあります」とだけ表示）';
 dRow.append(dCb,dText);state.before(dRow);
 const sb=()=>window.client;
 function paint(){
  list.textContent='';
  for(const [kind,label,adminOnly] of KINDS){
   if(adminOnly&&!window.kmIsAdmin)continue;
   const row=document.createElement('label');row.className='km-email-toggle';
   const cb=document.createElement('input');cb.type='checkbox';cb.dataset.kind=kind;cb.checked=!off.has(kind);
   const text=document.createElement('span');text.textContent=label;
   row.append(cb,text);list.append(row);
  }
 }
 async function load(){
  const c=sb();if(!c)return;
  const {data:{session}}=await c.auth.getSession();
  const uid=session?.user?.id;
  if(!uid){loadedFor=null;return}
  if(loadedFor===uid){paint();return}
  loadedFor=uid;
  const {data,error}=await c.from('kimetomo_push_prefs').select('off_kinds,discreet').eq('user_id',uid).maybeSingle();
  if(error){state.textContent='設定を読み込めませんでした。';loadedFor=null;return}
  off=new Set(data?.off_kinds||[]);discreet=data?.discreet===true;dCb.checked=discreet;state.textContent='';paint();
 }
 list.addEventListener('change',e=>{
  const cb=e.target.closest('input[data-kind]');if(!cb)return;
  if(cb.checked)off.delete(cb.dataset.kind);else off.add(cb.dataset.kind);
  const kinds=[...off];
  state.textContent='保存中…';
  // 続けて押されても、押した順に保存する
  saving=saving.then(async()=>{
   let error=null;
   try{({error}=await sb().rpc('kimetomo_set_push_off',{p_kinds:kinds}))}catch(e){error=e}
   state.textContent=error?'保存できませんでした。時間をおいてもう一度お試しください。':'保存しました。';
  });
 });
 dCb.addEventListener('change',()=>{
  const on=dCb.checked;
  state.textContent='保存中…';
  saving=saving.then(async()=>{
   let error=null;
   try{({error}=await sb().rpc('kimetomo_set_push_discreet',{p_on:on}))}catch(e){error=e}
   if(error)dCb.checked=discreet;else discreet=on;
   state.textContent=error?'保存できませんでした。時間をおいてもう一度お試しください。':'保存しました。';
  });
 });
 // ログインして画面が使えるようになったら読み込む
 new MutationObserver(()=>{if(document.body.classList.contains('km-nav-ready'))load().catch(()=>{})})
  .observe(document.body,{attributes:true,attributeFilter:['class','data-km-tab']});
 box.addEventListener('toggle',()=>{if(box.open)load().catch(()=>{})});
})();
