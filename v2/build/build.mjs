#!/usr/bin/env node
// Ikorka Shop — Агент 6 «Сборщик». Збирає v2/text/**/*.md у v2/course/**/*.html
// у затвердженому стилі (v2/design/mockups.html). Без npm-залежностей.
// Перезапускний: можна ганяти скільки завгодно раз, коли редактор і інші агенти
// дописують v2/text/** та v2/audit/video_map.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseBlocks, groupStats, groupQuiz, slugify, inlineRender, escapeHtml } from './lib/md.mjs';
import { renderBody } from './lib/page.mjs';
import { renderCover, renderCallFlow, renderObjectionTypesCards, renderVideo } from './lib/directives.mjs';
import { videoIconSvg } from './lib/svg.mjs';
import { tokensCss } from './lib/tokens.mjs';

// Сторінки, де вже діє новий патерн уроку (донат Tier-1, сцена в картці з підписом).
// Урок 1 затверджено замовником 2026-09-23 — патерн увімкнено для всіх 12 уроків.
export const REDESIGN_PAGES = new Set(Array.from({ length: 12 }, (_, i) => `urok-${String(i + 1).padStart(2, "0")}`));

// Чи існує v2/text/sos.md — вмикає пункт «SOS: скажи так» у навігації, банер на index
// і саму сторінку sos.html. Виставляється один раз у main() до першого виклику topNav().
let SOS_EXISTS = false;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..'); // .../v2
const TEXT = path.join(ROOT, 'text');
const AUDIT = path.join(ROOT, 'audit');
const OUT = path.join(ROOT, 'course');
const ASSETS_SRC = path.join(__dirname, 'assets');
const SITE = path.join(ROOT, 'site'); // для Netlify / GitHub Pages: не прив'язано до Claude

function read(p) { return fs.readFileSync(p, 'utf8'); }
function exists(p) { return fs.existsSync(p); }
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

// ============================================================
// 1. Курс — порядок проходження (SPEC v2 розділ 3)
// ============================================================
const COURSE_ORDER = [
  { slug: 'vstup', file: path.join(TEXT, 'intro.md'), kind: 'vstup', short: 'Вступ' },
  { slug: 'den-01', file: path.join(TEXT, 'days', 'den_01.md'), kind: 'day', short: 'День 1' },
  { slug: 'urok-01', file: path.join(TEXT, 'lessons', 'urok_01.md'), kind: 'urok', short: 'Урок 1' },
  { slug: 'urok-02', file: path.join(TEXT, 'lessons', 'urok_02.md'), kind: 'urok', short: 'Урок 2' },
  { slug: 'urok-03', file: path.join(TEXT, 'lessons', 'urok_03.md'), kind: 'urok', short: 'Урок 3' },
  { slug: 'den-02', file: path.join(TEXT, 'days', 'den_02.md'), kind: 'day', short: 'День 2' },
  { slug: 'urok-04', file: path.join(TEXT, 'lessons', 'urok_04.md'), kind: 'urok', short: 'Урок 4' },
  { slug: 'urok-05', file: path.join(TEXT, 'lessons', 'urok_05.md'), kind: 'urok', short: 'Урок 5' },
  { slug: 'den-03', file: path.join(TEXT, 'days', 'den_03.md'), kind: 'day', short: 'День 3' },
  { slug: 'urok-06', file: path.join(TEXT, 'lessons', 'urok_06.md'), kind: 'urok', short: 'Урок 6' },
  { slug: 'urok-07', file: path.join(TEXT, 'lessons', 'urok_07.md'), kind: 'urok', short: 'Урок 7' },
  { slug: 'urok-08', file: path.join(TEXT, 'lessons', 'urok_08.md'), kind: 'urok', short: 'Урок 8' },
  { slug: 'den-04', file: path.join(TEXT, 'days', 'den_04.md'), kind: 'day', short: 'День 4' },
  { slug: 'urok-09', file: path.join(TEXT, 'lessons', 'urok_09.md'), kind: 'urok', short: 'Урок 9' },
  { slug: 'urok-10', file: path.join(TEXT, 'lessons', 'urok_10.md'), kind: 'urok', short: 'Урок 10' },
  { slug: 'urok-11', file: path.join(TEXT, 'lessons', 'urok_11.md'), kind: 'urok', short: 'Урок 11' },
  { slug: 'den-05', file: path.join(TEXT, 'days', 'den_05.md'), kind: 'day', short: 'День 5' },
  { slug: 'urok-12', file: path.join(TEXT, 'lessons', 'urok_12.md'), kind: 'urok', short: 'Урок 12' },
  { slug: 'video', file: exists(path.join(TEXT, 'video.md')) ? path.join(TEXT, 'video.md') : null, kind: 'video', short: 'Відео' },
];

const DAY_SLUGS = ['den-01', 'den-02', 'den-03', 'den-04', 'den-05'];

