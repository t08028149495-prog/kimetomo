
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
 // 🕯 アングラのお題（2026-11-26〜。true のあいだは、AI・季節・ふだんのお題を出さず、これだけを出す。元に戻すときは false にする）
 const UNDERGROUND=true;
 const undergroundTopics=['信じてる都市伝説ある？','実際にあったちょっと怖い体験','説明できない不思議なこと、起きたことある？','行ってみたい廃墟・心霊スポット（見るだけ）','好きな怪談・怖い話は？','昔ハマってた、今は消えたサイトやアプリ','2ch・個人サイト・前略プロフ時代の思い出','人には言いにくい、ニッチな趣味を教えて','誰も知らないけど推してるバンド・作家は？','深夜にしか聴かない曲','眠れない夜、何してる？','深夜ラジオ・深夜番組の思い出','夜中に見るとハマる変な映画・B級映画','誰にも言ってない小さな秘密（言える範囲で）','世間では人気だけど、正直よさが分からないもの','好きなオカルト・UFO・UMAの話','見た中でいちばん意味が分からない夢','ゾッとしたネットの話・ネットロア','夜の街で見かけた不思議な光景','好きなマイナー映画・カルト映画','昔集めてた変なもの','行ってみたい路地裏・古い商店街','ハマったことがある陰謀論っぽい話（ネタとして）','誰にも共感されない「これが好き」','深夜のコンビニで起きたこと','自分だけのこだわり・儀式','いちばん怖かったゲーム・映画','名前を出せないけど好きなアングラ文化','もし裏の顔があるとしたら？','地元に伝わる怖い言い伝え・七不思議','学校の怪談、覚えてるのある？','金縛りにあったことある？','デジャヴ・正夢を見たことある？','ネットで見つけた不気味な画像・動画の思い出','好きな未解決ミステリー・謎の事件（ネタとして）','夜中に聞こえた正体不明の音','昔のチェーンメール・不幸の手紙の思い出','行ってみたい珍スポット・B級スポット','好きなホラー漫画・ホラー小説','古いゲームの裏技・都市伝説','夜の散歩で好きな場所','深夜に検索してしまったこと','捨てられない、ちょっと変なもの','おすすめの不気味でかわいいもの','好きな妖怪・UMAは？','心霊写真っぽいもの、撮れたことある？','ひとりカラオケで歌う、マイナーな曲','オカルト番組・心霊特番の思い出','もしタイムスリップできるなら、いつのネットに行きたい？','今日のひとこと（深夜テンションで）'];
 const today=new Date(Date.now()+9*3600*1000);const start=Date.UTC(today.getUTCFullYear(),0,0);
 const mmdd=String(today.getUTCMonth()+1).padStart(2,'0')+'-'+String(today.getUTCDate()).padStart(2,'0');
 const season=UNDERGROUND?null:seasons.find(x=>mmdd>=x.from&&mmdd<=x.to);
 // 季節の期間中は、季節のお題と普段のお題を合わせて出す（季節のお題が先）
 const base=UNDERGROUND?undergroundTopics:season?[...season.list,...topics]:topics;
 const dayNo=Math.floor((today.getTime()-start)/86400000);
 // その日の始まりの位置から並べ直す（日によって出だしが変わる）
 const s0=dayNo%(season?season.list.length:base.length);
 const daily=[...base.slice(s0),...base.slice(0,s0)];
 let pool=daily,ai=null;
 const day=today.toISOString().slice(0,10);
 // ページを開き直す（更新する）たびに次の話題へ。その日の1回目はいちばん最初（AIの話題）から
 const PK='km-topic-pos';let n=0;
 try{const p=JSON.parse(localStorage.getItem(PK)||'null');if(p&&p.d===day)n=(p.n|0)+1}catch{}
 const savePos=()=>{try{localStorage.setItem(PK,JSON.stringify({d:day,n}))}catch{}};savePos();
 let idx=n%pool.length;
 const text=document.getElementById('km-topic-text');if(!text)return;
 const label=document.querySelector('#km-topic-use .small');
 // AIのお題があるときは、それを先に出す（そのあと季節・普段のお題）
 const render=()=>{
  text.textContent=pool[idx];
  if(ai&&idx<ai.length){text.dataset.icon=ai[idx].e||'✨';if(label)label.textContent='✨ 今日の話題（タップで使う）';return}
  if(UNDERGROUND){text.dataset.icon='🕯';if(label)label.textContent='🕯 アングラのお題（タップで使う）';return}
  const s=season&&season.list.includes(pool[idx]);
  text.dataset.icon=s?season.name.split(' ')[0]:'💡';if(label)label.textContent=(s?season.name:'💡 今日のお題')+'（タップで使う）';
 };render();
 // 引っぱって更新（pull-refresh.js）でも次の話題へ
 window.kmTopicNext=()=>{n++;savePos();idx=n%pool.length;render()};
 // ✨ AIの今日のお題（supabase/functions/kimetomo-ai-topic）。1日分を端末に覚えて、1日1回だけ読む
 const ck='ai-topic2-'+day;
 const useAI=list=>{const l=(Array.isArray(list)?list:[]).filter(x=>x&&typeof x.t==='string'&&x.t).slice(0,3);if(!l.length)return;ai=l;pool=[...l.map(x=>x.t),...daily];idx=n%pool.length;render()};
 const cached=UNDERGROUND?null:window.kmDC?.get(ck,86400e3);
 if(UNDERGROUND){}
 else if(cached)useAI(cached);
 else{
  let waited=0,retried=false;
  const load=async()=>{
   // ログインが終わるまで待つ（3分まで）
   if(typeof client==='undefined'||!client||typeof current==='undefined'||!current){if(++waited<90)setTimeout(load,2000);return}
   let list=null;
   try{const r=await client.functions.invoke('kimetomo-ai-topic',{body:{}});if(r?.data?.day===day)list=r.data.topics}catch{}
   if(Array.isArray(list)&&list.length){window.kmDC?.set(ck,list);useAI(list)}
   // ほかの人のときに作っている途中なら、30秒後にもう1回だけ聞く
   else if(!retried){retried=true;setTimeout(load,30000)}
  };
  setTimeout(load,1500);
 }
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
  await loadChat({full:true});
  // 付けたときは、そのスタンプをぽんっと弾ませる（js/tap.js）
  if(!mine)window.kmPop?.([...document.querySelectorAll('#chat-feed .chat-message[data-km-msg="'+CSS.escape(String(item.id))+'"] .km-chat-react.mine')].find(b=>b.textContent.startsWith(emoji)));
 };
 for(const emoji of KM_CHAT_EMOJIS){
  const who=list.filter(r=>r.emoji===emoji);if(!who.length)continue;
  const b=document.createElement('button');b.type='button';b.className='km-chat-react'+(who.some(r=>r.user_id===current.id)?' mine':'');
  b.textContent=emoji+' '+who.length;b.onclick=()=>toggle(emoji);row.append(b);
 }
 const add=document.createElement('button');add.type='button';add.className='km-chat-react add';add.textContent='☺︎＋';add.setAttribute('aria-label','スタンプを付ける');
 const picker=document.createElement('div');picker.className='km-chat-picker hide';
 for(const emoji of KM_CHAT_EMOJIS){const p=document.createElement('button');p.type='button';p.textContent=emoji;p.onclick=()=>{picker.classList.add('hide');toggle(emoji)};picker.append(p)}
 // ↩️ このメッセージに返信する（js/chat-reply.js）
 if(window.kmChatStartReply){const r=document.createElement('button');r.type='button';r.className='km-chat-reply-btn';r.textContent='↩️ 返信';r.onclick=()=>{picker.classList.add('hide');window.kmChatStartReply(item,bubble.closest('.chat-message')?.dataset.kmName)};picker.append(r)}
 // 相手のメッセージは、ここから通報もできる（js/report.js）
 if(window.kmReportButton&&!window.kmIsAdmin&&item.sender_id!==current.id)picker.append(window.kmReportButton({kind:'chat',id:item.id,userId:item.sender_id,who:null}));
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
 // 入っているルームは、端末に10分覚えておく（毎回 Supabase に聞かない）
 let roomCache=null,roomAt=0,roomUid=null,lastAt=0,tick=0;
 async function myRooms(){
  if(roomCache&&roomUid===current.id&&Date.now()-roomAt<600000)return roomCache;
  const {data,error}=await client.from('circle_room_members').select('room_id').eq('user_id',current.id);
  if(error)return null;
  roomCache=(data||[]).map(r=>({room_id:r.room_id}));roomUid=current.id;roomAt=Date.now();return roomCache;
 }
 async function check(force){
  if(typeof client==='undefined'||!client||!current||!document.body.classList.contains('km-nav-ready'))return;
  let seen=getSeen();
  if(!seen){seen=new Date().toISOString();setSeen(seen)}
  if(window.kmActiveTab==='chat'&&!document.hidden){show(0);return}
  // タブを続けて押したときなどは、30秒以内なら数え直さない
  if(!force&&Date.now()-lastAt<30000)return;
  lastAt=Date.now();
  const rooms=await myRooms();
  if(!rooms?.length||!current){show(0);return}
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
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check(true)});
 // リアルタイムでつながっている間は2分ごと、つながっていないときは1分ごとに数える
 setInterval(()=>{if(document.hidden)return;if(window.kmLiveOk&&++tick%2)return;check(true)},60000);
 setTimeout(()=>check(true),3000);
 // iPhone は起動が遅く、3 秒後にはまだログイン中のことがある。下のタブが出たらすぐ数える
 window.addEventListener('km-nav-ready',()=>check(true));
 // iPhone で前の画面に戻ったとき（DM から戻るなど。画面がそのまま戻る）も数え直す
 window.addEventListener('pageshow',e=>{if(e.persisted)check(true)});
})();
