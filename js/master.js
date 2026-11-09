
/* 🏅 キメ友マスター：毎週日曜10時に Supabase で1週間の活動を点数にして、基準を超えた人に1週間つける（supabase/kimetomo_master.sql）。
   管理者の王冠の位置に、紫の印を出す（見た目は glow.css の最後）。index.html と dm.html の両方で読む。
   管理者メニュー「運営」の「🏅 キメ友マスター」で、基準の数字を変えられる（次の日曜の集計から使う）。 */
(function(){
 window.kmMasters=new Set();
 let at=0,busy=null;
 // 誰がマスターかは週1回しか変わらないので、端末に1時間覚える（js/device-cache.js）
 window.kmFetchMasters=function(api){
  if(Date.now()-at<300000)return Promise.resolve(window.kmMasters);
  const saved=window.kmDC?.get('masters',3600e3);if(saved){window.kmMasters=new Set(saved);at=Date.now();return Promise.resolve(window.kmMasters)}
  if(busy)return busy;
  busy=(async()=>{try{const {data,error}=await api.rpc('kimetomo_master_badges');if(error)throw error;const ids=(data||[]).map(x=>x.user_id);window.kmMasters=new Set(ids);window.kmDC?.set('masters',ids);at=Date.now()}
   catch(e){console.warn('キメ友マスターの表示情報を取得できません:',e.message);at=Date.now()-240000}finally{busy=null}return window.kmMasters})();
  return busy;
 };
 window.kmMasterBadge=function(){
  const b=document.createElement('span');b.className='kimetomo-crown km-master';
  const icon=document.createElement('span');icon.className='kimetomo-crown-icon';icon.textContent='🏅';
  const label=document.createElement('span');label.className='kimetomo-crown-label';label.textContent='キメ友マスター';
  b.append(icon,label);b.title='キメ友マスター（先週とても活発だった人）';b.setAttribute('aria-label','キメ友マスター');return b;
 };

 // 管理者メニュー：基準の数字と、今のマスター
 const fold=document.getElementById('km-master-fold');if(!fold)return;
 const $=id=>document.getElementById(id);
 const ins={score:$('km-master-score'),days:$('km-master-days'),comments:$('km-master-comments')};
 const msg=$('km-master-msg'),list=$('km-master-list'),state=$('km-master-state');
 async function load(){
  if(typeof client==='undefined'||!client)return;
  const [s,m]=await Promise.all([client.from('kimetomo_app_settings').select('value').eq('key','master_rules').maybeSingle(),client.rpc('kimetomo_admin_masters')]);
  let r={};try{r=JSON.parse(s.data?.value||'{}')}catch{}
  ins.score.value=r.score??30;ins.days.value=r.days??2;ins.comments.value=r.comments??3;
  if(m.error){list.textContent='読み込めません: '+(m.error.message||'');return}
  const rows=m.data||[];state.textContent=' 今 '+rows.length+'人';
  list.replaceChildren();
  if(!rows.length){list.textContent='今週のキメ友マスターはいません。';return}
  const until=new Date(rows[0].until);
  list.append(document.createTextNode('今週のキメ友マスター（'+(until.getMonth()+1)+'/'+until.getDate()+' 10時まで）'));
  const ul=document.createElement('ul');ul.style.margin='6px 0 0';ul.style.paddingLeft='20px';
  rows.forEach(x=>{const li=document.createElement('li');li.textContent=(x.display_name||'メンバー')+'（'+x.score+'点）';ul.append(li)});list.append(ul);
 }
 fold.addEventListener('toggle',()=>{if(fold.open)load()});
 $('km-master-save').onclick=async()=>{
  const v={score:ins.score.value.trim(),days:ins.days.value.trim(),comments:ins.comments.value.trim()};
  const b=$('km-master-save');b.disabled=true;msg.textContent='保存中…';
  const {error}=await client.rpc('kimetomo_admin_set_setting',{p_key:'master_rules',p_value:JSON.stringify(v)});b.disabled=false;
  msg.textContent=error?'保存できません: '+(error.message||''):'保存しました。次の日曜10時の集計から、この基準で選びます。';
  window.kmDC?.del('set-master_rules');if(!error)load();
 };
})();
