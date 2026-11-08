
/* 今日のお題 */
(function(){
 const topics=['最近食べておいしかったものは？','今ハマっていることは？','最近うれしかったことを教えて','おすすめの音楽・曲は？','休みの日は何してる？','子どもの頃の夢は？','最近見た動画・映画・アニメは？','行ってみたい場所は？','好きなコンビニのお菓子は？','今日の天気と気分は？','朝ごはん派？抜く派？','最近買ってよかったものは？','ストレス解消法は？','好きな季節とその理由は？','今いちばん欲しいものは？','得意料理・好きな料理は？','最近笑ったことは？','おすすめのゲームは？','好きな飲み物は？','今週がんばったことは？','寝る前にしていることは？','最近覚えた豆知識は？','好きな動物は？','人生で一番の思い出は？','あったらいいなと思う発明は？','好きな麺類は？','最近の小さな幸せは？','おすすめのお店は？','一日だけ別の人になれるなら誰？','好きな言葉・座右の銘は？','今の待ち受け画面は何？','地元の自慢を教えて','最近始めたことは？','苦手だけど克服したいことは？','好きなおにぎりの具は？','宝くじが当たったら何する？','最近の睡眠時間は？','好きなキャラクターは？','おすすめのアプリは？','最近感動したことは？','好きな朝ごはんは？','行ってよかった旅行先は？','もし魔法が使えたら何する？','最近ついたちょっとした嘘は？','好きなお寿司のネタは？','苦手な食べ物は？','最近読んだ本・マンガは？','一番好きなお菓子は？','今まででいちばん高い買い物は？','好きなラーメンの味は？','学生時代の部活は？','ついやってしまう癖は？','最近がんばった自分をほめて','好きな色は？','行ってみたい国は？','好きな映画・ドラマは？','カラオケの十八番は？','最近気になっているニュースは？','朝型？夜型？','好きなパンは？','最近のマイブームは？','無人島に1つだけ持っていくなら？','ほっとする瞬間は？','最近の失敗談を教えて','好きなスポーツは？','もらってうれしかった言葉は？','おすすめの過ごし方（雨の日）は？','いま一番会いたい人は？','好きな丼ものは？','今日のひとこと'];
 // 季節のお題（日本時間の日付で判定。上にあるものほど優先）
 const seasons=[
  {name:'🎍 お正月のお題',from:'01-01',to:'01-07',list:['今年の目標は？','お正月に何食べた？','初詣に行った？','おみくじの結果は？','今年やってみたいことは？','お年玉の思い出は？','好きなおせち料理は？','年末年始はどう過ごした？']},
  {name:'🍫 バレンタインのお題',from:'02-10',to:'02-14',list:['好きなチョコのお菓子は？','バレンタインの思い出は？','もらってうれしいプレゼントは？','手作りお菓子を作ったことある？']},
  {name:'🎎 ひな祭りのお題',from:'03-01',to:'03-03',list:['ひな祭りの思い出は？','好きな和菓子は？','春になったらしたいことは？']},
  {name:'🌸 春のお題',from:'03-20',to:'04-15',list:['お花見に行く予定ある？','春といえば何を思い出す？','新生活で始めたいことは？','好きな春の食べ物は？','卒業・入学の思い出は？','春に聴きたい曲は？']},
  {name:'🎏 ゴールデンウィークのお題',from:'04-27',to:'05-06',list:['GWの予定は？','GWに行きたい場所は？','連休の過ごし方は家派？おでかけ派？','GWの思い出は？']},
  {name:'☔ 梅雨のお題',from:'06-05',to:'07-05',list:['雨の日の過ごし方は？','お気に入りの傘ある？','雨の日に聴きたい曲は？','じめじめ対策は何してる？','あじさい見に行った？']},
  {name:'🎋 七夕のお題',from:'07-06',to:'07-07',list:['短冊に書くなら何をお願いする？','星を見るのは好き？','七夕の思い出は？']},
  {name:'🏮 お盆のお題',from:'08-12',to:'08-16',list:['お盆はどう過ごしてる？','帰省する？','夏祭りに行った？','お盆の思い出は？']},
  {name:'🌻 夏休みのお題',from:'07-20',to:'08-31',list:['夏休みの予定は？','好きなアイスは？','夏といえば何を思い出す？','花火を見に行った？','暑さ対策は何してる？','夏に聴きたい曲は？','海派？山派？','夏休みの宿題の思い出は？','好きなかき氷の味は？','夏バテしてない？']},
  {name:'🎑 お月見のお題',from:'09-10',to:'09-20',list:['月を見るのは好き？','好きなお団子は？','秋の夜の過ごし方は？']},
  {name:'🎃 ハロウィンのお題',from:'10-25',to:'10-31',list:['仮装するなら何になりたい？','好きなかぼちゃ料理は？','怖い話は好き？','ハロウィンの思い出は？']},
  {name:'🍁 秋のお題',from:'09-21',to:'11-20',list:['食欲の秋、何がおいしい？','読書の秋、おすすめの本は？','紅葉を見に行った？','好きな秋の味覚は？','秋にやりたいことは？','スポーツの秋、体動かしてる？','新米食べた？']},
  {name:'🎄 クリスマスのお題',from:'12-18',to:'12-25',list:['クリスマスの予定は？','欲しいクリスマスプレゼントは？','好きなクリスマスソングは？','クリスマスの思い出は？','ケーキはショート派？チョコ派？','サンタさんを何歳まで信じてた？']},
  {name:'🎍 年末のお題',from:'12-26',to:'12-31',list:['今年いちばんの思い出は？','今年買ってよかったものは？','今年がんばったことは？','大掃除した？','年越しそばは食べる？','来年やりたいことは？']},
  {name:'⛄ 冬のお題',from:'01-08',to:'02-28',list:['寒さ対策は何してる？','好きな鍋料理は？','雪は好き？','冬の楽しみは？','温泉に行きたい？','こたつ派？ストーブ派？','冬に聴きたい曲は？']},
 ];
 const today=new Date(Date.now()+9*3600*1000);const start=Date.UTC(today.getUTCFullYear(),0,0);
 const mmdd=String(today.getUTCMonth()+1).padStart(2,'0')+'-'+String(today.getUTCDate()).padStart(2,'0');
 const season=seasons.find(x=>mmdd>=x.from&&mmdd<=x.to);
 // 季節の期間中は、季節のお題と普段のお題を合わせて出す（季節のお題が先）
 const pool=season?[...season.list,...topics]:topics;
 const dayNo=Math.floor((today.getTime()-start)/86400000);
 let idx=season?dayNo%season.list.length:dayNo%topics.length;
 const text=document.getElementById('km-topic-text');if(!text)return;
 const label=document.querySelector('#km-topic-use .small');
 const render=()=>{text.textContent=pool[idx];if(label)label.textContent=(season&&idx<season.list.length?season.name:'💡 今日のお題')+'（タップで使う）'};render();
 document.getElementById('km-topic-next').onclick=()=>{idx=(idx+1)%pool.length;render()};
 document.getElementById('km-topic-use').onclick=()=>{
  const ta=document.getElementById('timeline-body');const head='【お題】'+pool[idx]+'\n';
  if(!ta.value.startsWith('【お題】'))ta.value=head+ta.value;else ta.value=head+ta.value.replace(/^【お題】[^\n]*\n?/,'');
  ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length);
 };
})();

