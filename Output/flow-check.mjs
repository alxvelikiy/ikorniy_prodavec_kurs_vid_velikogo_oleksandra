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

await browser.close(); srv.close();
console.log(fails ? '\nFAILS: ' + fails : '\nALL OK');
process.exit(fails ? 1 : 0);
