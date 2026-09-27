#!/usr/bin/env node
// Зріз 5: ІІ-тренер як Netlify Function (netlify/functions/coach.mjs) — прогін напряму в Node (без
// netlify-cli/esbuild), проти стаба Supabase (coach-function-mock-supabase.mjs). НЕ перевіряє те, що
// залежить від бандлингу esbuild (netlify-cli живим прогоном це вже підтвердило одноразово, вручну:
// колізія __dirname і невідповідність шляхів included_files — обидва знайдено й виправлено, див.
// configureDataDirs() у v2/coach/lib/coach-core.mjs); тут — сама бізнес-логіка (авторизація, ліміт,
// формат відповіді) з реальним модулем.
import path from 'node:path';
import { Results, V2, REPO } from './lib.mjs';
import { startMockAuthRpc, TEST_TOKEN } from './coach-function-mock-supabase.mjs';

const R = new Results('coach-function');
const mock = await startMockAuthRpc();

process.env.SUPABASE_URL = mock.url;
process.env.SUPABASE_ANON_KEY = 'test-anon';
process.env.COACH_MOCK = '1';
process.env.COACH_DAILY_LIMIT = '3';
delete process.env.ANTHROPIC_API_KEY;

const { default: handler } = await import('../../../netlify/functions/coach.mjs');

function req(path, body, { auth = TEST_TOKEN, method = 'POST', contentType = 'application/json' } = {}) {
  const headers = {};
  if (contentType) headers['content-type'] = contentType;
  if (auth !== null) headers['authorization'] = 'Bearer ' + auth;
  return new Request('http://x' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function call(...args) { const r = await handler(req(...args)); return { status: r.status, body: await r.json().catch(() => null) }; }

try {
  {
    const r = await call('/api/coach/feedback', { ping: true }, { auth: null });
    R.check('coach-fn.no-auth-rejected', r.status === 401 && r.body.error === 'auth', JSON.stringify(r));
  }
  {
    const r = await call('/api/coach/feedback', { ping: true }, { auth: 'wrong-token' });
    R.check('coach-fn.bad-token-rejected', r.status === 401 && r.body.error === 'auth', JSON.stringify(r));
  }
  {
    const r = await call('/api/coach/feedback', { ping: true });
    R.check('coach-fn.ping-ok', r.status === 200 && r.body.ok === true && r.body.mode === 'mock' && r.body.left === 3, JSON.stringify(r));
  }
  {
    const r = await call('/api/coach/roleplay', { scene: 'dz-1', history: [{ r: 'c', t: 'Опір клієнта' }, { r: 'm', t: 'Доброго дня, це Ольга з Ikorka Shop.' }] });
    R.check('coach-fn.roleplay-mock-reply', r.status === 200 && r.body.ok === true && typeof r.body.reply === 'string' && r.body.reply.length > 0, JSON.stringify(r));
    R.check('coach-fn.roleplay-decrements-left', r.body.left === 2, JSON.stringify(r));
  }
  {
    const r = await call('/api/coach/feedback', { scene: 'dz-1', replies: ['Доброго дня, це Ольга з Ikorka Shop'] });
    R.check('coach-fn.feedback-mock-shape', r.status === 200 && r.body.ok === true && r.body.feedback && typeof r.body.feedback.оцінка === 'string', JSON.stringify(r));
    R.check('coach-fn.feedback-decrements-left', r.body.left === 1, JSON.stringify(r));
  }
  {
    // 3-й реальний виклик — на межі ліміту (LIMIT=3, вже 2 витрачено)
    await call('/api/coach/roleplay', { scene: 'dz-1', history: [{ r: 'c', t: 'Опір' }, { r: 'm', t: 'Ще репліка' }] });
    const r = await call('/api/coach/roleplay', { scene: 'dz-1', history: [{ r: 'c', t: 'Опір' }, { r: 'm', t: 'Ще репліка' }] });
    R.check('coach-fn.limit-enforced', r.status === 200 && r.body.ok === false && r.body.mode === 'offline' && r.body.reason === 'limit', JSON.stringify(r));
  }
  {
    const r = await call('/api/coach/feedback', undefined, { contentType: null });
    R.check('coach-fn.missing-content-type-rejected', r.status === 415, JSON.stringify(r));
  }
  {
    const res = await handler(new Request('http://x/api/coach/feedback', { method: 'GET' }));
    R.check('coach-fn.wrong-method-rejected', res.status === 405, res.status);
  }
  {
    const r = await call('/api/coach/roleplay', { scene: 'not-a-real-scene', history: [{ r: 'c', t: 'x' }, { r: 'm', t: 'y' }] });
    R.check('coach-fn.unknown-scene-rejected', r.status === 400 && r.body.error === 'scene', JSON.stringify(r));
  }
} finally {
  mock.close();
}

const f = R.save(path.join(V2, 'mvp', 'tests', 'results'));
console.log(`\nРАЗОМ: ${R.items.length - R.failed.length} ok, ${R.failed.length} fail → ${path.relative(REPO, f)}`);
process.exit(R.failed.length ? 1 : 0);