/* チャットのスタンプ反応 */
const KM_CHAT_EMOJIS=['👍','😂','❤️','😮','😢','🙏'];
async function kmFetchChatReactions(ids){
 const map=new Map();
 if(!ids.length){if(window.kmChatReactionsReady===undefined){const {error}=await client.from('kimetomo_chat_reactions').select('message_id').limit(1);window.kmChatReactionsReady=!error}return map}
 const {data,error}=await client.from('kimetomo_chat_reactions').select('message_id,user_id,emoji').in('message_id',ids);
 window.kmChatReactionsReady=!error;
 if(error)return map;
 (data||[]).forEach(r=>{const k=String(r.message_id);if(!map.has(k))map.set(k,[]);map.get(k).push(r)});
 return map;
}
function kmAppendChatReactions(bubble,item,map){
 if(window.kmChatReactionsReady===false)return;
 const list=map.get(String(item.id))||[];
 const row=document.createElement('div');row.className='km-chat-reacts';
 const toggle=async(emoji)=>{
  const mine=list.some(r=>r.user_id===current.id&&r.emoji===emoji);
  const res=mine
   ?await client.from('kimetomo_chat_reactions').delete().eq('message_id',item.id).eq('user_id',current.id).eq('emoji',emoji)
   :await client.from('kimetomo_chat_reactions').insert({message_id:item.id,user_id:current.id,emoji});
  if(res.error){note('スタンプを付けられません: '+safeError(res.error),'error');return}
  await loadChat();
 };
 for(const emoji of KM_CHAT_EMOJIS){
  const who=list.filter(r=>r.emoji===emoji);if(!who.length)continue;
  const b=document.createElement('button');b.type='button';b.className='km-chat-react'+(who.some(r=>r.user_id===current.id)?' mine':'');
  b.textContent=emoji+' '+who.length;b.onclick=()=>toggle(emoji);row.append(b);
 }
 const add=document.createElement('button');add.type='button';add.className='km-chat-react add';add.textContent='☺︎＋';add.setAttribute('aria-label','スタンプを付ける');
 const picker=document.createElement('div');picker.className='km-chat-picker hide';
 for(const emoji of KM_CHAT_EMOJIS){const p=document.createElement('button');p.type='button';p.textContent=emoji;p.onclick=()=>{picker.classList.add('hide');toggle(emoji)};picker.append(p)}
 add.onclick=()=>picker.classList.toggle('hide');
 row.append(add);bubble.append(row,picker);
}

