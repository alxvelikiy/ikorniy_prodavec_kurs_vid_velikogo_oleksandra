// Ikorka Duo — перевірка WCAG-контрасту всіх значущих пар текст/фон з tokens.css.
// Власник: design-system-engineer. Запуск: node v2/duo/lab/ds-contrast.mjs
// Друкує markdown-таблицю (для docs/design/DESIGN_SYSTEM.md) для світлої і темної теми.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKENS_PATH = join(__dirname, '..', '..', 'build', 'assets', 'duo', 'tokens.css');

function hexToRgb(hex) {
  hex = hex.trim().replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function relLuminance([r, g, b]) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function contrast(hexA, hexB) {
  const L1 = relLuminance(hexToRgb(hexA));
  const L2 = relLuminance(hexToRgb(hexB));
  const lighter = Math.max(L1, L2), darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseVars(blockText) {
  const map = {};
  const re = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(blockText))) map[m[1]] = m[2].trim();
  return map;
}

const css = readFileSync(TOKENS_PATH, 'utf8');
// Шукаємо САМЕ селектор (з "{" одразу після), а не згадку рядком у верхньому коментарі файлу.
const darkSelectorIdx = css.indexOf(':root[data-theme="dark"] {');
if (darkSelectorIdx === -1) throw new Error('Не знайдено блок :root[data-theme="dark"] у tokens.css');
const lightBlock = css.slice(0, darkSelectorIdx);
const darkBlock = css.slice(darkSelectorIdx);
const themes = {
  'Світла': parseVars(lightBlock),
  'Темна': parseVars(darkBlock)
};

// Значущі пари текст/фон, що реально використовуються в компонентах core.css.
const PAIRS = [
  ['Текст на фоні сторінки', 'c-text', 'c-bg', 4.5],
  ['Текст на поверхні (картка)', 'c-text', 'c-surface', 4.5],
  ['Приглушений текст на поверхні', 'c-muted', 'c-surface', 4.5],
  ['Приглушений текст на фоні сторінки', 'c-muted', 'c-bg', 4.5],
  ['Текст посилання (a) на поверхні', 'c-link', 'c-surface', 4.5],
  ['Текст посилання (a) на фоні сторінки', 'c-link', 'c-bg', 4.5],
  ['Функціональна рамка/губа (.d-option, secondary) на поверхні', 'c-line-shadow', 'c-surface', 3],
  ['Кільце фокусу на поверхні', 'c-focus', 'c-surface', 3],
  ['Білий текст на Primary (brand)', 'c-text-inverse', 'c-brand', 4.5],
  ['Білий текст на Success', 'c-text-inverse', 'c-success', 4.5],
  ['Білий текст на Danger', 'c-text-inverse', 'c-error', 4.5],
  ['Білий текст на Info', 'c-text-inverse', 'c-info', 4.5],
  ['Текст Streak на поверхні', 'c-streak', 'c-surface', 4.5],
  ['Текст XP на поверхні', 'c-xp', 'c-surface', 4.5],
  ['Білий текст/іконка на Юніт 1 (тіл, вузол шляху)', 'c-text-inverse', 'c-unit-1', 4.5],
  ['Білий текст/іконка на Юніт 2 (слива, вузол шляху)', 'c-text-inverse', 'c-unit-2', 4.5],
  ['Білий текст/іконка на Юніт 3 (індиго, вузол шляху)', 'c-text-inverse', 'c-unit-3', 4.5],
  ['Білий текст/іконка на Юніт 4 (оливковий, вузол шляху)', 'c-text-inverse', 'c-unit-4', 4.5],
  ['Білий текст/іконка на Юніт 5 (малиновий, вузол шляху)', 'c-text-inverse', 'c-unit-5', 4.5],
  ['Brand-on-soft текст на Brand-soft (badge)', 'c-brand-on-soft', 'c-brand-soft', 4.5],
  ['Success-on-soft текст на Success-soft (badge)', 'c-success-on-soft', 'c-success-soft', 4.5],
  ['Danger-on-soft текст на Danger-soft (badge)', 'c-error-on-soft', 'c-error-soft', 4.5],
  ['Info-on-soft текст на Info-soft (badge)', 'c-info-on-soft', 'c-info-soft', 4.5],
  ['Streak-on-soft текст на Streak-soft (badge)', 'c-streak-on-soft', 'c-streak-soft', 4.5],
  ['XP-on-soft текст на XP-soft (badge)', 'c-xp-on-soft', 'c-xp-soft', 4.5],
  ['Текст на Info-soft (обраний варіант)', 'c-text', 'c-info-soft', 4.5],
  ['Текст на Success-soft (правильно)', 'c-text', 'c-success-soft', 4.5],
  ['Текст на Error-soft (неправильно)', 'c-text', 'c-error-soft', 4.5],
  ['Рамка "обрано" (info-on-soft) на поверхні', 'c-info-on-soft', 'c-surface', 3],
  ['Рамка "правильно" (success-on-soft) на поверхні', 'c-success-on-soft', 'c-surface', 3],
  ['Рамка "неправильно" (error-on-soft) на поверхні', 'c-error-on-soft', 'c-surface', 3],
  ['Ghost-кнопка текст (brand-on-soft) на поверхні', 'c-brand-on-soft', 'c-surface', 4.5],
  ['Ghost-кнопка текст (brand-on-soft) на фоні сторінки', 'c-brand-on-soft', 'c-bg', 4.5],
  ['Disabled текст на Disabled фоні (орієнтовно, AA не обов’язковий)', 'c-disabled-text', 'c-disabled-bg', 3]
];

let anyFail = false;
for (const [themeName, vars] of Object.entries(themes)) {
  console.log('\n### ' + themeName + ' тема\n');
  console.log('| Пара | Токени (hex) | Контраст | Поріг | Результат |');
  console.log('|---|---|---|---|---|');
  for (const [label, fgKey, bgKey, min] of PAIRS) {
    const fg = vars[fgKey], bg = vars[bgKey];
    if (!fg || !bg) { console.log(`| ${label} | ${fgKey} / ${bgKey} — не знайдено | — | ${min}:1 | ПРОПУЩЕНО |`); continue; }
    const ratio = contrast(fg, bg);
    const ok = ratio >= min;
    if (!ok) anyFail = true;
    console.log(`| ${label} | \`${fg}\` / \`${bg}\` | ${ratio.toFixed(2)}:1 | ${min}:1 | ${ok ? 'OK' : 'FAIL'} |`);
  }
}
console.log('\n' + (anyFail ? 'Є пари нижче порогу — див. FAIL вище.' : 'Усі пари відповідають своєму порогу.'));
process.exit(anyFail ? 1 : 0);
