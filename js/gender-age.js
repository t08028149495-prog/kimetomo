
/* 性別（♂・♀）と、確認済みの女性の印（🌷）、住んでいる都道府県（＠○○県）を名前の横に表示し、年齢・都道府県をプロフィールに表示する */
(function(){
 const cache=new Map();let off=false,busy=false,again=false,wOff=false,cols='user_id,gender,gender_hidden,prefecture';
 const PREFS=['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'];
 const prefSel=document.getElementById('my-profile-pref');
 if(prefSel&&prefSel.options.length<2)prefSel.append(...PREFS.map(v=>new Option(v,v)));
 const AGE={'18-25':'18〜25','26-30':'26〜30','31-37':'31〜37','38-43':'38〜43','44-50':'44〜50','51+':'それ以上'};
 window.kmGenderBadge=g=>{if(g!=='male'&&g!=='female')return null;const b=document.createElement('span');b.className='km-gender '+g;b.textContent=g==='male'?'♂':'♀';b.title=g==='male'?'男性':'女性';return b};
 window.kmProfileTags=d=>{const out=[];if(!d?.gender_hidden&&(d?.gender==='male'||d?.gender==='female')){const t=document.createElement('span');t.className='km-tag '+d.gender;t.textContent=d.gender==='male'?'♂':'♀';out.push(t)}if(AGE[d?.age_range]){const t=document.createElement('span');t.className='km-tag';t.textContent=AGE[d.age_range]+'歳';out.push(t)}if(PREFS.includes(d?.prefecture)){const t=document.createElement('span');t.className='km-tag';t.textContent='📍'+d.prefecture;out.push(t)}return out};
 window.kmGenderSet=(uid,g)=>{const c=cache.get(uid);cache.set(uid,{...c,g:g||'',at:c?.at||0});decorate()};
 window.kmPrefSet=(uid,p)=>{const c=cache.get(uid);cache.set(uid,{...c,p:p||'',at:c?.at||0});decorate()};
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
     if(error&&/prefecture/.test(error.message||'')){cols=cols.replace(',prefecture','');({data,error}=await client.from('kimetomo_user_profiles').select(cols).in('user_id',part))}
     if(error&&/gender_hidden/.test(error.message||'')){cols='user_id,gender';({data,error}=await client.from('kimetomo_user_profiles').select(cols).in('user_id',part))}
     if(error){if(/gender/.test(error.message||''))off=true;break}
     const got=new Map((data||[]).map(r=>[r.user_id,r.gender_hidden?'':(r.gender||'')]));const pf=new Map((data||[]).map(r=>[r.user_id,r.prefecture||'']));
     let ws=null;if(!wOff){const w=await client.rpc('kimetomo_women_badges',{p_ids:part});if(w.error)wOff=true;else ws=new Set((w.data||[]).map(x=>typeof x==='string'?x:x.kimetomo_women_badges))}
     for(const u of part)cache.set(u,{g:got.get(u)||'',w:!!ws?.has(u),p:pf.get(u)||'',at:now});
    }
   }
   for(const el of document.querySelectorAll('[data-km-uid]')){
    const c=cache.get(el.dataset.kmUid)||{};
    // ＠○○県（名前のすぐ後ろ。ほかの印より前）
    let pb=el.querySelector(':scope > .km-pref');const pv=c.p?'＠'+c.p:'';
    if(!pv)pb?.remove();
    else if(!pb||pb.textContent!==pv){pb?.remove();pb=document.createElement('span');pb.className='km-pref';pb.textContent=pv;pb.title='住んでいる都道府県';const tx=[...el.childNodes].find(n=>n.nodeType===3||n.classList?.contains('km-acc-n'));if(tx)tx.after(pb);else el.prepend(pb)}
    // 🌷 確認済みの女性の印（♀の後ろ、王冠などの前）
    let wb=el.querySelector(':scope > .km-wbadge');
    if(c.w&&!wb){wb=document.createElement('span');wb.className='km-wbadge';wb.textContent='🌷';wb.title='確認済みの女性';const g0=el.querySelector(':scope > .km-gender'),first=el.querySelector(':scope > span:not(.km-gender):not(.km-wbadge):not(.km-pref):not(.km-acc-n)');if(g0)g0.after(wb);else if(first)el.insertBefore(wb,first);else el.append(wb)}
    else if(!c.w&&wb)wb.remove();
    const g=c.g||'';let b=el.querySelector(':scope > .km-gender');
    if(!g){b?.remove();continue}
    if(b&&b.classList.contains(g))continue;b?.remove();
    b=window.kmGenderBadge(g);const firstBadge=el.querySelector(':scope > .km-crown, :scope > .km-mood-badge, :scope > span:not(.km-gender):not(.km-pref):not(.km-acc-n)');
    firstBadge?el.insertBefore(b,firstBadge):el.append(b);
   }
  }finally{busy=false;if(again){again=false;setTimeout(decorate,0)}}
 }
 window.kmDecorateGender=decorate;
 let t=null;const soon=()=>{clearTimeout(t);t=setTimeout(decorate,250)};
 new MutationObserver(soon).observe(document.body,{childList:true,subtree:true});
})();
