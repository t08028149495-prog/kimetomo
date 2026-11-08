
/* 🐞 不具合の報告（メンバー → 運営） */
(function(){
 const fold=document.getElementById('km-bug-fold'),body=document.getElementById('km-bug-body'),send=document.getElementById('km-bug-send'),msg=document.getElementById('km-bug-msg'),mine=document.getElementById('km-bug-mine'),withInfo=document.getElementById('km-bug-withinfo');
 if(!fold)return;
 const LABEL={new:'🆕 受付',checking:'🔍 確認中',fixed:'✅ 直しました',closed:'🙏 対応しない'};
 const mk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
 const ago=v=>window.kmTimeAgo?window.kmTimeAgo(v):new Date(v).toLocaleString('ja-JP');
 function info(){
  const standalone=window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
  return ['画面: '+(window.kmActiveTab||'?'),'アドレス: '+location.host,'ホーム画面から: '+(standalone?'はい':'いいえ'),'画面の大きさ: '+innerWidth+'×'+innerHeight,'通知の許可: '+(window.Notification?Notification.permission:'なし'),'ブラウザ: '+navigator.userAgent].join('\n');
 }
 async function loadMine(){
  if(typeof client==='undefined'||!client)return;
  const {data,error}=await client.rpc('kimetomo_my_bug_reports');
  mine.replaceChildren();if(error||!data?.length)return;
  mine.append(mk('p','small','これまでに送った報告'));
  for(const r of data){const it=mk('div','km-bug-item');const head=mk('div');head.append(mk('span','km-bug-st '+r.status,LABEL[r.status]||r.status),mk('span','small',ago(r.created_at)));
   it.append(head,mk('div','km-bug-body',r.body));if(r.admin_reply)it.append(mk('div','km-bug-reply','👑 運営より：'+r.admin_reply));mine.append(it)}
 }
 send.onclick=async()=>{
  const v=body.value.trim();if(!v){msg.textContent='どんなことが起きたかを書いてください。';return}
  send.disabled=true;msg.textContent='送っています…';
  const {error}=await client.rpc('kimetomo_report_bug',{p_body:v,p_info:withInfo.checked?info():null});
  send.disabled=false;
  if(error){msg.textContent='送れませんでした: '+safeError(error);return}
  body.value='';msg.textContent='✅ 運営に送りました。ありがとうございます！返事があるとベルでお知らせします。';loadMine();
 };
 fold.addEventListener('toggle',()=>{if(fold.open)loadMine()});
 // 管理者：届いた報告
 const afold=document.getElementById('km-bugadm-fold'),alist=document.getElementById('km-bugadm-list'),astate=document.getElementById('km-bugadm-state');
 async function loadAdmin(){
  if(!afold||typeof client==='undefined'||!client)return;
  alist.textContent='読み込み中…';
  const {data,error}=await client.rpc('kimetomo_admin_bug_reports');
  if(error){alist.textContent='読み込めません（bug_reports.sql を実行してください）: '+safeError(error);return}
  alist.replaceChildren();const open=(data||[]).filter(r=>r.status==='new'||r.status==='checking').length;
  astate.textContent=open?'未対応 '+open+'件':'未対応なし';
  if(!data?.length){alist.append(mk('p','small','まだ報告はありません。'));return}
  for(const r of data){
   const it=mk('div','km-bug-item');const head=mk('div');head.append(mk('span','km-bug-st '+r.status,LABEL[r.status]||r.status),mk('span','small',r.author_name+' さん・'+ago(r.created_at)));
   it.append(head,mk('div','km-bug-body',r.body));
   if(r.info){const d=mk('details');d.append(mk('summary','small','機種・ブラウザの情報'),mk('div','km-bug-meta',r.info));d.querySelector('.km-bug-meta').style.whiteSpace='pre-wrap';it.append(d)}
   if(r.admin_reply)it.append(mk('div','km-bug-reply','返事：'+r.admin_reply));
   const acts=mk('div','km-bug-actions');
   for(const [st,label] of [['checking','🔍 確認中にする'],['fixed','✅ 直した'],['closed','🙏 対応しない']]){
    const b=mk('button',st==='fixed'?'':'ghost',label);b.type='button';
    b.onclick=async()=>{const reply=prompt('報告した人への返事（空でもOK）',r.admin_reply||(st==='fixed'?'直しました。報告ありがとうございます！':''));if(reply===null)return;
     b.disabled=true;const {error:e}=await client.rpc('kimetomo_admin_update_bug',{p_id:r.id,p_status:st,p_reply:reply});
     if(e){alert('保存できません: '+safeError(e));b.disabled=false;return}loadAdmin()};
    acts.append(b)}
   it.append(acts);alist.append(it);
  }
 }
 afold?.addEventListener('toggle',()=>{if(afold.open)loadAdmin()});
})();
