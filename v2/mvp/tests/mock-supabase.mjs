// Наближений мок Supabase (GoTrue + PostgREST) для тестів account.js у headless Chrome.
// Керує РЕАЛЬНИМ клієнтом @supabase/supabase-js@2 — тестує саме наш клієнтський код
// (account.js: форми, стан «увійшов/вийшов», синхронізація прогресу), а не сам Supabase.
// НЕ підміняє живу перевірку проти справжнього проєкту — див. v2/mvp/SUPABASE_SETUP.md.
import http from 'node:http';
import crypto from 'node:crypto';

const ANON_KEY = 'mock-anon-key';

export function startMockSupabase({ port = 0 } = {}) {
  const users = new Map(); // email -> {id, email, password}
  const profiles = new Map(); // id -> {id, role, display_name}
  const progress = new Map(); // user_id -> {user_id, state, rev, updated_at}
  const tokens = new Map(); // access_token -> user id

  function userSession(u) {
    const access = 'tok_' + crypto.randomBytes(12).toString('hex');
    tokens.set(access, u.id);
    return {
      access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'ref_' + crypto.randomBytes(12).toString('hex'),
      user: { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(), email_confirmed_at: new Date().toISOString(), confirmed_at: new Date().toISOString() },
    };
  }
  function userFromAuth(req) {
    const h = req.headers['authorization'] || '';
    const id = tokens.get(h.replace(/^Bearer\s+/i, ''));
    return id ? { id } : null;
  }
  function send(res, code, obj) {
    var headers = { 'access-control-allow-origin': '*' };
    if (obj != null) headers['content-type'] = 'application/json';
    res.writeHead(code, headers);
    res.end(obj == null ? '' : JSON.stringify(obj));
  }
  function readBody(req) { return new Promise(resolve => { let b = ''; req.on('data', d => { b += d; }); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { resolve({}); } }); }); }
  function parseFilters(url) {
    const out = {};
    for (const [k, v] of url.searchParams) if (v.startsWith('eq.')) out[k] = v.slice(3);
    return out;
  }
  function matchRows(rows, filters) { return rows.filter(r => Object.entries(filters).every(([k, v]) => String(r[k]) === v)); }
  function isSingleAccept(req) { return /vnd\.pgrst\.object\+json/.test(req.headers['accept'] || ''); }

  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') return send(res, 204, null);
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;

    // ---------- GoTrue (Auth) ----------
    if (p === '/auth/v1/signup' && req.method === 'POST') {
      const b = await readBody(req);
      if (users.has(b.email)) return send(res, 400, { message: 'User already registered', error_code: 'user_already_exists' });
      const u = { id: crypto.randomUUID(), email: b.email, password: b.password };
      users.set(b.email, u);
      profiles.set(u.id, { id: u.id, role: 'newbie', display_name: null });
      return send(res, 200, userSession(u));
    }
    if (p === '/auth/v1/token' && req.method === 'POST' && url.searchParams.get('grant_type') === 'password') {
      const b = await readBody(req);
      const u = users.get(b.email);
      if (!u || u.password !== b.password) return send(res, 400, { message: 'Invalid login credentials', error_code: 'invalid_credentials' });
      return send(res, 200, userSession(u));
    }
    if (p === '/auth/v1/token' && req.method === 'POST' && url.searchParams.get('grant_type') === 'refresh_token') {
      const b = await readBody(req);
      const uid = [...tokens.values()].find(id => id); // будь-який відомий користувач сесії — спрощено для тесту
      const u = uid ? [...users.values()].find(x => x.id === uid) : [...users.values()][0];
      if (!u) return send(res, 400, { message: 'Invalid refresh token' });
      return send(res, 200, userSession(u));
    }
    if (p === '/auth/v1/logout' && req.method === 'POST') { return send(res, 204, null); }
    if (p === '/auth/v1/user' && req.method === 'GET') {
      const a = userFromAuth(req);
      if (!a) return send(res, 401, { message: 'Not authenticated' });
      const u = [...users.values()].find(x => x.id === a.id);
      return send(res, 200, userSession(u).user);
    }

    // ---------- PostgREST (profiles / progress) ----------
    const table = /^\/rest\/v1\/(profiles|progress)$/.exec(p);
    if (table) {
      const name = table[1];
      const store = name === 'profiles' ? profiles : progress;
      const key = name === 'profiles' ? 'id' : 'user_id';
      if (req.method === 'GET') {
        const rows = matchRows([...store.values()], parseFilters(url));
        if (isSingleAccept(req)) {
          if (rows.length === 1) return send(res, 200, rows[0]);
          return send(res, 406, { code: 'PGRST116', message: rows.length === 0 ? 'Results contain 0 rows' : 'Results contain more than 1 row' });
        }
        return send(res, 200, rows);
      }
      if (req.method === 'POST' || req.method === 'PATCH') {
        const b = await readBody(req);
        const rows = Array.isArray(b) ? b : [b];
        rows.forEach(r => store.set(r[key], { ...(store.get(r[key]) || {}), ...r }));
        return send(res, 201, rows);
      }
    }
    send(res, 404, { message: 'not found in mock: ' + p });
  });
  return new Promise(resolve => {
    server.listen(port, '127.0.0.1', () => {
      const { port: p2 } = server.address();
      resolve({
        url: `http://127.0.0.1:${p2}`, anonKey: ANON_KEY, close: () => server.close(),
        // тестові хелпери — заглянути у стан мока напряму, без мережі
        _profiles: profiles, _progress: progress, _users: users,
        setRole: (email, role) => { const u = users.get(email); if (u) profiles.set(u.id, { ...(profiles.get(u.id) || {}), id: u.id, role }); },
      });
    });
  });
}
