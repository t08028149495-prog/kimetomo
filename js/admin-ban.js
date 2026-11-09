
/* 管理者だけが使える BAN（利用停止） */
(function(){
 const list=document.getElementById('km-ban-list'),load=document.getElementById('km-ban-load');
 if(!list||!load)return;
 // 管理タブを開くたびに全員（600人以上）を読み込むと重いので、「メンバー管理（BAN）」を開いたときだけ読む
 // 表示は名前・ログインIDで探せるようにし、一度に出すのは BAN 中の人＋50人まで
 const panel=document.getElementById('km-ban-panel');
 const search=document.createElement('input');search.type='search';search.id='km-ban-search';search.placeholder='名前・ログインIDで探す';search.setAttribute('aria-label','メンバーを名前・ログインIDで探す');search.style.cssText='width:100%;margin-top:10px';
 load.after(search);
 let members=[],shown=50,loadedAt=0;
 async function kmLoadBanMembers(){
  if(typeof client==='undefined'||!client)return;
  if(!members.length)list.textContent='読み込み中…';
  const {data,error}=await client.rpc('kimetomo_admin_members');
  if(error){list.textContent='メンバー一覧を取得できません: '+safeError(error);return}
  const latest=data?.length?await window.kmDisplayNames(data.map(m=>m.user_id)):new Map();
  for(const m of data||[])m.display_name=latest.get(m.user_id)||m.display_name;
  members=data||[];loadedAt=Date.now();
  const bc=document.getElementById('km-ban-count');if(bc){const banned=members.filter(m=>m.banned).length;bc.textContent=members.length+'人'+(banned?'・BAN中 '+banned+'人':'')}
  paint();
 }
 function paint(){
  list.replaceChildren();
  if(!members.length){list.textContent='メンバーがいません。';return}
  const q=search.value.trim().toLowerCase();
  const hit=q?members.filter(m=>(m.display_name||'').toLowerCase().includes(q)||(m.login_id||'').toLowerCase().includes(q)):members;
  // BAN 中の人はいつも上に出す
  const sorted=[...hit.filter(m=>m.banned),...hit.filter(m=>!m.banned)];
  const view=sorted.slice(0,Math.max(shown,sorted.filter(m=>m.banned).length));
  if(!view.length){list.textContent='見つかりません。';return}
  for(const m of view){
   const card=document.createElement('div');card.className='person';
   const name=document.createElement('div');name.className='name';name.textContent=(m.display_name||'名前なし')+(m.is_admin?'（管理者）':'')+(m.banned?'　🚫 BAN中':'');
   card.append(name);
   if(m.login_id){const li=document.createElement('div');li.className='small';li.textContent='ログインID：'+m.login_id;card.append(li)}
   if(m.banned&&m.reason){const r=document.createElement('div');r.className='small';r.textContent='理由: '+m.reason;card.append(r)}
   if(!m.is_admin){
    const b=document.createElement('button');b.type='button';
    if(m.banned){
     b.className='ghost';b.textContent='BANを解除する';
     b.onclick=async()=>{if(!confirm((m.display_name||'このメンバー')+'さんのBANを解除しますか？'))return;b.disabled=true;const {error:e}=await client.rpc('kimetomo_admin_unban',{p_user:m.user_id});if(e){alert('解除できませんでした: '+safeError(e));b.disabled=false;return}kmLoadBanMembers()};
    }else{
     b.className='danger';b.textContent='BANする';
     b.onclick=async()=>{const reason=prompt((m.display_name||'このメンバー')+'さんをBANします。\n理由を入力してください（空でもOK）','');if(reason===null)return;if(!confirm('本当にBANしますか？'))return;b.disabled=true;const {error:e}=await client.rpc('kimetomo_admin_ban',{p_user:m.user_id,p_reason:reason});if(e){alert('BANできませんでした: '+safeError(e));b.disabled=false;return}kmLoadBanMembers()};
    }
    b.style.marginTop='8px';card.append(b);
   }
   list.append(card);
  }
  if(sorted.length>view.length){const more=document.createElement('button');more.type='button';more.className='ghost full';more.style.marginTop='10px';more.textContent='もっと見る（残り '+(sorted.length-view.length)+'人）';more.onclick=()=>{shown+=50;paint()};list.append(more)}
 }
 let typing=null;
 search.addEventListener('input',()=>{clearTimeout(typing);typing=setTimeout(()=>{shown=50;paint()},200)});
 load.addEventListener('click',kmLoadBanMembers);
 // 開いたとき：初めて、または 5 分以上たっていたら読み直す
 panel?.addEventListener('toggle',()=>{if(panel.open&&(!members.length||Date.now()-loadedAt>300e3))kmLoadBanMembers()});
 // 管理タブを開いたときは、この欄を開いているときだけ読み直す
 document.querySelectorAll('.km-bottom-nav [data-km-go="admin"]').forEach(x=>x.addEventListener('click',()=>{if(panel?.open&&!document.getElementById('admin').classList.contains('hide'))kmLoadBanMembers()}));
 window.kmLoadBanMembers=kmLoadBanMembers;
})();