// ============================================================
// 2. video_map.json — гнучкий нормалізатор (формат задає інший агент)
// ============================================================
function loadVideoMap() {
  const p = path.join(AUDIT, 'video_map.json');
  const byLesson = new Map(); // number -> [{title, author, url}]
  if (!exists(p)) return byLesson;
  let raw;
  try { raw = JSON.parse(read(p)); } catch (e) {
    console.warn(`[build] video_map.json є, але не парситься як JSON: ${e.message}`);
    return byLesson;
  }
  function push(lessonNum, entry) {
    if (!lessonNum || !entry) return;
    const n = parseInt(lessonNum, 10);
    if (!n) return;
    const title = entry.title || entry.назва || entry.name || 'Відео';
    const author = entry.author || entry.автор || '';
    const url = entry.url || entry.посилання || entry.link || entry.лінк || '';
    if (!url) return;
    if (!byLesson.has(n)) byLesson.set(n, []);
    byLesson.get(n).push({ title, author, url });
  }
  function lessonNumFromKey(key) {
    const m = String(key).match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const n = entry.lesson || entry.урок || entry.lessonId || lessonNumFromKey(entry.urok || '');
      push(n, entry);
    }
  } else if (raw && typeof raw === 'object') {
    const container = raw.lessons || raw.уроки || raw;
    for (const [key, val] of Object.entries(container)) {
      const n = lessonNumFromKey(key);
      if (!n) continue;
      if (Array.isArray(val)) val.forEach(entry => push(n, entry));
      else push(n, val);
    }
  }
  return byLesson;
}

// ============================================================
// 2b. call_library.json — бібліотека дзвінків (наповнюється партіями,
//     формат: масив {id, title, audio, transcript, outcome, criteria[], objection_type, valence, linked_lesson})
// ============================================================
function loadCallLibrary() {
  const p = path.join(AUDIT, 'call_library.json');
  if (!exists(p)) return [];
  try {
    const raw = JSON.parse(read(p));
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    console.warn(`[build] call_library.json є, але не парситься як JSON: ${e.message}`);
    return [];
  }
}

// ============================================================
// 3. Допоміжні функції побудови сторінки
// ============================================================
function extractHero(blocks) {
  // перший блок — :::cover:::, за ним — # Заголовок (не рендеримо його вдруге — обкладинка вже показує назву)
  let hero = null, rest = blocks;
  if (blocks[0] && blocks[0].kind === 'directive' && blocks[0].type === 'cover') {
    hero = blocks[0].fields;
    rest = blocks.slice(1);
  }
  if (rest[0] && rest[0].kind === 'heading' && rest[0].level === 1) {
    rest = rest.slice(1);
  }
  return { hero, rest };
}

function injectAfterSection(blocks, headingText, rawHtml) {
  const out = [];
  let armed = false;
  for (let idx = 0; idx < blocks.length; idx++) {
    const b = blocks[idx];
    out.push(b);
    if (b.kind === 'heading' && b.text.trim() === headingText) armed = true;
    else if (armed) {
      const next = blocks[idx + 1];
      if (!next || next.kind === 'heading') {
        out.push({ kind: 'rawhtml', html: rawHtml });
        armed = false;
      }
    }
  }
  return out;
}

function hasCardsAbout(blocks, keyword) {
  return blocks.some(b => b.kind === 'directive' && b.type === 'cards' &&
    (b.fields['заголовок'] || '').toLowerCase().includes(keyword));
}

const LESSONS = [
  [1, 'Вступ', 1], [2, 'Гачок', 1], [3, 'Етапи дзвінка', 1],
  [4, 'Робота із запереченнями', 2], [5, 'Заклик до дії', 2],
  [6, 'Персоналізація', 3], [7, 'УТП', 3], [8, 'Альтернатива і спуск', 3],
  [9, 'Впевненість, темп, інтонація, пауза', 4], [10, 'Чистота мови', 4], [11, 'Знання продукту і мети дзвінка', 4],
  [12, 'Підсумок і прощання', 5],
];
const lessonHref = n => `urok-${String(n).padStart(2, '0')}.html`;

// K-критерії — внутрішні ID методички (brief.md розділ 2), новачку показуємо назву навички,
// не код: K03↔урок9, K04↔урок10, K05↔урок3, K09↔урок12, K10↔урок5, K11↔урок4, K12↔урок11 — не 1:1 з номером уроку.
const K_MAP = {
  K01: 1, K02: 2, K03: 9, K04: 10, K05: 3, K06: 6,
  K07: 7, K08: 8, K09: 12, K10: 5, K11: 4, K12: 11,
};
function kLabel(code) {
  const n = K_MAP[code];
  const lesson = n ? LESSONS.find(l => l[0] === n) : null;
  return lesson ? lesson[1] : code;
}

function topNav(activeSlug) {
  const lessonLinks = LESSONS.map(([n, t, d]) => `<a href="${lessonHref(n)}"${activeSlug === 'urok-' + String(n).padStart(2, '0') ? ' class="active"' : ''}><b>${n}</b> ${t}<small>День ${d}</small></a>`).join('');
  const dayLinks = [1, 2, 3, 4, 5].map(d => `<a href="den-0${d}.html"${activeSlug === 'den-0' + d ? ' class="active"' : ''}>День ${d}</a>`).join('');
  const one = (href, label, slug) => `<a href="${href}"${slug === activeSlug ? ' class="active"' : ''}>${label}</a>`;
  const sosLink = SOS_EXISTS ? `<a class="sos-btn${activeSlug === 'sos' ? ' active' : ''}" href="sos.html">SOS: скажи так</a>` : '';
  return `
  <div class="topnav"><div class="topnav-inner">
    <a class="brand" href="index.html"><img class="brand-logo" src="assets/ikorka-logo.png" alt="Ikorka Shop">курс новачка</a>
    <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="Меню розділів">
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    </button>
    <nav id="site-nav">${one('index.html', 'Зміст', 'index')}${sosLink}<details class="navmenu"><summary>Уроки</summary><div class="navmenu-list lessons-menu">${lessonLinks}</div></details><details class="navmenu"><summary>Дні</summary><div class="navmenu-list">${dayLinks}</div></details>${one('video.html', 'Відео', 'video')}${one('dzvinky.html', 'Бібліотека дзвінків', 'dzvinky')}${one('povtorennia.html', 'Повторення', 'povtorennia')}</nav>
    <form class="search-box" role="search"><input type="search" id="course-search" placeholder="Пошук по курсу" aria-label="Пошук по курсу" autocomplete="off"><div class="search-results" hidden></div></form>
    <button type="button" class="theme-btn" aria-pressed="false" aria-label="Темна тема" title="Темна тема"><svg class="ti-moon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg><svg class="ti-sun" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
  </div></div>`;
}

