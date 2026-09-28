#!/usr/bin/env node
// DUO-редизайн: скриншоти «до/після» ключових сторінок у трьох розмірах —
// 390×844 WebKit (iPhone), 360×800 Chromium (Android), 1440×900 Chromium (ноутбук).
//   node v2/mvp/tests/duo-screens.mjs before
//   node v2/mvp/tests/duo-screens.mjs after --pages index,vprava --theme dark
// Результат: Output/screens/<label>/<сторінка>--<розмір>[--dark].png
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { startServer, CHROME, REPO } from './lib.mjs';

const require = createRequire(import.meta.url);
const pw = require('playwright-core');

const args = process.argv.slice(2);
const label = args.find(a => !a.startsWith('--')) || 'before';
const opt = name => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : null; };
const DEFAULT_PAGES = ['index', 'vstup', 'den-01', 'urok-01', 'urok-04', 'trenazher', 'trener', 'povtorennia', 'perevirka', 'sos'];
const pages = (opt('pages') || DEFAULT_PAGES.join(',')).split(',').filter(Boolean);
const theme = opt('theme') || 'light';
const state = opt('state') ? JSON.parse(fs.readFileSync(opt('state'), 'utf8')) : null; // {"ikorka-duo": {...}, ...}
const OUT = path.join(REPO, 'Output', 'screens', label);
fs.mkdirSync(OUT, { recursive: true });

const SIZES = [
  { id: '390-webkit', engine: 'webkit', viewport: { width: 390, height: 844 }, dpr: 2, mobile: true },
  { id: '360-chromium', engine: 'chromium', viewport: { width: 360, height: 800 }, dpr: 2, mobile: true },
  { id: '1440-chromium', engine: 'chromium', viewport: { width: 1440, height: 900 }, dpr: 1, mobile: false },
];

async function launch(engine) {
  if (engine === 'chromium') return pw.chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  try { return await pw.webkit.launch(); } catch (e) {
    console.log('  · WebKit недоступний (' + String(e.message).split('\n')[0] + ') — 390 px знімаю в Chromium з емуляцією iPhone');
    return null;
  }
}

const srv = await startServer({ port: 7300 + Math.floor(Math.random() * 400) });
const made = [];
try {
  for (const size of SIZES) {
    let browser = await launch(size.engine);
    let engine = size.engine;
    if (!browser) { browser = await launch('chromium'); engine = 'chromium'; }
    const ctx = await browser.newContext({
      viewport: size.viewport, deviceScaleFactor: size.dpr,
      isMobile: engine === 'chromium' ? size.mobile : undefined, hasTouch: size.mobile,
      reducedMotion: 'reduce', // стабільні кадри: без анімацій у момент знімка
    });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await ctx.addInitScript(([th, st]) => {
      try {
        if (!sessionStorage.getItem('__shots')) {
          sessionStorage.setItem('__shots', '1');
          localStorage.setItem('ikorka-theme', th);
          if (st) for (const k of Object.keys(st)) localStorage.setItem(k, typeof st[k] === 'string' ? st[k] : JSON.stringify(st[k]));
        }
      } catch (e) { /* */ }
    }, [theme, state]);
    const page = await ctx.newPage();
    for (const p of pages) {
      const url = srv.url + '/' + (p.includes('.') || p.includes('?') || p.includes('#') ? p : p + '.html');
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForTimeout(700);
      const file = path.join(OUT, `${p.replace(/[?#=&.]+/g, '_').replace(/_html_?/, '')}--${size.id}${engine !== size.engine ? '-emu' : ''}${theme === 'dark' ? '--dark' : ''}.png`);
      await page.screenshot({ path: file });
      made.push(path.relative(REPO, file));
    }
    await browser.close();
  }
} finally { srv.close(); }
console.log(`Знято ${made.length} скриншотів → ${path.relative(REPO, OUT)}`);
