/* 📸 Instagram 風デザインの動き（見た目は css/insta.css）。index.html と dm.html の両方で読み込む
   1. 下のタブのアイコンを線の絵（SVG）にする。選んでいるタブは塗りつぶしになる
   2. 投稿の右上の「編集・削除・引用・通報」ボタンを「⋯」の中にまとめる */
(function(){
 // ── 1. 下のタブのアイコン ──
 // class="f" は選んでいるときに塗りつぶす部分、class="h" は塗りつぶしたときに背景色で見せる線
 const SVG={
  timeline:'<path class="f" d="M3.5 10.2 12 3.2l8.5 7V20a1 1 0 0 1-1 1H15v-6.2H9V21H4.5a1 1 0 0 1-1-1z"/>',
  chat:'<path class="f" d="M12 3.3c-4.9 0-8.8 3.6-8.8 8.1 0 2.4 1.1 4.5 2.9 6L5.4 21l3.9-1.7c.9.3 1.8.4 2.7.4 4.9 0 8.8-3.6 8.8-8.2S16.9 3.3 12 3.3z"/><path class="h" d="M8.2 11.6h.01M12 11.6h.01M15.8 11.6h.01" stroke-width="2.6"/>',
  dm:'<path class="f" d="M21.5 2.8 2.6 9.6l7.3 3.5 3.5 7.6z"/><path class="h" d="M21.5 2.8 9.9 13.1"/>',
  profile:'<circle class="f" cx="12" cy="7.8" r="4.1"/><path class="f" d="M4 21c.4-4.3 3.7-6.9 8-6.9s7.6 2.6 8 6.9z"/>',
  admin:'<path class="f" d="m3 7.5 4.6 4.2L12 4.6l4.4 7.1L21 7.5l-1.9 11.4H4.9z"/>'
 };
 function keyOf(el){
  if(el.dataset.kmGo)return el.dataset.kmGo;
  const h=el.getAttribute('href')||'';
  if(/dm\.html/.test(h))return 'dm';
  const m=h.match(/tab=(\w+)/);return m?m[1]:'timeline';
 }
 document.querySelectorAll('.km-bottom-nav a,.km-bottom-nav button').forEach(el=>{
  const icon=el.querySelector('.km-icon'),svg=SVG[keyOf(el)];
  if(icon&&svg)icon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+svg+'</svg>';
 });

 // 通知ベルも線の絵に（絵文字の🔔をおきかえる）
 const bell=document.getElementById('km-notify-button');
 if(bell){const tn=[...bell.childNodes].find(n=>n.nodeType===3&&n.textContent.includes('🔔'));
  if(tn){const s=document.createElement('span');s.className='km-bell';s.setAttribute('aria-hidden','true');
   s.innerHTML='<svg viewBox="0 0 24 24"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4z"/><path d="M10 21h4"/></svg>';tn.replaceWith(s)}}

 // ── 2. 投稿の「⋯」メニュー ──
 const feed=document.getElementById('timeline-feed');
 if(!feed)return;
 function closeAll(except){
  document.querySelectorAll('.km-more-menu:not([hidden])').forEach(m=>{
   if(m===except)return;m.hidden=true;m.previousElementSibling?.setAttribute('aria-expanded','false');
  });
 }
 function wrap(meta){
  meta.dataset.kmMore='1';
  const btns=[...meta.querySelectorAll(':scope > button')];
  if(!btns.length)return;
  const box=document.createElement('div');box.className='km-more';
  const t=document.createElement('button');t.type='button';t.className='km-more-btn';t.textContent='⋯';
  t.setAttribute('aria-label','その他の操作（編集・削除・通報など）');t.setAttribute('aria-expanded','false');
  const menu=document.createElement('div');menu.className='km-more-menu';menu.hidden=true;menu.setAttribute('role','menu');
  menu.append(...btns);
  t.addEventListener('click',e=>{e.stopPropagation();const open=menu.hidden;closeAll(menu);menu.hidden=!open;t.setAttribute('aria-expanded',String(open))});
  // 中のボタンを押したら（それぞれの動きのあとで）メニューを閉じる
  menu.addEventListener('click',()=>setTimeout(()=>{menu.hidden=true;t.setAttribute('aria-expanded','false')},0));
  box.append(t,menu);meta.append(box);
 }
 function scan(){feed.querySelectorAll('.km-post-meta:not([data-km-more])').forEach(wrap)}
 new MutationObserver(scan).observe(feed,{childList:true,subtree:true});
 scan();
 document.addEventListener('click',e=>{if(!e.target.closest?.('.km-more'))closeAll()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAll()});
})();
