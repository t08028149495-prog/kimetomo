/* 🟢 管理者のログイン中の印（管理者だけの特権）
   - 管理者の写真の右上にだけ、ログイン中は緑の点滅する丸、いないときは黒い丸を出す。メンバー全員から見える。
     ほかのメンバーの写真には丸を付けない。
   - 管理者だけ：アプリを画面に出している間、2 分ごとに「今いるよ」を記録する（supabase/presence.sql）。
     画面を隠した・閉じた・ログアウトしたときは「離れた」を記録する（届かないときは 4 分で自動的に黒になる）。
   - 丸を出す候補は data-km-presence="ユーザーID" の付いた写真（投稿・チャット・プロフィール・個人チャット）。
     "me" は自分の写真（上の自分の写真・自分のプロフィール画面）。
     そのうち管理者の写真にだけ丸を付ける。管理者の状態は 1 分ごとに読み直す（写真が画面にあるときだけ）。
   - index.html と dm.html の両方で読み込む（dm.html は window.kmDb・window.kmMe を使う） */
(()=>{
 const PING_MS=120000,STALE_MS=60000;
 let lastPing=0;
 const api=()=>window.client||window.kmDb,myId=()=>window.current?.id||window.kmMe?.id;
 const visible=()=>document.visibilityState==='visible';
 async function ping(away){
  const c=api();if(!c||!myId()||!window.kmIsAdmin)return;
  if(!away&&Date.now()-lastPing<45000)return;
  lastPing=away?0:Date.now();
  try{await c.rpc('kimetomo_presence_ping',{p_away:!!away});if(!away){at=0;soon()}}catch(e){}
 }
 setInterval(()=>{if(visible()&&Date.now()-lastPing>=PING_MS)ping(false)},20000);
 document.addEventListener('visibilitychange',()=>{if(visible())ping(false);else ping(true)});
 window.addEventListener('pagehide',()=>ping(true));
 window.kmPresence={ping:()=>ping(false),away:()=>ping(true)};

 // ---- 管理者の丸（だれでも見える） ----
 let admins=new Map(),at=0,busy=false;
 function paint(){
  const ok=!!myId();
  for(const el of document.querySelectorAll('[data-km-presence]')){
   let dot=el.querySelector(':scope > .km-presence-dot');
   const id=el.dataset.kmPresence==='me'?myId():el.dataset.kmPresence;
   const on=ok?admins.get(id):undefined;
   if(on===undefined){dot?.remove();continue}
   const cls='km-presence-dot '+(on?'on':'off');
   const tip=on?'管理者はログイン中です':'管理者は今はいません';
   if(!dot){dot=document.createElement('span');dot.setAttribute('role','img');el.append(dot)}
   if(dot.className!==cls)dot.className=cls;
   if(dot.title!==tip){dot.title=tip;dot.setAttribute('aria-label',tip)}
  }
 }
 async function refresh(force){
  const c=api();
  if(!c||!myId()||!document.querySelector('[data-km-presence]')){paint();return}
  if(busy||(!force&&Date.now()-at<STALE_MS)){paint();return}
  busy=true;
  try{
   const {data,error}=await c.rpc('kimetomo_admin_online');
   if(!error){admins=new Map((data||[]).map(r=>[r.user_id,!!r.online]));at=Date.now()}
  }catch(e){}finally{busy=false}
  paint();
 }
 let t=null;const soon=()=>{clearTimeout(t);t=setTimeout(()=>refresh(false),400)};
 new MutationObserver(soon).observe(document.body,{childList:true,subtree:true});
 setInterval(()=>{if(visible())refresh(true)},60000);
 document.addEventListener('visibilitychange',()=>{if(visible())refresh(true)});
})();
