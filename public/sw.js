const CACHE_NAME = 'rct-erp-v1';
const OFFLINE_URL = '/index.html';

const FILES_TO_CACHE = [
  '/',
  '/manifest.json',
  '/icons/rct.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192-maskable.png',
  '/icons/icon-512-maskable.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE)).catch(err => console.error('SW install failed', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(key => {
      if (key !== CACHE_NAME) return caches.delete(key);
      return Promise.resolve();
    }))));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const respClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
        return networkResponse;
      }).catch(() => caches.match(OFFLINE_URL));
    })
  );
});
