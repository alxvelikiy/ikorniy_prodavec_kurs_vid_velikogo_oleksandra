// Duo-слой: навігація застосунку. Власник — builder-home.
// Статична розмітка (працює без JS); лічильники верхньої панелі оживляє assets/duo/shell.js, стилі — assets/duo/home.css.
// Мобільний: компактна шапка (логотип · серія · серця · XP дня) + нижній таб-бар;
// від 768px: лівий сайдбар, шапка лишається у колонці контенту (max-width як у плеєра). Тексти — copy.js.
import { COPY } from './copy.mjs';

const N = COPY.nav, TB = COPY.topbar;
export const TABS = [
  { slug: 'index', href: 'index.html', label: N.tabs.index, icon: 'path' },
  { slug: 'praktyka', href: 'praktyka.html', label: N.tabs.praktyka, icon: 'dumbbell' },
  { slug: 'zavdannia', href: 'zavdannia.html', label: N.tabs.zavdannia, icon: 'target' },
  { slug: 'profil', href: 'profil.html', label: N.tabs.profil, icon: 'user' },
];

// Контури іконок — ті самі, що в Duo.icon (core.js): один набір, лінія 2px.
const ICONS = {
  path: '<path d="M4 19c4-7 12 3 16-4"/><circle cx="4" cy="19" r="1.6" fill="currentColor" stroke="none"/><circle cx="20" cy="15" r="1.6" fill="currentColor" stroke="none"/>',
  dumbbell: '<line x1="7" y1="7" x2="7" y2="17"/><line x1="17" y1="7" x2="17" y2="17"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="4" y1="9" x2="4" y2="15"/><line x1="20" y1="9" x2="20" y2="15"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/>',
  flame: '<path d="M12 21a6.5 6.5 0 0 1-6.5-6.5c0-3 2-5 2.8-7.6.6 1.7 1.8 2.6 1.8 2.6-.7-3 .8-5.5 2.9-7.5-.2 3 .9 4.3 2.7 6.3 1.7 1.9 2.8 3.8 2.8 6.2A6.5 6.5 0 0 1 12 21z"/>',
  heart: '<path d="M12 20.5c-4.4-2.9-8-6.4-8-10.2A4.3 4.3 0 0 1 8.3 6c1.6 0 3 .8 3.7 2 .7-1.2 2.1-2 3.7-2A4.3 4.3 0 0 1 20 10.3c0 3.8-3.6 7.3-8 10.2z"/>',
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>',
};
const svg = name => `<svg class="d-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;

export function navHtml(active) {
  const tabs = TABS.map(t => {
    const on = t.slug === active;
    return `<a class="duo-tab${on ? ' is-active' : ''}" href="${t.href}"${on ? ' aria-current="page"' : ''}>${svg(t.icon)}<span class="duo-tab__label">${t.label}</span></a>`;
  }).join('');
  return `<header class="duo-top">
<div class="duo-top__in">
<a class="duo-top__brand" href="index.html"><img src="assets/ikorka-logo.png" width="28" height="28" alt=""><span class="duo-top__name">Ikorka</span><span class="sr-only">${N.homeSr}</span></a>
<ul class="duo-stats" id="duo-stats" aria-label="${N.stats}">
<li class="duo-stat duo-stat--streak" data-stat="streak">${svg('flame')}<span class="duo-stat__v" aria-hidden="true"><b>0</b> ${TB.daysShort}</span><span class="sr-only">${TB.streakSr(0, false)}</span></li>
<li class="duo-stat duo-stat--hearts" data-stat="hearts">${svg('heart')}<span class="duo-stat__v" aria-hidden="true"><b>5</b></span><span class="sr-only">${TB.heartsSr(5, 5)}</span></li>
<li class="duo-stat duo-stat--xp" data-stat="xp">${svg('bolt')}<span class="duo-stat__v" aria-hidden="true"><b>0</b>${TB.ofXp(20)}</span><span class="duo-stat__bar" aria-hidden="true"><i></i></span><span class="sr-only">${TB.xpSr(0, 20)}</span></li>
</ul>
</div>
</header>
<nav class="duo-nav" aria-label="${N.sections}">
<div class="duo-nav__in">${tabs}</div>
</nav>`;
}
