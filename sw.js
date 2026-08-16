/**
 * @file sw.js
 * @description Service Worker de auto-purga y desactivación inmediata de caché.
 * Elimina todos los cachés antiguos de CacheStorage, se desregistra a sí mismo
 * y fuerza a todos los clientes a recargar desde la red directamente.
 */

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      console.log('[Service Worker Auto-Purge] Eliminando todas las cachés:', keys);
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => {
      console.log('[Service Worker Auto-Purge] Desregistrando Service Worker...');
      return self.registration.unregister();
    }).then(() => {
      return self.clients.matchAll();
    }).then((clients) => {
      for (const client of clients) {
        client.navigate(client.url);
      }
    })
  );
});

// Peticiones directas a la red sin usar caché bajo ninguna circunstancia
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request));
});
