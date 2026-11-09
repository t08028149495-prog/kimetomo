
/* 新しいバージョンが公開されたら「更新する」を出す（ホーム画面のアプリを開きっぱなしの人向け） */
(function(){
 if(!/^https?:/.test(location.protocol))return;
 const bar=document.getElementById('km-update');if(!bar)return;
 let base=null,hiddenAt=0;
 async function fingerprint(){
  const r=await fetch(location.pathname+'?km-check='+Date.now(),{cache:'no-store'});
  if(!r.ok)throw Error('check failed');
  const t=await r.text();let h=0;for(let i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))|0;return h;
 }
 async function check(){try{const f=await fingerprint();if(base===null)base=f;else if(f!==base)bar.classList.remove('hide')}catch{}}
 // ただの reload だと、ブラウザがしまっている古いページ（GitHub Pages は10分）を開くことがあるので、先に新しいページを取り直してから開き直す
 document.getElementById('km-update-btn').onclick=async e=>{e.currentTarget.disabled=true;try{await fetch(location.href,{cache:'reload'})}catch{}location.reload()};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)hiddenAt=Date.now();else if(Date.now()-hiddenAt>60000)check()});
 setInterval(()=>{if(!document.hidden)check()},30*60000);
 setTimeout(check,4000);
})();
