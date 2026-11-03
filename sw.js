const CACHE = 'ufficio-tecnico-v6';
const FILES = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/review.js', 'js/exam.js', 'js/storage.js', 'js/content.js', 'js/icons.js', 'js/sync.js',
  'content/config.json', 'content/procedimento.json', 'content/territorio.json', 'content/beni.json', 'content/opere.json', 'content/orale.json',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request)
    .then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(event.request, copy));
      }
      return res;
    })
    .catch(async () => (await caches.match(event.request, { ignoreSearch: true }))
      ?? (event.request.mode === 'navigate' ? caches.match('index.html') : Response.error())));
});
