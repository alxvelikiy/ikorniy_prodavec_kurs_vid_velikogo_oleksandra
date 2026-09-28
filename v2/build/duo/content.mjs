// Duo-слой: загрузка и валидация упражнений v2/duo/content/urok_NN.json (схема — v2/duo/SCHEMA.md)
// и сборка карты курса (путь: юниты-дни, узлы, сундуки, боссы). Используют: build-duo.mjs (сборка),
// v2/duo/tools/validate-duo.mjs (CLI для агентов), v2/mvp/tests/duo-content.mjs (тест).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isVerbatim, hasShare, normText, pad2, LESSON_TITLES, LESSON_DAY } from '../../mvp/tools/content-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const V2 = path.resolve(__dirname, '..', '..');
export const DUO_CONTENT = path.join(V2, 'duo', 'content');

export const STEP_TYPES = ['theory', 'choice', 'build', 'match', 'order', 'fill', 'spot', 'truefalse'];

// Стоп-лист SPEC v2 §7 (как в build.mjs) — для Duo-текстов тоже.
export const STOPLIST = [
  /K\d\d/, /К-?\d\d/, /ТОП-/, /ОБ-/, /ДЛ-/, /DOC-/, /@\d+:\d\d/, /РИС/, /Рис\./, /Моя методика/, /Дополнено/,
  /Доповнено/, /Со слов/, /Зі слів наставника\]/, /ВЕТКА/, /[Гг]ілка\s+[A-Za-zА-Яа-яЁёІіЇїЄєҐґ]\b/, /\b\d+\/\d+\b/,
  /🟢/, /🟡/, /⛔/, /📚/, /🎧/, /🚫/, /🏋/, /✅/, /95.140/, /\b100 дзвінк/, /обов'язков.. 2/, /обов’язков.. 2/,
];
// Эмодзи в интерфейсе запрещены (иконки — только SVG).
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u;

const digitsOf = s => (String(s || '').match(/\d+(?:[.,]\d+)?/g) || []);
const joinTiles = tiles => tiles.join(' ').replace(/\s+([,.!?:;»…])/g, '$1').replace(/([«])\s+/g, '$1');

// Все проверяемые текстовые поля шага: [путь, значение]
function contentFields(step) {
  const out = [];
  const add = (p, v) => { if (v != null && v !== '') out.push([p, v]); };
  ['text', 'context', 'question', 'answer', 'full', 'before', 'after', 'statement', 'why', 'example'].forEach(k => { if (typeof step[k] === 'string') add(k, step[k]); });
  if (step.type === 'theory') add('title', step.title);
  (step.options || []).forEach((o, i) => {
    if (typeof o === 'string') add(`options.${i}`, o);
    else if (o) { add(`options.${i}.text`, o.text); add(`options.${i}.why`, o.why); }
  });
  (step.pairs || []).forEach((p, i) => { add(`pairs.${i}.left`, p && p.left); add(`pairs.${i}.right`, p && p.right); });
  (step.items || []).forEach((t, i) => add(`items.${i}`, t));
  (Array.isArray(step.answer) ? step.answer : []).forEach((t, i) => add(`answer.${i}`, t));
  (step.distractors || []).forEach((t, i) => add(`distractors.${i}`, t));
  (step.lines || []).forEach((l, i) => add(`lines.${i}.text`, l && l.text));
  return out.filter(([, v]) => typeof v === 'string');
}

// Поле «сгенерировано», если его путь или любой префикс пути перечислен в step.generated.
function isGenerated(step, p) {
  const g = step.generated || [];
  return g.some(x => p === x || p.startsWith(x + '.'));
}

