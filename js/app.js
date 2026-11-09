
(()=>{'use strict';const $=id=>document.getElementById(id);let client=null,mode='login',current=null,chatChannel=null,roomNames={};Object.defineProperty(window,'client',{get:()=>client,configurable:true});Object.defineProperty(window,'current',{get:()=>current,configurable:true});window.loadTimeline=(...a)=>loadTimeline(...a);window.loadChat=(...a)=>loadChat(...a);window.safeError=(...a)=>safeError(...a);window.note=(...a)=>note(...a);window.timelineStatus=(...a)=>timelineStatus(...a);window.kmLoadNotifications=(...a)=>kmLoadNotifications(...a);
// Cloudflare Turnstile（ロボット対策）。サイトキーが空なら何もしない
const KM_TURNSTILE_SITEKEY='0x4AAAAAAFxjUI3RtokAXDU_';
const kmCaptcha=(()=>{let token=null,widget=null;
 const render=()=>{if(!KM_TURNSTILE_SITEKEY||widget!==null||!window.turnstile)return;widget=window.turnstile.render('#km-captcha',{sitekey:KM_TURNSTILE_SITEKEY,theme:'dark',language:'ja',callback:t=>{token=t},'expired-callback':()=>{token=null},'error-callback':()=>{token=null}})};
 let loaded=false;const load=()=>{if(loaded||!KM_TURNSTILE_SITEKEY)return;loaded=true;window.kmTurnstileLoaded=render;const sc=document.createElement('script');sc.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=kmTurnstileLoaded';sc.async=true;sc.defer=true;document.head.append(sc)};
 return{load,ready:()=>!KM_TURNSTILE_SITEKEY||!!token,token:()=>token||undefined,reset:()=>{if(widget!==null&&window.turnstile){token=null;window.turnstile.reset(widget)}}};
})();
const kmTimeAgo=v=>{const d=new Date(v),diff=(Date.now()-d.getTime())/1000;if(diff<60)return 'たった今';if(diff<3600)return Math.floor(diff/60)+'分前';if(diff<86400&&d.getDate()===new Date().getDate())return Math.floor(diff/3600)+'時間前';const y=new Date(Date.now()-86400000);const hm=d.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});if(d.toDateString()===y.toDateString())return '昨日 '+hm;if(d.getFullYear()===new Date().getFullYear())return (d.getMonth()+1)+'/'+d.getDate()+' '+hm;return d.getFullYear()+'/'+(d.getMonth()+1)+'/'+d.getDate()};window.kmTimeAgo=kmTimeAgo;window.kmDisplayNames=async ids=>{const m=new Map();if(!ids.length)return m;/* 端末に覚えた名前を使い、知らない人だけ聞く（kmReadAuthorRows） */const p=await kmReadAuthorRows(ids);for(const [id,v] of p)if(v.name)m.set(id,v.name);return m};const show=(id,on)=>$(id).classList.toggle('hide',!on);const note=(msg,kind='')=>{$('notice').textContent=msg;$('notice').className=msg?'notice '+kind:''};const safeError=e=>{const m=e?.message||String(e);if(m.includes('管理者になりすます事はできません'))return '管理者になりすます事はできません。';if(m.includes('投稿が集中しています'))return '連続投稿の上限に達しました。少し時間をおいてから試してください。';if(/failed to fetch|load failed|networkerror|network request failed|fetch failed|timeout|timed out/i.test(m))return '通信できませんでした。電波の良いところで、もう一度お試しください。';if(/jwt expired|invalid jwt|refresh token/i.test(m))return 'ログインの有効期限が切れました。開き直すか、もう一度ログインしてください。';return m};const busy=(id,b)=>$(id).disabled=b;
function configure(url,key){
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url))throw Error('Project URLを確認してください');
 if(!key||key.length<20)throw Error('公開用キーを確認してください');
 if(key.startsWith('sb_secret_') || key.startsWith('eyJ') && key.includes('service_role'))throw Error('秘密キーは使用できません');
 client=window.supabase.createClient(url.replace(/\/$/,''),key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 const finishLoading=()=>{const el=$('km-session-loading');if(el)el.classList.add('hide')};
 // ログイン済みセッションを優先。ログアウト時だけログイン画面へ戻す。
 client.auth.onAuthStateChange((event,session)=>{
   if(event==='SIGNED_OUT')setTimeout(async()=>{await sync(null);finishLoading()},0);
   else if(event==='SIGNED_IN' && session?.user && current?.id!==session.user.id){
     setTimeout(async()=>{await sync(session.user);finishLoading()},0);
   }
 });
 client.auth.getSession().then(async ({data,error})=>{
   if(error){note('ログイン状態を確認できませんでした。再度ログインしてください。','error');await sync(null);return;}
   if(!data?.session){await sync(null);return;}
   // 保存済みのログイン状態ですぐに表示し、サーバーでの確認は裏で行う（表示を速くするため）
   const pending=sync(data.session.user);
   client.auth.getUser().then(async userResult=>{
     const st=userResult.error?.status;
     if(st===401||st===403){await sync(null);}
   }).catch(()=>{});
   await pending;
 }).catch(async(e)=>{console.warn('セッション復元:',e);await sync(null)}).finally(finishLoading);
}
// 起動時は「保存済みのログイン」と「ログインした合図」の両方から同時に呼ばれることがある。
// 同じ人の確認が進行中なら1回にまとめる（2回走ると、起動時の問い合わせがほぼ全部2倍になるため）
var kmSyncP=null,kmSyncKey=null;
function sync(user){const k=user?.id||'';if(kmSyncP&&kmSyncKey===k)return kmSyncP;kmSyncKey=k;const p=kmSyncNow(user).finally(()=>{if(kmSyncP===p){kmSyncP=null;kmSyncKey=null}});kmSyncP=p;return p}
async function kmSyncNow(user){if(user&&await kmMfaGate(user))return;show('km-mfa',false);current=user;show('auth',!user);show('member',!!user);if(!user){window.kmDC?.clearAll();kmCaptcha.load();kmStopNotifications();kmSetNavReady(false);window.kmIsAdmin=false;kmPaintImagePicker();if(new URLSearchParams(location.search).get('invite')){authMode('signup');requestAnimationFrame(()=>$('auth').scrollIntoView({block:'start'}));}show('timeline',false);show('my-profile',false);myProfileLoaded=false;await leaveChat();return;}$('account').textContent=current.user_metadata?.display_name||'メンバー';try{const {data,error}=await client.from('circle_profiles').select('status,is_admin').eq('user_id',user.id).single();if(error)throw error;show('pending',data.status==='pending');show('rejected',data.status==='rejected');show('chat',data.status==='approved');show('timeline',data.status==='approved');if(data.status!=='approved'){kmStopNotifications();await leaveChat();}$('km-session-loading')?.classList.add('hide');if(data.status==='approved'){kmStartNotifications();kmLoadBlocks().then(()=>{loadTimeline();loadRooms()});if(!myProfileLoaded)loadMyProfile();}kmSetNavReady(data.status==='approved');show('admin',data.status==='approved'&&data.is_admin);window.kmIsAdmin=data.status==='approved'&&!!data.is_admin;$('km-nav-admin')?.classList.toggle('hide',!window.kmIsAdmin);if(!window.kmIsAdmin&&window.kmActiveTab==='admin'){window.kmActiveTab='timeline';const u=new URL(location.href);u.searchParams.delete('tab');history.replaceState(null,'',u.pathname+u.search+u.hash)}kmPaintImagePicker();if(data.status==='approved'&&data.is_admin)loadRequests();}catch(e){kmSetNavReady(false);note('プロフィール取得エラー: '+safeError(e),'error')}}
// ブロックしたメンバー（自分の画面から投稿・コメント・チャットを隠す）
let kmBlocked=new Set();
window.kmIsBlocked=id=>kmBlocked.has(id);
async function kmLoadBlocks(){if(!current)return;/* 自分のブロック一覧は端末に30分覚える（変えたら消す。js/device-cache.js） */const kmF=()=>client.from('user_blocks').select('blocked_id').eq('blocker_id',current.id);const {data,error}=await (window.kmDC?window.kmDC.mine.get('blocks',current.id,1800e3,kmF):kmF());if(!error)kmBlocked=new Set((data||[]).map(r=>r.blocked_id));await window.kmLoadMutes?.()}
let myProfileLoaded=false,myAvatarUrl=null;
function profileStatus(t){$('my-profile-status').textContent=t||''}
/* アイコン写真の署名URLは7日間有効で作り、端末に保存して6日間は同じURLを使い回す。
   URLが変わらないので、ブラウザが写真を覚えておけて、毎回ダウンロードしなくて済む（通信量の節約） */
