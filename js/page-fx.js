/* 🌸 ページの切り替え：ページが変わるタブ（DM のタブ）で、切り替えの「向き」を次のページへ伝える
   （見た目は css/page-fx.css。2026-11-26）
   ・下のタブ（パソコンは左のメニュー）のうち、別のページへ行くリンク（index.html ⇄ dm.html）を押したとき、
     今のタブより右か左かを覚える（このタブの中だけの一時的なメモ sessionStorage の km-fx-dir。4 秒たったら使わない）
   ・次のページでは、その向きの印（km-vt-fwd＝右のタブへ／km-vt-back＝左のタブへ）を <html> に付け、
     切り替えが終わったら外す（ページの中でのタブ切り替えは js/tabs.js が同じ印を付ける）
   ・印がないとき（タブ以外の移動・ブラウザの「戻る」など）は、下から少し出る動きになる
   <head> で読み込む（次のページが最初に描かれる前に、印を付けておくため）。index.html と dm.html の両方。 */
(()=>{
'use strict';
const root=document.documentElement,KEY='km-fx-dir';
let p=null;
try{p=JSON.parse(sessionStorage.getItem(KEY));sessionStorage.removeItem(KEY)}catch(e){}
if(p&&p.dir&&Date.now()-p.t<4000){
  const cls=p.dir==='back'?'km-vt-back':'km-vt-fwd';
  root.classList.add(cls);
  const off=()=>root.classList.remove(cls);
  addEventListener('pagereveal',e=>{if(e.viewTransition)e.viewTransition.finished.then(off,off);else off()},{once:true});
  setTimeout(off,1500); // 念のため（古い端末など）
}

document.addEventListener('pointerdown',e=>{
  if(!e.isPrimary)return;
  try{
    const a=e.target.closest?.('.km-bottom-nav > a[href]');
    if(!a||a.classList.contains('km-current')){sessionStorage.removeItem(KEY);return}
    const list=[...a.parentElement.children],cur=list.findIndex(n=>n.classList.contains('km-current'));
    sessionStorage.setItem(KEY,JSON.stringify({dir:cur>=0&&list.indexOf(a)<cur?'back':'fwd',t:Date.now()}));
  }catch(err){}
},{passive:true,capture:true});
})();
