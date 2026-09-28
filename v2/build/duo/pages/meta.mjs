// Duo-слой: «Практика», «Завдання», «Профіль» (praktyka.html, zavdannia.html, profil.html).
// Власник — builder-celebrate. ЗАГЛУШКА Lead. Кожна функція → { title, description, body, css, js, nav }.
const common = { css: ['assets/duo/home.css', 'assets/duo/meta.css'], js: ['assets/duo/meta.js'], nav: true };

export function praktyka() {
  return { ...common, title: 'Практика', description: 'Повторення помилок, SOS-тренування і тренажери курсу.', body: '<div id="duo-practice" class="duo-meta"><h1>Практика</h1></div>' };
}
export function zavdannia() {
  return { ...common, title: 'Завдання', description: 'Щоденні завдання і скриня з XP.', body: '<div id="duo-quests" class="duo-meta"><h1>Завдання</h1></div>' };
}
export function profil() {
  return { ...common, title: 'Профіль', description: 'Статистика, досягнення, календар і налаштування.', body: '<div id="duo-profile" class="duo-meta"><h1>Профіль</h1></div>' };
}
