
/* 機能リクエスト（匿名） */
(function(){
 const list=document.getElementById('km-req-list'),send=document.getElementById('km-req-send'),status=document.getElementById('km-req-status');
 if(!list)return;
 const LABELS={new:'🆕 新着',thinking:'🤔 検討中',making:'🛠 作成中',done:'✅ 完成',declined:'🙏 見送り'};
 let isAdmin=false;
 async function load(){
  if(typeof client==='undefined'||!client||!current)return;
  isAdmin=!document.getElementById('admin').classList.contains('hide');
  // 受付中かお休みかを確かめる（設定がなければ受付中）
  const {data:st}=await client.from('kimetomo_app_settings').select('value').eq('key','requests_open').maybeSingle();
  const open=!st||st.value==='true';
  document.getElementById('km-req-form').classList.toggle('hide',!open);
  document.getElementById('km-req-closed').classList.toggle('hide',open);
  const tw=document.getElementById('km-req-admin-toggle'),tb=document.getElementById('km-req-toggle');
  tw.classList.toggle('hide',!isAdmin);
  tb.textContent=open?'👑 受付をお休みにする':'👑 受付を再開する';
  tb.onclick=async()=>{if(!confirm(open?'機能リクエストの受付をお休みにしますか？':'機能リクエストの受付を再開しますか？'))return;tb.disabled=true;const {error:e}=await client.rpc('kimetomo_admin_set_setting',{p_key:'requests_open',p_value:open?'false':'true'});tb.disabled=false;if(e){status.textContent='切り替えできません: '+safeError(e);return}status.textContent=open?'受付をお休みにしました':'受付を再開しました';load()};
  const {data,error}=await client.rpc('kimetomo_list_requests');
  if(error){list.textContent='リクエストを読み込めません（SQLが未実行の可能性があります）';return}
  list.replaceChildren();
  {const sm=document.getElementById('km-req-summary');if(sm){const openN=(data||[]).filter(r=>r.status!=='done'&&r.status!=='declined').length;sm.textContent=(open?'受付中':'受付お休み中')+'・リクエスト '+(data||[]).length+'件'+(openN?'（対応中 '+openN+'件）':'')}}
  if(!data?.length){const p=document.createElement('p');p.className='small';p.textContent='まだリクエストはありません。最初のリクエストをしてみよう！';list.append(p);return}
  for(const r of data){
   const card=document.createElement('div');card.className='km-req'+(r.status==='done'||r.status==='declined'?' closed':'');
   const head=document.createElement('div');head.className='km-req-head';
   const badge=document.createElement('span');badge.className='km-req-badge s-'+r.status;badge.textContent=LABELS[r.status]||r.status;
   head.append(badge);
   if(r.is_mine){const mine=document.createElement('span');mine.className='small';mine.textContent='（自分のリクエスト）';head.append(mine)}
   const title=document.createElement('strong');title.className='km-req-title';title.textContent=r.title;
   card.append(head,title);
   if(r.body){const b=document.createElement('div');b.className='km-req-body';b.textContent=r.body;card.append(b)}
   if(r.admin_reply){const a=document.createElement('div');a.className='km-req-reply';a.textContent='👑 管理者より：'+r.admin_reply;card.append(a)}
   const row=document.createElement('div');row.className='km-req-actions';
   for(const [val,label,count] of [[1,'👍 ほしい',r.ups??r.votes??0],[-1,'🤔 いらないかも',r.downs??0]]){
    const vb=document.createElement('button');vb.type='button';vb.className='ghost'+(r.my_vote===val||(val===1&&r.my_vote===true)?' km-react-selected':'');vb.textContent=label+' '+count;
    vb.onclick=async()=>{vb.disabled=true;const {error:e}=await client.rpc('kimetomo_vote_request',{p_request:r.id,p_vote:val});if(e){status.textContent='操作できません: '+safeError(e);vb.disabled=false;return}load()};
    row.append(vb);
   }
   if(r.is_mine||isAdmin){const del=document.createElement('button');del.type='button';del.className='ghost';del.textContent='削除';del.onclick=async()=>{if(!confirm('このリクエストを削除しますか？'))return;const {error:e}=await client.rpc('kimetomo_delete_request',{p_request:r.id});if(e){status.textContent='削除できません: '+safeError(e);return}load()};row.append(del)}
   card.append(row);
   if(isAdmin){
    const box=document.createElement('div');box.className='km-req-admin';
    const sel=document.createElement('select');for(const [k,v] of Object.entries(LABELS)){const o=document.createElement('option');o.value=k;o.textContent=v;sel.append(o)}sel.value=r.status;
    const reply=document.createElement('input');reply.maxLength=200;reply.placeholder='ひとことコメント（なくてもOK）';reply.value=r.admin_reply||'';
    const save=document.createElement('button');save.type='button';save.textContent='管理者として保存';
    save.onclick=async()=>{if(sel.value==='done'&&r.status!=='done'&&!confirm('「完成」にすると、リクエストした人と👍した人に通知が届きます。保存しますか？'))return;save.disabled=true;const {error:e}=await client.rpc('kimetomo_admin_update_request',{p_request:r.id,p_status:sel.value,p_reply:reply.value});save.disabled=false;if(e){status.textContent='保存できません: '+safeError(e);return}status.textContent='保存しました';load()};
    box.append(sel,reply,save);card.append(box);
   }
   list.append(card);
  }
 }
 send.onclick=async()=>{
  const t=document.getElementById('km-req-title'),b=document.getElementById('km-req-body');
  const title=t.value.trim(),body=b.value.trim();
  if(!title){status.textContent='ほしい機能を入力してください';return}
  send.disabled=true;status.textContent='送信中…';
  const {error}=await client.rpc('kimetomo_create_request',{p_title:title,p_body:body});
  send.disabled=false;
  if(error){status.textContent='送信できません: '+safeError(error);return}
  t.value='';b.value='';status.textContent='匿名でリクエストしました。ありがとう！';load();
 };
 window.kmLoadRequests=load;
 document.querySelectorAll('.km-bottom-nav [data-km-go="profile"]').forEach(x=>x.addEventListener('click',()=>setTimeout(load,300)));
 setTimeout(()=>{if(window.kmActiveTab==='profile')load();if(new URLSearchParams(location.search).get('requests')==='1'){setTimeout(()=>{load();(document.getElementById('km-req-fold')||{}).open=true;document.getElementById('requests-panel')?.scrollIntoView({behavior:'smooth',block:'start'})},1500)}},2500);
})();
