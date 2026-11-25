/* 🌸 ページの切り替え：新しい画面が丸く広がる「中心」を決める（見た目は css/page-fx.css。2026-11-26）
   ・画面を押した場所を覚えて、そこを中心にする（下のタブ・左のメニュー・リンクなど）
   ・index.html ⇄ dm.html のようにページが変わるときは、押した場所を次のページへ引き継ぐ
     （このタブの中だけの一時的なメモ sessionStorage の km-fx-xy。4 秒たったら使わない）
   ・押した場所が分からないとき（ブラウザの「戻る」など）は、画面のまん中から広がる
   <head> で読み込む（次のページが最初に描かれる前に、中心を決めておくため）。index.html と dm.html の両方。 */
(()=>{
'use strict';
const root=document.documentElement,KEY='km-fx-xy';
// 中心（--km-vx・--km-vy）と、画面のいちばん遠い角までの距離（--km-vr＝丸が広がりきる大きさ）
function set(x,y){
  const w=innerWidth||root.clientWidth||0,h=innerHeight||root.clientHeight||0;
  x=Math.max(0,Math.min(x,w));y=Math.max(0,Math.min(y,h));
  root.style.setProperty('--km-vx',x+'px');root.style.setProperty('--km-vy',y+'px');
  root.style.setProperty('--km-vr',Math.ceil(Math.hypot(Math.max(x,w-x),Math.max(y,h-y)))+'px');
}
// 前のページで押した場所があれば、それを使う。なければ、まん中
let p=null;
try{p=JSON.parse(sessionStorage.getItem(KEY))}catch(e){}
if(p&&Date.now()-p.t<4000)set(p.x,p.y);else set((innerWidth||0)/2,(innerHeight||0)/2);

document.addEventListener('pointerdown',e=>{
  if(!e.isPrimary)return;
  set(e.clientX,e.clientY);
  try{sessionStorage.setItem(KEY,JSON.stringify({x:e.clientX,y:e.clientY,t:Date.now()}))}catch(err){}
},{passive:true,capture:true});
})();
