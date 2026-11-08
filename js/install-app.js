/* 「📲 アプリとして入れる」ボタン（Android の Chrome・パソコンの Chrome/Edge）
   - ブラウザが「インストールできます」と知らせてくれた時だけ出す（iPhone では出ない）
   - すでにアプリとして開いている時・入れ終わった時は出さない
   - 「×」で閉じると 30 日間は出さない */
(function(){
 const box=document.getElementById('km-install');if(!box)return;
 const btn=document.getElementById('km-install-btn');
 const close=document.getElementById('km-install-close');
 const KEY='km-install-hidden-until';
 let prompt=null;

 function standalone(){return window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}
 function snoozed(){try{return Date.now()<Number(localStorage.getItem(KEY)||0)}catch{return false}}
 function hide(){box.classList.add('hide')}

 window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  prompt=e;
  if(!standalone()&&!snoozed())box.classList.remove('hide');
 });

 btn.onclick=async()=>{
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
