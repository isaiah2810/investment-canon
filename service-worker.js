// Portfolio Dashboard Service Worker
// Implements stale-while-revalidate caching strategy for offline support

const CACHE_NAME = 'portfolio-cache-v1';
const RUNTIME_CACHE = 'portfolio-runtime-v1';

// Assets to cache on install (static files)
// Use relative paths for GitHub Pages compatibility
const BASE_PATH = self.location.pathname.replace(/\/[^/]*$/, '');
const STATIC_ASSETS = [
  `${BASE_PATH}/portfolio.html`,
  `${BASE_PATH}/manifest.json`,
  'https://cdn.jsdelivr.net/npm/chart.js@3.7.0/dist/chart.min.js'
];

// Install event: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event: stale-while-revalidate strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip cross-origin requests to price server (always fetch fresh)
  if (request.url.includes('trycloudflare.com') || request.url.includes(':8777')) {
    return;
  }

  event.respondWith(
    caches.open(RUNTIME_CACHE).then(async (cache) => {
      const cachedResponse = await cache.match(request);

      // Start fetching fresh data in background
      const fetchPromise = fetch(request).then((response) => {
        // Cache the response if valid
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(() => {
        // Network failed - return cached response if available
        return cachedResponse;
      });

      // Return cached response immediately if available, otherwise wait for fetch
      return cachedResponse || fetchPromise;
    })
  );
});

// Message event: allow clients to skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
