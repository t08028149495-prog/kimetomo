/* 🌷 女性のための安心ガイド（プロフィールタブに固定で出す）
   ・保存した性別が♀か、性別を選んでいない人に出す（♂の人には出さない。性別を隠していても出る）。閉じるボタンはない
   ・男性からのDM対策など、今ある安心の機能を一覧にして、今の設定の状態も出す
   ・「設定する」は下の「🛡 安心の設定」を開いて、その項目へ移動する */
(function(){
 const $=id=>document.getElementById(id);
 const box=$('km-women-guide');if(!box)return;
 const pol=$('km-dm-policy'),hid=$('km-gender-hidden'),safety=$('km-safety-box');
 let female=false;
 const mk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
 const openSafety=el=>{if(safety)safety.open=true;el?.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>el?.focus?.(),400)};
 function item(icon,title,text,state,go){
  const li=mk('li','km-wg-item');
  li.append(mk('span','km-wg-icon',icon));
  const body=mk('div','km-wg-body');
  const head=mk('div','km-wg-head');head.append(mk('strong','',title));
  if(state)head.append(mk('span','km-wg-state'+(state.on?' on':''),state.text));
  body.append(head,mk('p','small',text));
  if(go){const b=mk('button','ghost km-wg-go',go.label);b.type='button';b.onclick=go.fn;body.append(b)}
  li.append(body);return li;
 }
 function paint(){
  box.classList.toggle('hide',!female);if(!female)return;
  const known=pol?.value==='known',hidden=!!hid?.checked,ready=pol&&!pol.disabled;
  const list=mk('ul','km-wg-list');
  list.append(
   item('💌','知らない人からのDMを止める','「自分から送った相手からだけ」にすると、知らない男性などから急に個人チャットが届かなくなります。話したい相手には、自分から一度送れば返事が届きます。',ready?{on:known,text:known?'オン':'オフ'}:null,{label:'設定する',fn:()=>openSafety(pol)}),
   item('🙈','性別（♀）を名前の横に出さない','投稿やチャットで♀の印を出さないようにできます。女性だと知られたくないときに。',ready?{on:hidden,text:hidden?'オン':'オフ'}:null,{label:'設定する',fn:()=>openSafety(hid)}),
   item('🚫','ブロック・🔇ミュート・🚩通報','相手のアイコンを押すと出るプロフィールからできます。ブロックすると、その人の投稿・コメント・チャットが見えなくなり、通知も届きません。どれも相手には知らされません。',null,{label:'ブロックした人を見る',fn:()=>{location.href='./blocked.html'}}),
   item('🌷','女性だけの部屋','確認された女性だけが入れるグループチャットです。「グループ」タブから申請できます（AIでその場の写真を確認してすぐ入る方法もあります）。写真はキメ友に保存されません。',null,null),
   item('🔒','女性だけに見せる投稿・匿名の相談','部屋のメンバーになると、投稿欄に「🌷 女性だけ」「🙈 匿名で相談」が出ます。男性には見えず、匿名の相談は誰が書いたか管理者にしか分かりません。',null,null),
   item('🔕','コメントなし・24時間で消える投稿','投稿欄の「🔕 コメントなし」「⏳ 24時間で消す」で、知らない人からのコメントを受け付けない・あとに残さない投稿ができます。',null,null)
  );
  box.replaceChildren(mk('h3','km-wg-title','🌷 女性に便利な機能紹介'),mk('p','small km-wg-lead','気になることがあれば、ひとりで抱えずに通報や管理者への連絡をしてください。'),list);
 }
 // loadMyProfile（js/app.js）から、保存されている性別を渡してもらう
 window.kmWomenGuide=g=>{female=g!=='male';paint()};
 // 安心の設定を読み込んだ・保存した（失敗して戻した）ときは、下の状態の文字が変わるので、そのたびに描き直す
 const st=$('km-safety-state');
 if(st)new MutationObserver(()=>{if(female)paint()}).observe(st,{childList:true,characterData:true,subtree:true});
})();