function pageNav(prev, next) {
  const prevHtml = prev
    ? `<a class="prev" href="${prev.slug}.html"><span class="pagenav-label">← Попереднє</span><span class="pagenav-title">${escapeHtml(prev.title)}</span></a>`
    : `<span></span>`;
  const nextHtml = next
    ? `<a class="next" href="${next.slug}.html"><span class="pagenav-label">Наступне →</span><span class="pagenav-title">${escapeHtml(next.title)}</span></a>`
    : `<span></span>`;
  return `<div class="pagenav">${prevHtml}${nextHtml}</div>`;
}

function shellPage({ activeSlug, title, description, heroHtml, bodyHtml, prev, next, pageSlug = '', pageKind = '' }) {
  return `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · Ikorka Shop</title>
${description ? `<meta name="description" content="${escapeHtml(description)}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<script>try{if(localStorage.getItem('ikorka-theme')==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}</script>
<link rel="stylesheet" href="assets/tokens.css">
<link rel="stylesheet" href="assets/style.css">
<link rel="stylesheet" href="assets/theme.css">
<link rel="stylesheet" href="assets/components.css">
</head>
<body>
<div id="page-meta" data-slug="${pageSlug}" data-kind="${pageKind}" hidden></div>
${topNav(activeSlug)}
<div class="page-shell">
<main>
${heroHtml}
<div class="mockup-panel"><div class="lesson">
${bodyHtml}
</div></div>
${pageNav(prev, next)}
</main>
</div>
<footer class="sitefoot">Ikorka Shop · курс новачка · самостійне навчання, 5 днів</footer>
<script src="assets/app.js"></script>
<script src="assets/search-index.js"></script>
<script src="assets/review-data.js"></script>
<script src="assets/course.js"></script>
<script src="assets/ui.js"></script>
<script src="assets/audio.js"></script>
</body>
</html>
`;
}

// ============================================================
// 4. Побудова однієї сторінки уроку/дня/чзв/вступу
// ============================================================
function buildContentPage(entry, videoByLesson, allPages, callsByLesson) {
  const raw = read(entry.file);
  let blocks = parseBlocks(raw);
  const { hero, rest } = extractHero(blocks);
  let body = rest;

  const lessonNum = hero && hero['урок'] ? parseInt(hero['урок'], 10) : null;

  // спецвставки за SPEC 4 (блок-схема «Шлях дзвінка», картки «Три види заперечень»)
  if (entry.slug === 'urok-03') {
    body = injectAfterSection(body, 'Що це', renderCallFlow());
  }
  if (entry.slug === 'den-01') {
    body = injectAfterSection(body, 'Що нового сьогодні', renderCallFlow());
  }
  if (entry.slug === 'urok-04' && !hasCardsAbout(body, 'заперечен')) {
    body = injectAfterSection(body, 'Що це', renderObjectionTypesCards());
  }

  body = groupQuiz(groupStats(body));

  const slugSet = new Set();
  const headings = [];
  const ctx = {
    slugSet, headings,
    pageSlug: entry.slug,
    checklistCounter: { n: 0 },
    videos: lessonNum ? (videoByLesson.get(lessonNum) || []) : [],
    redesign: REDESIGN_PAGES.has(entry.slug),
    sayCards: [],
  };
  // SPEC 4: якщо для уроку немає відео в video_map.json — блок :::video::: повністю не виводиться
  let finalBodyHtml = renderBody(body, ctx);

  const lessonCalls = lessonNum && callsByLesson ? (callsByLesson.get(lessonNum) || []) : [];
  if (lessonCalls.length) {
    const id = slugify('Дзвінки по темі', slugSet);
    headings.push({ level: 2, text: 'Дзвінки по темі', id });
    finalBodyHtml += `<h2 id="${id}">Дзвінки по темі</h2><p class="lesson-body">Реальні звонки, де застосовується саме ця тема — повний список і транскрипти в <a href="dzvinky.html">Бібліотеці дзвінків</a>.</p><div class="call-grid">${lessonCalls.map(callCardHtml).join('')}</div>`;
  }

  const heroHtml = renderCover(hero || {}, entry.kind);

  const title = entry.kind === 'urok'
    ? `Урок ${hero['урок']}. ${hero['назва']}`
    : entry.kind === 'day'
      ? `День ${hero['день']}. ${hero['назва']}`
      : (hero && hero['назва']) || 'Вступ';

  const idx = allPages.findIndex(p => p.slug === entry.slug);
  const prev = idx > 0 ? { slug: allPages[idx - 1].slug, title: allPages[idx - 1].navTitle } : null;
  const next = idx < allPages.length - 1 ? { slug: allPages[idx + 1].slug, title: allPages[idx + 1].navTitle } : null;

  const html = shellPage({
    activeSlug: entry.slug,
    title,
    description: (hero && hero['підзаголовок']) || '',
    heroHtml,
    bodyHtml: finalBodyHtml,
    prev, next,
    pageSlug: entry.slug, pageKind: entry.kind,
  });

  return { html, title, headings, lessonNum, sayCards: ctx.sayCards };
}

// ============================================================
// 5. Сторінка «Відео»
// ============================================================
function buildVideoPage(entry, videoByLesson, allPages) {
  const slugSet = new Set();
  const headings = [];
  const videoSayCards = [];
  let bodyHtml = '';

  if (entry.file && exists(entry.file)) {
    const raw = read(entry.file);
    let blocks = parseBlocks(raw);
    const { hero, rest } = extractHero(blocks);
    const body = groupStats(rest);
    const ctx = { slugSet, headings, pageSlug: 'video', checklistCounter: { n: 0 }, videos: [], sayCards: videoSayCards };
    bodyHtml += renderBody(body, ctx);
  }

  if (videoByLesson.size === 0) {
    bodyHtml += `<h2 id="video-poki-shcho">Відео поки що немає</h2><div class="video-empty">Відео до уроків ще не додані. Ця сторінка автоматично заповниться, щойно з'явиться v2/audit/video_map.json.</div>`;
    headings.push({ level: 2, text: 'Відео поки що немає', id: 'video-poki-shcho' });
  } else {
    const h2id = slugify('Відео за уроками', slugSet);
    bodyHtml += `<h2 id="${h2id}">Відео за уроками</h2>`;
    headings.push({ level: 2, text: 'Відео за уроками', id: h2id });
    const lessonNums = [...videoByLesson.keys()].sort((a, b) => a - b);
    for (const n of lessonNums) {
      const id = slugify(`Урок ${n}`, slugSet);
      bodyHtml += `<h3 id="${id}"><a href="urok-${String(n).padStart(2, '0')}.html">Урок ${n}</a></h3>`;
      headings.push({ level: 3, text: `Урок ${n}`, id });
      bodyHtml += renderVideo({}, videoByLesson.get(n));
    }
  }

  const heroHtml = renderCover(
    { назва: 'Відео курсу', підзаголовок: 'Відео від тренерів до уроків курсу — дивись після уроку, не замість нього', образ: 'екран з відеоплеєром' },
    'course', { eyebrow: 'Ikorka Shop · курс новачка' }
  );

  const idx = allPages.findIndex(p => p.slug === 'video');
  const prev = idx > 0 ? { slug: allPages[idx - 1].slug, title: allPages[idx - 1].navTitle } : null;
  const next = null;

  const html = shellPage({
    activeSlug: 'video', title: 'Відео', description: 'Відео до уроків курсу',
    heroHtml, bodyHtml, prev, next,
  });
  return { html, title: 'Відео', headings, sayCards: videoSayCards };
}

