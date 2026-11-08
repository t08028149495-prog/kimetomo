/* 🔁 引用して投稿：ほかの人の投稿を自分の投稿に貼って、ひとこと添える（表は supabase/mute_quote.sql）
   元の投稿の本文はコピーせず id だけ持つので、元が消えたら「見られません」と出る。
   女性だけの投稿・匿名の相談は引用できない（サーバー側でも止めている）。 */
(function(){
 let quoting=null;
 const short=(t,n)=>{t=String(t||'').replace(/\s+/g,' ').trim();return t.length>n?t.slice(0,n)+'…':t};
 const textOf=p=>p.image_path&&p.body===KM_IMAGE_ONLY?'📷 画像':p.body;
 const box=()=>{
  let b=document.getElementById('km-quote-compose');if(b)return b;
  b=document.createElement('div');b.id='km-quote-compose';b.className='km-quote-compose hide';
  const ta=document.getElementById('timeline-body');(ta.closest('.km-quick')||ta).after(b);return b;
 };
 // 引用の小さなカード（投稿欄の下と、タイムラインの投稿の中で使う）
 function card(name,text,when){
  const c=document.createElement('div');c.className='km-quote';
  const head=document.createElement('div');head.className='km-quote-head';
  const n=document.createElement('strong');n.textContent=name;head.append(n);
  if(when){const d=document.createElement('span');d.className='small';d.textContent=kmTimeAgo(when);head.append(d)}
  const body=document.createElement('div');body.className='km-quote-body';body.textContent=text;
  c.append(head,body);return c;
 }
 window.kmQuoteId=()=>quoting;
 window.kmQuoteClear=()=>{quoting=null;const b=document.getElementById('km-quote-compose');if(b){b.replaceChildren();b.classList.add('hide')}};
 window.kmQuoteCanUse=post=>!!post&&!post.women_only&&!post.anonymous;
 window.kmQuoteStart=(post,name)=>{
  if(!window.kmQuoteCanUse(post))return;
  quoting=post.id;
  const b=box(),label=document.createElement('div');label.className='small km-quote-label';label.textContent='🔁 この投稿を引用します（ひとこと書いて投稿）';
  const x=document.createElement('button');x.type='button';x.className='ghost km-quote-x';x.textContent='✕ 引用をやめる';x.onclick=window.kmQuoteClear;
  b.replaceChildren(label,card(name,short(textOf(post),120)),x);b.classList.remove('hide');
  const ta=document.getElementById('timeline-body');
  (ta.closest('.km-quick')||ta).scrollIntoView({behavior:'smooth',block:'center'});
  // すぐに入力欄へ（「欄の外をタップしたらたたむ」処理のあとにする）
  setTimeout(()=>ta.focus(),400);
 };
 window.kmQuoteButton=(post,name)=>{
  if(!window.kmQuoteCanUse(post))return null;
  const q=document.createElement('button');q.type='button';q.className='ghost km-quote-btn';q.textContent='🔁 引用';q.title='この投稿を引用して投稿する';
  q.onclick=()=>window.kmQuoteStart(post,name);return q;
 };
 // タイムラインに無い「引用された投稿」をまとめて読む（見る権利がない・消えた投稿は返ってこない）
 window.kmQuoteFetch=async posts=>{
  const map=new Map();for(const p of posts||[])map.set(p.id,p);
  const need=[...new Set((posts||[]).map(p=>p.quote_post_id).filter(id=>id&&!map.has(id)))];
  if(need.length){const {data,error}=await client.from('kimetomo_timeline_posts').select('id,author_id,body,image_path,created_at,women_only,anonymous').in('id',need);if(!error)for(const p of data||[])map.set(p.id,p)}
  return map;
 };
 window.kmQuoteEmbed=(post,map,profiles)=>{
  if(!post.quote_post_id)return null;
  const q=map.get(post.quote_post_id);
  if(!q){const c=card('🔁 引用','この投稿は削除されたか、見られません');c.classList.add('km-quote-gone');return c}
  const hidden=window.kmIsBlocked?.(q.author_id);
  const name=q.anonymous?'🌷 匿名の相談':(profiles.get(q.author_id)?.name||'メンバー');
  const full=hidden?'表示しない設定の人の投稿です':textOf(q);
  const c=card(name,short(full,140),q.created_at);
  if(hidden)return c;
  c.tabIndex=0;c.setAttribute('role','button');c.title='元の投稿を見る';
  // タイムラインにあればそこへ移動、なければその場で全文を出す
  const open=()=>{const el=document.getElementById('km-post-'+q.id);if(el){el.classList.add('km-highlight');el.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>el.classList.remove('km-highlight'),2500)}else c.querySelector('.km-quote-body').textContent=full};
  c.onclick=e=>{if(!e.target.closest('a'))open()};c.onkeydown=e=>{if(e.key==='Enter')open()};
  return c;
 };
})();
