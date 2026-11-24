/* 🚪 退会（プロフィール画面のいちばん下。Edge Function kimetomo-delete-account・supabase/delete_account.sql）
   「退会する」と入力して押すと、アカウントと投稿・コメント・チャット・DM・写真をすべて消して、ログアウトする。元には戻せない。 */
(function(){
 const $=id=>document.getElementById(id);
 const input=$('km-del-confirm'),btn=$('km-del-go'),msg=$('km-del-msg');
 if(!input||!btn)return;
 const WORD='退会する';
 const ready=()=>{btn.disabled=input.value.trim()!==WORD};
 input.addEventListener('input',ready);ready();
 btn.onclick=async()=>{
  if(input.value.trim()!==WORD||typeof client==='undefined'||!client)return;
  if(!confirm('本当に退会しますか？\n\nアカウントと、これまでの投稿・コメント・チャット・DM・写真がすべて消えます。元には戻せません。'))return;
  btn.disabled=true;input.disabled=true;msg.textContent='退会の手続き中…';
  try{
   const r=await client.functions.invoke('kimetomo-delete-account',{body:{confirm:WORD}});
   if(r.error){let m='';try{m=(await r.error.context?.json())?.error||''}catch{}throw new Error(m||'退会できませんでした。時間をおいてもう一度お試しください。')}
   try{await window.kmPresence?.away()}catch{}
   window.kmDC?.clearAll();
   try{await client.auth.signOut({scope:'local'})}catch{}
   alert('退会しました。これまでキメ友を使ってくださり、ありがとうございました。');
   location.replace(location.pathname);
  }catch(e){
   msg.textContent=e?.message||'退会できませんでした。';
   input.disabled=false;ready();
  }
 };
})();
