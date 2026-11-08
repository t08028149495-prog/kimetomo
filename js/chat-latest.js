
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
})();
