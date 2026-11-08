
/* 友達を招待する（1回だけ使える招待リンク。1人1日3件まで、管理者は無制限） */
(function(){
 const btn=document.getElementById('km-share-top-button'),box=document.getElementById('km-invite-box');
 if(!btn||!box)return;
 const linkOf=code=>'https://kimetomo.com/?invite='+code;
 const mk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
 const shareBtns=(code)=>{
  const url=linkOf(code),text='キメ友SNSに招待するね！このリンクから新規登録してね（1回だけ使えます）。';
  const row=mk('div','km-invite-actions');
  const sh=mk('button','','📤 送る');sh.type='button';
  sh.onclick=async()=>{if(navigator.share){try{await navigator.share({title:'キメ友SNS',text,url});return}catch(e){if(e?.name==='AbortError')return}}cp.click()};
  const cp=mk('button','ghost','📋 コピー');cp.type='button';
  cp.onclick=async()=>{try{await navigator.clipboard.writeText(url);cp.textContent='✓ コピーしました'}catch{prompt('このリンクをコピーして送ってね',url)}};
  row.append(sh,cp);return row;
 };
 async function render(created){
  box.replaceChildren(mk('p','small','読み込み中…'));
  const {data,error}=await client.rpc('kimetomo_my_invites');
  box.replaceChildren();
  const head=mk('div','top');head.append(mk('h2','','🔗 友達を招待する'));const close=mk('button','ghost','閉じる');close.type='button';close.onclick=()=>box.classList.add('hide');head.append(close);box.append(head);
  if(error){box.append(mk('p','small','読み込めません: '+safeError(error)));return}
  const rows=(data||[]).filter(r=>r.code);const remaining=data?.[0]?.remaining??0;
  box.append(mk('p','small','招待リンクは1回だけ使えます（7日間有効）。送った相手がそのリンクから新規登録すると、キメ友に入れます。'));
  box.append(mk('p','km-invite-left',remaining<0?'管理者は何件でも作れます':'今日あと '+remaining+' 件作れます（1日3件まで）'));
  const make=mk('button','full','＋ 新しい招待リンクを作る');make.type='button';make.disabled=remaining===0;
  make.onclick=async()=>{make.disabled=true;make.textContent='作成中…';const {data:d,error:e}=await client.rpc('kimetomo_create_invite');if(e){alert(safeError(e));render();return}render(d?.[0]?.code)};
  box.append(make);
  if(created){const c=mk('div','km-invite-new');c.append(mk('strong','','✅ 招待リンクを作りました'),mk('div','km-invite-url',linkOf(created)),shareBtns(created));box.append(c)}
  if(rows.length){box.append(mk('p','small','最近作った招待リンク'));
   for(const r of rows){const it=mk('div','km-invite-item');const expired=new Date(r.expires_at)<new Date();
    it.append(mk('span','km-invite-state '+(r.used?'used':expired?'used':'open'),r.used?'使用済み':expired?'期限切れ':'未使用'),mk("span","small",window.kmTimeAgo(r.created_at)+"に作成"));
    if(!r.used&&!expired&&r.code!==created)it.append(shareBtns(r.code));box.append(it)}}
 }
 btn.addEventListener('click',()=>{if(typeof client==='undefined'||!client)return;const open=box.classList.toggle('hide')===false;if(open){render();box.scrollIntoView({behavior:'smooth',block:'start'})}});
 // 管理者：招待の記録
 const fold=document.getElementById('km-invlog-fold'),list=document.getElementById('km-invlog-list');
 fold?.addEventListener('toggle',async()=>{if(!fold.open)return;list.textContent='読み込み中…';
  const {data,error}=await client.rpc('kimetomo_admin_invites');
  if(error){list.textContent='読み込めません（invites.sql を実行してください）: '+safeError(error);return}
  list.replaceChildren();
  if(!data?.length){list.append(mk('p','small','まだ招待リンクから入った人はいません。'));return}
  for(const r of data){const it=mk('div','km-invite-item');it.append(mk('span','',r.inviter+' さん → '+r.invitee+' さん'),mk("span","small",window.kmTimeAgo(r.used_at)));list.append(it)}
 });
})();
