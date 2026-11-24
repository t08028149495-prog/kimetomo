// プロフィール写真をタップすると、画面いっぱいに大きく表示する。
// 対象：自分のプロフィールの写真（#my-avatar-preview）と、メンバーのプロフィールの写真（img.km-profile-large-avatar）。
// もう一度タップ・「×」・Esc キーで閉じる。見た目は css/tweaks.css の最後（.km-avatar-zoom）。
(()=>{
  const SEL='#my-avatar-preview,img.km-profile-large-avatar';
  let box=null;
  const close=()=>{if(!box)return;box.remove();box=null;window.removeEventListener('keydown',onKey,true)};
  const onKey=e=>{if(e.key==='Escape'){e.stopPropagation();e.preventDefault();close()}};
  const open=img=>{
    if(!img.src||img.naturalWidth===0)return;
    close();
    box=document.createElement('div');box.className='km-avatar-zoom';
    box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label',img.alt||'プロフィール写真');
    const big=document.createElement('img');big.src=img.src;big.alt=img.alt||'プロフィール写真';
    const x=document.createElement('button');x.type='button';x.className='km-avatar-zoom-close';x.setAttribute('aria-label','閉じる');x.textContent='×';
    box.append(big,x);box.addEventListener('click',e=>{e.stopPropagation();close()});
    document.body.append(box);window.addEventListener('keydown',onKey,true);x.focus({preventScroll:true});
  };
  // あとから作られる写真にも効くよう、画面全体で見張る
  document.addEventListener('click',e=>{
    const img=e.target.closest?.(SEL);if(!img)return;
    e.preventDefault();e.stopPropagation();open(img);
  },true);
  // 写真が押せることを伝える（指の形のカーソル・読み上げ）
  const mark=()=>document.querySelectorAll(SEL).forEach(img=>{if(img.dataset.kmZoom)return;img.dataset.kmZoom='1';img.classList.add('km-avatar-zoomable');img.setAttribute('role','button');img.tabIndex=0;img.setAttribute('aria-label',(img.alt||'プロフィール写真')+'を大きく見る')});
  document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches?.(SEL)){e.preventDefault();open(e.target)}});
  let queued=false;const later=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;mark()})};
  new MutationObserver(later).observe(document.body,{childList:true,subtree:true});mark();
})();
