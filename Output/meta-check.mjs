#!/usr/bin/env node
// Перевірка praktyka / zavdannia / profil і celebrate.js. Запуск з кореня worktree після збірки:
//   SITE_OUT=v2/.out-meta COURSE_OUT=v2/.out-meta-course node v2/build/build.mjs
//   node Output/meta-check.mjs [--out v2/.out-meta] [--shots v2/duo/lab/shots-meta]
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
const OUT = path.resolve(ROOT, opt('out', 'v2/.out-meta'));
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
const base = 'http://127.0.0.1:' + srv.address().port;
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };

// ---- вага JS (gzip) ----
for (const pg of ['praktyka', 'zavdannia', 'profil']) {
  const html = fs.readFileSync(path.join(OUT, pg + '.html'), 'utf8');
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  let tot = 0, mine = 0;
  for (const s of srcs) { const g = zlib.gzipSync(fs.readFileSync(path.join(OUT, s)), { level: 9 }).length; tot += g; if (/meta\.js|celebrate\.js/.test(s)) mine += g; }
  console.log('JS ' + pg + '.html: ' + srcs.length + ' файлів, ' + (tot / 1024).toFixed(1) + ' KB gzip; meta+celebrate ' + (mine / 1024).toFixed(1) + ' KB');
  ok(tot <= 80 * 1024, pg + ' JS <= 80 KB gzip');
}

async function mk({ width = 390, theme = 'light', reduced = false, prep = null, page: pg = 'praktyka', noSound = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 360 ? 640 : width < 600 ? 844 : 900 }, deviceScaleFactor: width < 600 ? 2 : 1, hasTouch: width < 600, isMobile: width < 600, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(([th, ns]) => { try { if (!sessionStorage.getItem('__dev')) { sessionStorage.setItem('__dev', '1'); localStorage.setItem('ikorka-theme', th); if (ns) localStorage.setItem('ikorka-duo-sound', 'off'); } } catch (e) {} }, [theme, noSound]);
  const page = await ctx.newPage(); const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('response', r => { if (r.status() >= 400) errs.push('http ' + r.status() + ' ' + r.url()); });
  await page.goto(base + '/' + pg + '.html');
  if (prep) { await page.evaluate(prep); await page.reload(); }
  await page.waitForTimeout(250);
  return { ctx, page, errs };
}
const PREP_MIS = "(() => { const P=Duo.progress; P.setOnboarded(); P.recordMistake({lesson:1,stepId:'s1',nodeId:'u01-1'}); P.recordMistake({lesson:1,stepId:'s2',nodeId:'u01-1'}); P.recordMistake({lesson:1,stepId:'s3',nodeId:'u01-1'}); P.completeNode('u01-1',{correct:9,total:10,mistakes:1,ms:1000,perfect:false,objections:1}); })()";
const PREP_READY = "(() => { const P=Duo.progress; P.setOnboarded(); P.completeNode('u01-1',{correct:10,total:10,mistakes:0,ms:1000,perfect:true,objections:3}); P.completeNode('u01-2',{correct:10,total:10,mistakes:0,ms:1000,perfect:true}); })()";
const PREP_RICH = "(() => { const P=Duo.progress; P.setOnboarded(); const ids=[]; DUO_COURSE.units.forEach(u=>u.items.forEach(i=>{ if(i.kind==='node') ids.push(i.id); })); ids.slice(0,9).forEach(id=>P.completeNode(id,{correct:10,total:10,mistakes:0,ms:1000,perfect:true,objections:2,builds:3})); P.recordMistake({lesson:2,stepId:'x1',nodeId:'u01-2'}); })()";

