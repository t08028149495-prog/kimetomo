// アイコン写真を選んだら、丸く切り取る位置と大きさを選ぶ画面を出す
// 指（またはマウス）でずらす・2本指やスライダーで拡大。決定すると 256×256 の JPEG（小さくして通信量を節約） を作る。
(()=>{
 const input=document.getElementById('my-profile-photo');if(!input)return;
 const OUT=256,MAX_BYTES=50*1024*1024,MAX_PIXELS=100000000;
 window.kmAvatarCropBlob=null;
 const say=t=>{const s=document.getElementById('my-profile-status');if(s)s.textContent=t};
 const mk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};

 function open(file){
  return new Promise(async(resolve)=>{
   const url=URL.createObjectURL(file);const img=new Image();img.alt='';img.draggable=false;img.src=url;
   try{await img.decode()}catch{URL.revokeObjectURL(url);say('この写真は読み込めませんでした。JPEG・PNG の写真で試してください');resolve(null);return}
   if(img.naturalWidth*img.naturalHeight>MAX_PIXELS){URL.revokeObjectURL(url);say('写真の画素数が大きすぎます（1億画素まで）');resolve(null);return}
   const W=img.naturalWidth,H=img.naturalHeight;
   const overlay=mk('div','km-profile-overlay km-crop-overlay');
   const card=mk('section','km-profile-card km-crop-card');card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.setAttribute('aria-label','アイコンの位置を決める');
   const title=mk('h2','','丸の位置を決める');
   const hint=mk('p','small','写真をずらして、丸の中に入れたい所を合わせてください。');
   const stage=mk('div','km-crop-stage');const ring=mk('div','km-crop-ring');stage.append(img,ring);
   const zoomRow=mk('label','km-crop-zoom');const zoom=mk('input');zoom.type='range';zoom.min='1';zoom.max='5';zoom.step='0.01';zoom.value='1';zoom.setAttribute('aria-label','拡大');
   zoomRow.append(mk('span','','－'),zoom,mk('span','','＋'));
   const btns=mk('div','km-crop-btns');const cancel=mk('button','ghost','やめる');cancel.type='button';const ok=mk('button','','決定');ok.type='button';btns.append(cancel,ok);
   card.append(title,hint,stage,zoomRow,btns);overlay.append(card);document.body.append(overlay);

   // z=1 のとき、写真の短い辺が丸にぴったり合う。cx,cy は丸の中心が写真のどこか（写真の画素）
   let z=1,cx=W/2,cy=H/2;
   const size=()=>stage.clientWidth||300;
   const base=()=>size()/Math.min(W,H); // 写真1画素が画面で何px か（z=1）
   const clamp=()=>{const half=size()/2/(base()*z);cx=Math.min(Math.max(cx,half),W-half);cy=Math.min(Math.max(cy,half),H-half)};
   const paint=()=>{clamp();const s=base()*z;img.style.width=W*s+'px';img.style.height=H*s+'px';img.style.transform=`translate(${size()/2-cx*s}px,${size()/2-cy*s}px)`};
   const setZoom=v=>{z=Math.min(5,Math.max(1,v));zoom.value=String(z);paint()};
   paint();requestAnimationFrame(paint);

   const pts=new Map();let pinch=null;
   stage.addEventListener('pointerdown',e=>{stage.setPointerCapture(e.pointerId);pts.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pts.size===2){const [a,b]=[...pts.values()];pinch={d:Math.hypot(a.x-b.x,a.y-b.y),z}}});
   stage.addEventListener('pointermove',e=>{const p=pts.get(e.pointerId);if(!p)return;
    if(pts.size===1){const s=base()*z;cx-=(e.clientX-p.x)/s;cy-=(e.clientY-p.y)/s;p.x=e.clientX;p.y=e.clientY;paint();return}
    p.x=e.clientX;p.y=e.clientY;if(pinch){const [a,b]=[...pts.values()];setZoom(pinch.z*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinch.d))}});
   const up=e=>{pts.delete(e.pointerId);if(pts.size<2)pinch=null};
   stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
   stage.addEventListener('wheel',e=>{e.preventDefault();setZoom(z*(e.deltaY<0?1.1:1/1.1))},{passive:false});
   zoom.addEventListener('input',()=>setZoom(Number(zoom.value)));
   const onResize=()=>paint();window.addEventListener('resize',onResize);
   const onKey=e=>{if(e.key==='Escape')finish(null)};document.addEventListener('keydown',onKey);

   function finish(result){window.removeEventListener('resize',onResize);document.removeEventListener('keydown',onKey);overlay.remove();URL.revokeObjectURL(url);resolve(result)}
   cancel.onclick=()=>finish(null);
   overlay.addEventListener('click',e=>{if(e.target===overlay)finish(null)});
   ok.onclick=async()=>{ok.disabled=true;ok.textContent='作成中…';
    try{clamp();const side=Math.min(W,H)/z,sx=cx-side/2,sy=cy-side/2;
     const c=document.createElement('canvas');c.width=c.height=OUT;const g=c.getContext('2d');g.imageSmoothingQuality='high';g.fillStyle='#fff';g.fillRect(0,0,OUT,OUT);
     g.drawImage(img,sx,sy,side,side,0,0,OUT,OUT);
     const blob=await new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(Error('画像の変換に失敗しました')),'image/jpeg',.82));
     if(blob.type!=='image/jpeg')throw Error('このブラウザではJPEG画像に変換できません');
     finish(blob)}
    catch(err){say(err.message||'画像の変換に失敗しました');ok.disabled=false;ok.textContent='決定'}};
  });
 }

 input.addEventListener('change',async()=>{
  window.kmAvatarCropBlob=null;const file=input.files?.[0];if(!file)return;
  if(!file.type.startsWith('image/')||file.type==='image/gif'){say('写真（画像）を選んでください。動画・GIFは使えません');input.value='';return}
  if(!file.size||file.size>MAX_BYTES){say('写真は50MB以下にしてください');input.value='';return}
  say('');
  const blob=await open(file);
  if(!blob){input.value='';return}
  window.kmAvatarCropBlob=blob;
  const pv=document.getElementById('my-avatar-preview'),fb=document.getElementById('my-avatar-fallback');
  if(pv){if(pv.src?.startsWith('blob:'))URL.revokeObjectURL(pv.src);pv.src=URL.createObjectURL(blob);pv.style.display='block';if(fb)fb.style.display='none'}
  say('位置を決めました。「保存」を押すと変わります');
 });
})();
