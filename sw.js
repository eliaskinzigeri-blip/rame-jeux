// Cache hors-ligne simple : l'app marche sans réseau une fois ouverte.
const CACHE = 'rame-jeux-v2';
const FILES = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icon.svg',
  'js/vendor/supabase.js', 'js/cloud.js', 'js/rower.js', 'js/sources.js', 'js/kit.js', 'js/main.js',
  'js/games/regate.js', 'js/games/envol.js', 'js/games/cadence.js', 'js/games/corde.js', 'js/games/kraken.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || e.request.url.includes('supabase.co')) return;
  e.respondWith(fetch(e.request).then(r => {
    const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r;
  }).catch(() => caches.match(e.request)));
});