/* チャットの新着バッジ（自分以外の新しいメッセージの数） */
(function(){
 const key=()=>current?'km-chat-seen-'+current.id:null;
 const getSeen=()=>{try{return localStorage.getItem(key())}catch{return null}};
 const setSeen=v=>{try{localStorage.setItem(key(),v)}catch{}};
 const btn=document.querySelector('.km-bottom-nav [data-km-go="chat"]');
 if(!btn)return;
 const badge=document.createElement('span');badge.className='km-nav-badge hide';btn.append(badge);
 function show(n){badge.textContent=n>99?'99+':String(n);badge.classList.toggle('hide',!n)}
 window.kmChatMarkSeen=function(items){
  if(!current||window.kmActiveTab!=='chat'||document.hidden)return;
  const newest=(items||[]).reduce((m,p)=>p.created_at>m?p.created_at:m,getSeen()||'');
  setSeen(newest||new Date().toISOString());show(0);
  // チャットを見たら、チャットの通知を既読にする（次の新着でまた1回だけ通知される）
  client.from('kimetomo_bell_notifications').update({read_at:new Date().toISOString()}).eq('recipient_id',current.id).eq('kind','chat').is('read_at',null).then(r=>{if(!r.error)window.kmCheckUnread?.()});
 };
 async function check(){
  if(typeof client==='undefined'||!client||!current||!document.body.classList.contains('km-nav-ready'))return;
  let seen=getSeen();
  if(!seen){seen=new Date().toISOString();setSeen(seen)}
  if(window.kmActiveTab==='chat'&&!document.hidden){show(0);return}
  const {data:rooms,error:re}=await client.from('circle_room_members').select('room_id').eq('user_id',current.id);
  if(re||!rooms?.length||!current){show(0);return}
  const {count,error}=await client.from('circle_messages').select('id',{count:'exact',head:true}).in('room_id',rooms.map(r=>r.room_id)).gt('created_at',seen).neq('sender_id',current.id);
  if(!error)show(count||0);
  // 新着があるルームを覚えておく（チャットタブを押したときにそのルームを開く）
  if(!error&&count&&current){
   const {data:latest}=await client.from('circle_messages').select('room_id').in('room_id',rooms.map(r=>r.room_id)).gt('created_at',seen).neq('sender_id',current.id).order('created_at',{ascending:false}).limit(1);
   if(latest?.[0])window.kmChatTargetRoom=String(latest[0].room_id);
  }
 }
 // 新着があるルームへ切り替える
 window.kmOpenChatRoom=function(){
  const room=window.kmChatTargetRoom;if(!room)return false;
  const sel=document.getElementById('chat-room');
  if(!sel||![...sel.options].some(o=>o.value===room)){return false}
  window.kmChatTargetRoom=null;
  if(sel.value!==room){sel.value=room;sel.onchange?.();return true}
  return false;
 };
 btn.addEventListener('click',()=>{show(0);setTimeout(()=>{if(!window.kmOpenChatRoom())window.loadChat?.()},0)});
 document.querySelectorAll('.km-bottom-nav [data-km-go]').forEach(b=>b.addEventListener('click',()=>setTimeout(check,300)));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
 setInterval(()=>{if(!document.hidden)check()},60000);
 setTimeout(check,3000);
})();