// ============================================================
// 5b. sos.html — «SOS: скажи так» (тільки якщо є v2/text/sos.md)
// ============================================================
function buildSosFilterBar(headings) {
  const cats = headings.filter(h => h.level === 2);
  const chips = cats.map(h => `<button type="button" class="sos-chip" data-cat="${escapeHtml(h.text)}">${escapeHtml(h.text)}</button>`).join('');
  return `
  <div class="mockup-panel"><div class="sos-filterbar">
    <input type="search" id="sos-filter" placeholder="Фільтр карток: ситуація, фраза, ключове слово" aria-label="Фільтр карток SOS" autocomplete="off">
    ${chips ? `<div class="sos-chips">${chips}</div>` : ''}
  </div></div>`;
}

function buildSosPage(file) {
  const raw = read(file);
  const blocks = parseBlocks(raw);
  const { hero, rest } = extractHero(blocks);
  const body = groupStats(rest);

  const slugSet = new Set();
  const headings = [];
  const sayCards = [];
  const ctx = { slugSet, headings, pageSlug: 'sos', checklistCounter: { n: 0 }, videos: [], sayCards };
  const bodyHtml = renderBody(body, ctx);

  const title = (hero && hero['назва']) || 'SOS: скажи так';
  const heroHtml = renderCover(hero || { назва: title }, 'sos') + buildSosFilterBar(headings);

  const html = shellPage({
    activeSlug: 'sos',
    title,
    description: (hero && hero['підзаголовок']) || 'Швидкі підказки: що сказати клієнту прямо зараз у дзвінку',
    heroHtml, bodyHtml,
    prev: null, next: null,
    pageSlug: 'sos', pageKind: 'sos',
  });
  return { html, title, headings, sayCards };
}

// ============================================================
// 5c. dzvinky.html — «Бібліотека дзвінків» (наповнюється з v2/audit/call_library.json)
// ============================================================
function callCardHtml(entry) {
  const valence = (entry.valence || '').toLowerCase();
  const isPositive = valence.startsWith('позитив');
  const tagCls = isPositive ? 'strong' : (valence.startsWith('негатив') ? 'weak' : '');
  const tagText = isPositive ? 'Сильно' : (tagCls === 'weak' ? 'Слабко' : '');
  const criteriaList = entry.criteria || [];
  const criteria = criteriaList.map(k => `<span class="call-k">${escapeHtml(kLabel(k))}</span>`).join('');
  const linkedLesson = entry.linked_lesson || K_MAP[criteriaList[0]] || null;
  const lessonLink = linkedLesson
    ? `<a class="call-lesson" href="${lessonHref(linkedLesson)}">Урок ${escapeHtml(String(linkedLesson))}</a>` : '';
  const audioHtml = entry.audio
    ? `<audio class="call-audio" controls preload="none" src="assets/audio/${escapeHtml(entry.audio)}"></audio>`
    : '';
  const transcriptHtml = entry.transcript
    ? `<details class="reveal"><summary>Показати транскрипт</summary><div class="reveal-body">${inlineRender(entry.transcript)}</div></details>`
    : '';
  return `
  <div class="call-card" data-criteria="${escapeHtml((entry.criteria || []).join(' '))}" data-outcome="${escapeHtml(entry.outcome || '')}">
    <div class="call-card-head">
      ${tagText ? `<span class="quote-tag ${tagCls}">${tagText}</span>` : ''}
      ${entry.outcome ? `<span class="call-outcome">${escapeHtml(entry.outcome)}</span>` : ''}
      ${lessonLink}
    </div>
    <p class="call-title">${inlineRender(entry.title || 'Дзвінок')}</p>
    <div class="call-tags">${criteria}${entry.objection_type ? `<span class="call-k">${escapeHtml(entry.objection_type)}</span>` : ''}</div>
    ${audioHtml}
    ${transcriptHtml}
  </div>`;
}

