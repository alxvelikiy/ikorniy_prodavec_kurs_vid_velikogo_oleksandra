#!/usr/bin/env node
// Печатает размеченные данные тренажёра для урока N (дословные фрагменты уроков) — источник для content-adapter.
//   node v2/duo/tools/trainer-lesson.mjs 4
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const V2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const n = Number(process.argv[2]);
if (!(n >= 1 && n <= 12)) { console.error('використання: node v2/duo/tools/trainer-lesson.mjs <1..12>'); process.exit(1); }
const src = fs.readFileSync(path.join(V2, 'site', 'assets', 'trainer-data.js'), 'utf8');
const w = {};
new Function('window', src)(w);
const T = w.TRAINER;
const L = T.lessons[n - 1];
const strip = o => JSON.parse(JSON.stringify(o, (k, v) => (k === 'refs' || k === 'ref' ? undefined : v)));
const out = {
  lesson: n, title: L.title, day: L.day,
  rules: strip(L.rules), quiz: strip(L.quiz), pairs: strip(L.pairs), quotes: strip(L.quotes),
  scenes: strip(L.scenes), says: strip(L.says), open: strip(L.open), practice: strip(L.practice),
  terms: strip(T.glossary.filter(g => g.lesson === n)),
  ...(n === 4 ? { objections: strip(T.sos.objections.filter(o => !o.excluded).map(o => ({ id: o.id, cat: o.cat, obj: o.obj, say: o.say }))) } : {}),
  ...(n === 3 && T.sos.skeleton ? { skeleton: T.sos.skeleton.text } : {}),
};
console.log(JSON.stringify(out, null, 1));
