
/* 👑 管理者メニューの整理：4つのタブ（見守り・運営・招待・設定）と、一番上の「対応が必要なこと」 */
(function(){
 const admin=document.getElementById('admin');if(!admin)return;
 const h2=admin.querySelector(':scope > h2');if(!h2)return;
 const groups=[
  {key:'watch',label:'🛡 見守り',ids:['km-report-fold','km-flag-fold','km-bugadm-fold','km-wroom-fold','km-ban-panel','km-admin-stats']},
  {key:'ops',label:'📣 運営',ids:['km-pin-fold','km-master-fold','km-mascot-fold','km-room-fold','room-admin-tools','km-support-fold']},
  {key:'invite',label:'👥 招待',ids:['km-openinv-fold','km-wroominv-fold','km-invlog-fold']},
  {key:'settings',label:'⚙️ 設定',ids:['km-mfa-fold']}
 ];
 const KEY='km-admin-tab';
 // ここにない新しい項目は「設定」に入る
 const groupOf=el=>{for(const g of groups)if(g.ids.includes(el.id))return g.key;return 'settings'};
 const todo=document.createElement('div');todo.id='km-admin-todo';todo.className='km-admin-todo';
 const bar=document.createElement('div');bar.className='km-admin-tabs';bar.setAttribute('role','tablist');bar.setAttribute('aria-label','管理者メニューの種類');
 const buttons={};
 let current='watch';try{const s=localStorage.getItem(KEY);if(groups.some(g=>g.key===s))current=s}catch{}
 const items=()=>[...admin.children].filter(el=>el!==h2&&el!==todo&&el!==bar);
 function paint(){for(const el of items()){if(!el.dataset.kmAdminGroup)el.dataset.kmAdminGroup=groupOf(el);el.classList.toggle('km-admin-off',el.dataset.kmAdminGroup!==current)}}
 function select(key,remember){current=key;for(const g of groups){const on=g.key===key;buttons[g.key].classList.toggle('active',on);buttons[g.key].setAttribute('aria-selected',String(on))}paint();if(remember){try{localStorage.setItem(KEY,key)}catch{}}}
 for(const g of groups){const b=document.createElement('button');b.type='button';b.className='km-admin-tab';b.setAttribute('role','tab');b.textContent=g.label;b.onclick=()=>select(g.key,true);buttons[g.key]=b;bar.append(b)}
 h2.after(todo,bar);
 select(current,false);
 // あとから追加される項目にも、タブを当てはめる
 new MutationObserver(paint).observe(admin,{childList:true});

 // ほかの画面（ベルの通知など）から、管理者用の項目を開く
 window.kmOpenAdminItem=id=>{
  document.querySelector('.km-bottom-nav [data-km-go="admin"]')?.click();
  const el=document.getElementById(id);if(!el)return;
  select(el.dataset.kmAdminGroup||groupOf(el),true);
  setTimeout(()=>{if(el.tagName==='DETAILS'){if(el.open)el.dispatchEvent(new Event('toggle'));else el.open=true}el.scrollIntoView({behavior:'smooth',block:'start'})},300);
 };

 // 対応が必要なこと（0件のものは出さない）
 // 前回の結果をすぐ出す（読み込みを待たない）。新しい結果が来たら描き直す
 // 下（パソコンは左）の「管理」タブに、対応が必要な件数を赤い数字で出す（開かなくても分かる）
 const navBadge=(()=>{const btn=document.getElementById('km-nav-admin');if(!btn)return null;const b=document.createElement('span');b.className='km-nav-badge hide';btn.append(b);return b})();
 function paintTodo(list){
  if(navBadge){const n=list.reduce((a,x)=>a+(x[1]||0),0);navBadge.textContent=n>99?'99+':String(n);navBadge.classList.toggle('hide',!n)}
  todo.replaceChildren();
  const title=document.createElement('p');title.className='km-admin-todo-title';title.textContent=list.length?'🔔 対応が必要なこと':'✅ 対応が必要なことはありません';todo.append(title);
  if(list.length){const row=document.createElement('div');row.className='km-admin-todo-row';for(const [label,n,to] of list){const b=document.createElement('button');b.type='button';b.className='km-admin-todo-item';b.textContent=label+' '+n+'件';b.onclick=()=>window.kmOpenAdminItem(to);row.append(b)}todo.append(row)}
 }
 const saved=window.kmDC?.get('admin-todo',864e5);if(Array.isArray(saved))paintTodo(saved);
 let loading=false,again=false,todoAt=0;
 async function loadTodo(){
  const c=window.client;if(!c||!window.kmIsAdmin)return;if(loading){again=true;return}loading=true;again=false;todoAt=Date.now();
  try{
   const [fl,bu,wq,wr,rp]=await Promise.all([c.rpc('kimetomo_admin_flagged'),c.rpc('kimetomo_admin_bug_reports'),c.rpc('kimetomo_admin_room_requests'),c.rpc('kimetomo_admin_room_reports'),c.rpc('kimetomo_admin_reports')]);
   const day=Date.now()-864e5;
   // 一覧を開いて見た分は数えない（js/soft-filter.js が見た印を残す）
   let seen=0;try{seen=Number(localStorage.getItem('km-flag-seen')||0)}catch{}
   const list=[
    ['🚩 未対応の通報',(rp.data||[]).filter(x=>x.status==='new').length,'km-report-fold'],
    ['⚠️ まだ見ていない気になる投稿',(fl.data||[]).filter(x=>new Date(x.created_at).getTime()>day&&Number(x.id)>seen).length,'km-flag-fold'],
    ['🌷 女性だけの部屋の申請',(wq.data||[]).filter(x=>x.status==='pending').length,'km-wroom-fold'],
    ['🚩 女性だけの部屋からの知らせ',(wr.data||[]).filter(x=>x.status==='open').length,'km-wroom-fold'],
    ['🐞 未対応の不具合報告',(bu.data||[]).filter(x=>x.status==='new').length,'km-bugadm-fold']
   ].filter(x=>x[1]>0);
   paintTodo(list);
   // 次に開いたとき（アプリを開き直したときも）すぐ出せるように端末に覚えておく
   window.kmDC?.set('admin-todo',list);
  }catch(e){todo.replaceChildren();const p=document.createElement('p');p.className='small';p.textContent='対応が必要なことを読み込めませんでした';todo.append(p)}
  finally{loading=false;if(again)loadTodo()}
 }
 window.kmLoadAdminTodo=loadTodo;
 // 管理タブを開いたとき：通報などはリアルタイムで数え直しているので、1分以内に読んだばかりなら読み直さない
 document.querySelector('.km-bottom-nav [data-km-go="admin"]')?.addEventListener('click',()=>{if(Date.now()-todoAt>60e3)loadTodo()});
 // 管理者メニューが表示されたら（ログイン直後など）一度読み込む
 new MutationObserver(()=>{if(!admin.classList.contains('hide'))loadTodo()}).observe(admin,{attributes:true,attributeFilter:['class']});
 if(!admin.classList.contains('hide'))loadTodo();
})();