function buildCallLibraryFilterBar(entries) {
  const allK = [...new Set(entries.flatMap(e => e.criteria || []))].sort();
  const chips = allK.map(k => `<button type="button" class="sos-chip" data-cat="${escapeHtml(k)}">${escapeHtml(kLabel(k))}</button>`).join('');
  return `
  <div class="mockup-panel"><div class="sos-filterbar">
    <input type="search" id="call-filter" placeholder="Фільтр дзвінків: критерій, тип заперечення, слово з транскрипту" aria-label="Фільтр дзвінків" autocomplete="off">
    ${chips ? `<div class="sos-chips">${chips}</div>` : ''}
  </div></div>`;
}

function buildCallLibraryPage(entries) {
  const heroHtml = renderCover(
    { назва: 'Бібліотека дзвінків', підзаголовок: 'Реальні звонки — вдалі й невдалі, з транскриптами і тегами за 12 навичками дзвінка' },
    'course', { eyebrow: 'Ikorka Shop · курс новачка' }
  );

  let bodyHtml;
  if (!entries.length) {
    bodyHtml = `
    <div class="call-empty">
      <p class="lesson-body">Записів поки немає — вони з'являться тут партіями, у міру того як їх передасть керівник. Кожен дзвінок буде позначений навичкою дзвінка, типом заперечення і результатом (замовлення / відмова), так само як приклади в уроках.</p>
    </div>`;
  } else {
    bodyHtml = `<div class="call-grid">${entries.map(callCardHtml).join('')}</div>`;
  }

  const html = shellPage({
    activeSlug: 'dzvinky',
    title: 'Бібліотека дзвінків',
    description: 'Реальні звонки з транскриптами, теговані за 12 навичками дзвінка',
    heroHtml: heroHtml + (entries.length ? buildCallLibraryFilterBar(entries) : ''),
    bodyHtml,
    prev: null, next: null,
    pageSlug: 'dzvinky', pageKind: 'dzvinky',
  });
  return { html, title: 'Бібліотека дзвінків', headings: [] };
}

