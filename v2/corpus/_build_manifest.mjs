// Ф0: build v2/corpus/manifest.json from SOURCES_REGISTER.md table + filesystem + classification.json
// One-off build script, kept for reproducibility (rule 7: same input -> same output).
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REG = fs.readFileSync(path.join(ROOT, 'v2/handoff/SOURCES_REGISTER.md'), 'utf8');
const cl = JSON.parse(fs.readFileSync(path.join(ROOT, 'v2/audit/transcripts/classification.json'), 'utf8'));

function sha256(p) {
  try {
    const buf = fs.readFileSync(p);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch (e) {
    return null;
  }
}
function sizeOf(p) {
  try { return fs.statSync(p).size; } catch (e) { return null; }
}

// index classification.json calls by filename for outcome + quote + dup-of
const callOutcome = new Map(); // filename -> {type, outcome, quote, note}
for (const c of cl.calls) {
  const [fn, type, outcome, quote, note] = c;
  callOutcome.set(fn, { type, outcome, quote, note: note || null });
}
const dupPairs = cl.dup; // array of [dup_filename, canonical_filename]
const dupOf = new Map();
for (const [dupFn, canonFn] of dupPairs) dupOf.set(dupFn, canonFn);
const excludedOther = new Map(); // filename -> reason
for (const [fn, reason] of cl.excluded) excludedOther.set(fn, reason);

const entries = [];

// --- E01-E26 etalon ---
for (let i = 1; i <= 26; i++) {
  const nn = String(i).padStart(2, '0');
  const p = `x/etalon_${nn}.docx.txt`;
  const abs = path.join(ROOT, p);
  entries.push({
    id: `E${nn}`,
    type: 'эталон',
    path: p,
    size_bytes: sizeOf(abs),
    sha256: sha256(abs),
    dup_of: null,
    outcome_group: null, // не классифицировался в этой сессии (см. RECONCILE.md)
  });
}

// --- C001-C085 calls (from classification.json, dup, excluded) ---
// 73 classified + 11 dup + 1 excluded = 85, in file order matching SOURCES_REGISTER numbering.
let cCounter = 1;
function nextCid() { return `C${String(cCounter++).padStart(3, '0')}`; }

// helper to find actual on-disk path for a call filename (root-level, may need raw byte lookup for mojibake names)
const rootFiles = fs.readdirSync(ROOT);
function resolveRootFile(fn) {
  if (rootFiles.includes(fn)) return fn;
  return null;
}

for (const c of cl.calls) {
  const [fn, type, outcome, quote, note] = c;
  const resolved = resolveRootFile(fn) || fn;
  const abs = path.join(ROOT, resolved);
  entries.push({
    id: nextCid(),
    type: 'звонок',
    path: resolved,
    size_bytes: sizeOf(abs),
    sha256: sha256(abs),
    dup_of: null,
    outcome_group: outcome, // успіх / відмова / інше / повторний контакт / частина дзвінка
    note: note || null,
  });
}
for (const [dupFn, canonFn] of dupPairs) {
  const resolved = resolveRootFile(dupFn) || dupFn;
  const abs = path.join(ROOT, resolved);
  entries.push({
    id: nextCid(),
    type: 'звонок (дубль)',
    path: resolved,
    size_bytes: sizeOf(abs),
    sha256: sha256(abs),
    dup_of: canonFn,
    outcome_group: null,
  });
}
for (const [fn, reason] of cl.excluded) {
  const resolved = resolveRootFile(fn) || fn;
  const abs = path.join(ROOT, resolved);
  entries.push({
    id: nextCid(),
    type: 'звонок (виключено)',
    path: resolved,
    size_bytes: sizeOf(abs),
    sha256: sha256(abs),
    dup_of: null,
    outcome_group: null,
    exclusion_reason: reason,
  });
}

// --- M01-M15 training meetings (UA docx.txt + RU src.txt where present) ---
for (let i = 1; i <= 15; i++) {
  const nn = String(i).padStart(2, '0');
  const uaPath = `x/train_${nn}.docx.txt`;
  const ruPath = `x/train_${nn}.src.txt`;
  const uaAbs = path.join(ROOT, uaPath);
  const ruAbs = path.join(ROOT, ruPath);
  const hasRu = fs.existsSync(ruAbs);
  entries.push({
    id: `M${nn}`,
    type: 'встреча',
    path: uaPath,
    variant: 'ОБ-UA' + nn,
    size_bytes: sizeOf(uaAbs),
    sha256: sha256(uaAbs),
    dup_of: null,
    outcome_group: null,
    ru_variant_path: hasRu ? ruPath : null,
    ru_variant_id: hasRu ? 'ОБ-RU' + nn : null,
    ru_variant_sha256: hasRu ? sha256(ruAbs) : null,
    ru_variant_size_bytes: hasRu ? sizeOf(ruAbs) : null,
  });
}

// --- N34-N40 "Новий запис" meetings (mojibake filenames on disk) ---
const novyRe = /^.*[Зз]апис\s*3[4-9]\.txt$|^.*[Зз]апис\s*40\.txt$/;
// filenames are stored with mangled bytes; find by raw listing + numeric suffix match
const novyFiles = rootFiles.filter(f => /3[4-9]\.txt$|40\.txt$/.test(f) && f.length > 15 && !/^\d/.test(f));
for (let i = 34; i <= 40; i++) {
  const match = novyFiles.find(f => f.includes(String(i) + '.txt'));
  const abs = match ? path.join(ROOT, match) : null;
  entries.push({
    id: `N${i}`,
    type: 'встреча (Новий запис, тип A)',
    path: match || null,
    size_bytes: match ? sizeOf(abs) : null,
    sha256: match ? sha256(abs) : null,
    dup_of: null,
    outcome_group: null,
    note: 'джерело контенту (зустріч), не дзвінок — не входить у пул 99',
  });
}

// --- A01-A16 archive/docs ---
const archives = [
  ['A01', 'x/mentor_archive.xlsx.txt'],
  ['A02', 'x/mentor_structure.docx.txt'],
  ['A03', 'x/course_retail.docx.txt'],
  ['A04', 'x/course_hot.docx.txt'],
  ['A05', 'x/skript_hb2.docx.txt'],
  ['A06', 'x/zaperechennya.docx.txt'],
  ['A07', 'x/pryama_liniya.docx.txt'],
  ['A08', 'image_2025-10-16_19-43-34.png'],
  ['A09', 'input/kurs_12_navykov_draft.md'],
  ['A10', '12 навичок.txt'],
  ['A11', 'dogovoritsya-mozhno-obo-vsem-txt/Dogovoritsya_mozhno_obo_vsem txt.txt'],
  ['A12', 'Текстовый документ.txt'],
  ['A13', 'v2/audit/video_map.json'],
  ['A14', 'v2/audit/chzv.md'],
  ['A15', 'v2/audit/call_library.json'],
  ['A16', 'v2/audio-raw/ПРОЧИТАЙ.txt'],
];
for (const [id, p] of archives) {
  const abs = path.join(ROOT, p);
  entries.push({
    id, type: 'архів', path: p,
    size_bytes: sizeOf(abs), sha256: sha256(abs),
    dup_of: null, outcome_group: null,
  });
}

fs.writeFileSync(
  path.join(ROOT, 'v2/corpus/manifest.json'),
  JSON.stringify({ generated_by: '_build_manifest.mjs', generated_note: 'Ф0 інвентаризація', total: entries.length, entries }, null, 1)
);
console.log('Written', entries.length, 'entries');
console.log('Novy files found:', novyFiles);
