/* 🔔 投稿したすぐ後に「反応がついたら知らせましょうか？」とすすめる
   - プッシュ通知が使える端末で、まだオフ → プロフィールの「通知をオンにする」と同じ動き（push.js）
   - プッシュ通知が使えない・断った端末で、メール通知も未登録 → プロフィールのメール通知の欄を開く
   - どちらもオンなら何も出さない。「あとで」で 14 日、出したら 3 日は出さない
   呼び出しは js/app.js の投稿のあと（window.kmNotifyNudge） */
(function(){
 const KEY='km-notify-nudge-until';
 const later=days=>{try{localStorage.setItem(KEY,String(Date.now()+days*864e5))}catch{}};
 const pushSupported=()=>'Notification' in window&&'serviceWorker' in navigator&&'PushManager' in window;
 async function pushOn(){
  if(!pushSupported()||Notification.permission!=='granted')return false;
  try{const reg=await navigator.serviceWorker.ready;return !!(await reg.pushManager.getSubscription())}catch{return false}
 }
 async function emailOn(){
  try{
   const f=()=>client.rpc('kimetomo_my_email');
   const {data,error}=await (window.kmDC?window.kmDC.mine.get('email',current.id,1800e3,f):f());
   if(error)return true; // 分からないときはすすめない
   const r=Array.isArray(data)?data[0]:data;return !!r?.email;
  }catch{return true}
 }
 function openEmail(){
  document.querySelector('.km-bottom-nav [data-km-go="profile"]')?.click();
  setTimeout(()=>{const box=document.getElementById('km-email-box');if(!box)return;box.open=true;box.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>document.getElementById('km-email-input')?.focus({preventScroll:true}),400)},500);
 }
 window.kmNotifyNudge=async function(){
  try{
   if(typeof client==='undefined'||!client||!current)return;
   try{if(Date.now()<Number(localStorage.getItem(KEY)||0))return}catch{}
   if(document.getElementById('km-notify-nudge'))return;
   if(await pushOn())return;
   const canPush=pushSupported()&&Notification.permission!=='denied'&&!!document.getElementById('kimetomo-push-button');
   if(!canPush&&await emailOn())return;
   const feed=document.getElementById('timeline-feed');if(!feed)return;
   later(3);
   const box=document.createElement('div');box.id='km-notify-nudge';box.className='km-install km-notify-nudge';box.setAttribute('role','status');
   const text=document.createElement('span');
   text.textContent=canPush?'🔔 投稿しました！ リアクションやコメントがついたら、すぐ知らせましょうか？':'📧 投稿しました！ リアクションやコメントがついたら、メールで知らせましょうか？';
   const btns=document.createElement('div');btns.className='km-install-btns';
   const yes=document.createElement('button');yes.type='button';yes.textContent=canPush?'通知をオンにする':'メールを登録する';
   const no=document.createElement('button');no.type='button';no.className='ghost';no.textContent='あとで';
   no.onclick=()=>{later(14);box.remove()};
   yes.onclick=async()=>{
    if(!canPush){box.remove();openEmail();return}
    yes.disabled=no.disabled=true;
    const pb=document.getElementById('kimetomo-push-button');
    if(pb&&!pb.dataset.on)pb.click(); // push.js がオンにする（許可の確認が出る）
    // オンになったか少し待って確かめる
    for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,500));if(await pushOn())break;if(Notification.permission==='denied')break}
    btns.remove();
    if(await pushOn()){text.textContent='✅ 通知をオンにしました。反応がついたらお知らせします';setTimeout(()=>box.remove(),4000);document.getElementById('km-push-nudge')?.remove()}
    else if(Notification.permission==='denied'){later(30);text.textContent='通知が許可されませんでした。代わりにメールで知らせることもできます（プロフィールの「📧 メール通知」）';setTimeout(()=>box.remove(),8000)}
    else{text.textContent='通知をオンにできませんでした。プロフィールの「通知」からもう一度お試しください';setTimeout(()=>box.remove(),8000)}
   };
   btns.append(yes,no);box.append(text,btns);
   feed.before(box);
  }catch(e){console.warn('通知のおすすめ',e)}
 };
})();
