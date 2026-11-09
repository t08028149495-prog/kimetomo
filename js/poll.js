
/* アンケートの表示と投票 */
function kmRenderPoll(post,options,votes){
 if(!options||!options.length)return null;
 const box=document.createElement('div');box.className='km-poll';
 const total=votes.length,mine=votes.find(v=>v.user_id===current?.id);
 options.forEach((text,i)=>{
  const count=votes.filter(v=>v.option_index===i).length,pct=total?Math.round(count*100/total):0;
  const b=document.createElement('button');b.type='button';b.className='km-poll-option'+(mine&&mine.option_index===i?' mine':'');
  const bar=document.createElement('span');bar.className='km-poll-bar';bar.style.width=pct+'%';
  const label=document.createElement('span');label.className='km-poll-label';label.textContent=(mine&&mine.option_index===i?'✓ ':'')+text;
  const num=document.createElement('span');num.className='km-poll-count';num.textContent=total?pct+'%（'+count+'）':'';
  b.append(bar,label,num);
  b.onclick=async()=>{
   b.disabled=true;
   const r=(mine&&mine.option_index===i)
     ?await client.from('kimetomo_timeline_poll_votes').delete().eq('post_id',post.id).eq('user_id',current.id)
     :await client.from('kimetomo_timeline_poll_votes').upsert({post_id:post.id,user_id:current.id,option_index:i},{onConflict:'post_id,user_id'});
   if(r.error){timelineStatus('投票できません: '+safeError(r.error));b.disabled=false;return}
   // タイムライン全体は読み直さず、このアンケートの票だけ読み直して描き直す
   const nv=await client.from('kimetomo_timeline_poll_votes').select('post_id,user_id,option_index').eq('post_id',post.id);
   if(nv.error){await loadTimeline();return}
   const nb=kmRenderPoll(post,options,nv.data||[]);if(nb)box.replaceWith(nb);
  };
  box.append(b);
 });
 const foot=document.createElement('div');foot.className='small';foot.textContent='📊 '+total+'票'+(mine?'・もう一度押すと取り消し／別の選択肢で変更できます':'・タップして投票');
 box.append(foot);
 return box;
}

/* タイムラインの新着バッジ（自分以外の新しい投稿の数） */
(function(){
 const key=()=>current?'km-tl-seen-'+current.id:null;
 const getSeen=()=>{try{return localStorage.getItem(key())}catch{return null}};
 const setSeen=v=>{try{localStorage.setItem(key(),v)}catch{}};
 const btn=document.querySelector('.km-bottom-nav [data-km-go="timeline"]');
 if(!btn)return;
 const badge=document.createElement('span');badge.className='km-nav-badge hide';btn.append(badge);
 function show(n){badge.textContent=n>99?'99+':String(n);badge.classList.toggle('hide',!n)}
 window.kmTimelineMarkSeen=function(posts){
  if(!current||window.kmActiveTab!=='timeline'||document.hidden)return;
  const newest=(posts||[]).reduce((m,p)=>p.created_at>m?p.created_at:m,getSeen()||'');
  setSeen(newest||new Date().toISOString());base=0;extra.clear();baseAt=Date.now();baseUid=current.id;show(0);
 };
 // 新着の数は端末で数える：一度 Supabase で数えたら、あとはリアルタイムで届いた投稿（js/live.js）を足すだけ。
 // リアルタイムが切れていた間（裏に回したときなど）は、もう一度 Supabase で数え直す
 let base=0,baseAt=0,baseUid=null;const extra=new Set();
 const total=()=>base+extra.size;
 window.addEventListener('km-live-post',e=>{
  const r=e.detail;if(!r||!current||!baseAt||baseUid!==current.id)return;
  const seen=getSeen();if(seen&&r.created_at<=seen)return;
  extra.add(String(r.id));if(!(window.kmActiveTab==='timeline'&&!document.hidden))show(total());
 });
 async function check(){
  if(typeof client==='undefined'||!client||!current||!document.body.classList.contains('km-nav-ready'))return;
  let seen=getSeen();
  if(!seen){seen=new Date().toISOString();setSeen(seen)}
  if(window.kmActiveTab==='timeline'&&!document.hidden){show(0);return}
  if(window.kmLiveOk&&baseAt&&baseUid===current.id&&baseAt>=(window.kmLiveSince||Infinity)){show(total());return}
  const t=Date.now(),uid=current.id;
  const {count,error}=await client.from('kimetomo_timeline_posts').select('id',{count:'exact',head:true}).gt('created_at',seen).neq('author_id',current.id);
  if(!error&&current?.id===uid){base=count||0;extra.clear();baseAt=t;baseUid=uid;show(total())}
 }
 // タイムラインのタブを押したとき：新着がある・3分以上たった・まだ空のときだけ読み直す（それ以外は今の画面のまま）
 btn.addEventListener('click',()=>{const n=total();show(0);setTimeout(()=>{
  const feed=document.getElementById('timeline-feed'),stale=!window.kmTimelineLoadedAt||Date.now()-window.kmTimelineLoadedAt>180000;
  if(n||stale||!feed?.childElementCount||document.getElementById('km-live-new'))window.loadTimeline?.();else window.kmTimelineMarkSeen?.([]);
 },0)});
 document.querySelectorAll('.km-bottom-nav [data-km-go]').forEach(b=>b.addEventListener('click',()=>setTimeout(check,300)));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
 setInterval(()=>{if(!document.hidden)check()},60000);
 setTimeout(check,3000);
})();
