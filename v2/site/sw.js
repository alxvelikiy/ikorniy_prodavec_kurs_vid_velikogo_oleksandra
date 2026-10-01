// Згенеровано v2/build/build.mjs — офлайн-кеш сайту (уроки, SOS «Я на дзвінку», тренажер).
const CACHE = "ikorka-d5a639314362";
const FILES = ["vstup.html","den-01.html","urok-01.html","urok-02.html","urok-03.html","den-02.html","urok-04.html","urok-05.html","den-03.html","urok-06.html","urok-07.html","urok-08.html","den-04.html","urok-09.html","urok-10.html","urok-11.html","den-05.html","urok-12.html","video.html","sos.html","dzvinky.html","povtorennia.html","trenazher.html","trener.html","perevirka.html","kerivnyku.html","index.html","vprava.html","praktyka.html","zavdannia.html","profil.html","shpargalka.html","sogodni.html","assets/app.js","assets/audio.js","assets/coach.js","assets/components.css","assets/course.js","assets/duo/celebrate.js","assets/duo/copy.js","assets/duo/core.css","assets/duo/core.js","assets/duo/exercises.js","assets/duo/fonts/nunito-cyrillic.woff2","assets/duo/fonts/nunito-latin.woff2","assets/duo/home.css","assets/duo/lesson.css","assets/duo/lesson.js","assets/duo/mascot.css","assets/duo/mascot.js","assets/duo/meta.css","assets/duo/meta.js","assets/duo/motion.js","assets/duo/path.js","assets/duo/progress-core.js","assets/duo/progress.js","assets/duo/sfx.js","assets/duo/shell.js","assets/duo/signals.js","assets/duo/tokens.css","assets/ikorka-logo.png","assets/search-index.js","assets/style.css","assets/theme.css","assets/tokens.css","assets/trainer-data.js","assets/trainer.css","assets/trainer.js","assets/ui.js","data/duo-course.js","data/duo-u01.js","data/duo-u02.js","data/duo-u03.js","data/duo-u04.js","data/duo-u05.js","data/duo-u06.js","data/duo-u07.js","data/duo-u08.js","data/duo-u09.js","data/duo-u10.js","data/duo-u11.js","data/duo-u12.js"];
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
