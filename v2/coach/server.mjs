#!/usr/bin/env node
// ІІ-тренер Ikorka Shop: роздає сайт курсу (v2/site) і проксує рівно два виклики до Claude API.
//   node v2/coach/server.mjs            → http://127.0.0.1:8787
// Змінні оточення:
//   ANTHROPIC_API_KEY  ключ API — лише з оточення; не пишеться у файли, логи й відповіді браузеру
//   COACH_MODEL        модель (типово claude-sonnet-5)
//   COACH_MOCK=1       детерміновані відповіді без мережі (для автотестів інтерфейсу)
//   COACH_DAILY_LIMIT  викликів на добу (типово 40); PORT (8787), HOST (127.0.0.1)
// Без ключа, при помилці, тайм-ауті чи вичерпаному ліміті відповідає {ok:false, mode:'offline'} —
// сторінка показує «Тренер офлайн» і розбирає відповідь за правилами з уроків.
// Тексти діалогів ніде не зберігаються і не логуються — лише лічильники (data/usage.json).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {
  COACH_DIR, SITE_DIR, MAX_TURNS, MAX_TEXT, loadData, sceneContext, sanitizeInput, roleplayPrompt, feedbackPrompt,
  FEEDBACK_SCHEMA, guardClientReply, validateFeedback, parseJsonLoose, mockRoleplay, mockFeedback,
} from './lib/coach-core.mjs';

const KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.COACH_MODEL || 'claude-sonnet-5';
const MOCK = process.env.COACH_MOCK === '1';
const LIMIT = Math.max(0, parseInt(process.env.COACH_DAILY_LIMIT || '40', 10) || 40);
const PORT = parseInt(process.env.PORT || '8787', 10);
const HOST = process.env.HOST || '127.0.0.1';
const TIMEOUT_MS = 20000;
const MAX_BODY = 16 * 1024;
const USAGE_FILE = process.env.COACH_USAGE_FILE || path.join(COACH_DIR, 'data', 'usage.json');
const MODE = MOCK ? 'mock' : KEY ? 'live' : 'offline';

loadData(); // помилка даних — одразу при старті, а не під час розмови

// ---------- Лічильники (без текстів) ----------
const today = () => new Date().toISOString().slice(0, 10);
let usage = {};
try { usage = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8')); } catch (e) { usage = {}; }
function bump(field, n = 1) {
  const d = today();
  usage[d] = usage[d] || { calls: 0, ok: 0, errors: 0, timeouts: 0, limited: 0, replaced: 0, guarded: 0, roleplay: 0, feedback: 0 };
  usage[d][field] = (usage[d][field] || 0) + n;
  const keep = Object.keys(usage).sort().slice(-30);
  usage = Object.fromEntries(keep.map(k => [k, usage[k]]));
  try { fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true }); fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 1)); } catch (e) { /* лічильники не критичні */ }
}
const callsLeft = () => Math.max(0, LIMIT - ((usage[today()] || {}).calls || 0));

// ---------- Виклик моделі ----------
// thinking вимкнено: max_tokens 400 — жорстка межа всього виводу (див. доку Sonnet 5);
// моделі, де вимкнути thinking не можна, отримують низьке зусилля.
function thinkingParams(extraOutput) {
  const noDisable = /fable|mythos|opus-5-5/.test(MODEL);
  const output_config = { ...(noDisable ? { effort: 'low' } : {}), ...(extraOutput || {}) };
  return { ...(noDisable ? {} : { thinking: { type: 'disabled' } }), ...(Object.keys(output_config).length ? { output_config } : {}) };
}
async function callClaude({ system, user, schema }) {
  const body = { model: MODEL, max_tokens: 400, system, messages: [{ role: 'user', content: user }], ...thinkingParams(schema ? { format: { type: 'json_schema', schema } } : null) };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) { const e = new Error('api'); e.status = res.status; throw e; }
    const j = await res.json();
    if (j.stop_reason === 'refusal') { const e = new Error('refusal'); e.status = 200; throw e; }
    return (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  } finally { clearTimeout(timer); }
}

// Кожен виклик моделі (і мок) проходить через ліміт і лічильники; тексти не логуються.
async function model(kind, prompt, mockFn) {
  if (MODE === 'offline') return { offline: 'no-key' };
  if (callsLeft() <= 0) { bump('limited'); return { offline: 'limit' }; }
  bump('calls'); bump(kind);
  if (MOCK) { bump('ok'); return { text: mockFn() }; }
  try {
    let text;
    try { text = await callClaude(prompt); } catch (e) {
      // структурований вивід недоступний для обраної моделі — один повтор без нього
      if (e.status === 400 && prompt.schema && callsLeft() > 0) { bump('calls'); text = await callClaude({ ...prompt, schema: null }); } else throw e;
    }
    bump('ok');
    return { text };
  } catch (e) {
    if (e.name === 'AbortError') { bump('timeouts'); return { offline: 'timeout' }; }
    bump('errors');
    console.error(`[coach] ${kind}: помилка API${e.status ? ' ' + e.status : ''}`); // без тексту розмови і без ключа
    return { offline: 'error' };
  }
}

