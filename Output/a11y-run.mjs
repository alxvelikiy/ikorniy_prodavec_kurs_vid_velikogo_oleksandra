#!/usr/bin/env node
// a11y-прогін плеєра уроку Duo (vprava.html). Запуск з кореня worktree:
//   SITE_OUT=v2/.out-a11y COURSE_OUT=v2/.out-a11y-course node v2/build/build.mjs
//   node Output/a11y-run.mjs [--out v2/.out-a11y] [--shots Output/lab/a11y]
// Що робить: axe-core (wcag2a/aa, 21a/aa, best-practice) на 8 типах кроків (порожній / вибраний / лист «вірно» / лист «невірно»),
// на екранах: підсумок, ?mode=sos, вузли сундука c1..c5, боса b1..b5, лист виходу, «серця закінчились», лист налаштувань сигналів,
// помилка завантаження; у двох темах. Потім клавіатурні перевірки (фокус, пастка, Esc, Tab-порядок, плитки, пари, цифри в полі),
// контраст фокус-рамки/disabled, aria, reduced motion (вібрація/рух), 320 px і текст 200%.
// Код виходу 1, якщо є порушення serious/critical або провалені перевірки. Скріншоти — лише з --shots і тільки на контрольній точці.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'v2', 'mvp', 'tests', 'package.json'));
const { chromium } = require('playwright-core');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'v2/.out-a11y'));
const SHOTS = opt('shots') ? path.resolve(ROOT, opt('shots')) : null;
const ONLY = opt('only');            // 'axe' | 'kbd' | 'motion' | 'zoom'
const want = k => !ONLY || ONLY === k;

/* ---------- статичний сервер ---------- */
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
  const f = path.join(OUT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!f.startsWith(OUT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;

/* ---------- приклади кроків кожного типу (з даних уроків) ---------- */
const STEPS = {};
const ALL_NODES = [];
for (let i = 1; i <= 12; i++) {
  const w = {}; const fn = new Function('window', fs.readFileSync(path.join(OUT, 'data', `duo-u${String(i).padStart(2, '0')}.js`), 'utf8')); fn(w);
  w.DUO_LESSONS[i].nodes.forEach(n => { ALL_NODES.push(n.id); n.steps.forEach(s => { (STEPS[s.type] = STEPS[s.type] || []).push(s); }); });
}
const TYPE_LIST = ['theory', 'choice', 'truefalse', 'fill', 'spot', 'build', 'order', 'match'];
// для build/order/match беремо крок із найбільшою кількістю елементів (складніша розмітка)
function pick(t) {
  const l = STEPS[t];
  const size = s => (s.answer && s.answer.length || 0) + (s.distractors && s.distractors.length || 0) + (s.items && s.items.length || 0) + (s.pairs && s.pairs.length || 0) + (s.lines && s.lines.length || 0) + (s.options && s.options.length || 0);
  return l.slice().sort((a, b) => size(b) - size(a))[0];
}

/* ---------- результати ---------- */
const R = { axe: [], checks: [], notes: [] };
let scans = 0;
const ok = (name, pass, info) => { R.checks.push({ name, pass: !!pass, info: info || '' }); console.log(`${pass ? '  OK ' : '  ПРОВАЛ '} ${name}${info ? ' — ' + info : ''}`); };

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const errs = [];
async function newCtx(theme, o = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, ...o });
  await ctx.addInitScript(th => { try { localStorage.setItem('ikorka-theme', th); } catch (e) { /* */ } }, theme);
  return ctx;
}
async function open(ctx, url) {
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errs.push(url + ': ' + m.text()); });
  page.on('pageerror', e => errs.push(url + ': pageerror ' + e.message));
  await page.goto(base + '/' + url, { waitUntil: 'load' });
  await page.waitForTimeout(350);
  return page;
}
async function scan(page, label, theme) {
  scans++;
  const res = await page.evaluate(async src => {
    if (!window.axe) { const s = document.createElement('script'); s.textContent = src; document.head.appendChild(s); }
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] }, resultTypes: ['violations', 'incomplete'] });
    const slim = v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map(n => n.target.join(' ') + ' :: ' + (n.any[0] && n.any[0].message || n.all[0] && n.all[0].message || n.none[0] && n.none[0].message || '').slice(0, 140)) });
    return { v: r.violations.map(slim), inc: r.incomplete.filter(x => x.id === 'color-contrast').map(slim) };
  }, AXE);
  const bad = res.v.filter(v => v.impact === 'serious' || v.impact === 'critical');
  R.axe.push({ label, theme, bad: bad.length, other: res.v.length - bad.length, detail: res.v });
  console.log(`${bad.length ? '  ✗' : '  ✓'} axe ${label} [${theme}] serious/critical=${bad.length} minor/moderate=${res.v.length - bad.length}${res.inc.length ? ' (contrast incomplete: ' + res.inc[0].nodes.length + '+)' : ''}`);
  for (const v of res.v) console.log(`      ${v.impact} ${v.id}: ${v.help}\n         ${v.nodes.join('\n         ')}`);
}

