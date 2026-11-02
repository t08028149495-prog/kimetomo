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