// ============================================================
// 6. index.html — зміст курсу
// ============================================================
function buildIndexPage(pageMeta) {
  const heroHtml = `
  <div class="mockup-panel"><div class="cover tint-c1 course-cover">
    <span class="cover-eyebrow tag-c1">Ikorka Shop · курс новачка</span>
    <h1 class="cover-title">Курс адаптації.<br><em>5 днів до відділу</em></h1>
    <p class="cover-sub">Самостійне навчання: 12 навичок дзвінка, дзвониш із першого дня, норма — 75 дзвінків на день.</p>
    <div class="cover-plaque"><span>Курс новачка · Ikorka Shop</span><span class="right">5 днів · 12 навичок</span></div>
  </div></div>`;

  // карта днів
  const dayCards = pageMeta.filter(p => p.kind === 'day').map(p => {
    const lessons = p.lessonsOfDay || [];
    return `
    <a class="daycard" href="${p.slug}.html">
      <div class="dn">${p.short}</div>
      <h4>${escapeHtml(p.title.replace(/^День \d+\.\s*/, ''))}</h4>
      <ul>${lessons.map(l => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
    </a>`;
  }).join('');

  // нумерований зміст з якорями на кожен розділ
  let n = 0;
  const tocItems = pageMeta.map(p => {
    n++;
    let c2 = 0, c3 = 0;
    const subLis = [];
    let openSub2 = false;
    for (const h of p.headings) {
      if (h.level === 2) {
        c2++; c3 = 0;
        subLis.push(`<li><span class="toc-num">${n}.${c2}</span> <a href="${p.slug}.html#${h.id}">${escapeHtml(h.text)}</a><ul class="toc-sub2" data-l3></ul></li>`);
      } else if (h.level === 3) {
        c3++;
        const last = subLis.length - 1;
        const li3 = `<li><span class="toc-num">${n}.${c2}.${c3}</span> <a href="${p.slug}.html#${h.id}">${escapeHtml(h.text)}</a></li>`;
        if (last >= 0 && subLis[last].includes('data-l3')) {
          subLis[last] = subLis[last].replace('<ul class="toc-sub2" data-l3></ul>', `<ul class="toc-sub2">${li3}</ul>`);
        } else {
          subLis.push(li3);
        }
      }
    }
    // прибрати порожні data-l3 маркери
    const cleanedSub = subLis.map(s => s.replace(' data-l3', '').replace('<ul class="toc-sub2"></ul>', ''));
    return `
    <li class="toc-page">
      <span class="toc-num">${n}</span> <a href="${p.slug}.html">${escapeHtml(p.title)}</a>
      <ul class="toc-sub">${cleanedSub.join('')}</ul>
    </li>`;
  }).join('');

  const bodyHtml = `
    <h2 id="karta-kursu">Карта курсу</h2>
    <p class="lesson-body">П'ять днів, дванадцять навичок дзвінка. Кожен день — нові уроки, самостійні дзвінки з нормою 75 на день і вечірній саморозбір за чек-листом.</p>
  `;

  const sosBanner = SOS_EXISTS ? `
  <a class="sos-index-banner" href="sos.html">
    <div class="sib-txt"><h3>Не знаєш, що сказати? Відкрий SOS</h3><p>Готові фрази на конкретні ситуації в дзвінку — копіюй і кажи клієнту прямо зараз</p></div>
    <span class="sib-cta">SOS: скажи так →</span>
  </a>` : '';

  const html = `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Курс адаптації Ikorka Shop</title>
<meta name="description" content="Курс адаптації менеджера Ikorka Shop — 5 днів самостійного навчання, 12 навичок дзвінка.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/style.css">
<link rel="stylesheet" href="assets/theme.css">
<link rel="stylesheet" href="assets/components.css">
</head>
<body>
<div id="page-meta" data-slug="index" data-kind="index" hidden></div>
${topNav('index')}
<div class="page-shell">
<main>
${heroHtml}
<div class="mockup-panel"><div class="lesson">
${bodyHtml}
</div></div>
${sosBanner}
<div class="mockup-panel"><div class="lesson">
<h2 id="uroky">Уроки курсу</h2>
<div class="lesson-grid">${LESSONS.map(([n, t, d]) => `<a class="lesson-tile" href="${lessonHref(n)}"><span class="lt-num">${n}</span><span class="lt-name">${t}</span><span class="lt-day">День ${d}</span></a>`).join('')}</div>
</div></div>
<div class="mockup-panel"><div class="lesson howto">
<h2 id="iak-korystuvatysia">Як користуватися курсом</h2>
<div id="course-progress" class="progress-box"></div>
<ol class="howto-steps">
<li><b>Іди по порядку.</b> Вступ → День 1 → уроки дня → День 2 і далі. Кнопка «Наступне» внизу кожної сторінки веде правильним маршрутом.</li>
<li><b>Зранку — уроки дня, решту дня — дзвінки.</b> Урок займає 15–25 хвилин, час читання видно на обкладинці. Норма — 75 дзвінків на день.</li>
<li><b>Увечері — саморозбір.</b> Проходиш чек-лист дня і пишеш собі підсумок 3-2-1. Позначки в чек-листах зберігаються в цьому браузері.</li>
<li><b>Позначай пройдене.</b> Внизу кожного уроку і дня є кнопка «Позначити як пройдене». Так росте прогрес, а за кожен повністю пройдений день відкривається зірка.</li>
<li><b>Слухай, якщо зручніше.</b> Кнопка «Слухати урок» під обкладинкою: браузер читає текст уголос. Пауза, стоп, перемотування і швидкість — у тому ж рядку. Сам звук ніколи не вмикається.</li>
<li><b>Відео дивись кнопкою «Дивитися тут».</b> Кнопка «Закрити відео» повністю вимикає звук. Одночасно грає тільки щось одне.</li>
<li><b>Шукай і повторюй.</b> Поле «Пошук по курсу» вгорі знаходить слово на всіх сторінках. У розділі «Повторення» — картки з питаннями, які повертаються через 2, 7 і 30 днів.</li>
<li><b>Застряг у дзвінку?</b> Відкрий <a href="sos.html">SOS: скажи так</a>: там реальні тупикові ситуації і готова фраза, що сказати.</li>
</ol>
</div></div>
<div class="mockup-panel"><div class="toc-block" style="padding-top:26px;">
<h3 style="padding:0 28px;font-family:'Manrope',sans-serif;font-size:18px;">Дні курсу</h3>
<div class="daymap">${dayCards}</div>
</div></div>
<div class="mockup-panel"><div class="toc-block">
<details class="full-toc">
<summary style="padding:22px 28px;font-family:'Manrope',sans-serif;font-size:18px;cursor:pointer;">Повний зміст і якорі розділів (розгорнути)</summary>
<ol style="list-style:none;margin:0;padding:0 28px 20px;">${tocItems}</ol>
</details>
</div></div>
</main>
</div>
<footer class="sitefoot">Ikorka Shop · курс новачка · самостійне навчання, 5 днів</footer>
<script src="assets/app.js"></script>
<script src="assets/search-index.js"></script>
<script src="assets/review-data.js"></script>
<script src="assets/course.js"></script>
<script src="assets/ui.js"></script>
<script src="assets/audio.js"></script>
</body>
</html>
`;
  return html;
}

