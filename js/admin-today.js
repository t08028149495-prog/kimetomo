
/* 管理者メニュー：今日の様子・恋愛マスターひろしの操作 */
(function(){
 const stats=document.getElementById('km-admin-stats');if(!stats)return;
 const st=document.getElementById('km-mascot-state'),tg=document.getElementById('km-mascot-toggle'),now=document.getElementById('km-mascot-now'),msg=document.getElementById('km-mascot-msg'),recent=document.getElementById('km-mascot-recent');
 const isAdmin=()=>!document.getElementById('admin').classList.contains('hide');
 const ago=v=>window.kmTimeAgo?window.kmTimeAgo(v):new Date(v).toLocaleString('ja-JP');
 async function loadStats(){
  if(typeof client==='undefined'||!client||!isAdmin())return;
  let data,error;
  try{({data,error}=await client.rpc('kimetomo_admin_stats'))}catch(e){error=e}
  if(error){stats.innerHTML='<p class="small">今日の様子を読み込めません（SQLが未実行の可能性があります）</p>';return}
  const d=(Array.isArray(data)?data[0]:data)||{};
  const items=[['👥','メンバー',d.members],['📝','今日の投稿',d.posts_today],['🗨️','今日のチャット',d.chats_today],['💬','今日のコメント',d.comments_today],['🎉','今週の新メンバー',d.new_members_week],['💡','未完了のリクエスト',d.open_requests]];
  stats.replaceChildren(...items.map(([i,l,v])=>{const c=document.createElement('div');c.className='km-stat';const n=document.createElement('strong');n.textContent=i+' '+(v??'—');const t=document.createElement('span');t.textContent=l;c.append(n,t);return c}));
 }
 async function loadMascot(){
  if(typeof client==='undefined'||!client||!isAdmin())return;
  const {data,error}=await client.rpc('kimetomo_admin_mascot_status');
  if(error){st.textContent='読み込めません';return}
  const d=(Array.isArray(data)?data[0]:data)||{};
  const on=d.enabled==='true';
  st.textContent=!d.has_account?'⚠️ 恋愛マスターひろしのアカウントがありません':(on?'🟢 自動投稿オン':'⚪ 自動投稿オフ')+(d.last_post_at?'・最後の投稿 '+ago(d.last_post_at):'');
  tg.textContent=on?'⏸ 自動投稿を止める':'▶️ 自動投稿を再開する';tg.dataset.on=on?'1':'';
  recent.replaceChildren();
  const list=d.recent||[];
  for(const p of list){const r=document.createElement('div');r.className='km-mascot-item';const t=document.createElement('span');t.className='small';t.textContent=ago(p.created_at);const b=document.createElement('div');b.textContent=p.body;r.append(t,b);recent.append(r)}
  if(!list.length){const e=document.createElement('p');e.className='small';e.textContent='まだ投稿はありません';recent.append(e)}
 }
 tg.onclick=async()=>{const turnOn=!tg.dataset.on;tg.disabled=true;const {error}=await client.rpc('kimetomo_admin_mascot_set',{p_enabled:turnOn});tg.disabled=false;msg.textContent=error?'変更できません: '+safeError(error):(turnOn?'自動投稿を再開しました':'自動投稿を止めました');loadMascot()};
 now.onclick=async()=>{if(!confirm('恋愛マスターひろしに今すぐ1件投稿させますか？'))return;now.disabled=true;const {data,error}=await client.rpc('kimetomo_admin_mascot_post_now');now.disabled=false;msg.textContent=error?'投稿できません: '+safeError(error):(data==='posted'?'投稿しました！':'投稿できませんでした（'+data+'）');loadMascot();loadStats();window.loadTimeline?.()};
 document.getElementById('km-mascot-fold').addEventListener('toggle',e=>{if(e.target.open)loadMascot()});
 // 管理タブを開いたとき・管理者メニューが表示されたとき（ログイン直後や ?tab=admin で開いたとき）に読み込む
 document.querySelectorAll('.km-bottom-nav [data-km-go="admin"]').forEach(x=>x.addEventListener('click',()=>setTimeout(loadStats,100)));
 new MutationObserver(()=>{if(isAdmin())loadStats()}).observe(document.getElementById('admin'),{attributes:true,attributeFilter:['class']});
 if(isAdmin())loadStats();
})();
