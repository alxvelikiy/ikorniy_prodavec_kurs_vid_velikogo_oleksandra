#!/usr/bin/env node
// Статичні перевірки MVP (без браузера):
//  - курована розмітка уроків валідна (дослівність, частки, схема);
//  - кожен source_ref у trainer-data.js знайдено дослівно в уроці;
//  - за замовчуванням (SHOW_STATS вимкнено) жодної частки «N з M» у видимому тексті сайту;
//  - жодних телефонів у сайті й файлах гілки MVP; ключа API немає в жодному файлі репозиторію.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { Results, V2, REPO } from './lib.mjs';
import { validateCurated, loadCurated } from '../tools/content-lib.mjs';
import { checkRef, hasShare } from '../../build/lib/trainer.mjs';

const R = new Results('static');
const strict = process.argv.includes('--strict'); // Ф6: вимагати розмітку для всіх 12 уроків

// 1. Курована розмітка
let curatedErr = 0, missing = [];
for (let n = 1; n <= 12; n++) {
  const d = loadCurated(n);
  if (!d) { missing.push(n); continue; }
  const { errors } = validateCurated(n, d);
  curatedErr += errors.length;
  if (errors.length) errors.slice(0, 3).forEach(e => console.log('    ' + e));
}
R.check('content.curated-valid', curatedErr === 0, `помилок ${curatedErr}`);
if (strict) R.check('content.all-12-lessons', missing.length === 0, missing.length ? 'бракує уроків ' + missing.join(', ') : '12 з 12');
else if (missing.length) console.log('  · без розмітки: уроки ' + missing.join(', '));

// 1б. Сервер тренера звіряє фрази тією самою нормалізацією, що й збірка
{
  const { normText: coachNorm } = await import('../../coach/lib/verbatim.mjs');
  const { normText: libNorm, lessonRaw } = await import('../tools/content-lib.mjs');
  const samples = [];
  for (let n = 1; n <= 12; n++) samples.push(lessonRaw(n));
  samples.push('«Лапки» — “інші” ’апостроф‘ **жирний** a\u00A0b –—');
  const diff = samples.filter(t => coachNorm(t) !== libNorm(t)).length;
  R.check('content.coach-normalization-same', diff === 0, diff ? `розбіжностей ${diff}` : '12 уроків + зразок — однаково');
}

// 2. source_ref
const src = fs.readFileSync(path.join(V2, 'site', 'assets', 'trainer-data.js'), 'utf8');
const w = {}; new Function('window', src)(w); const T = w.TRAINER;
let refs = 0; const badRefs = [];
(function walk(x) {
  if (Array.isArray(x)) return x.forEach(walk);
  if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) {
    if (k === 'ref') { refs++; if (!checkRef(v, T.showStats)) badRefs.push(v); }
    else if (k === 'refs') v.forEach(r => { refs++; if (!checkRef(r, T.showStats)) badRefs.push(r); });
    else walk(v);
  }
})(T);
R.check('content.source-refs-verbatim', badRefs.length === 0 && refs > 0, `${refs} посилань, недослівних ${badRefs.length}` + (badRefs.length ? ': ' + JSON.stringify(badRefs.slice(0, 3)) : ''));

// 3. Частки «N з M» при прихованій статистиці
if (!T.showStats) {
  const strip = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ');
  const hits = [];
  for (const f of fs.readdirSync(path.join(V2, 'site')).filter(f => f.endsWith('.html'))) {
    const t = strip(fs.readFileSync(path.join(V2, 'site', f), 'utf8'));
    const m = t.match(/[^ ]{0,20} ?\d+(?:[.,]\d+)?\s*(?:з|із)\s*\d+ ?[^ ]{0,20}|двадцяти шести/g);
    // власні результати користувача («3 з 12 уроків») рендерить JS, у статичному HTML їх немає;
    // зовнішні дослідження з джерелом («84,5 з 100») дозволені
    (m || []).filter(x => !/з 100\b/.test(x) && !/День \d з 5/.test(x)).forEach(x => hits.push(f + ': ' + x.trim()));
  }
  R.check('stats.hidden-in-html', hits.length === 0, hits.length ? hits.slice(0, 5).join(' | ') : 'жодної частки з базою 26 / базою наставника');
  let dataHits = 0;
  (function walk(x, k) {
    if (k === 'ref' || k === 'refs') return;
    if (typeof x === 'string') { if (hasShare(x)) dataHits++; return; }
    if (Array.isArray(x)) x.forEach(v => walk(v));
    else if (x && typeof x === 'object') for (const [kk, v] of Object.entries(x)) walk(v, kk);
  })(T);
  R.check('stats.hidden-in-trainer-data', dataHits === 0, `збігів ${dataHits}`);
}

// 4. Приватність: телефони
const PHONE = /(?<![\d.])(?:\+?38)?0\d{9}(?![\d])|(?<!\d)\d{3}[ -]\d{3}[ -]\d{2}[ -]\d{2}(?!\d)/;
function scanDir(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'results' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) scanDir(p, out);
    else if (/\.(html|js|mjs|json|css|md|txt)$/.test(e.name)) { const t = fs.readFileSync(p, 'utf8'); const m = t.match(PHONE); if (m) out.push(path.relative(REPO, p) + ': ' + m[0]); }
  }
}
const phoneHits = [];
[path.join(V2, 'site'), path.join(V2, 'coach'), path.join(V2, 'mvp')].forEach(d => scanDir(d, phoneHits));
R.check('privacy.no-phones', phoneHits.length === 0, phoneHits.slice(0, 5).join(' | ') || 'v2/site, v2/coach, v2/mvp — чисто');
let changed = [];
try { changed = execSync('git diff --name-only master -- . ; git ls-files --others --exclude-standard', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean); } catch (e) { /* немає git */ }
const changedHits = changed.filter(f => fs.existsSync(path.join(REPO, f)) && /\.(html|js|mjs|json|css|md|txt)$/.test(f) && !/node_modules|\/results\//.test(f))
  .filter(f => PHONE.test(fs.readFileSync(path.join(REPO, f), 'utf8')) || PHONE.test(f));
R.check('privacy.no-phones-in-branch-changes', changedHits.length === 0, changedHits.slice(0, 5).join(' | ') || `${changed.length} змінених файлів — чисто`);

// 5. Ключ API
const KEYRE = /sk-ant-[A-Za-z0-9_\-]{16,}/;
const envKey = process.env.ANTHROPIC_API_KEY || '';
let tracked = [];
try { tracked = execSync('git ls-files; git ls-files --others --exclude-standard', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean); } catch (e) { /* */ }
const keyHits = [];
for (const f of tracked) {
  const p = path.join(REPO, f);
  if (!fs.existsSync(p) || fs.statSync(p).size > 5e6) continue;
  const t = fs.readFileSync(p, 'latin1');
  if (KEYRE.test(t) || (envKey && envKey.length > 12 && t.includes(envKey))) keyHits.push(f);
}
R.check('secrets.no-api-key', keyHits.length === 0, keyHits.length ? keyHits.join(', ') : `${tracked.length} файлів перевірено`);

const f = R.save(path.join(V2, 'mvp', 'tests', 'results'));
console.log(`\nРАЗОМ: ${R.items.length - R.failed.length} ok, ${R.failed.length} fail → ${path.relative(process.cwd(), f)}`);
process.exit(R.failed.length ? 1 : 0);