const KM_AVATAR_SIGN_SEC=7*86400,KM_AVATAR_REUSE_MS=6*86400000,KM_AVATAR_KEY='km-avatar-urls-v1';
const kmAvatarStore=(()=>{let m;try{m=new Map(Object.entries(JSON.parse(localStorage.getItem(KM_AVATAR_KEY)||'{}')))}catch{m=new Map()}const now=Date.now();for(const [k,v] of m)if(!(v?.exp>now)||typeof v.url!=='string')m.delete(k);return m})();
function kmAvatarSave(){try{const rows=[...kmAvatarStore].sort((a,b)=>b[1].exp-a[1].exp).slice(0,400);localStorage.setItem(KM_AVATAR_KEY,JSON.stringify(Object.fromEntries(rows)))}catch{}}
async function kmAvatarUrls(paths){
  const now=Date.now(),out=new Map(),need=[];
  for(const p of new Set((paths||[]).filter(Boolean))){const c=kmAvatarStore.get(p);if(c?.exp>now)out.set(p,c.url);else need.push(p)}
  if(need.length){
    const {data,error}=await client.storage.from('kimetomo-profile-avatars').createSignedUrls(need,KM_AVATAR_SIGN_SEC);
    if(error)console.warn('アイコンURLの作成:',error.message);
    for(const d of data||[])if(d.signedUrl&&d.path){kmAvatarStore.set(d.path,{url:d.signedUrl,exp:now+KM_AVATAR_REUSE_MS});out.set(d.path,d.signedUrl)}
    kmAvatarSave();
  }
  return out;
}
async function getAvatarUrl(path){if(!path)return null;return (await kmAvatarUrls([path])).get(path)||null}
/* 上部（タイムライン・グループ）の自分の名前の横に、プロフィール写真を出す。写真がなければ名前の1文字目 */
function kmPaintHeaderAvatar(url,name){const box=$('my-avatar');if(!box)return;const letter=()=>{box.replaceChildren();box.textContent=(name||'友').slice(0,1)};if(!url){letter();return}const img=document.createElement('img');img.alt='';img.decoding='async';img.src=url;img.style.cssText='position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:cover;display:block';img.onerror=letter;box.style.position='relative';box.style.overflow='hidden';box.replaceChildren(img)}
/* 📧 メール通知（任意）：登録・確認メール・コメント返信／DMごとのオンオフ（supabase/email_notify.sql・functions/kimetomo-email） */
async function kmEmailLoad(){const st=$('km-email-state');if(!st||!current)return;try{/* 開いたときの1回目だけ、端末に30分覚えた設定を使う */const kmF=()=>client.rpc('kimetomo_my_email');const kmFirst=!window.kmEmailLoaded;window.kmEmailLoaded=true;if(!kmFirst)window.kmDC?.mine.forget('email');const {data,error}=await (window.kmDC?window.kmDC.mine.get('email',current.id,1800e3,kmF):kmF());if(error)throw error;kmEmailPaint(Array.isArray(data)?data[0]:data)}catch(e){st.textContent='メール通知の設定を読み込めません: '+safeError(e)}}
function kmEmailPaint(r){const has=!!r?.email,ok=has&&r.verified;$('km-email-input').value=r?.email||'';$('km-email-badge').textContent=ok?'（登録済み）':has?'（確認待ち）':'';$('km-email-state').textContent=!has?'まだ登録していません。':ok?'✅ 登録済みです。下のチェックで、知らせる内容を選べます。':'確認待ちです。下の案内を見てください。';$('km-email-save').textContent=has&&!ok?'確認メールをもう一度送る':has?'メールアドレスを変更する':'登録して確認メールを送る';for(const [id,k] of [['km-email-reply','notify_reply'],['km-email-dm','notify_dm']]){const c=$(id);c.checked=ok&&!!r[k];c.disabled=!ok}$('km-email-remove').classList.toggle('hide',!has);$('km-email-help').classList.toggle('hide',!(has&&!ok))}
async function kmEmailInvokeError(r){let m=r.error?.message||'送信に失敗しました';try{const j=await r.error.context.json();if(j?.error)m=j.error}catch{}return new Error(m)}
$('km-email-save').onclick=async()=>{const b=$('km-email-save'),st=$('km-email-state'),email=$('km-email-input').value.trim();if(!email){st.textContent='メールアドレスを入力してください。';return}b.disabled=true;st.textContent='送信中…';try{const {data,error}=await client.rpc('kimetomo_set_email',{p_email:email});if(error)throw error;if(data==='sent'){const r=await client.functions.invoke('kimetomo-email',{body:{action:'send_verify'}});if(r.error)throw await kmEmailInvokeError(r)}await kmEmailLoad()}catch(e){st.textContent=safeError(e)}finally{b.disabled=false}};
for(const id of ['km-email-reply','km-email-dm'])$(id).onchange=async()=>{const st=$('km-email-state');try{const {error}=await client.rpc('kimetomo_set_email_notify',{p_reply:$('km-email-reply').checked,p_dm:$('km-email-dm').checked});if(error)throw error;st.textContent='✅ 保存しました。'}catch(e){st.textContent='保存できません: '+safeError(e);await kmEmailLoad()}};
$('km-email-remove').onclick=async()=>{if(!confirm('メールアドレスの登録をやめますか？\nメールでのお知らせが届かなくなります。'))return;try{const {error}=await client.rpc('kimetomo_set_email',{p_email:''});if(error)throw error;await kmEmailLoad()}catch(e){$('km-email-state').textContent=safeError(e)}};
(()=>{const r=new URLSearchParams(location.search).get('email');if(!r)return;const msg={verified:'✅ メールアドレスの登録が完了しました。コメント・返信やDMが届くと、メールでもお知らせします。','off-dm':'DMのメール通知をオフにしました。プロフィール画面からいつでもオンに戻せます。','off-reply':'コメント・返信のメール通知をオフにしました。プロフィール画面からいつでもオンに戻せます。',invalid:'リンクが無効か、期限が切れています。プロフィール画面からもう一度お試しください。'}[r];try{history.replaceState(null,'',location.pathname+location.hash)}catch{}if(msg)setTimeout(()=>alert(msg),300)})();
(async()=>{const q=new URLSearchParams(location.search),v=q.get('email_verify'),off=q.get('email_off'),kind=q.get('kind');if(!v&&!off)return;window.kmDC?.mine.forget('email');try{history.replaceState(null,'',location.pathname+location.hash)}catch{}let ok=false;try{const r=await fetch('https://hazcwbczsswjptvblpwt.supabase.co/functions/v1/kimetomo-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(v?{action:'verify',token:v}:{action:'off',token:off,kind})});ok=!!(await r.json()).ok}catch{}const msg=!ok?'リンクが無効か、期限が切れています。プロフィール画面からもう一度お試しください。':v?'✅ メールアドレスの登録が完了しました。コメント・返信やDMが届くと、メールでもお知らせします。':kind==='dm'?'DMのメール通知をオフにしました。プロフィール画面からいつでもオンに戻せます。':'コメント・返信のメール通知をオフにしました。プロフィール画面からいつでもオンに戻せます。';setTimeout(()=>alert(msg),300);if(ok&&current)kmEmailLoad()})();
async function loadMyProfile(){if(!current)return;profileStatus('読み込み中…');try{/* 自分のプロフィールは端末に10分覚える（保存したら消す） */const kmF=()=>client.from('kimetomo_user_profiles').select('display_name,bio,avatar_path,gender,age_range,gender_hidden').eq('user_id',current.id).maybeSingle();let {data,error}=await (window.kmDC?window.kmDC.mine.get('profile',current.id,600e3,kmF):kmF());if(error&&/gender_hidden/.test(error.message||''))({data,error}=await client.from('kimetomo_user_profiles').select('display_name,bio,avatar_path,gender,age_range').eq('user_id',current.id).maybeSingle());if(error&&/gender|age_range/.test(error.message||'')){({data,error}=await client.from('kimetomo_user_profiles').select('display_name,bio,avatar_path').eq('user_id',current.id).maybeSingle())}if(error)throw error;$('my-profile-gender').value=data?.gender||'';$('my-profile-age').value=data?.age_range||'';window.kmPaintGenderSelect?.();window.kmGenderSet?.(current.id,data?.gender_hidden?'':(data?.gender||''));$('km-my-tags').replaceChildren(...(window.kmProfileTags?.(data)||[]));const name=data?.display_name||current.user_metadata?.display_name||'メンバー';$('my-profile-name').value=name;window.kmMyName=name;$('my-profile-bio').value=data?.bio||'';$('km-bio-view').textContent=data?.bio?.trim()||'自己紹介はまだありません。「編集」から書いてみよう';$('my-profile-title').textContent=name;$('km-login-id').textContent=current.user_metadata?.username||current.user_metadata?.display_name||'（メールアドレスでログイン）';if(current.user_metadata?.username)kmRememberName(current.user_metadata.username);$('my-avatar').textContent=name.slice(0,1);$('my-avatar-fallback').textContent=name.slice(0,1);$('account').textContent=name;$('account').dataset.kmUid=current.id;if(current&&(await kimetomoFetchAdmins(client)).has(current?.id))$('account').append(kimetomoCrown());const url=await getAvatarUrl(data?.avatar_path);myAvatarUrl=url;const preview=$('my-avatar-preview');preview.style.display=url?'block':'none';$('my-avatar-fallback').style.display=url?'none':'grid';if(url)preview.src=url;kmPaintHeaderAvatar(url,name);profileStatus('');myProfileLoaded=true;kmEmailLoad();Promise.resolve(window.kmSafetyLoad?.()).catch(()=>{}).then(()=>window.kmWomenGuide?.(data?.gender))}catch(e){profileStatus('読み込み失敗: '+safeError(e))}}
async function makeAvatar(file){if(!file.type.startsWith('image/')||file.type==='image/gif')throw Error('写真（画像）を選んでください');if(!file.size||file.size>50*1024*1024)throw Error('写真は50MB以下にしてください');const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();if(img.width*img.height>100000000)throw Error('画像が大きすぎます');const scale=Math.min(1,320/img.width,320/img.height);const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('画像変換に失敗しました')),'image/jpeg',.75));if(blob.type!=='image/jpeg')throw Error('このブラウザではJPEG画像に変換できません');if(blob.size>2*1024*1024)throw Error('圧縮後の画像が2MBを超えました');return blob}finally{URL.revokeObjectURL(url)}}
async function saveMyProfile(){if(!current)return;window.kmDC?.authors.forget(current.id);window.kmDC?.mine.forget();const name=$('my-profile-name').value.trim(),bio=$('my-profile-bio').value.trim(),file=$('my-profile-photo').files?.[0];if(!name||name.length>60||bio.length>200){profileStatus('名前は1〜60文字、自己紹介は200文字以内で入力してください');return}busy('my-profile-save',true);profileStatus('保存中…');try{{const {data:impOk}=await client.rpc('kimetomo_imp_name_ok',{p_name:name});if(impOk===false){profileStatus('管理者になりすます事はできません。');return}}const kmRenamed=name.toLowerCase()!==String(window.kmMyName||'').toLowerCase();if(kmRenamed){/* 名前でもログインできるので、ほかの人と同じ名前にはしない（supabase/login_by_name.sql） */const {data:taken}=await client.rpc('kimetomo_name_taken',{p_name:name.normalize('NFC')});if(taken===true){profileStatus('この名前は、ほかの人が使っています。少し変えてください（例：数字や絵文字を足す）。');return}}let avatar_path; if(file){const blob=window.kmAvatarCropBlob||await makeAvatar(file);avatar_path=current.id+'/'+crypto.randomUUID()+'.jpg';const {error:upError}=await client.storage.from('kimetomo-profile-avatars').upload(avatar_path,blob,{contentType:'image/jpeg',upsert:false,cacheControl:'31536000'});if(upError)throw upError}const row={user_id:current.id,display_name:name,bio,gender:$('my-profile-gender').value||null,age_range:$('my-profile-age').value||null};if(avatar_path)row.avatar_path=avatar_path;let {error}=await client.from('kimetomo_user_profiles').upsert(row,{onConflict:'user_id'});if(error&&/gender|age_range/.test(error.message||'')){delete row.gender;delete row.age_range;({error}=await client.from('kimetomo_user_profiles').upsert(row,{onConflict:'user_id'}));if(!error)profileStatus('性別・年齢は、まだ保存できません（gender_age.sql を実行してください）')}if(error)throw error;$('my-profile-photo').value='';window.kmAvatarCropBlob=null;await loadMyProfile();$('km-profile-edit').classList.add('hide');$('km-profile-edit-btn').textContent='✏️ 編集';await loadTimeline();const kmLid=current.user_metadata?.username;profileStatus(kmRenamed&&kmLid&&kmLid.toLowerCase()!==name.toLowerCase()?'保存しました。これからは、今の名前「'+name+'」でも、登録したときの名前「'+kmLid+'」でもログインできます。':'保存しました')}catch(e){profileStatus('保存失敗: '+safeError(e))}finally{busy('my-profile-save',false)}}
$('my-profile-open').onclick=async()=>{if(window.kmActiveTab!=='profile'){document.querySelector('.km-bottom-nav [data-km-go="profile"]')?.click();return}show('my-profile',true);await loadMyProfile();$('my-profile').scrollIntoView({behavior:'smooth',block:'start'})};$('my-profile-close').onclick=()=>show('my-profile',false);$('my-profile-save').onclick=saveMyProfile;
const KM_LOGIN_DOMAIN='users.kimetomo.example';
const KM_USERNAME_PATTERN=/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々〆ヶA-Za-z0-9]{3,20}$/u;
function kmNormalizeUsername(name){return name.trim().normalize('NFC').toLowerCase()}
async function kmUsernameEmail(name){
 const normalized=kmNormalizeUsername(name);
 // 半角英数字だけの既存アカウントは認証先を変更しない。
 if(/^[a-z0-9]{3,20}$/.test(normalized))return normalized+'@'+KM_LOGIN_DOMAIN;
 // 日本語はSupabase Authのメールローカル部に直接使用せず、SHA-256で固定長に変換する。
 const bytes=new TextEncoder().encode('kimetomo-username-v1:'+normalized);
 const hash=await crypto.subtle.digest('SHA-256',bytes);
 const hex=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
 return 'jp-'+hex+'@'+KM_LOGIN_DOMAIN;
}
// ログインに使うアドレスを探す：ログインIDならそのまま、表示名を変えた人は「今の名前」からも探す（supabase/login_by_name.sql）
async function kmLoginEmail(name){
 const email=await kmUsernameEmail(name);
 try{const {data,error}=await client.rpc('kimetomo_login_email',{p_name:name.trim().normalize('NFC'),p_email:email});if(!error&&typeof data==='string'&&data)return data}catch{}
 return email;
}
/* 🔑 パスワードを忘れた方：確認済みのメール通知アドレスに再設定リンクを送る（functions/kimetomo-email・supabase/password_reset.sql） */
const KM_EMAIL_FN='https://hazcwbczsswjptvblpwt.supabase.co/functions/v1/kimetomo-email';
async function kmEmailFn(body){const r=await fetch(KM_EMAIL_FN,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});let j={};try{j=await r.json()}catch{}if(!r.ok&&!j.error)j.error='通信に失敗しました（'+r.status+'）';return j}
let kmPwrToken=null;
function kmPwrOpen(mode){show('auth',false);show('km-pw-reset',true);$('km-pwr-request').classList.toggle('hide',mode!=='request');$('km-pwr-set').classList.toggle('hide',mode!=='set');$('km-pwr-status').textContent='';requestAnimationFrame(()=>$('km-pw-reset').scrollIntoView({block:'start'}))}
function kmPwrClose(){show('km-pw-reset',false);kmPwrToken=null;if(!current){show('auth',true);authMode('login')}}
$('km-forgot').onclick=()=>{$('km-pwr-login').value=$('km-username')?.value||'';kmPwrOpen('request')};
$('km-pwr-back').onclick=kmPwrClose;
$('km-pwr-send').onclick=async()=>{const st=$('km-pwr-status'),b=$('km-pwr-send'),v=$('km-pwr-login').value.trim();if(!v){st.textContent='ユーザー名を入力してください。';return}b.disabled=true;st.textContent='送信中…';try{const login_email=v.includes('@')?v.toLowerCase():await kmLoginEmail(v);const j=await kmEmailFn({action:'pw_reset_request',login_email});if(j.error)throw new Error(j.error);st.textContent='📩 確認済みのメールアドレスが登録されていれば、再設定のメールを送りました（差出人：noreply@kimetomo.com、件名「【キメ友】パスワードの再設定」）。届かないときは、迷惑メールのフォルダも見てください。再設定のメールは10分に1回まで送れます。'}catch(e){st.textContent=safeError(e)}finally{b.disabled=false}};
$('km-pwr-save').onclick=async()=>{const st=$('km-pwr-status'),b=$('km-pwr-save'),p1=$('km-pwr-new').value,p2=$('km-pwr-new2').value;if(p1.length<8){st.textContent='パスワードは8文字以上にしてください。';return}if(p1!==p2){st.textContent='確認用のパスワードが一致しません。';return}b.disabled=true;st.textContent='変更中…';try{const j=await kmEmailFn({action:'pw_reset',token:kmPwrToken,password:p1});if(j.error)throw new Error(j.error);$('km-pwr-new').value='';$('km-pwr-new2').value='';alert('✅ パスワードを変更しました。新しいパスワードでログインしてください。');kmPwrClose()}catch(e){st.textContent=safeError(e)}finally{b.disabled=false}};
(async()=>{const tok=new URLSearchParams(location.search).get('pw_reset');if(!tok)return;try{history.replaceState(null,'',location.pathname+location.hash)}catch{}const j=await kmEmailFn({action:'pw_reset_check',token:tok}).catch(()=>({}));if(!j.ok){alert('再設定のリンクが無効か、期限（1時間）が切れています。もう一度「パスワードを忘れた方」からお試しください。');return}kmPwrToken=tok;kmPwrOpen('set')})();
// ===== 招待リンク =====
(()=>{const v=new URLSearchParams(location.search).get('invite');if(v&&/^[0-9a-f]{12}$/i.test(v)){try{localStorage.setItem('km-invite-code',v.toLowerCase())}catch{}}})();
const kmInviteCode=()=>{try{return localStorage.getItem('km-invite-code')||''}catch{return ''}};
let kmInviteOk=false;
async function kmInviteCheck(){
 const el=$('km-invite-note');if(!el)return;
 kmWaitlistShow(false);
 if(mode!=='signup'){el.style.display='none';return}
 el.style.display='block';kmInviteOk=false;kmPublicCode='';
 const code=kmInviteCode();
 if(!code)return kmPublicCheck(el,'');
 el.className='km-invite-note';el.textContent='招待リンクを確認しています…';
 try{
  let st;const r=await client.rpc('kimetomo_invite_status',{p_code:code});
  if(r.error){const {data,error}=await client.rpc('kimetomo_check_invite',{p_code:code});if(error)throw error;st=data?'ok':'used'}else st=r.data;
  kmInviteKind=st==='ok_open'?'open':'single';
  // 管理者の招待URLからは、同じスマホで1日1個まで
  if(st==='ok_open'&&kmOpenSignupToday()){kmInviteOk=false;el.className='km-invite-note bad';el.textContent='⚠️ このスマホからは、今日はもう新規登録されています。明日また試してください。';return}
  // 管理者が作り直して止めた古いURL・QRコード：先着では登録させず、順番待ちだけ（supabase/waitlist_revoked.sql）
  if(st==='revoked'){el.className='km-invite-note bad';el.textContent='⚠️ このURL・QRコードは、いまは使えません。下の順番待ちに Gmail を登録すると、招待リンクをメールでお送りします。';kmWaitlistShow(true);return}
  // 使えない招待リンクでも、先着の枠が空いていればそちらで登録できる
  if(st==='used'||st==='expired'||st==='none')return kmPublicCheck(el,'この招待リンクは使用済み・期限切れでした。');
  kmInviteOk=st==='ok'||st==='ok_open';el.className='km-invite-note '+(kmInviteOk?'ok':'bad');
  el.textContent=kmInviteOk?'✅ 招待リンクを確認しました。このまま登録できます。':st==='full'?'⚠️ 今日の新規登録の受付人数がいっぱいになりました。明日また試してください。':'⚠️ この招待リンクは使えません（使用済み・期限切れ）。招待してくれた人に新しいリンクをもらってください。';
 }catch(e){el.className='km-invite-note bad';el.textContent='招待リンクを確認できませんでした: '+safeError(e)}
}
// 招待リンクがない人：先着の枠（管理者の招待URLと共通・1日の上限あり）で登録できる（supabase/public_signup.sql）
let kmPublicCode='';
async function kmPublicCheck(el,prefix){
 const closed=()=>{el.className='km-invite-note bad';el.textContent=prefix+'🔒 キメ友は招待制です。メンバーから招待リンクをもらって、そのリンクから開いてください。';kmWaitlistShow(true)};
 el.className='km-invite-note';el.textContent='今日の受付を確認しています…';
 try{
  const {data,error}=await client.rpc('kimetomo_public_signup');if(error)throw error;
  const r=Array.isArray(data)?data[0]:data;
  if(!r||r.status==='off')return closed();
  if(r.status==='full'){el.className='km-invite-note bad';el.textContent=prefix+'⏰ 今日の新規登録の受付（先着）は終わりました。毎日 0 時にまた受付を始めます。メンバーから招待リンクをもらえば、今日でも登録できます。';kmWaitlistShow(true);return}
  if(kmOpenSignupToday()){el.className='km-invite-note bad';el.textContent='⚠️ このスマホからは、今日はもう新規登録されています。明日また試してください。';return}
  kmPublicCode=r.code||'';kmInviteKind='open';kmInviteOk=!!kmPublicCode;
  el.className='km-invite-note '+(kmInviteOk?'ok':'bad');
  el.textContent=kmInviteOk?prefix+'🌱 招待リンクがなくても、先着で登録できます（今日の受付：あと '+r.remaining+' 人）。':prefix+'登録の受付を確認できませんでした。';
 }catch(e){closed()}
}
// 受付が終わった日：メールアドレスを預かって、管理者が招待リンクを送る（supabase/waitlist.sql）
function kmWaitlistShow(on){
 let box=$('km-waitlist');
 if(!on){if(box)box.remove();return}
 if(box)return;
 const note=$('km-invite-note');if(!note)return;
 const mk=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
 box=mk('div','km-waitlist');box.id='km-waitlist';
 const shownAt=Date.now();
 const inp=mk('input');inp.type='email';inp.inputMode='email';inp.autocomplete='email';inp.placeholder='例：kimetomo@gmail.com';inp.maxLength=254;
 const btn=mk('button','ghost','📩 順番待ちに登録');btn.type='button';
 const msg=mk('p','small');msg.setAttribute('role','status');
 btn.onclick=async()=>{
  const email=inp.value.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){msg.textContent='メールアドレスを正しく入れてください。';return}
  if(!/@(gmail|googlemail)\.com$/i.test(email)){msg.textContent='Gmail（〜@gmail.com）のアドレスを入れてください。';return}
  btn.disabled=true;msg.textContent='送っています…';
  try{
   const {data,error}=await client.rpc('kimetomo_waitlist_join',{p_email:email,p_fill_ms:Date.now()-shownAt,p_hp:$('km-hp-field')?.value||'',p_code:kmInviteCode()||null});
   if(error)throw error;
   if(data==='open'){msg.textContent='受付が始まりました。このまま新規登録できます。';kmInviteCheck();return}
   if(data==='bad'){msg.textContent='メールアドレスを正しく入れてください。';btn.disabled=false;return}
   if(data==='notgmail'){msg.textContent='Gmail（〜@gmail.com）のアドレスを入れてください。';btn.disabled=false;return}
   if(data==='many'){msg.textContent='いま順番待ちがいっぱいです。日を改めて試してください。';btn.disabled=false;return}
   inp.value='';inp.disabled=true;btn.textContent='✓ 登録しました';
   msg.textContent='順番待ちに登録しました。管理者から、このアドレスに招待リンクをメールで送ります（kimetomo.com から届きます。迷惑メールのフォルダも見てください）。';
  }catch(e){msg.textContent='登録できませんでした: '+safeError(e);btn.disabled=false}
 };
 box.append(mk('strong','','📩 順番待ち'),mk('p','small','Gmail のアドレスを入れておくと、管理者から招待リンクをメールで送ります。アドレスは招待を送ったらすぐ消します（送らなかった場合も 14 日で消えます）。'),inp,btn,msg);
 note.after(box);
}
let kmInviteKind='single';
const kmJstDay=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
const kmOpenSignupToday=()=>{try{return localStorage.getItem('km-open-signup-day')===kmJstDay()}catch{return false}};
function kmAuthMessage(err){const m=err?.message||String(err);if(err?.code==='weak_password'||/weak|pwned|leaked|easy to guess|characters long/i.test(m))return 'このパスワードは使えません。ほかのサイトで漏れたことがあるパスワードか、かんたんすぎるパスワードです。8文字以上の、ほかで使っていないパスワードにしてください。';if(mode==='signup'&&/database error saving new user/i.test(m)){kmInviteCheck();return '登録できませんでした。招待リンクが使用済み・期限切れ・今日の受付がいっぱいになったか、ユーザー名に使えない言葉が含まれています。'};if(/already registered|already exists|user already registered|duplicate/i.test(m))return 'このユーザー名はすでに使われています。別の名前を入力してください。';if(/email not confirmed/i.test(m))return 'Supabaseでメール確認が有効です。管理人に確認してください。';if(/invalid login credentials/i.test(m))return 'ユーザー名またはパスワードが違います。\n・今の名前か、登録したときの名前（ログインID）で入力してください\n・ほかの人と同じ名前に変えている人は、登録したときの名前で入力してください\n・下の「🆘 ログインできない方へ」も見てください';if(/rate limit|too many requests/i.test(m))return '操作が集中しています。少し時間をおいてください。';if(/使えない言葉/.test(m))return m.replace(/。内容を変えて.*$/,'')+'。別のユーザー名にしてください。';if(/database error saving new user/i.test(m))return 'このユーザー名は使えません。別のユーザー名にしてください。';return safeError(err)}
let kmNameTimer=null,kmNameSeq=0,kmLastName='',kmLastAvailable=null,kmChecking=false;
function kmAvailabilityText(message,status){
 const el=$('km-name-availability');el.textContent=message;el.style.display=mode==='signup'?'block':'none';
 el.style.color=status==='ok'?'#86efac':status==='bad'?'#fca5a5':'#e6c5d4';
}
function kmResetAvailability(){
 clearTimeout(kmNameTimer);kmNameSeq++;kmLastName='';kmLastAvailable=null;kmChecking=false;
 $('auth-submit').disabled=false;
 if(mode==='signup')kmQueueUsernameCheck();else $('km-name-availability').style.display='none';
}
function kmQueueUsernameCheck(){
 clearTimeout(kmNameTimer);
 const seq=++kmNameSeq;
 const name=$('km-username').value.trim().normalize('NFC');
 kmLastName='';kmLastAvailable=null;kmChecking=false;
 if(mode!=='signup')return;
 if(!KM_USERNAME_PATTERN.test(name)){
   kmAvailabilityText(name?'ユーザー名は日本語・半角英数字3〜20文字で入力してください。':'ユーザー名を入力すると、使えるかどうかを確認します。','neutral');return;
 }
 kmChecking=true;kmAvailabilityText('ユーザー名を確認中…','neutral');
 kmNameTimer=setTimeout(async()=>{
  try{
   const {data,error}=await client.rpc('kimetomo_username_exists',{p_username:kmNormalizeUsername(name)});
   if(seq!==kmNameSeq||mode!=='signup')return;
   if(error)throw error;
   if(typeof data!=='boolean')throw Error('unexpected result');
   kmLastName=kmNormalizeUsername(name);kmLastAvailable=!data;
   kmAvailabilityText(data?'このユーザー名はすでに使われています。':'✓ このユーザー名は使用できます。',data?'bad':'ok');
  }catch(e){
   if(seq!==kmNameSeq||mode!=='signup')return;
   kmAvailabilityText('重複を確認できません。管理人に確認してください。','bad');
  }finally{if(seq===kmNameSeq)kmChecking=false;}
 },450);
}
async function kmEnsureUsernameAvailable(name){
 const normalized=kmNormalizeUsername(name);
 if(kmLastName===normalized&&kmLastAvailable===false)throw Error('このユーザー名はすでに使われています。');
 const {data,error}=await client.rpc('kimetomo_username_exists',{p_username:normalized});
 if(error||typeof data!=='boolean')throw Error('ユーザー名の重複確認ができません。SQLが設定されているか確認してください。');
 if(data){kmLastName=normalized;kmLastAvailable=false;kmAvailabilityText('このユーザー名はすでに使われています。','bad');throw Error('このユーザー名はすでに使われています。');}
 kmLastName=normalized;kmLastAvailable=true;kmAvailabilityText('✓ このユーザー名は使用できます。','ok');
}
$('km-username').addEventListener('input',kmQueueUsernameCheck);
function authMode(m){mode=m;if(m==='signup'&&!window.kmSignupShownAt)window.kmSignupShownAt=Date.now();$('auth-title').textContent=m==='signup'?'新規登録':'ログイン';$('auth-submit').textContent=m==='signup'?'アカウントを作成':'ログインする';$('tab-login').className=m==='login'?'':'ghost';$('tab-signup').className=m==='signup'?'':'ghost';$('password').autocomplete=m==='signup'?'new-password':'current-password';$('km-pw2-wrap').style.display=m==='signup'?'block':'none';if($('km-forgot'))$('km-forgot').style.display=m==='login'?'':'none';if($('km-login-help'))$('km-login-help').style.display=m==='login'?'':'none';if($('km-username-label'))$('km-username-label').textContent=m==='signup'?'ユーザー名（ログインに使う名前・日本語や半角英数字3〜20文字）':'ユーザー名（今の名前か、登録したときの名前）';if(m!=='login'&&$('km-last-hint'))$('km-last-hint').style.display='none';$('km-legacy-auth').style.display=(m==='login' && new URLSearchParams(location.search).get('legacy')==='1')?'block':'none';$('km-signup-help').textContent=m==='signup'?'ユーザー名はログインに使う名前です（あとからプロフィールで変えられる「表示名」とは別で、変更できません）。英字の大文字・小文字は区別しません。パスワードは再発行できないので、「👁」で確認してから登録し、iPhoneの「パスワードを保存」もおすすめです。':'今の名前か、登録したときのユーザー名と、パスワードでログインできます。';kmResetAvailability();kmInviteCheck();}
function kmRememberName(n){try{localStorage.setItem('km-last-username',n)}catch{}}
async function submit(){
 const username=$('km-username').value.trim(),password=$('password').value;
 note('');
 // メールアドレスが入力されたら、メールアドレスでのログインとして扱う（管理者など以前からのアカウント用）
 if(mode==='login'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)){
  if(!password){note('パスワードを入力してください。','error');return}
  if(!kmCaptcha.ready()){note('ロボットでないことの確認中です。少し待ってから、もう一度押してください。','error');return}
  busy('auth-submit',true);
  try{const {data,error}=await client.auth.signInWithPassword({email:username,password,options:{captchaToken:kmCaptcha.token()}});if(error)throw error;if(data?.user)await sync(data.user);note('ログインしました','success')}
  catch(e){note(kmAuthMessage(e),'error')}finally{busy('auth-submit',false);kmCaptcha.reset()}
  return;
 }
 if(mode==='login'&&(!username||username.length>60)){note('ユーザー名（今の名前か、登録したときの名前）を入力してください。','error');return}
 if(mode==='signup'&&!KM_USERNAME_PATTERN.test(username.normalize('NFC'))){note('ユーザー名は日本語・半角英数字3〜20文字で入力してください（空白・記号不可）。','error');return}
 if(password.length<8){note('パスワードは8文字以上にしてください。','error');return}
 if(mode==='signup'){try{const {data:taken}=await client.rpc('kimetomo_name_taken',{p_name:username.normalize('NFC')});if(taken===true){note('この名前は、ほかの人が名前として使っています。別のユーザー名にしてください。','error');return}}catch{}}
 if(mode==='signup'){const ng=window.kmNgHit?.(username)||window.kmMinorHit?.(username);if(ng){note('このユーザー名には使えない言葉（「'+ng+'」）が含まれています。別のユーザー名にしてください。','error');return}}
 if(mode==='signup'){try{const {data:impOk}=await client.rpc('kimetomo_imp_name_ok',{p_name:username});if(impOk===false){note('管理者になりすます事はできません。','error');return}}catch{}}
 if(mode==='signup'&&!kmInviteOk){note(kmInviteCode()?'この招待リンクは使えません。招待してくれた人に新しいリンクをもらってください。':'キメ友は招待制です。メンバーから招待リンクをもらってください。','error');kmInviteCheck();return}
 if(mode==='signup'&&password!==$('password2').value){note('確認用のパスワードが一致しません。もう一度入力してください。','error');return}
 if(!kmCaptcha.ready()){note('ロボットでないことの確認中です。少し待ってから、もう一度押してください。','error');return}
 const email=mode==='login'?await kmLoginEmail(username):await kmUsernameEmail(username);
 busy('auth-submit',true);
 try{
  if(mode==='signup'){
   // Supabase Auth のメールアドレス一意制約によって、同じユーザー名の重複を防止。
   // 登録時の名前はログインIDとは独立した表示名として扱う。
   await kmEnsureUsernameAvailable(username);
   const display_name=username;
   const {data,error}=await client.auth.signUp({email,password,options:{data:{display_name,username:kmNormalizeUsername(username),invite_code:kmPublicCode||kmInviteCode(),km_form:'v1',km_fill_ms:Date.now()-(window.kmSignupShownAt||0),km_hp:$('km-hp-field')?.value||''},captchaToken:kmCaptcha.token()}});
   if(error)throw error;
   if(data?.session?.user){kmRememberName(username);try{localStorage.removeItem('km-invite-code');if(kmInviteKind==='open')localStorage.setItem('km-open-signup-day',kmJstDay())}catch{}await sync(data.session.user);note('登録が完了しました。キメ友SNSへようこそ！','success');}
   else {note('登録後の自動ログインができませんでした。Supabaseの「Confirm email」をOFFにする必要があります。なお、登録済みのユーザー名は再使用できません。','error');}
  }else{
   const {data,error}=await client.auth.signInWithPassword({email,password,options:{captchaToken:kmCaptcha.token()}});
   if(error)throw error;
   if(data?.user){kmRememberName(data.user.user_metadata?.username||username);await sync(data.user);}
   note('ログインしました','success');
  }
 }catch(e){note(kmAuthMessage(e),'error')}
 finally{busy('auth-submit',false);kmCaptcha.reset()}
}
$('km-legacy-login').onclick=async()=>{
 const email=$('km-legacy-email').value.trim(),password=$('password').value;
 if(!email||!password){note('登録済みメールアドレスとパスワードを入力してください。','error');return}
 if(!kmCaptcha.ready()){note('ロボットでないことの確認中です。少し待ってから、もう一度押してください。','error');return}
 busy('km-legacy-login',true);note('');
 try{const {data,error}=await client.auth.signInWithPassword({email,password,options:{captchaToken:kmCaptcha.token()}});if(error)throw error;if(data?.user)await sync(data.user);note('ログインしました','success')}
 catch(e){note(kmAuthMessage(e),'error')}finally{busy('km-legacy-login',false);kmCaptcha.reset()}
};

