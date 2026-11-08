
/* いつでも入力できる投稿欄（入力欄と「投稿」ボタンを常に表示し、お題・おみくじ・アンケートは入力を始めたら出す） */
(function(){
 const ta=document.getElementById('timeline-body'),submit=document.getElementById('timeline-submit'),extras=document.getElementById('km-compose'),openBtn=document.getElementById('km-compose-open');
 if(!ta||!submit||!extras)return;
 const row=document.createElement('div');row.className='km-quick';
 extras.before(row);row.append(ta,submit);
 submit.textContent='投稿';
 openBtn?.remove();
 document.querySelector('.km-compose-actions')?.remove();
 const hint=document.createElement('p');hint.id='km-quick-hint';hint.className='small km-quick-hint';row.after(hint);
 const t=document.getElementById('km-topic-text'),lbl=document.querySelector('#km-topic-use .small');
 const paintHint=()=>{hint.textContent=t?.textContent?((lbl?.textContent||'💡 今日のお題').replace('（タップで使う）','')+'：'+t.textContent+'（タップで使う）'):''};
 paintHint();if(t)new MutationObserver(paintHint).observe(t,{childList:true,characterData:true,subtree:true});
 hint.onclick=()=>document.getElementById('km-topic-use')?.click();
 const grow=()=>{ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,220)+'px'};
 const openExtras=()=>{extras.classList.remove('hide');hint.classList.add('hide')};
 ta.addEventListener('input',grow);
 ta.addEventListener('focus',openExtras);
 window.kmCloseCompose=()=>{extras.classList.add('hide');hint.classList.remove('hide');ta.style.height='';ta.blur()};
 // 入力欄の外をタップして、何も書いていなければたたむ
 document.addEventListener('click',e=>{if(!extras.classList.contains('hide')&&!ta.value.trim()&&!document.getElementById('km-img-file')?.files?.length&&!e.target.closest('#timeline .km-quick,#km-compose,#km-quick-hint'))window.kmCloseCompose()});
 // お題を使ったときは入力欄の高さも合わせる
 document.getElementById('km-topic-use')?.addEventListener('click',()=>{openExtras();setTimeout(grow,0)});
})();
