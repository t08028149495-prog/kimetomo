/* ⚡ 軽量モード：推奨より古い・遅い端末では、すりガラスのぼかし・ただよう背景の光・タブ切替のアニメ・きらめきを止める
   ・<head> で読み込み、画面が出る前に <html> に km-lite を付ける（見た目は css/glow.css の最後）
   ・自動の見分け方：
       ① メモリ4GB以下・CPU4コア以下と分かる端末は、すぐ軽量にする
       ② それ以外は、開いて少したってから約3秒だけ画面のなめらかさを測る
          （1コマ0.05秒以上かかるコマが多い、またはふだんから1コマ0.04秒以上 → 軽量に）
          iPhone の省電力モード（1秒30コマ）は軽量にしない。結果は3日覚えて、そのあと測り直す
   ・メンバーが自分で切り替える項目はない（自動だけ。2026-11-09 にプロフィールの項目をやめた）
   ・覚える場所は localStorage の km-lite（端末のこと なので、ログアウトしても消さない） */
(function(){
 const KEY='km-lite',DAYS=3,root=document.documentElement;
 const read=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return{}}};
 const write=v=>{try{localStorage.setItem(KEY,JSON.stringify(v))}catch(e){}};
 let s=read();
 const weakSpec=()=>(navigator.deviceMemory&&navigator.deviceMemory<=4)||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4);
 const fresh=()=>typeof s.auto==='boolean'&&Date.now()-(s.at||0)<DAYS*864e5;
 function apply(){
  const on=weakSpec()||(fresh()&&s.auto);
  root.classList.toggle('km-lite',!!on);return on;
 }
 window.kmLite={get on(){return root.classList.contains('km-lite')}};

 // なめらかさを測る（画面が見えているときだけ。途中で隠れたらやめる）
 function measure(){
  if(weakSpec()||fresh())return;
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

})();
