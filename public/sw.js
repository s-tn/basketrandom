// Self-destructing service worker — unregisters itself immediately
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => client.navigate(client.url));
  });
  self.registration.unregister();
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
});
