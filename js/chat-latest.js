
/* チャット：「⬇ 最新へ」ボタンと新着のお知らせ */
(function(){
 const feed=document.getElementById('chat-feed');if(!feed)return;
 const wrap=document.createElement('div');wrap.className='km-feed-wrap';feed.before(wrap);wrap.append(feed);
 const btn=document.createElement('button');btn.type='button';btn.className='km-to-latest hide';wrap.append(btn);
 const seen=new Set();let unseen=0;
 const atBottom=()=>feed.scrollHeight-feed.scrollTop-feed.clientHeight<120;
 const key=i=>i.type+':'+i.id;
 let lastItems=[];
 function paint(){
  if(atBottom()){unseen=0;lastItems.forEach(i=>seen.add(key(i)));btn.classList.add('hide');return}
  btn.textContent=unseen?'⬇ 新着 '+unseen+'件':'⬇ 最新へ';
  btn.classList.toggle('has-new',!!unseen);btn.classList.remove('hide');
 }
 window.kmChatAfterRender=(items,wasAtBottom)=>{
  lastItems=items||[];
  if(wasAtBottom){lastItems.forEach(i=>seen.add(key(i)));unseen=0}
  else{const me=typeof current!=='undefined'&&current?current.id:null;unseen=lastItems.filter(i=>!seen.has(key(i))&&i.sender_id!==me).length}
  paint();
 };
 feed.addEventListener('scroll',()=>paint(),{passive:true});
 btn.onclick=()=>{feed.scrollTo({top:feed.scrollHeight,behavior:'smooth'});unseen=0;setTimeout(paint,400)};
 document.getElementById('chat-room')?.addEventListener('change',()=>{window.kmChatForceBottom=true;seen.clear();unseen=0});
 document.querySelectorAll('.km-bottom-nav [data-km-go="chat"]').forEach(b=>b.addEventListener('click',()=>{window.kmChatForceBottom=true}));

 // チャット欄の高さを画面に合わせる（入力欄が画面の下にはみ出さないように）
 const chat=document.getElementById('chat'),compose=document.querySelector('#chat .chat-compose'),nav=document.querySelector('.km-bottom-nav');
 let lastH=0;
 function fit(){
  if(!chat||chat.classList.contains('hide')||!chat.offsetParent)return;
  const nr=nav?.getBoundingClientRect();
  const bottomBar=nr&&nr.height>0&&nr.width>innerWidth/2; // スマホは下のメニュー、パソコンは左のメニュー
  const avail=bottomBar?nr.top:innerHeight;
  const top=feed.getBoundingClientRect().top+scrollY;
  const pad=parseFloat(getComputedStyle(chat).paddingBottom)||20;
  const h=Math.max(240,Math.floor(avail-top-(compose?compose.offsetHeight+10:60)-pad-12));
  // 隠れている間に読み込まれると一番上のままになるので、見えたときに最新へ
  if(feed.scrollTop===0&&feed.scrollHeight>feed.clientHeight+10){feed.scrollTop=feed.scrollHeight;paint()}
  if(h===lastH)return;
  const stick=atBottom();lastH=h;feed.style.height=h+'px';
  if(stick)feed.scrollTop=feed.scrollHeight;
 }
 const later=()=>requestAnimationFrame(()=>requestAnimationFrame(fit));
 window.addEventListener('resize',later);
 if(chat)new MutationObserver(later).observe(chat,{attributes:true,attributeFilter:['class']});
 new MutationObserver(later).observe(document.body,{attributes:true,attributeFilter:['data-km-tab','class']});
 const wroom=document.getElementById('km-wroom');if(wroom)new MutationObserver(later).observe(wroom,{childList:true,attributes:true,attributeFilter:['class']});
 const roomSel=document.getElementById('chat-room');if(roomSel)new MutationObserver(later).observe(roomSel,{attributes:true,attributeFilter:['style']});
 later();
})();
