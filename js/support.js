
/* 💝 応援（PayPay）の表示と、管理者による設定 */
(function(){
 const panel=document.getElementById('support-panel'),link=document.getElementById('km-support-link'),upd=document.getElementById('km-support-updated');
 const input=document.getElementById('km-support-url'),save=document.getElementById('km-support-save'),msg=document.getElementById('km-support-msg'),state=document.getElementById('km-support-state');
 if(!panel)return;
 const ok=u=>/^https:\/\/([a-z0-9-]+\.)*paypay\.ne\.jp\//i.test(u||'');
 async function load(){
  if(typeof client==='undefined'||!client||!current)return;
  const {data}=await client.from('kimetomo_app_settings').select('value,updated_at').eq('key','support_paypay_url').maybeSingle();
  const url=data?.value||'';
  // Myコードのリンクは保存から14日で期限切れになるので、切れたらメンバーには表示しない
  const exp=data?.updated_at?new Date(data.updated_at).getTime()+14*86400000:0;
  const expired=!!exp&&Date.now()>exp;
  const daysLeft=exp?Math.ceil((exp-Date.now())/86400000):null;
  panel.classList.toggle('hide',!ok(url)||expired);
  if(ok(url)){link.href=url}
  if(input&&document.activeElement!==input)input.value=url;
  if(state)state.textContent=!ok(url)?'⚪ 非表示':expired?'🔴 期限切れ（新しいリンクを貼ってください）':(daysLeft<=2?'🟠 あと'+daysLeft+'日で期限切れ':'🟢 表示中・あと'+daysLeft+'日');
 }
 save&&(save.onclick=async()=>{
  const v=input.value.trim();
  if(v&&!ok(v)){msg.textContent='PayPayのリンク（https://…paypay.ne.jp/…）を貼り付けてください';return}
  save.disabled=true;
  const {error}=await client.rpc('kimetomo_admin_set_setting',{p_key:'support_paypay_url',p_value:v});
  save.disabled=false;
  msg.textContent=error?'保存できません: '+safeError(error):(v?'保存しました。プロフィールタブに「💝 キメ友を応援する」が表示されます':'応援の欄を非表示にしました');
  load();
 });
 document.querySelectorAll('.km-bottom-nav [data-km-go="profile"]').forEach(x=>x.addEventListener('click',()=>setTimeout(load,300)));
 setTimeout(()=>{if(window.kmActiveTab==='profile')load();if(new URLSearchParams(location.search).get('support')==='1')setTimeout(()=>{const f=document.getElementById('km-support-fold');if(f){f.open=true;f.scrollIntoView({behavior:'smooth',block:'start'})}},1500)},3000);
})();
