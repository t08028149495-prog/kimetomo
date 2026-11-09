/* ⚡ 軽量モード：推奨より古い・遅い端末では、すりガラスのぼかし・ただよう背景の光・タブ切替のアニメ・きらめきを止める
   ・<head> で読み込み、画面が出る前に <html> に km-lite を付ける（見た目は css/glow.css の最後）
   ・自動の見分け方：
       ① メモリ4GB以下・CPU4コア以下と分かる端末は、すぐ軽量にする
       ② それ以外は、開いて少したってから約3秒だけ画面のなめらかさを測る
          （1コマ0.05秒以上かかるコマが多い、またはふだんから1コマ0.04秒以上 → 軽量に）
          iPhone の省電力モード（1秒30コマ）は軽量にしない。結果は3日覚えて、そのあと測り直す
   ・プロフィールの「⚡ 軽量モード」で「自動／いつも軽く／使わない」を選べる
   ・覚える場所は localStorage の km-lite（端末のこと なので、ログアウトしても消さない） */
(function(){
 const KEY='km-lite',DAYS=3,root=document.documentElement;
 const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return{}}};
 const write=v=>{try{localStorage.setItem(KEY,JSON.stringify(v))}catch(e){}};
 let s=read();const mode=()=>s.mode||'auto';
 const weakSpec=()=>(navigator.deviceMemory&&navigator.deviceMemory<=4)||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4);
 const fresh=()=>typeof s.auto==='boolean'&&Date.now()-(s.at||0)<DAYS*864e5;
 function apply(){
  const on=mode()==='on'||(mode()==='auto'&&(weakSpec()||(fresh()&&s.auto)));
  root.classList.toggle('km-lite',!!on);paintSetting();return on;
 }
 window.kmLite={get on(){return root.classList.contains('km-lite')},get mode(){return mode()},
  set(m){s={...s,mode:m};write(s);apply()}};

 // なめらかさを測る（画面が見えているときだけ。途中で隠れたらやめる）
 function measure(){
  if(mode()!=='auto'||weakSpec()||fresh())return;
  if(document.visibilityState!=='visible'){document.addEventListener('visibilitychange',()=>setTimeout(measure,3000),{once:true});return}
  const gaps=[];let last=0,start=0,stop=false;
  const onHide=()=>{stop=true};document.addEventListener('visibilitychange',onHide,{once:true});
  requestAnimationFrame(function tick(t){
   if(stop)return;
   if(last)gaps.push(t-last);else start=t;last=t;
   if(t-start<3000)return requestAnimationFrame(tick);
   document.removeEventListener('visibilitychange',onHide);
   if(gaps.length<20)return;
   const sorted=[...gaps].sort((a,b)=>a-b),median=sorted[sorted.length>>1],slow=gaps.filter(g=>g>50).length/gaps.length;
   s={...s,auto:median>40||slow>0.15,at:Date.now(),fps:Math.round(1000/median)};write(s);apply();
  });
 }
 apply();
 // 読み込み直後は重いのが当たり前なので、落ち着いてから測る
 addEventListener('load',()=>setTimeout(measure,4000),{once:true});

 // プロフィールの切り替え（index.html の #km-lite-mode）
 function paintSetting(){
  const sel=document.getElementById('km-lite-mode'),st=document.getElementById('km-lite-state');if(!sel)return;
  sel.value=mode();
  if(st)st.textContent=root.classList.contains('km-lite')?'いまは軽量モードで表示しています':(mode()==='auto'&&!fresh()&&!weakSpec()?'この端末の速さを確かめています（開いて少したつと決まります）':'いまはふつうの表示です');
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const sel=document.getElementById('km-lite-mode');if(!sel)return;
  sel.onchange=()=>window.kmLite.set(sel.value);paintSetting();
 });
})();