/* ---------- керування плеєром ---------- */
// підмінити чергу: показати крок step (або кілька) як «поточні»
async function show(page, steps) {
  await page.evaluate(list => {
    const S = Duo.lesson.state; S.dead = false; S.busy = false;
    try { Duo.progress.refillHearts(); } catch (e) { /* */ }
    S.queue = list.map(s => ({ step: s, attempts: 0 }));
    Duo.lesson.next();
  }, Array.isArray(steps) ? steps : [steps]);
  await page.waitForTimeout(120);
}
// відповісти: stage 'partial' — лише початок; 'full' — повністю; wrong — навмисно невірно
async function act(page, step, wrong, stage) {
  await page.evaluate(async ({ step, wrong, stage }) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const card = document.querySelector('.dl-card');
    const all = sel => Array.prototype.slice.call(card.querySelectorAll(sel));
    const txt = b => (b.querySelector('.dl-opt__text') || b).textContent.replace(/\s+/g, ' ').trim();
    const clickTile = t => { const b = all('.dl-bank .d-tile').find(x => x.textContent.trim() === t && x.getAttribute('aria-pressed') !== 'true'); if (b) b.click(); };
    const t = step.type;
    if (t === 'choice') {
      const o = step.options.filter(x => !!x.correct === !wrong)[0]; all('.d-option').find(b => txt(b) === o.text.trim()).click();
    } else if (t === 'truefalse') {
      all('.d-option')[(!!step.answer) === (!wrong) ? 0 : 1].click();
    } else if (t === 'fill') {
      const a = wrong ? step.options.filter(x => x !== step.answer)[0] : step.answer; all('.d-option').find(b => txt(b) === a.trim()).click();
    } else if (t === 'spot') {
      const mg = step.lines.filter(l => l.who === 'manager'); const L = mg.filter(l => !!l.wrong === !wrong)[0] || mg[0];
      all('.d-option').find(b => txt(b).indexOf(L.text.trim()) >= 0).click();
    } else if (t === 'build') {
      if (wrong && step.distractors && step.distractors.length) clickTile(step.distractors[0]);
      else if (wrong) clickTile(step.answer[0]);
      else { const n = stage === 'partial' ? 1 : step.answer.length; const seq = step.answer.slice(0, n); seq.forEach(clickTile); }
    } else if (t === 'order') {
      const seq = wrong ? step.items.slice().reverse() : step.items;
      (stage === 'partial' ? seq.slice(0, 1) : seq).forEach(clickTile);
    } else if (t === 'match') {
      const item = (col, text) => all('.dl-match__col')[col] && Array.prototype.slice.call(all('.dl-match__col')[col].querySelectorAll('button')).find(b => txt(b) === text.trim() && b.getAttribute('aria-disabled') !== 'true');
      const pair = async p => { const l = item(0, p.left), r = item(1, p.right); if (l && r) { l.click(); r.click(); } };
      if (wrong && stage !== 'partial') {
        for (let k = 0; k < 2; k++) { item(0, step.pairs[0].left).click(); item(1, step.pairs[1].right).click(); await sleep(520); }
      }
      const list = stage === 'partial' ? step.pairs.slice(0, 1) : step.pairs;
      for (const p of list) await pair(p);
    }
    await sleep(60);
  }, { step, wrong, stage });
}
async function check(page, step) {
  if (step.type === 'match') { await page.waitForSelector('.dl-sheet:not([hidden])', { timeout: 3000 }); }
  else { await page.click('.dl-primary'); await page.waitForSelector('.dl-sheet:not([hidden])', { timeout: 3000 }); }
  await page.waitForTimeout(450);
}
const phase = page => page.evaluate(() => Duo.lesson && Duo.lesson.state ? Duo.lesson.state.phase : null);

async function seedDone(ctx) {
  const p = await open(ctx, 'vprava.html?n=u01-1');
  await p.evaluate(ids => { ids.forEach(id => Duo.progress.completeNode(id, { correct: 5, total: 5, mistakes: 0, ms: 60000, perfect: true, builds: 1 })); Duo.progress.refillHearts(); }, ALL_NODES);
  return p;
}
// пройти вузол/бос/sos до кінця; wrong — усі відповіді невірні; повертає стан data-state
async function playThrough(page, wrong, hooks = {}) {
  for (let guard = 0; guard < 80; guard++) {
    const st = await page.getAttribute('#duo-lesson', 'data-state');
    if (st !== 'play') return st;
    if (await page.locator('.d-sheet:visible').count()) { if (hooks.onSheet) await hooks.onSheet(); await page.click('.d-sheet .d-btn'); await page.waitForTimeout(400); continue; }
    const step = await page.evaluate(() => Duo.lesson.state.entry && Duo.lesson.state.entry.step);
    if (!step) { await page.waitForTimeout(100); continue; }
    if (step.type === 'theory') { await page.click('.dl-primary'); await page.waitForTimeout(120); continue; }
    await act(page, step, wrong, 'full');
    if (step.type !== 'match') await page.click('.dl-primary');
    await page.waitForSelector('.dl-sheet:not([hidden])', { timeout: 3000 });
    await page.waitForTimeout(250);
    await page.click('.dl-next');
    await page.waitForTimeout(250);
  }
  return 'guard';
}

async function shot(page, name) { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } }

