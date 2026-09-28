// Duo-слой: плеєр уроку (vprava.html?n=<nodeId>, а також ?mode=mistakes|sos). Власник — builder-lesson. ЗАГЛУШКА Lead.
// Дані вузла — data/duo-uNN.js (завантажує lesson.js), карта курсу — data/duo-course.js.
export function render() {
  return {
    title: 'Урок',
    description: 'Урок-вправа курсу новачка Ikorka Shop.',
    body: `<div id="duo-lesson" class="duo-lesson" data-state="loading"><p class="duo-lesson__loading">Завантажую урок…</p></div>
<noscript><p>Уроки-вправи працюють з увімкненим JavaScript. Теорія уроків — на сторінках <a href="urok-01.html">уроків</a>.</p></noscript>`,
    css: ['assets/duo/lesson.css'],
    js: ['assets/duo/exercises.js', 'assets/duo/lesson.js'],
    nav: false,
    bodyClass: 'duo-fullscreen',
  };
}
