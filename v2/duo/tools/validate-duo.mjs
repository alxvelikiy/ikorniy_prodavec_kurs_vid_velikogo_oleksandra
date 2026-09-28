#!/usr/bin/env node
// CLI-валидатор упражнений Duo-слоя (схема — v2/duo/SCHEMA.md).
//   node v2/duo/tools/validate-duo.mjs          — все 12 уроков
//   node v2/duo/tools/validate-duo.mjs 4 5      — только уроки 4 и 5
// Код выхода 1, если есть ошибки. Предупреждения не блокируют.
import { loadDuoLesson, validateDuoLesson } from '../../build/duo/content.mjs';

const only = process.argv.slice(2).map(Number).filter(Boolean);
const list = only.length ? only : Array.from({ length: 12 }, (_, i) => i + 1);
let errs = 0, warns = 0;
for (const n of list) {
  let data;
  try { data = loadDuoLesson(n); } catch (e) { console.log(`✗ урок ${n}: JSON не парситься — ${e.message}`); errs++; continue; }
  if (!data) { console.log(`· урок ${n}: файлу ще немає`); continue; }
  const v = validateDuoLesson(n, data);
  const steps = (data.nodes || []).reduce((a, x) => a + ((x.steps || []).length), 0);
  const types = {};
  (data.nodes || []).forEach(x => (x.steps || []).forEach(s => { types[s.type] = (types[s.type] || 0) + 1; }));
  console.log(`${v.errors.length ? '✗' : '✓'} урок ${n}: вузлів ${(data.nodes || []).length}, кроків ${steps}, згенеровано ${v.generated.length} · ${Object.entries(types).map(([k, c]) => k + ' ' + c).join(', ')}`);
  for (const e of v.errors) console.log('   ✗ ' + e);
  for (const w of v.warnings) console.log('   · ' + w);
  errs += v.errors.length; warns += v.warnings.length;
}
console.log(`\nПомилок: ${errs}, попереджень: ${warns}`);
process.exitCode = errs ? 1 : 0;
