// Спільні помічники автотестів MVP (headless Chromium через playwright-core).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const V2 = path.resolve(__dirname, '..', '..');
export const REPO = path.resolve(V2, '..');
export const SITE = path.join(V2, 'site');
export const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// Сервер: за замовчуванням — сервер ІІ-тренера (v2/coach/server.mjs) у мок-режимі, якщо він є;
// інакше — простий статичний сервер v2/site.
export async function startServer({ port = 4173, env = {} } = {}) {
  const coach = path.join(V2, 'coach', 'server.mjs');
  if (fs.existsSync(coach) && env.STATIC_ONLY !== '1') {
    // лічильники тестового сервера — у тимчасовому файлі, щоб не з'їдати добовий ліміт справжнього
    const usage = path.join(os.tmpdir(), `ikorka-coach-usage-${port}-${Date.now()}.json`);
    const child = spawn(process.execPath, [coach], { env: { ...process.env, PORT: String(port), COACH_MOCK: '1', ANTHROPIC_API_KEY: '', COACH_USAGE_FILE: usage, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 100));
      try { await fetchText(`http://127.0.0.1:${port}/index.html`); return { url: `http://127.0.0.1:${port}`, close: () => { child.kill(); try { fs.unlinkSync(usage); } catch (e) { /* */ } }, log: () => out, usageFile: usage, kind: 'coach' }; } catch (e) { /* ще стартує */ }
    }
    child.kill();
    throw new Error('coach server did not start: ' + out);
  }
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const f = path.join(SITE, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
    if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => srv.listen(port, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${port}`, close: () => srv.close(), log: () => '', kind: 'static' };
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => { let b = ''; res.on('data', d => { b += d; }); res.on('end', () => (res.statusCode < 400 ? resolve(b) : reject(new Error(String(res.statusCode))))); }).on('error', reject);
  });
}

export async function launch() {
  return chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
}

// Сторінка з потрібною шириною і темою; збирає помилки консолі.
export async function openPage(browser, url, { width = 1280, height = 900, theme = 'light', state = null, blockFonts = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  // зовнішні шрифти в пісочниці недоступні — віддаємо порожню відповідь (без помилок консолі)
  if (blockFonts) await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /googleapis/.test(r.request().url()) ? 'text/css' : 'font/woff2', body: '' }));
  await ctx.addInitScript(([th, s]) => {
    try {
      if (!sessionStorage.getItem('__init')) {
        sessionStorage.setItem('__init', '1');
        localStorage.setItem('ikorka-theme', th);
        if (s) localStorage.setItem('ikorka-mvp', JSON.stringify(s));
      }
    } catch (e) { /* */ }
  }, [theme, state]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', r => { const u = r.url(); if (!/fonts\.(googleapis|gstatic)|youtube/.test(u)) errors.push('requestfailed: ' + u + ' ' + (r.failure() || {}).errorText); });
  page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push('http ' + r.status() + ': ' + r.url()); });
  await page.goto(url, { waitUntil: 'load' });
  return { page, ctx, errors };
}

export async function noHorizontalScroll(page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    const over = d.scrollWidth - d.clientWidth;
    const offenders = over > 1 ? [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > d.clientWidth + 1 && getComputedStyle(e).position !== 'fixed').slice(0, 5).map(e => e.tagName + '.' + e.className) : [];
    return { ok: over <= 1, over, offenders };
  });
}

// Спливні вікна після завантаження (без жодної дії користувача)
export async function popupsOnLoad(page, waitMs = 4500) {
  await page.waitForTimeout(waitMs);
  return page.evaluate(() => {
    const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0; };
    return [...document.querySelectorAll('.mvp-pop, .sos-panel, .term-tip, dialog[open], [role="dialog"]:not([hidden]), [role="alertdialog"]')].filter(vis).map(e => e.className || e.tagName);
  });
}

// Розбір у три рядки: кожна частина присутня й непорожня
export async function fb3Parts(locator) {
  return locator.evaluate(n => {
    const t = s => ((n.querySelector(s) || {}).textContent || '').replace(/^[^:]*:\s*/, '').trim();
    return { said: t('.fb3-said'), why: t('.fb3-why'), instead: t('.fb3-instead') };
  });
}

export class Results {
  constructor(name) { this.name = name; this.items = []; }
  ok(id, detail = '') { this.items.push({ id, ok: true, detail }); console.log('  ✓ ' + id + (detail ? ' — ' + detail : '')); }
  fail(id, detail = '') { this.items.push({ id, ok: false, detail: String(detail) }); console.log('  ✗ ' + id + ' — ' + detail); }
  check(id, cond, detail = '') { cond ? this.ok(id, detail) : this.fail(id, detail || 'умова не виконана'); return cond; }
  get failed() { return this.items.filter(i => !i.ok); }
  save(dir) {
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, this.name + '.json');
    fs.writeFileSync(f, JSON.stringify({ name: this.name, at: new Date().toISOString(), passed: this.items.length - this.failed.length, failed: this.failed.length, items: this.items }, null, 1));
    return f;
  }
}
