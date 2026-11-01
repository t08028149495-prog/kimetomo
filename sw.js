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
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || './')
  );
});