async function hscroll(page) { return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); }
async function shot(page, name, o = {}) { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!o.full }); }
async function axe(page, label) {
  await page.evaluate(AXE);
  const r = await page.evaluate(async () => { const x = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }); return x.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes[0].target.join(' '), h: v.nodes[0].html.slice(0, 140) })); });
  const bad = r.filter(v => v.impact === 'serious' || v.impact === 'critical');
  ok(bad.length === 0, 'axe ' + label + ': serious/critical 0' + (r.length ? ' (всі: ' + r.map(v => v.id + ':' + v.impact).join(',') + ')' : ''));
  r.forEach(v => console.log('     ', JSON.stringify(v)));
}
const common = async (page, errs, label) => {
  const i = await page.evaluate(() => ({ h1: document.querySelectorAll('h1').length, lang: document.documentElement.lang, dlg: document.querySelectorAll('[role=dialog],.d-sheet,.d-modal,.dcel,dialog[open]').length, emoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(document.getElementById('main-content').innerText), frac: /\d\s*\/\s*\d/.test(document.getElementById('main-content').innerText) }));
  ok(errs.length === 0, label + ': консоль 0 помилок ' + errs.join(';'));
  ok((await hscroll(page)) <= 0, label + ': без горизонтального скролу');
  ok(i.h1 === 1 && i.lang === 'uk', label + ': один h1, lang=uk');
  ok(i.dlg === 0, label + ': без діалогів при завантаженні');
  ok(!i.emoji && !i.frac, label + ': без емодзі і дробів N/M');
};
const text = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? e.innerText : null; }, sel);

// =================== сценарії ===================
const SC = [
  ['praktyka', 'new', null], ['praktyka', 'mistakes', PREP_MIS],
  ['zavdannia', 'new', null], ['zavdannia', 'partial', PREP_MIS], ['zavdannia', 'ready', PREP_READY],
  ['profil', 'new', null], ['profil', 'rich', PREP_RICH],
];
for (const theme of ['light', 'dark']) for (const [pg, name, prep] of SC) {
  console.log('== ' + pg + ' / ' + name + ' / ' + theme + ' / 390');
  const { ctx, page, errs } = await mk({ width: 390, theme, prep, page: pg });
  await common(page, errs, pg + '/' + name + '/' + theme);
  const t = await text(page, '#main-content');
  if (pg === 'praktyka' && name === 'new') {
    ok(/немає/.test(t) && !(await page.$('#pr-mis-btn[href*="mistakes"]')), 'порожній стан помилок: текст «немає», кнопки повторення нема');
    for (const h of ['mode=sos', 'povtorennia.html', 'trenazher.html', 'trener.html', 'sos.html']) ok(!!(await page.$('#main-content a[href*="' + h + '"]')), 'посилання ' + h);
    ok(!/серц/i.test(t), 'у тексті нема «серце»');
  }
  if (pg === 'praktyka' && name === 'mistakes') ok(/3 помилки/.test(t) && !!(await page.$('#pr-mis-btn[href="vprava.html?mode=mistakes"]')), 'лічильник «3 помилки» + кнопка повторення');
  if (pg === 'zavdannia') {
    const q = await page.evaluate(() => ({ n: document.querySelectorAll('.mt-quest').length, done: document.querySelectorAll('.mt-quest.is-done').length, bars: document.querySelectorAll('.mt-quest [role=progressbar]').length, open: !!document.getElementById('qz-open'), goal: document.getElementById('qz-goal').innerText.replace(/\s+/g, ' ') }));
    console.log('  ', JSON.stringify(q));
    ok(q.n === 3 && q.bars === 3, 'три завдання з полосками');
    if (name === 'new') ok(q.done === 0 && !q.open && /Скриня зачинена/.test(t), 'нове: 0 виконано, скриня зачинена');
    if (name === 'partial') ok(q.done < 3 && !q.open, 'часткове: виконано ' + q.done + ', скриня зачинена');
    if (name === 'ready') ok(q.done === 3 && q.open, 'усі виконані, кнопка «Відкрити» є');
  }
  if (pg === 'profil') {
    const a = await page.evaluate(() => ({ kp: document.querySelectorAll('.mt-kpi').length, ach: document.querySelectorAll('.mt-ach').length, cells: document.querySelectorAll('.mt-month td .mt-day').length, week: document.querySelectorAll('.mt-wd').length, stats: document.getElementById('pf-stats').innerText.replace(/\s+/g, ' '), sw: document.querySelectorAll('#pf-signals input[type=checkbox]').length, noreset: !/скинути|скидання|видалити прогрес/i.test(document.getElementById('main-content').innerText) }));
    console.log('  ', JSON.stringify(a));
    ok(a.kp === 5 && a.ach === 6 && a.week === 7 && a.cells >= 28 && a.sw === 2 && a.noreset, 'профіль: 5 KPI, 6 досягнень, тиждень 7, місяць, 2 перемикачі, без скидання');
    if (name === 'rich') ok(/Рівень/.test(t), 'rich: є рівні досягнень');
  }
  await axe(page, pg + '/' + name + '/' + theme);
  if (name !== 'new' || pg === 'praktyka') await shot(page, pg + '-' + name + '-390-' + theme, { full: true });
  await ctx.close();
}

