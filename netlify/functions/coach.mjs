// Ikorka Shop — зріз 5: ІІ-тренер як Netlify Function (замість локального v2/coach/server.mjs, який
// був окремим Node-процесом на комп'ютері новачка). Ключ ANTHROPIC_API_KEY — лише серверна змінна
// оточення функції (Netlify Environment variables), браузеру ніколи не віддається.
//
// Ліміт — per-user, не спільний файл: serverless-функція не має пам'яті між викликами (кожен виклик —
// новий інстанс), тож лічильник живе в Supabase (coach_usage, supabase/migrations/0003_coach_usage.sql),
// атомарно через RPC bump_coach_usage()/get_coach_usage(). Виклик обов'язково автентифікований
// (Authorization: Bearer <supabase access_token>) — підтверджуємо токен через GoTrue, не довіряємо
// клієнту жодного user_id напряму.
//
// Ця функція НЕ прогнана проти живого Netlify (пісочниця розробки без мережевого доступу до
// api.netlify.com/api.anthropic.com/supabase.co) — перевірено лише логіку кожного шматка окремо
// (coach-core.mjs — тими самими тестами, що й локальний сервер; RPC — rls-test.sql; загальна форма
// відповіді — вручну звірена з account.js/coach.js). Жива перевірка після деплою — власник сам.
import path from 'node:path';
import {
  MAX_TURNS, MAX_TEXT, loadData, configureDataDirs, sceneContext, sanitizeInput, roleplayPrompt, feedbackPrompt,
  FEEDBACK_SCHEMA, guardClientReply, validateFeedback, parseJsonLoose, mockRoleplay, mockFeedback,
} from '../../v2/coach/lib/coach-core.mjs';

// Після esbuild-бандлингу import.meta.url усередині coach-core.mjs показує на цей файл (netlify/functions/
// coach.mjs), не на оригінальний вихідний файл — тож шлях «нагору» рахувати нема сенсу; Netlify Functions
// виконуються з робочою текою в корені задеплоєної функції, де netlify.toml's included_files кладе дані
// за тим самим відносним шляхом, що й у репозиторії (v2/coach/data/*, v2/site/assets/trainer-data.js).
// Перевірено живим прогоном через netlify-cli (netlify functions:serve).
configureDataDirs({ coachDir: path.resolve(process.cwd(), 'v2', 'coach'), siteDir: path.resolve(process.cwd(), 'v2', 'site') });

const KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.COACH_MODEL || 'claude-sonnet-5';
const MOCK = process.env.COACH_MOCK === '1';
const LIMIT = Math.max(0, parseInt(process.env.COACH_DAILY_LIMIT || '40', 10) || 40);
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const TIMEOUT_MS = 20000;
const MODE = MOCK ? 'mock' : KEY ? 'live' : 'offline';

loadData(); // помилка даних — одразу при холодному старті, а не під час розмови

function json(code, obj) {
  return new Response(JSON.stringify(obj), { status: code, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

// ---------- Автентифікація: підтверджуємо токен через GoTrue, не довіряємо клієнту ----------
async function authUser(req) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${token}` } });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? { id: u.id, token } : null;
  } catch (e) { return null; }
}
async function rpc(user, fn, params) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${user.token}`, 'content-type': 'application/json' },
    body: JSON.stringify(params || {}),
  });
  if (!r.ok) return null;
  const text = await r.text();
  try { return text ? JSON.parse(text) : null; } catch (e) { return null; }
}
const callsLeft = async user => Math.max(0, LIMIT - (await rpc(user, 'get_coach_usage') ?? 0));
const bump = (user, patch) => rpc(user, 'bump_coach_usage', { p_calls: patch.calls || 0, p_ok: patch.ok || 0, p_errors: patch.errors || 0 });

// ---------- Виклик моделі (та сама логіка, що в v2/coach/server.mjs) ----------
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

async function model(user, kind, prompt, mockFn) {
  if (MODE === 'offline') return { offline: 'no-key' };
  if ((await callsLeft(user)) <= 0) { await bump(user, {}); return { offline: 'limit' }; }
  await bump(user, { calls: 1 });
  if (MOCK) { await bump(user, { ok: 1 }); return { text: mockFn() }; }
  try {
    let text;
    try { text = await callClaude(prompt); } catch (e) {
      if (e.status === 400 && prompt.schema && (await callsLeft(user)) > 0) { await bump(user, { calls: 1 }); text = await callClaude({ ...prompt, schema: null }); } else throw e;
    }
    await bump(user, { ok: 1 });
    return { text };
  } catch (e) {
    if (e.name === 'AbortError') return { offline: 'timeout' };
    await bump(user, { errors: 1 });
    console.error(`[coach] ${kind}: помилка API${e.status ? ' ' + e.status : ''}`); // без тексту розмови і без ключа
    return { offline: 'error' };
  }
}

