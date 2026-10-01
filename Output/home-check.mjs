#!/usr/bin/env node
// Перевірка головної Duo (index.html). Запуск з кореня worktree після збірки:
//   SITE_OUT=v2/.out-home COURSE_OUT=v2/.out-home-course node v2/build/build.mjs
//   node Output/home-check.mjs [--shots v2/duo/lab/shots-home] [--only scen]
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'v2', 'mvp', 'tests', 'package.json'));
const { chromium } = require('playwright-core');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, 'v2/.out-home');
const SHOTS = opt('shots') ? path.resolve(ROOT, opt('shots')) : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

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
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

let fails = 0;
const failed = [];
const ok = (c, m) => { if (!c) { fails++; failed.push(m); console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };

// ---- вага JS сторінки (gzip) ----
{
  const html = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  let tot = 0, mine = 0;
  for (const s of srcs) {
    const b = fs.readFileSync(path.join(OUT, s)); const g = zlib.gzipSync(b, { level: 9 }).length; tot += g;
    if (/path\.js|shell\.js/.test(s)) mine += g;
  }
  console.log(`JS index.html: ${srcs.length} файлів, ${(tot / 1024).toFixed(1)} KB gzip; path+shell ${(mine / 1024).toFixed(1)} KB`);
  ok(tot <= 80 * 1024, 'JS ≤ 80 KB gzip'); ok(mine <= 15 * 1024, 'path+shell ≤ 15 KB gzip');
}

async function mk({ width = 390, theme = 'light', reduced = false, prep = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 360 ? 640 : width < 600 ? 844 : 900 }, deviceScaleFactor: width < 600 ? 2 : 1, hasTouch: width < 600, isMobile: width < 600, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(th => { try { if (!sessionStorage.getItem('__dev')) { sessionStorage.setItem('__dev', '1'); localStorage.setItem('ikorka-theme', th); localStorage.setItem('ikorka-duo-sound', 'off'); } } catch (e) {} }, theme);
  const page = await ctx.newPage(); const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('response', r => { if (r.status() >= 400) errs.push('http ' + r.status() + ' ' + r.url()); });
  await page.goto(base + '/index.html');
  if (prep) { await page.evaluate(prep); await page.reload(); }
  await page.waitForSelector('#duo-home.is-ready', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(250);
  return { ctx, page, errs };
}
const PREP_ONB = `(() => { Duo.progress.setOnboarded(); })()`;
const PREP_FIRST = `(() => { Duo.progress.setOnboarded(); Duo.progress.completeNode('u01-1', {correct:10,total:10,mistakes:0,ms:60000,perfect:true}); })()`;
const PREP_ALL = `(() => { Duo.progress.setOnboarded(); DUO_COURSE.units.forEach(u => u.items.forEach(i => { if (i.kind==='node') Duo.progress.completeNode(i.id,{correct:10,total:10,mistakes:0,ms:1000,perfect:true}); })); })()`;
const PREP_MID = `(() => { Duo.progress.setOnboarded(); const ids=[]; DUO_COURSE.units.forEach(u => u.items.forEach(i => { if (i.kind==='node') ids.push(i.id); })); ids.slice(0,9).forEach(id => Duo.progress.completeNode(id,{correct:9,total:10,mistakes:1,ms:1000})); })()`;

async function hscroll(page) { return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); }
async function shot(page, name) { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); }
async function axe(page, label) {
  await page.evaluate(AXE);
  const r = await page.evaluate(async () => { const x = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }); return x.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes[0].target.join(' '), h: v.nodes[0].html.slice(0, 120) })); });
  const bad = r.filter(v => v.impact === 'serious' || v.impact === 'critical');
  ok(bad.length === 0, `axe ${label}: serious/critical 0` + (r.length ? ` (прочих: ${r.map(v => v.id + ':' + v.impact).join(',')})` : ''));
  bad.concat(r.filter(v => !bad.includes(v))).forEach(v => console.log('     ', JSON.stringify(v)));
}

const SC = [
  ['new', null], ['onb', PREP_ONB], ['first', PREP_FIRST], ['mid', PREP_MID], ['all', PREP_ALL],
];

