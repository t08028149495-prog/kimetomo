/* 🤖 個人チャット（dm.html）：受け取ったメッセージを TypeSafe で見分け、気をつけたほうがよさそうなときだけ、受け取った人に注意を出す
   ・管理者には知らせない。データベースにも記録しない（Edge Function kimetomo-typesafe の mode "dm"）
   ・相手から新しいメッセージが届いたときだけ調べる。結果は端末に覚える（キー km-dm-safe-会話ID）
   ・閉じた注意は、同じ種類なら同じ会話でもう出さない */
(function(){
 const TEXT={
  money:'💸 お金・投資・副業・売り買いの話が出ています。お金を送ったり、知らない話にのったりしないでください。',
  hurt:'💢 あなたを傷つけることが書かれているようです。がまんせず、ブロックや通報を使ってください。',
  pushy:'🙅 断ったあとも同じ誘いが続いているようです。返事をしなくても大丈夫です。',
  sexual:'🔞 性的なメッセージが届いています。いやなときは、ブロックや通報を使ってください。',
  contact:'📱 連絡先やほかのアプリを聞かれています。よく知るまでは、教えないほうが安心です。',
  meet:'🚶 会おうと誘われています。会うのは、よく知ってから・人の多い場所で。',
 };
 const key=id=>'km-dm-safe-'+id;
 const read=id=>{try{return JSON.parse(localStorage.getItem(key(id))||'null')}catch{return null}};
 const save=(id,v)=>{try{localStorage.setItem(key(id),JSON.stringify(v))}catch{}};
 let timer=0,busy=0;

 function show(o,id,saved){
  document.getElementById('km-dm-safety')?.remove();
  if(!saved?.warn||!TEXT[saved.warn]||saved.closed===saved.warn)return;
  const list=document.getElementById('message-list');if(!list)return;
  const box=document.createElement('div');box.id='km-dm-safety';box.className='km-dm-safety';box.setAttribute('role','note');
  const p=document.createElement('p');p.textContent=TEXT[saved.warn];
  const row=document.createElement('div');row.className='km-dm-safety-actions';
  if(window.kmReport&&saved.last){const r=document.createElement('button');r.type='button';r.className='ghost';r.textContent='🚩 通報する';
   r.onclick=()=>window.kmReport({kind:'dm',id:saved.last,userId:o.otherId,who:o.who,selfId:o.meId});row.append(r)}
  const x=document.createElement('button');x.type='button';x.className='ghost';x.textContent='閉じる';
  x.onclick=()=>{save(id,{...saved,closed:saved.warn});box.remove()};row.append(x);
  const note=document.createElement('small');note.textContent='🤖 自動で見分けた注意です。相手には知らされません。';
  box.append(p,row,note);list.after(box);
 }

 // o = {db, id（会話）, meId, otherId, who（相手の名前）, lastIncoming（相手からの最新メッセージの ID）}
 async function run(o){
  const saved=read(o.id);
  if(!o.lastIncoming){show(o,o.id,saved);return}
  if(saved&&saved.last===o.lastIncoming){show(o,o.id,saved);return}
  const v=++busy;
  try{
   const {data,error}=await o.db.functions.invoke('kimetomo-typesafe',{body:{mode:'dm',conversation_id:o.id}});
   if(error||!data||'error' in data||v!==busy)return;
   if(data.skipped)return;
   const next={last:data.last||o.lastIncoming,warn:data.warn||null,closed:saved?.closed||null};
   save(o.id,next);
   if(window.kmDmSafetyNow===o.id)show(o,o.id,next);
  }catch{}
 }
 window.kmDmSafety=o=>{
  if(window.kmDmSafetyNow!==o.id)document.getElementById('km-dm-safety')?.remove();
  window.kmDmSafetyNow=o.id;
  clearTimeout(timer);timer=setTimeout(()=>run(o),o.wait||0);
 };
})();
