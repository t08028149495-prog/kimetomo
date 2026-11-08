
/* アプリ化（ホーム画面から開いた）ときだけ「下に引っぱって更新」 */
(function(){
 const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 if(!standalone&&!/[?&]km-ptr=1/.test(location.search))return;
 // 引っぱって更新が使えるので、タイムラインの「更新」ボタンは隠す（CSSで）
 document.body.classList.add('km-standalone');
 const ind=document.createElement('div');ind.className='km-ptr';ind.innerHTML='<span class="km-ptr-icon">↓</span><span class="km-ptr-text">引っぱって更新</span>';
 document.body.append(ind);
 const icon=ind.querySelector('.km-ptr-icon'),text=ind.querySelector('.km-ptr-text');
 const TH=80;let startY=null,dist=0,active=false;
 // 中身を別にスクロールできる場所（チャット欄など）や入力欄では反応させない
 const inScroller=el=>{for(let e=el;e&&e!==document.body;e=e.parentElement){if(e.matches?.('input,textarea,select,.km-profile-overlay'))return true;const cs=getComputedStyle(e);if(/(auto|scroll)/.test(cs.overflowY)&&e.scrollHeight>e.clientHeight&&e.scrollTop>0)return true}return false};
 const typing=()=>[...document.querySelectorAll('textarea,input:not([type=file]):not([type=password]):not([readonly])')].some(e=>e.offsetParent!==null&&e.value.trim()&&e.id!=='km-username');
 function paint(){const d=Math.min(dist,TH*1.4);ind.style.transform='translate(-50%,'+(d-50)+'px)';ind.style.opacity=String(Math.min(1,d/TH));const ready=dist>=TH;icon.style.transform=ready?'rotate(180deg)':'none';text.textContent=ready?'離すと更新':'引っぱって更新'}
 function reset(){startY=null;dist=0;active=false;ind.style.transition='transform .2s,opacity .2s';ind.style.transform='translate(-50%,-50px)';ind.style.opacity='0';setTimeout(()=>{ind.style.transition=''},200)}
 window.addEventListener('touchstart',e=>{if(window.scrollY>0||e.touches.length!==1||inScroller(e.target))return;startY=e.touches[0].clientY;dist=0;active=false},{passive:true});
 window.addEventListener('touchmove',e=>{if(startY===null)return;const dy=e.touches[0].clientY-startY;if(dy<=0||window.scrollY>0){if(active)reset();startY=null;return}active=true;dist=dy*0.55;paint()},{passive:true});
 window.addEventListener('touchend',()=>{if(startY===null)return;const go=active&&dist>=TH;reset();if(!go)return;
  if(!document.getElementById('km-update')?.classList.contains('hide')&&typing()&&!confirm('入力中の内容が消えますが、更新しますか？'))return;
  text.textContent='更新中…';ind.style.opacity='1';ind.style.transform='translate(-50%,20px)';
  // 新しい版があるときだけページごと読み込み直す。ふだんは今のタブのデータだけを読み直す（速い）
  const updateReady=!document.getElementById('km-update')?.classList.contains('hide');
  if(updateReady||!window.kmRefreshData){location.reload();return}
  Promise.resolve(window.kmRefreshData()).catch(()=>{}).finally(()=>{text.textContent='更新しました';setTimeout(reset,600)})},{passive:true});
 reset();
})();