// ---------- Обробники (та сама логіка й валідація, що в v2/coach/server.mjs) ----------
function readHistory(raw) {
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > MAX_TURNS * 2 + 1) return null;
  const h = raw.map(x => ({ r: x && x.r === 'c' ? 'c' : x && x.r === 'm' ? 'm' : '', t: x && typeof x.t === 'string' ? x.t : '' }));
  if (h.some((x, i) => !x.r || !x.t.trim() || x.t.length > MAX_TEXT || x.r !== (i % 2 ? 'm' : 'c'))) return null;
  return h.map(x => ({ r: x.r, t: sanitizeInput(x.t) }));
}
async function apiRoleplay(user, req) {
  const ctx = sceneContext(req.scene);
  if (!ctx || !ctx.opener) return [400, { ok: false, error: 'scene' }];
  const history = readHistory(req.history);
  if (!history || history[history.length - 1].r !== 'm') return [400, { ok: false, error: 'history' }];
  const turn = history.filter(h => h.r === 'm').length;
  const r = await model(user, 'roleplay', roleplayPrompt(ctx, history), () => mockRoleplay(ctx, history));
  if (r.offline) return [200, { ok: false, mode: 'offline', reason: r.offline, turn }];
  const g = guardClientReply(ctx, r.text);
  return [200, { ok: true, mode: MODE, reply: g.text, guarded: g.guarded, turn, last: turn >= MAX_TURNS, left: await callsLeft(user) }];
}
async function apiFeedback(user, req) {
  if (req.ping) return [200, { ok: MODE !== 'offline', mode: MODE, left: await callsLeft(user), limit: LIMIT }];
  const ctx = sceneContext(req.scene);
  if (!ctx) return [400, { ok: false, error: 'scene' }];
  const replies = Array.isArray(req.replies) ? req.replies.filter(x => typeof x === 'string' && x.trim()).slice(-MAX_TURNS) : [];
  if (!replies.length || replies.some(x => x.length > MAX_TEXT)) return [400, { ok: false, error: 'replies' }];
  const clean = replies.map(sanitizeInput);
  const history = req.history ? readHistory(req.history) : null;
  const prompt = feedbackPrompt(ctx, clean, history);
  const r = await model(user, 'feedback', { ...prompt, schema: FEEDBACK_SCHEMA }, () => JSON.stringify(mockFeedback(ctx, clean)));
  if (r.offline) return [200, { ok: false, mode: 'offline', reason: r.offline }];
  const raw = parseJsonLoose(r.text);
  if (!raw) return [200, { ok: false, mode: 'offline', reason: 'format' }];
  const v = validateFeedback(ctx, raw, clean);
  return [200, { ok: true, mode: MODE, feedback: v.feedback, replaced: v.replaced, left: await callsLeft(user) }];
}

const MAX_BODY = 16 * 1024;

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method' });
  if (!/application\/json/.test(req.headers.get('content-type') || '')) return json(415, { ok: false, error: 'type' });

  const user = await authUser(req);
  if (!user) return json(401, { ok: false, error: 'auth' });

  let bodyText;
  try { bodyText = await req.text(); } catch (e) { return json(400, { ok: false, error: 'body' }); }
  if (bodyText.length > MAX_BODY) return json(413, { ok: false, error: 'body' });
  let body;
  try { body = JSON.parse(bodyText || '{}'); } catch (e) { return json(400, { ok: false, error: 'json' }); }

  const path = new URL(req.url).pathname;
  try {
    const [code, out] = path.endsWith('roleplay') ? await apiRoleplay(user, body) : await apiFeedback(user, body);
    return json(code, out);
  } catch (e) {
    console.error('[coach] внутрішня помилка обробника'); // без тексту запиту
    return json(200, { ok: false, mode: 'offline', reason: 'error' });
  }
};

export const config = { path: ['/api/coach/roleplay', '/api/coach/feedback'] };