// ---- сундук: відкрити, XP виданий, повторно не видається ----
{
  console.log('== сундук завдань');
  const { ctx, page, errs } = await mk({ page: 'zavdannia', prep: PREP_READY });
  const before = await page.evaluate(() => Duo.progress.xpTotal());
  const hdr0 = await text(page, '.duo-stat--xp');
  console.log('   шапка до:', JSON.stringify(hdr0));
  ok(/20\s*з\s*20\s*XP/.test(hdr0) && /Ціль виконано/.test(await page.evaluate(() => document.querySelector('.duo-stat--xp').textContent)), 'шапка: «20 з 20 XP» + «Ціль виконано» (XP сьогодні 30)');
  ok((await page.evaluate(() => Duo.progress.xpToday())) === 30, 'реальний XP сьогодні 30');
  await page.click('#qz-open');
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => Duo.progress.xpTotal());
  ok(after - before === 15, 'XP +15 (' + before + ' -> ' + after + ')');
  ok(/відкрито/i.test(await text(page, '#qz-chest')) && !(await page.$('#qz-open')), 'стан «відкрито», кнопки нема');
  const foc = await page.evaluate(() => document.activeElement && document.activeElement.id);
  ok(foc === 'qz-chest-status', 'фокус на статусі скрині: ' + foc);
  ok((await page.evaluate(() => Duo.progress.openQuestChest().xp)) === 0 && (await page.evaluate(() => Duo.progress.xpTotal())) === after, 'повторне відкриття XP не видає');
  await page.reload(); await page.waitForTimeout(200);
  ok(/відкрито/i.test(await text(page, '#qz-chest')) && !(await page.$('#qz-open')), 'після перезавантаження: відкрито');
  ok(errs.length === 0, 'консоль 0 помилок ' + errs.join(';'));
  await shot(page, 'zavdannia-opened-390-light', { full: true });
  await ctx.close();
}

