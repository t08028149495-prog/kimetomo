
/* URL をリンクにする（テキストは安全に textContent で入れる） */
function kmLinkify(el,text){
 el.replaceChildren();
 const re=/https?:\/\/[^\s<>"'（）「」、。]+/g;let last=0,m;
 while((m=re.exec(text))){
  let url=m[0].replace(/[).,!?！？]+$/,'');
  if(m.index>last)el.append(text.slice(last,m.index));
  const a=document.createElement('a');a.href=url;a.textContent=url.length>60?url.slice(0,57)+'…':url;a.target='_blank';a.rel='noopener noreferrer';a.className='km-link';
  el.append(a);last=m.index+url.length;re.lastIndex=last;
 }
 if(last<text.length)el.append(text.slice(last));
}
/* 投稿の最初の URL をカードで表示（結果は端末に1日保存） */
async function kmAttachLinkPreview(bodyEl,text){
 const m=(text||'').match(/https?:\/\/[^\s<>"'（）「」、。]+/);if(!m)return;
 const url=m[0].replace(/[).,!?！？]+$/,'');
 await new Promise(r=>setTimeout(r,0));
 const key='km-lp:'+url;let data=null;
 try{const c=JSON.parse(localStorage.getItem(key)||'null');if(c&&Date.now()-c.at<86400000)data=c.data}catch{}
 if(data===null){
  try{const {data:d,error}=await client.functions.invoke('link-preview',{body:{url}});data=error?false:d;}catch{data=false}
  try{localStorage.setItem(key,JSON.stringify({at:Date.now(),data}))}catch{}
 }
 if(!data||!data.title||!bodyEl.parentElement)return;
 const card=document.createElement('a');card.className='km-lp';card.href=data.url||url;card.target='_blank';card.rel='noopener noreferrer';
 if(data.image){const img=document.createElement('img');img.src=data.image;img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();card.append(img)}
 const box=document.createElement('div');box.className='km-lp-text';
 const site=document.createElement('span');site.className='km-lp-site';site.textContent=data.site||'';
 const t=document.createElement('strong');t.textContent=data.title;
 box.append(site,t);
 if(data.description){const d=document.createElement('span');d.className='km-lp-desc';d.textContent=data.description;box.append(d)}
 card.append(box);
 const after=bodyEl.nextElementSibling?.classList.contains('km-readmore')?bodyEl.nextElementSibling:bodyEl;
 after.after(card);
}