for (const theme of ['light', 'dark']) {
  for (const [name, prep] of SC) {
    console.log(`== ${name} / ${theme} / 390`);
    const { ctx, page, errs } = await mk({ width: 390, theme, prep });
    const info = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.duo-node')].map(n => n.dataset.state);
      const cnt = s => nodes.filter(x => x === s).length;
      const cur = document.querySelector('.duo-node[data-state="current"]');
      const onb = document.getElementById('duo-onb');
      return { cur: cur && cur.dataset.id, cnt: { locked: cnt('locked'), available: cnt('available'), current: cnt('current'), done: cnt('done') }, onbVisible: !onb.hidden, h1: document.querySelectorAll('h1').length, dialogs: document.querySelectorAll('[role=dialog],dialog[open],.d-modal,.d-sheet').length, sy: Math.round(scrollY), tip: !!document.querySelector('.duo-node__tip'), stats: document.getElementById('duo-stats').innerText.replace(/\n/g, ' | '), lang: document.documentElement.lang };
    });
    console.log('  ', JSON.stringify(info));
    ok(errs.length === 0, 'консоль 0 помилок ' + errs.join(';'));
    ok((await hscroll(page)) <= 0, 'без горизонтального скролу');
    ok(info.h1 === 1 && info.lang === 'uk', 'один h1, lang=uk');
    ok(info.dialogs === 0, 'без діалогів/листів при завантаженні');
    if (name === 'new') { ok(info.onbVisible && info.cur === 'u01-1' && info.tip, 'онбординг видно, current=u01-1, тултип'); }
    if (name === 'onb') { ok(!info.onbVisible && info.cur === 'u01-1', 'онбординг сховано, current=u01-1'); }
    if (name === 'first') { ok(info.cur === 'u01-2' && info.cnt.done === 1, 'current зсунувся на u01-2'); }
    if (name === 'mid') { ok(info.cnt.done === 9 && info.sy > 300, 'прокрутка до поточного (sy=' + info.sy + ')'); }
    if (name === 'all') { ok(info.cnt.current === 0 && info.cnt.locked === 0, 'усе пройдено, нема current/locked'); }
    await axe(page, `${name}/${theme}`);
    if (theme === 'light' || name === 'new' || name === 'mid') { await shot(page, `${name}-390-${theme}`); }
    await ctx.close();
  }
}

// ---- клік по current → плеєр; клік по locked → тост ----
{
  console.log('== кліки');
  const { ctx, page } = await mk({ width: 390, prep: PREP_ONB });
  const r1 = await page.evaluate(() => { const l = document.querySelector('.duo-node[data-state="locked"][data-kind="node"]'); return { id: l.dataset.id, aria: l.getAttribute('aria-label'), dis: l.getAttribute('aria-disabled') }; });
  console.log('  ', JSON.stringify(r1));
  await page.locator('.duo-node[data-state="locked"][data-kind="node"]').first().scrollIntoViewIfNeeded();
  await page.locator('.duo-node[data-state="locked"][data-kind="node"]').first().click({ force: true });
  await page.waitForTimeout(200);
  const toast = await page.evaluate(() => { const t = document.querySelector('.d-toast'); return t && t.textContent; });
  ok(toast === 'Спершу заверши попередню частину', 'locked → тост: ' + toast);
  ok(page.url().endsWith('index.html'), 'locked не навігує');
  await page.locator('.duo-node[data-state="current"]').click();
  await page.waitForURL(/vprava\.html\?n=u01-1/, { timeout: 4000 }).catch(() => {});
  ok(/vprava\.html\?n=u01-1/.test(page.url()), 'current → ' + page.url().replace(base, ''));
  await ctx.close();
}

// ---- онбординг: вибір цілі + «Почати» ----
{
  console.log('== онбординг');
  const { ctx, page } = await mk({ width: 390 });
  await page.locator('.duo-goal__card', { hasText: '30 XP' }).click();
  await page.locator('#duo-onb-start').click();
  await page.waitForURL(/vprava\.html\?n=u01-1/, { timeout: 4000 }).catch(() => {});
  ok(/vprava\.html\?n=u01-1/.test(page.url()), 'Почати → перший вузол');
  const st = await page.evaluate(() => ({ o: Duo.progress.onboarded(), g: Duo.progress.dailyGoal().target }));
  ok(st.o === true && st.g === 30, 'onboarded + ціль 30: ' + JSON.stringify(st));
  await page.goto(base + '/index.html'); await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.getElementById('duo-onb').hidden), 'після онбордингу блок не показується');
  ok((await page.locator('[data-stat=xp]').innerText()).includes('з 30 XP'), 'шапка: ціль дня 30');
  await ctx.close();
}

