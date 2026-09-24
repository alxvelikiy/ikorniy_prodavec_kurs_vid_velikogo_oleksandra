// Перевод курса с 10 на 5 дней (решение руководства от 2026-09-17). Каждая точечная замена проверяется.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = f => path.join(ROOT, f);
const pad = n => String(n).padStart(2, '0');

// новый день для каждого критерия (номер урока = номер критерия)
const DAY = { 1: 1, 2: 1, 3: 4, 4: 4, 5: 1, 6: 3, 7: 3, 8: 3, 9: 5, 10: 2, 11: 2, 12: 4 };
let problems = 0;
const log = (...a) => console.log(...a);
function once(text, from, to, where) {
  const n = text.split(from).length - 1;
  if (n !== 1) { log('ПРОПУСК (' + n + '): ' + where + ' :: ' + from.slice(0, 70)); problems++; return text; }
  return text.replace(from, to);
}

// 1. Уроки: шапка «> День N» и ссылки «урок N (день M)»
const refRe = /(урок[а-яё]*\s+(\d{1,2})\s*\(день\s+)(\d{1,2})\)/gi;
function fixRefs(t) { return t.replace(refRe, (m, head, lesson, _d) => DAY[+lesson] ? head + DAY[+lesson] + ')' : m); }
for (let k = 1; k <= 12; k++) {
  const f = 'a3/lesson_K' + pad(k) + '.md';
  let t = fs.readFileSync(P(f), 'utf8');
  const before = t;
  t = t.replace(/^> День \d+ ·/m, '> День ' + DAY[k] + ' ·');
  t = fixRefs(t);
  if (!/^> День \d+ ·/m.test(t)) { log('нет шапки дня: ' + f); problems++; }
  if (t !== before) fs.writeFileSync(P(f), t);
}

// 2. Введение
{
  const f = 'a3/intro.md';
  let t = fs.readFileSync(P(f), 'utf8');
  t = once(t, 'Это курс адаптации на 10 дней.', 'Это курс адаптации на 5 дней.', f);
  t = once(t, 'Каждый день вводит один-два новых критерия и опирается на предыдущие. К десятому дню ты проходишь все 12 критериев',
    'Каждый день вводит от одного до трёх новых критериев и опирается на предыдущие. К пятому дню ты проходишь все 12 критериев', f);
  const cut = t.indexOf('## Карта критериев по дням');
  if (cut < 0) { log('нет раздела карты во введении'); problems++; }
  else {
    const rows = [
      [1, 'K01 Заход', '🟢 сильная'], [2, 'K02 Крючок', '🟢 сильная'], [5, 'K05 Соблюдение этапов', '🟢 сильная'],
      [11, 'K11 Реакция на возражения', '🟢 сильная'], [10, 'K10 Побуждение к действию', '🟢 сильная'],
      [6, 'K06 Персонализация', '🟢 сильная'], [7, 'K07 УТП озвучено', '🟢 сильная'], [8, 'K08 Альтернатива / спуск', '🟢 в обучении, 🟡 в звонках'],
      [3, 'K03 Уверенность, скорость, интонация, молчание', '🟡 средняя, близко к пробелу'], [4, 'K04 Чистота речи и слова-паразиты', '⛔ пробел'],
      [12, 'K12 Понимание цели и продукта', '🟢 сильная, внутри частичный пробел'], [9, 'K09 Вежливое прощание, итог', '🟡 средняя'],
    ];
    const names = Object.fromEntries(rows.map(([n, name]) => [n, name]));
    t = t.slice(0, cut) +
      '## Карта критериев по дням\n\n| Критерий | День | Статус доказательности |\n|---|---|---|\n' +
      rows.map(([n, name, st]) => '| ' + name + ' | ' + DAY[n] + ' | ' + st + ' |').join('\n') +
      '\n| Все 12 критериев | 5 | аттестация против эталонных звонков |\n\n' +
      '## Таблица «критерий → урок → день»\n\n| Критерий | Урок | День |\n|---|---|---|\n' +
      Array.from({ length: 12 }, (_, i) => i + 1).map(n => '| ' + names[n] + ' | [Урок ' + n + '](lesson_K' + pad(n) + '.md) | ' + DAY[n] + ' |').join('\n') +
      '\n\nКурс сжат с 10 до 5 дней решением руководства от 2026-09-17. Порядок дней не совпадает с номерами критериев K01–K12: он собран по логике звонка — сначала заход и скелет разговора, потом возражения и закрытие, потом работа с базой, потом звучание, речь и продукт, в конце финал звонка и аттестация. Прямой привязки критериев к конкретным дням в материалах нет, поэтому распределение по дням — предположение, и это отмечено в самих днях. Срок в пять дней опирается на записи обучения: обычный срок подготовки там называется 5–6 дней, а методичка наставника предусматривает дополнительные дни адаптации, если какой-то параметр не настроен (DOC-MET).\n';
  }
  fs.writeFileSync(P(f), t);
}

