// Згенеровано v2/build/build.mjs — офлайн-кеш сайту (уроки, SOS «Я на дзвінку», тренажер).
const CACHE = "ikorka-3f5715bbaa43";
const FILES = ["vstup.html","den-01.html","urok-01.html","urok-02.html","urok-03.html","den-02.html","urok-04.html","urok-05.html","den-03.html","urok-06.html","urok-07.html","urok-08.html","den-04.html","urok-09.html","urok-10.html","urok-11.html","den-05.html","urok-12.html","video.html","sos.html","dzvinky.html","povtorennia.html","trenazher.html","trener.html","perevirka.html","kerivnyku.html","index.html","assets/app.js","assets/audio.js","assets/coach.js","assets/components.css","assets/course.js","assets/ikorka-logo.png","assets/search-index.js","assets/style.css","assets/theme.css","assets/tokens.css","assets/trainer-data.js","assets/trainer.css","assets/trainer.js","assets/ui.js"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('ikorka-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
function put(req, res) { if (res && res.ok && res.type === 'basic') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return res; }
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin || u.pathname.startsWith('/api/')) return;
  if (r.mode === 'navigate') {
    // сторінки: спершу мережа (свіжа версія), без мережі — з кешу
    e.respondWith(fetch(r).then(res => put(r, res)).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(m => m || fetch(r).then(res => put(r, res))));
});
