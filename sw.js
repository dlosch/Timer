// Bump CACHE_NAME to trigger re-install when sw logic or assets change
const CACHE_NAME = 'timer-v4';
const urlsToCache = [
  './index.html',
  './manifest.json',
  './nosleep.min.js',
  './icon-192.png',
  './icon-512.png',
  './icon.png',
  './docs/Argumente-Gemini25pro.md',
  './docs/OPD-Gemini25pro.md',
  './docs/Rhetorik-Checkliste-Gemini25pro.md',
  './docs/Rhetorik-Gemini25pro.md',
  './docs/index.json',
  './marked.js'
];

// Install Service Worker v20251110
self.addEventListener('install', event => {
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Cache addAll failed:', error);
      })
  );
});


// Fetch strategy:
// 1. App shell assets (same-origin & in precache list): cache-first
// 2. Navigation requests: network falling back to cached index.html
// 3. CDN assets (marked.js via CDN, highlight.js CSS/JS): stale-while-revalidate in runtime cache
// 4. Other requests: network with cache fallback if previously cached
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Handle only GET
  if (req.method !== 'GET') return;

  // Navigation requests: try network first (to get latest), fallback to cached index
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Same-origin precached assets: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req))
    );
    return;
  }

  // CDN assets: stale-while-revalidate
  if (/cdn.jsdelivr.net/i.test(url.host)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(req).then(cached => {
          const fetchPromise = fetch(req).then(networkResp => {
            if (networkResp && networkResp.status === 200) {
              cache.put(req, networkResp.clone());
            }
            return networkResp;
          }).catch(() => cached);
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // Default: network first, fallback to cache
  event.respondWith(
    fetch(req)
      .then(resp => {
        // Cache a clone for future offline use (only successful basic responses)
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, respClone));
        }
        return resp;
      })
      .catch(() => caches.match(req))
  );
});

// Activate and clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});
