// Minimal, deliberately conservative service worker.
//
// This exists only to satisfy install criteria and give a friendly screen
// when there's truly no connection — it must never risk serving a stale
// build to a signed-in user. So: no asset/data caching, no cache-first
// anything. The only thing cached is the static offline fallback page, and
// the only thing intercepted is full-page navigations, network-first with
// that fallback used purely as a last resort.
const CACHE_NAME = 'aetarix-crm-shell-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
