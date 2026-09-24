// Ф1: split meeting sources into ~15KB shards on paragraph boundaries.
// Deterministic (rule 7): same input -> same shard files, same names.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'v2/corpus/_shards');
fs.mkdirSync(OUT, { recursive: true });

const MAX = 15000; // bytes target per shard

function splitIntoShards(text) {
  // split on blank-line paragraph boundaries, pack greedily up to MAX bytes
  const paras = text.split(/\n\s*\n/);
  const shards = [];
  let cur = [];
  let curLen = 0;
  for (const p of paras) {
    const pLen = Buffer.byteLength(p, 'utf8') + 2;
    if (curLen > 0 && curLen + pLen > MAX) {
      shards.push(cur.join('\n\n'));
      cur = [];
      curLen = 0;
    }
    cur.push(p);
    curLen += pLen;
  }
  if (cur.length) shards.push(cur.join('\n\n'));
  return shards;
}

// sources: [source_id, absolute-ish path relative to ROOT]
const rootFiles = fs.readdirSync(ROOT);
function findNovy(n) {
  return rootFiles.find(f => f.includes(n + '.txt') && !/^\d/.test(f));
}

const sources = [];
for (let i = 34; i <= 40; i++) {
  const fn = findNovy(String(i));
  if (fn) sources.push([`N${i}`, fn]);
}
// meetings: priority RU05, RU08 first among M, but we generate all; dispatch order handled separately
const meetingSources = [
  ['M01-UA', 'x/train_01.docx.txt'], ['M01-RU', 'x/train_01.src.txt'],
  ['M02-UA', 'x/train_02.docx.txt'], ['M02-RU', 'x/train_02.src.txt'],
  ['M03-UA', 'x/train_03.docx.txt'], ['M03-RU', 'x/train_03.src.txt'],
  ['M04-UA', 'x/train_04.docx.txt'], ['M04-RU', 'x/train_04.src.txt'],
  ['M05-UA', 'x/train_05.docx.txt'], ['M05-RU', 'x/train_05.src.txt'],
  // M06-09 UA skipped: duplicate RU01-04 (verified in Ф0)
  ['M06-RU', 'x/train_06.src.txt'],
  ['M07-RU', 'x/train_07.src.txt'],
  ['M08-RU', 'x/train_08.src.txt'],
  ['M09-RU', 'x/train_09.src.txt'],
  ['M10-UA', 'x/train_10.docx.txt'], ['M10-RU', 'x/train_10.src.txt'],
  ['M11-UA', 'x/train_11.docx.txt'], ['M11-RU', 'x/train_11.src.txt'],
  ['M12-UA', 'x/train_12.docx.txt'], ['M12-RU', 'x/train_12.src.txt'],
  ['M13-UA', 'x/train_13.docx.txt'], ['M13-RU', 'x/train_13.src.txt'],
  ['M14-UA', 'x/train_14.docx.txt'],
  ['M15-UA', 'x/train_15.docx.txt'],
];
sources.push(...meetingSources);

const plan = [];
for (const [id, relPath] of sources) {
  const abs = path.join(ROOT, relPath);
  const text = fs.readFileSync(abs, 'utf8');
  const shards = splitIntoShards(text);
  shards.forEach((s, idx) => {
    const chunkName = `${id}_c${String(idx + 1).padStart(2, '0')}`;
    fs.writeFileSync(path.join(OUT, chunkName + '.txt'), s, 'utf8');
    plan.push({ source_id: id, source_path: relPath, chunk: chunkName, bytes: Buffer.byteLength(s, 'utf8') });
  });
}

fs.writeFileSync(path.join(ROOT, 'v2/corpus/shard_plan.json'), JSON.stringify(plan, null, 1));
console.log('Total shards:', plan.length);
const bySource = {};
for (const p of plan) bySource[p.source_id] = (bySource[p.source_id] || 0) + 1;
console.log(bySource);
