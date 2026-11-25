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

// 💬 コメントのボタンを押して欄が開いたときだけ、ふわっと出す（css/tap.css の km-rise-once）。
// 読み直しで欄が作り直されたときには動かさないよう、押したときだけ付ける
document.addEventListener('click',e=>{
  const t=e.target.closest?.('.km-comment-toggle');if(!t)return;
  setTimeout(()=>{
    const a=t.closest('.timeline-post')?.querySelector('.km-comment-area:not(.hide)');if(!a)return;
    a.classList.remove('km-rise-once');void a.offsetWidth;a.classList.add('km-rise-once');
    a.addEventListener('animationend',()=>a.classList.remove('km-rise-once'),{once:true});
  },0);
},true);

// 軽量モード（遅い端末）と「視差効果を減らす」の人には、きらめきを出さない
const calm=()=>document.documentElement.classList.contains('km-lite')||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ✨ 画面をタップした場所に、光の輪ときらめきを出す（見た目は css/tap.css の .km-tap-ring と .km-tap-spark）
// ・スクロールや長押しでは出さない（指がほとんど動かず、すぐ離したときだけ）
// ・文字を打つ欄と、下のタブ（タブはもう自分のきらめきがある：js/tabs.js）では出さない
let down=null;
document.addEventListener('pointerdown',e=>{down=e.isPrimary?{x:e.clientX,y:e.clientY,t:e.timeStamp}:null},{passive:true,capture:true});
document.addEventListener('pointercancel',()=>{down=null},{passive:true,capture:true});
document.addEventListener('pointerup',e=>{
  const d=down;down=null;
  if(!d||!e.isPrimary||e.timeStamp-d.t>450||Math.hypot(e.clientX-d.x,e.clientY-d.y)>10||calm())return;
  if(e.target.closest?.('input,textarea,select,[contenteditable],.km-bottom-nav'))return;
  // 光の輪がぱっと広がる
  const ring=document.createElement('span');ring.className='km-tap-ring';ring.setAttribute('aria-hidden','true');
  ring.style.left=e.clientX+'px';ring.style.top=e.clientY+'px';document.body.appendChild(ring);setTimeout(()=>ring.remove(),600);
  // きらめき ✦ が 7 つ、大きさと色を変えながら広がる
  const turn=Math.random()*6.28,n=7,colors=['#ffffff','#ffd1e8','#e3cdff','#fff3c4'];
  for(let i=0;i<n;i++){
    const s=document.createElement('span');s.className='km-sparkle km-tap-spark';s.textContent='✦✧✦⋆✦✧✦'[i];s.setAttribute('aria-hidden','true');
    const a=turn+i*(6.28/n)+(Math.random()-.5)*.5,r=26+Math.random()*24;
    s.style.left=e.clientX+'px';s.style.top=e.clientY+'px';s.style.setProperty('--dx',Math.cos(a)*r+'px');s.style.setProperty('--dy',Math.sin(a)*r+'px');
    s.style.setProperty('--fs',(13+Math.random()*8).toFixed(0)+'px');s.style.setProperty('--c',colors[i%colors.length]);
    document.body.appendChild(s);setTimeout(()=>s.remove(),900);
  }
},{passive:true,capture:true});

// きらめき ✧♡ を、要素のまわりにぐるっと飛ばす（見た目は css/motion.css の .km-sparkle。js/tabs.js の kmSparkle の丸く飛ぶ版）
function burst(el,n=6){
  if(!el.isConnected||calm())return;
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
