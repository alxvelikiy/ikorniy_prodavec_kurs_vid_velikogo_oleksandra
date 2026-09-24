// Токени кольору курсу: світла і темна тема. Генерує assets/tokens.css під час збірки.
// Світлі значення — v2/DESIGN_SYSTEM.md (сайт). Темні — з мокапу уроку 9
// (https://claude.ai/artifact/NYQEKmRVKqrUoT9NGLiN9B, project/Main.dc.html, palette у renderVals()).
// Темний --brand не задається вручну, а обчислюється з світлого тим самим способом, що в мокапі:
// mix(accent, 0.32) — кожен канал зсувається на 32% до білого. Це не інверсія кольорів.

export function mix(hex, amt) {
  const h = hex.replace('#', '');
  const ch = i => parseInt(h.slice(i, i + 2), 16);
  const to = v => Math.round(v).toString(16).padStart(2, '0');
  return '#' + [0, 2, 4].map(i => to(ch(i) + (255 - ch(i)) * amt)).join('');
}

function rgba(hex, a) {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

const BRAND = '#A8432B';

export const LIGHT = {
  ink: '#23262B', canvas: '#F3F4F6', paper: '#FFFFFF',
  brand: BRAND, info: '#1F6E6E', good: '#2E8B57', bad: '#B23A3A',
  'surface-2': '#EDEEF1', line: '#E3E6EA', 'text-dim': '#5B6472',
  'on-brand': '#FFFFFF',
  'topnav-bg': 'rgba(255,255,255,.92)',
  'logo-plate': 'transparent',
  // обкладинки — колір по дню (рішення замовника 2026-09-23, пункт b)
  'tint-1': '#FDE7DA', 'tint-2': '#DCF3E8', 'tint-3': '#DCEBF7', 'tint-4': '#E7E2F6', 'tint-5': '#F8ECD4',
  'ol-num': '#D5D9DF',
  // нейтральні тони готових ілюстрацій (unDraw), акцент ілюстрацій = --brand
  'illo-dark': '#2F2B28', 'illo-mid': '#D5D9DF', 'illo-light': '#EDEEF1',
  'mark-bg': '#F5E1AE', 'challenge-bg': '#FBF3E7', 'track': '#E7E9ED',
  'shadow-rgb': '16,24,40',
};

export const DARK = {
  ink: '#F2EDE7', canvas: '#1E1B19', paper: '#28241F',
  brand: mix(BRAND, 0.32), info: '#3FA9A4', good: '#4CAF77', bad: '#E17169',
  'surface-2': '#2F2A25', line: '#3A352F', 'text-dim': '#948C82', // muted мокапу, 4.65:1 на --paper
  'on-brand': '#1E1B19', // білий на темному --brand дає 3.18:1 — нижче AA, тому темний текст (5.39:1)
  'topnav-bg': 'rgba(30,27,25,.92)',
  'logo-plate': '#F2EDE7', // PNG-лого прозорий з темним написом — у темній темі лежить на світлій плашці
  // tint-1 = coverTint мокапу (#332721); решта — та сама світлість, відтінок дня
  'tint-1': '#332721', 'tint-2': '#1F2E28', 'tint-3': '#1F2A33', 'tint-4': '#2A2533', 'tint-5': '#322B1E',
  'ol-num': '#5E564D',
  'illo-dark': '#D9D1C7', 'illo-mid': '#4A433C', 'illo-light': '#34302B',
  'mark-bg': '#5A4A22', 'challenge-bg': '#332B22', 'track': '#3A352F',
  'shadow-rgb': '0,0,0',
};

function block(t) {
  const lines = Object.entries(t).map(([k, v]) => `  --${k}:${v};`);
  // похідні — рахуються з базових, однаково для обох тем
  lines.push(
    `  --ring-fill:var(--brand); --ring-track:var(--line);`,
    `  --good-soft:${rgba(t.good, t === DARK ? 0.16 : 0.10)}; --bad-soft:${rgba(t.bad, t === DARK ? 0.16 : 0.08)};`,
    `  --brand-soft:${rgba(t.brand, t === DARK ? 0.18 : 0.12)};`,
    `  --shadow:0 1px 2px rgba(${t['shadow-rgb']},${t === DARK ? 0.3 : 0.04});`,
    `  --shadow-card:0 1px 3px rgba(${t['shadow-rgb']},${t === DARK ? 0.35 : 0.08});`,
    `  --shadow-pop:0 12px 32px rgba(${t['shadow-rgb']},${t === DARK ? 0.5 : 0.14});`,
    `  --shadow-accent:0 2px 10px ${rgba(t.brand, t === DARK ? 0.22 : 0.16)};`,
  );
  return lines.join('\n');
}

export function tokensCss() {
  return `/* ЗГЕНЕРОВАНО build/lib/tokens.mjs — не редагувати вручну */
:root{
${block(LIGHT)}
  color-scheme:light;
}
:root[data-theme="dark"]{
${block(DARK)}
  color-scheme:dark;
}
`;
}