/* =================================================================== */
/* 1. axe                                                              */
/* =================================================================== */
async function axePass(theme) {
  console.log(`\n=== axe · тема ${theme} ===`);
  // свіжий контекст: прогрес порожній
  let ctx = await newCtx(theme);
  let page = await open(ctx, 'vprava.html?n=u01-1');
  await scan(page, 'екран уроку (перший крок)', theme);
  for (const t of TYPE_LIST) {
    const step = pick(t);
    await show(page, step);
    await scan(page, `${t}: порожній`, theme);
    if (t === 'theory') { await shot(page, `theory-${theme}`); continue; }
    await act(page, step, false, 'partial');
    await scan(page, `${t}: вибір/частково`, theme);
    await act(page, step, false, 'full');
    await check(page, step);
    await scan(page, `${t}: лист «вірно»`, theme);
    if (t === 'choice') await shot(page, `choice-ok-${theme}`);
    await show(page, step);
    await act(page, step, true, 'full');
    await check(page, step);
    await scan(page, `${t}: лист «невірно»`, theme);
    if (t === 'build') await shot(page, `build-bad-${theme}`);
    if (await phase(page) !== 'feedback') R.notes.push(`${t}: очікувався feedback`);
  }
  // комбо-бейдж (3 поспіль вірно)
  await show(page, pick('choice'));
  await page.evaluate(() => { const S = Duo.lesson.state; S.combo = 2; });
  await act(page, pick('choice'), false, 'full'); await check(page, pick('choice'));
  await scan(page, 'комбо-бейдж (3 поспіль)', theme);
  // лист виходу
  await show(page, pick('choice'));
  await page.click('.dl-close'); await page.waitForSelector('.d-sheet'); await page.waitForTimeout(450);
  await scan(page, 'лист виходу', theme); await shot(page, `exit-${theme}`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  // лист налаштувань сигналів
  await page.click('.dl-gear'); await page.waitForSelector('.d-sheet'); await page.waitForTimeout(450);
  await scan(page, 'лист налаштувань сигналів (mountSettings)', theme); await shot(page, `settings-${theme}`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  // підсумок уроку: проходимо вузол до кінця, усе вірно
  await page.close();
  page = await open(ctx, 'vprava.html?n=u01-2');
  const end = await playThrough(page, false);
  ok(`підсумок: вузол пройдено без помилок (стан ${end})`, end === 'done');
  await scan(page, 'екран підсумку (вузол)', theme); await shot(page, `done-${theme}`);
  await page.close();
  // помилка завантаження і закрита скринька сундука
  page = await open(ctx, 'vprava.html?n=zz');
  await scan(page, 'помилка: немає вузла', theme);
  await page.close();
  ctx.close();

  // серця закінчились: нульові серця до відкриття уроку
  ctx = await newCtx(theme);
  page = await open(ctx, 'vprava.html?n=u01-1');
  await page.evaluate(() => { for (let i = 0; i < 5; i++) Duo.progress.loseHeart(); });
  await page.close();
  page = await open(ctx, 'vprava.html?n=u01-1');
  await page.waitForSelector('.d-sheet', { timeout: 3000 }); await page.waitForTimeout(450);
  await scan(page, 'лист «Серця закінчились»', theme); await shot(page, `hearts-${theme}`);
  await page.close(); await ctx.close();

  // сундуки: закритий (c1..c5) при порожньому прогресі
  ctx = await newCtx(theme);
  for (const c of ['c1', 'c2', 'c3', 'c4', 'c5']) {
    page = await open(ctx, `vprava.html?n=${c}`);
    await scan(page, `сундук ${c}: закритий`, theme);
    await page.close();
  }
  await ctx.close();

  // прогрес «усе пройдено»: сундуки відкриваються, босси, sos
  ctx = await newCtx(theme);
  await (await seedDone(ctx)).close();
  for (const c of ['c1', 'c2', 'c3', 'c4', 'c5']) {
    page = await open(ctx, `vprava.html?n=${c}`);
    await scan(page, `сундук ${c}: відкрито`, theme);
    if (c === 'c1') await shot(page, `chest-${theme}`);
    await page.close();
  }
  page = await open(ctx, 'vprava.html?n=c1');
  await scan(page, 'сундук c1: уже відкрито (повторно)', theme);
  await page.close();
  for (const b of ['b1', 'b2', 'b3', 'b4', 'b5']) {
    page = await open(ctx, `vprava.html?n=${b}`);
    await scan(page, `бос ${b}: перший крок`, theme);
    if (b === 'b1') {
      const s1 = await playThrough(page, false);
      ok(`бос b1 пройдено (стан ${s1})`, s1 === 'done');
      await scan(page, 'бос b1: «Боса пройдено»', theme);
    }
    if (b === 'b2') {
      let sheetScanned = false;
      const s2 = await playThrough(page, true, { onSheet: async () => { if (!sheetScanned) { sheetScanned = true; await scan(page, 'бос b2: лист «Серця закінчились» посеред серії', theme); } await page.evaluate(() => { }); } });
      await scan(page, 'бос b2: «Ще раз!» (провал)', theme); await shot(page, `boss-fail-${theme}`);
      ok(`бос b2: провал дійшов до екрана «Ще раз!» (стан ${s2})`, s2 === 'done');
    }
    await page.close();
  }
  page = await open(ctx, 'vprava.html?mode=sos');
  await scan(page, 'sos: перший крок (теорія)', theme);
  await shot(page, `sos-${theme}`);
  const sosEnd = await playThrough(page, false);
  ok(`sos пройдено (стан ${sosEnd})`, sosEnd === 'done');
  await scan(page, 'sos: підсумок «Готово!»', theme);
  await page.close(); await ctx.close();
}

/* =================================================================== */
/* 2. клавіатура і фокус                                               */
/* =================================================================== */
const active = page => page.evaluate(() => { const a = document.activeElement; return a ? (a.tagName + '.' + (a.className || '') + '|' + (a.textContent || '').trim().slice(0, 30)) : null; });
async function kbdPass() {
  console.log('\n=== клавіатура, фокус, aria ===');
  const ctx = await newCtx('light', { viewport: { width: 1024, height: 800 } });
  let page = await open(ctx, 'vprava.html?n=u01-1');
  const choice = pick('choice'), tf = pick('truefalse'), build = pick('build'), match = pick('match'), order = pick('order');

  // --- фокус після рендеру кроку: на заголовку ---
  await show(page, [choice, tf]);
  let a = await active(page);
  ok('фокус на початку кроку — на заголовку питання', /^H1\.dl-prompt/.test(a), a);
  // --- Tab-порядок = візуальний ---
  const seq = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    seq.push(await page.evaluate(() => { const a = document.activeElement, r = a.getBoundingClientRect(); return { c: (a.className || '').toString().slice(0, 24), top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width) }; }));
  }
  let orderOk = true, bad = '';
  for (let i = 1; i < seq.length; i++) {
    if (seq[i].c === seq[0].c && seq[i].top === seq[0].top) break; // кільце замкнулось
    if (/duo-page|^$/.test(seq[i].c)) break; // Tab вийшов за сторінку (адресний рядок/документ)
    if (seq[i].top < seq[i - 1].top - 4 || (Math.abs(seq[i].top - seq[i - 1].top) <= 4 && seq[i].left < seq[i - 1].left - 4)) { orderOk = false; bad = `${seq[i - 1].c}(${seq[i - 1].top},${seq[i - 1].left}) → ${seq[i].c}(${seq[i].top},${seq[i].left})`; }
  }
  ok('Tab-порядок збігається з візуальним (choice)', orderOk, bad || seq.slice(0, 7).map(s => s.c.split(' ').pop()).join(' > '));
  // варіанти: roving tabindex — у групі лише один Tab-стоп
  const stops = await page.evaluate(() => Array.prototype.slice.call(document.querySelectorAll('.dl-options .d-option')).filter(b => b.tabIndex === 0).length);
  ok('radiogroup: один Tab-стоп у групі (roving tabindex)', stops === 1, String(stops));
  // стрілки і цифри
  await page.focus('.dl-options .d-option');
  await page.keyboard.press('ArrowDown');
  let chk = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('.dl-options .d-option'), b => b.getAttribute('aria-checked')).join(','));
  ok('стрілка вниз обирає наступний варіант', /^false,true/.test(chk), chk);
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('3');
  chk = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('.dl-options .d-option'), b => b.getAttribute('aria-checked')).join(','));
  ok('цифра 3 обирає третій варіант', /^false,false,true/.test(chk), chk);
  // Enter (фокус не в панелі) → перевірка; фокус на листі результату
  await page.keyboard.press('Enter');
  await page.waitForSelector('.dl-sheet:not([hidden])'); await page.waitForTimeout(200);
  a = await active(page);
  ok('після «Перевірити» фокус на листі результату (кнопка «Далі/Зрозуміло»)', /dl-next/.test(a), a);
  const liveTxt = await page.evaluate(() => new Promise(r => setTimeout(() => r(document.querySelector('.dl-live').textContent), 120)));
  ok('aria-live оголошує результат', /Правильно|Неправильно/.test(liveTxt), liveTxt);
  const sheetRole = await page.evaluate(() => { const s = document.querySelector('.dl-sheet'); return (s.getAttribute('role') || '') + '|' + (s.getAttribute('aria-labelledby') || ''); });
  ok('лист результату — role=group з назвою', /^group\|dl-sheet-t/.test(sheetRole), sheetRole);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  a = await active(page);
  ok('після «Далі» фокус на заголовку наступного кроку', /^H1\.dl-prompt/.test(a), a);
  // цифри не спрацьовують у полі вводу
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'tmp-in'; i.type = 'text'; document.body.appendChild(i); i.focus(); });
  await page.keyboard.press('1');
  chk = await page.evaluate(() => Array.prototype.map.call(document.querySelectorAll('.dl-options .d-option'), b => b.getAttribute('aria-checked')).join(','));
  ok('цифра 1 у полі вводу не обирає варіант', /^false,false/.test(chk), chk);
  await page.evaluate(() => document.getElementById('tmp-in').remove());

  // --- aria: прогрес, серця, хрестик, шестерня ---
  const aria = await page.evaluate(() => ({
    pv: document.querySelector('.dl-progress').getAttribute('aria-valuenow'), pl: document.querySelector('.dl-progress').getAttribute('aria-label'),
    hl: document.querySelector('.dl-hearts').getAttribute('aria-label'), cl: document.querySelector('.dl-close').getAttribute('aria-label'), gl: (document.querySelector('.dl-gear') || {}).getAttribute && document.querySelector('.dl-gear').getAttribute('aria-label'),
    radios: document.querySelectorAll('[role=radiogroup] [role=radio]').length
  }));
  ok('aria: прогрес aria-valuenow, серця/хрестик/шестерня з українським aria-label', aria.pv !== null && /Серця/.test(aria.hl) && /Вийти/.test(aria.cl) && /Налаштування/.test(aria.gl || '') && /Прогрес/.test(aria.pl), JSON.stringify(aria));

  // --- лист виходу: фокус-пастка, Esc, повернення фокуса ---
  await page.focus('.dl-close'); await page.keyboard.press('Enter');
  await page.waitForSelector('.d-sheet'); await page.waitForTimeout(400);
  a = await active(page);
  const inSheet = () => page.evaluate(() => !!document.activeElement.closest('.d-sheet'));
  ok('лист виходу: фокус усередині листа', await inSheet(), a);
  let trapped = true;
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); if (!(await inSheet())) trapped = false; }
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Shift+Tab'); if (!(await inSheet())) trapped = false; }
  ok('лист виходу: фокус-пастка (Tab/Shift+Tab не виходять)', trapped);
  const sheetAttrs = await page.evaluate(() => { const s = document.querySelector('.d-sheet'); return (s.getAttribute('role') || '') + '|' + s.getAttribute('aria-modal') + '|' + (s.getAttribute('aria-labelledby') || s.getAttribute('aria-label') || ''); });
  ok('лист виходу: role=dialog, aria-modal, назва', /^(alert)?dialog\|true\|\S+/.test(sheetAttrs), sheetAttrs);
  await page.keyboard.press('Escape'); await page.waitForTimeout(450);
  a = await active(page);
  ok('Esc закриває лист виходу, фокус повернувся на хрестик', !(await page.locator('.d-sheet').count()) && /dl-close/.test(a), a);

  // --- лист налаштувань: те саме + перемикачі керуються клавіатурою ---
  await page.focus('.dl-gear'); await page.keyboard.press('Enter');
  await page.waitForSelector('.d-sheet'); await page.waitForTimeout(400);
  ok('налаштування: фокус усередині листа', await inSheet());
  trapped = true;
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); if (!(await inSheet())) trapped = false; }
  ok('налаштування: фокус-пастка', trapped);
  const sw = await page.evaluate(() => { const i = document.getElementById('dsig-sound'); return { has: !!i, lab: i && (i.closest('label').textContent || '').trim().slice(0, 40), role: i && i.getAttribute('role') }; });
  ok('налаштування: перемикач «Звук» є і підписаний', sw.has && /Звук/.test(sw.lab || ''), JSON.stringify(sw));
  await page.focus('#dsig-sound'); const before = await page.evaluate(() => document.getElementById('dsig-sound').checked);
  await page.keyboard.press('Space');
  ok('налаштування: Space перемикає «Звук»', (await page.evaluate(() => document.getElementById('dsig-sound').checked)) !== before);
  await page.keyboard.press('Space'); // повернути
  await page.keyboard.press('Escape'); await page.waitForTimeout(450);
  a = await active(page);
  ok('налаштування: Esc, фокус повернувся на шестерню', /dl-gear/.test(a), a);

  // --- Esc поза листами відкриває лист виходу ---
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  ok('Esc на екрані вправи відкриває лист виходу', (await page.locator('.d-sheet').count()) === 1);
  await page.keyboard.press('Escape'); await page.waitForTimeout(450);
  a = await active(page);
  ok('після Esc із листа виходу фокус у вправі (не на <body>)', !/^BODY/.test(a), a);

  // --- плитки build з клавіатури ---
  await show(page, build);
  await page.focus('.dl-bank .d-tile');
  const t0 = await page.evaluate(() => document.activeElement.textContent.trim());
  await page.keyboard.press('Space'); await page.waitForTimeout(350);
  let st = await page.evaluate(() => ({ inAnswer: !!document.activeElement.closest('.dl-answer'), pressed: document.activeElement.getAttribute('aria-pressed'), t: document.activeElement.textContent.trim() }));
  ok('build: Space переносить плитку у відповідь, фокус лишається на ній, aria-pressed=true', st.inAnswer && st.pressed === 'true' && st.t === t0, JSON.stringify(st));
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space'); await page.waitForTimeout(350);
  const cnt = await page.evaluate(() => document.querySelectorAll('.dl-answer .d-tile').length);
  ok('build: стрілка + Space додає другу плитку', cnt === 2, String(cnt));
  await page.keyboard.press('Space'); await page.waitForTimeout(350); // зняти другу
  st = await page.evaluate(() => ({ n: document.querySelectorAll('.dl-answer .d-tile').length, focusInBank: !!document.activeElement.closest('.dl-bank') }));
  ok('build: повторний Space повертає плитку в банк', st.n === 1 && st.focusInBank, JSON.stringify(st));
  // Shift+Tab/Tab: відповідь йде перед банком у DOM; Tab з відповіді → банк
  const dom = await page.evaluate(() => { const a = document.querySelector('.dl-answer'), b = document.querySelector('.dl-bank'); return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); });
  ok('build: у DOM відповідь стоїть перед банком (Tab-порядок = візуальний)', dom);
  const g = await page.evaluate(() => ['.dl-answer', '.dl-bank'].map(s => { const e = document.querySelector(s); return (e.getAttribute('role') || '') + ':' + (e.getAttribute('aria-label') || ''); }).join(' | '));
  ok('build: відповідь і банк — role=group із підписами', /group:\S/.test(g) && g.split('|').every(x => /group:\S/.test(x)), g);

  // --- order: клавіатура ---
  await show(page, order);
  await page.focus('.dl-bank .d-tile'); await page.keyboard.press('Space'); await page.waitForTimeout(350);
  st = await page.evaluate(() => document.querySelectorAll('.dl-answer .d-tile').length);
  ok('order: Space переносить крок у «Твій порядок»', st === 1, String(st));

  // --- match: клавіатура без миші ---
  await show(page, match);
  await page.focus('.dl-match__col:nth-child(1) button');
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  const foc = await page.evaluate(() => ({ col: !!document.activeElement.closest('.dl-match__col:nth-child(2)'), left: document.querySelector('.dl-match__col:nth-child(1) [aria-pressed=true]') ? 1 : 0 }));
  ok('match: Space вибирає елемент лівої колонки, стрілка → переходить у праву', foc.col && foc.left === 1, JSON.stringify(foc));
  // клавіатурою знаходимо правильну пару
  const pairOk = await page.evaluate(async step => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const leftBtn = document.querySelector('.dl-match__col:nth-child(1) [aria-pressed=true]');
    const lt = leftBtn.querySelector('.dl-opt__text').textContent.trim();
    const p = step.pairs.find(x => x.left.trim() === lt);
    const rights = Array.prototype.slice.call(document.querySelectorAll('.dl-match__col:nth-child(2) button'));
    const target = rights.find(b => b.querySelector('.dl-opt__text').textContent.trim() === p.right.trim());
    target.focus(); await sleep(10); return rights.indexOf(target);
  }, match);
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  const solved = await page.evaluate(() => document.querySelectorAll('.dl-match__item.is-correct').length);
  ok('match: Enter на парному елементі зв\'язує пару (2 елементи is-correct + aria-disabled)', solved === 2, `right index ${pairOk}, solved ${solved}`);
  const hasTxt = await page.evaluate(() => { const b = document.querySelector('.dl-match__item.is-correct'); return !!b.querySelector('.dl-match__tag').textContent && /пара/.test(b.textContent); });
  ok('match: зв\'язана пара має номер і текст «пара N» (не лише колір)', hasTxt);

  // --- станы correct/wrong не лише кольором ---
  await show(page, choice); await act(page, choice, true, 'full'); await check(page, choice);
  const icons = await page.evaluate(() => ({ sheetIcon: !!document.querySelector('.dl-sheet__icon svg'), title: document.querySelector('.dl-sheet__title').textContent, ans: !!document.querySelector('.dl-sheet__answer'), markers: document.querySelectorAll('.d-option.is-correct, .d-option.is-wrong').length,
    optIcon: getComputedStyle(document.querySelector('.d-option.is-correct'), '::after').content, optIconWrong: getComputedStyle(document.querySelector('.d-option.is-wrong'), '::after').content }));
  ok('correct/wrong: лист має іконку, заголовок і «Правильна відповідь»; варіанти мають маркер ✓/✕ (не лише колір)', icons.sheetIcon && icons.ans && icons.optIcon.indexOf('✓') >= 0 && icons.optIconWrong.indexOf('✕') >= 0, JSON.stringify(icons));

  // --- контраст: :focus-visible і disabled у двох темах ---
  await page.close(); await ctx.close();
  for (const theme of ['light', 'dark']) {
    const c2 = await newCtx(theme, { viewport: { width: 1024, height: 800 } });
    const p2 = await open(c2, 'vprava.html?n=u01-1');
    await show(p2, build);
    const res = await p2.evaluate(() => {
      const lum = c => { const v = c.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      const parse = s => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { c: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 }; };
      const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
      const bgOf = el => { let e = el; while (e) { const p = parse(getComputedStyle(e).backgroundColor); if (p && p.a > 0.9) return p.c; e = e.parentElement; } return [255, 255, 255]; };
      const out = {};
      const targets = { tile: '.dl-bank .d-tile', close: '.dl-close', gear: '.dl-gear', primary: '.dl-primary' };
      Object.keys(targets).forEach(k => {
        const el = document.querySelector(targets[k]); el.focus({ focusVisible: true });
        const cs = getComputedStyle(el), oc = parse(cs.outlineColor);
        out[k] = { w: cs.outlineWidth, style: cs.outlineStyle, r: oc ? Math.round(ratio(oc.c, bgOf(el.parentElement)) * 100) / 100 : 0, vis: document.activeElement === el && el.matches(':focus-visible') };
      });
      const pr = document.querySelector('.dl-primary'); const cs = getComputedStyle(pr);
      const fg = parse(cs.color), bg = parse(cs.backgroundColor);
      out.disabledBtn = { cls: pr.className.indexOf('is-disabled') >= 0, r: Math.round(ratio(fg.c, bg.c) * 100) / 100 };
      const brd = parse(cs.borderTopColor); out.disabledVsPage = Math.round(ratio(bg.c, bgOf(document.querySelector('.dl-foot'))) * 100) / 100;
      return out;
    });
    const focusOk = ['tile', 'close', 'gear', 'primary'].every(k => res[k].r >= 3 && res[k].style !== 'none' && parseFloat(res[k].w) >= 2);
    ok(`:focus-visible ≥ 3:1 і ≥ 2px [${theme}]`, focusOk, JSON.stringify(res));
    ok(`disabled «Перевірити»: текст ≥ 3:1 [${theme}] (${res.disabledBtn.r}:1)`, res.disabledBtn.cls && res.disabledBtn.r >= 3, `фон кнопки / фон сторінки ${res.disabledVsPage}:1`);
    await p2.close(); await c2.close();
  }
}

