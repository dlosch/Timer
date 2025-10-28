const CACHE_NAME = 'timer-v3';
const urlsToCache = [
  './index.html',
  './manifest.json',
  './nosleep.min.js',
  './icon-192.png',
  './icon-512.png',
  './icon.png'
];

// Install Service Worker
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

// Fetch from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        
        // For navigation requests (including root path), try to return index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html')
            .then(indexResponse => {
              if (indexResponse) {
                return indexResponse;
              }
              return fetch(event.request);
            });
        }
        
        return fetch(event.request)
          .catch(() => {
            // If fetch fails and it's a navigation request, return index.html from cache
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
          });
      })
  );
});

// Activate and clean up old caches
self.addEventListener('activate', event => {
  // Take control immediately
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
