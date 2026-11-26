/* 🌸 ページの切り替え：下のタブ（パソコンは左のメニュー）でページが変わるとき（DM のタブ。index.html ⇄ dm.html）は、
   切り替えの動きを付けずに、すぐ出す（見た目は css/page-fx.css。2026-11-26）
   ・タブのリンクを押したことを、このタブの中だけの一時的なメモ（sessionStorage の km-fx-tab）に書く。4 秒たったら使わない
   ・出ていくページと次のページの両方で、そのメモがあれば切り替えの動きを飛ばす
   ・タブ以外の移動（プロフィールから個人チャットを開く・ブラウザの「戻る」など）は、css/page-fx.css の控えめな動きのまま
   <head> で読み込む（次のページが最初に描かれる前に決めるため）。index.html と dm.html の両方。 */
(()=>{
'use strict';
const KEY='km-fx-tab';
const fresh=()=>{try{return Date.now()-Number(sessionStorage.getItem(KEY)||0)<4000}catch(e){return false}};
const skip=e=>{if(e.viewTransition&&fresh()){try{e.viewTransition.skipTransition()}catch(err){}}};
addEventListener('pageswap',skip);                 // 出ていくページ
addEventListener('pagereveal',e=>{skip(e);try{sessionStorage.removeItem(KEY)}catch(err){}}); // 次のページ

document.addEventListener('pointerdown',e=>{
  if(!e.isPrimary)return;
  try{
    if(e.target.closest?.('.km-bottom-nav > a[href]'))sessionStorage.setItem(KEY,String(Date.now()));
    else sessionStorage.removeItem(KEY);
  }catch(err){}
},{passive:true,capture:true});
})();
