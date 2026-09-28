// Duo-слой: «Шпаргалка» юнітів (shpargalka.html#den-N) — правила уроків дня, фрази «Скажи так»,
// посилання на теорію, SOS і сторінку дня. Власник — builder-home. ЗАГЛУШКА Lead.
// ctx.trainer — window.TRAINER (дослівні дані уроків), ctx.course — DUO_COURSE.
export function render({ course, trainer, esc }) {
  const days = course.units.map(u => {
    const lessons = u.lessons.map(n => trainer.lessons[n - 1]).filter(Boolean);
    return `<section class="duo-cheat" id="den-${u.day}"><h2>${esc(u.title)} · ${esc(u.topic)}</h2>${lessons.map(l => `
      <article class="duo-cheat__lesson"><h3>Урок ${l.n}. ${esc(l.title)}</h3>
        <ul>${l.rules.map(r => `<li>${esc(r.text)}</li>`).join('')}</ul>
        <p><a href="${esc(l.href)}">Теорія уроку</a></p>
      </article>`).join('')}</section>`;
  }).join('');
  return {
    title: 'Шпаргалка',
    description: 'Коротко про кожен день курсу: правила уроків, готові фрази і посилання на теорію.',
    body: `<div class="duo-cheatsheet"><h1>Шпаргалка</h1>${days}</div>`,
    css: ['assets/duo/home.css'],
    js: [],
    nav: true,
  };
}
