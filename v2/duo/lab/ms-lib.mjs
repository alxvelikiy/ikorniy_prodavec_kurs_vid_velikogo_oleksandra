// Спільне для лаб-скриптів руху/звуку (ms-check.mjs, ms-sounds.mjs): статичний сервер кореня worktree,
// запуск Chrome через playwright-core, рендер палітри звуків у WAV. Власник — motion-sound-designer.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..', '..', '..');
export const OUT = path.join(ROOT, 'Output', 'lab', 'motion-sound');
const require = createRequire(path.join(ROOT, 'v2', 'mvp', 'tests', 'package.json'));
export const { chromium } = require('playwright-core');
export const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(p => fs.existsSync(p));
export const ASSETS = path.join(ROOT, 'v2', 'build', 'assets', 'duo');

// Файли дизайн-системи необов'язкові: якщо їх ще немає — стенд працює на запасних значеннях
const OPTIONAL = /^\/v2\/build\/assets\/duo\/(tokens|core)\.(css|js)$/;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
// Порожня сторінка лише з motion.js + sfx.js — перевірка «модуль не падає без сусідів»
const ISO = '<!DOCTYPE html><html lang="uk"><head><meta charset="utf-8"><title>iso</title></head><body><main id="main-content"><p id="a">a</p><p id="b">b</p></main>' +
  '<script src="/v2/build/assets/duo/motion.js" defer></script><script src="/v2/build/assets/duo/sfx.js" defer></script></body></html>';

export async function serve() {
  const missing = new Set();
  const srv = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/__iso.html') { res.writeHead(200, { 'content-type': TYPES['.html'] }); return res.end(ISO); }
    const f = path.join(ROOT, path.normalize(p));
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      if (OPTIONAL.test(p)) { missing.add(p); res.writeHead(200, { 'content-type': TYPES[path.extname(p)] }); return res.end('/* немає — запасні значення */'); }
      res.writeHead(404); return res.end('nf');
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${srv.address().port}`, close: () => srv.close(), missing };
}

export function launch(extra = []) {
  if (!CHROME) throw new Error('Chrome не знайдено (CHROME_PATH)');
  return chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--autoplay-policy=user-gesture-required', ...extra] });
}

// Рендер усіх звуків в OfflineAudioContext на сторінці (жест не потрібен) → статистика + PCM16 (base64)
export async function renderSounds(page, { volume = 1 } = {}) {
  return page.evaluate(async (vol) => {
    const out = [];
    for (const name of Duo.sfx.names) {
      const opts = { volume: vol, seconds: 2 };
      const buf = await Duo.sfx._render(name, opts);
      const d = buf.getChannelData(0), sr = buf.sampleRate, t0 = Math.round((Duo.sfx._renderAt || 0) * sr);
      let peak = 0, peakAt = t0, lastLoud = t0, sum = 0;
      const floor = Math.pow(10, -50 / 20);
      for (let i = t0; i < d.length; i++) {
        const a = Math.abs(d[i]);
        if (a > peak) { peak = a; peakAt = i; }
        if (a > floor) lastLoud = i;
      }
      const from = Math.max(0, t0 - Math.round(.005 * sr)), end = Math.min(d.length, lastLoud + Math.round(.05 * sr));
      for (let i = t0; i < lastLoud; i++) sum += d[i] * d[i];
      const rms = Math.sqrt(sum / Math.max(1, lastLoud - t0));
      const pcm = new Int16Array(end - from);
      for (let i = from; i < end; i++) pcm[i - from] = Math.max(-1, Math.min(1, d[i])) * 32767;
      const bytes = new Uint8Array(pcm.buffer);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      out.push({ name, sr, ms: Math.round((lastLoud - t0) / sr * 1000), peak: +peak.toFixed(3), peakDb: +(20 * Math.log10(peak || 1e-9)).toFixed(1),
        rmsDb: +(20 * Math.log10(rms || 1e-9)).toFixed(1), attackMs: Math.round((peakAt - t0) / sr * 1000), b64: btoa(bin) });
    }
    return out;
  }, volume);
}

export function wav(pcm16, sr) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm16.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm16.length, 40);
  return Buffer.concat([h, pcm16]);
}

// Записати кожен звук окремим WAV + palette.wav (усі поспіль через 0.35 с тиші) — щоб послухати без браузера
export function writeWavs(sounds, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const parts = [];
  let sr = 44100;
  for (const s of sounds) {
    const pcm = Buffer.from(s.b64, 'base64');
    sr = s.sr;
    fs.writeFileSync(path.join(dir, s.name + '.wav'), wav(pcm, s.sr));
    parts.push(pcm, Buffer.alloc(Math.round(.35 * s.sr) * 2));
  }
  fs.writeFileSync(path.join(dir, '_palette.wav'), wav(Buffer.concat(parts), sr));
}