/* =================================================================== */
/* 3. reduced motion                                                   */
/* =================================================================== */
async function motionPass() {
  console.log('\n=== reduced motion ===');
  const run = async (reduce) => {
    const ctx = await newCtx('light', { reducedMotion: reduce ? 'reduce' : 'no-preference', hasTouch: true });
    await ctx.addInitScript(() => {
      window.__vib = 0; window.__sig = []; window.__sfx = 0;
      navigator.vibrate = function () { window.__vib++; return true; };
      document.addEventListener('DOMContentLoaded', () => {
        try { Duo.env.on('signal', d => window.__sig.push(d && d.name)); } catch (e) { /* */ }
        try { const p = Duo.sfx.play; Duo.sfx.play = function () { window.__sfx++; return p.apply(this, arguments); }; } catch (e) { /* */ }
      });
    });
    const page = await open(ctx, 'vprava.html?n=u01-1');
    const choice = pick('choice');
    await page.tap('body'); // жест
    const anim = [];
    for (let i = 0; i < 3; i++) {
      await show(page, choice); await act(page, choice, i === 1, 'full'); await page.click('.dl-primary'); await page.waitForSelector('.dl-sheet:not([hidden])');
      await page.waitForTimeout(60);
      anim.push(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length));
      await page.waitForTimeout(400);
    }
    const out = await page.evaluate(() => ({ vib: window.__vib, sig: window.__sig.join(','), sfx: window.__sfx, env: Duo.env.reducedMotion, correct: Duo.lesson.state.correct, mistakes: Duo.lesson.state.mistakes,
      tr: (() => { const f = document.querySelector('.d-progress__fill'); return getComputedStyle(f).transitionDuration; })() }));
    // підсумок: конфетті і count-up
    await page.evaluate(() => { Duo.lesson.state.queue = []; Duo.lesson.next(); });
    await page.waitForTimeout(250);
    const done = await page.evaluate(() => ({ anims: document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.target && !a.effect.target.closest('.dl-done__mascot')).length, canvas: document.querySelectorAll('canvas').length, acc: (document.querySelector('[data-acc]') || {}).textContent }));
    await ctx.close();
    return { ...out, anim, done };
  };
  const rm = await run(true), nm = await run(false);
  console.log('   reduced:', JSON.stringify(rm)); console.log('   normal :', JSON.stringify(nm));
  ok('reduced motion: Duo.env.reducedMotion=true', rm.env === true);
  ok('reduced motion: вібрація не викликається (navigator.vibrate = 0 викликів)', rm.vib === 0, `vibrate=${rm.vib}; у звичайному режимі=${nm.vib}`);
  ok('reduced motion: сигнали і логіка збережені (correct/wrong емітяться, лічильники ростуть)', /correct/.test(rm.sig) && /wrong/.test(rm.sig) && rm.correct === 2 && rm.mistakes === 1, `${rm.sig}; correct=${rm.correct} mistakes=${rm.mistakes}`);
  ok('reduced motion: звук збережено (Duo.sfx.play викликається)', rm.sfx >= 3, `sfx.play=${rm.sfx}`);
  ok('reduced motion: немає запущених WAAPI-анімацій на листі результату', rm.anim.every(n => n === 0), rm.anim.join(','));
  ok('reduced motion: на підсумку немає анімацій/конфетті-canvas', rm.done.anims === 0 && rm.done.canvas === 0, JSON.stringify(rm.done));
}

