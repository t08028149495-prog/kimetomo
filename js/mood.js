
/* 今日の気分ステータス */
(function(){
 // 気分は絵文字だけ（ラベルにも同じ絵文字を保存）
 const presets=['❌','Ⓜ️','🚲','🐘','💐','🌙','🔥','きれめ','まんち','おとし'].map(e=>[e,e]);
 const list=document.getElementById('km-mood-list'),picker=document.getElementById('km-mood-picker'),setBtn=document.getElementById('km-mood-set');
 if(!list)return;
 let myMood=null,moodMap=new Map();
 // 名前の横に気分の絵文字を付ける（data-km-uid が付いた名前が対象）
 function decorate(){
  document.querySelectorAll('[data-km-uid]').forEach(el=>{
   let badge=el.querySelector(':scope > .km-mood-badge');
   const e=moodMap.get(el.dataset.kmUid);
   if(!e){badge?.remove();return}
   if(!badge){badge=document.createElement('span');badge.className='km-mood-badge';el.append(badge)}
   badge.textContent=e;badge.title='今の気分';
  });
 }
 window.kmDecorateMoods=decorate;
 async function load(){
  if(typeof client==='undefined'||!client||!current)return;
  const since=new Date(Date.now()-24*3600*1000).toISOString();
  const {data,error}=await client.from('kimetomo_moods').select('user_id,emoji,label,updated_at').gt('updated_at',since).order('updated_at',{ascending:false}).limit(50);
  if(error){document.getElementById('km-mood').classList.add('hide');return}
  document.getElementById('km-mood').classList.remove('hide');
  const ids=(data||[]).map(m=>m.user_id);const names=await window.kmDisplayNames(ids);if(!current)return;
  myMood=(data||[]).find(m=>m.user_id===current.id)||null;
  moodMap=new Map((data||[]).map(m=>[m.user_id,m.emoji]));decorate();
  setBtn.textContent=myMood?myMood.emoji+' 気分を変える':'＋ 自分の気分';
  list.replaceChildren();
  if(!data?.length){const p=document.createElement('span');p.className='small';p.textContent='まだ誰も気分を設定していません。最初に設定してみよう！';list.append(p);return}
  for(const m of data){
   if(window.kmIsBlocked?.(m.user_id))continue;
   const chip=document.createElement('span');chip.className='km-mood-chip'+(m.user_id===current.id?' mine':'');
   chip.textContent=m.emoji+' '+(m.user_id===current.id?'自分':(names.get(m.user_id)||'メンバー'));
   list.append(chip);
  }
 }
 async function save(emoji,label){
  picker.classList.add('hide');
  const r=label
   ?await client.from('kimetomo_moods').upsert({user_id:current.id,emoji,label,updated_at:new Date().toISOString()},{onConflict:'user_id'})
   :await client.from('kimetomo_moods').delete().eq('user_id',current.id);
  if(r.error){alert('気分を保存できません: '+safeError(r.error));return}
  load();
 }
 for(const [e,l] of presets){const b=document.createElement('button');b.type='button';b.className=/^[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(e)?'km-mood-word':'km-mood-emoji';b.textContent=e;b.setAttribute('aria-label',e);b.onclick=()=>save(e,l);picker.append(b)}
 const clear=document.createElement('button');clear.type='button';clear.className='km-mood-clear';clear.textContent='✕ 気分を消す';clear.onclick=()=>save(null,null);picker.append(clear);
 setBtn.onclick=()=>picker.classList.toggle('hide');
 window.kmLoadMoods=load;
 // ほかの人の気分の変化も反映されるよう、定期的に読み直す
 setInterval(()=>{if(!document.hidden&&window.kmActiveTab==='timeline')load()},120000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
 setTimeout(load,2000);
})();

/* 今日のおみくじ（1日1回・同じ日は同じ結果） */
(function(){
 const btn=document.getElementById('km-omikuji-draw'),box=document.getElementById('km-omikuji-result');
 if(!btn)return;
 const fortunes=[['大吉',8,'最高の一日になりそう！思いきって行動してみよう'],['中吉',14,'いい流れが来ています。人に親切にすると◎'],['小吉',18,'小さな幸せが見つかる日。身近なものを大切に'],['吉',22,'おだやかに過ごせそう。のんびりいこう'],['末吉',18,'あとからいいことがありそう。あせらずに'],['凶',6,'今日は無理せずゆっくり休もう。明日はきっと良くなる']];
 const items=['おにぎり','あったかい飲み物','好きな音楽','お気に入りのタオル','散歩','甘いもの','ラーメン','早寝','温泉','推しの写真','新しい靴下','ゲーム','お茶','マンガ','窓をあける'];
 const colors=['赤','オレンジ','黄色','緑','水色','青','紫','ピンク','白','黒','金色','銀色'];
 function hash(str){let h=2166136261;for(const c of str){h^=c.codePointAt(0);h=Math.imul(h,16777619)}return h>>>0}
 btn.onclick=()=>{
  if(typeof current==='undefined'||!current)return;
  const d=new Date(Date.now()+9*3600*1000).toISOString().slice(0,10);
  const h=hash(current.id+':'+d);
  let r=h%100,f=fortunes[0];for(const x of fortunes){if(r<x[1]){f=x;break}r-=x[1]}
  const item=items[hash('i'+h)%items.length],color=colors[hash('c'+h)%colors.length];
  box.replaceChildren();
  const big=document.createElement('div');big.className='km-omikuji-big';big.textContent=f[0];
  const msg=document.createElement('div');msg.textContent=f[2];
  const lucky=document.createElement('div');lucky.className='small';lucky.textContent='ラッキーアイテム：'+item+'　ラッキーカラー：'+color;
  const share=document.createElement('button');share.type='button';share.className='ghost';share.textContent='タイムラインに投稿する';
  share.onclick=()=>{const ta=document.getElementById('timeline-body');ta.value='🎴 今日のおみくじは【'+f[0]+'】でした！\n'+f[2]+'\nラッキーアイテム：'+item+'／ラッキーカラー：'+color+'\n'+ta.value;ta.focus();ta.scrollIntoView({behavior:'smooth',block:'center'})};
  box.append(big,msg,lucky,share);box.classList.remove('hide');
  btn.classList.add('drawn');
 };
})();
