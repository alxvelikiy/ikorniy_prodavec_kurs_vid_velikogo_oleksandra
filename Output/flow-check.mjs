#!/usr/bin/env node
// Перевірка зв'язок Duo ↔ курс (блок 1): заголовки підсумку частини/уроку та інші сценарії по задачах.
// Запуск з кореня worktree після збірки:
//   SITE_OUT=v2/.out-home COURSE_OUT=v2/.out-home-course node v2/build/build.mjs
//   node Output/flow-check.mjs [--out v2/.out-home]
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'v2', 'mvp', 'tests', 'package.json'));
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('out', 'v2/.out-home'));

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
  const f = path.join(OUT, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!f.startsWith(OUT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + srv.address().port;
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };

// новий контекст (порожній localStorage), сторінка з лічильником помилок консолі
async function mk(url, { width = 390, prep = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('ikorka-duo-sound', 'off'); } catch (e) { /* */ } });
  const page = await ctx.newPage(); const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('response', r => { if (r.status() >= 400) errs.push('http ' + r.status() + ' ' + r.url()); });
  await page.goto(base + '/' + url);
  if (prep) { await page.evaluate(prep); await page.reload(); }
  await page.waitForTimeout(300);
  return { ctx, page, errs };
}
const DONE = ids => `(() => { Duo.progress.setOnboarded(); ${JSON.stringify(ids)}.forEach(id => Duo.progress.completeNode(id, { correct: 10, total: 10, mistakes: 0, ms: 60000, perfect: true })); })()`;
// довести відкриту частину до підсумку: порожня черга → finish()
async function finishNode(page) {
  await page.waitForFunction(() => window.Duo && Duo.lesson && Duo.lesson.state && Duo.lesson.state.queue, null, { timeout: 5000 });
  await page.evaluate(() => { const S = Duo.lesson.state; S.queue = []; S.busy = false; Duo.lesson.next(); });
  await page.waitForSelector('#dl-done-title', { timeout: 5000 });
  return page.textContent('#dl-done-title');
}

// ---- 1.1 заголовок підсумку: перша частина — «Частину пройдено!», друга — «Урок пройдено!» ----
{
  console.log('== 1.1 підсумок частини / уроку');
  let { ctx, page, errs } = await mk('vprava.html?n=u01-1');
  ok((await finishNode(page)) === 'Частину пройдено!', 'u01-1 (частина 1 з 2): «Частину пройдено!»');
  ok(errs.length === 0, 'консоль чиста ' + errs.join(';'));
  await ctx.close();
  ({ ctx, page, errs } = await mk('vprava.html?n=u01-2', { prep: DONE(['u01-1']) }));
  ok((await finishNode(page)) === 'Урок пройдено!', 'u01-2 (частина 2 з 2): «Урок пройдено!»');
  ok(errs.length === 0, 'консоль чиста ' + errs.join(';'));
  await ctx.close();
}

// ---- 1.2 підпис частини на шляху: «Урок N · частина i з n», читалка — «Урок N, частина i з n: {назва}, {стан}» ----
{
  console.log('== 1.2 підписи частин на шляху');
  const { ctx, page, errs } = await mk('index.html', { prep: '(() => Duo.progress.setOnboarded())()' });
  const r = await page.evaluate(() => {
    const n = id => document.querySelector('.duo-node[data-id="' + id + '"]');
    const k = id => { const e = n(id).querySelector('.duo-node__kicker'); return e ? e.textContent.replace(/\u00a0/g, ' ') : null; };
    const nodes = [...document.querySelectorAll('.duo-node[data-kind="node"]')];
    return {
      a1: n('u01-1').getAttribute('aria-label'), k1: k('u01-1'),
      a2: n('u02-2').getAttribute('aria-label'), k2: k('u02-2'), k12: k('u12-2'),
      total: nodes.length, withKicker: nodes.filter(e => e.querySelector('.duo-node__kicker')).length,
      oldWord: nodes.some(e => /Вузол|Частина уроку:/.test(e.getAttribute('aria-label')))
    };
  });
  console.log('  ', JSON.stringify(r));
  ok(r.k1 === 'Урок 1 · частина 1 з 2' && r.k2 === 'Урок 2 · частина 2 з 2' && r.k12 === 'Урок 12 · частина 2 з 2', 'кікер «Урок N · частина i з n»');
  ok(r.a1 === 'Урок 1, частина 1 з 2: Перша фраза дзвінка, поточна', 'читалка: поточна частина');
  ok(r.a2 === 'Урок 2, частина 2 з 2: Чотири типи гачка, закрито', 'читалка: закрита частина');
  ok(r.total === 24 && r.withKicker === 24 && !r.oldWord, 'усі 24 частини з кікером, без «Вузол» і наскрізної нумерації');
  ok(errs.length === 0, 'консоль чиста ' + errs.join(';'));
  await ctx.close();
}

