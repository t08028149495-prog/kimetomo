
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
 document.querySelectorAll('.km-bottom-nav [data-km-go]').forEach(button=>button.addEventListener('click',()=>{
   window.kmActiveTab=button.dataset.kmGo;
   window.kmSetNavReady(true);
   const url=new URL(location.href);
   if(window.kmActiveTab==='timeline')url.searchParams.delete('tab');else url.searchParams.set('tab',window.kmActiveTab);
   url.searchParams.delete('invite');
   history.replaceState(null,'',url.pathname+url.search+url.hash);
   if(window.kmActiveTab==='profile'){
     const open=document.getElementById('my-profile-open');
     if(open)open.click();
   }
   window.scrollTo({top:0,behavior:'smooth'});
 }));
})();
