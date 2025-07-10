const CACHE_NAME = 'music-player-cache-v2'; // Increment version to trigger update!
const urlsToCache = [
  '/', // Caches the root path, typically your index.html
  '/index.html',
  '/manifest.json', // Add your manifest file
  // Add all your icon paths as specified in manifest.json
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  // If you move your CSS or JS into separate files, add them here:
  // '/css/style.css',
  // '/js/main.js',
  // Any other static assets like images for default cover art if it's an external file
  // '/img/default-cover.png',
];

// Install event: This is where you pre-cache essential assets when the service worker is first installed.
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

// Fetch event: This intercepts network requests made by the page.
// It tries to serve content from the cache first, then falls back to the network.
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request) // Try to find the request in the current cache.
      .then((response) => {
        // If the resource is in the cache, return it.
        if (response) {
          return response;
        }

        // If not in cache, fetch from the network.
        return fetch(event.request)
          .then((networkResponse) => {
            // Check if we received a valid response.
            // This is important to avoid caching bad responses (e.g., 404s, network errors).
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // IMPORTANT: Clone the response. A response is a stream and can only be consumed once.
            // We must clone it so that we can consume the stream twice:
            // one for the browser (to display the content) and one for the cache.
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache); // Add the newly fetched resource to the cache.
              });

            return networkResponse; // Return the network response to the browser.
          })
          .catch(() => {
            // This catch block handles network errors (e.g., when the user is completely offline).
            // You can implement an offline fallback here, like returning a custom offline page.
            // For example: return caches.match('/offline.html');
            console.log('Service Worker: Fetch failed, request not in cache and network unavailable:', event.request.url);
          });
      })
  );
});

// Activate event: This is triggered when the service worker becomes active.
// It's commonly used to clean up old caches, ensuring users don't get stale content.
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME]; // Only keep caches with names in this whitelist.

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // If a cache name is not in the whitelist, delete it.
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});