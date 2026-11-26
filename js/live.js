/* リアルタイム更新：新しい投稿の案内と、通知ベルの数をすぐ更新する（iPhone・Android・パソコン共通）
   無料プランに余裕を残すための決まり：
   - 接続は 1 人 1 本だけ。画面を 2 分以上隠したら切り、戻ったらつなぎ直す（管理者だけ 10 分。1 人分なので負担は小さい）
   - 管理者だけ：通報などの知らせが届いたら、管理者メニューの「対応が必要なこと」をすぐ数え直す
   - 新しい投稿が来ても自動で全部は読み直さず、「新しい投稿」ボタンを出すだけ（押した人だけ読み直す）
     ※ 管理者・マネージャー（js/manager.js）だけは、タイムラインを見ていれば自動で表示する（下の autoShow）
   - ベルは数を数え直すだけ（続けて来ても 2 秒に 1 回にまとめる）。既読になったとき（ほかの端末で読んだときも）も数え直す
   - つながっている間は、ベルの定期確認を 90 秒ごと → 3 分ごとに減らす（app.js の kmStartNotifications）
   - 切れてつながり直したときも、ベルを数え直す（切れていた間の既読を取りこぼさない）
   - 下のタブの赤い数字（タイムライン・グループ・管理の「気になる投稿」）の「どこまで見たか」を、同じアカウントの端末どうしでそろえる
     （2026-11-27。今までは端末ごとにしか覚えておらず、PC で見ても iPhone では未読のままだった。supabase/seen_marks.sql）
     ・見た端末：kmSeenPush で Supabase の 1 人 1 行の表に覚える（続けて見ても 1.5 秒に 1 回にまとめる）
     ・ほかの端末：同じ接続で知らせを受けて（追加の接続なし）、進んでいたら端末の印を進め、km-seen-sync で数え直してもらう
     ・つないだとき・5 秒以上隠れて戻ったときにも 1 回読む（切れていた間の分をそろえる。1 行だけなので通信は少しだけ） */
