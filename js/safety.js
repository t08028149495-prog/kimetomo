/* 安心の設定（プロフィールの「🛡 安心の設定」）
   ・個人チャット（DM）を受け取る相手：誰からでも／自分から送った相手からだけ
   ・性別（♂・♀）を名前の横に表示しない
   変えたらすぐ保存する。止める仕組みは supabase/women_safety.sql */
(function(){
 const $=id=>document.getElementById(id);
 const pol=$('km-dm-policy'),hid=$('km-gender-hidden'),st=$('km-safety-state');
 if(!pol||!hid||!st)return;
 const say=t=>{st.textContent=t||''};
 const lock=on=>{pol.disabled=on;hid.disabled=on};
 window.kmSafetyLoad=async()=>{
  if(!client||!current)return;
  const {data,error}=await client.from('kimetomo_user_profiles').select('dm_policy,gender_hidden').eq('user_id',current.id).maybeSingle();
  if(error){lock(true);say('この設定は、まだ使えません（準備中）');return}
  pol.value=data?.dm_policy||'all';hid.checked=!!data?.gender_hidden;lock(false);say('');
 };
 async function save(row,done){
  lock(true);say('保存中…');
  try{
   const {data,error}=await client.from('kimetomo_user_profiles').update(row).eq('user_id',current.id).select('user_id');
   if(error)throw error;
   if(!data?.length)throw Error('先に上の「プロフィールを保存」を押してください');
   lock(false);say(done);return true;
  }catch(e){await window.kmSafetyLoad();say('保存できませんでした：'+(e?.message||e));return false}
 }
 pol.onchange=()=>save({dm_policy:pol.value},pol.value==='known'?'保存しました。知らない人からの個人チャットは届かなくなります':'保存しました。誰からでも受け取ります');
 hid.onchange=async()=>{
  if(!await save({gender_hidden:hid.checked},hid.checked?'保存しました。性別は表示されません':'保存しました。性別を表示します'))return;
  window.kmGenderSet?.(current.id,hid.checked?'':($('my-profile-gender')?.value||''));
  $('km-my-tags')?.replaceChildren(...(window.kmProfileTags?.({gender:$('my-profile-gender')?.value,gender_hidden:hid.checked,age_range:$('my-profile-age')?.value})||[]));
 };
})();
