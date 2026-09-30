// Duo-слой: «Навчання» — шлях (index.html). Власник — builder-home.
// render(ctx) → { title, description, body, css, js, nav }
// ctx: { course (DUO_COURSE), esc, mascotSvg(emotion, opts) | null, illo(name) | null }
// Розмітка шляху повна й без JS (вузли — посилання на плеєр); стани вузлів (locked/available/current/done),
// aria-label, тултип «Почати», онбординг і прокрутку додає assets/duo/path.js.
const GOALS = [
  { xp: 10, name: 'Легко' },
  { xp: 20, name: 'Звично' },
  { xp: 30, name: 'Серйозно' },
  { xp: 50, name: 'Інтенсив' },
];

const LOCK = '<svg class="d-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';

export function render({ course, esc, mascotSvg }) {
  let nodeNo = 0, chestNo = 0, bossNo = 0, i = 0;

  const item = it => {
    // хвиля: коефіцієнт k у [-1; 1], амплітуда — у CSS (--wave залежить від ширини екрана)
    const k = Math.sin(i++ * 0.85).toFixed(2);
    let label, name, kicker = '';
    if (it.kind === 'node') { nodeNo++; name = `Вузол ${nodeNo}: ${it.title}`; label = esc(it.title); }
    else if (it.kind === 'chest') { chestNo++; name = `Сундук ${chestNo}`; label = 'Сундук'; }
    else { bossNo++; name = `Бос ${bossNo}: ${it.title}`; label = esc(it.title); kicker = '<span class="duo-node__kicker">Бос</span>'; }
    return `<li class="duo-path__item" style="--k:${k}">
<a class="duo-node duo-node--${esc(it.kind)}" href="vprava.html?n=${esc(it.id)}" data-id="${esc(it.id)}" data-kind="${esc(it.kind)}" data-state="locked" data-a="${esc(name)}" aria-label="${esc(name)}">
<span class="duo-node__box"><span class="duo-node__face">${LOCK}</span></span>
<span class="duo-node__label">${kicker}${label}</span>
</a></li>`;
  };

  const units = course.units.map(u => `
<section class="duo-unit" id="den-${esc(u.day)}" data-unit="${esc(u.n)}" data-color="${esc(u.color)}" aria-labelledby="den-${esc(u.day)}-h">
<header class="duo-unit__head">
<h2 class="duo-unit__title" id="den-${esc(u.day)}-h"><span class="duo-unit__day">${esc(u.title)}</span><span class="duo-unit__topic">${esc(u.topic)}</span></h2>
<a class="d-btn d-btn--secondary d-btn--sm duo-unit__cheat" href="${esc(u.cheat)}"><span class="d-btn__label">Шпаргалка</span></a>
</header>
<ol class="duo-path">
${u.items.map(item).join('\n')}
</ol>
</section>`).join('');

  const goals = GOALS.map((g, n) => `<label class="duo-goal"><input class="duo-goal__in" type="radio" name="duo-goal" value="${g.xp}"${n === 1 ? ' checked' : ''}><span class="duo-goal__card"><b>${g.xp} XP</b><span>${g.name}</span></span></label>`).join('');

  const onboarding = `
<section class="duo-onb d-card" id="duo-onb" aria-labelledby="duo-onb-h" hidden>
<div class="duo-onb__mascot" id="duo-onb-mascot">${mascotSvg ? mascotSvg('happy', { size: 96, title: false }) : ''}</div>
<h2 id="duo-onb-h">Привіт! Я Ікринка</h2>
<p class="duo-onb__lead">Допоможу тобі вивчити перші дні роботи в Ikorka Shop.</p>
<ol class="duo-onb__how" aria-label="Як це працює">
<li>Кожен день курсу — кілька коротких уроків із вправами. Проходь їх по порядку.</li>
<li>За правильні відповіді ти отримуєш XP, а щоденна практика продовжує серію.</li>
<li>Помилка забирає серце, але серця повертаються з часом — не поспішай.</li>
</ol>
<fieldset class="duo-onb__goal">
<legend>Скільки XP на день ти хочеш набирати?</legend>
<div class="duo-goals">${goals}</div>
</fieldset>
<button type="button" class="d-btn d-btn--primary d-btn--lg d-btn--block" id="duo-onb-start"><span class="d-btn__label">Почати</span></button>
</section>`;

  return {
    title: 'Навчання',
    description: 'Курс новачка Ikorka Shop: шлях із коротких уроків-вправ, серія, XP і щоденна ціль.',
    body: `<div id="duo-home" class="duo-home">
<h1 class="sr-only">Шлях навчання</h1>
${onboarding}
<p class="duo-alldone d-card" id="duo-alldone" role="status" hidden>Усі уроки пройдено! Повторюй помилки й тренуйся на вкладці «Практика».</p>
<div class="duo-units" id="duo-units">${units}
</div>
<button type="button" class="d-btn d-btn--secondary d-btn--sm duo-jump" id="duo-jump" hidden><span class="d-btn__label">До поточного вузла</span></button>
</div>`,
    css: ['assets/duo/home.css'],
    js: ['assets/duo/path.js'],
    nav: true,
  };
}
