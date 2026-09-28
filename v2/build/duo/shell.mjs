// Duo-слой: HTML-каркас сторінки (head, шрифти, стилі, скрипти, навігація). Власник — Lead.
// Навігацію (сайдбар/таб-бар/верхня панель) малює nav.mjs (власник — builder-home), тіла сторінок —
// pages/*.mjs (власники — builders). Порядок скриптів — docs/design/ARCHITECTURE.md §3.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { navHtml } from './nav.mjs';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BUILD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // v2/build
// Підключаємо лише наявні модулі: команда пише їх паралельно, і сторінка не має ловити 404 на ще не створеному файлі.
// data/* генерується збіркою до сторінок — підключається завжди.
const present = rel => rel.startsWith('data/') || fs.existsSync(path.join(BUILD, rel));

// Спільні модулі для всіх Duo-сторінок (defer, у цьому порядку)
export const CORE_JS = [
  'data/duo-course.js',
  'assets/duo/core.js', 'assets/duo/motion.js', 'assets/duo/sfx.js',
  'assets/duo/progress-core.js', 'assets/duo/progress.js',
  'assets/duo/mascot.js', 'assets/duo/illos.js', 'assets/duo/copy.js',
  'assets/duo/celebrate.js', 'assets/duo/shell.js',
];
export const CORE_CSS = ['assets/duo/tokens.css', 'assets/duo/core.css', 'assets/duo/mascot.css'];

/**
 * @param {object} o
 * @param {string} o.slug        ім'я файлу без .html
 * @param {string} o.title       <title> (без « · Ikorka Shop»)
 * @param {string} o.description
 * @param {string} o.body        вміст <main>
 * @param {string[]} [o.css]     додаткові стилі сторінки (assets/duo/…)
 * @param {string[]} [o.js]      додаткові скрипти сторінки (assets/duo/…), після CORE_JS
 * @param {boolean} [o.nav]      показувати навігацію застосунку (false — плеєр уроку на весь екран)
 * @param {string} [o.bodyClass]
 * @param {boolean} [o.accountsOn]
 * @param {string} [o.themeColor]
 */
export function duoShell({ slug, title, description = '', body, css = [], js = [], nav = true, bodyClass = '', accountsOn = false, themeColor = '#ffffff', beforeMain = '' }) {
  const styles = [...CORE_CSS, ...css].filter(present).map(h => `<link rel="stylesheet" href="${h}">`).join('\n');
  const scripts = [...CORE_JS, ...js].filter(present).map(s => `<script src="${s}" defer></script>`).join('\n');
  const account = accountsOn ? `<script src="assets/vendor/supabase-js.js" defer></script>
<script src="assets/supabase-config.js" defer></script>
<script src="assets/account.js" defer></script>` : '';
  return `<!DOCTYPE html>
<html lang="uk" data-sw="1" data-duo="${esc(slug)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)} · Ikorka Shop</title>
${description ? `<meta name="description" content="${esc(description)}">` : ''}
${accountsOn ? '<meta name="ikorka-coach" content="on">' : ''}
<meta name="theme-color" content="${esc(themeColor)}">
<link rel="preload" href="assets/duo/fonts/nunito-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
<script>try{if(localStorage.getItem('ikorka-theme')==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}</script>
<link rel="icon" type="image/png" href="assets/ikorka-logo.png">
${styles}
</head>
<body class="duo duo-page--${esc(slug)}${nav ? ' duo-has-nav' : ''}${bodyClass ? ' ' + esc(bodyClass) : ''}">
<a class="skip-link" href="#main-content">Перейти до змісту</a>
${nav ? navHtml(slug) : ''}
${beforeMain}
<main id="main-content" tabindex="-1" class="duo-main">
${body}
</main>
${account}
${scripts}
<script>try{if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(function(){})}catch(e){}</script>
</body>
</html>
`;
}
