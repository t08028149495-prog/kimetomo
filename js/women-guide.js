/* 🌷 女性のための安心ガイド（プロフィールタブに固定で出す）
   ・保存した性別が♀か、性別を選んでいない人に出す（♂の人には出さない。性別を隠していても出る）。閉じるボタンはない
   ・男性からのDM対策など、今ある安心の機能を一覧にして、今の設定の状態も出す
   ・「設定する」は下の「🛡 安心の設定」を開いて、その項目へ移動する
   ・女性だけの部屋：入れる条件を満たした人（申請の条件 か AIで確認する条件）には「部屋に入る」ボタンを出して、いちばん上に置く。
     メンバーには「部屋を開く」。状態は kimetomo_women_room_status（1分覚える）と kimetomo_wroom_ai_status（申請の条件がまだの人だけ聞く） */
(function(){
 const $=id=>document.getElementById(id);
 const box=$('km-women-guide');if(!box)return;
 const pol=$('km-dm-policy'),hid=$('km-gender-hidden'),safety=$('km-safety-box');
 let female=false,gender='',wr=null,wrAt=0;
 const mk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
 const openSafety=el=>{if(safety)safety.open=true;el?.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>el?.focus?.(),400)};
 function item(icon,title,text,state,go){
  const li=mk('li','km-wg-item');
  li.append(mk('span','km-wg-icon',icon));
  const body=mk('div','km-wg-body');
  const head=mk('div','km-wg-head');head.append(mk('strong','',title));
  if(state)head.append(mk('span','km-wg-state'+(state.on?' on':''),state.text));
  body.append(head,mk('p','small',text));
  if(go){const b=mk('button',(go.main?'':'ghost ')+'km-wg-go'+(go.main?' km-wg-main':''),go.label);b.type='button';b.onclick=go.fn;body.append(b)}
  li.append(body);return li;
 }
 // 女性だけの部屋の状態：member（参加中）・pending（申請中）・open（入れる）・null（まだ入れない／♀でない）
 async function loadRoom(){
  if(gender!=='female'||typeof client==='undefined'||!client||typeof current==='undefined'||!current){wr=null;return}
  if(Date.now()-wrAt<60000)return;wrAt=Date.now();
  try{
   const s=window.kmWroomStatus?await window.kmWroomStatus():(await client.rpc('kimetomo_women_room_status')).data;
   if(!s||!s.female){wr=null}
   else if(s.member)wr={kind:'member',room:String(s.room_id||'')};
   else if(s.request==='pending')wr={kind:'pending'};
   else if(s.request==='rejected')wr=null;
   else if(s.days_left===0&&s.acts>=s.acts_need&&s.gender_days_left===0)wr={kind:'open'};
   else{const {data:a}=await client.rpc('kimetomo_wroom_ai_status');const ng=['ever_male','not_female','rejected','member','login','no_room','used_up','days','acts','gender_days','today','errors'];wr=a&&a.state&&!ng.includes(a.state)?{kind:'open'}:null}
  }catch{wr=null}
 }
 // グループタブへ移る（メンバーなら、その部屋を選んでから）
 function goRoom(){
  if(wr?.kind==='member'&&wr.room){
   window.kmChatTargetRoom=wr.room;
   const sel=$('chat-room');if(sel&&[...sel.options].some(o=>o.value===wr.room)&&sel.value!==wr.room){sel.value=wr.room;sel.dispatchEvent(new Event('change'))}
  }
  document.querySelector('.km-bottom-nav [data-km-go="chat"]')?.click();
 }
 function roomItem(){
  const k=wr?.kind;
  const text=k==='member'?'確認された女性だけのグループチャットに参加しています。女性同士で気軽におしゃべりしてね。'
   :k==='pending'?'参加の申請を受け付けました。管理者の確認をお待ちください。結果はベルでお知らせします。'
   :k==='open'?'あなたは参加できる条件を満たしています！確認された女性だけのグループチャットで、女性同士で安心しておしゃべりできます。下のボタンから申請するか、AIでその場の写真を確認してすぐ入れます（写真はキメ友に保存されません）。'
   :'確認された女性だけが入れるグループチャットです。「グループ」タブから申請できます（AIでその場の写真を確認してすぐ入る方法もあります）。写真はキメ友に保存されません。';
  const state=k==='member'?{on:true,text:'参加中'}:k==='pending'?{on:false,text:'申請中'}:k==='open'?{on:true,text:'入れます'}:null;
  const go=k==='member'?{label:'🌷 部屋を開く',fn:goRoom,main:true}:k==='pending'?{label:'申請の様子を見る',fn:goRoom}:k==='open'?{label:'🌷 女性だけの部屋に入る',fn:goRoom,main:true}:null;
  const li=item('🌷','女性だけの部屋',text,state,go);if(k==='open'||k==='member')li.classList.add('km-wg-pick');return li;
 }
 function paint(){
  box.classList.toggle('hide',!female);if(!female)return;
  const known=pol?.value==='known',hidden=!!hid?.checked,ready=pol&&!pol.disabled;
  const list=mk('ul','km-wg-list');
  list.append(
   item('💌','知らない人からのDMを止める','「自分から送った相手からだけ」にすると、知らない男性などから急に個人チャットが届かなくなります。話したい相手には、自分から一度送れば返事が届きます。',ready?{on:known,text:known?'オン':'オフ'}:null,{label:'設定する',fn:()=>openSafety(pol)}),
   item('🙈','性別（♀）を名前の横に出さない','投稿やチャットで♀の印を出さないようにできます。女性だと知られたくないときに。',ready?{on:hidden,text:hidden?'オン':'オフ'}:null,{label:'設定する',fn:()=>openSafety(hid)}),
   item('🚫','ブロック・🔇ミュート・🚩通報','相手のアイコンを押すと出るプロフィールからできます。ブロックすると、その人の投稿・コメント・チャットが見えなくなり、通知も届きません。どれも相手には知らされません。',null,{label:'ブロックした人を見る',fn:()=>{location.href='./blocked.html'}}),
   item('🔒','女性だけに見せる投稿・匿名の相談','部屋のメンバーになると、投稿欄に「🌷 女性だけ」「🙈 匿名で相談」が出ます。男性には見えず、匿名の相談は誰が書いたか管理者にしか分かりません。',null,null),
   item('🔕','コメントなし・24時間で消える投稿','投稿欄の「🔕 コメントなし」「⏳ 24時間で消す」で、知らない人からのコメントを受け付けない・あとに残さない投稿ができます。',null,null)
  );
  // 女性だけの部屋：入れる人・参加中の人には、いちばん上に出して目立たせる。ほかの人は4番目
  const room=roomItem();if(wr?.kind==='open'||wr?.kind==='member')list.prepend(room);else list.insertBefore(room,list.children[3]||null);
  box.replaceChildren(mk('h3','km-wg-title','🌷 女性に便利な機能紹介'),mk('p','small km-wg-lead','気になることがあれば、ひとりで抱えずに通報や管理者への連絡をしてください。'),list);
 }
 // loadMyProfile（js/app.js）から、保存されている性別を渡してもらう
 window.kmWomenGuide=g=>{female=g!=='male';if(g!==gender){gender=g||'';wrAt=0}paint();loadRoom().then(()=>{if(female)paint()})};
 // プロフィールタブを開くたびに、部屋の状態を見直す（1分に1回まで）
 document.querySelectorAll('.km-bottom-nav [data-km-go="profile"]').forEach(x=>x.addEventListener('click',()=>{if(female)loadRoom().then(()=>{if(female)paint()})}));
 // 安心の設定を読み込んだ・保存した（失敗して戻した）ときは、下の状態の文字が変わるので、そのたびに描き直す
 const st=$('km-safety-state');
 if(st)new MutationObserver(()=>{if(female)paint()}).observe(st,{childList:true,characterData:true,subtree:true});
})();
