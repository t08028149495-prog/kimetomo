/* ↩️ グループチャットの返信（supabase/chat_reply.sql）
   ・メッセージの「☺︎＋」の右の「↩️ 返信」を押すと、入力欄の上に「○○さんに返信」の帯が出る
   ・返信には、元のメッセージを小さく表示。押すと元のメッセージへ移動
   ・返信された本人には、ベルとプッシュで通知（DB 側で送る） */
(function(){
 let replyTo=null;           // {id,name,body}
 const parents=new Map();    // 画面にない返信先のメッセージ（id → {sender_id,body} か null＝消えた）
 const cut=(s,n)=>{s=String(s||'').replace(/\s+/g,' ').trim();return s.length>n?s.slice(0,n)+'…':s};
 const $=id=>document.getElementById(id);

 function bar(){
  let b=$('km-chat-replybar');
  if(!b){
   const compose=document.querySelector('#chat .chat-compose');if(!compose)return null;
   b=document.createElement('div');b.id='km-chat-replybar';b.className='km-chat-replybar hide';
   const text=document.createElement('div');text.className='km-chat-replybar-text';
   const x=document.createElement('button');x.type='button';x.className='km-chat-replybar-x';x.textContent='✕';x.setAttribute('aria-label','返信をやめる');
   x.onclick=()=>cancel();
   b.append(text,x);compose.before(b);
  }
  return b;
 }
 function paint(){
  const b=bar();if(!b)return;
  b.classList.toggle('hide',!replyTo);
  window.kmChatFit?.(); // チャット欄を縮めて、入力欄が下のタブに隠れないように
  const t=b.querySelector('.km-chat-replybar-text');t.replaceChildren();
  if(!replyTo)return;
  const head=document.createElement('strong');head.textContent='↩️ '+(replyTo.name||'メンバー')+'さんに返信';
  const body=document.createElement('span');body.textContent=cut(replyTo.body,40);
  t.append(head,body);
 }
 function cancel(){replyTo=null;paint()}

 // 「↩️ 返信」を押したとき（js/topic.js のスタンプの選択肢から）
 window.kmChatStartReply=function(item,name){
  if(!item?.id)return;
  replyTo={id:item.id,name,body:item.body};paint();
  const input=$('chat-text');if(input){input.focus({preventScroll:true})}
 };
 // 送るときに使う返信先（送ったら消す）
 window.kmChatReplyId=()=>replyTo?.id||null;
 window.kmChatReplyDone=cancel;

 // ルームを変えたら返信をやめる
 document.addEventListener('change',e=>{if(e.target?.id==='chat-room')cancel()});

 // 画面にない返信先を読む（同じルームのメッセージだけ。読めないものは「削除されたメッセージ」）
 window.kmChatReplyParents=async function(msgs){
  const have=new Map((msgs||[]).map(m=>[String(m.id),m]));
  const need=[...new Set((msgs||[]).map(m=>m.reply_to).filter(Boolean).map(String))].filter(id=>!have.has(id)&&!parents.has(id));
  if(need.length&&window.client){
   const {data,error}=await window.client.from('circle_messages').select('id,sender_id,body').in('id',need.slice(0,50));
   if(!error){const got=new Map((data||[]).map(m=>[String(m.id),m]));for(const id of need.slice(0,50))parents.set(id,got.get(id)||null)}
  }
  const out=new Map();
  for(const m of msgs||[]){if(!m.reply_to)continue;const id=String(m.reply_to);out.set(id,have.get(id)||parents.get(id)||null)}
  return out;
 };

 // 返信の上に、元のメッセージを小さく表示する
 window.kmChatReplyQuote=function(item,parentMap,profiles,blocked,myId){
  if(!item.reply_to)return null;
  const p=parentMap?.get(String(item.reply_to));
  const q=document.createElement('button');q.type='button';q.className='km-chat-quote';
  const who=document.createElement('strong');const text=document.createElement('span');
  if(!p){who.textContent='↩️ 返信';text.textContent='削除されたメッセージ'}
  else if(blocked?.has(p.sender_id)){who.textContent='↩️ 返信';text.textContent='ブロック中の人のメッセージ'}
  else{
   const name=p.sender_id===myId?'自分':(profiles?.get(p.sender_id)?.name||'メンバー');
   who.textContent='↩️ '+name;text.textContent=cut(p.body,40);
  }
  q.append(who,text);
  q.setAttribute('aria-label','元のメッセージへ移動');
  q.onclick=e=>{e.stopPropagation();if(!focus(item.reply_to))window.note?.('元のメッセージは、古いため表示されていません。')};
  return q;
 };

 // そのメッセージまで動かして、少しの間光らせる
 function focus(id){
  const row=document.querySelector('#chat-feed .chat-message[data-km-msg="'+CSS.escape(String(id))+'"]');
  if(!row)return false;
  row.scrollIntoView({behavior:'smooth',block:'center'});
  row.classList.remove('km-chat-flash');void row.offsetWidth;row.classList.add('km-chat-flash');
  setTimeout(()=>row.classList.remove('km-chat-flash'),2200);
  return true;
 }
 window.kmChatFocusMessage=focus;
})();