// 公開プロフィールと非公開Storageの写真を安全に読み込む（メールは取得しない）
async function kmReadAuthorRows(userIds){
  const profiles=new Map();
  if(!userIds.length)return profiles;
  // 端末に覚えている人（3時間以内）はそのまま使い、知らない人の分だけ Supabase に聞く（js/device-cache.js）
  const {hit,miss}=window.kmDC?window.kmDC.authors.read(userIds):{hit:new Map(),miss:[...new Set(userIds)]};
  for(const [id,c] of hit)if(!c.x)profiles.set(id,{name:c.n,path:c.p||null});
  if(miss.length){
  const got=new Map();
  const [publicRows,photoRows]=await Promise.all([
    client.from('circle_profiles').select('user_id,display_name').in('user_id',miss),
    client.from('kimetomo_user_profiles').select('user_id,display_name,avatar_path').in('user_id',miss)
  ]);
  if(publicRows.error)console.warn('表示名の取得:',publicRows.error.message);
  for(const p of publicRows.data||[])got.set(p.user_id,{name:p.display_name||'メンバー',path:null});
  if(photoRows.error)console.warn('公開プロフィールの取得:',photoRows.error.message);
  for(const p of photoRows.data||[]){
    const old=got.get(p.user_id)||{name:'メンバー',path:null};
    got.set(p.user_id,{name:p.display_name||old.name,path:p.avatar_path||null});
  }
  for(const [id,p] of got)profiles.set(id,p);
  // 両方うまく読めたときだけ覚える（見つからなかった人も「いない」と覚えて、何度も聞かない）
  if(!publicRows.error&&!photoRows.error)window.kmDC?.authors.write(miss.map(id=>{const p=got.get(id);return [id,p?{n:p.name,p:p.path}:{x:1}]}));
  }
  return profiles;
}
async function timelineReadAuthors(userIds){
  const profiles=await kmReadAuthorRows(userIds);
  // 保存先はprivate。署名URLはまとめて1回で発行し、端末に保存して数日使い回す（kmAvatarUrls）
  const urls=await kmAvatarUrls([...profiles.values()].map(p=>p.path));
  for(const p of profiles.values())if(p.path&&urls.get(p.path))p.url=urls.get(p.path);
  return profiles;
}
let kmProfileOverlay=null;
function kmCloseMemberProfile(){
  if(kmProfileOverlay){kmProfileOverlay.remove();kmProfileOverlay=null;}
}
async function kmOpenMemberProfile(userId,initialProfile,admin){
  if(!current||!userId)return;
  if(userId===current.id){
    kmCloseMemberProfile();
    window.kmActiveTab='profile';
    window.kmSetNavReady(true);
    const url=new URL(location.href);url.searchParams.set('tab','profile');
    history.replaceState(null,'',url.pathname+url.search+url.hash);
    await loadMyProfile();
    document.getElementById('my-profile')?.scrollIntoView({behavior:'smooth',block:'start'});
    return;
  }
  kmCloseMemberProfile();
  const overlay=document.createElement('div');overlay.className='km-profile-overlay';
  overlay.setAttribute('role','presentation');
  const card=document.createElement('section');card.className='km-profile-card';
  card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-label','メンバープロフィール');
  const top=document.createElement('div');top.className='km-profile-top';
  const heading=document.createElement('h2');heading.textContent='プロフィール';
  const close=document.createElement('button');close.type='button';close.className='ghost';close.textContent='閉じる';
  close.onclick=kmCloseMemberProfile;top.append(heading,close);
  const avatarRow=document.createElement('div');avatarRow.style.cssText='display:flex;align-items:center;gap:14px;margin:15px 0';
  const avatar=timelineMakeAvatar(initialProfile);avatar.className='km-profile-large-avatar';
  const labels=document.createElement('div');
  const name=document.createElement('strong');name.textContent=initialProfile?.name||'メンバー';
  labels.append(name);if(admin)labels.append(kimetomoCrown());avatarRow.append(avatar,labels);
  const bio=document.createElement('p');bio.className='km-profile-bio';bio.textContent='読み込み中…';
  const dmButton=document.createElement('button');dmButton.type='button';dmButton.className='full';
  dmButton.textContent='✉ 個人チャットを送る';
  dmButton.style.cssText='width:100%;margin:12px 0 3px;min-height:44px';
  dmButton.onclick=()=>{window.location.href='./dm.html?to='+encodeURIComponent(userId)};
  const blockButton=document.createElement('button');blockButton.type='button';blockButton.className='ghost';blockButton.style.cssText='width:100%;margin:8px 0 0;min-height:44px';
  const paintBlock=()=>{const on=kmBlocked.has(userId);blockButton.textContent=on?'ブロックを解除する':'🚫 ブロックする';blockButton.className=on?'ghost':'danger'};paintBlock();
  blockButton.onclick=async()=>{const on=kmBlocked.has(userId);const who=name.textContent.replace(/管理者$/,'')||'このメンバー';
    if(!confirm(on?who+'さんのブロックを解除しますか？':who+'さんをブロックしますか？\nブロックすると、この人の投稿・コメント・チャットがあなたの画面に表示されなくなり、この人からの通知も届かなくなります。相手には知らされません。'))return;
    blockButton.disabled=true;
    window.kmDC?.mine.forget('blocks');const r=on?await client.from('user_blocks').delete().eq('blocker_id',current.id).eq('blocked_id',userId):await client.from('user_blocks').insert({blocker_id:current.id,blocked_id:userId});
    blockButton.disabled=false;
    if(r.error&&r.error.code!=='23505'){alert('操作できませんでした: '+safeError(r.error));return}
    await kmLoadBlocks();paintBlock();loadTimeline();loadChat();};
  const muteButton=window.kmMuteButton?.(userId,()=>name.textContent.replace(/管理者$/,''));if(muteButton)muteButton.style.cssText='width:100%;margin:8px 0 0;min-height:44px';
  const reportButton=userId!==current?.id&&!window.kmIsAdmin&&window.kmReportButton?window.kmReportButton(()=>({kind:'user',id:userId,userId,who:name.textContent.replace(/管理者$/,'')})):null;if(reportButton){reportButton.textContent='🚩 このメンバーを通報する';reportButton.style.cssText='width:100%;margin:10px 0 0;min-height:40px'}
  window.kmAfterReportBlock=async()=>{await kmLoadBlocks();paintBlock()};
  card.append(top,avatarRow,bio,dmButton,...(muteButton?[muteButton]:[]),blockButton,...(reportButton?[reportButton]:[]));overlay.append(card);document.body.append(overlay);kmProfileOverlay=overlay;
  overlay.addEventListener('click',event=>{if(event.target===overlay)kmCloseMemberProfile()});
  const onKey=event=>{if(event.key==='Escape'){kmCloseMemberProfile();document.removeEventListener('keydown',onKey)}};
  document.addEventListener('keydown',onKey);
  close.focus();
  try{
    let {data,error}=await client.from('kimetomo_user_profiles')
      .select('display_name,bio,avatar_path,gender,age_range,gender_hidden').eq('user_id',userId).maybeSingle();
    if(error&&/gender_hidden/.test(error.message||''))({data,error}=await client.from('kimetomo_user_profiles').select('display_name,bio,avatar_path,gender,age_range').eq('user_id',userId).maybeSingle());
    if(error&&/gender|age_range/.test(error.message||''))({data,error}=await client.from('kimetomo_user_profiles').select('display_name,bio,avatar_path').eq('user_id',userId).maybeSingle());
    if(error)throw error;
    if(kmProfileOverlay!==overlay)return;
    if(data?.display_name)window.kmDC?.authors.write([[userId,{n:data.display_name,p:data.avatar_path||null}]]);
    const shownName=data?.display_name||initialProfile?.name||'メンバー';
    name.textContent=shownName;bio.textContent=data?.bio?.trim()||'自己紹介はまだ設定されていません。';
    const kmG=data?.gender_hidden?'':(data?.gender||'');window.kmGenderSet?.(userId,kmG);const g=window.kmGenderBadge?.(kmG);if(g)name.append(g);
    const tags=window.kmProfileTags?.(data)||[];if(tags.length){const t=document.createElement('p');t.className='km-tags';t.append(...tags);bio.before(t)}
    if(data?.avatar_path){
      try{const url=await getAvatarUrl(data.avatar_path);
        if(url&&kmProfileOverlay===overlay){const img=document.createElement('img');img.className='km-profile-large-avatar';img.alt=shownName+'のプロフィール写真';img.src=url;img.onerror=()=>{img.replaceWith(avatar)};avatar.replaceWith(img)}
      }catch(err){console.warn('プロフィール画像の取得失敗',err)}
    }
  }catch(err){if(kmProfileOverlay===overlay)bio.textContent='プロフィールを読み込めません: '+safeError(err)}
}
function timelineMakeAvatar(profile){
  const name=profile?.name||'メンバー';
  const fallback=document.createElement('span');fallback.className='timeline-profile-avatar';fallback.textContent=name.slice(0,1)||'友';
  if(!profile?.url)return fallback;
  const img=document.createElement('img');img.className='timeline-profile-avatar';img.alt=name+'のプロフィール写真';img.loading='lazy';img.src=profile.url;
  img.onerror=()=>img.replaceWith(fallback);
  return img;
}


