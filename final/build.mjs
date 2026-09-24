// Детерминированная сборка курса из a3/*.md, design/svg/*.svg и design/figdata.mjs.
// Текст переносится дословно: скрипт только разбирает markdown и раскладывает по макету.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import FIG from '../design/figdata.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const N_DAYS = 5;
const ROOT = path.resolve(HERE, '..');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n?/g, '\n');
const pad = n => String(n).padStart(2, '0');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FIGNO = '';
const FIGTOTAL = '';

// ---------- inline ----------
function linkTarget(u) {
  const m = u.match(/^(?:\.\/)?(?:lesson_(K\d{2})|day_(\d{2})|(intro|gaps))\.md(?:#.*)?$/);
  if (!m) return u;
  if (m[1]) return '#lesson-' + m[1];
  if (m[2]) return '#day-' + m[2];
  return '#' + m[3];
}

function inline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return '' + (codes.length - 1) + ''; });
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => '<a href="' + linkTarget(u) + '">' + t + '</a>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[(Моя методика|Дополнено)([^\]]*)\]/g, (_, a, b) => {
    const cls = a === 'Дополнено' ? 'tag-ext' : (/документ/.test(b) ? 'tag-doc' : 'tag-own');
    return '<span class="tag ' + cls + '">' + a + b + '</span>';
  });
  s = s.replace(/\(((?:ТОП|ОБ-|ДЛ-|DOC-)[^()]*)\)/g, '<span class="src">($1)</span>');
  s = s.replace(/(\d+)/g, (_, i) => '<code>' + esc(codes[+i]) + '</code>');
  return s;
}

// ---------- blocks ----------
const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const HR_RE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const isSep = l => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const isHead = l => /^#{1,6}\s/.test(l);

function renderList(items) {
  let html = '';
  const st = [];
  const open = it => {
    st.push({ ind: it.ind, tag: it.ord ? 'ol' : 'ul' });
    return it.ord ? '<ol' + (it.num > 1 ? ' start="' + it.num + '"' : '') + '>' : '<ul>';
  };
  for (const it of items) {
    if (!st.length) html += open(it);
    else if (it.ind > st[st.length - 1].ind) { html = html.replace(/<\/li>$/, ''); html += open(it); }
    else while (st.length > 1 && it.ind < st[st.length - 1].ind) html += '</' + st.pop().tag + '></li>';
    const cb = it.text.match(/^\[( |x|X)\]\s+([\s\S]*)$/);
    const txt = (cb ? cb[2] : it.text).split('\n').map(inline).join('<br>');
    html += cb
      ? '<li class="cbi"><label class="cb"><input type="checkbox"' + (cb[1] !== ' ' ? ' checked' : '') + '><span>' + txt + '</span></label></li>'
      : '<li>' + txt + '</li>';
  }
  while (st.length) html += '</' + st.pop().tag + '>' + (st.length ? '</li>' : '');
  return html;
}

