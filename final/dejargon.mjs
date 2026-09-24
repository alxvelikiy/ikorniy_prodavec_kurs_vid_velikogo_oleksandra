// Убирает из текста курса жаргон конвейера («шард», служебные пути). Каждая фраза должна найтись ровно один раз.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EDITS = [
  ['a3/intro.md', '— см. `a3/day_03.md`, `day_06.md`, `day_07.md`, `day_09.md`.', '— см. [День 3](day_03.md), [День 6](day_06.md), [День 7](day_07.md), [День 9](day_09.md).'],
  ['a3/gaps.md', 'Источник — `a2/map.md` (разделы 5 и 6) и `a1/findings.md` (раздел 9), плюс наблюдения, сделанные при написании дней и введения.', 'Источник — разбор эталонных звонков, записей обучения и документов компании, плюс наблюдения, сделанные при написании дней и введения.'],
  ['a3/gaps.md', 'Признан всеми 4 обучающими шардами.', 'Признан во всех группах записей обучения.'],
  ['a3/gaps.md', 'ни в одном из 5 шардов', 'ни в одном из источников'],
  ['a3/gaps.md', 'ни один из 4 обучающих шардов не разбирает вежливое прощание отдельно', 'ни в одной группе записей обучения вежливое прощание отдельно не разбирается'],
  ['a3/gaps.md', '(два независимых UA-шарда) против 95 / 100 / 120 / 140 в RU-шардах', '(две независимые украинские записи) против 95 / 100 / 120 / 140 в русских записях'],
  ['a3/lesson_K07.md', 'во всех шардах ДЛ', 'во всех реальных звонках новичков, которые разбирались на обучении'],
  ['a3/lesson_K10.md', 'ошибка совпадает в двух шардах обучения', 'ошибка повторяется в двух разных записях обучения'],
];

let ok = true;
const files = new Map();
for (const [f, from, to] of EDITS) {
  const p = path.join(ROOT, f);
  const text = files.get(p) ?? fs.readFileSync(p, 'utf8');
  const n = text.split(from).length - 1;
  if (n !== 1) { console.log('ПРОПУСК (' + n + ' вхождений): ' + f + ' :: ' + from.slice(0, 60)); ok = false; continue; }
  files.set(p, text.replace(from, to));
  console.log('ок: ' + f + ' :: ' + from.slice(0, 50));
}
for (const [p, text] of files) fs.writeFileSync(p, text);

// что ещё осталось из служебных слов
const rest = [];
for (const f of fs.readdirSync(path.join(ROOT, 'a3')).filter(x => /\.md$/.test(x) && x !== 'SPEC.md')) {
  const t = fs.readFileSync(path.join(ROOT, 'a3', f), 'utf8');
  for (const w of ['шард', 'a1/', 'a2/', 'findings', 'map.md']) if (t.includes(w)) rest.push(f + ': ' + w);
  const z = (t.match(/заказчик[а-яё]*/gi) || []);
  if (z.length) rest.push(f + ': «заказчик» ×' + z.length + ' (' + [...new Set(z)].join(', ') + ')');
}
console.log('\nосталось служебного: ' + (rest.length ? '\n  ' + rest.join('\n  ') : 'ничего'));
process.exit(ok ? 0 : 1);
