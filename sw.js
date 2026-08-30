/**
 * @file sw.js
 * @description Service Worker para funcionamiento 100% Offline y PWA Installable.
 */

const CACHE_NAME = 'tabs-chords-pro-v1';
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  './src/mainV2.js',
  './assets/css/components/bottom-nav.css',
  './assets/css/components/lyrics-chords.css',
  './assets/css/components/tools-premium.css',
  './assets/css/components/smart-band.css',
  './assets/css/components/arcade-mode.css',
  './assets/css/components/band-room.css',
  './assets/css/components/stage-automation.css',
  './assets/css/components/spatial-xr.css'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[ServiceWorker] Caché parcial instalada:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(e.request).then((networkResponse) => {
        return networkResponse;
      }).catch(() => {
        return caches.match('./index.html');
      });
    })
  );
});
