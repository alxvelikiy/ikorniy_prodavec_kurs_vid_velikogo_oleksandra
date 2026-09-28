// Duo-слой: навігація застосунку (статична розмітка; стан і лічильники оживляє assets/duo/shell.js).
// Власник — builder-home. Мобільний: верхня панель (серія · XP · серця) + нижній таб-бар;
// десктоп (≥ 1024px): лівий сайдбар. ЗАГЛУШКА Lead — builder-home замінює повністю.
export const TABS = [
  { slug: 'index', href: 'index.html', label: 'Навчання' },
  { slug: 'praktyka', href: 'praktyka.html', label: 'Практика' },
  { slug: 'zavdannia', href: 'zavdannia.html', label: 'Завдання' },
  { slug: 'profil', href: 'profil.html', label: 'Профіль' },
];

export function navHtml(active) {
  const items = TABS.map(t => `<a class="duo-tab${t.slug === active ? ' is-active' : ''}" href="${t.href}"${t.slug === active ? ' aria-current="page"' : ''}>${t.label}</a>`).join('');
  return `<nav class="duo-nav" aria-label="Розділи">${items}</nav>`;
}
