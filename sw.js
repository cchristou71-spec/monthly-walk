// HDSG Walks — offline app shell
//
// Bump CACHE_VERSION any time you deploy a meaningful update, so returning
// visitors pick up the new files instead of a stale cached copy.
const CACHE_VERSION = 'hdsg-walks-v1';

const PRECACHE_URLS = [
  './',
  './manifest.json',
  './favicon-32.png',
  './icon-192.png',
  './icon-180.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => {})))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never intercept Supabase API calls — the app itself handles offline
  // fallback for that data via localStorage, and we don't want a cached
  // "success" response masking real connectivity.
  if (url.hostname.includes('supabase.co')) return;

  // Page loads: try the network first (so you get the latest version when
  // you have signal), fall back to the cached shell when you don't.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((res) => res || caches.match('./')))
    );
    return;
  }

  // Everything else (CDN scripts, fonts, icons): serve from cache instantly
  // if we have it, and refresh the cache in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
