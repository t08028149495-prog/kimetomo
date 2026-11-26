
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
 // タブを切り替えたとき、新しい画面を 0.28 秒でふわっと出す。
 // 画面そのものは動かさない。背景と同じ色の「幕」（.km-tab-veil。見た目は css/page-fx.css）を中身の上にかぶせ、
 // その幕を透明にしていく。幕は画面 1 枚ぶんの大きさしかないので、どの端末でも軽い（軽量モードでも出す）。
 // ・うまくいかなかった方法（2026-11-26。どちらもパソコンでは出るのに、iPhone のアプリの中では何も出なかった）：
 //   ①新しい切り替えの仕組み（View Transitions） ②出てくる画面（#timeline など）そのものを透明→表示・横に動かす
 //   ②は小さな四角なら iPhone でも動いたので、縦にとても長い画面をまるごと動かすのが重すぎた、という見立て
 // ・切り替えた直後は新しい画面の組み立てに時間がかかるので、幕はすぐかぶせて、画面が 2 回描かれてから消し始める
 // ・幕の場所：横は中身（main）の幅だけ。上は、スマホの上の帯（.brand）の下から。下のタブ・左のメニューはかくさない
 function tabIn(){
   const main=document.querySelector('main');
   if(!main||!main.animate)return;
   const m=main.getBoundingClientRect(),h=document.querySelector('.brand')?.getBoundingClientRect();
   document.querySelectorAll('.km-tab-veil').forEach(v=>v.remove());
   const v=document.createElement('div');v.className='km-tab-veil';v.setAttribute('aria-hidden','true');
   v.style.left=m.left+'px';v.style.width=m.width+'px';
   v.style.top=(h&&h.height&&h.top<4?Math.round(h.bottom):0)+'px';
   document.body.appendChild(v);
   const an=v.animate([{opacity:1},{opacity:0}],{duration:280,easing:'ease-out',fill:'forwards'});
   an.pause();
   let started=false;
   const done=()=>v.remove();
   const go=()=>{if(started)return;started=true;try{an.play();an.finished.then(done,done)}catch(e){done()}};
   requestAnimationFrame(()=>requestAnimationFrame(go));
   setTimeout(go,400);    // 念のため（画面が隠れているなどで描かれないとき）
   setTimeout(done,1500); // 念のため（幕が残らないように）
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
   // 同じタブ・「視差効果を減らす」の人：動かさない。ほかは、新しい画面がふわっと出る（上の tabIn）
   if(prev===next||still()){switchTo(next,false);return}
   switchTo(next,true);
   tabIn();
 }));
})();
