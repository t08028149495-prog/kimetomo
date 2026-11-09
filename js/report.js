/* 🚩 通報（メンバー → 運営）。仕組みは supabase/reports.sql
   ・投稿・コメント・DM・グループチャットのメッセージ・メンバーのプロフィールから使う
   ・相手には知らされない。送ったあと、人に関わる通報ならブロックもすすめる
   ・index.html と dm.html の両方で読み込む（Supabase は client か window.kmDb。dm.html は自分の id を opt.selfId で渡す） */
(function(){
 const sb=()=>typeof client!=='undefined'&&client?client:(window.kmDb||null);
 const err=e=>typeof safeError==='function'?safeError(e):(e?.message||String(e));
 const mk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
 const REASONS=[
  ['sexual','頼んでいない性的なメッセージ・画像'],
  ['harass','しつこい誘い・つきまとい'],
  ['abuse','悪口・いやがらせ'],
  ['minor','未成年かもしれない'],
  ['illegal','違法なこと'],
  ['spam','宣伝・スパム・なりすまし'],
  ['other','その他']
 ];
 window.kmReportReasons=REASONS;
 const WHAT={post:'この投稿',comment:'このコメント',dm:'このメッセージ',chat:'このメッセージ',user:'このメンバー'};

 // 通報の画面を開く。opt = {kind, id, userId, who}
 window.kmReport=opt=>{
  // 自分の id：index.html は current、dm.html は opt.selfId
  const selfId=opt.selfId||(typeof current!=='undefined'&&current?current.id:null);
  document.querySelector('.km-report-overlay')?.remove();
  const ov=mk('div','km-report-overlay');ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','通報する');
  const card=mk('div','km-report-card');
  card.append(mk('h3',null,'🚩 '+(WHAT[opt.kind]||'これ')+'を通報'));
  card.append(mk('p','km-report-lead','運営（管理者）にだけ届きます。'+(opt.who?opt.who+'さん':'相手')+'には知らされません。'));
  const list=mk('div','km-report-reasons');
  REASONS.forEach(([v,label])=>{const l=mk('label','km-report-reason');const r=document.createElement('input');r.type='radio';r.name='km-report-reason';r.value=v;l.append(r,document.createTextNode(label));list.append(l)});
  const note=document.createElement('textarea');note.className='km-report-note';note.maxLength=300;note.rows=3;note.placeholder='くわしく（なくてもOK・300文字まで）';
  const msg=mk('p','km-report-msg');msg.setAttribute('role','status');
  const row=mk('div','km-report-actions');
  const cancel=mk('button','ghost','やめる');cancel.type='button';
  const send=mk('button','danger','運営に送る');send.type='button';
  row.append(cancel,send);
  card.append(list,note,msg,row);ov.append(card);document.body.append(ov);
  const close=()=>{ov.remove();document.removeEventListener('keydown',onKey)};
  const onKey=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',onKey);
  ov.addEventListener('click',e=>{if(e.target===ov)close()});
  cancel.onclick=close;
  send.onclick=async()=>{
   const reason=list.querySelector('input:checked')?.value;
   if(!reason){msg.textContent='理由を1つ選んでください';return}
   const c=sb();if(!c){msg.textContent='いまは送れません。ページを開き直してください';return}
   send.disabled=true;msg.textContent='送っています…';
   const {error}=await c.rpc('kimetomo_report',{p_kind:opt.kind,p_target:opt.id,p_reason:reason,p_note:note.value.trim()||null});
   if(error){send.disabled=false;msg.textContent='送れませんでした：'+err(error);return}
   // 送れた：お礼と、ブロックのすすめ
   card.replaceChildren(mk('h3',null,'✅ 運営に送りました'),mk('p','km-report-lead','教えてくれてありがとうございます。運営が確認したら、ベルでお知らせします。'+(opt.who?opt.who+'さん':'相手')+'には知らされません。'));
   const done=mk('div','km-report-actions');
   const ok=mk('button','ghost','閉じる');ok.type='button';ok.onclick=close;
   const blocked=typeof kmBlocked!=='undefined'&&kmBlocked?.has?.(opt.userId);
   if(opt.userId&&selfId&&opt.userId!==selfId&&!blocked){
    card.append(mk('p','small','もう関わりたくないときは、ブロックすると、この人の投稿・コメント・チャットが見えなくなり、通知も届かなくなります。'));
    const b=mk('button','danger','🚫 ブロックもする');b.type='button';
    b.onclick=async()=>{b.disabled=true;window.kmDC?.mine.forget('blocks');const r=await c.from('user_blocks').insert({blocker_id:selfId,blocked_id:opt.userId});
     if(r.error&&r.error.code!=='23505'){b.disabled=false;b.textContent='ブロックできませんでした';return}
     b.textContent='🚫 ブロックしました';
     try{if(typeof kmLoadBlocks==='function'){await kmLoadBlocks();if(typeof loadTimeline==='function')loadTimeline();if(typeof loadChat==='function')loadChat()}}catch{}
     window.kmAfterReportBlock?.(opt.userId)};
    done.append(ok,b);
   }else done.append(ok);
   card.append(done);
  };
 };
 // 小さな「🚩 通報」ボタン
 window.kmReportButton=(opt,cls)=>{
  const b=mk('button','ghost km-report-btn'+(cls?' '+cls:''),'🚩 通報');b.type='button';b.title=(WHAT[opt.kind]||'これ')+'を運営に通報する';
  b.onclick=e=>{e.stopPropagation();window.kmReport(typeof opt==='function'?opt():opt)};return b;
 };

 // ========== 管理者：届いた通報（管理者メニュー「🚩 通報」） ==========
 const afold=document.getElementById('km-report-fold'),alist=document.getElementById('km-report-list'),astate=document.getElementById('km-report-state');
 if(!afold)return;
 const KIND={post:'投稿',comment:'コメント',dm:'DM',chat:'グループチャット',user:'プロフィール'};
 const LABEL=Object.fromEntries(REASONS);
 const ago=v=>window.kmTimeAgo?window.kmTimeAgo(v):new Date(v).toLocaleString('ja-JP');
 async function goPost(id){
  if(!id)return;
  kmPendingPostId=id;document.querySelector('.km-bottom-nav [data-km-go="timeline"]')?.click();
  await loadTimeline();kmTryFocusPost();
  if(kmPendingPostId===id){kmPendingPostId=null;alert('この投稿はタイムラインにありません（消されたか、古い投稿です）')}
 }
 async function load(){
  const c=sb();if(!c)return;
  alist.textContent='読み込み中…';
  const {data,error}=await c.rpc('kimetomo_admin_reports');
  if(error){alist.textContent='読み込めません（supabase/reports.sql を実行してください）: '+err(error);return}
  alist.replaceChildren();
  const open=(data||[]).filter(r=>r.status==='new').length;
  astate.textContent=open?'未対応 '+open+'件':'未対応なし';
  if(!data?.length){alist.append(mk('p','small','まだ通報はありません。'));return}
  for(const r of data){
   const it=mk('div','km-report-item'+(r.status==='new'?' new':''));
   const head=mk('div','km-report-head');
   head.append(mk('span','km-report-st '+r.status,r.status==='new'?'🆕 未対応':r.status==='done'?'✅ 対応した':'🙆 問題なし'),mk('span','small',KIND[r.kind]+'・'+ago(r.created_at)));
   it.append(head);
   it.append(mk('div','km-report-line','理由：'+(LABEL[r.reason]||r.reason)));
   const who=mk('div','km-report-line','通報された人：'+r.target_name+' さん');
   if(Number(r.target_total)>1)who.append(mk('b','km-report-many','（通報 合計'+r.target_total+'件）'));
   it.append(who);
   if(r.snapshot)it.append(mk('div','km-report-snap',r.snapshot));
   if(r.note)it.append(mk('div','km-report-note-view','くわしく：'+r.note));
   const by=mk('div','small','通報した人：'+r.reporter_name+' さん（相手には知らされていません）');
   if(Number(r.reporter_dismissed)>0)by.append(mk('b','km-report-many','（この人の通報で「問題なし」'+r.reporter_dismissed+'件）'));
   if(r.quiet)by.append(mk('span','',' 🔕 ベルなし'));
   it.append(by);
   const acts=mk('div','km-report-actions');
   if(r.post_id){const g=mk('button','ghost','📄 投稿を見る');g.type='button';g.onclick=()=>goPost(r.post_id);acts.append(g)}
   if(r.target_user&&typeof kmOpenMemberProfile==='function'){const p=mk('button','ghost','👤 プロフィール');p.type='button';p.onclick=async()=>{const adm=await kimetomoFetchAdmins(c);kmOpenMemberProfile(r.target_user,{name:r.target_name},adm.has(r.target_user))};acts.append(p)}
   const set=(st,label,cls)=>{const b=mk('button',cls,label);b.type='button';b.onclick=async()=>{b.disabled=true;const {error:e}=await c.rpc('kimetomo_admin_handle_report',{p_id:r.id,p_status:st});if(e){alert('保存できません: '+err(e));b.disabled=false;return}load();window.kmLoadAdminTodo?.()};return b};
   if(r.status==='new')acts.append(set('done','✅ 対応した',''),set('dismissed','🙆 問題なし','ghost'));
   else acts.append(set('new','↩︎ 未対応に戻す','ghost'));
   it.append(acts);alist.append(it);
  }
 }
 window.kmLoadReports=load;
 afold.addEventListener('toggle',()=>{if(afold.open)load()});
})();