// ============================================================
// 7. MAIN
// ============================================================
function main() {
  ensureDir(OUT);
  ensureDir(path.join(OUT, 'assets'));
  for (const f of fs.readdirSync(ASSETS_SRC)) {
    fs.copyFileSync(path.join(ASSETS_SRC, f), path.join(OUT, 'assets', f));
  }
  fs.writeFileSync(path.join(OUT, 'assets', 'tokens.css'), tokensCss(), 'utf8');

  const videoByLesson = loadVideoMap();
  const callLibrary = loadCallLibrary();
  const callsByLesson = new Map();
  for (const c of callLibrary) {
    const n = parseInt(c.linked_lesson, 10);
    if (!n) continue;
    if (!callsByLesson.has(n)) callsByLesson.set(n, []);
    callsByLesson.get(n).push(c);
  }
  fs.rmSync(SITE, { recursive: true, force: true });
  ensureDir(path.join(SITE, 'assets'));

  // SOS-сторінка — опціональна: текст пишуть паралельно, збірка має працювати й без нього.
  const sosPath = path.join(TEXT, 'sos.md');
  const hasSos = exists(sosPath);
  SOS_EXISTS = hasSos;

  // мета для навігації (заголовки визначаємо в 2 проходи: спершу легкий парс cover/H1)
  const navMeta = COURSE_ORDER.map(entry => {
    if (entry.kind === 'video') return { ...entry, navTitle: 'Відео' };
    const raw = read(entry.file);
    const blocks = parseBlocks(raw);
    const { hero } = extractHero(blocks);
    const navTitle = entry.kind === 'urok' ? `Урок ${hero['урок']}. ${hero['назва']}`
      : entry.kind === 'day' ? `День ${hero['день']}. ${hero['назва']}`
        : (hero['назва'] || 'Вступ');
    return { ...entry, navTitle, hero };
  });

  const pageMeta = [];
  const generated = [];
  let allSayCards = [];

  for (const entry of navMeta) {
    if (entry.kind === 'video') {
      const res = buildVideoPage(entry, videoByLesson, navMeta);
      generated.push({ slug: 'video', html: res.html });
      pageMeta.push({ slug: 'video', title: res.title, short: entry.short, kind: 'video', headings: res.headings });
      allSayCards = allSayCards.concat(res.sayCards || []);
      continue;
    }
    const res = buildContentPage(entry, videoByLesson, navMeta, callsByLesson);
    generated.push({ slug: entry.slug, html: res.html });
    pageMeta.push({ slug: entry.slug, title: res.title, short: entry.short, kind: entry.kind, headings: res.headings });
    allSayCards = allSayCards.concat(res.sayCards || []);
  }

  if (hasSos) {
    const sosRes = buildSosPage(sosPath);
    generated.push({ slug: 'sos', html: sosRes.html });
    allSayCards = allSayCards.concat(sosRes.sayCards || []);
  }

  const callsRes = buildCallLibraryPage(callLibrary);
  generated.push({ slug: 'dzvinky', html: callsRes.html });

  // прив'язати уроки до днів для карти днів на index.html
  const dayLessonMap = Object.fromEntries([1, 2, 3, 4, 5].map(d => ['den-0' + d, LESSONS.filter(l => l[2] === d).map(l => `Урок ${l[0]}. ${l[1]}`)]));
  for (const p of pageMeta) if (p.kind === 'day') p.lessonsOfDay = dayLessonMap[p.slug] || [];

  // --- Повторення: картки з блоків «Перевір себе»
  const cards = [];
  for (const e of navMeta.filter(x => x.kind === 'urok')) {
    const md = read(e.file);
    const sec = (md.split(/^## Перевір себе\s*$/m)[1] || '').split(/^## /m)[0];
    const parts = sec.split(/^\*\*(\d+)\.\s*/m).slice(1);
    for (let i = 0; i < parts.length; i += 2) {
      const chunk = parts[i + 1];
      const q = chunk.split('**')[0].trim();
      const lines = chunk.split('**').slice(1).join('**').split('\n').map(l => l.trim()).filter(Boolean);
      const o = lines.filter(l => /^[ABCАВС]\.\s/.test(l));
      const ansLine = lines.find(l => /^(Правильна відповідь|Звір себе):/.test(l)) || '';
      let a = ansLine.replace(/^(Правильна відповідь|Звір себе):\s*/, '');
      if (o.length && /^[ABCАВС]\b/.test(a)) { const opt = o.find(x => x[0] === a[0]); if (opt) a = a + (opt ? ' (' + opt.slice(3) + ')' : ''); }
      if (q && a) cards.push({ id: e.slug + '-' + parts[i], u: e.slug + '.html', l: e.navTitle, q, o, a: a.replace(/\*\*/g, '') });
    }
  }
  fs.writeFileSync(path.join(OUT, 'assets', 'review-data.js'), 'window.REVIEW_CARDS=' + JSON.stringify(cards) + ';', 'utf8');
  const rvHero = renderCover({ назва: 'Повторення', підзаголовок: 'Картки з питаннями з уроків. Те, що знаєш, повертається через 2, 7 і 30 днів; те, що забув, — завтра.', образ: 'чек-лист перевірка' }, 'course', { eyebrow: 'Ikorka Shop · курс новачка' });
  generated.push({ slug: 'povtorennia', html: shellPage({ activeSlug: 'povtorennia', title: 'Повторення', description: 'Картки для повторення', heroHtml: rvHero, bodyHtml: '<div id="review-app" class="review-app"><p>Картки завантажуються…</p></div>', prev: null, next: null, pageSlug: 'povtorennia', pageKind: 'review' }) });

  // --- Пошуковий індекс по всіх сторінках
  const strip = h => h.replace(/<script[\s\S]*?<\/script>|<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  const index = [];
  for (const g of generated) {
    if (g.slug === 'povtorennia') continue;
    const meta = pageMeta.find(p => p.slug === g.slug);
    const main = (g.html.split('<main>')[1] || '').split('</main>')[0];
    const pieces = main.split(/(<h[23] id="[^"]+"[^>]*>[\s\S]*?<\/h[23]>)/);
    const s = [{ id: '', h: '', x: strip(pieces[0]) }];
    for (let i = 1; i < pieces.length; i += 2) {
      const m = pieces[i].match(/id="([^"]+)"/);
      s.push({ id: m[1], h: strip(pieces[i]), x: strip(pieces[i + 1] || '') });
    }
    index.push({ u: g.slug + '.html', t: meta ? meta.title : g.slug, s: s.filter(x => x.x || x.h) });
  }
  const sayIndex = allSayCards.map(c => ({ type: 'say', u: c.u, id: c.id, sit: c.sit, say: c.say, keys: c.keys }));
  const searchIndexSrc = 'window.COURSE_INDEX=' + JSON.stringify(index) + ';\n' +
    'window.COURSE_SAY=' + JSON.stringify(sayIndex) + ';\n' +
    'window.COURSE_HAS_SOS=' + (hasSos ? 'true' : 'false') + ';\n';
  fs.writeFileSync(path.join(OUT, 'assets', 'search-index.js'), searchIndexSrc, 'utf8');

  const indexHtml = buildIndexPage(pageMeta);
  generated.push({ slug: 'index', html: indexHtml });

  for (const g of generated) {
    // Artifact hosting wraps each page in its own doctype/html/head/body skeleton.
    const fragment = g.html
      .replace(/<!DOCTYPE html>\s*/i, '')
      .replace(/<\/?(html|head|body)\b[^>]*>\s*/gi, '')
      .replace(/<meta (charset|name="viewport")[^>]*>\s*/gi, '');
    fs.writeFileSync(path.join(OUT, `${g.slug}.html`), fragment, 'utf8');
    fs.writeFileSync(path.join(SITE, `${g.slug}.html`), g.html, 'utf8');
    fs.cpSync(path.join(OUT, 'assets'), path.join(SITE, 'assets'), { recursive: true });
  }

  // ============================================================
  // 8. Перевірки
  // ============================================================
  const report = { pages: generated.length, errors: [], warnings: [] };

  const expectedSlugs = ['index', ...COURSE_ORDER.map(e => e.slug)];
  for (const s of expectedSlugs) {
    if (!fs.existsSync(path.join(OUT, `${s}.html`))) report.errors.push(`Відсутній файл ${s}.html`);
  }

  const idsByPage = new Map();
  for (const g of generated) {
    const ids = new Set();
    const re = /\sid="([^"]+)"/g;
    let m;
    while ((m = re.exec(g.html))) ids.add(m[1]);
    idsByPage.set(g.slug, ids);
  }

  for (const g of generated) {
    const re = /href="([^"#]+\.html)(#[^"]+)?"/g;
    let m;
    while ((m = re.exec(g.html))) {
      const targetFile = m[1];
      if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(targetFile)) continue; // зовнішні посилання (напр. джерело в :::stat) — не наші сторінки
      const anchor = m[2] ? m[2].slice(1) : null;
      const targetSlug = targetFile.replace(/\.html$/, '');
      if (!idsByPage.has(targetSlug)) {
        report.errors.push(`${g.slug}.html: посилання на неіснуючу сторінку ${targetFile}`);
        continue;
      }
      if (anchor && !idsByPage.get(targetSlug).has(anchor)) {
        report.errors.push(`${g.slug}.html: якір #${anchor} не знайдено на ${targetFile}`);
      }
    }
  }

  for (const g of generated) {
    if (/:::/.test(g.html)) report.errors.push(`${g.slug}.html: залишилась необроблена директива ":::"`);
  }

  const STOPLIST = [
    ['K\\d\\d', /K\d\d/],
    ['К-?\\d\\d', /К-?\d\d/],
    ['ТОП-', /ТОП-/],
    ['ОБ-', /ОБ-/],
    ['ДЛ-', /ДЛ-/],
    ['DOC-', /DOC-/],
    ['@\\d+:\\d\\d', /@\d+:\d\d/],
    ['РИС', /РИС/],
    ['Рис\\.', /Рис\./],
    ['Моя методика', /Моя методика/],
    ['Дополнено', /Дополнено/],
    ['Доповнено', /Доповнено/],
    ['Со слов', /Со слов/],
    ['Зі слів наставника]', /Зі слів наставника\]/],
    ['ВЕТКА', /ВЕТКА/],
    ['гілка <літера>', /[Гг]ілка\s+[A-Za-zА-Яа-яЁёІіЇїЄєҐґ]\b/],
    ['N/M дріб', /\b\d+\/\d+\b/],
    ['🟢', /🟢/], ['🟡', /🟡/], ['⛔', /⛔/], ['📚', /📚/], ['🎧', /🎧/], ['🚫', /🚫/], ['🏋', /🏋/], ['✅', /✅/],
    ['95-140', /95.140/],
    ['100 дзвінк', /\b100 дзвінк/],
    ["обов'язков.. 2", /обов'язков.. 2/],
    ['обов’язков.. 2', /обов’язков.. 2/],
  ];
  let stopHits = 0;
  for (const g of generated) {
    // Перевіряємо лише видимий текст (без тегів/атрибутів) — інакше числа в href/id
    // (напр. urok-04.html, id="k-12") дають хибні збіги стоп-листа.
    const textOnly = strip(g.html);
    for (const [name, re] of STOPLIST) {
      const mm = textOnly.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'));
      if (mm) { stopHits += mm.length; report.errors.push(`${g.slug}.html: стоп-лист «${name}» — ${mm.length} збіг(и)`); }
    }
  }
  report.stopHits = stopHits;

  console.log('=== Ikorka Shop · build звіт ===');
  console.log(`Сторінок згенеровано: ${report.pages} (очікувалось ${expectedSlugs.length})`);
  console.log(`Відео у video_map.json: ${videoByLesson.size ? [...videoByLesson.keys()].sort((a, b) => a - b).join(', ') : 'немає (video_map.json відсутній або порожній)'}`);
  console.log(`Стоп-лист (SPEC розд. 7) збігів у HTML: ${stopHits}`);
  if (report.errors.length) {
    console.log(`\nПОМИЛКИ (${report.errors.length}):`);
    for (const e of report.errors) console.log(' - ' + e);
  } else {
    console.log('\nПомилок і битих посилань не знайдено.');
  }
  console.log('\nГотово: ' + OUT);

  if (report.errors.length) process.exitCode = 1;
}

main();
