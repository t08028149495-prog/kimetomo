
/* 性別（♂・♀）と、確認済みの女性の印（🌷）を名前の横に表示し、年齢をプロフィールに表示する */
(function(){
 const cache=new Map();let off=false,busy=false,again=false,wOff=false,cols='user_id,gender,gender_hidden';
 const AGE={'18-25':'18〜25','26-30':'26〜30','31-37':'31〜37','38-43':'38〜43','44-50':'44〜50','51+':'それ以上'};
 window.kmGenderBadge=g=>{if(g!=='male'&&g!=='female')return null;const b=document.createElement('span');b.className='km-gender '+g;b.textContent=g==='male'?'♂':'♀';b.title=g==='male'?'男性':'女性';return b};
 window.kmProfileTags=d=>{const out=[];if(!d?.gender_hidden&&(d?.gender==='male'||d?.gender==='female')){const t=document.createElement('span');t.className='km-tag '+d.gender;t.textContent=d.gender==='male'?'♂':'♀';out.push(t)}if(AGE[d?.age_range]){const t=document.createElement('span');t.className='km-tag';t.textContent=AGE[d.age_range]+'歳';out.push(t)}return out};
 window.kmGenderSet=(uid,g)=>{const c=cache.get(uid);cache.set(uid,{...c,g:g||'',at:c?.at||0});decorate()};
 window.kmWomenBadgeRefresh=uid=>{const c=cache.get(uid);if(c)c.at=0;decorate()};
 const sel=document.getElementById('my-profile-gender');
 window.kmPaintGenderSelect=()=>{if(sel)sel.className='km-gender-select '+(sel.value||'')};
 sel?.addEventListener('change',window.kmPaintGenderSelect);
 async function decorate(){
  if(off)return;if(busy){again=true;return}busy=true;
  try{
   const els=[...document.querySelectorAll('[data-km-uid]')];
   const now=Date.now();const need=[...new Set(els.map(e=>e.dataset.kmUid).filter(u=>u&&!(cache.get(u)?.at>now-600000)))];
   if(need.length&&typeof client!=='undefined'&&client){
    for(let i=0;i<need.length;i+=100){
     const part=need.slice(i,i+100);
     let {data,error}=await client.from('kimetomo_user_profiles').select(cols).in('user_id',part);
     if(error&&/gender_hidden/.test(error.message||'')){cols='user_id,gender';({data,error}=await client.from('kimetomo_user_profiles').select(cols).in('user_id',part))}
     if(error){if(/gender/.test(error.message||''))off=true;break}
     const got=new Map((data||[]).map(r=>[r.user_id,r.gender_hidden?'':(r.gender||'')]));
     let ws=null;if(!wOff){const w=await client.rpc('kimetomo_women_badges',{p_ids:part});if(w.error)wOff=true;else ws=new Set((w.data||[]).map(x=>typeof x==='string'?x:x.kimetomo_women_badges))}
     for(const u of part)cache.set(u,{g:got.get(u)||'',w:!!ws?.has(u),at:now});
    }
   }
   for(const el of document.querySelectorAll('[data-km-uid]')){
    const c=cache.get(el.dataset.kmUid)||{};
    // 🌷 確認済みの女性の印（♀の後ろ、王冠などの前）
    let wb=el.querySelector(':scope > .km-wbadge');
    if(c.w&&!wb){wb=document.createElement('span');wb.className='km-wbadge';wb.textContent='🌷';wb.title='確認済みの女性';const g0=el.querySelector(':scope > .km-gender'),first=el.querySelector(':scope > span:not(.km-gender):not(.km-wbadge)');if(g0)g0.after(wb);else if(first)el.insertBefore(wb,first);else el.append(wb)}
    else if(!c.w&&wb)wb.remove();
    const g=c.g||'';let b=el.querySelector(':scope > .km-gender');
    if(!g){b?.remove();continue}
    if(b&&b.classList.contains(g))continue;b?.remove();
    b=window.kmGenderBadge(g);const firstBadge=el.querySelector(':scope > .km-crown, :scope > .km-mood-badge, :scope > span:not(.km-gender)');
    firstBadge?el.insertBefore(b,firstBadge):el.append(b);
   }
  }finally{busy=false;if(again){again=false;setTimeout(decorate,0)}}
 }
 window.kmDecorateGender=decorate;
 let t=null;const soon=()=>{clearTimeout(t);t=setTimeout(decorate,250)};
 new MutationObserver(soon).observe(document.body,{childList:true,subtree:true});
})();