// 3. Пробелы
{
  const f = 'a3/gaps.md';
  let t = fs.readFileSync(P(f), 'utf8');
  t = once(t, 'на разборе дня 9', 'на разборе дня 5', f);
  t = once(t, 'для аттестации на дне 10', 'для аттестации на дне 5', f);
  t = once(t, '(см. типичную яму дня 6)', '(см. типичную яму дня 3)', f);
  t = once(t, 'после завершения основных 10 дней', 'после завершения основных 5 дней', f);
  t = once(t, '10-дневного каркаса', '5-дневного каркаса', f);
  t = fixRefs(t);
  fs.writeFileSync(P(f), t);
}

// 4. Карта критериев: подписи «ДЕНЬ NN» идут в порядке K01…K12 в каждой из двух раскладок
{
  const f = 'design/svg/criteria_map.svg';
  let t = fs.readFileSync(P(f), 'utf8');
  let i = 0;
  t = t.replace(/ДЕНЬ \d{2}/g, () => 'ДЕНЬ ' + pad(DAY[(i++ % 12) + 1]));
  if (i !== 24) { log('в карте критериев ' + i + ' подписей вместо 24'); problems++; }
  fs.writeFileSync(P(f), t);
}

// 5. Сборщик
{
  const f = 'final/build.mjs';
  let t = fs.readFileSync(P(f), 'utf8');
  t = once(t, "const days = Array.from({ length: 10 }", "const days = Array.from({ length: N_DAYS }", f);
  t = once(t, "const HERE = path.dirname(fileURLToPath(import.meta.url));", "const HERE = path.dirname(fileURLToPath(import.meta.url));\nconst N_DAYS = 5;", f);
  t = once(t, "'День ' + pad(n) + ' / 10'", "'День ' + pad(n) + ' / ' + pad(N_DAYS)", f);
  t = once(t, "'<h1><span>10 дней</span>", "'<h1><span>' + N_DAYS + ' дней</span>", f);
  t = once(t, "<div><dt>Дней</dt><dd>10</dd></div>", "<div><dt>Дней</dt><dd>' + N_DAYS + '</dd></div>", f);
  t = once(t, "<p class=\"toc-h\">01 · 10 дней</p>", "<p class=\"toc-h\">01 · ' + N_DAYS + ' дней</p>", f);
  t = once(t, "<h2>10 дней</h2>", "<h2>' + N_DAYS + ' дней</h2>", f);
  t = once(t, "fig('progress_10.svg', 'fig-progress')", "fig('progress_' + N_DAYS + '.svg', 'fig-progress')", f);
  t = once(t, "md.push('# 10 дней\\n\\n[ДИАГРАММА: Прогресс по 10 дням — design/svg/progress_10.svg]');",
    "md.push('# ' + N_DAYS + ' дней\\n\\n[ДИАГРАММА: Прогресс по ' + N_DAYS + ' дням — design/svg/progress_' + N_DAYS + '.svg]');", f);
  t = once(t, "for (let i = 1; i <= 10; i++) md.push(rd('a3/day_'", "for (let i = 1; i <= N_DAYS; i++) md.push(rd('a3/day_'", f);
  fs.writeFileSync(P(f), t);
}

// 6. Старые дни 06–10 уже лежат в a3/_archive_10days — убираем из рабочего набора
for (let d = 6; d <= 10; d++) {
  const f = P('a3/day_' + pad(d) + '.md');
  if (fs.existsSync(P('a3/_archive_10days/day_' + pad(d) + '.md')) && fs.existsSync(f)) fs.unlinkSync(f);
}

log(problems ? 'ГОТОВО С ПРОБЛЕМАМИ: ' + problems : 'готово, все замены прошли');
process.exit(problems ? 1 : 0);
