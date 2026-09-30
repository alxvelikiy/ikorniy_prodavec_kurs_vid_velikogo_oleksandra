// Duo-слой: плеєр уроку (vprava.html?n=<nodeId>, а також ?mode=mistakes). Власник — builder-lesson.
// Дані вузла — data/duo-uNN.js (завантажує lesson.js), карта курсу — data/duo-course.js (CORE_JS).
// Розмітку плеєра (шапка, картка, нижня панель) будує lesson.js; тут — каркас, стан завантаження й запасний текст без JS.
export function render() {
  return {
    title: 'Урок',
    description: 'Урок-вправа курсу новачка Ikorka Shop.',
    body: `<div id="duo-lesson" class="duo-lesson dl" data-state="loading"><p class="duo-lesson__loading" role="status">Завантажую урок…</p></div>
<noscript><p class="duo-lesson__loading">Уроки-вправи працюють з увімкненим JavaScript. Теорія уроків — на сторінках <a href="urok-01.html">уроків</a>.</p></noscript>`,
    css: ['assets/duo/lesson.css'],
    js: ['assets/duo/exercises.js', 'assets/duo/lesson.js'],
    nav: false,
    bodyClass: 'duo-fullscreen',
  };
}