/* =================================================================== */
/* 4. 320 px, текст 200%                                               */
/* =================================================================== */
async function zoomPass() {
  console.log('\n=== 320 px і текст 200% ===');
  for (const theme of ['light']) for (const scale of [1, 2]) {
    const ctx = await newCtx(theme, { viewport: { width: 320, height: 568 }, hasTouch: true });
    const page = await open(ctx, 'vprava.html?n=u01-1');
    if (scale === 2) await page.evaluate(() => {
      // текстове збільшення ×2: подвоюємо всі --fs-* (у токенах пікселі); тап-зони лишаються
      const cs = getComputedStyle(document.documentElement), rules = [];
      for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) if (r.style) for (const p of r.style) if (/^--fs-/.test(p) && r.selectorText === ':root') rules.push([p, r.style.getPropertyValue(p)]); } catch (e) { /* */ } }
      const st = document.createElement('style'); st.textContent = ':root{' + rules.map(([p, v]) => p + ':calc(' + v.trim() + ' * 2) !important').join(';') + '}'; document.head.appendChild(st);
    });
    const states = [];
    const add = async (name, prep) => { await prep(); await page.waitForTimeout(400); states.push([name, await probe(page)]); };
    for (const t of ['theory', 'choice', 'truefalse', 'fill', 'spot', 'build', 'order', 'match']) {
      const step = pick(t);
      await add(t + ' (вправа)', async () => { await show(page, step); });
      if (t !== 'theory') await add(t + ' (лист «невірно»)', async () => { await act(page, step, true, 'full'); await check(page, step); });
    }
    await add('лист виходу', async () => { await show(page, pick('choice')); await page.click('.dl-close'); await page.waitForSelector('.d-sheet'); });
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    await add('підсумок', async () => { await page.evaluate(() => { Duo.lesson.state.queue = []; Duo.lesson.next(); }); });
    let allOk = true;
    for (const [n, p] of states) {
      if (p.hs > 1 || p.clipped.length || p.unreachable.length) { allOk = false; console.log(`     ✗ ${n}: hscroll=${p.hs} clipped=${JSON.stringify(p.clipped)} unreachable=${JSON.stringify(p.unreachable)}`); }
    }
    ok(`320 px, текст ×${scale}: без горизонтальної прокрутки, обрізання та недосяжних кнопок (${states.length} станів)`, allOk);
    if (SHOTS && scale === 2) await shot(page, 'zoom200-320');
    await page.close(); await ctx.close();
  }
}
function probe(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const hs = document.documentElement.scrollWidth - vw;
    const clipped = [], unreachable = [];
    // горизонтальна прокрутка/обрізання усередині контейнерів
    ['.dl-top', '.dl-stage', '.dl-foot', '.dl-sheet', '.dl-done', '.d-sheet', '.dl-card'].forEach(s => {
      const e = document.querySelector(s); if (e && e.scrollWidth - e.clientWidth > 1) clipped.push(s + ' h-overflow ' + (e.scrollWidth - e.clientWidth));
    });
    document.querySelectorAll('#duo-lesson *, .d-sheet *').forEach(e => {
      if (e.closest('.sr-only, svg') || e.classList.contains('sr-only') || e.closest('[hidden]')) return;
      const r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
      if (r.right > vw + 1 || r.left < -1) clipped.push((e.className || e.tagName).toString().slice(0, 30) + ' r=' + Math.round(r.right));
      const cs = getComputedStyle(e);
      if ((cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis') && e.scrollWidth - e.clientWidth > 1 && e.textContent.trim() && !e.classList.contains('dl-foot')) clipped.push('text-clip ' + (e.className || e.tagName).toString().slice(0, 30));
    });
    // кнопки, що мають бути доступні, повинні бути в області перегляду (або в прокручуваній сцені)
    const must = document.querySelector('.d-sheet .d-btn') ? ['.d-sheet .d-btn'] : document.querySelector('.dl-sheet:not([hidden])') ? ['.dl-next'] : document.querySelector('.dl-done') ? ['.dl-continue'] : ['.dl-primary'];
    must.forEach(s => { const e = document.querySelector(s); if (!e) return unreachable.push(s + ' відсутня'); const r = e.getBoundingClientRect(); if (r.bottom > vh + 1 || r.top < 0) { const sc = e.closest('.d-sheet') || e.closest('.dl-done') && document.getElementById('duo-lesson'); if (!sc || sc.scrollHeight <= sc.clientHeight + 1) unreachable.push(s + ' поза екраном ' + Math.round(r.bottom) + '/' + vh); } });
    const st = document.querySelector('.dl-stage'); if (st && document.querySelector('.dl-card') && st.clientHeight < 60) unreachable.push('сцена стиснута до ' + st.clientHeight + 'px');
    return { hs, clipped: clipped.slice(0, 4), unreachable };
  });
}

try {
  if (want('axe')) for (const theme of ['light', 'dark']) await axePass(theme);
  if (want('kbd')) await kbdPass();
  if (want('motion')) await motionPass();
  if (want('zoom')) await zoomPass();
} finally { await browser.close(); srv.close(); }

const serious = R.axe.reduce((s, r) => s + r.bad, 0), other = R.axe.reduce((s, r) => s + r.other, 0);
const failed = R.checks.filter(c => !c.pass);
console.log(`\n==== ПІДСУМОК ====\naxe: ${scans} сканів, serious/critical = ${serious}, moderate/minor = ${other}`);
console.log(`перевірок: ${R.checks.length}, провалено: ${failed.length}${failed.length ? '\n  ' + failed.map(f => f.name + ' — ' + f.info).join('\n  ') : ''}`);
console.log(`помилок консолі: ${errs.length}${errs.length ? '\n  ' + errs.slice(0, 5).join('\n  ') : ''}`);
if (R.notes.length) console.log('нотатки: ' + R.notes.join('; '));
process.exitCode = serious || failed.length || errs.length ? 1 : 0;