async function kimetomoFetchAdmins(api){
  if(window.kmAdminCache&&Date.now()-window.kmAdminCache.at<300000)return window.kmAdminCache.set;
  // 管理人はめったに変わらないので、端末に1時間覚えておく（js/device-cache.js）
  const saved=window.kmDC?.get('admins',3600e3);if(saved){const set=new Set(saved);window.kmAdminCache={at:Date.now(),set};return set}
  try{const {data,error}=await api.rpc('kimetomo_admin_badges');if(error)throw error;const set=new Set((data||[]).map(x=>x.user_id));window.kmAdminCache={at:Date.now(),set};window.kmDC?.set('admins',[...set]);return set;}
  catch(e){console.warn('王冠の表示情報を取得できません:',e.message);return new Set();}
}
function kimetomoCrown(){
  const crown=document.createElement('span');crown.className='kimetomo-crown';
  const icon=document.createElement('span');icon.className='kimetomo-crown-icon';icon.textContent='👑';
  const label=document.createElement('span');label.className='kimetomo-crown-label';label.textContent='管理者';
  crown.append(icon,label);crown.title='キメ友SNS 管理者';crown.setAttribute('aria-label','管理者');return crown;
}

// 投稿に対するコメント・返信と絵文字（HTMLはtextContentで安全に表示）
const kmEmojis=['❤️','😂','😮','😢','🔥','👏'];
function kmBtn(text,handler,extraClass='ghost'){
  const b=document.createElement('button');b.type='button';b.className=extraClass;b.textContent=text;b.onclick=handler;return b;
}
/* 管理者が他の人の投稿・コメントを消すときは、理由を選んでもらい、書いた人に自動でDMする */
const KM_DEL_REASONS=['18歳未満の方の利用や、出会いの募集は禁止です','違法な取引や勧誘につながる書き込みは禁止です','他の人への嫌がらせ・悪口は禁止です','個人情報（本名・住所・連絡先など）の書き込みは禁止です','宣伝・スパムは禁止です'];
function kmAskDeleteReason(kind){
  const list=KM_DEL_REASONS.map((r,i)=>(i+1)+'. '+r).join('\n');
  const a=prompt('【管理者】この'+kind+'を削除して、書いた人に理由をDMで送ります。'+(kind==='投稿'?'\n（この投稿についたコメントもすべて消えます）':'')+'\n\n理由の番号を入れるか、理由を直接書いてください。\n\n'+list,'1');
  if(a===null)return null;
  const t=a.trim(),n=Number(t);
  if(Number.isInteger(n)&&n>=1&&n<=KM_DEL_REASONS.length)return KM_DEL_REASONS[n-1];
  if(!t){alert('理由を入れてください。削除はしていません。');return null}
  return t.slice(0,200);
}
async function kmNotifyDeleted(userId,kind,reason,text){
  if(!userId||userId===current?.id)return '';
  try{
    const [user_a,user_b]=[current.id,userId].sort();
    let {data,error}=await client.from('kimetomo_direct_conversations').select('id').eq('user_a',user_a).eq('user_b',user_b).maybeSingle();
    if(error)throw error;
    if(!data){const c=await client.from('kimetomo_direct_conversations').insert({user_a,user_b}).select('id').single();
      if(c.error){if(c.error.code!=='23505')throw c.error;const again=await client.from('kimetomo_direct_conversations').select('id').eq('user_a',user_a).eq('user_b',user_b).single();if(again.error)throw again.error;data=again.data}else data=c.data}
    const head='【キメ友運営より】\nあなたの'+kind+'を、ルール違反のため削除しました。\n\n理由：'+reason;
    const tail='\n\nルールを守ってご利用ください。ご質問は、このDMに返信してください。';
    const raw=(text||'').replace(/\s+/g,' ').trim(),quote=raw?'\n\n削除した'+kind+'：「'+raw.slice(0,60)+(raw.length>60?'…':'')+'」':'';
    // 引用部分に送れない言葉が含まれていたら、引用なしで送り直す
    let m=await client.from('kimetomo_direct_messages').insert({conversation_id:data.id,sender_id:current.id,body:head+quote+tail});
    if(m.error&&quote)m=await client.from('kimetomo_direct_messages').insert({conversation_id:data.id,sender_id:current.id,body:head+tail});
    if(m.error)throw m.error;
    return '削除して、書いた人に理由をDMで送りました。';
  }catch(e){return '削除はしましたが、理由のDMを送れませんでした: '+safeError(e)}
}
async function kmRenderDiscussion(post,card,comments,reactions,profiles,adminIds){
  // コメントを書いた・消したときは、タイムライン全体ではなく、この投稿のコメントだけ読み直す（匿名の相談は今まで通り全体）
  async function kmReloadDiscussion(){
    if(post.anonymous)return loadTimeline();
    try{
      const {data,error}=await client.from('kimetomo_timeline_comments').select('id,post_id,parent_id,author_id,body,created_at').eq('post_id',post.id).order('created_at',{ascending:true}).limit(500);
      if(error)throw error;
      const need=[...new Set((data||[]).map(c=>c.author_id))].filter(id=>!profiles.has(id));
      if(need.length){const more=await timelineReadAuthors(need);for(const [k,v] of more)profiles.set(k,v)}
      reactionPicker.remove();area.remove();
      await kmRenderDiscussion(post,card,data||[],reactions,profiles,adminIds);
      card.querySelector('.km-comment-area')?.classList.remove('hide');card.querySelector('.km-comment-toggle')?.setAttribute('aria-expanded','true');
    }catch(e){console.warn('コメントの読み直し',e);await loadTimeline()}
  }
  const area=document.createElement('div');area.className='km-comment-area hide';
  const reactionPicker=document.createElement('div');reactionPicker.className='km-reaction-picker';
  let pickerOpen=false;function refreshEmoji(){const keep=reactionPicker.querySelector('.km-comment-toggle');reactionPicker.replaceChildren();if(keep)reactionPicker.append(keep);
    // ❤️ はいつも表示して1タップで付けられる。ほかの絵文字は押されたものだけ並べ、「😊＋」で全部を開いて選べる（数は1以上のときだけ表示）
    for(const emoji of kmEmojis){
      const matching=reactions.filter(r=>r.post_id===post.id&&r.emoji===emoji);
      const mine=matching.some(r=>r.user_id===current?.id);if(!matching.length&&!pickerOpen&&emoji!=='❤️')continue;
      const b=kmBtn('',async()=>{
        b.disabled=true;
        try{
          const q=mine?await client.from('kimetomo_timeline_reactions').delete().eq('post_id',post.id).eq('user_id',current.id).eq('emoji',emoji):await client.from('kimetomo_timeline_reactions').upsert({post_id:post.id,user_id:current.id,emoji},{onConflict:'post_id,user_id,emoji'});
          if(q.error)throw q.error;
          // タイムライン全体は読み直さず、この投稿のリアクションだけ書き換える（通信量を減らす）
          if(mine){for(let i=reactions.length-1;i>=0;i--){const r=reactions[i];if(r.post_id===post.id&&r.user_id===current.id&&r.emoji===emoji)reactions.splice(i,1)}}
          else reactions.push({post_id:post.id,user_id:current.id,emoji});
          pickerOpen=false;refreshEmoji();
        }catch(e){timelineStatus('リアクションに失敗: '+safeError(e));b.disabled=false}
      },'km-react'+(mine?' mine':''));
      const ic=document.createElement('span');ic.textContent=emoji;b.append(ic);
      if(matching.length){const n=document.createElement('span');n.className='km-react-n';n.textContent=matching.length;b.append(n)}
      b.setAttribute('aria-label',emoji+(mine?'を取り消す':'を付ける')+(matching.length?'（'+matching.length+'人）':''));
      reactionPicker.append(b);
    }
    const more=kmBtn(pickerOpen?'✕':'😊＋',()=>{pickerOpen=!pickerOpen;refreshEmoji()},'km-react km-react-more');
    more.setAttribute('aria-label',pickerOpen?'絵文字を閉じる':'絵文字を付ける');more.setAttribute('aria-expanded',String(pickerOpen));
    reactionPicker.append(more);
  }
  refreshEmoji();
  const list=document.createElement('div');
  const postComments=comments.filter(c=>c.post_id===post.id&&!kmBlocked.has(c.author_id));
  // 「コメントを受け付けない」投稿は、投稿した本人だけコメントできる
  const closed=!!post.comments_off&&post.author_id!==current.id;
  // 自分の匿名の相談には、名前を出さずにコメントする
  const anonMe=!!post.anonymous&&!!window.kmAnon?.mine.has(post.id);
  async function removeComment(c){const byAdmin=c.author_id!==current.id;let reason=null;if(byAdmin){reason=kmAskDeleteReason('コメント');if(!reason)return}else if(!confirm('このコメントを削除しますか？（返信も削除されます）'))return;const q=await client.from('kimetomo_timeline_comments').delete().eq('id',c.id).match(adminIds.has(current.id)?{}:{author_id:current.id});if(q.error){timelineStatus(safeError(q.error));return}const done=byAdmin?await kmNotifyDeleted(c.author_id,'コメント',reason,c.body):'';await kmReloadDiscussion();if(done)timelineStatus(done)}
  function addComment(c,depth){
    const item=document.createElement('div');item.className='km-comment'+(depth?' reply':'');
    const head=document.createElement('div');head.className='km-comment-head';
    const anonC=!!post.anonymous&&!!window.kmAnon?.carrier&&c.author_id===window.kmAnon.carrier;const name=document.createElement('strong');name.style.fontSize='13px';name.textContent=anonC?'🌷 相談した人':(profiles.get(c.author_id)?.name||'メンバー');if(!anonC)name.dataset.kmUid=c.author_id;const nameBtn=document.createElement('button');nameBtn.type='button';nameBtn.className='km-comment-author';nameBtn.title='プロフィールを見る';nameBtn.setAttribute('aria-label',name.textContent+'のプロフィールを開く');nameBtn.append(name);nameBtn.onclick=()=>{if(!anonC)kmOpenMemberProfile(c.author_id,profiles.get(c.author_id)||{name:name.textContent},adminIds.has(c.author_id))};head.append(nameBtn);
    if(!anonC&&adminIds.has(c.author_id))head.append(kimetomoCrown());
    if(anonC&&window.kmAnon.authors.get(c.id)){const w=document.createElement('span');w.className='small km-post-women';w.textContent='👑 '+window.kmAnon.authors.get(c.id);head.append(w)}
    const stamp=document.createElement('span');stamp.className='small';stamp.textContent=kmTimeAgo(c.created_at);stamp.title=new Date(c.created_at).toLocaleString('ja-JP');head.append(stamp);
    const body=document.createElement('div');body.className='km-comment-body';kmLinkify(body,c.body);
    const actions=document.createElement('div');actions.className='km-comment-actions';
    if(depth===0&&!closed)actions.append(kmBtn('返信する',()=>makeForm(c.id,item), 'ghost'));
    if(anonC&&window.kmAnon.mine.has(c.id)&&!adminIds.has(current.id))actions.append(kmBtn('削除',async()=>{if(!confirm('このコメントを削除しますか？（返信も削除されます）'))return;const {error}=await client.rpc('kimetomo_anon_delete',{p_kind:'comment',p_id:c.id});if(error){timelineStatus(safeError(error));return}await loadTimeline()},'ghost'));
    if(c.author_id===current.id||adminIds.has(current.id))actions.append(kmBtn(c.author_id===current.id?'削除':'🛡 削除',()=>removeComment(c),'ghost'));
    else if(window.kmReportButton&&!(anonC&&window.kmAnon.mine.has(c.id)))actions.append(window.kmReportButton({kind:'comment',id:c.id,userId:anonC?null:c.author_id,who:anonC?null:(profiles.get(c.author_id)?.name||null)}));
    item.append(head,body,actions);list.append(item);
    for(const child of postComments.filter(x=>x.parent_id===c.id))addComment(child,1);
  }
  function makeForm(parentId,mount){
    const previous=mount.querySelector('.km-comment-form');if(previous){previous.remove();return}
    const wrap=document.createElement('div');wrap.className='km-comment-form';
    const input=document.createElement('textarea');input.rows=2;input.maxLength=500;input.placeholder=anonMe?'名前を出さずに書きます（「🌷 相談した人」と出ます）':parentId?'返信を書く（500文字まで）':'コメントを書く（500文字まで）';
    const send=kmBtn('送信',async()=>{
      const body=input.value.trim();if(!body){timelineStatus('コメントを入力してください');return}
      if(!window.kmWarnOk?.(body))return;
      send.disabled=true;try{const {error}=anonMe?await client.rpc('kimetomo_anon_comment',{p_post:post.id,p_parent:parentId,p_body:body}):await client.from('kimetomo_timeline_comments').insert({post_id:post.id,parent_id:parentId,author_id:current.id,body});if(error)throw error;await kmReloadDiscussion()}catch(e){timelineStatus('コメントの送信に失敗: '+safeError(e));send.disabled=false}
    });wrap.append(input,send);mount.append(wrap);input.focus();
  }
  for(const c of postComments.filter(c=>!c.parent_id))addComment(c,0);
  if(!postComments.length&&!post.comments_off){const p=document.createElement('p');p.className='small';p.textContent='まだコメントがありません';list.append(p)}
  area.append(list);
  if(post.comments_off){const p=document.createElement('p');p.className='small km-comments-off-note';p.textContent=closed?'🔕 この投稿はコメントを受け付けていません（リアクションはできます）':'🔕 コメントを受け付けない投稿です（あなただけコメントできます）';area.append(p)}
  if(!closed)makeForm(null,area);
  const toggle=kmBtn((post.comments_off?'🔕 ':'💬 ')+postComments.length,()=>{area.classList.toggle('hide');toggle.setAttribute('aria-expanded',String(!area.classList.contains('hide')))});
  toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','コメント一覧を開閉');
  const kmActs=card.querySelector('.timeline-actions');kmActs.before(reactionPicker);toggle.classList.add('km-react','km-comment-toggle');reactionPicker.prepend(toggle);
  card.append(area);
}
// 自分の投稿を直す（本文だけ。サーバー側で本文以外は変えられない：supabase/post_edit_expire.sql）
function kmEditPost(post,bodyEl,btn){
  const card=bodyEl.closest('.timeline-post')||bodyEl.parentElement;if(card.querySelector('.km-post-editor'))return;
  const wrap=document.createElement('div');wrap.className='km-post-editor km-comment-form';
  const input=document.createElement('textarea');input.maxLength=1000;input.rows=Math.min(10,Math.max(3,post.body.split('\n').length+1));input.value=post.body;
  const row=document.createElement('div');row.className='km-compose-actions';
  const cancel=kmBtn('やめる',()=>{wrap.remove();bodyEl.classList.remove('hide');bodyEl.parentElement?.querySelector(':scope > .km-readmore')?.classList.remove('hide');btn.disabled=false},'ghost');
  const save=kmBtn('保存する',async()=>{
    const text=input.value.trim();if(!text){timelineStatus('本文を入力してください');return}
    if(text===post.body.trim()){cancel.click();return}
    if(!window.kmWarnOk?.(text))return;
    save.disabled=true;try{const {data,error}=await client.from('kimetomo_timeline_posts').update({body:text}).eq('id',post.id).eq('author_id',current.id).select('id');if(error)throw error;if(!data?.length)throw Error('この投稿は直せませんでした');await loadTimeline();timelineStatus('投稿を直しました')}catch(e){timelineStatus('直せませんでした: '+safeError(e));save.disabled=false}
  });
  row.append(cancel,save);wrap.append(input,row);bodyEl.classList.add('hide');bodyEl.parentElement.querySelector(':scope > .km-readmore')?.classList.add('hide');bodyEl.after(wrap);btn.disabled=true;input.focus();
}
// タイムライン（テーブルとRLSは同梱SQLで作成）
let timelineLoading=false,kmTimelineLimit=20;
const timelineStatus=message=>{$('timeline-status').textContent=message||''};
async function loadTimeline(){
  if(!client||!current||timelineLoading)return;
  timelineLoading=true;
  timelineStatus('投稿を読み込み中…');
  try{
    const {data:posts,error}=await client.from('kimetomo_timeline_posts')
      .select('*').order('created_at',{ascending:false}).limit(kmTimelineLimit);
    if(error)throw error;
    const kmImgUrls=await kmPostImageUrls(posts);
    const ids=(posts||[]).map(p=>p.id);
    // 「♡いいね」は「❤️リアクション」にまとめたので読み込まない
    const likes=[];
    // コメント・リアクション・アンケート・管理者を同時に読み込む（表示を速くするため）
    let comments=[],reactions=[];
    const polls=new Map(),votes=new Map();
    const none={data:[],error:null};
    const [cr,rr,pr,vr,adminIds]=await Promise.all([
      ids.length?client.from('kimetomo_timeline_comments').select('id,post_id,parent_id,author_id,body,created_at').in('post_id',ids).order('created_at',{ascending:true}).limit(500):none,
      ids.length?client.from('kimetomo_timeline_reactions').select('post_id,user_id,emoji').in('post_id',ids):none,
      ids.length?client.from('kimetomo_timeline_polls').select('post_id,options').in('post_id',ids):none,
      ids.length?client.from('kimetomo_timeline_poll_votes').select('post_id,user_id,option_index').in('post_id',ids):none,
      kimetomoFetchAdmins(client)
    ]);
    if(cr.error)throw cr.error;if(rr.error)throw rr.error;
    comments=cr.data||[];reactions=rr.data||[];
    // 🌷 匿名の相談：自分が書いたもの・（管理者だけ）誰が書いたか
    window.kmAnon={carrier:null,mine:new Set(),authors:new Map()};
    if((posts||[]).some(p=>p.anonymous)){try{
      const carrier=(await client.rpc('kimetomo_anon_carrier_id')).data;window.kmAnon.carrier=carrier;
      const anonIds=[...posts.filter(p=>p.anonymous).map(p=>p.id),...comments.filter(c=>carrier&&c.author_id===carrier).map(c=>c.id)];
      const [mi,au]=await Promise.all([client.rpc('kimetomo_anon_mine',{p_ids:anonIds}),adminIds.has(current.id)?client.rpc('kimetomo_admin_anon_authors',{p_ids:anonIds}):Promise.resolve({data:[]})]);
      for(const r of mi.data||[])window.kmAnon.mine.add(r.ref_id);for(const r of au.data||[])window.kmAnon.authors.set(r.ref_id,r.name);
    }catch(e){console.warn('匿名の情報を読めません',e)}}
    // アンケート（SQL未実行でもタイムラインは表示できるよう、エラーは無視）
    if(!pr.error)(pr.data||[]).forEach(p=>polls.set(String(p.post_id),p.options));
    if(!vr.error)(vr.data||[]).forEach(v=>{const k=String(v.post_id);if(!votes.has(k))votes.set(k,[]);votes.get(k).push(v)});
    // 🔁 引用された投稿（js/quote.js）
    const quoted=window.kmQuoteFetch?await window.kmQuoteFetch(posts).catch(()=>new Map()):new Map();
    const authors=[...new Set([...(posts||[]).map(p=>p.author_id),...comments.map(c=>c.author_id),...[...quoted.values()].map(p=>p.author_id)])];
    const profiles=await timelineReadAuthors(authors);if(!current)return;
    const feed=$('timeline-feed');feed.replaceChildren();window.kmLiveClearNew?.();window.kmTimelineLoadedAt=Date.now();
    if(!posts?.length){feed.textContent='まだ投稿がありません。最初の投稿をしてみよう！';timelineStatus('');return;}
    for(const post of posts){if(!current)return;if(kmBlocked.has(post.author_id))continue;if(window.kmIsMuted?.(post.author_id)&&String(post.id)!==String(kmPendingPostId))continue;
      const card=document.createElement('article');card.className='timeline-post'+(post.women_only?' km-women-post':'');card.id='km-post-'+post.id;
      const header=document.createElement('div');header.className='timeline-post-header';
      const profile=post.anonymous?{name:'匿名の相談'}:(profiles.get(post.author_id)||{name:post.author_id===current.id?(current.user_metadata?.display_name||'自分'):'メンバー'});
      const userRow=document.createElement('div');userRow.className='timeline-user';
      const info=document.createElement('div');info.className='timeline-user-info';
      const author=document.createElement('strong');author.textContent=post.anonymous?'🌷 匿名の相談':profile.name;if(!post.anonymous)author.dataset.kmUid=post.author_id;
      info.append(author);if(!post.anonymous&&adminIds.has(post.author_id))info.append(kimetomoCrown());
      const avatarButton=document.createElement('button');avatarButton.type='button';avatarButton.className='km-author-avatar-button';
      avatarButton.setAttribute('aria-label',profile.name+'のプロフィールを開く');avatarButton.title='プロフィールを見る';
      avatarButton.append(timelineMakeAvatar(profile));
      avatarButton.onclick=()=>{if(!post.anonymous)kmOpenMemberProfile(post.author_id,profile,adminIds.has(post.author_id))};
      userRow.append(avatarButton,info);
      const date=document.createElement('span');date.className='small';date.textContent=kmTimeAgo(post.created_at);date.title=new Date(post.created_at).toLocaleString('ja-JP');
      const kmMeta=document.createElement('div');kmMeta.className='km-post-meta';kmMeta.append(date);header.append(userRow,kmMeta);
      if(post.edited_at){const e=document.createElement('span');e.className='small km-post-edited';e.textContent='編集済み';e.title=new Date(post.edited_at).toLocaleString('ja-JP')+' に編集';kmMeta.append(e)}
      if(post.anonymous){const mine=window.kmAnon?.mine.has(post.id),who=window.kmAnon?.authors.get(post.id);if(mine||who){const a=document.createElement('span');a.className='small km-post-women';a.textContent=mine?'（あなたの相談）':'👑 書いた人：'+who;kmMeta.append(a)}
        if(mine&&!adminIds.has(current.id)){const d=document.createElement('button');d.type='button';d.className='ghost km-post-del';d.textContent='削除';d.onclick=async()=>{if(!confirm('この相談を削除しますか？'))return;d.disabled=true;const {error}=await client.rpc('kimetomo_anon_delete',{p_kind:'post',p_id:post.id});if(error){timelineStatus('削除に失敗: '+safeError(error));d.disabled=false;return}await loadTimeline()};kmMeta.append(d)}}
      if(post.women_only){const w=document.createElement('span');w.className='small km-post-women';w.textContent='🌷 女性だけに公開';w.title='女性だけの部屋のメンバーにだけ見えています';kmMeta.append(w)}
      if(post.expires_at){const left=Math.max(0,new Date(post.expires_at)-Date.now()),x=document.createElement('span');x.className='small km-post-expire';x.textContent=left<3600000?'⏳ まもなく消えます':'⏳ あと'+Math.floor(left/3600000)+'時間で消えます';x.title='24時間で消える投稿';kmMeta.append(x)}
      const body=document.createElement('div');body.className='timeline-post-body';kmLinkify(body,post.image_path&&post.body===KM_IMAGE_ONLY?'':post.body);
    if(post.body.length>200||post.body.split('\n').length>6){body.classList.add('km-clamp');const moreBtn=document.createElement('button');moreBtn.type='button';moreBtn.className='km-readmore';moreBtn.textContent='…続きを読む';moreBtn.onclick=()=>{body.classList.remove('km-clamp');moreBtn.remove()};queueMicrotask(()=>body.after(moreBtn))}
      const actions=document.createElement('div');actions.className='timeline-actions';
      const count=likes.filter(l=>l.post_id===post.id).length;
      const liked=likes.some(l=>l.post_id===post.id&&l.user_id===current.id);
      const like=document.createElement('button');like.type='button';like.className='ghost';like.textContent=(liked?'♥ ':'♡ ')+count;
      like.setAttribute('aria-label',liked?'いいねを取り消す':'いいねする');
      like.onclick=async()=>{like.disabled=true;try{const result=liked?await client.from('kimetomo_timeline_likes').delete().eq('post_id',post.id).eq('user_id',current.id):await client.from('kimetomo_timeline_likes').insert({post_id:post.id,user_id:current.id});if(result.error)throw result.error;await loadTimeline()}catch(e){timelineStatus('いいねの操作に失敗: '+safeError(e))}finally{like.disabled=false}};
      
      if(post.author_id===current.id&&!(post.image_path&&post.body===KM_IMAGE_ONLY)){const ed=document.createElement('button');ed.type='button';ed.className='ghost km-post-edit';ed.textContent='編集';ed.onclick=()=>kmEditPost(post,body,ed);kmMeta.append(ed)}
      if(post.author_id===current.id||adminIds.has(current.id)){const del=document.createElement('button');del.type='button';del.className='ghost';del.textContent=post.author_id===current.id?'削除':'🛡 削除';del.onclick=async()=>{const byAdmin=post.author_id!==current.id;let reason=null;if(byAdmin){reason=kmAskDeleteReason('投稿');if(!reason)return}else if(!confirm('この投稿を削除しますか？'))return;del.disabled=true;try{const result=await client.from('kimetomo_timeline_posts').delete().eq('id',post.id).match(adminIds.has(current.id)?{}:{author_id:current.id});if(result.error)throw result.error;if(post.image_path&&(adminIds.has(current.id)||post.author_id===current.id))await client.storage.from(KM_POST_IMAGES).remove([post.image_path]).catch(()=>{});const done=byAdmin?await kmNotifyDeleted(post.author_id,'投稿',reason,post.body===KM_IMAGE_ONLY?'（画像の投稿）':post.body):'';await loadTimeline();if(done)timelineStatus(done)}catch(e){timelineStatus('削除に失敗: '+safeError(e))}finally{del.disabled=false}};del.classList.add('km-post-del');kmMeta.append(del)}
      {const qb=window.kmQuoteButton?.(post,profile.name);if(qb)kmMeta.append(qb)}
      if(window.kmReportButton&&!adminIds.has(current.id)&&post.author_id!==current.id&&!window.kmAnon?.mine.has(post.id))kmMeta.append(window.kmReportButton({kind:'post',id:post.id,userId:post.anonymous?null:post.author_id,who:post.anonymous?null:profile.name}));const quoteEl=window.kmQuoteEmbed?.(post,quoted,profiles);
      kmAttachLinkPreview(body,post.body);const pollEl=kmRenderPoll(post,polls.get(String(post.id)),votes.get(String(post.id))||[]);const imgEl=kmPostImageEl(kmImgUrls.get(post.image_path));card.append(header,...(post.image_path&&post.body===KM_IMAGE_ONLY?[]:[body]),...(quoteEl?[quoteEl]:[]),...(imgEl?[imgEl]:[]),...(pollEl?[pollEl]:[]),actions);
      await kmRenderDiscussion(post,card,comments,reactions,profiles,adminIds);
      feed.append(card);
    }
    timelineStatus('');if(posts.length>=kmTimelineLimit&&kmTimelineLimit<500){const more=document.createElement('button');more.type='button';more.className='ghost full km-more';more.textContent='もっと見る（前の投稿を読み込む）';more.onclick=async()=>{more.disabled=true;more.textContent='読み込み中…';const y=window.scrollY;kmTimelineLimit+=20;await loadTimeline();window.scrollTo(0,y)};feed.append(more)};kmTryFocusPost();kmTlResumeCapture();window.kmTimelineMarkSeen?.(posts);kmTlResumeDecorate(posts);window.kmLoadMoods?.();window.kmDecorateMoods?.();
  }catch(e){timelineStatus('タイムラインを読み込めません: '+safeError(e)+'（先に同梱のSQLを実行してください）')}
  finally{timelineLoading=false}
}
/* 前回の続きから見る：タイムラインを開いたとき、まだ見ていない投稿の一番古いものへ移動できる */
let kmTlResumeFrom,kmTlResumeHidden=false,kmTlResumeAutoDone=false;
const kmTlAutoKey='km-tl-auto-resume';
const kmTlAuto=()=>{try{return localStorage.getItem(kmTlAutoKey)==='1'}catch{return false}};
function kmTlResumeCapture(){
  // タイムラインを開いた最初の 1 回だけ「前に見たところ」を覚えておく
  if(kmTlResumeFrom!==undefined||!current||window.kmActiveTab!=='timeline'||document.hidden)return;
  try{kmTlResumeFrom=localStorage.getItem('km-tl-seen-'+current.id)||null}catch{kmTlResumeFrom=null}
}
function kmTlResumeReset(){kmTlResumeFrom=undefined;kmTlResumeHidden=false;kmTlResumeAutoDone=false}
document.querySelectorAll('.km-bottom-nav [data-km-go]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.kmGo!=='timeline')kmTlResumeReset()}));
let kmTlHiddenAt=0;document.addEventListener('visibilitychange',()=>{if(document.hidden)kmTlHiddenAt=Date.now();else if(kmTlHiddenAt&&Date.now()-kmTlHiddenAt>10*60*1000)kmTlResumeReset()});
function kmTlUnseen(posts){
  if(!kmTlResumeFrom||!current)return[];
  return(posts||[]).filter(p=>p.created_at>kmTlResumeFrom&&p.author_id!==current.id&&!kmBlocked.has(p.author_id)&&!window.kmIsMuted?.(p.author_id));
}
function kmTlResumeDecorate(posts){
  const feed=$('timeline-feed');if(!feed)return;
  feed.querySelector('.km-tl-resume')?.remove();feed.querySelectorAll('.km-tl-divider,.km-new-tag').forEach(e=>e.remove());
  const unseen=kmTlUnseen(posts);if(!unseen.length)return;
  // まだ見ていない投稿に「NEW」を付け、一番古いものの下に区切り線を入れる
  unseen.forEach(p=>{const meta=document.querySelector('#km-post-'+CSS.escape(String(p.id))+' .km-post-meta');if(meta){const t=document.createElement('span');t.className='km-new-tag';t.textContent='NEW';meta.prepend(t)}});
  const oldest=unseen[unseen.length-1];const oldestEl=document.getElementById('km-post-'+oldest.id);
  const allLoaded=(posts||[]).some(p=>p.created_at<=kmTlResumeFrom)||(posts||[]).length<kmTimelineLimit;
  if(oldestEl&&allLoaded&&oldestEl.nextElementSibling?.classList.contains('timeline-post')){const d=document.createElement('div');d.className='km-tl-divider';d.textContent='👆 ここから上が、まだ見ていない投稿です';oldestEl.after(d)}
  if(kmTlResumeHidden)return;
  const box=document.createElement('div');box.className='km-tl-resume';
  const text=document.createElement('div');text.className='km-tl-resume-text';
  text.textContent='📍 未読 '+unseen.length+(allLoaded?' 件':' 件以上');
  const go=document.createElement('button');go.type='button';go.textContent='続きから見る';go.onclick=()=>kmTlResumeJump(go,true);
  const close=document.createElement('button');close.type='button';close.className='ghost';close.textContent='✕';close.setAttribute('aria-label','閉じる');close.onclick=()=>{kmTlResumeHidden=true;box.remove()};
  // 1行にまとめる：左に「未読 N 件」と小さな「次からも自動で」、右に「続きから見る」と ✕
  const auto=document.createElement('label');auto.className='small km-tl-resume-auto';
  const cb=document.createElement('input');cb.type='checkbox';cb.checked=kmTlAuto();cb.onchange=()=>{try{localStorage.setItem(kmTlAutoKey,cb.checked?'1':'0')}catch{}};
  auto.append(cb,document.createTextNode('次からも自動で'));
  const info=document.createElement('div');info.className='km-tl-resume-info';info.append(text,auto);
  box.append(info,go,close);feed.prepend(box);
  if(kmTlAuto()&&!kmTlResumeAutoDone&&!kmPendingPostId){kmTlResumeAutoDone=true;setTimeout(()=>kmTlResumeJump(go),0)}
}
async function kmTlResumeJump(btn,manual){
  if(!kmTlResumeFrom||!current)return;
  kmTlResumeAutoDone=true;
  if(btn){btn.disabled=true;btn.textContent='読み込み中…'}
  try{
    // まだ見ていない投稿が、今読み込んでいる分より古くまである場合は、そこまで読み込む
    const {count,error}=await client.from('kimetomo_timeline_posts').select('id',{count:'exact',head:true}).gt('created_at',kmTlResumeFrom);
    if(!error&&count!=null&&count+1>kmTimelineLimit){kmTimelineLimit=Math.min(200,Math.ceil((count+1)/20)*20);await loadTimeline()}
  }catch{}
  const tags=document.querySelectorAll('#timeline-feed .km-new-tag');
  const target=tags.length?tags[tags.length-1].closest('.timeline-post'):null;
  if(btn&&btn.isConnected){btn.disabled=false;btn.textContent='続きから見る'}
  // 自分で「続きから見る」を押したら案内は消す（自動で移動したときは「次からも自動で」を外せるよう残す）
  if(manual){kmTlResumeHidden=true;document.querySelector('#timeline-feed .km-tl-resume')?.remove()}
  if(!target)return;
  target.classList.add('km-highlight');target.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>target.classList.remove('km-highlight'),2500);
}

