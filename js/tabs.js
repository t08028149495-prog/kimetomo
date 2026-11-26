
/* タブ切替。非ログイン時は非表示。DMは既存のdm.htmlへ */
(function(){
 const tabs=['timeline','chat','profile','admin'];
 function getTab(){const q=new URLSearchParams(location.search).get('tab');return tabs.includes(q)?q:'timeline'}
 window.kmActiveTab=getTab();
 window.kmSetNavReady=function(ready){
   const was=document.body.classList.contains('km-nav-ready');
   document.body.classList.toggle('km-nav-ready',Boolean(ready));
   // ログインが終わって下のタブが出た瞬間に知らせる（赤い数字をすぐ数える：js/poll.js・js/topic.js）
   if(ready&&!was)setTimeout(()=>window.dispatchEvent(new Event('km-nav-ready')),0);
   if(ready){
     document.body.dataset.kmTab=window.kmActiveTab;
     document.querySelectorAll('.km-bottom-nav [data-km-go]').forEach(b=>{
       const active=b.dataset.kmGo===window.kmActiveTab;
       b.classList.toggle('km-current',active);
       if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
     });
   }else{document.body.removeAttribute('data-km-tab');}
 };
 const order=()=>[...document.querySelectorAll('.km-bottom-nav [data-km-go]')].map(b=>b.dataset.kmGo);
 const reduceMotion=()=>document.documentElement.classList.contains('km-lite')||window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 // 「視差効果を減らす」の人だけ true（軽量モードはふくまない）
 const still=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 // タブを切り替えたとき、出てくる画面を 0.22 秒で「進む向きから 12px 寄りながら、ふわっと」出す。
 // dir：1＝右のタブへ（右から寄ってくる）／-1＝左のタブへ（左から寄ってくる）
 // どの端末でも同じ動きになるよう、画面そのものを直接動かす（透明度と位置だけなので軽い。軽量モードでも出す）。
 // 前は「新しい切り替えの仕組み（View Transitions）」を使っていたが、iPhone では動きが出なかったのでやめた（2026-11-26）
 function tabIn(dir){
   ['timeline','chat','my-profile','admin'].forEach(id=>{
     const el=document.getElementById(id);
     if(el&&el.animate&&el.offsetParent!==null)el.animate(
       [{opacity:0,transform:'translateX('+(dir*12)+'px)'},{opacity:1,transform:'none'}],
       {duration:220,easing:'cubic-bezier(.2,.8,.3,1)'});
   });
 }
 function switchTo(next,animated){
   window.kmActiveTab=next;
   window.kmSetNavReady(true);
   const url=new URL(location.href);
   if(next==='timeline')url.searchParams.delete('tab');else url.searchParams.set('tab',next);
   url.searchParams.delete('invite');
   history.replaceState(null,'',url.pathname+url.search+url.hash);
   if(next==='profile'){
     const open=document.getElementById('my-profile-open');
     if(open)open.click();
   }
   // 切り替えアニメーション中は一瞬で上へ（動きの中でスクロールが見えないように）
   window.scrollTo({top:0,behavior:animated?'instant':'smooth'});
 }
 // きらめき ✧ を要素のまわりに飛ばす（ほかの機能からも window.kmSparkle(要素) で使える）
 window.kmSparkle=function(el,n=6){
   if(!el||reduceMotion())return;
   const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2-6;
   for(let i=0;i<n;i++){
     const s=document.createElement('span');s.className='km-sparkle';s.textContent=i%3?'✧':'♡';s.setAttribute('aria-hidden','true');
     const a=-Math.PI/2+(i-(n-1)/2)*0.5+(Math.random()-.5)*.3,d=26+Math.random()*16;
     s.style.left=cx+'px';s.style.top=cy+'px';s.style.setProperty('--dx',Math.cos(a)*d+'px');s.style.setProperty('--dy',Math.sin(a)*d+'px');
     s.style.animationDelay=(i*25)+'ms';
     document.body.appendChild(s);setTimeout(()=>s.remove(),900);
   }
 };
 document.querySelectorAll('.km-bottom-nav [data-km-go]').forEach(button=>button.addEventListener('click',()=>{
   window.kmSparkle(button);
   const prev=window.kmActiveTab,next=button.dataset.kmGo;
   // 同じタブ・「視差効果を減らす」の人：動かさない。ほかは、進む向きから少し寄って出る（上の tabIn）
   if(prev===next||still()){switchTo(next,false);return}
   const list=order();
   switchTo(next,true);
   tabIn(list.indexOf(next)>list.indexOf(prev)?1:-1);
 }));
})();
