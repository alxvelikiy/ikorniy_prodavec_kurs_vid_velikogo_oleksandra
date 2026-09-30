// Duo-слой: «Практика», «Завдання», «Профіль» (praktyka.html, zavdannia.html, profil.html).
// Власник — builder-celebrate. Розмітка статична (працює без JS: посилання, заголовки, підписи);
// лічильники, полоски, календар і досягнення малює assets/duo/meta.js, стилі — assets/duo/meta.css.
// Кожна функція → { title, description, body, css, js, nav }. ctx: { course, esc, mascotSvg(emotion, opts) | null }
const common = { css: ['assets/duo/home.css', 'assets/duo/meta.css'], js: ['assets/duo/meta.js'], nav: true };

const ico = (d, extra = '') => `<svg class="d-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${extra}>${d}</svg>`;
const I = {
  book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13z"/>',
  phone: '<path d="M6.6 3.5h3.2l1.6 4-2 1.7a12.5 12.5 0 0 0 5.4 5.4l1.7-2 4 1.6v3.2a1.6 1.6 0 0 1-1.7 1.6A16.5 16.5 0 0 1 5 5.2a1.6 1.6 0 0 1 1.6-1.7z"/>',
  headset: '<path d="M4 13a8 8 0 0 1 16 0"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19v1a2 2 0 0 1-2 2h-3"/>',
  list: '<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>',
  chest: '<path d="M4 11h16v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7z"/><path d="M3 8a5 5 0 0 1 9-3 5 5 0 0 1 9 3v3H3V8z"/><rect x="10" y="11" width="4" height="4" rx="1"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2"/>',
};
const mascot = (ctx, emotion) => (ctx && ctx.mascotSvg ? `<div class="mt-mascot" aria-hidden="true">${ctx.mascotSvg(emotion, { size: 72, title: false })}</div>` : '');

const tool = (href, icon, title, text) => `<li><a class="mt-link" href="${href}">
<span class="mt-link__ico" aria-hidden="true">${ico(I[icon])}</span>
<span class="mt-link__txt"><b>${title}</b><span>${text}</span></span>
<span class="mt-link__go" aria-hidden="true">${ico('<path d="M9 5l7 7-7 7"/>')}</span>
</a></li>`;

export function praktyka(ctx) {
  return { ...common, title: 'Практика', description: 'Повторення помилок, SOS-тренування і тренажери курсу.', body: `<div id="duo-practice" class="duo-meta">
<h1 class="mt-h1">Практика</h1>
<p class="mt-lead">Повторюй пройдене й тренуйся без тиску.</p>

<section class="d-card mt-card mt-hero" aria-labelledby="pr-mis-h">
${mascot(ctx, 'thinking')}
<div class="mt-hero__body">
<h2 class="mt-h2" id="pr-mis-h">Повторити помилки</h2>
<p class="mt-text" id="pr-mis-text">Тут збираються завдання, у яких ти помилився. Повторення закріплює їх.</p>
<div class="mt-actions" id="pr-mis-act"><a class="d-btn d-btn--primary d-btn--md" id="pr-mis-btn" href="vprava.html?mode=mistakes"><span class="d-btn__label">Повторити помилки</span></a></div>
</div>
</section>

<section class="d-card mt-card mt-hero" aria-labelledby="pr-sos-h">
<div class="mt-hero__body">
<h2 class="mt-h2" id="pr-sos-h">SOS-тренування</h2>
<p class="mt-text">Швидкий повтор ключових правил перед складною розмовою. Кілька карток і пара питань.</p>
<div class="mt-actions"><a class="d-btn d-btn--secondary d-btn--md" href="vprava.html?mode=sos"><span class="d-btn__label">Почати SOS-тренування</span></a></div>
</div>
</section>

<section aria-labelledby="pr-more-h">
<h2 class="mt-h2" id="pr-more-h">Ще для практики</h2>
<ul class="mt-links">
${tool('povtorennia.html', 'refresh', 'Повторення', 'Картки з інтервалами: повертаються тоді, коли їх час повторити.')}
${tool('trenazher.html', 'phone', 'Тренажер дзвінка', 'Симулятор розмови з клієнтом крок за кроком.')}
${tool('trener.html', 'headset', 'ІІ-тренер', 'Розмова з ІІ-клієнтом: відпрацьовуй заперечення наживо.')}
${tool('sos.html', 'list', 'SOS: скажи так', 'Готові фрази для складних ситуацій, які можна прочитати за хвилину.')}
</ul>
</section>
<noscript><p class="mt-text">Кількість помилок для повторення з'являється, коли в браузері ввімкнений JavaScript.</p></noscript>
</div>` };
}