// コメント通知：DBに保存された通知を読み込み、当人だけが既読化できる
window.kmChatTargetRoom=new URLSearchParams(location.search).get('room')||null;
let kmNotifyTimer=null,kmNotifyBusy=false,kmPendingPostId=new URLSearchParams(location.search).get('post'),kmNotifyUserId=null;
function kmStopNotifications(){
 if(kmNotifyTimer){clearInterval(kmNotifyTimer);kmNotifyTimer=null}
 window.kmLiveStop?.();
 kmNotifyUserId=null;kmNotifyBusy=false;
 const badge=$('km-notify-count');if(badge){badge.classList.add('hide');badge.textContent='0'}$('km-notify-button')?.classList.remove('km-has-unread')
 const panel=$('km-notify-panel');if(panel)panel.classList.add('hide');
}
function kmStartNotifications(){
 if(!current)return;
 if(kmNotifyUserId!==current.id){kmStopNotifications();kmNotifyUserId=current.id}
 // リアルタイムでつながっている間は、念のための確認を 3 分に 1 回へ減らす（js/live.js）
 let tick=0;
 if(!kmNotifyTimer)kmNotifyTimer=setInterval(()=>{if(document.hidden)return;if(window.kmLiveOk&&++tick%2)return;kmCheckUnread()},90000);
 window.kmLiveStart?.();
 kmCheckUnread();
}
// 未読の数だけを数える（一覧は通知パネルを開いたときだけ読み込む＝通信量を減らす）
async function kmCheckUnread(){
 if(!current||!client)return;
 if(!$('km-notify-panel').classList.contains('hide'))return kmLoadNotifications();
 const {data,error}=await client.from('kimetomo_bell_notifications').select('actor_id,kind').eq('recipient_id',current.id).neq('kind','chat').is('read_at',null).limit(200);
 if(error)return;
 // 同じ人からの通知は 1 件として数える（一覧と数をそろえる）
 const count=new Set((data||[]).map((n,i)=>kmNoticeGroupKey(n)||'one:'+i)).size;
 const badge=$('km-notify-count');badge.textContent=count>99?'99+':String(count||0);badge.classList.toggle('hide',!count);$('km-notify-button').classList.toggle('km-has-unread',!!count);
}
window.kmCheckUnread=kmCheckUnread;
// 下に引っぱったときに、今見ているタブのデータだけを読み直す
window.kmRefreshData=async()=>{
 if(!current||!client)return;
 const tab=window.kmActiveTab;
 const jobs=[kmCheckUnread()];
 if(tab==='chat')jobs.push(loadChat());
 else if(tab==='profile')jobs.push(loadMyProfile());
 else jobs.push(loadTimeline());
 await Promise.all(jobs);
};
let kmNoticeUnreadIds=[];
// 同じ人からの通知をまとめるための目印（管理者のお知らせ・機能リクエストなど、人からでないものはまとめない）
function kmNoticeGroupKey(n){
 if(!n.actor_id||n.kind==='admin_notice'||n.kind.startsWith('request'))return null;
 return 'actor:'+n.actor_id;
}
// 新しい順の通知を、同じ人ごとに 1 件（いちばん新しいもの）にまとめる
function kmGroupNotices(notices){
 const out=[],byKey=new Map();
 for(const n of notices){
  const key=kmNoticeGroupKey(n);
  const g=key&&byKey.get(key);
  if(g){g.ids.push(n.id);g.more++;if(!n.read_at)g.read_at=null;continue}
  const item={...n,ids:[n.id],more:0};
  out.push(item);if(key)byKey.set(key,item);
 }
 return out;
}
// 通知パネルを開いて一覧を見たら、表示した通知を既読にする（赤い数字を消す。黄色い枠は 3 秒見せてから消す）
async function kmMarkShownNoticesRead(){
 const ids=kmNoticeUnreadIds.slice();if(!ids.length||!current||!client)return;
 const {error}=await client.from('kimetomo_bell_notifications').update({read_at:new Date().toISOString()}).eq('recipient_id',current.id).in('id',ids).is('read_at',null);
 if(error)return;
 kmNoticeUnreadIds=kmNoticeUnreadIds.filter(id=>!ids.includes(id));
 const badge=$('km-notify-count');if(badge){badge.classList.add('hide');badge.textContent='0'}$('km-notify-button')?.classList.remove('km-has-unread');
 const done=new Set(ids.map(String));
 setTimeout(()=>{document.querySelectorAll('#km-notify-list .km-notify-item.unread').forEach(b=>{if((b.dataset.ids||'').split(',').every(id=>done.has(id)))b.classList.remove('unread')})},3000);
}
async function kmLoadNotifications(){
 if(!current||!client||kmNotifyBusy||!kmNotifyUserId||current.id!==kmNotifyUserId)return;
 kmNotifyBusy=true;const userId=current.id;
 try{
  // グループチャットはベルに出さない（プッシュ通知と、下の「グループ」タブの赤い数字でお知らせ）
  const {data,error}=await client.from('kimetomo_bell_notifications')
   .select('id,kind,actor_id,ref_id,body,created_at,read_at,push_text,url')
   .eq('recipient_id',userId).neq('kind','chat').order('created_at',{ascending:false}).limit(100);
  if(error)throw error;
  if(!current||current.id!==userId)return;
  const raw=data||[],notices=kmGroupNotices(raw),unread=notices.filter(n=>!n.read_at).length;
  kmNoticeUnreadIds=raw.filter(n=>!n.read_at).map(n=>n.id);
  const badge=$('km-notify-count');badge.textContent=unread>99?'99+':String(unread);badge.classList.toggle('hide',unread===0);$('km-notify-button').classList.toggle('km-has-unread',unread>0);
  const actorIds=[...new Set(notices.map(n=>n.actor_id).filter(Boolean))];
  const names=await window.kmDisplayNames(actorIds);
  const list=$('km-notify-list');list.replaceChildren();
  if(!notices.length){const p=document.createElement('p');p.className='small';p.textContent='通知はまだありません';list.append(p)}
  for(const n of notices){
    const who=(names.get(n.actor_id)||'友達')+'さん';
    const label=n.kind==='admin_notice'?(n.push_text||'👑 管理者へのお知らせ'):n.kind.startsWith('request')?(n.push_text||'💡 機能リクエストのお知らせ'):n.kind==='image_post'?'🖼 '+who+'が画像を投稿しました':n.kind==='chat'?'🗨️ '+who+'がグループチャットに投稿しました':n.kind==='dm'?'✉️ '+who+'から個人チャットが届きました':n.kind==='reaction'?((n.body||'').split(' ')[0]||'❤️')+' '+who+'があなたの投稿にリアクションしました':n.kind==='reply'?'↩️ '+who+'があなたのコメントに返信しました':'💬 '+who+'があなたの投稿にコメントしました';
    const b=document.createElement('button');b.type='button';b.className='km-notify-item'+(!n.read_at?' unread':'');b.dataset.ids=n.ids.join(',');
    const title=document.createElement('strong');title.textContent=label;
    const body=document.createElement('span');body.className='small';body.textContent=n.kind==='reaction'?'「'+((n.body||'').split(' ').slice(1).join(' ')||'投稿')+'」　👤 タップすると、押してくれた人のプロフィールが開きます':(n.body||'');
    const date=document.createElement('span');date.className='small';date.textContent=kmTimeAgo(n.created_at)+(n.more?'　（'+who+'からほかに '+n.more+' 件）':'');date.title=new Date(n.created_at).toLocaleString('ja-JP');
    b.append(title,body,date);b.onclick=async()=>{
      if(!n.read_at){const {error:e}=await client.from('kimetomo_bell_notifications').update({read_at:new Date().toISOString()}).in('id',n.ids).eq('recipient_id',userId);if(e){$('km-notify-status').textContent='既読処理に失敗: '+safeError(e);return}}
      $('km-notify-panel').classList.add('hide');
      if(n.kind==='reaction'&&n.actor_id){const adm=await kimetomoFetchAdmins(client);kmOpenMemberProfile(n.actor_id,{name:names.get(n.actor_id)||'メンバー'},adm.has(n.actor_id));kmLoadNotifications();return}
      if(n.kind==='dm'){location.href='./dm.html?to='+encodeURIComponent(n.actor_id);return}
      if(n.kind==='admin_notice'&&n.ref_id==='report'){window.kmOpenAdminItem?.('km-report-fold');kmLoadNotifications();return}
      if(n.kind==='admin_notice'&&n.ref_id==='reportdone'){kmLoadNotifications();return}
      if(n.kind==='admin_notice'&&n.ref_id==='bug'){window.kmOpenAdminItem?.('km-bugadm-fold');kmLoadNotifications();return}
      if(n.kind==='admin_notice'&&n.ref_id==='bugreply'){const id='km-bug-fold';document.querySelector('.km-bottom-nav [data-km-go="profile"]')?.click();setTimeout(()=>{const f=document.getElementById(id);if(f){f.open=true;f.dispatchEvent(new Event('toggle'));f.scrollIntoView({behavior:'smooth',block:'start'})}},500);kmLoadNotifications();return}
      if(n.kind==='admin_notice'&&(n.ref_id==='wroom'||n.ref_id==='wroomflag')){$('km-notify-panel').classList.add('hide');window.kmOpenAdminItem?.('km-wroom-fold');kmLoadNotifications();return}
      if(n.kind==='admin_notice'&&(n.ref_id==='wroom_ok'||n.ref_id==='wroom_ng')){$('km-notify-panel').classList.add('hide');const rm=(n.url||'').match(/room=([0-9a-f-]+)/);if(rm)window.kmChatTargetRoom=rm[1];loadRooms().finally(()=>document.querySelector('.km-bottom-nav [data-km-go="chat"]')?.click());kmLoadNotifications();return}
      if(n.kind==='admin_notice'&&/^w(post|com):/.test(n.ref_id||'')){kmPendingPostId=n.ref_id.replace(/^w(post|com):/,'');window.kmActiveTab='timeline';window.kmSetNavReady(true);const url=new URL(location.href);url.searchParams.delete('tab');history.replaceState(null,'',url.pathname+url.search+url.hash);await loadTimeline();kmTryFocusPost();kmLoadNotifications();return}
      if(n.kind==='admin_notice'&&n.ref_id==='flag'){$('km-notify-panel').classList.add('hide');window.kmOpenAdminItem?.('km-flag-fold');kmLoadNotifications();return}
      if(n.kind==='admin_notice'){window.kmOpenAdminItem?.('km-support-fold');kmLoadNotifications();return}
      if(n.kind.startsWith('request')){kmLoadNotifications();return}
      if(n.kind==='chat'){if(n.ref_id)window.kmChatTargetRoom=String(n.ref_id);document.querySelector('.km-bottom-nav [data-km-go="chat"]')?.click();kmLoadNotifications();return}
      kmPendingPostId=n.ref_id;
      window.kmActiveTab='timeline';window.kmSetNavReady(true);
      const url=new URL(location.href);url.searchParams.delete('tab');history.replaceState(null,'',url.pathname+url.search+url.hash);
      await loadTimeline();kmTryFocusPost();kmLoadNotifications();
    };
    list.append(b);
    if(n.kind==='reaction'&&n.ref_id){const go=document.createElement('button');go.type='button';go.className='ghost km-notify-sub';go.textContent='📄 リアクションされた投稿を見る';go.onclick=async()=>{if(!n.read_at)await client.from('kimetomo_bell_notifications').update({read_at:new Date().toISOString()}).in('id',n.ids).eq('recipient_id',userId);$('km-notify-panel').classList.add('hide');kmPendingPostId=n.ref_id;window.kmActiveTab='timeline';window.kmSetNavReady(true);const url=new URL(location.href);url.searchParams.delete('tab');history.replaceState(null,'',url.pathname+url.search+url.hash);await loadTimeline();kmTryFocusPost();kmLoadNotifications()};list.append(go)}
  }
  $('km-notify-status').textContent=notices.length>=100?'新しい順に100件を表示しています':'';
 }catch(e){$('km-notify-status').textContent='通知の取得に失敗: '+safeError(e)}
 finally{kmNotifyBusy=false}
}
// ===== 2段階認証（認証アプリ） =====
let kmMfaUser=null;
async function kmMfaGate(user){
 try{
  const {data,error}=await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if(!error&&data?.nextLevel==='aal2'&&data.currentLevel!=='aal2'){
   kmMfaUser=user;current=null;show('auth',false);show('member',false);show('km-mfa',true);
   $('km-session-loading')?.classList.add('hide');$('km-mfa-status').textContent='';$('km-mfa-code').value='';
   setTimeout(()=>$('km-mfa-code').focus(),150);return true;
  }
 }catch(e){console.warn('2段階認証の確認:',e)}
 return false;
}
async function kmMfaVerified(){
 const {data,error}=await client.auth.mfa.listFactors();if(error)throw error;
 return (data?.all||data?.totp||[]).filter(f=>f.factor_type==='totp');
}
$('km-mfa-submit').onclick=async()=>{
 const code=$('km-mfa-code').value.replace(/\D/g,'');const st=$('km-mfa-status');
 if(code.length!==6){st.textContent='6桁の数字を入力してください。';return}
 busy('km-mfa-submit',true);st.textContent='確認しています…';
 try{
  const factor=(await kmMfaVerified()).find(f=>f.status==='verified');
  if(!factor)throw Error('2段階認証の設定が見つかりません。');
  const {error}=await client.auth.mfa.challengeAndVerify({factorId:factor.id,code});
  if(error){st.textContent='確認コードが違うか、時間切れです。認証アプリに出ている新しいコードを入力してください。';$('km-mfa-code').value='';return}
  st.textContent='';const u=kmMfaUser;kmMfaUser=null;show('km-mfa',false);
  await sync((await client.auth.getUser()).data?.user||u);note('ログインしました','success');
 }catch(e){st.textContent='確認できませんでした: '+safeError(e)}
 finally{busy('km-mfa-submit',false)}
};
$('km-mfa-code').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('km-mfa-submit').click()}});
$('km-mfa-code').addEventListener('input',()=>{const v=$('km-mfa-code').value.replace(/\D/g,'');if(v.length===6)$('km-mfa-submit').click()});
$('km-mfa-logout').onclick=async()=>{kmMfaUser=null;show('km-mfa',false);await client.auth.signOut();await sync(null)};
// 管理者メニュー：2段階認証の設定
async function kmMfaRender(done_msg){
 const box=$('km-mfa-box'),msg=$('km-mfa-msg'),state=$('km-mfa-state');if(!box||!client||!current)return;
 box.replaceChildren();msg.textContent='読み込み中…';
 let factors=[];
 try{factors=await kmMfaVerified()}catch(e){msg.textContent='読み込めません: '+safeError(e);return}
 msg.textContent=done_msg||'';
 const done=factors.find(f=>f.status==='verified');
 const mk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e};
 if(done){
  state.textContent='✅ 設定済み';
  box.append(mk('p','','✅ 2段階認証は設定済みです。ログインのたびに、パスワードのあと確認コードを入力します。'));
  const off=mk('button','ghost full','2段階認証をやめる');off.type='button';
  off.onclick=async()=>{if(!confirm('2段階認証をやめますか？\nやめると、パスワードだけでログインできるようになります。'))return;off.disabled=true;
   const {error}=await client.auth.mfa.unenroll({factorId:done.id});
   if(error){msg.textContent='やめられませんでした: '+safeError(error);off.disabled=false;return}
   kmMfaRender('2段階認証をやめました。')};
  box.append(off);return;
 }
 state.textContent='未設定';
 const start=mk('button','full','2段階認証を設定する');start.type='button';box.append(start);
 start.onclick=async()=>{
  start.disabled=true;msg.textContent='準備しています…';
  try{
   // 途中でやめた設定が残っていたら消してから作り直す
   for(const f of factors.filter(f=>f.status!=='verified'))await client.auth.mfa.unenroll({factorId:f.id});
   const {data,error}=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'キメ友 管理者 '+new Date().toISOString().slice(0,10),issuer:'kimetomo.com'});
   if(error)throw error;
   msg.textContent='';box.replaceChildren();
   box.append(mk('p','','① 認証アプリに追加します。iPhoneの「パスワード」アプリなら下の紫のボタン、Google Authenticatorなら「セットアップキーをコピー」を使います。両方に追加したいときは、「有効にする」を押す前に両方へ追加してください（どちらにも同じコードが出ます）。'));
   const add=mk('a','km-mfa-add','📲 パスワードアプリに追加する');add.href=data.totp.uri;box.append(add);
   box.append(mk('p','small','コピーしたセットアップキーは、認証アプリの「セットアップキーを入力」に貼り付けます。このキーは人に見せないでください。'));
   const copy=mk('button','ghost full','🔑 セットアップキーをコピー');copy.type='button';
   copy.onclick=async()=>{try{await navigator.clipboard.writeText(data.totp.secret);copy.textContent='✓ コピーしました'}catch{msg.textContent='コピーできませんでした。'}};box.append(copy);
   box.append(mk('p','','② 認証アプリに出た6桁の確認コードを入力して「有効にする」を押します。'));
   const input=mk('input');input.inputMode='numeric';input.autocomplete='one-time-code';input.maxLength=6;input.placeholder='123456';box.append(input);
   const ok=mk('button','full','有効にする');ok.type='button';ok.style.marginTop='8px';box.append(ok);
   const cancel=mk('button','ghost full','やめる');cancel.type='button';cancel.style.marginTop='8px';box.append(cancel);
   ok.onclick=async()=>{const code=input.value.replace(/\D/g,'');if(code.length!==6){msg.textContent='6桁の数字を入力してください。';return}
    ok.disabled=true;msg.textContent='確認しています…';
    const {error:e2}=await client.auth.mfa.challengeAndVerify({factorId:data.id,code});
    ok.disabled=false;
    if(e2){msg.textContent='確認コードが違うか、時間切れです。新しいコードを入力してください。';return}
    kmMfaRender('✅ 2段階認証を有効にしました。次のログインから確認コードが必要になります。')};
   cancel.onclick=async()=>{cancel.disabled=true;await client.auth.mfa.unenroll({factorId:data.id});kmMfaRender('設定をやめました。')};
  }catch(e){msg.textContent='設定を始められませんでした: '+safeError(e);start.disabled=false}
 };
}
$('km-mfa-fold')?.addEventListener('toggle',e=>{if(e.target.open)kmMfaRender()});
function kmTryFocusPost(){
 if(!kmPendingPostId)return;
 const el=document.getElementById('km-post-'+kmPendingPostId);
 if(el){el.classList.add('km-highlight');el.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>el.classList.remove('km-highlight'),2500);kmPendingPostId=null}
 else $('km-notify-status').textContent='対象の投稿が最新50件にないか、削除されています';
}
$('km-notify-button').onclick=async()=>{$('km-notify-panel').classList.toggle('hide');if(!$('km-notify-panel').classList.contains('hide')){$('km-notify-panel').scrollIntoView({behavior:'smooth',block:'start'});await kmLoadNotifications();kmMarkShownNoticesRead()}};
$('km-notify-close').onclick=()=>$('km-notify-panel').classList.add('hide');
// 広い画面（1200px以上）では、通知を右側にいつも出しておく（出しただけでは既読にしない。ベルを押すと既読）
(function(){
 const mq=matchMedia('(min-width: 1200px)'),panel=$('km-notify-panel');if(!panel)return;
 const keep=()=>{if(!mq.matches||!current||!document.body.classList.contains('km-nav-ready'))return;if(panel.classList.contains('hide')){panel.classList.remove('hide');kmLoadNotifications().then(kmMarkShownNoticesRead)}};
 new MutationObserver(keep).observe(panel,{attributes:true,attributeFilter:['class']});
 new MutationObserver(keep).observe(document.body,{attributes:true,attributeFilter:['class']});
 mq.addEventListener?.('change',()=>{if(mq.matches)keep();else panel.classList.add('hide')});
 document.addEventListener('click',async e=>{
  if(!mq.matches||!e.target.closest?.('#km-notify-button'))return;
  e.stopPropagation();keep();panel.scrollTop=0;await kmLoadNotifications();kmMarkShownNoticesRead();
 },true);
})();

