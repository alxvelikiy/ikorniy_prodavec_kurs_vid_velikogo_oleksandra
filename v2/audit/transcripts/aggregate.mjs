// Зведення попередньої обробки (sonnet_b1..b3.json): перевірка цитат дослівно по файлах
// і підрахунок ознак окремо для ТРЬОХ груп (рішення замовника 2026-09-23, не об'єднувати):
// успіх / явна відмова / інше (передзвонити, подумає, Viber, скарга, обірвано).
// Для «явна відмова» вибірка мала — у висновках тільки якісні спостереження, без відсотків.
// node v2/audit/transcripts/aggregate.mjs  →  aggregate.json + таблиця в консолі
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..'); // папка з транскриптами
const norm = s => s.toLowerCase().replace(/[’`ʼ]/g, "'").replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();

const calls = [];
for (const b of ['sonnet_b1.json', 'sonnet_b2.json', 'sonnet_b3.json']) {
  const p = path.join(HERE, b);
  if (!fs.existsSync(p)) { console.log('немає', b); continue; }
  calls.push(...JSON.parse(fs.readFileSync(p, 'utf8')));
}

const textCache = {};
function textOf(fileField) {
  if (textCache[fileField]) return textCache[fileField];
  const files = fileField.split(' + ');
  const t = norm(files.map(f => fs.readFileSync(path.join(ROOT, f.trim()), 'utf8')).join(' '));
  return (textCache[fileField] = t);
}
const bad = [];
function check(call, key, q) {
  if (!q) return true;
  const clean = q.replace(/^\[\d+\]\s*/, '');
  const ok = textOf(call.file).includes(norm(clean));
  if (!ok) bad.push({ file: call.file, key, q });
  return ok;
}

const FEATURES = ['intro_order', 'intro_history', 'status_role', 'need_question', 'offer_one_phrase', 'start_big',
  'cta_statement', 'downsell', 'upsell', 'gift', 'free_delivery', 'summary_before_goodbye', 'forbidden_words', 'viber_move', 'product_gap'];
const G = ['успіх', 'явна відмова', 'інше'];
// Група — з ручної звірки (classification.json, джерело істини); ознаки — з Sonnet, лише дослівно підтверджені.
const MANUAL = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(HERE, 'classification.json'), 'utf8')).calls.map(c => [c[0], c[2]]));
MANUAL['5767704965.txt + 5767709307.txt'] = MANUAL['5767709307.txt'];
const groupOf = c => { const m = MANUAL[c.file]; if (m) return m === 'успіх' ? 'успіх' : (m === 'відмова' ? 'явна відмова' : 'інше'); return c.outcome === 'замовлення' ? 'успіх' : (c.no_order_kind === 'відмова' ? 'явна відмова' : 'інше'); };
const groups = { 'успіх': [], 'явна відмова': [], 'інше': [] };
for (const c of calls) {
  for (const k of FEATURES) { const f = c.f[k]; if (f && f.v && !check(c, k, f.q)) f.v_unverified = true; }
  for (const o of c.f.objections || []) { check(c, 'objection', o.q); if (o.how_q) check(c, 'objection_how', o.how_q); }
  if (c.f.hook && c.f.hook.q) check(c, 'hook', c.f.hook.q);
  c.group = groupOf(c); groups[c.group].push(c);
}

const table = {};
for (const k of FEATURES) {
  table[k] = {};
  for (const [g, list] of Object.entries(groups)) {
    const yes = list.filter(c => c.f[k] && c.f[k].v && !c.f[k].v_unverified);
    table[k][g] = { yes: yes.length, of: list.length, files: yes.map(c => c.file) };
  }
}
const objections = {};
for (const [g, list] of Object.entries(groups)) for (const c of list) for (const o of c.f.objections || []) {
  objections[o.type] = objections[o.type] || { 'успіх': 0, 'явна відмова': 0, 'інше': 0, handled: 0, total: 0, files: [] };
  objections[o.type][g]++; objections[o.type].total++; if (o.handled) objections[o.type].handled++;
  objections[o.type].files.push(c.file);
}
const kinds = {};
for (const c of [...groups['явна відмова'], ...groups['інше']]) kinds[c.no_order_kind] = (kinds[c.no_order_kind] || 0) + 1;
const hooks = {};
for (const c of calls) { const v = c.f.hook && c.f.hook.v; if (v) { hooks[v] = hooks[v] || { 'успіх': 0, 'явна відмова': 0, 'інше': 0 }; hooks[v][c.group]++; } }
const nameCnt = g => { const a = groups[g].map(c => c.f.client_name_count && c.f.client_name_count.v).filter(n => typeof n === 'number').sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
const ctaCnt = g => { const a = groups[g].map(c => c.f.cta_count && c.f.cta_count.v).filter(n => typeof n === 'number').sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };

const out = {
  total: calls.length, groups: Object.fromEntries(G.map(g => [g, groups[g].length])),
  no_order_kinds: kinds, features: table, objections, hooks,
  median_client_name: Object.fromEntries(G.map(g => [g, nameCnt(g)])),
  median_cta: Object.fromEntries(G.map(g => [g, ctaCnt(g)])),
  unverified_quotes: bad,
};
fs.writeFileSync(path.join(HERE, 'aggregate.json'), JSON.stringify(out, null, 1));
console.log(`дзвінків ${out.total}:`, JSON.stringify(out.groups), kinds);
console.log('ознака'.padEnd(24), 'успіх  ', 'відмова', 'інше');
for (const k of FEATURES) console.log(k.padEnd(24), ...G.map(g => `${table[k][g].yes}/${table[k][g].of}`.padEnd(7)));
console.log('заперечення:', Object.entries(objections).map(([t, o]) => `${t}: ${o.total} (успіх ${o['успіх']}, відмова ${o['явна відмова']}, інше ${o['інше']}; опрацьовано ${o.handled})`).join('; '));
console.log('гачки:', JSON.stringify(hooks));
console.log('медіана звертань на ім\'я:', JSON.stringify(out.median_client_name), 'медіана закликів:', JSON.stringify(out.median_cta));
console.log('непідтверджених цитат:', bad.length);
