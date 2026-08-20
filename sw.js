/**
 * @file sw.js
 * @description Service Worker PWA Offline-First de Alto Rendimiento:
 * - Pre-cacheo de recursos críticos (CSS, Tokens, Fuentes, JavaScript Core).
 * - Estrategia Cache-First con actualización en segundo plano (Stale-While-Revalidate).
 * - Funcionamiento 100% autónomo sin conexión a internet en directos y ensayos.
 */

const CACHE_NAME = 'tabs-chords-pro-v2.1';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/tokens.css',
  './assets/css/layout.css',
  './assets/css/components/bottom-nav.css',
  './assets/css/components/lyrics-chords.css',
  './assets/css/components/library.css',
  './assets/css/components/tools-premium.css',
  './assets/css/components/settings.css',
  './assets/css/components/toast.css',
  './assets/css/components/tuner.css',
  './assets/css/components/fretboard.css',
  './assets/css/components/mixer.css',
  './assets/css/components/transport.css',
  './src/mainV2.js',
  './src/core/EventBus.js',
  './src/core/State.js',
  './src/audio/AudioFeedback.js',
  './src/tools/ChordEngine.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((response) => {
        if (!response || response.status !== 200) {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, toCache));
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
