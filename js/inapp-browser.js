
/* LINE・Instagram・Facebook・Google アプリ（GSA）などのアプリ内ブラウザなら案内を出す */
(function(){
 const ua=navigator.userAgent||'';
 if(/\bLine\/|FBAN|FBAV|Instagram|Twitter|TikTok|BytedanceWebview|GSA\/|; wv\)/i.test(ua)){
  const el=document.getElementById('km-inapp');if(!el)return;
  try{if(sessionStorage.getItem('km-inapp-closed'))return}catch{}
  el.classList.remove('hide');
  document.getElementById('km-inapp-close').onclick=()=>{el.classList.add('hide');try{sessionStorage.setItem('km-inapp-closed','1')}catch{}};
 }
})();
