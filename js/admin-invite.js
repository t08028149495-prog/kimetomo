
/* 📣 管理者の招待URL・QRコード（何人でも使える。1日の上限人数つき） */
(function(){
 const fold=document.getElementById('km-openinv-fold'),box=document.getElementById('km-openinv-box'),state=document.getElementById('km-openinv-state');
 if(!fold)return;
 const mk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
 let libP=null;
 const lib=()=>libP||(libP=new Promise((ok,ng)=>{if(window.qrcode)return ok(window.qrcode);const sc=document.createElement('script');sc.src='https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';sc.onload=()=>window.qrcode?ok(window.qrcode):ng(Error('QRコードを作れませんでした'));sc.onerror=()=>{libP=null;ng(Error('QRコードの部品を読み込めませんでした'))};document.head.append(sc)}));
 async function qrImg(url){const q=(await lib())(0,'M');q.addData(url);q.make();const n=q.getModuleCount(),cell=8,m=4,size=(n+m*2)*cell;
  const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,size,size);g.fillStyle='#000';
  for(let r=0;r<n;r++)for(let k=0;k<n;k++)if(q.isDark(r,k))g.fillRect((k+m)*cell,(r+m)*cell,cell,cell);
  const img=mk('img','km-openinv-qr');img.alt='キメ友SNSの招待QRコード';img.src=c.toDataURL('image/png');return img}
 async function render(note){
  box.replaceChildren(mk('p','small','読み込み中…'));
  const {data,error}=await client.rpc('kimetomo_admin_open_invite');
  box.replaceChildren();
  if(error){box.append(mk('p','small','読み込めません（invites_open.sql を実行してください）: '+safeError(error)));return}
  const r=data?.[0];if(!r)return;const url='https://kimetomo.com/?invite='+r.code;
  state.textContent='今日 '+r.today_uses+' / '+r.daily_limit+' 人';
  if(note)box.append(mk('p','small',note));
  box.append(mk('p','km-invite-left','今日の登録：'+r.today_uses+' / '+r.daily_limit+' 人（これまでの合計 '+r.total_uses+' 人）'));
  box.append(mk('div','km-invite-url',url));
  const acts=mk('div','km-invite-actions');
  const sh=mk('button','','📤 送る');sh.type='button';sh.onclick=async()=>{if(navigator.share){try{await navigator.share({title:'キメ友SNS',text:'キメ友SNSに招待するね！このリンクから新規登録してね。',url});return}catch(e){if(e?.name==='AbortError')return}}cp.click()};
  const cp=mk('button','ghost','📋 コピー');cp.type='button';cp.onclick=async()=>{try{await navigator.clipboard.writeText(url);cp.textContent='✓ コピーしました'}catch{prompt('このリンクをコピーしてね',url)}};
  acts.append(sh,cp);box.append(acts);
  try{box.append(await qrImg(url),mk('p','small','QRコードの画像を長押しすると「写真に保存」できます。'))}catch(e){box.append(mk('p','small',safeError(e)))}
  const lim=mk('div','km-openinv-limit');const inp=mk('input');inp.type='number';inp.inputMode='numeric';inp.min='1';inp.max='100';inp.value=r.daily_limit;
  const save=mk('button','ghost','1日の上限人数を保存');save.type='button';
  save.onclick=async()=>{const n=parseInt(inp.value,10);if(!(n>=1&&n<=100)){alert('1〜100人で入れてください');return}save.disabled=true;const {error:e}=await client.rpc('kimetomo_admin_open_invite_limit',{p_limit:n});save.disabled=false;if(e){alert('保存できません: '+safeError(e));return}render('1日の上限を '+n+' 人にしました。')};
  lim.append(inp,mk('span','small','人まで'),save);box.append(lim);
  const reset=mk('button','ghost full','🔄 URLとQRコードを作り直す');reset.type='button';reset.style.marginTop='10px';
  reset.onclick=async()=>{if(!confirm('URLとQRコードを作り直しますか？\n今のURLとQRコードは使えなくなります。'))return;reset.disabled=true;const {error:e}=await client.rpc('kimetomo_admin_open_invite_reset');if(e){alert('作り直せません: '+safeError(e));reset.disabled=false;return}render('新しいURLとQRコードを作りました。前のものは使えません。')};
  box.append(reset);
 }
 fold.addEventListener('toggle',()=>{if(fold.open)render()});
})();