$('km-notify-readall').onclick=async()=>{
 if(!current)return;
 const {error}=await client.from('kimetomo_bell_notifications').update({read_at:new Date().toISOString()}).eq('recipient_id',current.id).is('read_at',null);
 if(error)$('km-notify-status').textContent='既読処理に失敗: '+safeError(error);else await kmLoadNotifications();
};
document.addEventListener('visibilitychange',()=>{if(!document.hidden){kmCheckUnread();if(window.kmActiveTab==='chat')loadChat()}});
/* ===== 画像投稿（管理者だけ。データベース側でも管理者以外は拒否） ===== */
const KM_POST_IMAGES='kimetomo-post-images',KM_IMAGE_ONLY='📷';
function kmPaintImagePicker(){const box=$('km-img-compose');if(!box)return;const ok=window.kmIsAdmin||(window.kmWomenMember&&$('km-women-only')?.checked);box.classList.toggle('hide',!ok);if(!ok)kmClearImagePick()}
function kmClearImagePick(){const f=$('km-img-file');if(f)f.value='';const pv=$('km-img-preview'),img=$('km-img-preview-img');if(img?.src?.startsWith('blob:'))URL.revokeObjectURL(img.src);if(img)img.removeAttribute('src');pv?.classList.add('hide')}
$('km-img-file').addEventListener('change',()=>{const f=$('km-img-file').files?.[0];const pv=$('km-img-preview'),img=$('km-img-preview-img');if(img.src?.startsWith('blob:'))URL.revokeObjectURL(img.src);if(!f){pv.classList.add('hide');return}if(!f.type.startsWith('image/')){timelineStatus('画像ファイルを選んでください');kmClearImagePick();return}img.src=URL.createObjectURL(f);pv.classList.remove('hide')});
$('km-img-remove').onclick=e=>{e.stopPropagation();kmClearImagePick()};
async function kmMakePostImage(file){if(!file.type.startsWith('image/'))throw Error('画像ファイルを選んでください');if(!file.size||file.size>50*1024*1024)throw Error('写真は50MB以下にしてください');const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();if(img.width*img.height>100000000)throw Error('画像が大きすぎます');const scale=Math.min(1,1600/img.width,1600/img.height);const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);let blob=null;for(const q of [.82,.7,.55]){blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('画像変換に失敗しました')),'image/jpeg',q));if(blob.size<=3*1024*1024)break}if(blob.type!=='image/jpeg')throw Error('このブラウザではJPEG画像に変換できません');if(blob.size>3*1024*1024)throw Error('圧縮しても3MBを超えました');return blob}finally{URL.revokeObjectURL(url)}}
// 投稿画像のURLは50分間使い回す（毎回新しいURLにすると、同じ画像を何度もダウンロードしてしまうため）
/* 投稿の写真も、アイコンと同じく署名URLを7日間有効で作り、端末に保存して6日間使い回す（毎回ダウンロードし直さない＝通信量の節約） */
const KM_POST_IMG_KEY='km-post-img-urls-v1';
const kmPostImgCache=(()=>{let m;try{m=new Map(Object.entries(JSON.parse(localStorage.getItem(KM_POST_IMG_KEY)||'{}')))}catch{m=new Map()}const now=Date.now();for(const [k,v] of m)if(!(v?.exp>now)||typeof v.url!=='string')m.delete(k);return m})();
function kmPostImgSave(){try{const rows=[...kmPostImgCache].sort((a,b)=>b[1].exp-a[1].exp).slice(0,300);localStorage.setItem(KM_POST_IMG_KEY,JSON.stringify(Object.fromEntries(rows)))}catch{}}
async function kmPostImageUrls(posts){const map=new Map();const now=Date.now();const paths=[...new Set((posts||[]).map(p=>p.image_path).filter(Boolean))];if(!paths.length)return map;const need=paths.filter(p=>!(kmPostImgCache.get(p)?.exp>now));try{if(need.length){const {data,error}=await client.storage.from(KM_POST_IMAGES).createSignedUrls(need,KM_AVATAR_SIGN_SEC);if(error)throw error;(data||[]).forEach(x=>{if(x.signedUrl&&x.path)kmPostImgCache.set(x.path,{url:x.signedUrl,exp:now+KM_AVATAR_REUSE_MS})});kmPostImgSave()}}catch(e){console.warn('投稿画像の取得失敗',e)}for(const p of paths){const c=kmPostImgCache.get(p);if(c)map.set(p,c.url)}return map}
function kmPostImageEl(url){if(!url)return null;const a=document.createElement('a');a.className='km-post-img';a.href=url;a.target='_blank';a.rel='noopener';const img=document.createElement('img');img.src=url;img.alt='投稿画像';img.loading='lazy';img.decoding='async';a.append(img);return a}
$('timeline-submit').onclick=async()=>{
  const imgFile=(window.kmIsAdmin||(window.kmWomenMember&&$('km-women-only')?.checked))?$('km-img-file').files?.[0]:null;
  const body=$('timeline-body').value.trim()||(imgFile?KM_IMAGE_ONLY:'');
  if(!current||!body){timelineStatus('投稿内容を入力してください');return}
  if(!window.kmWarnOk?.(body))return;
  busy('timeline-submit',true);
  const pollOn=!$('km-poll-compose').classList.contains('hide');
  const options=[...document.querySelectorAll('.km-poll-opt')].map(i=>i.value.trim()).filter(Boolean);
  if(pollOn&&options.length<2){timelineStatus('アンケートの選択肢を2つ以上入力してください');busy('timeline-submit',false);return}
  // 🌷 名前を出さずに相談する（女性だけの投稿になる。画像・アンケートは付けられない）
  if($('km-anon-post')?.checked&&!$('km-anon-row')?.classList.contains('hide')){
   if(imgFile||pollOn||window.kmQuoteId?.()){timelineStatus('匿名の相談には、画像・アンケート・引用は付けられません');busy('timeline-submit',false);return}
   try{const {error}=await client.rpc('kimetomo_anon_post',{p_body:body});if(error)throw error;
    $('timeline-body').value='';$('km-anon-post').checked=false;window.kmCloseCompose?.();await loadTimeline();timelineStatus('名前を出さずに相談しました')}
   catch(e){timelineStatus('相談できませんでした: '+safeError(e))}finally{busy('timeline-submit',false)}
   return}
  if(imgFile&&$('km-expire-24h')?.checked){timelineStatus('画像付きの投稿は、24時間で消える投稿にできません');busy('timeline-submit',false);return}
  let image_path=null;
  try{
   if(imgFile){timelineStatus('画像を送信中…');const blob=await kmMakePostImage(imgFile);image_path=current.id+'/'+crypto.randomUUID()+'.jpg';const {error:ue}=await client.storage.from(KM_POST_IMAGES).upload(image_path,blob,{contentType:'image/jpeg',upsert:false,cacheControl:'31536000'});if(ue){image_path=null;throw ue}}
   const row={author_id:current.id,body};if(image_path)row.image_path=image_path;if($('km-comments-off')?.checked)row.comments_off=true;if($('km-expire-24h')?.checked)row.expires_at=new Date(Date.now()+864e5).toISOString();if($('km-women-only')?.checked&&!$('km-women-only-row')?.classList.contains('hide'))row.women_only=true;if(window.kmQuoteId?.())row.quote_post_id=window.kmQuoteId();
   const {data:created,error}=await client.from('kimetomo_timeline_posts').insert(row).select('id').single();if(error){if(image_path)await client.storage.from(KM_POST_IMAGES).remove([image_path]).catch(()=>{});throw error}
   if(pollOn){const {error:pe}=await client.from('kimetomo_timeline_polls').insert({post_id:created.id,options});if(pe){await client.from('kimetomo_timeline_posts').delete().eq('id',created.id).eq('author_id',current.id);throw pe}}
   $('timeline-body').value='';if($('km-comments-off'))$('km-comments-off').checked=false;if($('km-expire-24h'))$('km-expire-24h').checked=false;if($('km-women-only'))$('km-women-only').checked=false;window.kmCloseCompose?.();document.querySelectorAll('.km-poll-opt').forEach(i=>i.value='');$('km-poll-compose').classList.add('hide');$('km-poll-toggle').textContent='📊 アンケート';kmClearImagePick();window.kmQuoteClear?.();
   await loadTimeline();timelineStatus('投稿しました')}
  catch(e){timelineStatus('投稿できません: '+safeError(e))}
  finally{busy('timeline-submit',false)}
};
$('timeline-reload').onclick=loadTimeline;
$('km-poll-toggle').onclick=()=>{const c=$('km-poll-compose');c.classList.toggle('hide');$('km-poll-toggle').textContent=c.classList.contains('hide')?'📊 アンケート':'✕ アンケート'};

