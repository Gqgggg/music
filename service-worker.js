const CACHE_NAME = 'music-player-cache-v1'; // Update version for new deployments
const urlsToCache = [
  '/', // Caches the index.html
  '/index.html',
  // Since your CSS and JS are embedded, you primarily need to cache index.html.
  // If you later externalize your CSS or JS, add their paths here.
  // Example:
  // '/styles/main.css',
  // '/scripts/main.js',
  // Any other static assets like images for default cover art if it's an external file
];

// Install event: This is where you pre-cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache on install', error);
      })
  );
});

// Fetch event: Intercepts network requests
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request) // Try to find the request in the cache
      .then((response) => {
        // If resource is in cache, return it
        if (response) {
          return response;
        }
        // If not in cache, fetch from network
        return fetch(event.request)
          .then((networkResponse) => {
            // Check if we received a valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // IMPORTANT: Clone the response. A response is a stream and can only be consumed once.
            // We must clone it so that we can consume the stream twice:
            // one for the browser and one for the cache.
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache); // Cache the new resource
              });

            return networkResponse;
          })
          .catch(() => {
            // This catch block is for network errors (e.g., offline)
            // You could return a custom offline page here if you had one:
            // return caches.match('/offline.html');
            // For audio/streaming, a network failure will prevent playback.
            // Consider how you want to handle this gracefully (e.g., UI message).
          });
      })
  );
});

// Activate event: Clean up old caches to save space and prevent serving stale content
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});