
/* プロフィールの編集切り替え・投稿欄の「⋯」（投稿欄の開け閉めは js/quick-compose.js） */
(function(){
 const more=document.getElementById('km-opt-more');
 if(more)more.onclick=()=>{more.closest('.km-opts')?.classList.add('km-more-open');more.setAttribute('aria-expanded','true')};
 const eb=document.getElementById('km-profile-edit-btn'),ed=document.getElementById('km-profile-edit');
 if(eb&&ed)eb.onclick=()=>{const o=ed.classList.toggle('hide');eb.textContent=o?'✏️ 編集':'✕ 編集をやめる'};
})();
