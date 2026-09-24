// Мелкие правки, видимые читателю: подписи ссылок и остатки рабочей кухни. Смысл не меняется.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pad = n => String(n).padStart(2, '0');

const EDITS = [
  ['a3/lesson_K11.md', 'схему нарисуем в приложении к курсу.', 'схема нарисована сразу под этим списком.'],
  ['a3/gaps.md', '## 4. Противоречия из карты (раздел 6) и что взято в курс', '## 4. Противоречия в материалах и что взято в курс'],
  ['a3/gaps.md', 'убрана из уроков, дней и intro;', 'убрана из уроков, дней и введения;'],
  ['a3/gaps.md', ' — в материалах компании такие цифры даны без источника и в курс не выносятся (см. `brief.md`, раздел 5.6).', ' — такие цифры даны без источника и в курс не выносятся.'],
];
// подписи ссылок в таблице введения: имя файла → «Урок N»
for (let i = 1; i <= 12; i++) EDITS.push(['a3/intro.md', '[lesson_K' + pad(i) + '.md](lesson_K' + pad(i) + '.md)', '[Урок ' + i + '](lesson_K' + pad(i) + '.md)']);

const cache = new Map();
let ok = true;
for (const [f, from, to] of EDITS) {
  const p = path.join(ROOT, f);
  const t = cache.get(p) ?? fs.readFileSync(p, 'utf8');
  const n = t.split(from).length - 1;
  if (n !== 1) { console.log('ПРОПУСК (' + n + '): ' + f + ' :: ' + from.slice(0, 70)); ok = false; continue; }
  cache.set(p, t.replace(from, to));
}
for (const [p, t] of cache) fs.writeFileSync(p, t);
console.log('правок применено: ' + (EDITS.length - (ok ? 0 : EDITS.filter(([f, from]) => (fs.readFileSync(path.join(ROOT, f), 'utf8').split(from).length - 1) !== 0).length)) + ' из ' + EDITS.length + (ok ? '' : ' — есть пропуски'));
process.exit(ok ? 0 : 1);
