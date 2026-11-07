// Cache hors-ligne simple : l'app marche sans réseau une fois ouverte.
const CACHE = 'rame-jeux-v6';
const FILES = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icon.svg',
  'js/cloud.js', 'js/rower.js', 'js/sources.js', 'js/kit.js', 'js/main.js',
  'js/games/course.js', 'js/games/libre.js', 'js/games/seance.js', 'js/games/bouees.js', 'js/games/kraken.js', 'js/games/cadence.js', 'js/world3d.js', 'js/vendor/three/three.module.min.js', 'js/vendor/three/Water.js', 'js/vendor/three/Sky.js'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || e.request.url.includes('supabase.co')) return;
  e.respondWith(fetch(e.request).then(r => {
    const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r;
  }).catch(() => caches.match(e.request)));
});
