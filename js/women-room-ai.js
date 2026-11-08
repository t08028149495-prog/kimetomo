/* 🌷 女性だけの部屋：📷 AIで確認して入る（women-room.js の申請カードの下に出す）
   ・お題（ポーズ）をもらう → その場でカメラで1枚撮る → AIが確認 → 合格ならすぐ部屋に入る
   ・写真を選ぶボタンはない（撮るだけ）。撮った写真はこの端末にも残さない
   ・管理者は写真を見ない。キメ友には保存しない（Edge Function kimetomo-wroom-ai・supabase/women_room_ai.sql） */
(function(){
 const mk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
 const btn=(text,cls,fn)=>{const b=mk('button',cls,text);b.type='button';b.onclick=fn;return b};
 const err=e=>typeof safeError==='function'?safeError(e):(e?.message||String(e));
 let el=null,busy=false,stream=null,video=null,onDone=null,phase='',loadedAt=0;

 const stopCam=()=>{try{stream?.getTracks().forEach(t=>t.stop())}catch{}stream=null;video=null};

 // 女性だけの部屋のカードから呼ばれる。カードが描き直されても、同じ欄を使い回す（撮影中に消えないように）
 window.kmWroomAi=function(done){
  onDone=done;
  // 性別を変えた・日がたった等で状態が変わるので、撮影中でなければ読み直す（15秒に1回まで）
  if(!el){el=mk('div','km-wroom-ai');load()}
  else if(!busy&&(phase===''||phase==='intro')&&Date.now()-loadedAt>15000)load();
  if(video)queueMicrotask(()=>video?.play?.().catch(()=>{}));
  return el;
 };

 async function load(){
  loadedAt=Date.now();phase='';
  if(!el.childNodes.length)el.replaceChildren(mk('p','small','読み込み中…'));
  const {data,error}=await client.rpc('kimetomo_wroom_ai_status');
  if(error||!data){el.replaceChildren();loadedAt=0;return}
  intro(data);
 }

 function intro(s){
  stopCam();el.replaceChildren();phase='intro';
  // 男性・♂にしたことがある人・見送られた人には何も出さない
  if(['ever_male','not_female','rejected','member','login','no_room'].includes(s.state))return;
  el.append(mk('p','km-wroom-title','📷 AIで確認して、すぐ入る'));
  if(s.state==='used_up'){el.append(mk('p','small','AIでの確認は3回までです。上の「参加を申請する」から、管理者に申請できます。'));return}
  if(s.state==='days'||s.state==='acts'){el.append(mk('p','small','AIで確認できるのは、登録から1日たって、投稿かコメントを1回以上した人です。'+(s.state==='days'?'登録から1日たつと使えます。':'投稿かコメントを1回すると使えます。')));return}
  if(s.state==='today'){el.append(mk('p','small','AIでの確認は1日1回までです。また明日お試しください（あと'+s.left+'回）。'));return}
  const ul=mk('ul');
  for(const t of ['その場で撮った写真1枚を、AI（Anthropic社の Claude。アメリカの会社です）に送って、女性かどうかを確認します。',
   '管理者は写真を見ません。キメ友には写真を保存しません。確認が終わったらすぐ捨てます。',
   'AIの会社では、安全のために一定の期間データが残ることがあります。',
   'AIはまちがえることがあります。だめだったときも、管理者への申請で入れます。',
   '試せるのは1日1回、合計3回までです（あと'+s.left+'回）。',
   'ネットでは、相手が本当に女性かを100%確かめることはできません。部屋の中でも、本名・住所・顔写真・連絡先は書かないでね。'])ul.append(mk('li','',t));
  const lab=mk('label','km-wroom-ai-agree'),cb=mk('input');cb.type='checkbox';lab.append(cb,mk('span','','上のことを読んで、同意します'));
  const out=mk('p','small');
  const go=btn('📷 同意して始める','full',start);go.disabled=true;cb.onchange=()=>{go.disabled=!cb.checked;phase=cb.checked?'agree':'intro'};
  el.append(ul,lab,go,out);
  async function start(){
   if(busy)return;busy=true;go.disabled=true;out.textContent='準備しています…';
   try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('この画面ではカメラが使えません。Safari や Chrome でキメ友を開いてお試しください');
    const {data,error}=await client.rpc('kimetomo_wroom_ai_start');
    if(error)throw error;
    try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:1280}},audio:false})}
    catch{throw new Error('カメラを使えませんでした。カメラの使用を「許可」してから、もう一度お試しください')}
    camera(data);
   }catch(e){out.textContent=err(e);go.disabled=!cb.checked}
   finally{busy=false}
  }
 }

 function camera(t){
  phase='camera';
  el.replaceChildren(mk('p','km-wroom-title','📷 お題のポーズで撮ってください'),mk('p','km-wroom-ai-pose',t.pose),
   mk('p','small','顔と両手がはっきり写るように、明るい場所で撮ってください。お題は5分で使えなくなります。'));
  video=mk('video');video.playsInline=true;video.muted=true;video.autoplay=true;video.srcObject=stream;
  const out=mk('p','small');
  const shoot=btn('📸 撮って送る','',()=>send(t.id,shoot,out));
  const row=mk('div','km-wroom-ai-row');row.append(btn('やめる','ghost',()=>{stopCam();load()}),shoot);
  el.append(video,row,out);video.play().catch(()=>{});
 }

 async function send(id,shoot,out){
  if(busy||!video?.videoWidth){out.textContent='カメラの準備ができるまで、少し待ってください';return}
  busy=true;phase='send';shoot.disabled=true;out.textContent='AIが確認しています…（10秒くらい）';
  // 長い辺を 1024px に縮めて JPEG にする（画面は鏡のように見せているが、送るのは元の向き）
  const w=video.videoWidth,h=video.videoHeight,k=Math.min(1,1024/Math.max(w,h));
  let c=document.createElement('canvas');c.width=Math.round(w*k);c.height=Math.round(h*k);
  c.getContext('2d').drawImage(video,0,0,c.width,c.height);
  let image=c.toDataURL('image/jpeg',0.85).split(',')[1]||'';
  c.width=c.height=0;c=null;stopCam();
  el.replaceChildren(mk('p','km-wroom-title','📷 確認しています'),out);
  try{
   const r=await client.functions.invoke('kimetomo-wroom-ai',{body:{id,image}});
   image='';
   if(r.error){let m=r.error.message||'送れませんでした';try{const j=await r.error.context.json();if(j?.error)m=j.error}catch{}throw new Error(m)}
   const res=r.data||{};
   if(res.result==='pass'){
    el.replaceChildren(mk('p','km-wroom-title','✅ 確認できました！'),mk('p','small','女性だけの部屋に入りました。ようこそ🌷'));
    window.kmChatTargetRoom=String(res.room);if(typeof loadRooms==='function')await loadRooms();
    el=null;onDone?.();return;
   }
   phase='result';const again=btn('戻る','ghost',load);
   el.replaceChildren(mk('p','km-wroom-title',res.result==='error'?'もう一度お試しください':'今回は確認できませんでした'),
    mk('p','small',res.result==='error'
     ?'AIがうまく判定できませんでした。今回は回数に数えていません。明るい場所で、顔と両手がはっきり写るように撮ってみてください。'
     :'AIはまちがえることもあります。ごめんなさい。上の「参加を申請する」から、管理者に申請することもできます。'),again);
  }catch(e){phase='result';el.replaceChildren(mk('p','small','確認できませんでした：'+err(e)),btn('戻る','ghost',load))}
  finally{busy=false;image=''}
 }
})();
