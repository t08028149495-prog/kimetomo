
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
 // 「視差効果を減らす」の人にだけ、きらめきを出さない。軽量モード（js/lite.js）では出す：
 // 軽量モードになるスマホは多く、止めるとその人たちには何も出なくなるため（js/tap.js と同じ考え。2026-11-26）
 const reduceMotion=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
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
   // 別のタブへ切り替えたときは一瞬で上へ。同じタブを押したときは、するするっと上へ
   window.scrollTo({top:0,behavior:animated?'instant':'smooth'});
 }
 // きらめき ✧ を要素のまわりに飛ばす（ほかの機能からも window.kmSparkle(要素) で使える）
 // 2026-11-26「タブももうちょっと派手に」：6→8 個・色と大きさをばらばらに・少し遠くへ・光の輪を足した。
 // 見た目は css/tap.css の 6（.km-nav-spark と .km-nav-ring）。元の強さは 6 個・13px・26〜42px 先まで・輪なし
 window.kmSparkle=function(el,n=8){
   if(!el||reduceMotion())return;
   const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2-6;
   // 光の輪が、押したタブのところでぱっと広がる
   const ring=document.createElement('span');ring.className='km-tap-ring km-nav-ring';ring.setAttribute('aria-hidden','true');
   ring.style.left=cx+'px';ring.style.top=(cy+6)+'px';document.body.appendChild(ring);setTimeout(()=>ring.remove(),700);
   const colors=['#ffd1e8','#ffffff','#e3cdff','#fff3c4'];
   for(let i=0;i<n;i++){
     const s=document.createElement('span');s.className='km-sparkle km-nav-spark';s.textContent=i%3?(i%2?'✧':'✦'):'♡';s.setAttribute('aria-hidden','true');
     const a=-Math.PI/2+(i-(n-1)/2)*0.4+(Math.random()-.5)*.3,d=32+Math.random()*24;
     s.style.left=cx+'px';s.style.top=cy+'px';s.style.setProperty('--dx',Math.cos(a)*d+'px');s.style.setProperty('--dy',Math.sin(a)*d+'px');
     s.style.setProperty('--fs',(14+Math.random()*7).toFixed(0)+'px');s.style.setProperty('--c',colors[i%colors.length]);
     s.style.animationDelay=(i*22)+'ms';
     document.body.appendChild(s);setTimeout(()=>s.remove(),1150);
   }
 };
 document.querySelectorAll('.km-bottom-nav [data-km-go]').forEach(button=>button.addEventListener('click',()=>{
   window.kmSparkle(button);
   const prev=window.kmActiveTab,next=button.dataset.kmGo;
   // タブの切り替えにはエフェクトを付けない（いちばん速く切り替わるように。2026-11-26）。
   // いろいろ試したが、iPhone のアプリの中ではどれも出なかったので、付けないことにした（CLAUDE.md の page-fx）。
   // 別のタブへは一瞬でいちばん上へ。同じタブをもう一度押したときだけ、するするっと上へ戻る
   switchTo(next,prev!==next);
 }));
})();