// ---------- Обробники API ----------
function readHistory(raw) {
  // історія: перша репліка клієнта (з уроку), далі по черзі менеджер/клієнт; остання — менеджера
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > MAX_TURNS * 2 + 1) return null;
  const h = raw.map(x => ({ r: x && x.r === 'c' ? 'c' : x && x.r === 'm' ? 'm' : '', t: x && typeof x.t === 'string' ? x.t : '' }));
  if (h.some((x, i) => !x.r || !x.t.trim() || x.t.length > MAX_TEXT || x.r !== (i % 2 ? 'm' : 'c'))) return null;
  return h.map(x => ({ r: x.r, t: sanitizeInput(x.t) }));
}

async function apiRoleplay(req) {
  const ctx = sceneContext(req.scene);
  if (!ctx || !ctx.opener) return [400, { ok: false, error: 'scene' }];
  const history = readHistory(req.history);
  if (!history || history[history.length - 1].r !== 'm') return [400, { ok: false, error: 'history' }];
  const turn = history.filter(h => h.r === 'm').length;
  const r = await model('roleplay', roleplayPrompt(ctx, history), () => mockRoleplay(ctx, history));
  if (r.offline) return [200, { ok: false, mode: 'offline', reason: r.offline, turn }];
  const g = guardClientReply(ctx, r.text);
  if (g.guarded) bump('guarded');
  return [200, { ok: true, mode: MODE, reply: g.text, guarded: g.guarded, turn, last: turn >= MAX_TURNS, left: callsLeft() }];
}

async function apiFeedback(req) {
  if (req.ping) return [200, { ok: MODE !== 'offline', mode: MODE, left: callsLeft(), limit: LIMIT }];
  const ctx = sceneContext(req.scene);
  if (!ctx) return [400, { ok: false, error: 'scene' }];
  const replies = Array.isArray(req.replies) ? req.replies.filter(x => typeof x === 'string' && x.trim()).slice(-MAX_TURNS) : [];
  if (!replies.length || replies.some(x => x.length > MAX_TEXT)) return [400, { ok: false, error: 'replies' }];
  const clean = replies.map(sanitizeInput);
  const history = req.history ? readHistory(req.history) : null;
  const prompt = feedbackPrompt(ctx, clean, history);
  const r = await model('feedback', { ...prompt, schema: FEEDBACK_SCHEMA }, () => JSON.stringify(mockFeedback(ctx, clean)));
  if (r.offline) return [200, { ok: false, mode: 'offline', reason: r.offline }];
  const raw = parseJsonLoose(r.text);
  if (!raw) { bump('errors'); return [200, { ok: false, mode: 'offline', reason: 'format' }]; }
  const v = validateFeedback(ctx, raw, clean);
  if (v.replaced) bump('replaced', v.replaced);
  if (v.guarded) bump('guarded', v.guarded);
  return [200, { ok: true, mode: MODE, feedback: v.feedback, replaced: v.replaced, left: callsLeft() }];
}

// ---------- Статика ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
function serveStatic(req, res) {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (p === '/') p = '/index.html';
  const file = path.resolve(SITE_DIR, '.' + path.posix.normalize(p));
  if (!file.startsWith(SITE_DIR + path.sep) || p.split('/').some(seg => seg.startsWith('.')) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Не знайдено');
  }
  const ext = path.extname(file);
  const headers = { 'content-type': TYPES[ext] || 'application/octet-stream', 'x-content-type-options': 'nosniff', 'cache-control': ext === '.html' || file.endsWith('sw.js') ? 'no-cache' : 'max-age=300' };
  if (ext === '.html') {
    // позначка для сторінки: API тренера доступне (на статичному хостингу її немає → одразу офлайн-режим)
    const html = fs.readFileSync(file, 'utf8').replace('</head>', '<meta name="ikorka-coach" content="on">\n</head>');
    res.writeHead(200, headers);
    return res.end(req.method === 'HEAD' ? undefined : html);
  }
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

function sendJson(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/api/coach/roleplay' || url === '/api/coach/feedback') {
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method' });
    if (!/application\/json/.test(req.headers['content-type'] || '')) return sendJson(res, 415, { ok: false, error: 'type' });
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { req.destroy(); } else chunks.push(c); });
    req.on('end', async () => {
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { return sendJson(res, 400, { ok: false, error: 'json' }); }
      try {
        const [code, out] = url.endsWith('roleplay') ? await apiRoleplay(body) : await apiFeedback(body);
        sendJson(res, code, out);
      } catch (e) {
        bump('errors');
        console.error('[coach] внутрішня помилка обробника'); // без тексту запиту
        sendJson(res, 200, { ok: false, mode: 'offline', reason: 'error' });
      }
    });
    return;
  }
  if (url.startsWith('/api/')) return sendJson(res, 404, { ok: false, error: 'not-found' });
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`[coach] http://${HOST}:${PORT} · режим: ${MODE === 'live' ? 'live, модель ' + MODEL : MODE === 'mock' ? 'mock (COACH_MOCK=1)' : 'офлайн — немає ANTHROPIC_API_KEY'} · ліміт ${LIMIT} викликів/добу`);
});
