
/* 管理者だけが使える BAN（利用停止） */
(function(){
 const list=document.getElementById('km-ban-list'),load=document.getElementById('km-ban-load');
 if(!list||!load)return;
 async function kmLoadBanMembers(){
  if(typeof client==='undefined'||!client)return;
  list.textContent='読み込み中…';
  const {data,error}=await client.rpc('kimetomo_admin_members');
  if(error){list.textContent='メンバー一覧を取得できません: '+safeError(error);return}
  list.replaceChildren();
  if(!data?.length){list.textContent='メンバーがいません。';return}
  const latest=await window.kmDisplayNames(data.map(m=>m.user_id));
  const bc=document.getElementById('km-ban-count');if(bc){const banned=data.filter(m=>m.banned).length;bc.textContent=data.length+'人'+(banned?'・BAN中 '+banned+'人':'')}
  for(const m of data){
   m.display_name=latest.get(m.user_id)||m.display_name;
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
 }
 load.addEventListener('click',kmLoadBanMembers);
 document.querySelectorAll('.km-bottom-nav [data-km-go="admin"]').forEach(x=>x.addEventListener('click',()=>{if(!document.getElementById('admin').classList.contains('hide'))kmLoadBanMembers()}));
 window.kmLoadBanMembers=kmLoadBanMembers;
})();
