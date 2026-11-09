/* 端末に覚えておく（Supabase への問い合わせを減らす。推奨：iPhone 15・Pixel 7 以降）
   - 名前とアイコンの保存場所（3 時間）、メンバー一覧・管理人の印・DM の最新など（それぞれの場所で時間を決める）
   - 保存のキーは「km-c-」で始める。ログアウトしたら全部消す（app.js の sync / dm.html の checkSession）
   - 端末に保存できない（プライベートモードなど）ときは、今まで通り毎回 Supabase から読むだけ */
(()=>{
 const P='km-c-';
 const get=(k,ttl)=>{try{const o=JSON.parse(localStorage.getItem(P+k)||'null');if(!o||Date.now()-o.at>ttl)return null;return o.v}catch{return null}};
 const set=(k,v)=>{try{localStorage.setItem(P+k,JSON.stringify({at:Date.now(),v}))}catch{}};
 const del=k=>{try{localStorage.removeItem(P+k)}catch{}};
 const clearAll=()=>{try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.startsWith(P))localStorage.removeItem(k)}}catch{}};

 // 名前とアイコン：{ n: 名前, p: 写真の保存場所 } または { x: 1 }（見つからなかった人）
 const AK=P+'authors',ATTL=3*3600e3,AMAX=800;
 const aLoad=()=>{try{return JSON.parse(localStorage.getItem(AK)||'{}')||{}}catch{return {}}};
 const aSave=o=>{try{const ks=Object.keys(o);if(ks.length>AMAX)ks.sort((a,b)=>o[a].at-o[b].at).slice(0,ks.length-AMAX).forEach(k=>delete o[k]);localStorage.setItem(AK,JSON.stringify(o))}catch{}};
 const authors={
  // 覚えている人（hit）と、Supabase に聞く必要がある人（miss）に分ける
  read(ids){const o=aLoad(),now=Date.now(),hit=new Map(),miss=[];for(const id of new Set(ids)){if(!id)continue;const c=o[id];if(c&&now-c.at<ATTL&&(c.n||c.x))hit.set(id,c);else miss.push(id)}return {hit,miss}},
  write(rows){const o=aLoad(),now=Date.now();for(const [id,r] of rows)if(id)o[id]={...r,at:now};aSave(o)},
  forget(id){const o=aLoad();delete o[id];aSave(o)}
 };
 window.kmDC={get,set,del,clearAll,authors};
})();