function renderBlocks(md, shift) {
  const L = md.split('\n');
  const out = [];
  let i = 0;
  while (i < L.length) {
    const l = L[i];
    if (!l.trim()) { i++; continue; }
    if (/^```/.test(l)) {
      const b = []; i++;
      while (i < L.length && !/^```/.test(L[i])) b.push(L[i++]);
      i++;
      out.push('<pre><code>' + esc(b.join('\n')) + '</code></pre>');
      continue;
    }
    const h = l.match(/^(#{1,6})\s+(.*)$/);
    if (h) { const lv = Math.min(6, h[1].length + shift); out.push('<h' + lv + '>' + inline(h[2]) + '</h' + lv + '>'); i++; continue; }
    if (HR_RE.test(l)) { out.push('<hr>'); i++; continue; }
    if (/^\s*\|/.test(l) && i + 1 < L.length && isSep(L[i + 1])) {
      const cells = r => r.trim().replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());
      const head = cells(l); i += 2;
      const rows = [];
      while (i < L.length && /^\s*\|/.test(L[i])) rows.push(cells(L[i++]));
      out.push('<div class="tw"><table><thead><tr>' + head.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' +
        rows.map(r => '<tr>' + r.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
      continue;
    }
    if (/^\s*>/.test(l)) {
      const b = [];
      while (i < L.length && /^\s*>/.test(L[i])) b.push(L[i++].replace(/^\s*>\s?/, ''));
      out.push('<blockquote>' + renderBlocks(b.join('\n'), shift) + '</blockquote>');
      continue;
    }
    if (LIST_RE.test(l)) {
      const items = [];
      while (i < L.length) {
        const x = L[i];
        if (!x.trim()) {
          let j = i + 1;
          while (j < L.length && !L[j].trim()) j++;
          if (j < L.length && LIST_RE.test(L[j])) { i = j; continue; }
          break;
        }
        const mm = x.match(LIST_RE);
        if (mm) { items.push({ ind: mm[1].replace(/\t/g, '  ').length, ord: /\d/.test(mm[2]), num: parseInt(mm[2], 10) || 1, text: mm[3] }); i++; }
        else if (/^\s+\S/.test(x)) { items[items.length - 1].text += '\n' + x.trim(); i++; }
        else break;
      }
      out.push(renderList(items));
      continue;
    }
    // абзац: первая строка уже не подошла ни под один другой блок
    const b = [L[i++]];
    while (i < L.length && L[i].trim() && !isHead(L[i]) && !/^\s*[|>]/.test(L[i]) && !LIST_RE.test(L[i]) && !/^```/.test(L[i]) && !HR_RE.test(L[i])) b.push(L[i++]);
    const sv = b.join('\n').match(/^\*\*Сверься:?\*\*:?\s*([\s\S]*)$/);
    if (sv) out.push('<details class="check"><summary>Сверься</summary><div class="ans">' + sv[1].split('\n').map(inline).join('<br>') + '</div></details>');
    else out.push('<p>' + b.map(inline).join('<br>') + '</p>');
  }
  return out.join('\n');
}

// ---------- sections ----------
const KIND = [['⚠', 'warn'], ['⛔', 'gap'], ['🎧', 'audio'], ['📚', 'src'], ['✅', 'test'], ['🚫', 'err'], ['🏋', 'practice'], ['🟡', 'what']];

function splitSections(md) {
  const parts = [];
  let cur = { head: null, body: [] };
  let fence = false;
  for (const l of md.split('\n')) {
    if (/^```/.test(l)) fence = !fence;
    if (!fence && /^##\s/.test(l)) { parts.push(cur); cur = { head: l.replace(/^##\s+/, ''), body: [] }; }
    else cur.body.push(l);
  }
  parts.push(cur);
  return parts;
}

function renderSection(p, before) {
  const kind = (KIND.find(([e]) => p.head.startsWith(e)) || [null, 'plain'])[1];
  return (before || '') + '<section class="blk blk-' + kind + '"><h4 class="blk-h">' + inline(p.head) +
    '</h4><div class="blk-body">' + renderBlocks(p.body.join('\n'), 2) + '</div></section>\n';
}

function parsePre(lines) {
  let i = 0;
  const meta = [];
  let title = null;
  while (i < lines.length && !lines[i].trim()) i++;
  if (i < lines.length && /^#\s/.test(lines[i])) title = lines[i++].replace(/^#\s+/, '');
  while (i < lines.length && !lines[i].trim()) i++;
  while (i < lines.length && /^\s*>/.test(lines[i])) meta.push(lines[i++].replace(/^\s*>\s?/, ''));
  return { title, meta: meta.join(' '), rest: lines.slice(i).join('\n') };
}

// ---------- журнальные рисунки ----------
function jf(id, title, body, source, note) {
  return '<figure class="jf"' + (id ? ' id="' + id + '"' : '') + '><figcaption class="jf-cap"><span class="jf-no">Рис. ' + FIGNO + '</span>' + inline(title) + '</figcaption>' +
    body + (note ? '<p class="jf-note">' + inline(note) + '</p>' : '') + (source ? '<p class="jf-src">' + inline(source) + '</p>' : '') + '</figure>\n';
}

function fig(file, id, title, source) {
  const f = rd('design/svg/' + file).replace(/@import\s+url\([^)]*\)\s*;?/g, '');
  return jf(id, title, '<div class="fig">' + f + '</div>', source);
}

function bBars(rows, total) {
  const axis = '<div class="jb-row jb-axis" aria-hidden="true"><div class="jb-l"></div><div class="jb-ticks"><span>0</span><span>' + Math.round(total / 2) + '</span><span>' + total + '</span></div><div class="jb-v"></div></div>';
  return '<div class="jb">' + rows.map(([l, v, f]) =>
    '<div class="jb-row' + (f ? ' jb-' + f : '') + '"><div class="jb-l">' + inline(l) + '</div><div class="jb-track"><div class="jb-bar" style="width:' + (v / total * 100).toFixed(1) + '%"></div></div><div class="jb-v">' + v + '/' + total + '</div></div>').join('') + axis + '</div>';
}

function bChain(steps, plus) {
  return '<ol class="jc' + (plus ? ' plus' : '') + '">' + steps.map(s => (typeof s === 'string' ? { t: s } : s)).map(s =>
    '<li class="jc-step' + (s.opt ? ' jc-opt' : '') + (s.acc ? ' jc-acc' : '') + '"><span class="jc-t">' + inline(s.t) + '</span>' + (s.s ? '<span class="jc-s">' + inline(s.s) + '</span>' : '') + '</li>').join('') + '</ol>';
}

function bMap(rows, pairs) {
  return '<div class="jm' + (pairs ? ' pairs' : '') + '">' + rows.map(([a, b, f]) =>
    '<div class="jm-row' + (f ? ' jm-' + f : '') + '"><div class="jm-a">' + inline(a) + '</div><div class="jm-arr" aria-hidden="true">→</div><div class="jm-b">' + inline(b) + '</div></div>').join('') + '</div>';
}

function bScales(rows) {
  const cells = '<div class="js-cells" aria-hidden="true">' + Array.from({ length: 10 }, (_, i) => '<span>' + (i + 1) + '</span>').join('') + '</div>';
  return '<div class="js">' + rows.map(([l, n]) => '<div class="js-row"><div class="js-l">' + inline(l) + '</div>' + cells + (n ? '<div class="js-n">' + inline(n) + '</div>' : '') + '</div>').join('') + '</div>';
}

function bCols(cols) {
  return '<div class="jk">' + cols.map(c => '<div><p class="jk-h">' + inline(c.h) + '</p>' + bChain(c.steps) + (c.note ? '<p class="jf-note">' + inline(c.note) + '</p>' : '') + '</div>').join('') + '</div>';
}

function bStack(parts, total) {
  const sum = parts.reduce((a, p) => a + p[1], 0) || 1;
  const base = total || sum;
  return '<div class="jt" role="img" aria-label="' + esc(parts.map(p => p[0] + ': ' + p[1]).join(', ')) + '">' +
    parts.filter(p => p[1] > 0).map(([, v, c]) => '<div class="' + c + '" style="flex:' + v + ' 1 0">' + (v / base >= 0.12 ? v : '') + '</div>').join('') + '</div>' +
    '<ul class="jt-leg">' + parts.map(([l, v, c]) => '<li><i class="' + c + '"></i>' + inline(l) + ' — ' + v + '</li>').join('') + '</ul>';
}

function bRange(zones) {
  return '<div class="jr" role="img" aria-label="' + esc(zones.map(z => z[2] + ': ' + z[0] + '–' + z[1] + '%').join('; ')) + '">' +
    zones.map(([a, b, , c]) => '<div class="jr-z ' + c + '" style="left:' + a + '%;width:' + (b - a) + '%">' + a + '–' + b + '%</div>').join('') + '</div>' +
    '<div class="jr-ax" aria-hidden="true"><span>0%</span><span>50%</span><span>100%</span></div>' +
    '<ul class="jt-leg">' + zones.map(([, , l, c]) => '<li><i class="' + c + '"></i>' + inline(l) + '</li>').join('') + '</ul>';
}

function renderFigBlock(b) {
  switch (b.type) {
    case 'chain': return bChain(b.steps, b.plus);
    case 'map': return bMap(b.rows, b.pairs);
    case 'scales': return bScales(b.rows);
    case 'cols': return bCols(b.cols);
    case 'stack': return bStack(b.parts, b.total);
    case 'range': return bRange(b.zones);
    case 'label': return '<p class="jk-h">' + inline(b.text) + '</p>';
    default: throw new Error('неизвестный тип блока рисунка: ' + b.type);
  }
}

const figFromSpec = (spec, id) => jf(id, spec.title, spec.blocks.map(renderFigBlock).join(''), spec.source, spec.note);
const hm = m => (m >= 60 ? Math.floor(m / 60) + ' ч' + (m % 60 ? ' ' + (m % 60) + ' мин' : '') : m + ' мин');

function dayTimeline(n, body) {
  const rows = [];
  for (const l of body) {
    const m = l.match(/^\|\s*(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})\s*\|\s*([^|]+?)\s*\|/);
    if (!m) continue;
    const min = (+m[3] * 60 + +m[4]) - (+m[1] * 60 + +m[2]);
    const what = m[5];
    const kind = /^звонки/i.test(what) ? 'calls' : /саморазбор|самопровер|итог|сравнени/i.test(what) ? 'review' : /обед/i.test(what) ? 'lunch' : 'study';
    rows.push({ from: m[1] + ':' + m[2], to: m[3] + ':' + m[4], min, kind, what });
  }
  if (!rows.length) return '';
  const tot = k => rows.filter(r => r.kind === k).reduce((a, r) => a + r.min, 0);
  const all = rows.reduce((a, r) => a + r.min, 0);
  const names = { calls: 'Звонки', study: 'Подготовка, уроки, отработка вслух', review: 'Саморазбор и итог', lunch: 'Обед' };
  const bar = '<div class="jl" role="img" aria-label="' + esc(rows.map(r => r.from + '–' + r.to + ' ' + names[r.kind]).join('; ')) + '">' +
    rows.map(r => '<div class="' + r.kind + '" style="flex:' + r.min + ' 1 0" title="' + esc(r.from + '–' + r.to + ' · ' + r.what) + '"></div>').join('') + '</div>' +
    '<div class="jl-ax" aria-hidden="true"><span>' + rows[0].from + '</span><span>' + rows[rows.length - 1].to + '</span></div>';
  const leg = '<ul class="jt-leg">' + ['calls', 'study', 'review', 'lunch'].filter(k => tot(k)).map(k => '<li><i class="' + k + '"></i>' + names[k] + ' — ' + hm(tot(k)) + '</li>').join('') + '</ul>';
  return jf('fig-day-' + pad(n), 'Как устроен день ' + n + ': ' + hm(tot('calls')) + ' на звонки из ' + hm(all), bar + leg, 'Источник: план дня ' + n + ' этого курса');
}

function evidence(key, meta, srcText) {
  const own = (srcText.match(/\[Моя методика(?!\s*·\s*только)[^\]]*\]/g) || []).length;
  const doc = (srcText.match(/\[Моя методика\s*·\s*только в документах\]/g) || []).length;
  const ext = (srcText.match(/\[Дополнено\]/g) || []).length;
  const all = own + doc + ext;
  const st = (meta.match(/статус доказательности\s*(\S+)/) || [])[1] || '';
  return jf('fig-ev-' + key, 'На чём стоит урок: ' + own + ' из ' + all + ' приёмов — из звонков и записей обучения',
    bStack([['[Моя методика]', own, 'p0'], ['[Моя методика · только в документах]', doc, 'p1'], ['[Дополнено]', ext, 'pe']], all),
    'Источник: метки в блоке 📚 этого урока · статус доказательности ' + st);
}

// ---------- units ----------
function renderUnit(kind, n) {
  const isLesson = kind === 'lesson';
  const key = isLesson ? 'K' + pad(n) : pad(n);
  const file = isLesson ? 'a3/lesson_' + key + '.md' : 'a3/day_' + key + '.md';
  const parts = splitSections(rd(file));
  const pre = parsePre(parts[0].body);
  const tm = isLesson
    ? (pre.title || '').match(/^Урок\s+\d+\.\s*(.+?)\s*·\s*K\d{2}\s*$/)
    : (pre.title || '').match(/^День\s+\d+\.\s*(.+)$/);
  const name = tm ? tm[1] : (pre.title || key);
  const id = isLesson ? 'lesson-' + key : 'day-' + key;
  let html = '<article class="unit ' + kind + '" id="' + id + '">' +
    '<div class="sticky-tag"><span>' + (isLesson ? 'Урок ' + pad(n) + ' / 12' : 'День ' + pad(n) + ' / ' + pad(N_DAYS)) + '</span><span>' +
    (isLesson ? key : 'Норма 75 звонков') + '</span></div>' +
    '<header class="unit-head"><div class="big-num" aria-hidden="true">' + pad(n) + '</div><div><h3>' + inline(name) + '</h3>' +
    (pre.meta ? '<p class="meta">' + inline(pre.meta) + '</p>' : '') + '</div></header>\n';
  if (pre.rest.trim()) html += '<div class="lede">' + renderBlocks(pre.rest, 2) + '</div>\n';

  const spec = isLesson ? (FIG.lessons[key] || {}) : {};
  if (isLesson) {
    const srcPart = parts.find(p => p.head && p.head.startsWith('📚'));
    html += evidence(key, pre.meta, srcPart ? srcPart.body.join('\n') : '');
  }
  let tree = false;
  for (const p of parts.slice(1)) {
    let before = '';
    let after = '';
    if (isLesson && p.head.startsWith('📚')) {
      if (spec.schema) before += figFromSpec(spec.schema, 'fig-schema-' + key);
      if (spec.freq) after += jf('fig-freq-' + key, spec.freq.title, bBars(spec.freq.rows, spec.freq.total || 26), spec.freq.source, spec.freq.note);
      (spec.extra || []).forEach((x, i) => { after += figFromSpec(x, 'fig-extra-' + key + '-' + (i + 1)); });
    }
    if (key === 'K11' && !tree && p.head.startsWith('🎧')) {
      before += fig('objections_tree.svg', 'fig-objections', 'Дерево возражений: первая развилка — момент, вторая — тип возражения', 'Источник: урок 11 · эталонные звонки и записи обучения');
      tree = true;
    }
    if (!isLesson && /^План дня/.test(p.head)) after += dayTimeline(n, p.body);
    html += renderSection(p, before) + after;
  }
  return { html: html + '</article>\n', name };
}

function renderPart(file, id, no, title) {
  const parts = splitSections(rd(file));
  const pre = parsePre(parts[0].body);
  let html = '<section class="part" id="' + id + '"><header class="part-head"><span class="part-no">' + no + '</span><h2>' + inline(title) + '</h2></header>\n';
  if (pre.meta) html += '<p class="meta">' + inline(pre.meta) + '</p>';
  if (pre.rest.trim()) html += '<div class="lede">' + renderBlocks(pre.rest, 2) + '</div>\n';
  for (const p of parts.slice(1)) html += renderSection(p);
  return html;
}

// ---------- assemble HTML (номера рисунков расставляются после сборки, в порядке чтения) ----------
const intro = renderPart('a3/intro.md', 'intro', '00', 'Как пользоваться курсом') +
  fig('criteria_map.svg', 'fig-criteria', 'Карта 12 критериев: статус доказательности и день, в который критерий вводится', 'Источник: сводная таблица методолога и план курса') +
  fig('call_path.svg', 'fig-call', 'Путь звонка: этапы, критерии и доля эталонных звонков, где этап звучит', 'Источник: 26 эталонных звонков (ТОП)') + '</section>\n';

const progressFig = fig('progress_' + N_DAYS + '.svg', 'fig-progress', 'Пять дней курса: какие критерии вводятся и сколько их в работе к концу дня', 'Источник: план курса');
const days = Array.from({ length: N_DAYS }, (_, i) => renderUnit('day', i + 1));
const lessons = Array.from({ length: 12 }, (_, i) => renderUnit('lesson', i + 1));

const tocList = (arr, pre) => arr.map((u, i) => '<li><a href="#' + pre + (pre === 'lesson-' ? 'K' + pad(i + 1) : pad(i + 1)) + '"><span class="n">' + (pre === 'lesson-' ? 'K' + pad(i + 1) : pad(i + 1)) + '</span>' + inline(u.name) + '</a></li>').join('');

const hero =
  '<header class="hero">' +
  '<p class="kicker">Ikorka Shop · отдел постоянных клиентов · рабочая версия (RU)</p>' +
  '<h1><span>' + N_DAYS + ' дней</span><span><span class="x">×</span>12 критериев</span></h1>' +
  '<p class="hero-lede">Курс адаптации менеджера: реактивация и допродажа постоянным клиентам по телефону. Учишься сам: звонишь с первого дня и каждый вечер разбираешь свои звонки по чек-листу.</p>' +
  '<dl class="facts"><div><dt>Дней</dt><dd>' + N_DAYS + '</dd></div><div><dt>Уроков</dt><dd>12</dd></div><div><dt>Звонков в день</dt><dd>75</dd></div><div><dt>Рисунков</dt><dd>' + FIGTOTAL + '</dd></div></dl>' +
  '</header>\n';

const toc =
  '<nav class="toc" aria-label="Содержание">' +
  '<div class="toc-col"><p class="toc-h">00 · Старт</p><ol><li><a href="#intro">Как пользоваться курсом</a></li><li><a href="#fig-criteria">Карта 12 критериев</a></li><li><a href="#fig-call">Путь звонка</a></li></ol></div>' +
  '<div class="toc-col"><p class="toc-h">01 · ' + N_DAYS + ' дней</p><ol>' + tocList(days, 'day-') + '</ol></div>' +
  '<div class="toc-col"><p class="toc-h">02 · 12 уроков</p><ol>' + tocList(lessons, 'lesson-') + '</ol></div>' +
  '<div class="toc-col"><p class="toc-h">03 · Финал</p><ol><li><a href="#gaps">Честные пробелы</a></li><li><a href="#legend">Как читать метки источников</a></li></ol></div>' +
  '</nav>\n';

const daysPart =
  '<section class="part" id="days"><header class="part-head"><span class="part-no">01</span><h2>' + N_DAYS + ' дней</h2></header>' +
  '<p class="part-lede">Каждый день — цель, план по часам, вопросы для саморазбора и чек-лист. Уроки открываются по ссылкам.</p>' +
  progressFig + days.map(d => d.html).join('') + '</section>\n';

const lessonsPart =
  '<section class="part" id="lessons"><header class="part-head"><span class="part-no">02</span><h2>12 уроков</h2></header>' +
  '<p class="part-lede">Каждый урок построен одинаково: что это, почему работает, как звучит в звонке, ошибки, практика, самопроверка.</p>' +
  lessons.map(l => l.html).join('') + '</section>\n';

const gapsPart = renderPart('a3/gaps.md', 'gaps', '03', 'Честные пробелы') + '</section>\n';

const LEGEND_ROWS = [
  ['ТОП-01…26', 'Эталонные звонки. М1…М7 — коды менеджеров'],
  ['ОБ-RU01…13 / ОБ-UA01…15', 'Записи обучения: русская и украинская расшифровка. После @ — таймкод'],
  ['ДЛ-…', 'Реальные звонки новичков и рядовых менеджеров внутри записей обучения'],
  ['DOC-KURS / DOC-MET / DOC-ARH', 'Курс новичка, методичка наставника, реестр материалов наставника'],
];
const legend =
  '<section class="part" id="legend"><header class="part-head"><span class="part-no">04</span><h2>Метки источников</h2></header>' +
  '<section class="blk blk-plain"><h4 class="blk-h">Метки</h4><div class="blk-body">' +
  '<p><span class="tag tag-own">Моя методика</span> приём встречается в наших звонках или записях обучения. Название из внешней методики, если оно есть, только объясняет то, что менеджеры уже делают.</p>' +
  '<p><span class="tag tag-doc">Моя методика · только в документах</span> приём записан в документах компании, но в звонках не встречен.</p>' +
  '<p><span class="tag tag-ext">Дополнено</span> внешняя техника, которой в наших материалах нет. Добавлена, чтобы закрыть пробел, и честно помечена.</p>' +
  '</div></section>' +
  '<section class="blk blk-plain"><h4 class="blk-h">Коды</h4><div class="blk-body"><div class="tw"><table><thead><tr><th>Код</th><th>Что это</th></tr></thead><tbody>' +
  LEGEND_ROWS.map(([a, b]) => '<tr><td><code>' + esc(a) + '</code></td><td>' + esc(b) + '</td></tr>').join('') +
  '</tbody></table></div><p>Статус доказательности: 🟢 сильная база, 🟡 средняя, ⛔ пробел.</p></div></section></section>\n';

const css = fs.readFileSync(path.join(HERE, 'style.css'), 'utf8');
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link href="https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wdth,wght@8..144,25..151,100..1000&family=Martian+Mono:wdth,wght@75..112.5,100..800&display=swap" rel="stylesheet">';

const pageRaw =
  '<title>Курс адаптации Ikorka Shop</title>\n' + FONTS + '\n<style>\n' + css + '\n</style>\n' +
  '<div class="readbar" aria-hidden="true"></div>\n<main class="wrap" lang="ru">\n' +
  hero + toc + intro + daysPart + lessonsPart + gapsPart + legend +
  '<footer class="foot"><span>Ikorka Shop · курс адаптации менеджера</span><span>Рабочая версия на русском · итоговая публикация на украинском</span></footer>\n</main>\n';

let figCount = 0;
const page = pageRaw.replace(new RegExp(FIGNO, 'g'), () => String(++figCount)).replace(new RegExp(FIGTOTAL, 'g'), () => String(figCount));

fs.mkdirSync(path.join(ROOT, 'final'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'final/course.html'), page);
fs.writeFileSync(path.join(ROOT, 'design/course_preview.html'),
  '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>\n' + page + '</body></html>\n');

// ---------- assemble Markdown для переводчика ----------
const md = [];
md.push('# Курс адаптации менеджера Ikorka Shop\n\nРабочая версия на русском языке для перевода на украинский. Норма — 75 звонков в день.');
md.push(rd('a3/intro.md').trim());
md.push('[ДИАГРАММА: Карта 12 критериев — design/svg/criteria_map.svg]\n\n[ДИАГРАММА: Путь звонка — design/svg/call_path.svg]');
md.push('# ' + N_DAYS + ' дней\n\n[ДИАГРАММА: Прогресс по ' + N_DAYS + ' дням — design/svg/progress_' + N_DAYS + '.svg]');
for (let i = 1; i <= N_DAYS; i++) md.push(rd('a3/day_' + pad(i) + '.md').trim());
md.push('# 12 уроков');
for (let i = 1; i <= 12; i++) {
  let t = rd('a3/lesson_K' + pad(i) + '.md').trim();
  if (i === 11) t = t.replace(/^## 🎧/m, '[ДИАГРАММА: Дерево возражений — design/svg/objections_tree.svg]\n\n## 🎧');
  md.push(t);
}
md.push(rd('a3/gaps.md').trim());
md.push('# Метки источников\n\n- **[Моя методика]** — приём встречается в наших звонках или записях обучения. Название из внешней методики, если оно есть, только объясняет то, что менеджеры уже делают.\n- **[Моя методика · только в документах]** — приём записан в документах компании, но в звонках не встречен.\n- **[Дополнено]** — внешняя техника, которой в наших материалах нет. Добавлена, чтобы закрыть пробел, и честно помечена.\n\n| Код | Что это |\n|---|---|\n' +
  LEGEND_ROWS.map(([a, b]) => '| `' + a + '` | ' + b + ' |').join('\n') + '\n\nСтатус доказательности: 🟢 сильная база, 🟡 средняя, ⛔ пробел.');

// все подписи и надписи рисунков уроков — их тоже нужно перевести
const figText = [];
const pushTxt = s => { if (s) figText.push(s); };
const stepTxt = s => (typeof s === 'string' ? s : s.t + (s.s ? ' — ' + s.s : ''));
for (const [k, spec] of Object.entries(FIG.lessons)) {
  for (const f of [spec.schema, ...(spec.extra || [])].filter(Boolean)) {
    pushTxt('\n**' + k + ' · ' + f.title + '**');
    for (const b of f.blocks) {
      if (b.steps) b.steps.forEach(s => pushTxt('- ' + stepTxt(s)));
      if (b.rows) b.rows.forEach(r => pushTxt('- ' + r.filter(x => typeof x === 'string' && !/^(risk|err)$/.test(x)).join(' → ')));
      if (b.cols) b.cols.forEach(c => { pushTxt('- ' + c.h + ': ' + c.steps.map(stepTxt).join(' → ')); pushTxt(c.note && '  ' + c.note); });
      if (b.parts) b.parts.forEach(p => pushTxt('- ' + p[0]));
      if (b.zones) b.zones.forEach(z => pushTxt('- ' + z[2]));
      if (b.text) pushTxt('- ' + b.text);
    }
    pushTxt(f.note); pushTxt(f.source);
  }
  if (spec.freq) { pushTxt('\n**' + k + ' · ' + spec.freq.title + '**'); spec.freq.rows.forEach(r => pushTxt('- ' + r[0])); pushTxt(spec.freq.note); pushTxt(spec.freq.source); }
}
md.push('# Подписи рисунков (для перевода)\n\nНумерация рисунков в документе автоматическая. Ниже — подписи и надписи схем и графиков уроков. Подписи таймлайнов дней и шаблонные фразы («На чём стоит урок», «Как устроен день», «Источник: …») задаются в сборщике `final/build.mjs`.\n' + figText.join('\n'));
fs.writeFileSync(path.join(ROOT, 'final/course.md'), md.join('\n\n---\n\n') + '\n');

// ---------- проверки ----------
const allIds = [...page.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const ids = new Set(allIds);
const hrefs = [...page.matchAll(/href="#([^"]+)"/g)].map(m => m[1]);
const broken = [...new Set(hrefs.filter(h => !ids.has(h)))];
const dupIds = [...new Set(allIds.filter((v, i, a) => a.indexOf(v) !== i))];
const extLinks = [...page.matchAll(/href="([^"#][^"]*)"/g)].map(m => m[1]).filter(h => !/^https:\/\/fonts\./.test(h));
const count = re => (page.match(re) || []).length;
console.log('course.html  ' + (Buffer.byteLength(page) / 1024).toFixed(1) + ' KB');
console.log('course.md    ' + (fs.statSync(path.join(ROOT, 'final/course.md')).size / 1024).toFixed(1) + ' KB');
console.log('дней: ' + count(/class="unit day"/g) + ', уроков: ' + count(/class="unit lesson"/g) + ', рисунков: ' + figCount +
  ' (частоты ' + count(/id="fig-freq-/g) + ', схемы ' + count(/id="fig-schema-/g) + ', доп. ' + count(/id="fig-extra-/g) + ', таймлайны ' + count(/id="fig-day-/g) + ', «на чём стоит» ' + count(/id="fig-ev-/g) + ')');
console.log('блоков ⚠: ' + count(/class="blk blk-warn"/g) + ', ⛔: ' + count(/class="blk blk-gap"/g) + ', «Сверься»: ' + count(/<details class="check">/g) + ', чекбоксов: ' + count(/type="checkbox"/g));
console.log('битых якорей: ' + (broken.length ? broken.join(', ') : 'нет') + ' · повторяющихся id: ' + (dupIds.length ? dupIds.join(', ') : 'нет'));
console.log('внешних/файловых ссылок (не шрифты): ' + (extLinks.length ? extLinks.join(', ') : 'нет'));
console.log('title в первых 8KB: ' + (page.slice(0, 8192).includes('<title>') ? 'да' : 'нет') + ' · остатки markdown: ' + count(/\*\*|\]\(/g) + ' · неподставленных номеров: ' + count(/[]/g));
