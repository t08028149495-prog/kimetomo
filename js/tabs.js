
/* タブ切替。非ログイン時は非表示。DMは既存のdm.htmlへ */
(function(){
 const tabs=['timeline','chat','profile','admin'];
 function getTab(){const q=new URLSearchParams(location.search).get('tab');return tabs.includes(q)?q:'timeline'}
 window.kmActiveTab=getTab();
 window.kmSetNavReady=function(ready){
   document.body.classList.toggle('km-nav-ready',Boolean(ready));
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
   // 新しい端末：画面を左右にスライドして切り替える。古い端末・同じタブ：今まで通り
   if(prev===next||!document.startViewTransition||reduceMotion()){switchTo(next,false);return}
   const list=order(),root=document.documentElement;
   const dir=list.indexOf(next)>list.indexOf(prev)?'km-vt-fwd':'km-vt-back';
   root.classList.remove('km-vt-fwd','km-vt-back');root.classList.add(dir);
   const vt=document.startViewTransition(()=>switchTo(next,true));
   vt.finished.finally(()=>root.classList.remove(dir));
 }));
})();
