
/* 📌 タイムラインの一番上に固定するお知らせ（管理者が設定、3日間だけ表示） */
(function(){
 const box=document.getElementById('km-pin'),text=document.getElementById('km-pin-text'),body=document.getElementById('km-pin-body'),close=document.getElementById('km-pin-close');
 const input=document.getElementById('km-pin-input'),save=document.getElementById('km-pin-save'),remove=document.getElementById('km-pin-remove'),msg=document.getElementById('km-pin-msg'),state=document.getElementById('km-pin-state');
 if(!box)return;
 const DAYS=3;let stamp='';
 const closedKey=()=>'km-pin-closed-'+(typeof current!=='undefined'&&current?current.id:'');
 function fill(el,v){el.replaceChildren();String(v).split(/(https?:\/\/[^\s]+)/g).forEach((part,i)=>{if(i%2){const a=document.createElement('a');a.href=part;a.textContent=part;a.target='_blank';a.rel='noopener';a.onclick=e=>e.stopPropagation();el.append(a)}else if(part)el.append(document.createTextNode(part))})}
 async function load(){
  if(typeof client==='undefined'||!client||typeof current==='undefined'||!current)return;
  const f=()=>client.from('kimetomo_app_settings').select('value,updated_at').eq('key','pinned_notice').maybeSingle();
  const {data,error}=await (window.kmDC?window.kmDC.setting('pinned_notice',f):f());
  if(error)return;
  const v=(data?.value||'').trim(),until=data?.updated_at?new Date(data.updated_at).getTime()+DAYS*86400000:0;
  const live=!!v&&Date.now()<until;stamp=data?.updated_at||'';
  let closed='';try{closed=localStorage.getItem(closedKey())||''}catch{}
  if(live){fill(text,v)}
  box.classList.toggle('hide',!live||closed===stamp);
  if(state){if(live){const h=Math.ceil((until-Date.now())/3600000);state.textContent='📌 表示中・あと'+(h>=24?Math.floor(h/24)+'日'+(h%24?h%24+'時間':''):h+'時間')}else state.textContent=v?'⚪ 期限切れ（非表示）':'⚪ なし'}
  if(input&&document.activeElement!==input&&!input.dataset.touched)input.value=v||'キメ友SNSのアドレスが https://kimetomo.com に変わりました！一度だけログインし直してください。ホーム画面に追加している人は追加し直し、通知を使っている人はもう一度オンにしてね。';
 }
 body.onclick=()=>{const o=box.classList.toggle('open');body.setAttribute('aria-expanded',String(o))};
 close.onclick=()=>{try{localStorage.setItem(closedKey(),stamp)}catch{}box.classList.add('hide')};
 input&&input.addEventListener('input',()=>{input.dataset.touched='1'});
 save&&(save.onclick=async()=>{const v=input.value.trim();if(!v){msg.textContent='お知らせの文を入力してください';return}
  save.disabled=true;const {error}=await client.rpc('kimetomo_admin_set_setting',{p_key:'pinned_notice',p_value:v});save.disabled=false;
  msg.textContent=error?'保存できません（pinned_notice.sql を実行してください）: '+safeError(error):'固定しました。今から3日間、タイムラインの一番上に表示されます。';
  delete input.dataset.touched;window.kmDC?.del('set-pinned_notice');load()});
 remove&&(remove.onclick=async()=>{if(!confirm('固定しているお知らせを外しますか？'))return;remove.disabled=true;
  const {error}=await client.rpc('kimetomo_admin_set_setting',{p_key:'pinned_notice',p_value:''});remove.disabled=false;
  msg.textContent=error?'外せません: '+safeError(error):'お知らせを外しました。';delete input.dataset.touched;window.kmDC?.del('set-pinned_notice');load()});
 document.querySelectorAll('.km-bottom-nav [data-km-go]').forEach(x=>x.addEventListener('click',()=>setTimeout(load,300)));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
 setTimeout(load,2500);
})();
