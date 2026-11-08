
/* メンテナンス表示：maintenance.txt があれば、その文字だけを表示してデータベースには接続しない */
window.kmMaintenanceCheck=(async()=>{
 if(!/^https?:/.test(location.protocol))return false;
 try{
  const ctl=new AbortController();setTimeout(()=>ctl.abort(),2500);
  const r=await fetch('./maintenance.txt?t='+Date.now(),{cache:'no-store',signal:ctl.signal});
  if(!r.ok)return false;
  const msg=(await r.text()).trim();if(!msg||msg.startsWith('<'))return false;
  const show=()=>{
   const o=document.createElement('div');o.id='km-maint';
   o.style.cssText='position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px;background:#10101b;color:#f4f1ff;text-align:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif';
   const t=document.createElement('p');t.style.cssText='margin:0;font-size:20px;font-weight:800;line-height:1.7;white-space:pre-wrap';t.textContent=msg;
   const b=document.createElement('button');b.type='button';b.textContent='もう一度読み込む';b.style.cssText='padding:12px 20px;border:0;border-radius:12px;background:#9d83ed;color:#171124;font-size:15px;font-weight:700';b.onclick=()=>location.reload();
   o.append(t,b);document.body.append(o);
  };
  if(document.body)show();else document.addEventListener('DOMContentLoaded',show,{once:true});
  // 1分ごとに確認し、メンテナンスが終わったら自動で開き直す
  setInterval(async()=>{try{const r2=await fetch('./maintenance.txt?t='+Date.now(),{cache:'no-store'});const m2=r2.ok?(await r2.text()).trim():'';if(!m2||m2.startsWith('<'))location.reload()}catch{}},60000);
  return true;
 }catch{return false}
})();
