/* 👆 タップの手ごたえ・リアクションのはずみ（見た目は css/tap.css。2026-11-26）
   index.html と dm.html の両方で読み込む。 */
(()=>{
'use strict';
// iPhone の Safari は、これが無いと「押している間」の見た目（:active）が出ないことがある。中身は空でよい
document.addEventListener('touchstart',()=>{},{passive:true});

// 要素をぽんっと弾ませる。リアクションを付けた瞬間に、ほかの機能から window.kmPop(要素) で使う
// （投稿：js/app.js／コメント：js/comment-reactions.js／グループチャット：js/topic.js／個人チャット：js/dm-extras.js）
window.kmPop=el=>{
  if(!el||!el.classList)return;
  el.classList.remove('km-pop-once');void el.offsetWidth; // 続けて押しても、毎回はじめから弾む
  el.classList.add('km-pop-once');
  el.addEventListener('animationend',()=>el.classList.remove('km-pop-once'),{once:true});
  requestAnimationFrame(()=>burst(el)); // 画面に出てから、まわりにきらめきを飛ばす
};

// きらめき ✧♡ を、要素のまわりにぐるっと飛ばす（見た目は css/motion.css の .km-sparkle。js/tabs.js の kmSparkle の丸く飛ぶ版）
// 軽量モード（遅い端末）と「視差効果を減らす」の人には出さない
function burst(el,n=6){
  if(!el.isConnected||document.documentElement.classList.contains('km-lite')||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  const r=el.getBoundingClientRect();if(!r.width)return;
  const cx=r.left+r.width/2,cy=r.top+r.height/2,turn=Math.random()*6.28;
  for(let i=0;i<n;i++){
    const s=document.createElement('span');s.className='km-sparkle';s.textContent=i%2?'✧':'♡';s.setAttribute('aria-hidden','true');
    const a=turn+i*(6.28/n),d=24+Math.random()*12;
    s.style.left=cx+'px';s.style.top=cy+'px';s.style.setProperty('--dx',Math.cos(a)*d+'px');s.style.setProperty('--dy',Math.sin(a)*d+'px');
    document.body.appendChild(s);setTimeout(()=>s.remove(),900);
  }
}
})();
