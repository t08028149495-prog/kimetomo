/* 👆 タップの手ごたえ・リアクションのはずみ（見た目は css/tap.css。2026-11-26）
   index.html と dm.html の両方で読み込む。 */
(()=>{
'use strict';
// iPhone の Safari は、これが無いと「押している間」の見た目（:active）が出ないことがある。中身は空でよい
document.addEventListener('touchstart',()=>{},{passive:true});

// 要素をぽんっと弾ませる。リアクションを付けた瞬間に、ほかの機能から window.kmPop(要素) で使う
// （投稿：js/app.js／コメント：js/comment-reactions.js／グループチャット：js/topic.js／個人チャット：js/dm-extras.js）
window.kmPop=el=>{
  if(!el||!el.classList)return;
  el.classList.remove('km-pop-once');void el.offsetWidth; // 続けて押しても、毎回はじめから弾む
  el.classList.add('km-pop-once');
  el.addEventListener('animationend',()=>el.classList.remove('km-pop-once'),{once:true});
};
})();
