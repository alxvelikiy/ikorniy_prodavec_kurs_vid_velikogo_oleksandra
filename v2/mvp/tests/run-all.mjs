#!/usr/bin/env node
// Ф6: повний прогін автотестів MVP — збірка, статичні перевірки (--strict), сервер тренера,
// клік-сценарії всіх зрізів у headless Chromium, матриця сторінок. Підсумок → results/SUMMARY.json.
//   cd v2/mvp/tests && npm install && node run-all.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const V2 = path.resolve(HERE, '..', '..');
const RES = path.join(HERE, 'results');
const steps = [
  { name: 'Збірка сайту', cmd: [path.join(V2, 'build', 'build.mjs')], result: null },
  { name: 'Статичні перевірки (дослівність, частки, приватність, ключ)', cmd: [path.join(HERE, 'static-checks.mjs'), '--strict'], result: 'static.json' },
  { name: 'Сервер ІІ-тренера (API, захисти, ліміти)', cmd: [path.join(HERE, 'coach-api.mjs')], result: 'coach-api.json' },
  { name: 'Жива перевірка ІІ-тренера (лише з ANTHROPIC_API_KEY; без ключа — «не проведена»)', cmd: [path.join(HERE, 'coach-live.mjs')], result: 'coach-live.json' },
  { name: 'Клік-сценарії: зрізи 1–5 (ніч 1) + виправлення і контент ночі 2', cmd: [path.join(HERE, 'e2e.mjs')], result: 'e2e.json' },
  { name: 'Матриця: сторінки × 375/1280 × теми; розбір у 3 частини на всіх уроках', cmd: [path.join(HERE, 'matrix.mjs')], result: 'matrix.json' },
];
const summary = { at: new Date().toISOString(), steps: [], passed: 0, failed: 0 };
for (const s of steps) {
  console.log(`\n### ${s.name}`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, s.cmd, { stdio: 'inherit', cwd: path.resolve(V2, '..') });
  const row = { name: s.name, exit: r.status, seconds: Math.round((Date.now() - t0) / 1000) };
  if (s.result && fs.existsSync(path.join(RES, s.result))) {
    const j = JSON.parse(fs.readFileSync(path.join(RES, s.result), 'utf8'));
    Object.assign(row, { passed: j.passed, failed: j.failed, skipped: !!j.skipped, reason: j.reason, file: 'v2/mvp/tests/results/' + s.result });
    if (j.skipped) summary.skipped = (summary.skipped || []).concat(s.name + ': ' + j.reason);
    summary.passed += j.passed; summary.failed += j.failed;
  } else if (r.status !== 0) summary.failed++;
  summary.steps.push(row);
}
fs.writeFileSync(path.join(RES, 'SUMMARY.json'), JSON.stringify(summary, null, 1));
console.log('\n=== ПІДСУМОК ===');
for (const s of summary.steps) console.log(`${s.skipped ? '⏭' : s.exit === 0 ? '✓' : '✗'} ${s.name}${s.skipped ? ` — ПРОПУЩЕНО: ${s.reason}` : s.passed != null ? ` — ${s.passed} ok, ${s.failed} fail` : ''} (${s.seconds} с)`);
console.log(`РАЗОМ: ${summary.passed} перевірок пройдено, ${summary.failed} не пройдено` + (summary.skipped ? `, пропущено: ${summary.skipped.join('; ')}` : ''));
process.exit(summary.failed || summary.steps.some(s => s.exit !== 0) ? 1 : 0);
