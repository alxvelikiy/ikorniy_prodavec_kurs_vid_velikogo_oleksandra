// Мінімальний стаб Supabase (лише /auth/v1/user + rpc get_coach_usage/bump_coach_usage) для перевірки
// netlify/functions/coach.mjs у v2/mvp/tests/coach-function-test.mjs — не справжній Supabase, лише
// достатньо, щоб функція могла автентифікувати виклик і рахувати ліміт.
import http from 'node:http';

export const TEST_TOKEN = 'test-token-valid';
export const TEST_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

export function startMockAuthRpc({ port = 0 } = {}) {
  const usage = new Map(); // user_id -> {calls, ok, errors}
  function send(res, code, obj) { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); }
  function readBody(req) { return new Promise(resolve => { let b = ''; req.on('data', d => b += d); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } }); }); }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const auth = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
    if (url.pathname === '/auth/v1/user') {
      if (auth !== TEST_TOKEN) return send(res, 401, { message: 'invalid token' });
      return send(res, 200, { id: TEST_USER_ID, email: 'test@example.test' });
    }
    if (url.pathname === '/rest/v1/rpc/get_coach_usage') {
      if (auth !== TEST_TOKEN) return send(res, 401, { message: 'invalid token' });
      return send(res, 200, (usage.get(TEST_USER_ID) || { calls: 0 }).calls);
    }
    if (url.pathname === '/rest/v1/rpc/bump_coach_usage') {
      if (auth !== TEST_TOKEN) return send(res, 401, { message: 'invalid token' });
      const b = await readBody(req);
      const u = usage.get(TEST_USER_ID) || { calls: 0, ok: 0, errors: 0 };
      u.calls += b.p_calls || 0; u.ok += b.p_ok || 0; u.errors += b.p_errors || 0;
      usage.set(TEST_USER_ID, u);
      return send(res, 200, [u]);
    }
    send(res, 404, { message: 'not found: ' + url.pathname });
  });
  return new Promise(resolve => {
    server.listen(port, '127.0.0.1', () => {
      const { port: p2 } = server.address();
      resolve({ url: `http://127.0.0.1:${p2}`, close: () => server.close(), _usage: usage });
    });
  });
}
