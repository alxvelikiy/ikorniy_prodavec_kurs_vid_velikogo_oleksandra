#!/usr/bin/env node
// Перевірка курованої розмітки уроків для тренажера.
//   node v2/mvp/tools/validate-content.mjs            — усі 12 уроків
//   node v2/mvp/tools/validate-content.mjs 1 2 3      — вибрані уроки
//   node v2/mvp/tools/validate-content.mjs --dump 4   — показати, що вже є в уроці 4
//                                                      (номери тестових питань, пар, цитат, розділи H2, «Практика»)
import { extractLesson, loadCurated, validateCurated } from './content-lib.mjs';

const args = process.argv.slice(2);
if (args[0] === '--dump') {
  const n = parseInt(args[1], 10);
  const ex = extractLesson(n);
  console.log(JSON.stringify(ex, null, 1));
  process.exit(0);
}
const lessons = args.length ? args.map(a => parseInt(a, 10)) : Array.from({ length: 12 }, (_, i) => i + 1);
let errs = 0, warns = 0;
for (const n of lessons) {
  const data = loadCurated(n);
  if (!data) { console.log(`урок ${n}: файл v2/mvp/content/urok_${String(n).padStart(2, '0')}.json відсутній`); errs++; continue; }
  const { errors, warnings } = validateCurated(n, data);
  errs += errors.length; warns += warnings.length;
  console.log(`урок ${n}: помилок ${errors.length}, попереджень ${warnings.length}`);
  for (const e of errors) console.log('  ✗ ' + e);
  for (const w of warnings) console.log('  · ' + w);
}
console.log(`\nРАЗОМ: помилок ${errs}, попереджень ${warns}`);
process.exit(errs ? 1 : 0);
