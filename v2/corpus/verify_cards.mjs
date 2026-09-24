// Скрипт-перевірка дослівності цитат (правило 4) + матриця покриття (правило 5).
// Запуск: node v2/corpus/verify_cards.mjs
// Перевіряє кожен .jsonl у v2/corpus/cards/: чи є text_verbatim буквально
// (з нормалізацією пробілів) у відповідному файлі-шарді v2/corpus/_shards/<chunk>.txt.
// Картки, що не пройшли перевірку, виводяться в unverified.json і НЕ рахуються.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/Users/User/Desktop/Аудио_курс учебный';
const CARDS_DIR = path.join(ROOT, 'v2/corpus/cards');
const SHARDS_DIR = path.join(ROOT, 'v2/corpus/_shards');
const PLAN = JSON.parse(fs.readFileSync(path.join(ROOT, 'v2/corpus/shard_plan.json'), 'utf8'));

function norm(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

const cardFiles = fs.readdirSync(CARDS_DIR).filter(f => f.endsWith('.jsonl'));
const verified = [];
const unverified = [];
const emptyShards = [];
const parseErrors = [];
const coverage = {}; // chunk -> {status, card_count}

for (const chunk of PLAN.map(p => p.chunk)) coverage[chunk] = { status: 'MISSING', card_count: 0 };

for (const cf of cardFiles) {
  const chunkFromFilename = cf.replace(/\.jsonl$/, '');
  const shardPath = path.join(SHARDS_DIR, chunkFromFilename + '.txt');
  const shardText = fs.existsSync(shardPath) ? norm(fs.readFileSync(shardPath, 'utf8')) : null;
  const lines = fs.readFileSync(path.join(CARDS_DIR, cf), 'utf8').split('\n').map(l => l.trim()).filter(Boolean);

  let sawEmptyReason = false;
  let cardCount = 0;
  for (const line of lines) {
    let obj;
    try { obj = JSON.parse(line); } catch (e) {
      parseErrors.push({ file: cf, line });
      continue;
    }
    if (obj.empty_reason) {
      sawEmptyReason = true;
      continue;
    }
    cardCount++;
    if (!obj.text_verbatim || !shardText) {
      unverified.push({ ...obj, _file: cf, _reason: 'no text_verbatim or shard missing' });
      continue;
    }
    const q = norm(obj.text_verbatim);
    if (shardText.includes(q)) {
      verified.push(obj);
    } else {
      unverified.push({ ...obj, _file: cf, _reason: 'quote not found verbatim in shard' });
    }
  }
  coverage[chunkFromFilename] = {
    status: sawEmptyReason ? 'EMPTY' : (cardCount > 0 ? 'COVERED' : 'MISSING'),
    card_count: cardCount,
  };
}

const missing = Object.entries(coverage).filter(([, v]) => v.status === 'MISSING').map(([k]) => k);

fs.writeFileSync(path.join(ROOT, 'v2/corpus/cards_verified.json'), JSON.stringify(verified, null, 1));
fs.writeFileSync(path.join(ROOT, 'v2/corpus/cards_unverified.json'), JSON.stringify(unverified, null, 1));
fs.writeFileSync(path.join(ROOT, 'v2/corpus/coverage_matrix.json'), JSON.stringify({
  total_shards: PLAN.length,
  covered: Object.values(coverage).filter(v => v.status === 'COVERED').length,
  empty: Object.values(coverage).filter(v => v.status === 'EMPTY').length,
  missing: missing.length,
  missing_chunks: missing,
  coverage,
}, null, 1));

console.log('verified cards:', verified.length, '| unverified (dropped):', unverified.length, '| parse errors:', parseErrors.length);
console.log('shards covered:', Object.values(coverage).filter(v=>v.status==='COVERED').length, '| empty:', Object.values(coverage).filter(v=>v.status==='EMPTY').length, '| MISSING:', missing.length, '/', PLAN.length);
if (missing.length) console.log('missing chunks (first 20):', missing.slice(0,20));
if (parseErrors.length) console.log('parse errors:', JSON.stringify(parseErrors.slice(0,5)));
