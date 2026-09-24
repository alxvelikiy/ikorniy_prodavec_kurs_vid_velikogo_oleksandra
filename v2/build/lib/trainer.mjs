// MVP-тренажер: дані для window.TRAINER збираються з уроків (v2/text/lessons),
// курованої розмітки (v2/mvp/content/urok_NN.json) і таблиці заперечень компанії
// (x/zaperechennya.docx.txt). Кожен текстовий фрагмент перевіряється дослівно;
// невалідне на сайт не потрапляє, а йде у звіт збірки.
import fs from 'node:fs';
import path from 'node:path';
import {
  V2, LESSON_TITLES, LESSON_DAY, pad2, lessonRaw, normText, isVerbatim, hasShare,
  extractLesson, loadCurated, validateCurated,
} from '../../mvp/tools/content-lib.mjs';

const REPO = path.resolve(V2, '..');
const REDACTIONS = path.join(V2, 'mvp', 'content', 'stats_redactions.json');
const DOCZAP = path.join(REPO, 'x', 'zaperechennya.docx.txt');

// ---------- Частки «N з M»: правки тексту уроку при SHOW_STATS=false ----------
let redactionTable = null;
function loadRedactions() {
  if (!redactionTable) redactionTable = JSON.parse(fs.readFileSync(REDACTIONS, 'utf8')).items;
  return redactionTable;
}
export function applyRedactions(n, raw, report) {
  let out = raw;
  for (const r of loadRedactions().filter(x => x.lesson === n)) {
    if (!out.includes(r.find)) { report && report.errors.push(`stats_redactions: урок ${n} — рядок не знайдено: «${r.find.slice(0, 70)}»`); continue; }
    out = out.split(r.find).join(r.replace);
  }
  return out;
}

// Текст уроку так, як його показує сайт (для перевірки source_ref після правок).
export function displayedLessonRaw(n, showStats) {
  const raw = lessonRaw(n);
  return showStats ? raw : applyRedactions(n, raw, null);
}

const INTERNAL_SRC = /записи|наставник|скрипт компанії|схема допродажу компанії|курс новачка|методичка|дзвінки новачків/i;
const SHARE_NUM = /\d+(?:[.,]\d+)?\s*(?:з|із)\s*\d+/;
// :::stat із часткою і внутрішнім джерелом при SHOW_STATS=false не рендериться.
export function isHiddenStat(fields) {
  const num = fields['число'] || '';
  const src = fields['джерело'] || '';
  return SHARE_NUM.test(num) && INTERNAL_SRC.test(src) && !fields['посилання'];
}
export function isMentorSource(src) { return /наставник|методичка наставника/i.test(src || ''); }

// ---------- Таблиця заперечень компанії (DOC-ZAP) ----------
const DOCZAP_TITLES = {
  'істинне': ['Дорого', 'Немає грошей', 'Є ікра вдома', 'Сумнів у якості (пришла останній раз погана ікра)', 'Жарко, зіпсується'],
  'ситуативне': ['Можна Укрпоштою?', 'Експеримент з кип’ятком', 'Чому така низька ціна?', 'Ненатуральна ікра', 'Овочі'],
  'хибне': ['Ще не на часі', 'Мені не треба', 'Не актуально', 'Я подумаю', 'Треба порадитись', 'Залиште номер — я сам передзвоню', 'Давайте потім', 'А по цьому номеру можна подзвонити?'],
};
export function parseDocZap(report) {
  if (!fs.existsSync(DOCZAP)) { report && report.warnings.push('DOC-ZAP: x/zaperechennya.docx.txt не знайдено — SOS і персони без таблиці заперечень'); return []; }
  const lines = fs.readFileSync(DOCZAP, 'utf8').replace(/\r/g, '').split('\n').map(l => l.trim());
  const all = Object.entries(DOCZAP_TITLES).flatMap(([cat, ts]) => ts.map(t => ({ cat, t })));
  const titleSet = new Set(all.map(x => x.t));
  const skip = /^(ІСТИННІ|СИТУАТИВНІ|ЛОЖНІ) заперечення|^Заперечення$|^Обробка/;
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const hit = all.find(x => x.t === lines[i]);
    if (!hit) continue;
    const ans = [];
    for (let j = i + 1; j < lines.length && !titleSet.has(lines[j]); j++) {
      if (!lines[j] || skip.test(lines[j])) { if (ans.length && skip.test(lines[j])) break; continue; }
      ans.push(lines[j]);
    }
    out.push({ id: 'dz-' + (out.length + 1), cat: hit.cat, obj: hit.t.replace(/\s*\(.*\)$/, ''), script: ans.join(' ').replace(/\s+/g, ' ').trim() });
  }
  if (out.length !== all.length) report && report.warnings.push(`DOC-ZAP: розпізнано ${out.length} з ${all.length} заперечень`);
  return out;
}
// Заперечення DOC-ZAP → фраза «Скажи так» уроку 4 (ключове слово в «ситуації»).
const DOCZAP_TO_SAY = [
  [/^Дорого$/, /«дорого»/], [/^Немає грошей$/, /немає грошей/], [/^Є ікра вдома$/, /залишилась/],
  [/^Сумнів у якості$/, /неякісна/],
];

