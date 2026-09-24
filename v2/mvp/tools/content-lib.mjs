// Спільна бібліотека MVP-тренажера: нормалізація тексту, дослівна перевірка
// фрагментів проти уроків, витяг структур з уроку, валідація курованої розмітки.
// Використовують: v2/build/lib/trainer.mjs (збірка), v2/mvp/tools/validate-content.mjs
// (CLI для агентів), v2/mvp/tests/* (автотести), v2/coach/server.mjs (валідатор фраз тренера).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBlocks, groupQuiz } from '../../build/lib/md.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const V2 = path.resolve(__dirname, '..', '..');
export const LESSONS_DIR = path.join(V2, 'text', 'lessons');
export const CONTENT_DIR = path.join(V2, 'mvp', 'content');

export const LESSON_TITLES = {
  1: 'Вступ', 2: 'Гачок', 3: 'Етапи дзвінка', 4: 'Робота із запереченнями', 5: 'Заклик до дії',
  6: 'Персоналізація', 7: 'УТП', 8: 'Альтернатива і спуск', 9: 'Впевненість, темп, інтонація, пауза',
  10: 'Чистота мови', 11: 'Знання продукту і мети дзвінка', 12: 'Підсумок і прощання',
};
export const LESSON_DAY = { 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 3, 7: 3, 8: 3, 9: 4, 10: 4, 11: 4, 12: 5 };

export const pad2 = n => String(n).padStart(2, '0');
export const lessonFile = n => path.join(LESSONS_DIR, `urok_${pad2(n)}.md`);

