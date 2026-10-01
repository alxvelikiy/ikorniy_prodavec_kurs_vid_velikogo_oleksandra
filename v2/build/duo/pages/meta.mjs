// Duo-слой: «Практика», «Завдання», «Профіль» (praktyka.html, zavdannia.html, profil.html).
// Власник — builder-celebrate. Розмітка статична (працює без JS: посилання, заголовки, підписи);
// лічильники, полоски, календар і досягнення малює assets/duo/meta.js, стилі — assets/duo/meta.css.
// Кожна функція → { title, description, body, css, js, nav }. ctx: { course, esc, mascotSvg(emotion, opts) | null }
import { COPY } from '../copy.mjs';

const PG = COPY.pages;
const e = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
<span class="mt-link__txt"><b>${e(title)}</b><span>${e(text)}</span></span>
<span class="mt-link__go" aria-hidden="true">${ico('<path d="M9 5l7 7-7 7"/>')}</span>
</a></li>`;

export function praktyka(ctx) {
  const X = PG.praktyka;
  return { ...common, title: X.title, description: X.description, body: `<div id="duo-practice" class="duo-meta">
<h1 class="mt-h1">${e(X.title)}</h1>
<p class="mt-lead">${e(X.lead)}</p>

<section class="d-card mt-card mt-hero" aria-labelledby="pr-mis-h">
${mascot(ctx, 'thinking')}
<div class="mt-hero__body">
<h2 class="mt-h2" id="pr-mis-h">${e(X.misTitle)}</h2>
<p class="mt-text" id="pr-mis-text">${e(X.misText)}</p>
<div class="mt-actions" id="pr-mis-act"><a class="d-btn d-btn--primary d-btn--md" id="pr-mis-btn" href="vprava.html?mode=mistakes"><span class="d-btn__label">${e(COPY.meta.repeatMistakes)}</span></a></div>
</div>
</section>

<section class="d-card mt-card mt-hero" aria-labelledby="pr-sos-h">
<div class="mt-hero__body">
<h2 class="mt-h2" id="pr-sos-h">${e(X.sosTitle)}</h2>
<p class="mt-text">${e(X.sosText)}</p>
<div class="mt-actions"><a class="d-btn d-btn--secondary d-btn--md" href="vprava.html?mode=sos"><span class="d-btn__label">${e(X.sosStart)}</span></a></div>
</div>
</section>

<section aria-labelledby="pr-more-h">
<h2 class="mt-h2" id="pr-more-h">${e(X.more)}</h2>
<ul class="mt-links">
${X.tools.map(t => tool(t.href, t.icon, t.title, t.text)).join('\n')}
</ul>
</section>
<noscript><p class="mt-text">${e(X.noscript)}</p></noscript>
</div>` };
}

export function zavdannia(ctx) {
  const X = PG.zavdannia;
  return { ...common, title: X.title, description: X.description, body: `<div id="duo-quests" class="duo-meta">
<h1 class="mt-h1">${e(X.title)}</h1>
<p class="mt-lead">${e(X.lead)}</p>

<section class="d-card mt-card" aria-labelledby="qz-goal-h">
<h2 class="mt-h2" id="qz-goal-h">${e(X.goal)}</h2>
<div id="qz-goal"><p class="mt-text">${e(X.loading)}</p></div>
</section>

<section aria-labelledby="qz-list-h">
<h2 class="mt-h2" id="qz-list-h">${e(X.list)}</h2>
<ul class="mt-quests" id="qz-list"></ul>
</section>

<section class="d-card mt-card mt-chest" aria-labelledby="qz-chest-h">
${mascot(ctx, 'happy')}
<div class="mt-hero__body">
<h2 class="mt-h2" id="qz-chest-h">${e(X.chest)}</h2>
<div id="qz-chest"></div>
</div>
</section>
<div class="sr-only" id="qz-live" role="status" aria-live="polite"></div>
<noscript><p class="mt-text">${e(X.noscript + ' ' + PG.noJs)}</p></noscript>
</div>` };
}

export function profil() {
  const X = PG.profil;
  return { ...common, title: X.title, description: X.description, body: `<div id="duo-profile" class="duo-meta">
<h1 class="mt-h1">${e(X.title)}</h1>

<section aria-labelledby="pf-stat-h">
<h2 class="mt-h2" id="pf-stat-h">${e(X.stats)}</h2>
<ul class="mt-kpis" id="pf-stats"></ul>
</section>

<section class="d-card mt-card" aria-labelledby="pf-cal-h">
<h2 class="mt-h2" id="pf-cal-h">${e(X.cal)}</h2>
<div id="pf-cal"></div>
</section>

<section aria-labelledby="pf-ach-h">
<h2 class="mt-h2" id="pf-ach-h">${e(X.achs)}</h2>
<ul class="mt-achs" id="pf-achs"></ul>
</section>

<section class="d-card mt-card" aria-labelledby="pf-set-h">
<h2 class="mt-h2" id="pf-set-h">${e(X.settings)}</h2>
<div class="mt-field">
<label class="mt-label" for="pf-goal">${e(X.goal)}</label>
<select class="mt-select" id="pf-goal" aria-describedby="pf-goal-hint">
${PG.goals.map(g => `<option value="${g.xp}"${g.xp === 20 ? ' selected' : ''}>${e(X.goalOption(g.xp, g.name))}</option>`).join('\n')}
</select>
<p class="mt-hint" id="pf-goal-hint">${e(X.goalHint)}</p>
</div>
<div class="mt-field" id="pf-signals"></div>
<div class="mt-field">
<span class="mt-label" id="pf-theme-l">${e(X.theme)}</span>
<div class="d-segmented" role="group" aria-labelledby="pf-theme-l" id="pf-theme">
<button type="button" class="d-segmented__item" data-theme-set="light" aria-pressed="true">${e(X.light)}</button>
<button type="button" class="d-segmented__item" data-theme-set="dark" aria-pressed="false">${e(X.dark)}</button>
</div>
</div>
</section>
<noscript><p class="mt-text">${e(X.noscript + ' ' + PG.noJs)}</p></noscript>
</div>` };
}
