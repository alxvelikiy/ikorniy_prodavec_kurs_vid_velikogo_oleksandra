// Duo-слой: плеєр уроку (vprava.html?n=<nodeId>, а також ?mode=mistakes). Власник — builder-lesson.
// Дані вузла — data/duo-uNN.js (завантажує lesson.js), карта курсу — data/duo-course.js (CORE_JS).
// Розмітку плеєра (шапка, картка, нижня панель) будує lesson.js; тут — каркас, стан завантаження й запасний текст без JS.
import { COPY } from '../copy.mjs';

const X = COPY.pages.vprava;

export function render({ esc }) {
  return {
    title: X.title,
    description: X.description,
    body: `<div id="duo-lesson" class="duo-lesson dl" data-state="loading"><p class="duo-lesson__loading" role="status">${esc(X.loading)}</p></div>
<noscript><p class="duo-lesson__loading">${esc(X.noscript)}<a href="urok-01.html">${esc(X.noscriptLink)}</a>.</p></noscript>`,
    css: ['assets/duo/lesson.css'],
    js: ['assets/duo/exercises.js', 'assets/duo/lesson.js'],
    nav: false,
    bodyClass: 'duo-fullscreen',
  };
}
