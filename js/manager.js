/* 👑 マネージャー：管理者の印と同じ形で、シルバーの王冠とシルバーの背景。名前の横に出す（見た目は glow.css の最後）。
   index.html と dm.html の両方で読む。人を増やす・減らすときは下の一覧の ID を書きかえる（ID は Supabase の kimetomo_user_profiles.user_id） */
(function(){
 window.kmManagers=new Set([
  'd4efaeb6-11db-4d4b-a2b0-c3c12c728640' // レモン汁
 ]);
 window.kmManagerBadge=function(){
  const b=document.createElement('span');b.className='kimetomo-crown km-manager';
  const icon=document.createElement('span');icon.className='kimetomo-crown-icon';icon.textContent='👑';
  const label=document.createElement('span');label.className='kimetomo-crown-label';label.textContent='マネージャー';
  b.append(icon,label);b.title='キメ友SNS マネージャー';b.setAttribute('aria-label','マネージャー');
  return b;
 };
})();
