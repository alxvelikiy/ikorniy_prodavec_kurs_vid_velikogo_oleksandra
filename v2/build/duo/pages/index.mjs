// Duo-слой: «Навчання» — шлях (index.html). Власник — builder-home. ЗАГЛУШКА Lead.
// render(ctx) → { title, description, body, css, js, nav }
// ctx: { course (DUO_COURSE), esc, mascotSvg(emotion, opts) | null, illo(name) | null }
export function render({ course, esc }) {
  const units = course.units.map(u => `
  <section class="duo-unit" id="den-${u.day}" data-unit="${u.n}">
    <header class="duo-unit__head"><h2>${esc(u.title)} · ${esc(u.topic)}</h2><a href="${esc(u.cheat)}">Шпаргалка</a></header>
    <ol class="duo-path">${u.items.map(it => `<li class="duo-node duo-node--${it.kind}" data-id="${esc(it.id)}">${it.kind === 'node' ? `<a href="vprava.html?n=${esc(it.id)}">${esc(it.title)}</a>` : esc(it.title || it.id)}</li>`).join('')}</ol>
  </section>`).join('');
  return {
    title: 'Навчання',
    description: 'Курс новачка Ikorka Shop: шлях із коротких уроків-вправ, серія, XP і щоденна ціль.',
    body: `<div id="duo-home" class="duo-home">${units}</div>`,
    css: ['assets/duo/home.css'],
    js: ['assets/duo/path.js'],
    nav: true,
  };
}
