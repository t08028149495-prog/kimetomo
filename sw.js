/* 新しい sw.js は、開いている画面を閉じるのを待たずにすぐ使う */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

/* 📷 写真を端末にしまっておく（Supabase の通信量を減らす。2026-11-09）
   ・対象：プロフィール写真（kimetomo-profile-avatars）と投稿の画像（kimetomo-post-images）
     どちらも、新しく上げると別の名前（場所）になるので、同じ場所の中身は変わらない
   ・女性だけの部屋の写真（circle-private-media）は消せるので対象外
   ・リンクの「鍵」（?token=…）は6日ごとに変わるが、場所で覚えるので、鍵が変わっても読み直さない
   ・iPhone は同じ写真を何度も読み直すことがあったので、ここでしまったものを必ず使う
   ・30日たったら読み直す。しまうのは新しい順に400枚まで
   ・うまくいかないときは、今まで通りそのまま Supabase から読む（写真が出なくなることはない） */
const KM_IMG_CACHE = 'km-img-v1';
const KM_IMG_DAYS = 30;
const KM_IMG_MAX = 400;
const KM_IMG_RE = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/sign\/(kimetomo-profile-avatars|kimetomo-post-images)\//;

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || !KM_IMG_RE.test(req.url)) return;
  event.respondWith(kmImage(req));
});

async function kmImage(req) {
  const u = new URL(req.url);
  const key = u.origin + u.pathname; // 鍵（token）を外した「場所」で覚える
  try {
    const cache = await caches.open(KM_IMG_CACHE);
    const hit = await cache.match(key);
    if (hit && Date.now() - Number(hit.headers.get('x-km-at') || 0) < KM_IMG_DAYS * 864e5) return hit;
    // 中身が読める形（cors）で取りに行く（読めない形だと端末の容量を大きく使うため）
    const res = await fetch(req.url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) return res;
    const blob = await res.blob();
    const headers = new Headers({ 'Content-Type': res.headers.get('Content-Type') || 'image/jpeg', 'x-km-at': String(Date.now()) });
    await cache.put(key, new Response(blob, { headers }));
    kmTrim(cache);
    return new Response(blob, { headers });
  } catch (e) {
    return fetch(req);
  }
}

let kmTrimming = false;
async function kmTrim(cache) {
  if (kmTrimming) return;
  kmTrimming = true;
  try {
    const keys = await cache.keys(); // しまった順に並んでいる
    for (let i = 0; i < keys.length - KM_IMG_MAX; i++) await cache.delete(keys[i]);
  } catch (e) {}
  kmTrimming = false;
}

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'キメ友SNS', body: '新しい通知があります' };
  }

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'キメ友SNS',
      {
        body: data.body || '新しい通知があります',
        icon: './icon-192.png',
        badge: './icon-192.png',
        data: { url: data.url || './' }
      }
    )
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './', self.registration.scope).href;
  event.waitUntil((async () => {
    // すでに開いているキメ友があれば、それを前に出して移動する
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
        try {
          await client.focus();
          if ('navigate' in client) await client.navigate(target);
          return;
        } catch (e) {
          break;
        }
      }
    }
    return clients.openWindow(target);
  })());
});