// ---------- Головне: зібрати window.TRAINER ----------
export function buildTrainerData({ showStats = false, report }) {
  const lessons = [];
  const glossary = [];
  const refLesson = n => ({ l: n });
  const withRef = (n, text) => ({ text, ref: { l: n, q: text } });

  for (let n = 1; n <= 12; n++) {
    const displayed = displayedLessonRaw(n, showStats);
    if (!showStats) applyRedactions(n, lessonRaw(n), report); // лише щоб звіт показав зниклі рядки
    const ex = extractLesson(n, displayed);
    const cur = loadCurated(n);
    let curErrors = [];
    if (!cur) report.warnings.push(`урок ${n}: немає v2/mvp/content/urok_${pad2(n)}.json — лише автоматичні елементи (тест, пари, цитати)`);
    else {
      const v = validateCurated(n, cur, extractLesson(n));
      curErrors = v.errors;
      for (const e of v.errors) report.warnings.push('контент відкинуто: ' + e);
    }
    // елемент курованої розмітки, що має помилку валідації, не використовується
    // (помилки рівня контейнера — «rules: потрібно 3–5» — лише попередження)
    const badPaths = curErrors.map(e => (e.split(' · ')[1] || '').split(': ')[0]);
    const okPath = prefix => !badPaths.some(b => b === prefix || b.startsWith(prefix + '.') || b.startsWith(prefix + '['));
    const C = cur || {};

    const rules = (C.rules || []).map((r, i) => ({ i, ...r })).filter(r => okPath(`rules[${r.i}]`))
      .map(r => ({ code: r.code, text: r.text, section: r.section || '', label: r.label || '', ref: { l: n, q: r.text } }));
    const ruleCodes = new Set(rules.map(r => r.code));
    const rc = code => (code && ruleCodes.has(code) ? code : '');

    const mcqById = new Map(ex.mcq.map(q => [q.num, q]));
    const quizCur = C.quiz || {};
    const quiz = ex.mcq.map(q => {
      const f = quizCur[q.num] && okPath(`quiz.${q.num}`) ? quizCur[q.num] : null;
      return {
        id: `${n}-q${q.num}`, num: q.num, title: q.title, options: q.options, correct: q.correct,
        why: f ? f.why : '', say: f ? f.say : '', rule: f ? rc(f.rule) : '',
        refs: [{ l: n, q: q.title }, ...q.options.map(o => ({ l: n, q: o.text })), ...(f ? [{ l: n, q: f.why }, { l: n, q: f.say }] : [])],
      };
    });
    const attempts = (C.attempts || []).map((a, i) => ({ i, ...a })).filter(a => okPath(`attempts[${a.i}]`) && mcqById.has(String(a.quiz)))
      .map(a => ({ id: `${n}-a${a.i + 1}`, quiz: `${n}-q${a.quiz}`, before: a.before_section, explain: a.explain, rule: rc(a.rule), refs: [{ l: n, q: a.explain }] }));

    const pairCur = new Map((C.pairs || []).map((p, i) => [p.i, { ...p, _k: i }]));
    const pairs = ex.pairs.map(p => {
      const c = pairCur.get(p.i);
      const cOk = c && okPath(`pairs[${c._k}]`);
      const good = p.good || (cOk && c.good) || '';
      const goodL = p.good ? n : (cOk && c.good_lesson) || n;
      return { id: `${n}-p${p.i}`, bad: p.bad, good, why: cOk ? c.why : '', rule: cOk ? rc(c.rule) : '', refs: [{ l: n, q: p.bad }, ...(good ? [{ l: goodL, q: good }] : []), ...(cOk ? [{ l: n, q: c.why }] : [])] };
    });
    const quoteCur = new Map((C.quotes || []).map((q, i) => [q.i, { ...q, _k: i }]));
    // «Сильно чи слабко?» — лише для реплік менеджера; репліки клієнта (урок 3, «хто: Клієнтка») лишаються тільки в тексті уроку
    const quotes = ex.quotes.filter(q => /^менеджер/i.test(String(q.who || 'Менеджер').trim())).map(q => {
      const c = quoteCur.get(q.i);
      const cOk = c && okPath(`quotes[${c._k}]`);
      return { id: `${n}-c${q.i}`, text: q.text, strong: q.strong, why: q.why, instead: cOk && !q.strong ? (c.instead || '') : '', rule: cOk ? rc(c.rule) : '', refs: [{ l: n, q: q.text }, { l: n, q: q.why }, ...(cOk && c.instead ? [{ l: c.instead_lesson || n, q: c.instead }] : [])], insteadLesson: cOk && c.instead_lesson ? c.instead_lesson : n };
    });
    const scenes = (C.scenes || []).map((s, i) => ({ i, ...s })).filter(s => okPath(`scenes[${s.i}]`)).map(s => ({
      id: s.id, lesson: n, title: s.title, client: s.client, rule: rc(s.rule), practice: s.practice,
      options: s.options.map(o => ({ text: o.text, good: !!o.good, why: o.why, ...(o.lesson && o.lesson !== n ? { lesson: o.lesson } : {}) })),
      refs: [{ l: n, q: s.title }, { l: n, q: s.client }, { l: n, q: s.practice }, ...s.options.flatMap(o => [{ l: o.lesson || n, q: o.text }, { l: o.lesson || n, q: o.why }])],
    }));
    for (const t of (C.terms || []).map((t, i) => ({ i, ...t })).filter(t => okPath(`terms[${t.i}]`))) {
      glossary.push({ term: t.term, def: t.def, lesson: n, ref: { l: n, q: t.def } });
    }
    const open = ex.open.map(o => ({ id: `${n}-o${o.num}`, num: o.num, q: o.q, answer: o.answer, refs: [{ l: n, q: o.q }, { l: n, q: o.answer }] }));
    const says = ex.says.map(s => ({ id: `${n}-s${s.i}`, sit: s.sit, say: s.say, why: s.why, keys: s.keys, section: s.section, refs: [{ l: n, q: s.sit }, { l: n, q: s.say }] }));
    const practice = ex.practice.map((p, i) => ({ id: `${n}-pr${i + 1}`, text: p, ref: { l: n, q: p } }));

    lessons.push({
      n, title: LESSON_TITLES[n], day: LESSON_DAY[n], slug: `urok-${pad2(n)}`, href: `urok-${pad2(n)}.html`, subtitle: ex.subtitle,
      h2s: ex.h2s, rules, attempts, quiz, open, pairs, quotes, scenes, says, practice,
    });
  }

  // SOS: заперечення (DOC-ZAP + фрази уроку 4) і шпаргалка етапів (урок 3)
  const dz = parseDocZap(report);
  const l4 = lessons[3];
  const objections = dz.map(o => {
    let say = null;
    if (o.cat === 'хибне') say = l4.says.find(s => /подумаю/.test(s.sit));
    else { const m = DOCZAP_TO_SAY.find(([re]) => re.test(o.obj)); if (m) say = l4.says.find(s => m[1].test(s.sit)); }
    return { id: o.id, cat: o.cat, obj: o.obj, script: o.script, say: say ? { sit: say.sit, text: say.say, why: say.why, ref: { l: 4, q: say.say } } : null };
  });
  const l3raw = displayedLessonRaw(3, showStats);
  const skel = (l3raw.match(/Скелет один: [^\n]*?закриття → робота із запереченнями\./) || [''])[0];
  if (!skel) report.warnings.push('SOS: у уроці 3 не знайдено речення «Скелет один: …»');
  const sos = {
    skeleton: skel ? { text: skel, ref: { l: 3, q: skel } } : null,
    objections,
    says: lessons.flatMap(l => l.says.map(s => ({ ...s, lesson: l.n }))),
  };
  const personas = dz.map(o => ({ id: o.id, cat: o.cat, obj: o.obj }));

  const days = [
    { d: 1, slug: 'den-01', lessons: [1, 2, 3] }, { d: 2, slug: 'den-02', lessons: [4, 5] },
    { d: 3, slug: 'den-03', lessons: [6, 7, 8] }, { d: 4, slug: 'den-04', lessons: [9, 10, 11] }, { d: 5, slug: 'den-05', lessons: [12] },
  ];

  // Симулятор: 12 сцен, по одній з кожного уроку. Перевага — сцени з дослівною реплікою клієнта («…»)
  // і трьома варіантами; однакові репліки клієнта не повторюються.
  const sim = [];
  const seenClient = new Set();
  const nc = s => normText(s).replace(/[^\p{L}\p{N} ]/gu, '').trim();
  for (const l of lessons) {
    const ranked = l.scenes.map((s, i) => ({ s, i, score: (/«/.test(s.client) ? 2 : 0) + (s.options.length === 3 ? 1 : 0) }))
      .sort((a, b) => b.score - a.score || a.i - b.i);
    const pick = ranked.find(x => !seenClient.has(nc(x.s.client))) || ranked[0];
    if (pick) { sim.push(pick.s.id); seenClient.add(nc(pick.s.client)); }
  }
  const data = { v: 1, showStats, lessons, days, glossary, sos, personas, sim };

  // Страховка: жодної частки «N з M» у даних тренажера, коли статистику приховано.
  if (!showStats) {
    const walk = (x, p) => {
      if (typeof x === 'string') { if (hasShare(x)) report.errors.push(`trainer-data: частка в ${p}: «${x.slice(0, 80)}»`); return; }
      if (Array.isArray(x)) x.forEach((v, i) => walk(v, `${p}[${i}]`));
      else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) if (k !== 'ref' && k !== 'refs') walk(v, `${p}.${k}`);
    };
    walk({ lessons, glossary, sos }, 'TRAINER');
  }
  return data;
}

// Для автотесту: чи знайдено кожен source_ref дослівно в уроці (оригінал або показаний сайтом текст).
export function checkRef(ref, showStats) {
  if (!ref || !ref.l || !ref.q) return false;
  if (isVerbatim(ref.l, ref.q)) return true;
  return normText(displayedLessonRaw(ref.l, showStats)).includes(normText(ref.q));
}

export { hasShare, normText };
