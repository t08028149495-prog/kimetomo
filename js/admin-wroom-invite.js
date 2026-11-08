/* 🌷 女性トークルーム専用の招待リンク・QRコード（管理者メニュー「👥 招待」）
   1つのリンクは1回だけ・7日間。まだ登録していない人にも使える（キメ友の招待コードもいっしょに入る）
   しくみは supabase/women_room_invite.sql */
(function(){
 const fold=document.getElementById('km-wroominv-fold'),box=document.getElementById('km-wroominv-box'),state=document.getElementById('km-wroominv-state');
 if(!fold||!box)return;
 const mk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
 const err=e=>typeof safeError==='function'?safeError(e):(e?.message||String(e));
 const ago=v=>window.kmTimeAgo?window.kmTimeAgo(v):new Date(v).toLocaleString('ja-JP');
 const urlOf=r=>'https://kimetomo.com/?invite='+r.signup_code+'&wroom='+r.code;
 const TEXT='キメ友の🌷女性トークルームに招待するね！このリンクから開いてね（1回だけ使えます）。まだ登録していなければ、このリンクから新規登録してね。';
 let libP=null;
 const lib=()=>libP||(libP=new Promise((ok,ng)=>{if(window.qrcode)return ok(window.qrcode);const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';sc.onload=()=>window.qrcode?ok(window.qrcode):ng(Error('QRコードを作れませんでした'));sc.onerror=()=>{libP=null;ng(Error('QRコードの部品を読み込めませんでした'))};document.head.append(sc)}));
 async function qrImg(url){const q=(await lib())(0,'M');q.addData(url);q.make();const n=q.getModuleCount(),cell=7,m=4,size=(n+m*2)*cell;
  const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,size,size);g.fillStyle='#000';
  for(let r=0;r<n;r++)for(let k=0;k<n;k++)if(q.isDark(r,k))g.fillRect((k+m)*cell,(r+m)*cell,cell,cell);
  const img=mk('img','km-openinv-qr');img.alt='女性トークルームの招待QRコード';img.src=c.toDataURL('image/png');return img}
 function shareRow(r,withQr){
  const url=urlOf(r),row=mk('div','km-invite-actions');
  const sh=mk('button','','📤 送る');sh.type='button';
  const cp=mk('button','ghost','📋 コピー');cp.type='button';
  sh.onclick=async()=>{if(navigator.share){try{await navigator.share({title:'キメ友 🌷 女性トークルーム',text:TEXT,url});return}catch(e){if(e?.name==='AbortError')return}}cp.click()};
  cp.onclick=async()=>{try{await navigator.clipboard.writeText(url);cp.textContent='✓ コピーしました'}catch{prompt('このリンクをコピーして送ってね',url)}};
  row.append(sh,cp);
  if(withQr){const qb=mk('button','ghost','🔳 QRコード');qb.type='button';qb.onclick=async()=>{qb.disabled=true;try{row.after(await qrImg(url));qb.remove()}catch(e){alert(err(e));qb.disabled=false}};row.append(qb)}
  return row;
 }
 async function render(created){
  box.replaceChildren(mk('p','small','読み込み中…'));
  const {data,error}=await client.rpc('kimetomo_admin_wroom_invites');
  box.replaceChildren();
  if(error){box.append(mk('p','small','読み込めません（women_room_invite.sql を実行してください）: '+err(error)));return}
  const open=(data||[]).filter(r=>!r.used_at&&!r.revoked&&new Date(r.expires_at)>new Date()).length;
  state.textContent=open?'未使用のリンク '+open+'件':'女性トークルーム専用の招待リンク・QRコード';
  box.append(mk('p','small','友達に送ると、その人だけが女性トークルームに入れるリンクです。1回だけ使えて、7日で使えなくなります。まだキメ友に登録していない人も、このリンクから登録できます。入るときは、プロフィールの性別を♀にしてもらう必要があります。'));
  const note=mk('input');note.type='text';note.maxLength=40;note.placeholder='メモ（だれに送るか。自分だけが見られます）';note.className='km-wroominv-note';
  const make=mk('button','full','＋ 新しい招待リンクを作る');make.type='button';
  make.onclick=async()=>{make.disabled=true;make.textContent='作成中…';
   const {data:d,error:e}=await client.rpc('kimetomo_admin_create_wroom_invite',{p_note:note.value});
   if(e){alert('作れませんでした：'+err(e));make.disabled=false;make.textContent='＋ 新しい招待リンクを作る';return}
   render(d?.[0]?.code)};
  box.append(note,make);
  for(const r of data||[]){
   const expired=!r.used_at&&(r.revoked||new Date(r.expires_at)<=new Date());
   const it=mk('div',r.code===created?'km-invite-new':'km-invite-item');
   if(r.code===created)it.append(mk('strong','','✅ 招待リンクを作りました'));
   const head=mk('div');
   head.append(mk('span','km-invite-state '+(r.used_at||expired?'used':'open'),r.used_at?'使用済み':r.revoked?'取り消し':expired?'期限切れ':'未使用'),
    mk('span','small',' '+(r.note?r.note+'・':'')+ago(r.created_at)+'に作成'+(r.used_at?'・'+(r.used_name||'メンバー')+' さんが参加':'')));
   it.append(head);
   if(!r.used_at&&!expired){
    if(r.code===created)it.append(mk('div','km-invite-url',urlOf(r)));
    it.append(shareRow(r,true));
    const rv=mk('button','ghost km-post-del','取り消す');rv.type='button';
    rv.onclick=async()=>{if(!confirm('この招待リンクを取り消しますか？（もう使えなくなります）'))return;rv.disabled=true;
     const {error:e}=await client.rpc('kimetomo_admin_revoke_wroom_invite',{p_code:r.code});if(e){alert(err(e));rv.disabled=false;return}render()};
    it.append(rv);
   }
   box.append(it);
  }
 }
 fold.addEventListener('toggle',()=>{if(fold.open&&typeof client!=='undefined'&&client)render()});
})();