// ---- 1.3 профіль: «Уроків пройдено X з 12» = досягнення «Крок за кроком», «Частин пройдено Y з 24» ----
{
  console.log('== 1.3 лічильники профілю');
  // 9 частин: уроки 1–4 повністю (8 частин) + перша частина уроку 5 → 4 уроки
  const ids = ['u01-1', 'u01-2', 'u02-1', 'u02-2', 'u03-1', 'u03-2', 'u04-1', 'u04-2', 'u05-1'];
  const { ctx, page, errs } = await mk('profil.html', { prep: DONE(ids) });
  const r = await page.evaluate(() => {
    const kpi = [...document.querySelectorAll('.mt-kpi')].map(e => ({ l: e.querySelector('.d-stat__label').textContent, v: e.querySelector('.d-stat__value').textContent.replace(/\s+/g, ' ').trim() }));
    const ach = (Duo.progress.achievements() || []).filter(a => a.id === 'course')[0];
    return { kpi, achValue: ach && ach.value };
  });
  console.log('  ', JSON.stringify(r));
  const get = l => (r.kpi.find(k => k.l === l) || {}).v;
  ok(get('Уроків пройдено') === '4 з 12', 'Уроків пройдено 4 з 12');
  ok(get('Частин пройдено') === '9 з 24', 'Частин пройдено 9 з 24');
  ok(r.achValue === 4, 'збігається з досягненням «Крок за кроком» (value ' + r.achValue + ')');
  ok(errs.length === 0, 'консоль чиста ' + errs.join(';'));
  await ctx.close();
}

// ---- 1.4 «Теорія уроку» з плеєра: лист «Точно вийти?» (нова вкладка) і підсумок частини (прогрес уже збережено) ----
{
  console.log('== 1.4 посилання на теорію з плеєра');
  let { ctx, page, errs } = await mk('vprava.html?n=u01-1', { prep: '(() => Duo.progress.setOnboarded())()' });
  await page.waitForSelector('.dl-close'); await page.click('.dl-close'); await page.waitForSelector('.d-sheet .dl-theory');
  const ex = await page.evaluate(() => { const a = document.querySelector('.d-sheet .dl-theory'); return { href: a.getAttribute('href'), target: a.target, rel: a.rel, name: a.textContent, focus: document.activeElement && document.activeElement.textContent.trim() }; });
  console.log('  ', JSON.stringify(ex));
  ok(ex.href === 'urok-01.html' && ex.target === '_blank' && /noopener/.test(ex.rel), 'лист виходу: «Теорія уроку» → urok-01.html у новій вкладці');
  ok(ex.name === 'Теорія уроку (відкриється в новій вкладці)', 'читалка чує про нову вкладку');
  ok(ex.focus === 'Продовжити', 'початковий фокус листа — «Продовжити»');
  const [tab] = await Promise.all([ctx.waitForEvent('page'), page.click('.d-sheet .dl-theory')]);
  await tab.waitForLoadState();
  ok(tab.url().endsWith('/urok-01.html') && page.url().includes('vprava.html?n=u01-1') && (await page.getAttribute('#duo-lesson', 'data-state')) === 'play', 'теорія відкрилась у новій вкладці, частина лишилась відкритою');
  await tab.close();
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const title = await finishNode(page);
  const d = await page.evaluate(() => { const a = document.querySelector('.dl-done .dl-theory'); return { href: a && a.getAttribute('href'), target: a && a.target, done: Duo.progress.isDone('u01-1') }; });
  ok(title === 'Частину пройдено!' && d.href === 'urok-01.html' && !d.target && d.done, 'підсумок: «Теорія уроку» → urok-01.html, частину вже збережено');
  await page.click('.dl-done .dl-theory'); await page.waitForURL(/urok-01\.html$/);
  await page.goto(base + '/index.html'); await page.waitForTimeout(300);
  ok((await page.getAttribute('.duo-node[data-id="u01-1"]', 'data-state')) === 'done', 'після переходу в теорію частина u01-1 пройдена на шляху');
  ok(errs.filter(e => !/urok-01/.test(e)).length === 0, 'консоль чиста ' + errs.join(';'));
  await ctx.close();
  ({ ctx, page, errs } = await mk('vprava.html?mode=mistakes', { prep: "(() => { Duo.progress.setOnboarded(); Duo.progress.recordMistake({ lesson: 1, stepId: 'u01-1-s2', nodeId: 'u01-1' }); })()" }));
  await page.waitForSelector('.dl-close'); await page.click('.dl-close'); await page.waitForSelector('.d-sheet');
  ok(!(await page.$('.d-sheet .dl-theory')), 'повтор помилок: у листі виходу посилання на теорію немає');
  await ctx.close();
}

await browser.close(); srv.close();
console.log(fails ? '\nFAILS: ' + fails : '\nALL OK');
process.exit(fails ? 1 : 0);
