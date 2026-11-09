
/* 🏅 キメ友マスター：毎週日曜6時に Supabase で1週間の活動を点数にして、1〜4人のランダムな人数を点数の高い順に選び、10時から1週間つける（supabase/kimetomo_master_random.sql）。
   管理者の王冠の位置に、紫の印を出す（見た目は glow.css の最後）。index.html と dm.html の両方で読む。
   管理者メニュー「運営」の「🏅 キメ友マスター」で、今の人と次に発表される人を見られる。 */
(function(){
 window.kmMasters=new Set();
 let at=0,busy=null;
 // 誰がマスターかは週1回しか変わらないので、端末に1時間覚える（js/device-cache.js）。ただし日曜10時の発表をまたいだら読み直す
 function nextSun10(){const j=new Date(Date.now()+9*3600e3);const d=(7-j.getUTCDay())%7;let t=Date.UTC(j.getUTCFullYear(),j.getUTCMonth(),j.getUTCDate()+d,1);if(t<=Date.now())t+=7*864e5;return t}
 window.kmFetchMasters=function(api){
  if(Date.now()-at<300000)return Promise.resolve(window.kmMasters);
  const saved=window.kmDC?.get('masters',3600e3);if(saved?.ids&&Date.now()<saved.exp){window.kmMasters=new Set(saved.ids);at=Date.now();return Promise.resolve(window.kmMasters)}
  if(busy)return busy;
  busy=(async()=>{try{const {data,error}=await api.rpc('kimetomo_master_badges');if(error)throw error;const ids=(data||[]).map(x=>x.user_id);window.kmMasters=new Set(ids);window.kmDC?.set('masters',{ids,exp:nextSun10()});at=Date.now()}
   catch(e){console.warn('キメ友マスターの表示情報を取得できません:',e.message);at=Date.now()-240000}finally{busy=null}return window.kmMasters})();
  return busy;
 };
 window.kmMasterBadge=function(){
  const b=document.createElement('span');b.className='kimetomo-crown km-master';
  const icon=document.createElement('span');icon.className='kimetomo-crown-icon';icon.textContent='🏅';
  const label=document.createElement('span');label.className='kimetomo-crown-label';label.textContent='キメ友マスター';
  b.append(icon,label);b.title='タップで「キメ友マスターとは？」';b.setAttribute('aria-label','キメ友マスター（タップで説明）');
  // 印をタップすると説明が出る（名前・アイコンのタップ＝プロフィールは開かない）
  b.setAttribute('role','button');b.tabIndex=0;
  const open=e=>{e.preventDefault();e.stopPropagation();window.kmMasterInfo()};
  b.addEventListener('click',open);b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')open(e)});
  return b;
 };

 // 説明の文（印のタップと、マイプロフィールの「🏅 キメ友マスターとは？」で同じ文を使う）
 function infoBody(){
  const d=document.createElement('div');d.className='km-master-text';
  const p=document.createElement('p');p.textContent='先週、キメ友でとくに活発に交流した人に贈られる称号です。名前の横に紫の印がつきます。';
  const ul=document.createElement('ul');
  ['毎週日曜の10時に発表。前の1週間の活動から、毎週1〜4人が選ばれます（人数は週ごとにちがいます）。','称号がつくのは次の日曜10時までの1週間。続けるには、毎週選ばれる必要があります。','選ぶ基準は公開していません。投稿やDMをたくさん送るだけでは選ばれません。ほかの人との交流を大切にしてね。']
   .forEach(t=>{const li=document.createElement('li');li.textContent=t;ul.append(li)});
  d.append(p,ul);return d;
 }
 window.kmMasterInfo=function(){
  let ov=document.getElementById('km-master-info');
  if(!ov){
   ov=document.createElement('div');ov.id='km-master-info';ov.className='km-master-info';ov.hidden=true;
   ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','キメ友マスターとは？');
   const box=document.createElement('div');box.className='km-master-info-box';
   const h=document.createElement('h3');h.textContent='🏅 キメ友マスターとは？';
   const close=document.createElement('button');close.type='button';close.textContent='閉じる';
   const hide=()=>{ov.hidden=true};close.onclick=hide;
   ov.addEventListener('click',e=>{if(e.target===ov)hide()});
   ov.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});
   box.append(h,infoBody(),close);ov.append(box);document.body.append(ov);
  }
  ov.hidden=false;ov.querySelector('button')?.focus();
 };
 // マイプロフィールの「🏅 キメ友マスターとは？」（index.html だけ）
 document.getElementById('km-master-about-body')?.append(infoBody());

 // 管理者メニュー：今のマスターと、次に発表される人（点数つき。名前は管理者にだけ見える）
 const fold=document.getElementById('km-master-fold');if(!fold)return;
 const list=document.getElementById('km-master-list'),state=document.getElementById('km-master-state');
 const md=t=>{const d=new Date(t);return (d.getMonth()+1)+'/'+d.getDate()};
 async function load(){
  if(typeof client==='undefined'||!client)return;
  const m=await client.rpc('kimetomo_admin_masters');
  if(m.error){list.textContent='読み込めません: '+(m.error.message||'');return}
  const now=Date.now(),rows=m.data||[];
  const cur=rows.filter(x=>new Date(x.starts_at)<=now),next=rows.filter(x=>new Date(x.starts_at)>now);
  state.textContent=' 今 '+cur.length+'人';list.replaceChildren();
  const group=(title,rs)=>{
   const h=document.createElement('div');h.style.marginTop='8px';h.textContent=title;list.append(h);
   const ul=document.createElement('ul');ul.style.margin='4px 0 0';ul.style.paddingLeft='20px';
   rs.forEach(x=>{const li=document.createElement('li');li.textContent=(x.display_name||'メンバー')+'（'+x.score+'点）';ul.append(li)});list.append(ul);
  };
  if(cur.length)group('今のキメ友マスター（'+md(cur[0].until)+' 10時まで）',cur);else list.append(document.createTextNode('今のキメ友マスターはいません。'));
  if(next.length)group('🎉 次のキメ友マスター（'+md(next[0].starts_at)+' 10時に発表・'+next.length+'人）',next);
 }
 fold.addEventListener('toggle',()=>{if(fold.open)load()});
})();
