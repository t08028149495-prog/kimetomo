/* 👑 マネージャー：管理者の印と同じ形で、シルバーの王冠とシルバーの背景。名前の横に出す（見た目は glow.css の最後）。
   index.html と dm.html の両方で読む。人を増やす・減らすときは下の一覧の ID を書きかえる（ID は Supabase の kimetomo_user_profiles.user_id） */
(function(){
 window.kmManagers=new Set([
  'd4efaeb6-11db-4d4b-a2b0-c3c12c728640' // レモン汁
 ]);
 // アイコンの輪：管理者は金色（km-admin-ring）、マネージャーはシルバー（km-manager-ring）。見た目は css/insta.css
 window.kmRingClass=function(id,isAdmin){return isAdmin?' km-admin-ring':(id&&window.kmManagers.has(id)?' km-manager-ring':'')};
 window.kmManagerBadge=function(){
  const b=document.createElement('span');b.className='kimetomo-crown km-manager';
  const icon=document.createElement('span');icon.className='kimetomo-crown-icon';icon.textContent='👑';
  const label=document.createElement('span');label.className='kimetomo-crown-label';label.textContent='マネージャー';
  b.append(icon,label);b.title='キメ友SNS マネージャー';b.setAttribute('aria-label','マネージャー');
  return b;
 };

 // 💬 管理者・マネージャーの印をタップすると、印のすぐ下に説明の吹き出しを出す（index.html と dm.html の両方）。
 //    印は名前やアイコンのボタンの中にあるので、先に受け取ってプロフィールなどが開かないようにする
 const TIPS={
  admin:{t:'👑 管理者',d:'キメ友SNSを作って運営している人です。学生時代のあだ名は、IT業界の脆弱性と言われていました。2つのIT国家資格のみで新たに立ち向かおうとしてる戦犯。'},
  manager:{t:'👑 マネージャー',d:'管理者のお手伝いをしている人です。みんなが安心して楽しめるように、キメ友SNSを一緒に見守っています。盛り上げ役隊長'}
 };
 let tip=null;
 const close=()=>{if(tip){tip.remove();tip=null}};
 const css=document.createElement('style');
 css.textContent='.kimetomo-crown{cursor:pointer}'+
  '.km-crown-tip{position:fixed;z-index:10000;max-width:min(300px,calc(100vw - 24px));padding:12px 14px;border-radius:14px;'+
  'background:var(--ig-bg2,#26161f);color:var(--ig-text,#fff1f8);border:1px solid var(--ig-line,#3a2531);box-shadow:0 8px 24px #0008;'+
  'font-size:13px;line-height:1.6;animation:km-crown-tip-in .15s ease-out}'+
  '.km-crown-tip b{display:block;font-size:14px;margin-bottom:4px}'+
  '.km-crown-tip.km-manager-tip b{color:#d9dde3}.km-crown-tip:not(.km-manager-tip) b{color:#f2c14e}'+
  '@keyframes km-crown-tip-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}'+
  '@media(prefers-reduced-motion:reduce){.km-crown-tip{animation:none}}';
 document.head.append(css);
 document.addEventListener('click',e=>{
  const badge=e.target.closest?.('.kimetomo-crown');
  if(!badge){if(tip&&!tip.contains(e.target))close();return}
  e.preventDefault();e.stopPropagation();
  const isMgr=badge.classList.contains('km-manager'),info=isMgr?TIPS.manager:TIPS.admin;
  const again=tip&&tip.dataset.for===(isMgr?'m':'a')&&tip._badge===badge;close();if(again)return; // 同じ印をもう一度押したら閉じる
  tip=document.createElement('div');tip.className='km-crown-tip'+(isMgr?' km-manager-tip':'');tip.dataset.for=isMgr?'m':'a';tip._badge=badge;
  tip.setAttribute('role','tooltip');
  const t=document.createElement('b');t.textContent=info.t;const d=document.createElement('span');d.textContent=info.d;tip.append(t,d);
  document.body.append(tip);
  const r=badge.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight,vw=innerWidth,vh=innerHeight;
  let x=Math.min(Math.max(12,r.left),vw-w-12),y=r.bottom+6;if(y+h>vh-12)y=Math.max(12,r.top-h-6); // 下に入らなければ上に出す
  tip.style.left=x+'px';tip.style.top=y+'px';
 },true);
 addEventListener('scroll',close,true);addEventListener('resize',close);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
})();