let activeRoom='';
async function loadRooms(){/* 入っているルームは端末に10分覚える（パソコンも同じ）。新しく入った部屋（kmChatTargetRoom）が無ければ読み直す */const kmRk='rooms-'+current.id;let kmRc=window.kmDC?.get(kmRk,600e3);if(kmRc&&window.kmChatTargetRoom&&!kmRc.ids.map(String).includes(String(window.kmChatTargetRoom)))kmRc=null;const {data,error}=kmRc?{data:kmRc.ids.map(room_id=>({room_id})),error:null}:await client.from('circle_room_members').select('room_id').eq('user_id',current.id);if(error){note('ルーム取得エラー: '+safeError(error),'error');return}const select=document.createElement('select');const ids=(data||[]).map(x=>x.room_id);if(!ids.length){const o=document.createElement('option');o.textContent='まだ参加中のルームがありません';o.value='';select.append(o);$('media-send')&&($('media-send').disabled=true);$('chat-send').disabled=true;const c=$('chat-room');c.replaceChildren();const opt=document.createElement('option');opt.textContent='ルームがありません';c.append(opt);$('chat-feed').textContent='共通チャットへの参加状態を確認してください。';await leaveChat();return}const {data:rooms,error:roomError}=kmRc?{data:kmRc.rooms,error:null}:await client.from('circle_rooms').select('id,name,women_only').in('id',ids);if(roomError){note(safeError(roomError),'error');return}if(!kmRc)window.kmDC?.set(kmRk,{ids,rooms:rooms||[]});window.kmWomenRooms=new Set((rooms||[]).filter(r=>r.women_only).map(r=>String(r.id)));roomNames=Object.fromEntries((rooms||[]).map(r=>[r.id,r.name]));{const one=(rooms||[]).length<=1;$('chat-room').style.display=one?'none':'';document.querySelector('label[for="chat-room"]').style.display=one?'none':''}const chatSelect=$('chat-room');chatSelect.replaceChildren();for(const r of rooms||[]){const c=document.createElement('option');c.value=r.id;c.textContent=r.name;chatSelect.append(c);const o=document.createElement('option');o.value=r.id;o.textContent=r.name;select.append(o)}$('media-send')&&($('media-send').disabled=false);if(window.kmChatTargetRoom&&ids.map(String).includes(window.kmChatTargetRoom)){activeRoom=window.kmChatTargetRoom;window.kmChatTargetRoom=null}select.value=ids.map(String).includes(String(activeRoom))?activeRoom:select.options[0]?.value||'';activeRoom=select.value;chatSelect.value=activeRoom;$('chat-send').disabled=false;await loadMedia();await joinChat(activeRoom)}
async function loadMedia(){/* チャットの画像共有は廃止したので何もしない */}

async function loadRequests(){
  // 登録制（承認なし）なので参加申請の一覧は使わない。管理者メニューだけ準備する
  await setupRoomAdmin();
  // メンバー一覧（BAN）は、管理者メニューの「メンバー管理（BAN）」を開いたときだけ読む（js/admin-ban.js）
}

