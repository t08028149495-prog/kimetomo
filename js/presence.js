/* 🟢 ログイン中の印（管理者だけに見える）
   - だれでも：アプリを画面に出している間、2 分ごとに「今いるよ」を記録する（supabase/presence.sql）。
     画面を隠した・閉じた・ログアウトしたときは「離れた」を記録する（届かないときは 4 分で自動的に離れた扱い）。
   - 管理者だけ：プロフィール写真の右上に、ログイン中は緑の点滅する丸、そうでなければ黒い丸を出す。
     丸を出す場所は data-km-presence="ユーザーID" の付いた写真（投稿・チャット・プロフィール・個人チャット）。1 分ごとに読み直す。
   - index.html と dm.html の両方で読み込む（dm.html は window.kmDb・window.kmMe を使う） */
(()=>{
 const PING_MS=120000,STALE_MS=60000;
 let lastPing=0;
 const api=()=>window.client||window.kmDb,myId=()=>window.current?.id||window.kmMe?.id;
 const visible=()=>document.visibilityState==='visible';
 async function ping(away){
  const c=api();if(!c||!myId())return;
  if(!away&&Date.now()-lastPing<45000)return;
  lastPing=away?0:Date.now();
  try{await c.rpc('kimetomo_presence_ping',{p_away:!!away})}catch(e){}
 }
 setInterval(()=>{if(visible()&&Date.now()-lastPing>=PING_MS)ping(false)},20000);
 document.addEventListener('visibilitychange',()=>{if(visible())ping(false);else ping(true)});
 window.addEventListener('pagehide',()=>ping(true));
 window.kmPresence={ping:()=>ping(false),away:()=>ping(true)};

 // ---- ここから管理者だけ ----
 const st=new Map();let busy=false,again=false;
 const ago=v=>{const m=Math.floor((Date.now()-new Date(v).getTime())/60000);if(m<1)return 'たった今';if(m<60)return m+'分前';const h=Math.floor(m/60);if(h<24)return h+'時間前';return Math.floor(h/24)+'日前'};
 function paint(){
  const admin=!!window.kmIsAdmin;
  for(const el of document.querySelectorAll('[data-km-presence]')){
   let dot=el.querySelector(':scope > .km-presence-dot');
   const s=admin?st.get(el.dataset.kmPresence):null;
   if(!s){dot?.remove();continue}
   const cls='km-presence-dot '+(s.on?'on':'off');
   const tip=s.on?'ログイン中（今アプリを開いています）':s.seen?'接続なし（最後に開いたのは'+ago(s.seen)+'）':'接続なし（まだ記録がありません）';
   if(!dot){dot=document.createElement('span');dot.setAttribute('role','img');el.append(dot)}
   if(dot.className!==cls)dot.className=cls;
   if(dot.title!==tip){dot.title=tip;dot.setAttribute('aria-label',tip)}
  }
 }
 async function refresh(force){
  if(!window.kmIsAdmin||!api()){paint();return}
  if(busy){again=true;return}busy=true;
  try{
   const now=Date.now();
   const ids=[...new Set([...document.querySelectorAll('[data-km-presence]')].map(e=>e.dataset.kmPresence).filter(Boolean))]
    .filter(u=>force||!(st.get(u)?.at>now-STALE_MS));
   for(let i=0;i<ids.length;i+=200){
    const part=ids.slice(i,i+200);
    const {data,error}=await api().rpc('kimetomo_admin_presence',{p_ids:part});
    if(error)break;
    const got=new Map((data||[]).map(r=>[r.user_id,r]));
    for(const u of part){const r=got.get(u);st.set(u,{on:!!r?.online,seen:r?.seen_at||null,at:now})}
   }
   paint();
  }finally{busy=false;if(again){again=false;setTimeout(()=>refresh(false),0)}}
 }
 let t=null;const soon=()=>{clearTimeout(t);t=setTimeout(()=>refresh(false),400)};
 new MutationObserver(soon).observe(document.body,{childList:true,subtree:true});
 setInterval(()=>{if(visible()&&window.kmIsAdmin)refresh(true)},60000);
 document.addEventListener('visibilitychange',()=>{if(visible()&&window.kmIsAdmin)refresh(true)});
})();