export function zavdannia(ctx) {
  return { ...common, title: 'Завдання', description: 'Щоденні завдання і скриня з XP.', body: `<div id="duo-quests" class="duo-meta">
<h1 class="mt-h1">Завдання</h1>
<p class="mt-lead">Нові завдання з'являються щодня. Виконай усі три й відкрий скриню.</p>

<section class="d-card mt-card" aria-labelledby="qz-goal-h">
<h2 class="mt-h2" id="qz-goal-h">Ціль дня</h2>
<div id="qz-goal"><p class="mt-text">Завантажуємо…</p></div>
</section>

<section aria-labelledby="qz-list-h">
<h2 class="mt-h2" id="qz-list-h">Завдання на сьогодні</h2>
<ul class="mt-quests" id="qz-list"></ul>
</section>

<section class="d-card mt-card mt-chest" aria-labelledby="qz-chest-h">
${mascot(ctx, 'happy')}
<div class="mt-hero__body">
<h2 class="mt-h2" id="qz-chest-h">Скриня завдань</h2>
<div id="qz-chest"></div>
</div>
</section>
<div class="sr-only" id="qz-live" role="status" aria-live="polite"></div>
<noscript><p class="mt-text">Завдання працюють, коли в браузері ввімкнений JavaScript.</p></noscript>
</div>` };
}

export function profil() {
  return { ...common, title: 'Профіль', description: 'Статистика, досягнення, календар і налаштування.', body: `<div id="duo-profile" class="duo-meta">
<h1 class="mt-h1">Профіль</h1>

<section aria-labelledby="pf-stat-h">
<h2 class="mt-h2" id="pf-stat-h">Статистика</h2>
<ul class="mt-kpis" id="pf-stats"></ul>
</section>

<section class="d-card mt-card" aria-labelledby="pf-cal-h">
<h2 class="mt-h2" id="pf-cal-h">Календар серії</h2>
<div id="pf-cal"></div>
</section>

<section aria-labelledby="pf-ach-h">
<h2 class="mt-h2" id="pf-ach-h">Досягнення</h2>
<ul class="mt-achs" id="pf-achs"></ul>
</section>

<section class="d-card mt-card" aria-labelledby="pf-set-h">
<h2 class="mt-h2" id="pf-set-h">Налаштування</h2>
<div class="mt-field">
<label class="mt-label" for="pf-goal">Ціль дня</label>
<select class="mt-select" id="pf-goal" aria-describedby="pf-goal-hint">
<option value="10">10 XP на день, легко</option>
<option value="20" selected>20 XP на день, звично</option>
<option value="30">30 XP на день, серйозно</option>
<option value="50">50 XP на день, інтенсив</option>
</select>
<p class="mt-hint" id="pf-goal-hint">Скільки XP на день зараховується до цілі.</p>
</div>
<div class="mt-field" id="pf-signals"></div>
<div class="mt-field">
<span class="mt-label" id="pf-theme-l">Тема</span>
<div class="d-segmented" role="group" aria-labelledby="pf-theme-l" id="pf-theme">
<button type="button" class="d-segmented__item" data-theme-set="light" aria-pressed="true">Світла</button>
<button type="button" class="d-segmented__item" data-theme-set="dark" aria-pressed="false">Темна</button>
</div>
</div>
</section>
<noscript><p class="mt-text">Статистика й налаштування працюють, коли в браузері ввімкнений JavaScript.</p></noscript>
</div>` };
}