(()=>{
 let ch=null,uid=null,hideTimer=null,bellTimer=null,hiddenAt=0;const fresh=new Set();
 window.kmLiveOk=false;

 // ── 「どこまで見たか」を端末どうしでそろえる ──
 // 端末に覚える場所（localStorage）は今までと同じ。Supabase のほうが進んでいたら、端末の印を進める（戻すことはない）
 const SEEN={
  tl:{col:'tl_seen_at',arg:'p_tl',key:()=>'km-tl-seen-'+current.id},
  chat:{col:'chat_seen_at',arg:'p_chat',key:()=>'km-chat-seen-'+current.id},
  flag:{col:'flag_seen_id',arg:'p_flag',key:()=>'km-flag-seen'}
 };
 const seenNum=(k,v)=>k==='flag'?Number(v)||0:Date.parse(v)||0;
 let seenTimer=null,seenWait={},seenPullAt=0;
 function seenAdopt(row,owner){
  if(!row||!current||(owner||row.user_id||current.id)!==current.id)return;
  const changed=[];
  for(const k in SEEN){
   const v=row[SEEN[k].col];if(v==null)continue;
   let cur=null;try{cur=localStorage.getItem(SEEN[k].key())}catch{}
   if(seenNum(k,v)>seenNum(k,cur)){try{localStorage.setItem(SEEN[k].key(),String(v))}catch{}changed.push(k)}
  }
  if(changed.length)window.dispatchEvent(new CustomEvent('km-seen-sync',{detail:changed}));
 }
 async function seenPull(){
  if(!client||!current||Date.now()-seenPullAt<3000)return;
  seenPullAt=Date.now();const id=current.id;
  const {data,error}=await client.from('kimetomo_seen_marks').select('tl_seen_at,chat_seen_at,flag_seen_id').eq('user_id',id).limit(1);
  if(!error&&data?.[0])seenAdopt(data[0],id);
 }
 // k：'tl'（タイムライン）・'chat'（グループ）・'flag'（気になる投稿）。v：ここまで見た（時刻または番号）
 window.kmSeenPush=(k,v)=>{
  if(!SEEN[k]||v==null||v===''||!current)return;
  seenWait[SEEN[k].arg]=v;const id=current.id;
  clearTimeout(seenTimer);seenTimer=setTimeout(async()=>{
   const args=seenWait;seenWait={};
   if(!client||!current||current.id!==id)return;
   const {data,error}=await client.rpc('kimetomo_mark_seen',args);
   if(!error)seenAdopt(Array.isArray(data)?data[0]:data,id);
  },1500);
 };

 function pill(){
  let b=document.getElementById('km-live-new');
  const n=fresh.size;if(!n){b?.remove();return}
  if(!b){
   b=document.createElement('button');b.type='button';b.id='km-live-new';b.className='km-live-new';
   b.onclick=async()=>{fresh.clear();pill();await loadTimeline();document.getElementById('timeline')?.scrollIntoView({behavior:'smooth',block:'start'})};
   document.getElementById('timeline-feed')?.before(b);
  }
  b.textContent='⬆ 新しい投稿が '+(n>9?'10 件以上':n+' 件')+'あります（タップで表示）';
 }
 // タイムラインを読み直したら案内は消す
 window.kmLiveClearNew=()=>{fresh.clear();pill()};

 function onPost(p){
  const r=p?.new;if(!r||!current||r.author_id===current.id||window.kmIsBlocked?.(r.author_id)||window.kmIsMuted?.(r.author_id))return;
  // 新着の数（下のタブの赤い数字）を端末で数えるために知らせる（js/poll.js）
  window.dispatchEvent(new CustomEvent('km-live-post',{detail:r}));
  if(document.getElementById('km-post-'+r.id))return;
  fresh.add(String(r.id));pill();autoShow();
 }

 // 👑 管理者・マネージャーだけ：新しい投稿を、ボタンを押さなくても自動で表示する（2人分なので負担は小さい）
 // - タイムラインを見ているときだけ。コメントを書いている途中は消さないように、案内ボタンのままにする
 // - 続けて来たら 3 秒にまとめる。下の方を読んでいたら、見ていた投稿の位置がずれないようにする
 const isStaff=()=>!!current&&(!!window.kmIsAdmin||!!window.kmManagers?.has(current.id));
 let autoTimer=null;
 function typing(feed){
  const a=document.activeElement;
  if(a&&feed.contains(a)&&(/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)||a.isContentEditable))return true;
  return [...feed.querySelectorAll('textarea,input[type="text"]')].some(e=>e.value.trim());
 }
 function autoShow(){
  if(!isStaff())return;
  clearTimeout(autoTimer);
  autoTimer=setTimeout(async()=>{
   const feed=document.getElementById('timeline-feed');
   if(!fresh.size||!feed||!isStaff()||document.hidden||window.kmActiveTab!=='timeline'||typing(feed))return;
   let anchor=null,top=0;
   if(window.scrollY>80)for(const el of feed.querySelectorAll('.timeline-post')){const r=el.getBoundingClientRect();if(r.bottom>0){anchor=el.id;top=r.top;break}}
   await loadTimeline();
   const el=anchor&&document.getElementById(anchor);
   if(el)window.scrollBy(0,el.getBoundingClientRect().top-top);
  },3000);
 }
 // ほかのタブからタイムラインに戻ったときも、たまっていた新しい投稿を出す
 document.addEventListener('click',e=>{if(e.target.closest?.('[data-km-go="timeline"]'))setTimeout(autoShow,0)});
 let todoTimer=null;
 function onBell(p){
  const k=p?.new?.kind||'';
  if(k==='chat')return;
  // 既読になった（ほかの端末で読んだ・この端末で読んだ）ときも数え直す。この端末で読んだ直後の黄色い枠（3秒）を消さないよう少し待つ
  const upd=p?.eventType==='UPDATE';
  clearTimeout(bellTimer);bellTimer=setTimeout(()=>window.kmCheckUnread?.(),upd?4000:2000);
  if(upd)return;
  // 管理者だけ：通報・不具合報告などが届いたら、「対応が必要なこと」をすぐ数え直す
  if(window.kmIsAdmin&&(k==='admin_notice'||k.startsWith('request'))){clearTimeout(todoTimer);todoTimer=setTimeout(()=>window.kmLoadAdminTodo?.(),1500)}
 }

 function connect(){
  if(ch||!client||!current)return;
  uid=current.id;
  const c=client.channel('kimetomo-live-'+uid+'-'+Date.now());
  c.on('postgres_changes',{event:'INSERT',schema:'public',table:'kimetomo_timeline_posts'},onPost)
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'kimetomo_bell_notifications',filter:'recipient_id=eq.'+uid},onBell)
   // PC とスマホなど、同じアカウントのほかの端末で既読にしたら、こちらのベルの数もすぐそろえる
   .on('postgres_changes',{event:'UPDATE',schema:'public',table:'kimetomo_bell_notifications',filter:'recipient_id=eq.'+uid},onBell)
   // ほかの端末でタイムライン・グループなどを見たら、こちらの下のタブの赤い数字もそろえる
   .on('postgres_changes',{event:'*',schema:'public',table:'kimetomo_seen_marks',filter:'user_id=eq.'+uid},p=>seenAdopt(p?.new));
  ch=c;
  // 切れてからつながり直したときは、切れていた間に来た知らせ（ほかの端末で既読にした・新しく届いた）を取りこぼすので、ベルを数え直す
  // （iPhone は裏から戻った直後、古い接続がしばらく「つながっている」ふりをしてから、つながり直すことがある）
  let joined=false;
  c.subscribe(s=>{if(ch!==c)return;window.kmLiveOk=s==='SUBSCRIBED';if(!window.kmLiveOk)return;window.kmLiveSince=Date.now();seenPull();if(joined){clearTimeout(bellTimer);bellTimer=setTimeout(()=>window.kmCheckUnread?.(),1000)}joined=true});
 }
 async function disconnect(){
  const c=ch;ch=null;window.kmLiveOk=false;
  if(c)await client.removeChannel(c).catch(()=>{});
 }
 // 裏に回っていた間に来た投稿を確かめる（スマホは裏で通信が止まるため。番号だけ読むので通信は少しだけ）
 async function catchUp(since){
  if(!current)return;
  const {data,error}=await client.from('kimetomo_timeline_posts').select('id,author_id').gt('created_at',new Date(since).toISOString()).neq('author_id',current.id).limit(11);
  if(error)return;
  for(const r of data||[])if(!window.kmIsBlocked?.(r.author_id)&&!window.kmIsMuted?.(r.author_id)&&!document.getElementById('km-post-'+r.id))fresh.add(String(r.id));
  pill();autoShow();
 }

 window.kmLiveStart=()=>{
  if(!current)return;
  if(uid&&uid!==current.id){disconnect();fresh.clear();pill()}
  uid=current.id;// 裏で開かれたときも、表に出たらつながるように先に覚えておく
  if(!document.hidden)connect();
 };
 window.kmLiveStop=()=>{clearTimeout(hideTimer);clearTimeout(seenTimer);seenWait={};seenPullAt=0;disconnect();uid=null;fresh.clear();pill()};

 document.addEventListener('visibilitychange',()=>{
  clearTimeout(hideTimer);
  if(document.hidden){hiddenAt=Date.now();hideTimer=setTimeout(disconnect,window.kmIsAdmin?600000:120000);return}
  if(!uid||!current)return;
  connect();
  // 5 秒以上隠れていたら、ベルの数を数え直す（隠れている間に、ほかの端末で読んだ・新しく届いた分をそろえる）
  if(hiddenAt&&Date.now()-hiddenAt>5000){window.kmCheckUnread?.();seenPull()}
  // 30 秒以上隠れていたら、その間の投稿を確かめる
  if(hiddenAt&&Date.now()-hiddenAt>30000){catchUp(hiddenAt-5000);if(window.kmIsAdmin)window.kmLoadAdminTodo?.()}
  hiddenAt=0;
 });
})();