export function validateDuoLesson(n, data) {
  const errors = [], warnings = [], generated = [];
  const E = (p, m) => errors.push(`урок ${n} · ${p}: ${m}`);
  const W = (p, m) => warnings.push(`урок ${n} · ${p}: ${m}`);
  if (!data || typeof data !== 'object') { E('', 'немає JSON-об\'єкта'); return { errors, warnings, generated }; }
  if (data.lesson !== n) E('lesson', `очікувалось ${n}`);
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  if (nodes.length < 1 || nodes.length > 3) E('nodes', `потрібно 1–3 вузли, є ${nodes.length}`);
  const ids = new Set();
  nodes.forEach((node, k) => {
    const np = `nodes[${k}]`;
    const wantId = `u${pad2(n)}-${k + 1}`;
    if (node.id !== wantId) E(np + '.id', `очікувалось ${wantId}, є ${node.id}`);
    if (!node.title || typeof node.title !== 'string') E(np + '.title', 'порожньо');
    else if (node.title.length > 32) W(np + '.title', `задовга назва (${node.title.length} > 32)`);
    const steps = Array.isArray(node.steps) ? node.steps : [];
    if (steps.length < 8 || steps.length > 15) E(np + '.steps', `потрібно 8–15 кроків, є ${steps.length}`);
    if (steps[0] && steps[0].type !== 'theory') W(np + '.steps[0]', 'перший крок має бути theory');
    const kinds = new Set(steps.map(s => s && s.type).filter(t => t && t !== 'theory'));
    if (steps.length >= 8 && kinds.size < 3) W(np, `лише ${kinds.size} типи вправ — бажано ≥ 3`);
    steps.forEach((s, j) => {
      const sp = `${np}.steps[${j}]${s && s.id ? ' (' + s.id + ')' : ''}`;
      if (!s || typeof s !== 'object') { E(sp, 'не об\'єкт'); return; }
      if (!s.id || !new RegExp(`^${wantId}-s\\d+$`).test(s.id)) E(sp + '.id', `формат ${wantId}-sM`);
      if (ids.has(s.id)) E(sp + '.id', 'дубль'); ids.add(s.id);
      if (!STEP_TYPES.includes(s.type)) { E(sp + '.type', `невідомий тип «${s.type}»`); return; }
      if (!['existing', 'generated'].includes(s.source)) E(sp + '.source', 'existing | generated');
      const lessons = Array.isArray(s.lessons) && s.lessons.length ? s.lessons : [n];
      const verb = t => lessons.some(l => isVerbatim(l, t));
      if (s.source === 'generated') {
        if (!Array.isArray(s.generated) || !s.generated.length) E(sp + '.generated', 'для generated — список згенерованих полів');
        if (!Array.isArray(s.refs) || !s.refs.length) E(sp + '.refs', 'для generated — 1–3 дослівні фрагменти-основи');
        if (!s.note) E(sp + '.note', 'для generated — примітка для перевірки');
      } else if (s.generated && s.generated.length) E(sp + '.generated', 'existing-крок не може мати згенерованих полів');
      const refsText = (s.refs || []).join(' ');
      (s.refs || []).forEach((r, i) => { if (!verb(r)) E(`${sp}.refs[${i}]`, `не знайдено дослівно: «${String(r).slice(0, 90)}»`); });
      for (const [p, v] of contentFields(s)) {
        if (hasShare(v)) E(`${sp}.${p}`, `частка «N з M» (прихована на сайті): «${v.slice(0, 80)}»`);
        for (const re of STOPLIST) if (re.test(v)) E(`${sp}.${p}`, `стоп-лист ${re}: «${v.slice(0, 80)}»`);
        if (EMOJI.test(v)) E(`${sp}.${p}`, 'емодзі заборонені');
        if (isGenerated(s, p)) {
          const bad = digitsOf(v).filter(d => !digitsOf(refsText).includes(d));
          if (bad.length) E(`${sp}.${p}`, `вигадані цифри ${bad.join(', ')} (немає в refs)`);
        } else if (!verb(v)) E(`${sp}.${p}`, `не знайдено дослівно в уроці ${lessons.join('/')}: «${v.slice(0, 90)}»`);
      }
      if (typeof s.why === 'string' && s.why.length > 160) W(sp + '.why', `довге «чому» (${s.why.length} > 160)`);
      typeChecks(s, sp, E, W);
      if (s.source === 'generated') generated.push({ lesson: n, node: node.id, id: s.id, type: s.type, fields: s.generated, refs: s.refs, note: s.note, step: s });
    });
  });
  return { errors, warnings, generated };
}

