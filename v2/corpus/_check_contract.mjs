// Перевірка контракту (без агентів): у кожній картці мають бути непорожні
// card_id, source_id, chunk, type, text_verbatim, locator, speaker, basis,
// lesson_hint. Не проходять - позначаються contract_valid:false +
// contract_missing_fields:[...], НЕ видаляються.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CARDS_DIR = path.join(ROOT, 'v2/corpus/cards');
const REQUIRED = ['card_id', 'source_id', 'chunk', 'type', 'text_verbatim', 'locator', 'speaker', 'basis', 'lesson_hint'];

function isEmpty(v) {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

const files = fs.readdirSync(CARDS_DIR).filter(f => f.endsWith('.jsonl'));
let totalCards = 0;
let failing = 0;
const byField = {};
for (const f of REQUIRED) byField[f] = 0;

for (const f of files) {
  const filePath = path.join(CARDS_DIR, f);
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  const rebuilt = lines.map(line => {
    const obj = JSON.parse(line);
    if (obj.empty_reason) return JSON.stringify(obj); // не картка
    totalCards++;
    const missing = REQUIRED.filter(k => isEmpty(obj[k]));
    if (missing.length > 0) {
      failing++;
      for (const m of missing) byField[m]++;
      obj.contract_valid = false;
      obj.contract_missing_fields = missing;
    } else {
      obj.contract_valid = true;
      obj.contract_missing_fields = [];
    }
    return JSON.stringify(obj);
  });
  fs.writeFileSync(filePath, rebuilt.join('\n') + '\n', 'utf8');
}

console.log('Total cards checked:', totalCards);
console.log('Failing contract (marked, not removed):', failing);
console.log('By field:', byField);
