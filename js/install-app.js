/* 「📲 アプリとして入れる」ボタン
   - Android の Chrome・パソコンの Chrome/Edge：ブラウザが「インストールできます」と知らせてくれた時だけ出す。押すとインストール画面が開く
   - iPhone・iPad：いつでも出す。押すと「ホーム画面に追加」の手順をその場に開く（もう一度押すと閉じる）
   - すでにアプリとして開いている時・入れ終わった時は出さない
   - 「×」で閉じると 30 日間は出さない */
(function(){
 const box=document.getElementById('km-install');if(!box)return;
 const btn=document.getElementById('km-install-btn');
 const close=document.getElementById('km-install-close');
 const steps=document.getElementById('km-install-ios');
 const KEY='km-install-hidden-until';
 let prompt=null;

 function standalone(){return window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}
 function snoozed(){try{return Date.now()<Number(localStorage.getItem(KEY)||0)}catch{return false}}
 function hide(){box.classList.add('hide')}
 const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);

 if(ios&&steps&&!standalone()&&!snoozed())box.classList.remove('hide');

 window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  prompt=e;
  if(!standalone()&&!snoozed())box.classList.remove('hide');
 });

 btn.onclick=async()=>{
  if(ios&&steps){
   const open=steps.classList.toggle('hide')===false;
   btn.textContent=open?'手順を閉じる':'アプリとして入れる';
   return;
  }
  if(!prompt)return hide();
  prompt.prompt();
  try{const r=await prompt.userChoice;if(r.outcome==='accepted')hide()}catch{}
  prompt=null;
 };

 close.onclick=()=>{
  try{localStorage.setItem(KEY,String(Date.now()+30*24*60*60*1000))}catch{}
  hide();
 };

 window.addEventListener('appinstalled',()=>{prompt=null;hide()});
})();