// Нормалізація для дослівного порівняння: markdown-розмітка, типографські лапки,
// апострофи, тире, нерозривні пробіли й регістр не вважаються розбіжністю.
export function normText(s) {
  return String(s == null ? '' : s)
    .normalize('NFC')
    .replace(/\*\*|__/g, '')
    .replace(/[«»„“”"]/g, '"')
    .replace(/[’ʼ`‘']/g, "'")
    .replace(/[‒–—―]/g, '—')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const rawCache = new Map();
export function lessonRaw(n) {
  if (!rawCache.has(n)) rawCache.set(n, fs.readFileSync(lessonFile(n), 'utf8'));
  return rawCache.get(n);
}
const normCache = new Map();
export function lessonNorm(n) {
  if (!normCache.has(n)) normCache.set(n, normText(lessonRaw(n)));
  return normCache.get(n);
}

// Чи є фрагмент дослівним шматком тексту уроку n. Допускається «…» на місці обрізаного
// початку/кінця і велика перша літера (нормалізація знижує регістр).
export function isVerbatim(n, fragment) {
  const f = normText(fragment);
  if (!f) return false;
  const hay = lessonNorm(n);
  if (hay.includes(f)) return true;
  const trimmed = f.replace(/^(…|\.\.\.)\s*/, '').replace(/\s*(…|\.\.\.)$/, '').replace(/^"|"$/g, '').trim();
  return trimmed.length > 0 && hay.includes(trimmed);
}

// Частка «N з M» / «N із M» / «із двадцяти шести» — такі числа за замовчуванням не показуються.
const SHARE_RE = /\d+(?:[.,]\d+)?\s*(?:з|із)\s*\d+|двадцяти\s+шести/i;
export function hasShare(s) { return SHARE_RE.test(String(s || '')); }

// ---------- Витяг структур з уроку ----------
function sectionOf(raw, h2) {
  const re = new RegExp('^## ' + h2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'm');
  const parts = raw.split(re);
  if (parts.length < 2) return '';
  return parts[1].split(/^## /m)[0];
}

export function extractLesson(n, rawOverride) {
  const raw = rawOverride != null ? rawOverride : lessonRaw(n);
  const blocks = groupQuiz(parseBlocks(raw));
  const h2s = [];
  const pairs = [], quotes = [], says = [], mcq = [];
  let cur = null;
  for (const b of blocks) {
    if (b.kind === 'heading' && b.level === 2) { cur = b.text; h2s.push(b.text); continue; }
    if (b.kind === 'quiz') {
      mcq.push({ num: String(b.num), title: b.title, options: b.options.map(o => ({ letter: o.letter, text: o.text })), correct: b.correct, note: b.why || '' });
      continue;
    }
    if (b.kind !== 'directive') continue;
    if (b.type === 'pairs') {
      for (const c of (b.fields.cards || [])) pairs.push({ i: pairs.length, bad: (c[0] || '').trim(), good: (c[1] || '').trim(), section: cur });
    } else if (b.type === 'quote') {
      quotes.push({ i: quotes.length, who: b.fields['хто'] || '', text: b.fields['текст'] || '', strong: /^сильно/i.test(b.fields['оцінка'] || ''), why: b.fields['чому'] || '', section: cur });
    } else if (b.type === 'say') {
      says.push({ i: says.length, sit: b.fields['ситуація'] || '', say: b.fields['скажи'] || '', why: b.fields['чому'] || '', keys: (b.fields['ключі'] || '').split(',').map(s => s.trim()).filter(Boolean), section: cur });
    }
  }
  // відкриті питання «Перевір себе» (з еталоном «Звір себе:»)
  const open = [];
  const sec = sectionOf(raw, 'Перевір себе');
  const chunks = sec.split(/^\*\*(\d+)\.\s*/m).slice(1);
  for (let i = 0; i < chunks.length; i += 2) {
    const num = chunks[i], body = chunks[i + 1] || '';
    const m = body.match(/^Звір себе:\s*([\s\S]*?)\s*$/m);
    if (!m) continue;
    const q = body.split(/^Звір себе:/m)[0].replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    open.push({ num, q, answer: m[1].replace(/\s+/g, ' ').trim() });
  }
  // «Практика» — пронумеровані пункти
  const practice = [];
  const pr = sectionOf(raw, 'Практика');
  for (const line of pr.split('\n')) {
    const m = line.match(/^\s*\d+\.\s+(.*)$/);
    if (m) practice.push(m[1].trim());
  }
  const cover = (blocks.find(b => b.kind === 'directive' && b.type === 'cover') || { fields: {} }).fields;
  return { n, title: LESSON_TITLES[n], day: LESSON_DAY[n], subtitle: cover['підзаголовок'] || '', h2s, mcq, open, pairs, quotes, says, practice };
}

// ---------- Валідація курованої розмітки urok_NN.json ----------
export function loadCurated(n) {
  const p = path.join(CONTENT_DIR, `urok_${pad2(n)}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function validateCurated(n, data, ex = extractLesson(n)) {
  const errors = [], warnings = [];
  const E = (path, msg) => errors.push(`урок ${n} · ${path}: ${msg}`);
  const W = (path, msg) => warnings.push(`урок ${n} · ${path}: ${msg}`);
  // lesson — урок-джерело фрагмента (за замовчуванням той самий); інший урок — лише явним полем *_lesson / option.lesson
  const checkText = (path, s, { max = 400, required = true, lesson = n } = {}) => {
    if (s == null || s === '') { if (required) E(path, 'порожньо'); return false; }
    if (typeof s !== 'string') { E(path, 'має бути рядком'); return false; }
    if (!(lesson >= 1 && lesson <= 12)) { E(path, `невідомий урок-джерело ${lesson}`); return false; }
    if (!isVerbatim(lesson, s)) { E(path, `не знайдено дослівно в уроці ${lesson}: «${s.slice(0, 90)}»`); return false; }
    if (hasShare(s)) { E(path, `містить частку «N з M» (приховується за замовчуванням): «${s.slice(0, 90)}»`); return false; }
    if (s.length > max) W(path, `задовге (${s.length} > ${max})`);
    return true;
  };
  if (!data || typeof data !== 'object') { E('', 'немає JSON-об\'єкта'); return { errors, warnings }; }
  if (data.lesson !== n) E('lesson', `очікувалось ${n}`);

  const codes = new Set();
  const rules = Array.isArray(data.rules) ? data.rules : [];
  if (rules.length < 3 || rules.length > 5) E('rules', `потрібно 3–5 правил, є ${rules.length}`);
  rules.forEach((r, i) => {
    const p = `rules[${i}]`;
    if (!new RegExp(`^${n}\\.[1-5]$`).test(r.code || '')) E(p + '.code', `формат «${n}.k», є «${r.code}»`);
    if (codes.has(r.code)) E(p + '.code', 'дубль коду');
    codes.add(r.code);
    checkText(p + '.text', r.text, { max: 200 });
    if (r.section && !ex.h2s.includes(r.section)) E(p + '.section', `немає розділу «${r.section}»`);
    if (r.label && !['слова наставника', 'скрипт компанії'].includes(r.label)) E(p + '.label', 'лише «слова наставника» або «скрипт компанії»');
  });
  const needRule = (p, code) => { if (!code) W(p, 'без коду правила'); else if (!codes.has(code)) E(p, `невідомий код правила «${code}»`); };

  const mcqNums = new Set(ex.mcq.map(q => q.num));
  const attempts = Array.isArray(data.attempts) ? data.attempts : [];
  if (attempts.length < 1 || attempts.length > 2) E('attempts', `потрібно 1–2, є ${attempts.length}`);
  attempts.forEach((a, i) => {
    const p = `attempts[${i}]`;
    if (!mcqNums.has(String(a.quiz))) E(p + '.quiz', `у «Перевір себе» немає тестового питання №${a.quiz}`);
    if (!ex.h2s.includes(a.before_section)) E(p + '.before_section', `немає розділу «${a.before_section}»`);
    else if (['Перевір себе', 'Практика', 'Чого ми поки не знаємо'].includes(a.before_section)) E(p + '.before_section', 'питання має стояти перед поясненням правила, не в кінці уроку');
    checkText(p + '.explain', a.explain, { max: 400 });
    needRule(p + '.rule', a.rule);
  });

  const quiz = data.quiz && typeof data.quiz === 'object' ? data.quiz : {};
  for (const q of ex.mcq) if (!quiz[q.num]) E(`quiz.${q.num}`, 'немає розбору до тестового питання');
  for (const [k, v] of Object.entries(quiz)) {
    const p = `quiz.${k}`;
    if (!mcqNums.has(String(k))) { E(p, 'немає такого тестового питання'); continue; }
    checkText(p + '.why', v.why, { max: 400 });
    checkText(p + '.say', v.say, { max: 400 });
    needRule(p + '.rule', v.rule);
  }

  const pairs = Array.isArray(data.pairs) ? data.pairs : [];
  pairs.forEach((pr, i) => {
    const p = `pairs[${i}]`;
    const src = ex.pairs[pr.i];
    if (!src) { E(p + '.i', `немає пари №${pr.i}`); return; }
    checkText(p + '.why', pr.why, { max: 400 });
    // «як правильно» для пари, де в уроці права частина порожня: дослівний фрагмент уроку (ніч 2, П3)
    if (pr.good != null) {
      if (src.good) E(p + '.good', 'у пари вже є «як правильно» в уроці — не перезаписуємо');
      else checkText(p + '.good', pr.good, { max: 400, lesson: pr.good_lesson || n });
    }
    needRule(p + '.rule', pr.rule);
  });
  for (const src of ex.pairs) if (src.good && !pairs.some(pr => pr.i === src.i)) W('pairs', `пара №${src.i} без розбору «чому»`);

  const quotes = Array.isArray(data.quotes) ? data.quotes : [];
  quotes.forEach((qt, i) => {
    const p = `quotes[${i}]`;
    const src = ex.quotes[qt.i];
    if (!src) { E(p + '.i', `немає цитати №${qt.i}`); return; }
    if (!src.strong) checkText(p + '.instead', qt.instead, { max: 400, lesson: qt.instead_lesson || n });
    needRule(p + '.rule', qt.rule);
  });

  const scenes = Array.isArray(data.scenes) ? data.scenes : [];
  scenes.forEach((s, i) => {
    const p = `scenes[${i}]`;
    if (!s.id) E(p + '.id', 'порожньо');
    checkText(p + '.title', s.title, { max: 220 });
    checkText(p + '.client', s.client, { max: 400 });
    const opts = Array.isArray(s.options) ? s.options : [];
    if (opts.length < 2 || opts.length > 3) E(p + '.options', `потрібно 2–3 варіанти, є ${opts.length}`);
    if (opts.filter(o => o.good).length !== 1) E(p + '.options', 'рівно один варіант має бути good:true');
    opts.forEach((o, j) => { checkText(`${p}.options[${j}].text`, o.text, { max: 400, lesson: o.lesson || n }); checkText(`${p}.options[${j}].why`, o.why, { max: 400, lesson: o.lesson || n }); });
    needRule(p + '.rule', s.rule);
    checkText(p + '.practice', s.practice, { max: 400 });
  });

  const terms = Array.isArray(data.terms) ? data.terms : [];
  terms.forEach((t, i) => { checkText(`terms[${i}].term`, t.term, { max: 60 }); checkText(`terms[${i}].def`, t.def, { max: 320 }); });

  return { errors, warnings };
}
