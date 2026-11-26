/* 絵文字ボタン（パソコンだけ）
   マウスで操作する端末（パソコンの Chrome など）で、投稿・コメント・チャット・DM などの入力欄を押すと、
   欄の右下に「☺」のボタンが出る。押すと絵文字の一覧が開き、選ぶとカーソルの位置に入る（何個でも続けて選べる）。
   スマホはキーボードに絵文字があるので出さない。最近使った絵文字は端末に覚える（キー km-emo-recent）。
   index.html と dm.html の両方で読み込む。見た目は css/emoji-picker.css。 */
(()=>{
'use strict';
const pc=matchMedia('(hover:hover) and (pointer:fine)');
// 絵文字を出す入力欄（ログイン・URL・確認用の欄には出さない）
const TARGET=['#timeline-body','#chat-text','#message-input','#my-profile-bio','#my-profile-name','#km-pin-input','.km-poll-opt','.km-comment-form textarea'].join(',');
const RKEY='km-emo-recent';
const GROUPS=[
 ['🕘','最近',null],
 ['😀','顔','😀 😃 😄 😁 😆 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😋 😛 😜 🤪 😝 🤗 🤭 🫢 🤫 🤔 🫡 😐 😑 😶 🫥 😏 😒 🙄 😬 😮‍💨 😌 😔 😪 😴 😷 🤒 🥴 😵‍💫 🥳 🥸 😎 🤓 🧐 😕 🫤 😟 🙁 😮 😯 😲 😳 🥺 🥹 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 👻 👽 🤖 💩 😺 😸 😹 😻 😼 😽 🙀 😿 😾 🙈 🙉 🙊'],
 ['💖','ハート','❤️ 🩷 🧡 💛 💚 💙 🩵 💜 🤎 🖤 🩶 🤍 💖 💗 💓 💞 💕 💘 💝 💟 ❣️ 💔 ❤️‍🔥 ❤️‍🩹 💋 💌 💯 💢 💥 💫 💦 💨 💬 💭 💤 ✨ 🌟 ⭐ 🔥 🎉 🎊 🎀 🎁'],
 ['👍','手・人','👍 👎 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👋 🤚 🖐️ ✋ 🖖 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💅 💪 🫵 👀 👁️ 👄 🫦 🙋 🙆 🙅 🤷 🤦 🙇 💁 🧏 👯 💃 🕺 🚶 🏃 🧘 🛌'],
 ['🌸','花・動物','🌸 🌷 🌹 🥀 🌺 🌻 🌼 💐 🍀 🌿 🌱 🍁 🍂 🌙 🌛 ☀️ 🌈 ☁️ ⛅ 🌧️ ⛈️ ❄️ ☃️ 🌊 🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🐤 🦄 🐝 🦋 🐌 🐢 🐍 🐙 🐬 🐳 🐟 🐾'],
 ['🍰','食べ物','🍎 🍓 🍒 🍑 🍇 🍉 🍋 🍌 🍍 🥝 🍅 🥑 🍞 🥐 🧀 🍳 🥓 🍔 🍟 🍕 🌭 🌮 🍜 🍝 🍛 🍣 🍱 🍙 🍘 🍤 🍢 🍡 🍦 🍧 🍨 🍩 🍪 🎂 🍰 🧁 🍫 🍬 🍭 🍮 🍯 ☕ 🍵 🧋 🥤 🍺 🍻 🥂 🍷 🍸 🍹 🍶'],
 ['🎮','あそび・もの','⚽ 🏀 ⚾ 🎾 🏐 🎳 ⛳ 🎣 🏂 🎮 🕹️ 🎲 🧩 🎯 🎤 🎧 🎵 🎶 🎸 🎹 🎬 📷 📸 📱 💻 ⌚ 📺 💡 📚 ✏️ 📝 📌 📍 ✂️ 🔑 🎈 🛍️ 💄 💍 👑 👗 👠 👟 🧸 🚗 🚃 ✈️ 🚀 🏠 🏖️ 🗼 🎡 ⛺ 💰 🎫'],
 ['✅','記号','✅ ☑️ ✔️ ❌ ❎ ⭕ ❗ ❓ ‼️ ⁉️ ⚠️ 🚫 🔞 🆗 🆕 🆙 🆒 🆓 🈁 🉐 ㊗️ 🔴 🟠 🟡 🟢 🔵 🟣 🟤 ⚫ ⚪ 🔺 🔻 ▶️ ◀️ 🔼 🔽 ⏩ ⏪ ➡️ ⬅️ ⬆️ ⬇️ ↩️ 🔁 🔄 ➕ ➖ ✖️ ♾️ 💲 ©️ ®️ ™️ 🎵 🔔 🔕 📣 💤 🕐']
];
const list=g=>g[2]?g[2].split(' '):recent();
function recent(){try{const a=JSON.parse(localStorage.getItem(RKEY)||'[]');return Array.isArray(a)?a.filter(x=>typeof x==='string').slice(0,32):[]}catch{return[]}}
function remember(e){try{const a=recent().filter(x=>x!==e);a.unshift(e);localStorage.setItem(RKEY,JSON.stringify(a.slice(0,32)))}catch{}}
const mk=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n};
// 押しても入力欄からカーソルが外れないように。投稿欄の「外を押したら閉じる」などにも伝えない
const keep=n=>{n.addEventListener('mousedown',e=>e.preventDefault());n.addEventListener('click',e=>e.stopPropagation())};

let field=null,btn=null,panel=null,grid=null,tabs=null,cur=0;
function build(){
 btn=mk('button','km-emo-btn');btn.type='button';btn.tabIndex=-1;
 btn.setAttribute('aria-label','絵文字を入れる');btn.title='絵文字（Windows は「Win」＋「.」でも出せます）';
 btn.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2"/><circle cx="9" cy="10" r=".6" fill="currentColor"/><circle cx="15" cy="10" r=".6" fill="currentColor"/></svg>';
 keep(btn);btn.addEventListener('click',()=>panel.classList.contains('hidden')?openPanel():closePanel());
 panel=mk('div','km-emo-panel hidden');panel.setAttribute('role','dialog');panel.setAttribute('aria-label','絵文字');keep(panel);
 tabs=mk('div','km-emo-tabs');grid=mk('div','km-emo-grid');
 GROUPS.forEach((g,i)=>{const t=mk('button','km-emo-tab',g[0]);t.type='button';t.title=g[1];t.setAttribute('aria-label',g[1]);t.onclick=()=>show(i);tabs.append(t)});
 // 右上の「✕」で閉じる（入力欄はそのまま）。Esc・一覧の外を押しても閉じる
 const x=mk('button','km-emo-close','✕');x.type='button';x.title='閉じる';x.setAttribute('aria-label','絵文字を閉じる');x.onclick=closePanel;tabs.append(x);
 grid.addEventListener('click',e=>{const b=e.target.closest('.km-emo-pick');if(b)insert(b.textContent)});
 panel.append(tabs,grid);document.body.append(btn,panel);
}
function show(i){
 cur=i;const items=list(GROUPS[i]);
 [...tabs.children].forEach((t,j)=>t.classList.toggle('on',j===i));
 grid.replaceChildren();grid.scrollTop=0;
 if(!items.length){grid.append(mk('p','km-emo-empty','使った絵文字がここに出ます'));return}
 for(const e of items){const b=mk('button','km-emo-pick',e);b.type='button';grid.append(b)}
}
function insert(e){
 if(!field||field.disabled||field.readOnly)return;
 const max=field.maxLength>0?field.maxLength:Infinity,s=field.selectionStart??field.value.length,en=field.selectionEnd??s;
 if(field.value.length-(en-s)+e.length>max)return;
 field.focus();
 // ふつうに打ったのと同じ扱い（元に戻す・文字数の表示・高さの自動調整が動く）
 if(!document.execCommand?.('insertText',false,e)){field.setRangeText(e,s,en,'end');field.dispatchEvent(new Event('input',{bubbles:true}))}
 remember(e);
}
function place(){
 if(!field||!field.isConnected||!field.offsetParent){hide();return}
 const r=field.getBoundingClientRect(),bw=28;
 const multi=field.tagName==='TEXTAREA'&&r.height>52;
 btn.style.left=Math.round(r.right-bw-6)+'px';
 btn.style.top=Math.round(multi?r.bottom-bw-6:r.top+(r.height-bw)/2)+'px';
 if(panel.classList.contains('hidden'))return;
 const pw=Math.min(328,innerWidth-16),ph=panel.offsetHeight||300,b=btn.getBoundingClientRect();
 panel.style.width=pw+'px';
 panel.style.left=Math.round(Math.max(8,Math.min(b.right-pw,innerWidth-pw-8)))+'px';
 // 入力欄の上に入ればその上、だめなら下。どちらも入らなければボタンのそば（文字を隠さないように）
 const top=r.top-ph-8>=8?r.top-ph-8:r.bottom+ph+8<=innerHeight?r.bottom+8:b.top-ph-8>=8?b.top-ph-8:Math.min(b.bottom+8,innerHeight-ph-8);
 panel.style.top=Math.round(Math.max(8,top))+'px';
}
function openPanel(){show(recent().length&&cur===0?0:(cur||1));panel.classList.remove('hidden');btn.setAttribute('aria-expanded','true');place()}
function closePanel(){panel?.classList.add('hidden');btn?.setAttribute('aria-expanded','false')}
function hide(){closePanel();btn?.classList.add('hidden');field?.classList.remove('km-emo-pad');field=null}
function attach(el){
 if(!btn)build();
 if(field!==el){field?.classList.remove('km-emo-pad');closePanel()}
 field=el;el.classList.add('km-emo-pad');btn.classList.remove('hidden');place();
}
document.addEventListener('focusin',e=>{
 if(!pc.matches)return;const el=e.target;
 if(el instanceof HTMLElement&&el.matches(TARGET)&&!el.disabled&&!el.readOnly)attach(el);
});
document.addEventListener('focusout',()=>{setTimeout(()=>{const a=document.activeElement;if(field&&a!==field&&!panel?.contains(a))hide()},0)});
document.addEventListener('pointerdown',e=>{if(panel&&!panel.classList.contains('hidden')&&!panel.contains(e.target)&&!btn.contains(e.target))closePanel()},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel&&!panel.classList.contains('hidden')){closePanel();e.stopPropagation()}},true);
// 入力欄で Enter を押して送った後などに、欄が動いたり消えたりしても付いていく
let raf=0;const follow=()=>{if(!field||raf)return;raf=requestAnimationFrame(()=>{raf=0;place()})};
addEventListener('scroll',follow,true);addEventListener('resize',follow);
document.addEventListener('input',e=>{if(e.target===field)follow()});
})();
