// Реальні скріншоти сторінок курсу через headless Chrome (DevTools-протокол, без npm-залежностей).
// node build/shot.mjs <slug> [width]  →  v2/shots/<slug>-light.png і <slug>-dark.png (уся сторінка)
// Потрібен запущений прев'ю-сервер на :4173.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const slug = process.argv[2] || 'urok-01';
const width = parseInt(process.argv[3] || '1280', 10);
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
const port = 9333;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ikorka-shot-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 50; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = list.find(t => t.type === 'page'); if (p) return p; } catch {}
    await sleep(200);
  }
  throw new Error('Chrome не відповів');
}
const t = await target();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width < 700 });
const url = `http://localhost:4173/${slug}.html`;
for (const theme of ['light', 'dark']) {
  await send('Page.navigate', { url });
  await sleep(1200);
  await send('Runtime.evaluate', { expression: `localStorage.setItem('ikorka-theme','${theme}')` });
  await send('Page.reload');
  await sleep(2000); // шрифти Google Fonts
  const m = await send('Page.getLayoutMetrics');
  const h = Math.ceil(m.result.cssContentSize.height);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: h, scale: 1 } });
  const file = path.join(OUT, `${slug}-${theme}${width !== 1280 ? '-' + width : ''}.png`);
  fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
  console.log(file, `${width}x${h}`);
  // частини по 1500 px — для перегляду деталей (повна сторінка при зменшенні нечитабельна)
  for (let y = 0, k = 1; y < h; y += 1500, k++) {
    const part = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width, height: Math.min(1500, h - y), scale: 1 } });
    fs.writeFileSync(file.replace('.png', `-p${k}.png`), Buffer.from(part.result.data, 'base64'));
  }
}
ws.close(); chrome.kill();
