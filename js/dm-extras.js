/* 💌 個人チャット（dm.html）のおまけ機能
   1. スタンプ：入力欄の左の「😊」から選んで送る。中身はふつうの文字（例「🌹 おつかれさま」）として送り、
      一覧と同じ文字なら大きなスタンプの形で表示する（通知・最近のやりとりでは文字のまま出る）。
      絵文字だけ（3つまで）のメッセージも大きく表示する。
   2. リアクション：相手のメッセージを押すと ❤️ 😂 👍 😮 😢 🙏 を 1 つ付けられる（同じものをもう一度押すと外す）。
      データは kimetomo_dm_reactions（supabase/dm_reactions.sql）。外すときは emoji を空にする。
      相手が付けた分はリアルタイムで届く（メッセージと同じ通信の中で受け取る）。
   3. ピン留め：「最近のやりとり」の 📌 を押すと、その相手をいつもいちばん上に出す。
      端末の中だけに覚える（キー km-dm-pins-自分のID。データベースは使わない）。
   dm.html の中から window.kmDmX の関数を呼ぶ。 */
(()=>{
 const STAMPS=[
  ['🌹','おつかれさま'],['💕','ありがとう'],['👋','やっほー'],['🙏','よろしくね'],
  ['☀️','おはよう'],['🌙','おやすみ'],['😂','ウケる'],['🥺','ごめんね'],
  ['✨','いいね！'],['👌','りょうかい'],['🎉','おめでとう'],['🫶','だいすき']
 ];
 const REACTS=['❤️','😂','👍','😮','😢','🙏'];
 const stampText=s=>s[0]+' '+s[1];
 const stampOf=body=>STAMPS.find(s=>stampText(s)===String(body||'').trim());
 const db=()=>window.kmDb,me=()=>window.kmMe;
 const mk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
 const showError=t=>{const e=document.getElementById('error');if(e)e.textContent=t||''};

 // 絵文字だけ（3つまで）か
 const seg=window.Intl?.Segmenter?new Intl.Segmenter('ja',{granularity:'grapheme'}):null;
 function emojiOnly(body){
  const t=String(body||'').trim();if(!t||t.length>40||!/\p{Extended_Pictographic}/u.test(t))return false;
  if(!/^[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}‍️⃣\s]+$/u.test(t))return false;
  const n=seg?[...seg.segment(t.replace(/\s/g,''))].length:[...t.replace(/\s/g,'')].length;
  return n<=3;
 }

 // ---- リアクション ----
 let conv=null;const reacts=new Map(); // message_id → Map(user_id → emoji)
 function paint(mid){
  const bubble=document.querySelector('#message-list .bubble[data-mid="'+CSS.escape(String(mid))+'"]');if(!bubble)return;
  bubble.querySelector(':scope > .km-dm-reacts')?.remove();
  const got=reacts.get(String(mid));if(!got)return;
  const row=mk('div','km-dm-reacts');
  for(const [uid,emoji] of got){
   if(!emoji)continue;
   const mine=uid===me()?.id;
   const chip=mk(mine?'button':'span','km-dm-react'+(mine?' mine':''),emoji);
   if(mine){chip.type='button';chip.title='自分のリアクション（押すと外す）';chip.setAttribute('aria-label',emoji+' を外す');chip.onclick=e=>{e.stopPropagation();react(mid,emoji)}}
   else chip.title='相手のリアクション';
   row.append(chip);
  }
  if(row.childElementCount)bubble.querySelector(':scope > .time')?.before(row);
 }
 function setLocal(mid,uid,emoji){const k=String(mid);if(!reacts.has(k))reacts.set(k,new Map());reacts.get(k).set(uid,emoji||null);paint(k)}
 async function react(mid,emoji){
  const c=db(),u=me();if(!c||!u||!conv)return;
  const before=reacts.get(String(mid))?.get(u.id)||null,next=before===emoji?null:emoji;
  setLocal(mid,u.id,next);showError('');
  const {error}=await c.from('kimetomo_dm_reactions').upsert({message_id:mid,user_id:u.id,conversation_id:conv,emoji:next,updated_at:new Date().toISOString()},{onConflict:'message_id,user_id'});
  if(error){setLocal(mid,u.id,before);showError('リアクションを付けられませんでした。'+(error.code==='42501'?'（相手とのやりとりが止められています）':''))}
 }
 async function load(convId,ids){
  conv=convId;reacts.clear();
  const c=db();if(!c||!ids?.length)return;
  const {data,error}=await c.from('kimetomo_dm_reactions').select('message_id,user_id,emoji').eq('conversation_id',convId).in('message_id',ids).not('emoji','is',null);
  if(error||conv!==convId)return;
  for(const r of data||[])setLocal(r.message_id,r.user_id,r.emoji);
 }
 // メッセージと同じリアルタイムの通信に、リアクションの知らせも足す（付ける・選び直す・外す）
 function listen(channel,convId,alive){
  const on=p=>{const r=p?.new;if(!alive()||!r||String(r.conversation_id)!==String(convId)||r.user_id===me()?.id)return;setLocal(r.message_id,r.user_id,r.emoji)};
  for(const event of ['INSERT','UPDATE'])channel.on('postgres_changes',{event,schema:'public',table:'kimetomo_dm_reactions',filter:'conversation_id=eq.'+convId},on);
 }
 // 相手のメッセージを押したときに出す、リアクションを選ぶ列
 function bar(msg){
  const row=mk('div','km-dm-bar');const mine=reacts.get(String(msg.id))?.get(me()?.id);
  for(const emoji of REACTS){const b=mk('button','km-dm-pick'+(mine===emoji?' on':''),emoji);b.type='button';b.setAttribute('aria-label',emoji+' を付ける');b.onclick=e=>{e.stopPropagation();row.remove();react(msg.id,emoji)};row.append(b)}
  return row;
 }

 // ---- スタンプ・大きな絵文字 ----
 function decorate(bubble,body,msg){
  bubble.dataset.mid=msg.id;
  const s=stampOf(msg.body);
  if(s){bubble.classList.add('km-stamp');body.replaceChildren(mk('span','km-stamp-e',s[0]),mk('span','km-stamp-t',s[1]))}
  else if(emojiOnly(msg.body))bubble.classList.add('km-emoji-only');
  if(reacts.has(String(msg.id)))queueMicrotask(()=>paint(msg.id));
 }
 function setupStamps(){
  const form=document.getElementById('message-form'),input=document.getElementById('message-input');if(!form||!input||form.querySelector('.km-stamp-open'))return;
  const open=mk('button','km-stamp-open','😊');open.type='button';open.setAttribute('aria-label','スタンプを送る');open.setAttribute('aria-expanded','false');
  const panel=mk('div','km-stamp-panel hidden');panel.setAttribute('role','group');panel.setAttribute('aria-label','スタンプ');
  const close=()=>{panel.classList.add('hidden');open.setAttribute('aria-expanded','false')};
  for(const s of STAMPS){
   const b=mk('button','km-stamp-pick');b.type='button';b.append(mk('span','km-stamp-e',s[0]),mk('span','km-stamp-t',s[1]));
   b.onclick=()=>{if(input.disabled)return;close();window.kmDmSend?.(stampText(s))};panel.append(b);
  }
  open.onclick=()=>{if(input.disabled)return;const show=panel.classList.contains('hidden');panel.classList.toggle('hidden',!show);open.setAttribute('aria-expanded',String(show))};
  form.prepend(open);form.after(panel);
  // 送れない相手のときは 😊 も押せないようにする
  new MutationObserver(()=>{open.disabled=input.disabled;if(input.disabled)close()}).observe(input,{attributes:true,attributeFilter:['disabled']});
  document.getElementById('chat-close')?.addEventListener('click',close);
 }

 // ---- ピン留め（端末の中だけ） ----
 const pinKey=()=>'km-dm-pins-'+(me()?.id||'');
 function pins(){try{const a=JSON.parse(localStorage.getItem(pinKey())||'[]');return new Set(Array.isArray(a)?a:[])}catch{return new Set()}}
 function togglePin(uid){const s=pins();if(s.has(uid))s.delete(uid);else s.add(uid);try{localStorage.setItem(pinKey(),JSON.stringify([...s].slice(-20)))}catch{}return s.has(uid)}

 window.kmDmX={decorate,bar,load,listen,pins,togglePin,stampOf};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupStamps,{once:true});else setupStamps();
})();
