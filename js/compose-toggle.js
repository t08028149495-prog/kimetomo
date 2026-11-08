
/* 投稿欄の開閉・プロフィールの編集切り替え */
(function(){
 const open=document.getElementById('km-compose-open'),box=document.getElementById('km-compose'),hint=document.getElementById('km-compose-hint'),ta=document.getElementById('timeline-body');
 if(open&&box){
  const show=()=>{box.classList.remove('hide');open.classList.add('hide');setTimeout(()=>ta?.focus(),50)};
  window.kmCloseCompose=()=>{box.classList.add('hide');open.classList.remove('hide')};
  open.onclick=show;
  document.getElementById('km-compose-cancel').onclick=()=>{if(ta.value.trim()&&!confirm('書きかけの内容は残しておきます。閉じますか？'))return;window.kmCloseCompose()};
  const t=document.getElementById('km-topic-text'),lbl=document.querySelector('#km-topic-use .small');
  const paint=()=>{if(t?.textContent)hint.textContent=(lbl?.textContent||'💡 今日のお題').replace('（タップで使う）','')+'：'+t.textContent};
  paint();new MutationObserver(paint).observe(t,{childList:true,characterData:true,subtree:true});
  // おみくじの「タイムラインに投稿する」やお題から書き始めたときは開いたままにする
  document.getElementById('km-topic-use')?.addEventListener('click',show);
 }
 const eb=document.getElementById('km-profile-edit-btn'),ed=document.getElementById('km-profile-edit');
 if(eb&&ed)eb.onclick=()=>{const o=ed.classList.toggle('hide');eb.textContent=o?'✏️ 編集':'✕ 編集をやめる'};
})();
