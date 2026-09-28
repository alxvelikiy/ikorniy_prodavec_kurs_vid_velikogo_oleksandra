#!/usr/bin/env node
// Інструмент білдерів Duo-шару: зібрати сайт у СВОЮ теку (не чіпаючи v2/site), підняти статичний сервер,
// відкрити сторінки в Chrome у потрібних ширинах і темах, зняти скриншоти, показати помилки консолі.
//   node v2/duo/tools/dev-shot.mjs --out v2/.out-lesson --pages "vprava.html?n=u01-1,index.html" \
//        --widths 390,1440 --themes light,dark --shots Output/lab/lesson [--state state.json] [--no-build] [--wait 800]
// --state: JSON-файл {"ikorka-duo": {...}, "ikorka-duo-sound": "off", ...} — кладеться в localStorage до завантаження.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const V2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO = path.resolve(V2, '..');
const require = createRequire(path.join(V2, 'mvp', 'tests', 'package.json'));
const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const flag = k => args.includes('--' + k);
const out = path.resolve(REPO, opt('out', 'v2/.out-dev'));
const pages = opt('pages', 'index.html').split(',').filter(Boolean);
const widths = opt('widths', '390,1440').split(',').map(Number);
const themes = opt('themes', 'light').split(',');
const shots = path.resolve(REPO, opt('shots', 'Output/lab/dev'));
const wait = Number(opt('wait', '800'));
const state = opt('state') ? JSON.parse(fs.readFileSync(path.resolve(REPO, opt('state')), 'utf8')) : null;

if (!flag('no-build')) {
  const r = spawnSync(process.execPath, [path.join(V2, 'build', 'build.mjs')], {
    cwd: REPO, encoding: 'utf8',
    env: { ...process.env, SITE_OUT: out, COURSE_OUT: out + '-course' },
  });
  const tail = (r.stdout || '').split('\n').filter(l => /Duo-шар|ПОМИЛК|Сторінок|стоп-лист|Duo:/i.test(l)).join('\n');
  console.log(tail || (r.stdout || '').slice(-600));
  if (r.status !== 0) { console.log(r.stderr); process.exit(1); }
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const f = path.join(out, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  if (!f.startsWith(out) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
let problems = 0;
try {
  for (const theme of themes) for (const width of widths) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, deviceScaleFactor: width < 600 ? 2 : 1, hasTouch: width < 600, isMobile: width < 600 });
    await ctx.addInitScript(([th, st]) => {
      try {
        if (!sessionStorage.getItem('__dev')) {
          sessionStorage.setItem('__dev', '1');
          localStorage.setItem('ikorka-theme', th);
          if (st) for (const k of Object.keys(st)) localStorage.setItem(k, typeof st[k] === 'string' ? st[k] : JSON.stringify(st[k]));
        }
      } catch (e) { /* */ }
    }, [theme, state]);
    for (const p of pages) {
      const page = await ctx.newPage();
      const errs = [];
      page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      page.on('pageerror', e => errs.push('pageerror: ' + e.message));
      page.on('response', r => { if (r.status() >= 400) errs.push('http ' + r.status() + ' ' + r.url()); });
      await page.goto(base + '/' + p, { waitUntil: 'load' });
      await page.waitForTimeout(wait);
      const hs = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const file = path.join(shots, `${p.replace(/[?#=&.]+/g, '_').replace(/_html_?/, '')}--${width}--${theme}.png`);
      await page.screenshot({ path: file });
      const bad = errs.length || hs > 1;
      if (bad) problems++;
      console.log(`${bad ? '✗' : '✓'} ${p} · ${width}px · ${theme}${hs > 1 ? ` · гориз. прокрутка ${hs}px` : ''}${errs.length ? ' · ' + errs.slice(0, 3).join(' | ') : ''} → ${path.relative(REPO, file)}`);
      await page.close();
    }
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }
process.exitCode = problems ? 1 : 0;
