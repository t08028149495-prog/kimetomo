
/* エラーの自動報告（Sentry）とアクセス解析（Cloudflare Web Analytics）。キーが空なら何もしない */
(function(){
 if(!/^https:/.test(location.protocol))return;
 const KM_SENTRY_DSN='https://d11ef51ac18bb9e2fbc81ff1864987f6@o4512366327627776.ingest.us.sentry.io/4512366354169856';
 const KM_CF_ANALYTICS_TOKEN='4428e2544147443e9db9f812db78a2a4';
 if(KM_SENTRY_DSN){
  const key=(KM_SENTRY_DSN.match(/^https:\/\/([0-9a-f]+)@/)||[])[1];
  if(key){
   window.sentryOnLoad=function(){Sentry.init({dsn:KM_SENTRY_DSN,sendDefaultPii:false,tracesSampleRate:0,environment:'production',
     // 個人の文章が送られないよう、エラー以外の情報は送らない
     beforeBreadcrumb:b=>(b.category==='ui.input'||b.category==='console')?null:b})};
   const sc=document.createElement('script');sc.src='https://js.sentry-cdn.com/'+key+'.min.js';sc.crossOrigin='anonymous';document.head.append(sc);
  }
 }
 if(KM_CF_ANALYTICS_TOKEN){
  const sc=document.createElement('script');sc.defer=true;sc.src='https://static.cloudflareinsights.com/beacon.min.js';sc.setAttribute('data-cf-beacon',JSON.stringify({token:KM_CF_ANALYTICS_TOKEN}));document.head.append(sc);
 }
})();