// ---- налаштування профілю ----
{
  console.log('== налаштування');
  const { ctx, page, errs } = await mk({ page: 'profil', prep: PREP_RICH });
  await page.selectOption('#pf-goal', '30');
  ok((await page.evaluate(() => Duo.progress.dailyGoal().target)) === 30, 'ціль дня -> 30');
  await page.reload(); await page.waitForTimeout(200);
  ok((await page.inputValue('#pf-goal')) === '30', 'ціль дня пережила перезавантаження');
  ok(/з 30 XP/.test(await text(page, '.duo-stat--xp')), 'шапка показує ціль 30');
  const snd = await page.$('#dsig-sound'), hap = await page.$('#dsig-haptics');
  ok(!(await snd.isChecked()), 'звук вимкнений (старт з ikorka-duo-sound=off)');
  await page.locator('label:has(#dsig-sound)').click();
  ok(await snd.isChecked() && (await page.evaluate(() => Duo.sfx.enabled)) === true, 'звук увімкнено');
  const hDis = await hap.isDisabled(); console.log('   вібрація disabled:', hDis);
  const hapBefore = await hap.isChecked();
  if (!hDis) { await page.locator('label:has(#dsig-haptics)').click(); }
  await page.reload(); await page.waitForTimeout(250);
  ok(await (await page.$('#dsig-sound')).isChecked(), 'звук пережив перезавантаження');
  if (!hDis) ok((await (await page.$('#dsig-haptics')).isChecked()) === !hapBefore, 'вібрація пережила перезавантаження');
  await page.click('[data-theme-set="dark"]');
  ok((await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark' && (await page.evaluate(() => localStorage.getItem('ikorka-theme'))) === 'dark', 'тема темна застосована і збережена');
  await page.reload(); await page.waitForTimeout(150);
  ok((await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark' && (await page.getAttribute('[data-theme-set="dark"]', 'aria-pressed')) === 'true', 'темна тема пережила перезавантаження');
  await page.click('[data-theme-set="light"]');
  ok((await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === null, 'світла тема');
  ok(errs.length === 0, 'консоль 0 помилок ' + errs.join(';'));
  await ctx.close();
}

// ---- перерисовка за progress:change ----
{
  console.log('== progress:change');
  const { ctx, page } = await mk({ page: 'praktyka' });
  await page.evaluate(() => Duo.progress.recordMistake({ lesson: 1, stepId: 'z1', nodeId: 'u01-1' }));
  await page.waitForTimeout(100);
  ok(/1 помилка/.test(await text(page, '#pr-mis-text')), 'практика перемалювалась: «1 помилка»');
  await ctx.close();
}

// ---- ширини та reduced motion ----
for (const w of [360, 390, 430, 1440]) for (const pg of ['praktyka', 'zavdannia', 'profil']) {
  const { ctx, page, errs } = await mk({ width: w, page: pg, prep: PREP_RICH });
  const hs = await hscroll(page);
  ok(hs <= 0 && errs.length === 0, pg + ' ' + w + 'px: без гор. скролу (' + hs + '), консоль чиста');
  if (w === 1440 && pg === 'profil') await shot(page, 'profil-rich-1440-light', { full: true });
  await ctx.close();
}
{
  const { ctx, page, errs } = await mk({ page: 'zavdannia', prep: PREP_READY, reduced: true });
  await page.click('#qz-open'); await page.waitForTimeout(200);
  ok((await page.evaluate(() => document.querySelectorAll('canvas').length)) === 0 && errs.length === 0, 'reduced motion: без конфеті, без помилок');
  await ctx.close();
}

// ---- клавіатура ----
{
  console.log('== клавіатура');
  const { ctx, page } = await mk({ page: 'praktyka', prep: PREP_MIS });
  const seen = [];
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => { const e = document.activeElement; const cs = getComputedStyle(e); return { id: e.id, href: e.getAttribute('href'), ring: e.matches(':focus-visible') && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 }; });
    seen.push(r);
  }
  const mainLinks = seen.filter(s => s.href && /vprava|povtorennia|trenazher|trener|sos/.test(s.href));
  ok(mainLinks.length >= 6, 'Tab проходить по кнопках і посиланнях практики (' + mainLinks.length + ')');
  ok(mainLinks.every(s => s.ring), ':focus-visible: контур видно на всіх');
  await ctx.close();
}
{
  const { ctx, page } = await mk({ page: 'profil', prep: PREP_RICH });
  await page.focus('#pf-goal');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);
  ok((await page.evaluate(() => Duo.progress.dailyGoal().target)) > 20, 'select цілі керується з клавіатури');
  await page.focus('[data-theme-set="dark"]'); await page.keyboard.press('Enter');
  ok((await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark', 'тема перемикається Enter');
  await ctx.close();
}

// =================== celebrate ===================
console.log('== celebrate');
const DATA = {
  streak: { before: 2, after: 3 }, goal: { before: 10, after: 25, target: 20, reachedNow: true },
  quest: { id: 'perfect' }, achievement: { id: 'objections', level: 1 },
};
for (const theme of ['light', 'dark']) {
  for (const type of ['streak', 'goal', 'quest', 'achievement', 'lessonComplete']) {
    const { ctx, page, errs } = await mk({ theme, page: 'praktyka', prep: PREP_RICH });
    await page.evaluate(([t, d]) => { Duo.celebrate.enqueue({ type: t, data: t === 'lessonComplete' ? { xp: 15, accuracy: 90 } : d }); window.__p = Duo.celebrate.run(); }, [type, DATA[type]]);
    await page.waitForSelector('.dcel', { timeout: 2000 });
    await page.waitForTimeout(400);
    const i = await page.evaluate(() => ({ n: document.querySelectorAll('.dcel').length, title: document.getElementById('dcel-title').textContent, focus: document.activeElement.id, role: document.querySelector('.dcel').getAttribute('role'), live: !!document.querySelector('.dcel [aria-live]'), mascot: !!document.querySelector('.dcel__mascot svg'), btn: document.querySelector('.dcel__act').textContent, inert: document.getElementById('main-content').hasAttribute('inert') }));
    console.log('  ', type, theme, JSON.stringify(i));
    ok(i.n === 1 && i.focus === 'dcel-title' && i.role === 'dialog' && i.live && i.mascot && i.btn === 'Продовжити' && i.inert, type + '/' + theme + ': один екран, фокус на заголовку, dialog, aria-live, маскот, inert фону');
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    ok((await page.$$('.dcel')).length === 1, type + '/' + theme + ': Esc не закриває');
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    ok(await page.evaluate(() => !!document.activeElement.closest('.dcel')), type + '/' + theme + ': Tab не виходить за екран');
    await axe(page, 'celebrate ' + type + '/' + theme);
    if (theme === 'light' && type === 'streak') await shot(page, 'celebrate-streak-390-light');
    if (theme === 'dark' && type === 'goal') await shot(page, 'celebrate-goal-390-dark');
    if (theme === 'light' && type === 'achievement') await shot(page, 'celebrate-achievement-390-light');
    await page.waitForTimeout(1300);
    ok((await page.evaluate(() => document.querySelectorAll('canvas').length)) === 0, type + '/' + theme + ': конфеті прибрано за <=1,7 с');
    await page.click('.dcel__act'); await page.waitForTimeout(100);
    const resolved = await page.evaluate(() => Promise.race([window.__p.then(() => 'done'), new Promise(r => setTimeout(() => r('hang'), 500))]));
    ok(resolved === 'done' && (await page.$$('.dcel')).length === 0, type + '/' + theme + ': «Продовжити» закриває, run() резолвиться');
    const inertLeft = await page.evaluate(() => document.querySelectorAll('[inert]').length);
    ok(inertLeft === 0 && errs.length === 0, type + '/' + theme + ': inert знято, консоль чиста ' + errs.join(';'));
    await ctx.close();
  }
}
{ // черга з 4 (у зворотному порядку) + два завдання -> один екран
  const { ctx, page, errs } = await mk({ page: 'praktyka', prep: PREP_RICH });
  await page.evaluate(() => {
    window.__seen = []; window.__max = 0;
    const C = Duo.celebrate;
    C.enqueue({ type: 'achievement', data: { id: 'streak', level: 1 } });
    C.enqueue({ type: 'quest', data: { id: 'perfect' } }); C.enqueue({ type: 'quest', data: { id: 'xp30' } });
    C.enqueue({ type: 'goal', data: { before: 10, after: 25, target: 20 } });
    C.enqueue({ type: 'streak', data: { before: 0, after: 1 } });
    new MutationObserver(() => { const n = document.querySelectorAll('.dcel').length; window.__max = Math.max(window.__max, n); const t = document.getElementById('dcel-title'); if (t && window.__seen[window.__seen.length - 1] !== t.textContent) window.__seen.push(t.textContent); }).observe(document.body, { childList: true, subtree: true });
    window.__p = C.run(); window.__p2 = C.run();
  });
  for (let k = 0; k < 4; k++) { await page.waitForSelector('.dcel__act'); await page.waitForTimeout(250); await page.click('.dcel__act'); await page.waitForTimeout(150); }
  const r = await page.evaluate(() => Promise.race([window.__p.then(() => ({ seen: window.__seen, max: window.__max, same: window.__p === window.__p2 })), new Promise(r => setTimeout(() => r(null), 800))]));
  console.log('   порядок:', JSON.stringify(r));
  ok(r && r.max === 1 && r.seen.length === 4, 'черга: 4 екрани, ніколи два разом');
  ok(r && /Серія/.test(r.seen[0]) && /Ціль/.test(r.seen[1]) && /Завдання/.test(r.seen[2]) && /досягнення/.test(r.seen[3]), 'порядок streak, goal, quest, achievement');
  ok(errs.length === 0, 'консоль чиста');
  await ctx.close();
}
{ // без mascot/signals/motion/progress
  const { ctx, page, errs } = await mk({ page: 'praktyka' });
  await page.evaluate(() => { delete Duo.mascot; delete Duo.signals; delete Duo.motion; delete Duo.progress; Duo.celebrate.enqueue({ type: 'streak', data: { before: 1, after: 2 } }); Duo.celebrate.enqueue({ type: 'achievement', data: { id: 'boss', level: 2 } }); window.__p = Duo.celebrate.run(); });
  await page.waitForSelector('.dcel__act'); await page.click('.dcel__act'); await page.waitForSelector('.dcel__act'); await page.click('.dcel__act'); await page.waitForTimeout(100);
  ok((await page.$$('.dcel')).length === 0 && errs.length === 0, 'без mascot/signals/motion/progress не падає: ' + errs.join(';'));
  ok((await page.evaluate(() => Duo.celebrate.run().then(() => 'ok'))) === 'ok', 'run() на порожній черзі резолвиться одразу');
  await ctx.close();
}
{ // reduced motion
  const { ctx, page, errs } = await mk({ page: 'praktyka', reduced: true });
  await page.evaluate(() => { Duo.celebrate.enqueue({ type: 'goal', data: { after: 20, target: 20 } }); Duo.celebrate.run(); });
  await page.waitForSelector('.dcel'); await page.waitForTimeout(150);
  ok((await page.evaluate(() => document.querySelectorAll('canvas').length)) === 0 && errs.length === 0, 'celebrate reduced motion: без конфеті');
  await ctx.close();
}

{ // Duo.copy: є на кожній Duo-сторінці; без copy.js плеєр падає з явною помилкою в консоль, а не з порожніми текстами
  console.log('== Duo.copy');
  for (const url of ['index.html', 'vprava.html?n=u01-1', 'praktyka.html', 'zavdannia.html', 'profil.html', 'shpargalka.html']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(base + '/' + url); await page.waitForTimeout(150);
    const r = await page.evaluate(() => ({ copy: !!(window.Duo && Duo.copy && Duo.copy.lesson && Duo.copy.meta), tag: !!document.querySelector('script[src="assets/duo/copy.js"]') }));
    ok(r.copy && r.tag, url + ': copy.js підключено, Duo.copy завантажено');
    await ctx.close();
  }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('**/assets/duo/copy.js', r => r.abort());
  const page = await ctx.newPage(); const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.goto(base + '/vprava.html?n=u01-1'); await page.waitForTimeout(400);
  const blank = await page.evaluate(() => [...document.querySelectorAll('#duo-lesson .d-btn__label')].filter(e => !e.textContent.trim()).length);
  ok(errs.some(e => /copy\.js не завантажено/.test(e)), 'без copy.js: явна помилка в консолі («copy.js не завантажено»)');
  ok(blank === 0, 'без copy.js: немає кнопок із порожніми підписами');
  await ctx.close();
}

await browser.close(); srv.close();
console.log(fails ? '\nFAILS: ' + fails : '\nALL OK');
process.exit(fails ? 1 : 0);