// ---- оновлення без перезавантаження (progress:change) ----
{
  console.log('== progress:change');
  const { ctx, page } = await mk({ width: 390, prep: PREP_ONB });
  await page.evaluate(() => Duo.progress.completeNode('u01-1', { correct: 10, total: 10, mistakes: 0, ms: 5000, perfect: true }));
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => ({ cur: document.querySelector('.duo-node[data-state="current"]').dataset.id, xp: document.querySelector('[data-stat=xp]').innerText, tips: document.querySelectorAll('.duo-node__tip').length }));
  ok(r.cur === 'u01-2' && r.tips === 1, 'перемальовано без reload: ' + JSON.stringify(r));
  await ctx.close();
}

// ---- ширини, reduced motion, клавіатура ----
for (const w of [360, 390, 430, 1440]) {
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark' && w !== 360 && w !== 1440) continue;
    console.log(`== ширина ${w} / ${theme}`);
    const { ctx, page, errs } = await mk({ width: w, theme, prep: PREP_MID });
    ok(errs.length === 0, 'консоль 0 ' + errs.join(';'));
    ok((await hscroll(page)) <= 0, 'без горизонтального скролу (' + w + ')');
    const geo = await page.evaluate(() => { const b = document.querySelector('.duo-nav').getBoundingClientRect(), m = document.getElementById('main-content').getBoundingClientRect(), c = document.querySelector('.duo-node[data-state=current]').getBoundingClientRect(); return { nav: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)], main: [Math.round(m.left), Math.round(m.width)], cur: [Math.round(c.left), Math.round(c.right)], vw: innerWidth }; });
    console.log('  ', JSON.stringify(geo));
    ok(geo.cur[0] >= 0 && geo.cur[1] <= geo.vw, 'поточний вузол у межах екрана');
    if (w === 1440) { ok(geo.nav[2] < 300 && geo.nav[0] === 0, 'сайдбар зліва не розтягнутий'); await shot(page, `mid-1440-${theme}`); }
    else ok(geo.nav[3] >= 60 && geo.nav[1] + geo.nav[3] >= 600, 'таб-бар унизу');
    if (w === 360 && theme === 'light') await shot(page, 'mid-360-light');
    if (w === 360 || w === 1440) await axe(page, w + '/' + theme);
    await ctx.close();
  }
}
{
  console.log('== reduced motion');
  const { ctx, page, errs } = await mk({ width: 390, reduced: true, prep: PREP_MID });
  const r = await page.evaluate(() => ({ sy: Math.round(scrollY), anim: document.getAnimations().length, rm: Duo.env.reducedMotion }));
  ok(r.rm && r.sy > 300 && errs.length === 0, 'reduced: ' + JSON.stringify(r));
  await ctx.close();
}
{
  console.log('== клавіатура');
  const { ctx, page } = await mk({ width: 1440, prep: PREP_FIRST });
  const order = [];
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => { const a = document.activeElement; return (a.getAttribute('aria-label') || a.textContent || a.tagName).trim().slice(0, 40); })); }
  console.log('  ', JSON.stringify(order));
  const aria = await page.evaluate(() => document.querySelector('.duo-tab[aria-current="page"]').textContent);
  ok(aria === 'Навчання', 'aria-current у активному пункті: ' + aria);
  const ring = await page.evaluate(() => { const n = document.querySelector('.duo-node[data-state=current]'); n.focus(); n.focus({ focusVisible: true }); return getComputedStyle(n).outlineStyle + ' ' + getComputedStyle(n).outlineWidth; });
  console.log('  focus: ' + ring);
  await ctx.close();
}

await browser.close(); srv.close();
if (fails) { console.log('\nУпали перевірки:'); failed.forEach(m => console.log('  - ' + m)); }
console.log(fails ? `ПРОВАЛІВ: ${fails} (перша: ${failed[0]})` : '\nALL OK');
process.exit(fails ? 1 : 0);
