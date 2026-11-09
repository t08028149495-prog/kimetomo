/* 🌷 女性だけの部屋（申請制のグループチャット）
   ・グループの画面：♀の人に「参加の申請」カード。部屋の中では注意書きと「あやしい人を知らせる」
   ・管理者メニュー（見守り）：申請の許可・見送り／知らせの確認／部屋から外す
   仕組みとチェックは supabase/women_room.sql */
(function(){
 const $=id=>document.getElementById(id);
 const box=$('km-wroom'),afold=$('km-wroom-fold');
 const mk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
 const btn=(text,cls,fn)=>{const b=mk('button',cls,text);b.type='button';b.onclick=fn;return b};
 const err=e=>typeof safeError==='function'?safeError(e):(e?.message||String(e));
 const ready=()=>typeof client!=='undefined'&&client&&typeof current!=='undefined'&&current;
 const day=v=>v?new Date(v).toLocaleDateString('ja-JP'):'—';
 let st=null,stAt=0,busy=false,reloadAt=0;
 // 🌷 女性トークルーム専用の招待リンク（?wroom=）を覚えておく。ログインしたら「参加する」カードを出す
 const WKEY='km-wroom-code';
 try{const v=new URLSearchParams(location.search).get('wroom');if(v&&/^[0-9a-f]{12}$/i.test(v))localStorage.setItem(WKEY,v.toLowerCase())}catch{}
 const wcode=()=>{try{return localStorage.getItem(WKEY)||''}catch{return ''}};
 const wclear=()=>{try{localStorage.removeItem(WKEY)}catch{}};

 // ---------- メンバー側（グループの画面） ----------
 async function refresh(force){
  if(!box||!ready()||busy)return;
  if(!force&&st&&Date.now()-stAt<60000){paint();return}
  busy=true;
  try{const {data,error}=await client.rpc('kimetomo_women_room_status');st=error?null:data;stAt=Date.now()
   // 部屋の固定メッセージ（部屋のメンバーだけが読める）
   if(st?.member){const n=await client.from('circle_rooms').select('pinned_note').eq('id',st.room_id).maybeSingle();st.note=n.error?'':(n.data?.pinned_note||'');wclear()}
   else if(st&&wcode()){const v=await client.rpc('kimetomo_wroom_invite_status',{p_code:wcode()});st.inv=v.error?null:v.data}}
  finally{busy=false}
  paint();
 }
 let painted=null;
 function paint(){
  $('km-women-only-row')?.classList.toggle('hide',!st?.member);$('km-anon-row')?.classList.toggle('hide',!st?.member);
  window.kmWomenMember=!!st?.member;if(typeof kmPaintImagePicker==='function')kmPaintImagePicker();
  // 🔰 見習い期間（入ってから7日）は、部屋の写真を送れない・見られない（supabase/women_room_probation.sql）
  window.kmWomenProbation=st?.member?(st.probation_left||0):0;if(typeof kmPaintChatPhoto==='function')kmPaintChatPhoto();
  if(!box)return;box.replaceChildren();
  const room=String($('chat-room')?.value||'');painted=room;
  if(!st){box.classList.add('hide');return}
  if(st.member){
   if(room!==String(st.room_id)){
    // 別の部屋を見ているとき：開くボタンを出す。部屋の一覧が古い（あとから参加した）ときは読み直す
    const sel=$('chat-room'),has=sel&&[...sel.options].some(o=>o.value===String(st.room_id));
    if(!has){box.classList.add('hide');if(Date.now()-reloadAt>30000&&typeof loadRooms==='function'){reloadAt=Date.now();window.kmDC?.del('rooms-'+current.id);loadRooms()}return}
    box.className='km-wroom-card mini';
    box.append(btn('🌷 女性だけの部屋を開く','ghost km-wroom-open',()=>{sel.value=String(st.room_id);sel.dispatchEvent(new Event('change'))}));
    return;
   }
   box.className='km-wroom-card inside';
   const note=(st.note||'').trim();
   if(note){
    // 📌 固定メッセージ：1行目だけ見せて、押すと全部開く（コンパクトに）
    const lines=note.split('\n'),d=mk('details','km-wroom-pin');d.append(mk('summary','',(lines[0].startsWith('📌')?'':'📌 ')+lines[0]));
    if(lines.length>1)d.append(mk('div','km-wroom-pin-body',lines.slice(1).join('\n')));
    box.append(d);
   }else box.append(mk('p','km-wroom-title','🌷 女性だけの部屋'),
    mk('p','small','管理者かAIが確認した人だけが参加しています。でも、ネットでは相手が本当に女性かを100%確かめることはできません。本名・住所・顔写真・連絡先は、ここでも書かないようにしてね。'));
   if(st.probation_left>0)box.append(mk('p','km-wroom-state','🔰 見習い期間です（あと'+st.probation_left+'日）。そのあいだは、この部屋の写真を送ったり見たりできません。おしゃべりはできます。'));
   const acts=mk('div','km-wroom-acts');acts.append(btn('🚩 あやしい人を管理者に知らせる','ghost km-wroom-report-open',openReport));
   if(window.kmIsAdmin)acts.append(btn('✏️ 固定メッセージ','ghost km-wroom-note-edit',openNoteEditor));
   box.append(acts);
   return;
  }
  if(wcode()&&st.inv){inviteCard();return}
  if(st.admin){
   box.className='km-wroom-card';
   const out=mk('p','small');
   const join=btn('👑 管理者として参加する','full',async()=>{
    join.disabled=true;out.textContent='参加しています…';
    const {data,error}=await client.rpc('kimetomo_admin_join_women_room');
    if(error){out.textContent='参加できませんでした：'+err(error);join.disabled=false;return}
    window.kmChatTargetRoom=String(data);if(typeof loadRooms==='function')await loadRooms();
    await refresh(true);
   });
   box.append(mk('p','km-wroom-title','🌷 女性だけの部屋'),
    mk('p','small','管理者は、申請や条件なしで参加できます。部屋の中では、名前の横に👑が出るので、管理者だと分かります。'),join,out);
   return;
  }
  if(!st.female){box.classList.add('hide');return}
  box.className='km-wroom-card';
  box.append(mk('p','km-wroom-title','🌷 女性だけの部屋'),
   mk('p','small','女性だけでおしゃべりできるグループチャットです。なりすましを防ぐため、管理者かAIが確認した人だけが参加できます。'));
  // 📷 AIで確認して入る欄（js/women-room-ai.js）。男性や見送られた人には何も出ない
  const ai=()=>{if(typeof window.kmWroomAi==='function')box.append(window.kmWroomAi(()=>refresh(true)))};
  if(st.request==='pending'){box.append(mk('p','km-wroom-state','⏳ 申請しました。管理者の確認をお待ちください。結果はベルでお知らせします。'));ai();return}
  if(st.request==='rejected'){box.append(mk('p','km-wroom-state','今回は参加を見送らせていただきました。'));return}
  const conds=[
   [st.days_left===0,'登録から'+(st.days_need??14)+'日以上',st.days_left?'あと'+st.days_left+'日':''],
   [st.acts>=st.acts_need,st.acts_need>1?'投稿・コメントが合わせて'+st.acts_need+'回以上':'投稿かコメントを1回以上','いま'+st.acts+'回'],
   [st.gender_days_left===0,'性別を♀にしてから'+(st.gender_days_need??7)+'日以上',st.gender_days_left?'あと'+st.gender_days_left+'日':'']
  ];
  const ul=mk('ul','km-wroom-conds');
  for(const [ok,label,note] of conds)ul.append(mk('li',ok?'ok':'',(ok?'✅ ':'⬜ ')+label+(ok||!note?'':'（'+note+'）')));
  box.append(mk('p','small','申請できる条件'),ul);
  const allOk=conds.every(c=>c[0]);
  const msg=mk('textarea');msg.maxLength=200;msg.rows=2;msg.placeholder='ひとこと（なくてもOK・管理者だけが読みます）';
  const out=mk('p','small');
  const send=btn('参加を申請する','full',async()=>{
   send.disabled=true;out.textContent='送っています…';
   const {error}=await client.rpc('kimetomo_women_room_apply',{p_message:msg.value});
   if(error){out.textContent='申請できませんでした：'+err(error);send.disabled=false;return}
   await refresh(true);
  });
  send.disabled=!allOk;
  if(allOk)box.append(msg);
  box.append(send,out);
  ai();
 }
 // 招待リンクから来た人：「参加する」カード
 function inviteCard(){
  box.className='km-wroom-card';
  box.append(mk('p','km-wroom-title','🌷 女性トークルームへの招待が届いています'));
  if(st.inv!=='ok'){box.append(mk('p','small',st.inv==='used'?'この招待リンクは、もう使われています。':st.inv==='bad'?'招待リンクが見つかりません。':'この招待リンクは期限切れです。管理者に新しいリンクをもらってください。'),btn('閉じる','ghost',()=>{wclear();paint()}));return}
  if(!st.female)box.append(mk('p','small','参加するには、プロフィールの性別を「♀」にして保存してください。保存したら、もう一度この画面を開いてね。'),btn('プロフィールを開く','ghost',()=>document.querySelector('.km-bottom-nav [data-km-go="profile"]')?.click()));
  else box.append(mk('p','small','管理者からの招待です。下のボタンを押すと、すぐに参加できます。'));
  const out=mk('p','small');
  const join=btn('🌷 参加する','full',async()=>{join.disabled=true;out.textContent='参加しています…';
   const {data,error}=await client.rpc('kimetomo_wroom_redeem',{p_code:wcode()});
   if(error){out.textContent='参加できませんでした：'+err(error);join.disabled=false;return}
   wclear();window.kmChatTargetRoom=String(data);if(typeof loadRooms==='function')await loadRooms();await refresh(true)});
  join.disabled=!st.female;box.append(join,out);
 }
 // 管理者：固定メッセージを書く・直す（空にして保存すると消える）
 function openNoteEditor(){
  if(box.querySelector('.km-wroom-note-form'))return;
  const wrap=mk('div','km-wroom-report km-wroom-note-form');
  const ta=mk('textarea');ta.maxLength=800;ta.rows=8;ta.value=st?.note||'';ta.placeholder='1行目が見出しになります（押すと全部開きます）。空にして保存すると消えます';
  const out=mk('p','small');
  const save=btn('保存する','',async()=>{save.disabled=true;out.textContent='保存しています…';
   const {error}=await client.rpc('kimetomo_admin_set_women_room_note',{p_note:ta.value});
   if(error){out.textContent='保存できませんでした：'+err(error);save.disabled=false;return}
   st.note=ta.value.trim();paint()});
  const row=mk('div','km-bug-actions');row.append(btn('やめる','ghost',()=>wrap.remove()),save);
  wrap.append(mk('label','small','📌 固定メッセージ（部屋のメンバーだけが見られます）'),ta,row,out);box.append(wrap);ta.focus();
 }
 async function openReport(){
  if(box.querySelector('.km-wroom-report'))return;
  const wrap=mk('div','km-wroom-report');
  const who=mk('select');who.append(new Option('読み込み中…',''));
  const why=mk('textarea');why.maxLength=300;why.rows=3;why.placeholder='どんなところが気になりましたか？（管理者だけが読みます。相手には分かりません）';
  const out=mk('p','small');
  const send=btn('管理者に知らせる','',async()=>{
   if(!who.value){out.textContent='知らせたい人を選んでください';return}
   if(!why.value.trim()){out.textContent='気になったことを書いてください';return}
   send.disabled=true;out.textContent='送っています…';
   const {error}=await client.rpc('kimetomo_room_report',{p_target:who.value,p_reason:why.value});
   if(error){out.textContent='送れませんでした：'+err(error);send.disabled=false;return}
   wrap.replaceChildren(mk('p','small','✅ 管理者に知らせました。ありがとうございます。'));
  });
  wrap.append(mk('label','small','気になる人'),who,why,mk('div','km-bug-actions'),out);
  wrap.querySelector('.km-bug-actions').append(btn('やめる','ghost',()=>wrap.remove()),send);
  box.append(wrap);
  const {data:mem}=await client.from('circle_room_members').select('user_id').eq('room_id',st.room_id);
  const ids=(mem||[]).map(m=>m.user_id).filter(id=>id!==current.id);
  const {data:pr}=ids.length?await client.from('kimetomo_user_profiles').select('user_id,display_name').in('user_id',ids):{data:[]};
  const names=new Map((pr||[]).map(p=>[p.user_id,p.display_name||'メンバー']));
  who.replaceChildren(new Option('選んでください',''));
  for(const id of ids.sort((a,b)=>(names.get(a)||'').localeCompare(names.get(b)||'','ja')))who.append(new Option(names.get(id)||'メンバー',id));
 }
 if(box){
  $('chat-room')?.addEventListener('change',()=>refresh(false));
  const sel=$('chat-room');if(sel)new MutationObserver(()=>refresh(false)).observe(sel,{childList:true});
  // グループの画面を開いたとき：1分以内に確かめていれば、覚えている状態を使う（起動時に何度も聞かないため）
  const chat=$('chat');if(chat)new MutationObserver(()=>{if(!chat.classList.contains('hide'))refresh(false)}).observe(chat,{attributes:true,attributeFilter:['class']});
  document.querySelector('.km-bottom-nav [data-km-go="chat"]')?.addEventListener('click',()=>refresh(false));
  // ほかの画面（安心の設定など）からも、覚えている状態を使えるようにする
  window.kmWroomStatus=async()=>{if(st&&Date.now()-stAt<60000)return st;const {data,error}=await client.rpc('kimetomo_women_room_status');return error?null:data};
  $('km-women-only')?.addEventListener('change',()=>{if(typeof kmPaintImagePicker==='function')kmPaintImagePicker()});
  // ログインしたら一度読み込む（投稿欄の「女性だけに見せる」を出すため）
  (function wait(n){if(ready()){refresh(true).then(()=>{
   // 招待リンクから来たら、一度だけグループの画面を開いてカードを見せる
   try{if(wcode()&&st&&!st.member&&st.inv==='ok'&&sessionStorage.getItem('km-wroom-nudged')!==wcode()){sessionStorage.setItem('km-wroom-nudged',wcode());document.querySelector('.km-bottom-nav [data-km-go="chat"]')?.click()}}catch{}
  });return}if(n<60)setTimeout(()=>wait(n+1),1000)})(0);
  // 部屋が切り替わると、チャットの中身が入れ替わる（自動で新着の部屋を開いたときも）
  const feed=$('chat-feed');if(feed)new MutationObserver(()=>{const room=String($('chat-room')?.value||'');if(st&&room!==painted)paint()}).observe(feed,{childList:true});
 }

 // ---------- 管理者側 ----------
 const LBL={pending:'🆕 申請中',approved:'✅ 許可済み',rejected:'🙅 見送り',open:'🆕 未対応',done:'✔ 対応済み'};
 async function loadAdmin(){
  if(!afold||!ready())return;
  const list=$('km-wroom-list'),state=$('km-wroom-state');list.textContent='読み込み中…';
  const [rq,rp,mb]=await Promise.all([client.rpc('kimetomo_admin_room_requests'),client.rpc('kimetomo_admin_room_reports'),client.rpc('kimetomo_admin_women_room_members')]);
  if(rq.error){list.textContent='読み込めません（women_room.sql を実行してください）：'+err(rq.error);return}
  list.replaceChildren();
  const pend=(rq.data||[]).filter(r=>r.status==='pending'),open=(rp.data||[]).filter(r=>r.status==='open');
  state.textContent=(pend.length||open.length)?'申請 '+pend.length+'件・知らせ '+open.length+'件':'対応が必要なことはありません';
  const act=async(fn,args,b,ask)=>{if(ask&&!confirm(ask))return;b.disabled=true;const {error}=await client.rpc(fn,args);if(error){alert('できませんでした：'+err(error));b.disabled=false;return}loadAdmin()};
  list.append(mk('h4','km-wroom-h','参加の申請'));
  if(!rq.data?.length)list.append(mk('p','small','申請はまだありません。'));
  for(const r of rq.data||[]){
   const it=mk('div','km-bug-item');const head=mk('div');head.append(mk('span','km-bug-st '+(r.status==='pending'?'new':'closed'),LBL[r.status]||r.status),mk('span','small',' '+r.name+' さん'));
   it.append(head,mk('div','small','性別：'+(r.gender==='female'?'♀':r.gender==='male'?'♂':'未設定')+'（変えた日 '+day(r.gender_changed_at)+'）・登録 '+day(r.joined_at)+'・投稿 '+r.posts+'・コメント '+r.comments));
   if(r.message)it.append(mk('div','km-bug-body','ひとこと：'+r.message));
   if(r.status==='pending'){const a=mk('div','km-bug-actions');
    const prof=btn('プロフィールを見る','ghost',()=>typeof kmOpenMemberProfile==='function'&&kmOpenMemberProfile(r.user_id,{name:r.name},false));
    const ok=btn('✅ 許可する','',()=>act('kimetomo_admin_decide_room_request',{p_id:r.id,p_approve:true},ok,r.name+' さんの参加を許可しますか？'));
    const ng=btn('🙅 見送る','ghost',()=>act('kimetomo_admin_decide_room_request',{p_id:r.id,p_approve:false},ng,r.name+' さんの参加を見送りますか？（もう一度は申請できなくなります）'));
    a.append(prof,ok,ng);it.append(a)}
   list.append(it);
  }
  list.append(mk('h4','km-wroom-h','部屋からの知らせ'));
  if(!rp.data?.length)list.append(mk('p','small','知らせはまだありません。'));
  for(const r of rp.data||[]){
   const it=mk('div','km-bug-item');const head=mk('div');head.append(mk('span','km-bug-st '+(r.status==='open'?'new':'closed'),LBL[r.status]||r.status),mk('span','small',' '+r.target_name+' さんについて（'+r.reporter_name+' さんより・'+day(r.created_at)+'）'));
   it.append(head,mk('div','km-bug-body',r.reason));
   if(r.status==='open'){const a=mk('div','km-bug-actions');
    const prof=btn('プロフィールを見る','ghost',()=>typeof kmOpenMemberProfile==='function'&&kmOpenMemberProfile(r.target_id,{name:r.target_name},false));
    a.append(prof);
    if(r.target_in_room){const kick=btn('🚪 部屋から外す','danger',()=>act('kimetomo_admin_room_kick',{p_user:r.target_id},kick,r.target_name+' さんを部屋から外しますか？（もう一度は申請できなくなります）'));a.append(kick)}
    const done=btn('✔ 対応済みにする','ghost',()=>act('kimetomo_admin_room_report_done',{p_id:r.id},done));a.append(done);
    it.append(a)}
   list.append(it);
  }
  const md=mk('details','km-wroom-members');md.append(mk('summary','small','いまのメンバー（'+(mb.data||[]).length+'人）'));
  for(const m of mb.data||[]){const row=mk('div','km-wroom-member');row.append(mk('span','',m.name+(m.gender==='female'?' ♀':'')));
   const kick=btn('外す','ghost',()=>act('kimetomo_admin_room_kick',{p_user:m.user_id},kick,m.name+' さんを部屋から外しますか？（もう一度は申請できなくなります）'));row.append(kick);md.append(row)}
  list.append(md);
  // ➕ 管理者だけ：条件なしで追加する（性別が♀の人だけ）
  const addBox=mk('div','km-wroom-add');
  addBox.append(mk('h4','km-wroom-h','➕ 条件なしで追加する'),mk('p','small','名前で探して、そのまま追加できます（登録日数などの条件はなし）。プロフィールの性別が♀の人だけ追加できます。'));
  const q=mk('input');q.type='search';q.placeholder='名前の一部を入力';q.setAttribute('aria-label','追加したい人の名前');
  const res=mk('div'),out=mk('p','small');let tm=null;
  async function search(){
   const v=q.value.trim();res.replaceChildren();out.textContent='';if(!v)return;
   const {data,error}=await client.rpc('kimetomo_admin_women_candidates',{p_q:v});
   if(error){out.textContent='探せませんでした：'+err(error);return}
   if(!data?.length){res.append(mk('p','small','見つかりませんでした'));return}
   for(const m of data){
    const row=mk('div','km-wroom-member');row.append(mk('span','',m.name+(m.gender==='female'?' ♀':m.gender==='male'?' ♂':'（性別なし）')));
    if(m.in_room)row.append(mk('span','small','参加中'));
    else if(m.gender!=='female')row.append(mk('span','small','♀でないため追加できません'));
    else{const add=btn('追加する','',async()=>{if(!confirm(m.name+' さんを女性だけの部屋に追加しますか？'))return;add.disabled=true;
     const {error:e}=await client.rpc('kimetomo_admin_add_to_women_room',{p_user:m.user_id});
     if(e){alert('追加できませんでした：'+err(e));add.disabled=false;return}loadAdmin()});row.append(add)}
    res.append(row);
   }
  }
  q.oninput=()=>{clearTimeout(tm);tm=setTimeout(search,350)};
  addBox.append(q,res,out);list.prepend(addBox);
 }
 afold?.addEventListener('toggle',()=>{if(afold.open)loadAdmin()});
})();