async function leaveChat(){if(chatChannel&&client){await client.removeChannel(chatChannel);chatChannel=null}}
let chatJoinVersion = 0;
let chatJoinQueue = Promise.resolve();
async function joinChat(room) {
  const version = ++chatJoinVersion;
  chatJoinQueue = chatJoinQueue.catch(()=>{}).then(async()=>{
    await leaveChat();
    if(version!==chatJoinVersion || !room || !current)return;
    await loadChat();
    if(version!==chatJoinVersion || $('chat-room').value!==room)return;
    const next=client.channel('kimetomo-room-'+room+'-'+version);
    // 新着が続いても、読み込み直しは1.5秒に1回までにまとめる（人数が多くても重くならないように）
    // 届いたメッセージの中身（p.new）をためておき、まとめて画面に足す（Supabase に聞き直さない）
    const kmLiveRows=[];
    const kmSoon=p=>{if(version!==chatJoinVersion)return;if(p?.new)kmLiveRows.push(p.new);clearTimeout(window.kmChatReloadTimer);window.kmChatReloadTimer=setTimeout(()=>{const rows=kmLiveRows.splice(0);if(version===chatJoinVersion&&!document.hidden)loadChat({inc:true,rows})},1500)};
    next.on('postgres_changes',{event:'INSERT',schema:'public',table:'circle_messages',filter:'room_id=eq.'+room},kmSoon);

    // スタンプ用の表がある場合だけ購読（無い表を購読するとチャット全体のリアルタイムが止まるため）
    // スタンプの変化はリアルタイムで受け取らない（データベースの負担を減らすため。次のメッセージや開き直しで反映）
    chatChannel=next;
    next.subscribe(status=>{if(version!==chatJoinVersion)return;if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')note('リアルタイム接続が不安定です。更新してください。','error')});
  });
  return chatJoinQueue;
}
  // チャットに表示する名前と写真（5分間は読み直さない）
  let kmChatProfiles=new Map(),kmChatProfilesAt=0;
  async function kmChatAuthors(ids){
    const missing=ids.filter(id=>!kmChatProfiles.has(id));
    if(missing.length||Date.now()-kmChatProfilesAt>300000){
      const fetched=await timelineReadAuthors(Date.now()-kmChatProfilesAt>300000?ids:missing);
      if(Date.now()-kmChatProfilesAt>300000){kmChatProfiles=new Map();kmChatProfilesAt=Date.now()}
      fetched.forEach((v,k)=>kmChatProfiles.set(k,v));
    }
    return kmChatProfiles;
  }
  // 新着メッセージのときは、増えた分だけ読み込む（毎回50件を読み直さない＝通信量を減らす）
  let kmChatCache={room:null,msgs:[],reacts:new Map(),at:0};
  async function loadChat(opts){
    const room=$('chat-room').value,target=$('chat-feed');if(!room||!current)return;kmPaintChatPhoto();
    const kmPrevTop=target.scrollTop,kmNearBottom=window.kmChatForceBottom||!target.childElementCount||target.scrollHeight-target.scrollTop-target.clientHeight<80;window.kmChatForceBottom=false;
    let kmInc=!!opts?.inc&&kmChatCache.room===room&&kmChatCache.msgs.length>0&&Date.now()-kmChatCache.at<5*60000;
    // 端末に覚えたこのルームのメッセージ（10分以内に全部読んだもの）があれば、それを土台に新しい分だけ読む（パソコンも同じ）
    // スタンプを押したときなどは opts.full で全部読み直す
    const kmDcKey='chat-'+current.id+'-'+room;
    if(!kmInc&&!opts?.full){const c=window.kmDC?.get(kmDcKey,600e3);if(c?.msgs?.length&&Date.now()-c.full<600e3){kmChatCache={room,msgs:c.msgs,reacts:new Map(c.reacts||[]),at:c.full,since:c.since};kmInc=true}}
    // since＝Supabase から読んだ中でいちばん新しい時刻（リアルタイムで届いた分では進めない＝取りこぼしを次に拾う）
    const kmLast=kmInc?(kmChatCache.since||kmChatCache.msgs.reduce((m,x)=>x.created_at>m?x.created_at:m,'')):'';
    // リアルタイムで届いた中身があれば、それをそのまま使う（新しいメッセージにはまだリアクションがないので、それも聞かない）
    const kmRows=kmInc&&Array.isArray(opts?.rows)&&opts.rows.length&&opts.rows.every(r=>r?.id&&r.created_at&&String(r.room_id)===String(room))?opts.rows.map(r=>({id:r.id,sender_id:r.sender_id,body:r.body,created_at:r.created_at})):null;
    const [messages,media]=await Promise.all([
      kmRows?Promise.resolve({data:kmRows,error:null}):kmInc?client.from('circle_messages').select('id,sender_id,body,created_at').eq('room_id',room).gt('created_at',kmLast).order('created_at',{ascending:true}).limit(50)
           :client.from('circle_messages').select('id,sender_id,body,created_at').eq('room_id',room).order('created_at',{ascending:false}).limit(50),
      window.kmWomenRooms?.has(String(room))?client.from('circle_media').select('id,sender_id,object_path,created_at').eq('room_id',room).order('created_at',{ascending:false}).limit(30):Promise.resolve({data:[],error:null})
    ]);
    if(messages.error){note('チャット取得失敗: '+safeError(messages.error),'error');return}
    if(kmInc){
      const seen=new Set(kmChatCache.msgs.map(m=>m.id));const fresh=(messages.data||[]).filter(m=>!seen.has(m.id));
      const freshReacts=fresh.length&&!kmRows?await kmFetchChatReactions(fresh.map(m=>m.id)):new Map();
      for(const [k,v] of freshReacts)kmChatCache.reacts.set(k,v);
      messages.data=[...kmChatCache.msgs,...fresh].sort((a,b)=>a.created_at<b.created_at?1:-1).slice(0,50);
    }
    if((messages.data||[]).length>=50&&media.data?.length){const oldest=messages.data.reduce((m,x)=>x.created_at<m?x.created_at:m,messages.data[0].created_at);media.data=media.data.filter(x=>x.created_at>=oldest)}
    const items=[...(messages.data||[]).map(x=>({...x,type:'text'})),...(media.error?[]:(media.data||[])).map(x=>({...x,type:'media'}))].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
    const [kmReacts,profiles]=await Promise.all([
      kmInc?Promise.resolve(kmChatCache.reacts):kmFetchChatReactions((messages.data||[]).map(m=>m.id)),
      kmChatAuthors([...new Set(items.map(i=>i.sender_id))])
    ]);
    // 女性だけの部屋では、管理者の名前の横に👑を出す
    const kmRoomAdmins=window.kmWomenRooms?.has(String(room))?await kimetomoFetchAdmins(client):null;
    if($('chat-room').value!==room)return;
    kmChatCache={room,msgs:[...(messages.data||[])],reacts:kmReacts,at:kmInc?kmChatCache.at:Date.now(),since:kmRows?kmChatCache.since:(messages.data||[]).reduce((m,x)=>x.created_at>m?x.created_at:m,kmChatCache.since||'')};
    window.kmDC?.set(kmDcKey,{msgs:kmChatCache.msgs,reacts:[...kmChatCache.reacts],full:kmChatCache.at,since:kmChatCache.since});
    for(let i=items.length-1;i>=0;i--)if(kmBlocked.has(items[i].sender_id))items.splice(i,1);
    if(!current)return;
    target.replaceChildren();
    window.kmChatMarkSeen?.(items);
    if(!items.length){target.textContent='まだメッセージはありません。';return}
    let lastDate='';
    for(const item of items){
      const at=new Date(item.created_at);
      const day=at.toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric'});
      if(day!==lastDate){const d=document.createElement('div');d.className='chat-date';d.textContent=day;target.append(d);lastDate=day}
      const mine=item.sender_id===current.id;
      const profile=profiles.get(item.sender_id)||{name:mine?'自分':'メンバー'};
      const row=document.createElement('div');row.className='chat-message'+(mine?' mine':'');
      const avatar=document.createElement('div');avatar.className='chat-avatar';
      if(profile.url){const img=document.createElement('img');img.src=profile.url;img.alt='';img.loading='lazy';img.onerror=()=>{img.remove();avatar.textContent=(profile.name||'友').slice(0,1)};avatar.append(img)}
      else avatar.textContent=(profile.name||'友').slice(0,1);
      const content=document.createElement('div');content.className='chat-content';
      if(!mine){const name=document.createElement('div');name.className='chat-sender';name.textContent=profile.name||'メンバー';name.dataset.kmUid=item.sender_id;if(kmRoomAdmins?.has(item.sender_id))name.append(kimetomoCrown());content.append(name);
        // アイコンや名前を押すと、プロフィール（個人チャットへのボタン付き）を開く
        const openProfile=async()=>{const admins=await kimetomoFetchAdmins(client);kmOpenMemberProfile(item.sender_id,profile,admins.has(item.sender_id))};
        for(const el of [avatar,name]){el.setAttribute('role','button');el.tabIndex=0;el.setAttribute('aria-label',(profile.name||'メンバー')+'のプロフィールを開く');el.classList.add('km-tappable');el.onclick=openProfile}}
      const bubble=document.createElement('div');bubble.className='chat-bubble';
      if(item.type==='text'){
        const body=document.createElement('div');kmLinkify(body,item.body);bubble.append(body);
        kmAppendChatReactions(bubble,item,kmReacts);
      }else{
        const url=await kmChatMediaUrl(item.object_path);if(!url)continue;
        const el=document.createElement('img');el.src=url;el.alt='送られた写真';el.className='km-chat-photo';el.title='押すと大きく表示';
        const t0=Date.now();el.onload=()=>{if(kmNearBottom&&Date.now()-t0<4000)target.scrollTop=target.scrollHeight};
        el.onclick=()=>window.open(url,'_blank','noopener');bubble.append(el);
        if(mine||window.kmIsAdmin)bubble.append(kmBtn(mine?'🗑 削除':'🛡 削除',()=>kmDeleteChatPhoto(item),'ghost km-chat-photo-del'));
      }
      const time=document.createElement('div');time.className='chat-time';time.textContent=at.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
      content.append(bubble,time);row.append(avatar,content);target.append(row);
    }
    window.kmDecorateMoods?.();
    target.scrollTop=kmNearBottom?target.scrollHeight:kmPrevTop;
    window.kmChatAfterRender?.(items,kmNearBottom);
  }
// 女性だけの部屋のチャットでだけ、写真を送れる（DB 側も同じ制限：supabase/women_room_chat_images.sql）
const kmChatMediaUrls=new Map();
async function kmChatMediaUrl(path){const c=kmChatMediaUrls.get(path);if(c&&Date.now()-c.at<50*60000)return c.url;const {data,error}=await client.storage.from('circle-private-media').createSignedUrl(path,3600);if(error)return null;kmChatMediaUrls.set(path,{url:data.signedUrl,at:Date.now()});return data.signedUrl}
function kmPaintChatPhoto(){$('chat-photo-btn')?.classList.toggle('hide',!window.kmWomenRooms?.has(String($('chat-room').value||''))||window.kmWomenProbation>0)}
async function kmDeleteChatPhoto(item){if(!confirm('この写真を削除しますか？（元に戻せません）'))return;try{const {data,error}=await client.from('circle_media').delete().eq('id',item.id).select('id');if(error)throw error;if(!data?.length)throw Error('削除できる権限がありません');await client.storage.from('circle-private-media').remove([item.object_path]);kmChatMediaUrls.delete(item.object_path);await loadChat()}catch(e){note('写真を削除できませんでした: '+safeError(e),'error')}}
async function sendChatPhoto(file){const room=$('chat-room').value;if(!room||!file||!current||!window.kmWomenRooms?.has(String(room))||window.kmWomenProbation>0)return;const {data:left,error:le}=await client.rpc('kimetomo_chat_photos_left');if(!le&&left<=0){note('写真は1日5枚までです。明日（日本時間の0時すぎ）にまた送れます。','error');return}if(!confirm('この写真をチャットに送りますか？'+(le?'':'（今日はあと'+left+'枚）')))return;busy('chat-photo-btn',true);note('写真を送信中…');try{const blob=await kmMakePostImage(file);const path=room+'/'+current.id+'/'+crypto.randomUUID()+'.jpg';const {error:ue}=await client.storage.from('circle-private-media').upload(path,blob,{contentType:'image/jpeg',upsert:false});if(ue)throw ue;const {error}=await client.from('circle_media').insert({room_id:room,sender_id:current.id,object_path:path,mime_type:'image/jpeg',file_size:blob.size});if(error){await client.storage.from('circle-private-media').remove([path]);throw error}window.kmChatForceBottom=true;note('');await loadChat()}catch(e){const m=String(e?.message||'');note(m.includes('1日5枚')?m:'写真を送れませんでした: '+safeError(e),'error')}finally{busy('chat-photo-btn',false)}}
async function sendChat(){const room=$('chat-room').value,body=$('chat-text').value.trim();if(!room||!body)return;if(!window.kmWarnOk?.(body))return;busy('chat-send',true);try{const {error}=await client.from('circle_messages').insert({room_id:room,sender_id:current.id,body});if(error)throw error;$('chat-text').value='';window.kmChatForceBottom=true;await loadChat({inc:true})}catch(e){note('送信失敗: '+safeError(e),'error')}finally{busy('chat-send',false)}}

let roomAdminReady = false;

async function setupRoomAdmin() {
  if (roomAdminReady) {
    await refreshRoomAdmin();
    return;
  }

  const admin = $('admin');
  if (!admin) return;

  const panel = document.createElement('div');
  panel.id = 'room-admin-tools';
  panel.style.marginTop = '0';

  panel.innerHTML = `
    <details class="km-fold" id="km-room-fold">
      <summary><span class="km-fold-title">💬 チャットルーム管理<span class="small">ルームの作成・削除・メンバー追加</span></span></summary>
      <label for="new-room-name">新しいルーム名</label>
      <input id="new-room-name" maxlength="60" placeholder="例：ゲーム部屋">
      <button id="create-room-btn" class="full">ルームを作成</button>
      <details class="km-subfold">
        <summary>メンバーをルームに追加（ルームを増やしたとき用）</summary>
        <label for="admin-room-select">追加先のルーム</label>
        <select id="admin-room-select" style="width:100%;padding:13px;border-radius:12px;background:#1c1017;color:white;border:1px solid #5e4350"></select>
        <label for="admin-user-select">追加するメンバー</label>
        <select id="admin-user-select" style="width:100%;padding:13px;border-radius:12px;background:#1c1017;color:white;border:1px solid #5e4350"></select>
        <button id="add-room-member-btn" class="full">メンバーを追加</button>
      </details>
      <details class="km-subfold danger">
        <summary>チャットルームの削除</summary>
        <p class="small">削除するとルーム・参加情報・メッセージが消え、元に戻せません。「みんなのチャット」は削除できません。</p>
        <label for="delete-room-select">削除するルーム</label>
        <select id="delete-room-select" style="width:100%;padding:13px;border-radius:12px;background:#1c1017;color:white;border:1px solid #6c3042"></select>
        <button id="delete-room-btn" class="danger full" type="button">選択したルームを削除</button>
        <p id="delete-room-status" class="small" role="status"></p>
      </details>
    </details>
  `;

  admin.append(panel);
  roomAdminReady = true;

  $('create-room-btn').onclick = async () => {
    const name = $('new-room-name').value.trim();

    if (!name) {
      note('ルーム名を入力してください', 'error');
      return;
    }

    const btn = $('create-room-btn');
    busy('create-room-btn', true);

    try {
      const { data, error } = await client.rpc(
        'circle_create_room',
        { p_name: name }
      );

      if (error) throw error;

      $('new-room-name').value = '';

      note(
        'ルームを作成しました',
        'success'
      );

      await refreshRoomAdmin();
      await loadRooms();

    } catch (e) {
      note(
        'ルーム作成失敗: ' + safeError(e),
        'error'
      );
    } finally {
      btn.disabled = false;
    }
  };

  $('add-room-member-btn').onclick = async () => {
    const room = $('admin-room-select').value;


    const user = $('admin-user-select').value;

    if (!room || !user) {
      note(
        'ルームと友達を選択してください',
        'error'
      );
      return;
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user)) {
      note('ユーザーIDの形式が正しくありません', 'error');
      return;
    }

    busy('add-room-member-btn', true);

    try {
      const { error } = await client.rpc(
        'circle_add_member',
        {
          p_room: room,
          p_user: user
        }
      );

      if (error) throw error;


      note(
        'メンバーを追加しました',
        'success'
      );

      await loadRooms();
      await refreshRoomAdmin();

    } catch (e) {
      note(
        'メンバー追加失敗: ' + safeError(e),
        'error'
      );
    } finally {
      busy('add-room-member-btn', false);
    }
  };

  $('delete-room-btn').onclick = async () => {
    const select = $('delete-room-select');
    const roomId = select.value;
    const roomName = select.selectedOptions[0]?.textContent || '';
    const status = $('delete-room-status');
    if (!roomId || !roomName || roomName === 'みんなのチャット') {
      status.textContent = '削除可能なルームを選んでください';
      return;
    }
    const typed = prompt('ルーム「' + roomName + '」を削除します。\n確認のため、ルーム名を正確に入力してください。\n投稿履歴も削除されます。');
    if (typed !== roomName) {
      status.textContent = 'キャンセルしました（ルーム名が一致しません）';
      return;
    }
    if (!confirm('【最終確認】「' + roomName + '」を完全に削除しますか？\nこの操作は取り消せません。')) return;
    busy('delete-room-btn', true);
    status.textContent = '削除中…';
    try {
      const { error } = await client.rpc('kimetomo_admin_delete_room', {
        p_room: roomId,
        p_confirm_name: roomName
      });
      if (error) throw error;
      status.textContent = '「' + roomName + '」を削除しました';
      await refreshRoomAdmin();
      await loadRooms();
    } catch (e) {
      status.textContent = '削除できませんでした: ' + safeError(e);
    } finally {
      busy('delete-room-btn', false);
    }
  };

  $('km-room-fold').addEventListener('toggle', () => { if ($('km-room-fold').open) refreshRoomAdmin(); });

  await refreshRoomAdmin();
}

async function refreshRoomAdmin() {
  if (!roomAdminReady || !current) return;

  const roomSelect = $('admin-room-select');
  const deleteSelect = $('delete-room-select');
  const userSelect = $('admin-user-select');

  const previousRoom = roomSelect.value;
  const previousDeleteRoom = deleteSelect.value;
  const previousUser = userSelect.value;

  roomSelect.replaceChildren();
  deleteSelect.replaceChildren();
  userSelect.replaceChildren();

  try {
    const { data: rooms, error: roomError } =
      await client
        .from('circle_rooms')
        .select('id,name')
        .order('name');

    if (roomError) throw roomError;

    for (const room of rooms || []) {
      const option = document.createElement('option');
      option.value = room.id;
      option.textContent = room.name;
      roomSelect.append(option);
      if (room.name !== 'みんなのチャット') {
        const del = document.createElement('option');
        del.value = room.id;
        del.textContent = room.name;
        deleteSelect.append(del);
      }
    }
    $('delete-room-btn').disabled = deleteSelect.options.length === 0;
    if (previousDeleteRoom && [...deleteSelect.options].some(o => o.value === previousDeleteRoom)) {
      deleteSelect.value = previousDeleteRoom;
    }

    if (previousRoom &&
        [...roomSelect.options].some(
          o => o.value === previousRoom
        )) {
      roomSelect.value = previousRoom;
    }

  } catch (e) {
    note(
      'ルーム一覧取得失敗: ' + safeError(e),
      'error'
    );
  }

  try {
    // 承認済みメンバーの一覧（選ぶ欄用）は、端末に10分覚えておく（js/device-cache.js）
    let users = window.kmDC?.get('approved-users', 600e3), userError = null;
    if (!users) {
      ({ data: users, error: userError } =
        await client
          .from('circle_profiles')
          .select('user_id,display_name,status')
          .eq('status', 'approved')
          .order('display_name'));
      if (!userError) window.kmDC?.set('approved-users', (users || []).map(u => ({ user_id: u.user_id, display_name: u.display_name })));
    }

    if (userError) throw userError;

    for (const user of users || []) {
      const option = document.createElement('option');
      option.value = user.user_id;
      option.textContent =
        user.display_name || user.user_id;
      userSelect.append(option);
    }

    if (previousUser &&
        [...userSelect.options].some(
          o => o.value === previousUser
        )) {
      userSelect.value = previousUser;
    }

  } catch (e) {
    note(
      'メンバー一覧を取得できません。詳細: ' +
      safeError(e),
      'error'
    );
  }
}

$('chat-room').onchange=async()=>{activeRoom=$('chat-room').value;await loadMedia();await joinChat(activeRoom)};$('chat-send').onclick=sendChat;$('chat-photo-btn').onclick=()=>$('chat-photo-file').click();$('chat-photo-file').onchange=()=>{const f=$('chat-photo-file').files?.[0];$('chat-photo-file').value='';if(f)sendChatPhoto(f)};$('chat-text').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();sendChat()}});/* チャットへの画像送信は廃止 */void 0;$('tab-login').onclick=()=>authMode('login');$('tab-signup').onclick=()=>authMode('signup');$('auth-submit').onclick=submit;$('km-pw-toggle').onclick=()=>{const show=$('password').type==='password';for(const id of ['password','password2'])$(id).type=show?'text':'password';$('km-pw-toggle').textContent=show?'🙈':'👁';$('km-pw-toggle').setAttribute('aria-label',show?'パスワードを隠す':'パスワードを表示')};$('logout').onclick=async()=>{if(!confirm('ログアウトしますか？'))return;const {error}=await client.auth.signOut();if(error)note(safeError(error),'error');else note('ログアウトしました')};$('refresh').onclick=()=>sync(current);
// 公開用の接続情報だけで自動接続。DM画面との設定共有も維持する。
const PUBLIC_SUPABASE_URL='https://hazcwbczsswjptvblpwt.supabase.co';
const PUBLIC_SUPABASE_KEY='sb_publishable_48ekGbMoWNgl7Wx9ehUYGQ_INqlWzv4';
authMode('login');
try{const last=localStorage.getItem('km-last-username');if(last&&!$('km-username').value){$('km-username').value=last;if(mode==='login')$('km-last-hint').style.display=''}}catch{}$('km-username').addEventListener('input',()=>{$('km-last-hint').style.display='none'});
// ページ内のほかのスクリプト（アンケート・スタンプ・気分など）が読み込まれてから接続を始める
const kmStart=()=>{try{
 if(!PUBLIC_SUPABASE_KEY.startsWith('sb_publishable_')) throw Error('公開用Supabaseキーを確認してください');
 localStorage.setItem('kimetomo_supabase',JSON.stringify({url:PUBLIC_SUPABASE_URL,key:PUBLIC_SUPABASE_KEY}));
 configure(PUBLIC_SUPABASE_URL,PUBLIC_SUPABASE_KEY);
}catch(e){show('auth',false);note('接続に失敗しました: '+safeError(e),'error')}};
const kmGo=async()=>{if(await window.kmMaintenanceCheck)return;kmStart()};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',kmGo,{once:true});else kmGo();
})();
