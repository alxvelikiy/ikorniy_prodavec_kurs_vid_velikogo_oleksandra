#!/usr/bin/env node
// Сводит два исследования (docs/design/research/lesson.md и meta.md) в docs/design/DUO_TEARDOWN.md:
// сводка, обе таблицы с единой нумерацией (L1… — внутри урока, M1… — вне урока), чек-лист Duo-паритета P0/P1
// по экранам (для design-critic и билдеров), источники и тайминги.
//   node v2/duo/tools/teardown.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DIR = path.join(REPO, 'docs', 'design');
const read = f => fs.readFileSync(path.join(DIR, 'research', f), 'utf8').replace(/\r/g, '');

// ячейки таблицы: split по «|», но не внутри `code`, где встречается \|
function cells(line) {
  const out = []; let cur = ''; let code = false;
  for (let i = 1; i < line.length; i++) {
    const c = line[i];
    if (c === '`') code = !code;
    if (c === '\\' && line[i + 1] === '|') { cur += '\\|'; i++; continue; }
    if (c === '|' && !code) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  return out;
}
function parse(src, prefix) {
  const rows = [];
  for (const line of src.split('\n')) {
    if (!/^\|\s*\d+\s*\|/.test(line)) continue;
    const c = cells(line);
    rows.push({ id: prefix + c[0], screen: c[1], trigger: c[2], visual: c[3], anim: c[4], sound: c[5], haptic: c[6], copy: c[7], ours: c[8], prio: (c[9] || '').match(/P[012]/) ? c[9].match(/P[012]/)[0] : c[9], conf: c[10], raw: c });
  }
  return rows;
}
function section(src, title) {
  const m = src.split(/^## /m).find(s => s.startsWith(title));
  return m ? m.slice(title.length).trim() : '';
}

const L = read('lesson.md'), M = read('meta.md');
const rowsL = parse(L, 'L'), rowsM = parse(M, 'M');
const all = [...rowsL, ...rowsM];
const cnt = f => all.filter(f).length;
const table = rows => ['| # | Экран | Триггер | Что происходит визуально | Анимация | Звук | Вибрация | Микрокопи (смысл) | Наш аналог | Приоритет | Уверенность |',
  '|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map(r => '| ' + [r.id, ...r.raw.slice(1)].join(' | ') + ' |')].join('\n');

// экраны нашего продукта ← ключевые слова экрана/нашего аналога
const SCREENS = [
  ['Плеер урока (vprava.html)', /урок|вправ|feedback|фідбек|плитк|word bank|match|пар|комбо|серц|прогрес-бар|check|перевір|клавіат|вихід|помилк|теорі/i],
  ['Завершение урока и празднования', /заверш|lessonComplete|статист|конфет|свят|черга|празд|perfect|ідеальн/i],
  ['Путь (index.html)', /шлях|вузол|юніт|path|тултип|поповер|скрин|сундук|банер|поточн/i],
  ['Верхняя панель и навигация', /панель|топ-бар|таб-бар|сайдбар|навіг/i],
  ['Серия и дневная цель', /сері|streak|ціль|goal/i],
  ['Задания (zavdannia.html)', /завдан|quest|квест/i],
  ['Профиль (profil.html)', /профіл|досягн|achiev|календар|налаштув/i],
  ['Онбординг', /онбординг|onboard/i],
  ['Звук и вибрация (сквозные)', /звуков|вібрац.*загал|sound design|звук.*загал/i],
];
const byScreen = SCREENS.map(([name, re]) => [name, all.filter(r => (r.prio === 'P0' || r.prio === 'P1') && re.test(r.screen + ' ' + r.ours))]);

const now = new Date().toISOString().slice(0, 10);
const md = `# DUO_TEARDOWN — паттерны Duolingo → наш аналог (курс продаж Ikorka Shop)

Сводный разбор (${now}) двух исследований: [research/lesson.md](research/lesson.md) — всё ВНУТРИ урока,
[research/meta.md](research/meta.md) — всё ВНЕ урока. Источники — только публичные материалы (блог Duolingo,
UX-кейсы, галереи микроанимаций, справочные вики); ни логинов, ни скачанных ассетов. Копируем паттерны,
механики и тайминги, но не персонажей, иллюстрации, звуки, шрифты и тексты Duolingo.

**Итого паттернов: ${all.length}** (внутри урока — ${rowsL.length}, вне урока — ${rowsM.length}).
Приоритеты: P0 — ${cnt(r => r.prio === 'P0')}, P1 — ${cnt(r => r.prio === 'P1')}, P2 — ${cnt(r => r.prio === 'P2')}.
Уверенность: high — ${cnt(r => /high/.test(r.conf) && !/low|med/.test(r.conf))}, med — ${cnt(r => /med/.test(r.conf) && !/high/.test(r.conf))}, low — ${cnt(r => /^low/.test(r.conf))}, смешанная — ${cnt(r => /high|med/.test(r.conf) && /low|med/.test(r.conf) && /,|\(/.test(r.conf))}.
Оговорка: в исследовании урока живой веб-поиск в сессии был недоступен (сбой классификатора окружения) — факты
реконструированы по известным публичным материалам, отсюда больше \`low\` (в основном числа: тайминги, easing, пороги).

Правило приёмки (раздел 12 задания, пункт 5 «Duo-паритет»): для экрана закрыты ВСЕ паттерны P0/P1 из чек-листа ниже.

## Чек-лист Duo-паритета по экранам (P0/P1)

${byScreen.map(([name, rows]) => `### ${name}\n${rows.length ? rows.map(r => `- [ ] **${r.id}** (${r.prio}) ${r.screen} — ${r.trigger}. Наш аналог: ${r.ours}`).join('\n') : '- (нет P0/P1)'}`).join('\n\n')}

## 1. Внутри урока (L)

${table(rowsL)}

## 2. Вне урока (M)

${table(rowsM)}

## 3. Тайминги-сводка (из исследования урока)

${section(L, 'Тайминги-сводка')}

## 4. Порядок празднований после урока (из исследования мета-слоя)

${section(M, 'Порядок празднований после урока')}

## 5. Источники

### Исследование урока
${section(L, 'Источники')}

### Исследование мета-слоя
${section(M, 'Источники')}
`;
fs.writeFileSync(path.join(DIR, 'DUO_TEARDOWN.md'), md, 'utf8');
console.log(`DUO_TEARDOWN.md: ${all.length} паттернів (L ${rowsL.length}, M ${rowsM.length}); P0 ${cnt(r => r.prio === 'P0')}, P1 ${cnt(r => r.prio === 'P1')}, P2 ${cnt(r => r.prio === 'P2')}; чек-лист: ${byScreen.map(([n, r]) => n.split(' ')[0] + ' ' + r.length).join(', ')}`);
