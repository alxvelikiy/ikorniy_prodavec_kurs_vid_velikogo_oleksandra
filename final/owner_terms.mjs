// «заказчик» (слово из рабочей переписки) → «руководство» в тексте для менеджера. Порядок важен: сначала длинные фразы.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RULES = [
  [/заказчик решением от 2026-09-16 подтвердил\b/g, 'руководство решением от 2026-09-16 подтвердило'],
  [/выносится заказчику/g, 'выносится на решение руководства'],
  [/вынесен заказчику/g, 'вынесен на решение руководства'],
  [/в материалах заказчика/g, 'в материалах компании'],
  [/решает заказчик\b/g, 'решает руководство'],
  [/решением заказчика/g, 'решением руководства'],
  [/Решение заказчика/g, 'Решение руководства'],
  [/решение заказчика/g, 'решение руководства'],
  [/у заказчика/g, 'у руководства'],
  [/Заказчику/g, 'Руководству'],
  [/заказчику/g, 'руководству'],
];

let total = 0;
for (const f of fs.readdirSync(path.join(ROOT, 'a3')).filter(x => /\.md$/.test(x) && x !== 'SPEC.md')) {
  const p = path.join(ROOT, 'a3', f);
  let t = fs.readFileSync(p, 'utf8');
  let n = 0;
  for (const [re, to] of RULES) t = t.replace(re, () => { n++; return to; });
  if (n) { fs.writeFileSync(p, t); console.log(f + ': ' + n); total += n; }
  const left = t.match(/[Зз]аказчик[а-яё]*/g);
  if (left) console.log('  ОСТАЛОСЬ в ' + f + ': ' + left.join(', '));
}
console.log('замен всего: ' + total);