function typeChecks(s, sp, E, W) {
  const uniq = arr => new Set(arr.map(normText)).size === arr.length;
  switch (s.type) {
    case 'theory':
      if (!s.title) E(sp + '.title', 'порожньо');
      if (!s.text) E(sp + '.text', 'порожньо');
      else if (s.text.length > 420) E(sp + '.text', `не влазить в один екран (${s.text.length} > 420)`);
      break;
    case 'choice': {
      const o = s.options || [];
      if (o.length < 2 || o.length > 4) E(sp + '.options', `2–4 варіанти, є ${o.length}`);
      if (o.filter(x => x && x.correct === true).length !== 1) E(sp + '.options', 'рівно один correct: true');
      if (!uniq(o.map(x => (x && x.text) || ''))) E(sp + '.options', 'однакові тексти');
      if (!s.why && !o.some(x => x && x.why)) W(sp + '.why', 'немає пояснення «чому»');
      break;
    }
    case 'build': {
      const a = Array.isArray(s.answer) ? s.answer : [];
      if (a.length < 3 || a.length > 10) E(sp + '.answer', `3–10 плиток, є ${a.length}`);
      if (a.some(t => String(t).trim().split(/\s+/).length > 4)) W(sp + '.answer', 'плитка довша за 4 слова');
      if (!s.full) E(sp + '.full', 'порожньо');
      else if (normText(joinTiles(a)).replace(/[«»"]/g, '') !== normText(s.full).replace(/[«»"]/g, '')) E(sp + '.answer', `плитки не складаються у full: «${joinTiles(a).slice(0, 80)}»`);
      const d = s.distractors || [];
      if (d.length > 4) E(sp + '.distractors', '0–4');
      if (d.some(x => a.map(normText).includes(normText(x)))) E(sp + '.distractors', 'дистрактор збігається з плиткою відповіді');
      break;
    }
    case 'match': {
      const p = s.pairs || [];
      if (p.length < 3 || p.length > 5) E(sp + '.pairs', `3–5 пар, є ${p.length}`);
      if (!uniq(p.map(x => (x && x.left) || '')) || !uniq(p.map(x => (x && x.right) || ''))) E(sp + '.pairs', 'ліві й праві мають бути унікальні');
      if (p.some(x => x && ((x.left || '').length > 90 || (x.right || '').length > 90))) W(sp + '.pairs', 'довше 90 символів — не влізе в плитку');
      break;
    }
    case 'order': {
      const it = s.items || [];
      if (it.length < 3 || it.length > 7) E(sp + '.items', `3–7 кроків, є ${it.length}`);
      if (!uniq(it)) E(sp + '.items', 'однакові кроки');
      break;
    }
    case 'fill': {
      const o = (s.options || []).map(x => (typeof x === 'string' ? x : (x && x.text) || ''));
      if (o.length < 3 || o.length > 4) E(sp + '.options', `3–4 варіанти, є ${o.length}`);
      if (!s.answer || !o.map(normText).includes(normText(s.answer))) E(sp + '.answer', 'відповідь має бути серед options');
      if (!uniq(o)) E(sp + '.options', 'однакові варіанти');
      if (s.full && normText(`${s.before || ''} ${s.answer || ''} ${s.after || ''}`) !== normText(s.full)) E(sp + '.full', 'before + answer + after ≠ full');
      break;
    }
    case 'spot': {
      const l = s.lines || [];
      if (l.length < 3 || l.length > 6) E(sp + '.lines', `3–6 реплік, є ${l.length}`);
      const w = l.filter(x => x && x.wrong);
      if (w.length !== 1) E(sp + '.lines', 'рівно одна wrong: true');
      else if (w[0].who !== 'manager') E(sp + '.lines', 'помилкова репліка має належати менеджеру');
      if (l.some(x => x && !['client', 'manager'].includes(x.who))) E(sp + '.lines', 'who: client | manager');
      if (!s.why) E(sp + '.why', 'порожньо');
      break;
    }
    case 'truefalse':
      if (typeof s.answer !== 'boolean') E(sp + '.answer', 'true | false');
      if (!s.statement) E(sp + '.statement', 'порожньо');
      if (s.answer === false && !isGenerated(s, 'statement') && s.source !== 'generated') W(sp + '.statement', 'хибне твердження дослівно з уроку? перевір');
      if (!s.why) E(sp + '.why', 'порожньо');
      break;
    default: break;
  }
}

export function loadDuoLesson(n) {
  const p = path.join(DUO_CONTENT, `urok_${pad2(n)}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Все уроки: { lessons: {n: data}, errors, warnings, generated }. Урок без файла — предупреждение
// (путь покажет его узлы как «скоро»), урок с ошибками — не попадает на сайт.
export function loadDuoContent() {
  const lessons = {}, errors = [], warnings = [], generated = [];
  for (let n = 1; n <= 12; n++) {
    let data = null;
    try { data = loadDuoLesson(n); } catch (e) { errors.push(`урок ${n}: JSON не парситься — ${e.message}`); continue; }
    if (!data) { warnings.push(`урок ${n}: немає v2/duo/content/urok_${pad2(n)}.json`); continue; }
    const v = validateDuoLesson(n, data);
    errors.push(...v.errors); warnings.push(...v.warnings); generated.push(...v.generated);
    if (!v.errors.length) lessons[n] = data;
  }
  return { lessons, errors, warnings, generated };
}

// Карта курса для пути. course.json задаёт юниты (дни), сундуки и боссов; узлы уроков — из контента.
export function compileCourse(lessons, courseSpec) {
  const units = courseSpec.units.map(u => {
    const items = [];
    for (const n of u.lessons) {
      const data = lessons[n];
      const nodes = data ? data.nodes : [];
      nodes.forEach((node, i) => {
        items.push({ kind: 'node', id: node.id, lesson: n, idx: i + 1, of: nodes.length, title: node.title, steps: node.steps.length });
        const chest = (u.chests || []).find(c => c.after === node.id);
        if (chest) items.push({ kind: 'chest', id: chest.id, after: node.id });
      });
    }
    if (u.boss) items.push({ kind: 'boss', id: u.boss.id, title: u.boss.title, persona: u.boss.persona, lessons: u.lessons });
    return { n: u.n, day: u.day, title: `День ${u.day}`, topic: u.lessons.map(n => LESSON_TITLES[n]).join(' · '), color: u.n, cheat: `shpargalka.html#den-${u.day}`, lessons: u.lessons, items };
  });
  const lessonMap = {};
  for (let n = 1; n <= 12; n++) {
    lessonMap[n] = { title: LESSON_TITLES[n], day: LESSON_DAY[n], href: `urok-${pad2(n)}.html`, nodes: lessons[n] ? lessons[n].nodes.map(x => x.id) : [] };
  }
  return { v: 1, units, lessons: lessonMap };
}
