// Offline support: serve the saved copy immediately, then refresh it from the network.
const CACHE = 'tarsi-cse-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'questions.js', 'manifest.webmanifest', 'assets/icon.svg', 'assets/nunito.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const key = e.request.mode === 'navigate' ? './' : e.request;
    const saved = await cache.match(key);
    const fresh = fetch(e.request).then(res => {
      if (res.ok) cache.put(key, res.clone());
      return res;
    });
    if (saved) { fresh.catch(() => {}); return saved; }
    return fresh;
  }));
});
