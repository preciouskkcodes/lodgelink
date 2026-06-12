const CACHE_NAME = 'lodgelink-v4';   // bump version
const ASSETS = [
  '/index.html',
  '/host.html',
  '/admin.html',
  '/success.html',
  '/app.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Always go network-first for Supabase
  if (url.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first for HTML and JS (so updates always reflect)
  if (url.endsWith('.html') || url.endsWith('.js') || url.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))  // fallback to cache if offline
    );
    return;
  }

  // Cache-first for everything else (images, fonts, etc.)
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});