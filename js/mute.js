/* 🔇 ミュート：その人の投稿を自分のタイムラインに出さない（表は supabase/mute_quote.sql）
   ブロックより軽い：コメント・チャット・通知はそのまま。相手には分からない。
   解除は、その人のプロフィール か マイプロフィールの「ミュート中の人」から。 */
(function(){
 window.kmMuted=new Set();
 window.kmIsMuted=id=>window.kmMuted.has(id);
 window.kmLoadMutes=async()=>{
  if(!current)return;
  const {data,error}=await client.from('kimetomo_user_mutes').select('muted_id').eq('muter_id',current.id);
  if(!error)window.kmMuted=new Set((data||[]).map(r=>r.muted_id));
 };
 async function toggle(userId,who){
  const on=window.kmMuted.has(userId);
  if(!confirm(on?who+'さんのミュートを解除しますか？\nこの人の投稿が、またタイムラインに出るようになります。':who+'さんをミュートしますか？\nこの人の投稿が、あなたのタイムラインに出なくなります。コメント・チャット・通知はそのままです。相手には知らされません。'))return null;
  const r=on?await client.from('kimetomo_user_mutes').delete().eq('muter_id',current.id).eq('muted_id',userId)
            :await client.from('kimetomo_user_mutes').insert({muter_id:current.id,muted_id:userId});
  if(r.error&&r.error.code!=='23505'){alert('操作できませんでした: '+safeError(r.error));return null}
  await window.kmLoadMutes();loadTimeline();paintList();return window.kmMuted.has(userId);
 }
 // メンバーのプロフィールに出すボタン（whoName はその場の表示名を返す関数）
 window.kmMuteButton=(userId,whoName)=>{
  const b=document.createElement('button');b.type='button';b.className='ghost km-mute-btn';
  const paint=()=>{b.textContent=window.kmMuted.has(userId)?'🔈 ミュートを解除する':'🔇 ミュートする（投稿だけ見えなくする）'};paint();
  b.onclick=async()=>{b.disabled=true;try{await toggle(userId,whoName()||'このメンバー')}finally{b.disabled=false;paint()}};
  return b;
 };
 // マイプロフィールの「ミュート中の人」（開いたときに読み込む）
 let list=null;
 async function paintList(){
  if(!list||!list.open||!current)return;
  const ul=list.querySelector('.km-mute-list');ul.textContent='読み込み中…';
  const ids=[...window.kmMuted];
  if(!ids.length){ul.textContent='ミュートしている人はいません';return}
  let names=new Map();try{names=await window.kmDisplayNames(ids)}catch{}
  ul.replaceChildren();
  for(const id of ids){
   const who=names.get(id)||'メンバー';
   const row=document.createElement('div');row.className='km-mute-row';
   const n=document.createElement('span');n.textContent=who;
   const x=document.createElement('button');x.type='button';x.className='ghost';x.textContent='解除';
   x.onclick=async()=>{x.disabled=true;if(await toggle(id,who)===null)x.disabled=false};
   row.append(n,x);ul.append(row);
  }
 }
 const panel=document.getElementById('my-profile');
 if(panel){
  list=document.createElement('details');list.className='km-mute-manage';
  const s=document.createElement('summary');s.textContent='🔇 ミュート中の人';
  const ul=document.createElement('div');ul.className='km-mute-list small';
  list.append(s,ul);panel.append(list);
  list.addEventListener('toggle',async()=>{if(list.open){await window.kmLoadMutes();paintList()}});
 }
})();
