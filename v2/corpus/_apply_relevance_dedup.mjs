// Ф1.5: позначити дублі та relevance у кожній картці. НІЧОГО не видаляє —
// лише додає поля `is_duplicate`, `duplicate_of`, `relevance`, `relevance_note`
// у кожен рядок кожного *.jsonl у v2/corpus/cards/ (крім EMPTY_REASONS.md
// і рядків {"empty_reason":...}, які не є картками).
//
// Relevance — відносно заявленої мети курсу (тільки телефон; реактивація
// і зростання обороту ПОСТІЙНИХ клієнтів, не холодна база/нові ліди):
//   high   — пряма техніка телефонного продажу постійному/реактивованому
//            клієнту: вступ, гачок, історія замовлень/ім'я, презентація,
//            заперечення+відповідь, допродаж, закриття, інтонація/темп
//   medium — контекст/показники (KPI, конверсія, норми дзвінків) корисні
//            для розуміння, але не є прямою технікою розмови; або техніка,
//            що стосується холодної бази/FB-лідів, а не реактивації
//   low    — не про телефонний продаж постійним клієнтам (внутрішня CRM,
//            організація навчання, нерелевантна побутова розмова)
//
// Дедуплікація: точний збіг нормалізованого text_verbatim -> позначається
// duplicate_of = card_id першого входження (порядок за файлами з sort()).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/Users/User/Desktop/Аудио_курс учебный';
const CARDS_DIR = path.join(ROOT, 'v2/corpus/cards');

function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }

const HIGH_PATTERNS = [
  /постійн\w* клієнт/i, /раніше.*замовлен/i, /історі/i, /по імен/i, /гачок/i,
  /презентаці/i, /заклик до дії/i, /закритт\w* угод/i, /обробк\w* заперечен/i,
  /допродаж/i, /вступ/i, /відкритт\w* дзвінк/i, /скрипт/i, /інтонаці/i, /голос/i,
  /терміновіст/i, /дедлайн/i, /апсейл/i, /персоналізаці/i, /соціальн\w* доказ/i,
  /ціновий анкоринг/i, /подарунк/i, /акці/i, /реактиваці/i,
];
const MEDIUM_PATTERNS = [
  /конверсі/i, /норма дзвінк/i, /kpi/i, /план\w* продаж/i, /холодн\w* баз/i,
  /fb.?лід/i, /схожі ліди/i, /калькулятор/i, /crm/i, /передоплат/i,
  /рекордн\w* кас/i, /середній чек/i,
];
const LOW_PATTERNS = [
  /навчанн\w* курс/i, /тривалість курсу/i, /кнопк\w* crm/i, /статус\w* конвеєр/i,
  /квіз/i, /дизайн.*озвучк/i,
];

function classify(card) {
  const hay = norm((card.lesson_hint || '') + ' ' + (card.text_verbatim || '') + ' ' + (card.note || ''));
  if (LOW_PATTERNS.some(re => re.test(hay))) {
    return { relevance: 'low', relevance_note: 'організаційний/технічний контент, не техніка продажу постійному клієнту' };
  }
  if (HIGH_PATTERNS.some(re => re.test(hay))) {
    return { relevance: 'high', relevance_note: 'пряма техніка телефонного продажу (вступ/гачок/презентація/заперечення/допродаж/закриття), застосовна до реактивації постійних клієнтів' };
  }
  if (MEDIUM_PATTERNS.some(re => re.test(hay))) {
    return { relevance: 'medium', relevance_note: 'контекст/показники або техніка для холодної бази — корисно, але не пряма техніка реактивації' };
  }
  // дефолт за типом картки
  if (['rule', 'phrase', 'objection_answer', 'criterion'].includes(card.type)) {
    return { relevance: 'medium', relevance_note: 'загальна техніка продажу без явного маркера реактивації/постійного клієнта — потребує ручної звірки' };
  }
  return { relevance: 'medium', relevance_note: 'не вдалося однозначно класифікувати автоматично — потребує ручної звірки' };
}

// UA<->RU пари однієї зустрічі (з manifest.json: M01-M15, крім M06-09 UA,
// які взагалі виключені зі списку джерел як дублі RU01-04 - див. Ф0).
// Переклад != дослівний збіг рядків, тому це не авто-дедуп по тексту, а
// позначка "у цієї картки є пара іншою мовою по тій самій зустрічі" -
// для ручної звірки при синтезі, а не для автоматичного відкидання.
//
// Правило власника (2026-09-24, після Ф1 хвилі 6): RU (.src.txt) - першоджерело,
// UA (.docx.txt) - переклад. brief.md (розділ джерел, рядки 72-73, 80) НЕ
// стверджує, яка мова первинна - лише називає їх "русская/украинская
// транскрипция" і документує дублі UA06-09=RU01-04. Тому це рішення
// власника, не факт з brief.md, зафіксовано тут як застосована політика:
// при розбіжності сенсу між UA і RU версією однієї зустрічі - пріоритет RU.
const SAME_MEETING_PAIR = {};
const HAS_RU_PAIR = new Set(); // meeting numbers (01-15) that have a RU (primary) version
for (let i = 1; i <= 15; i++) {
  const nn = String(i).padStart(2, '0');
  SAME_MEETING_PAIR[`ОБ-UA${nn}`] = `ОБ-RU${nn}`;
  SAME_MEETING_PAIR[`ОБ-RU${nn}`] = `ОБ-UA${nn}`;
}
// M14, M15 - тільки UA, RU-версії немає (перевірено у Ф0: fs.existsSync на train_14/15.src.txt)
for (let i = 1; i <= 13; i++) HAS_RU_PAIR.add(String(i).padStart(2, '0'));

function pairMeta(sourceId) {
  const m = /^ОБ-(UA|RU)(\d{2})$/.exec(sourceId || '');
  if (!m) return { pair_id: null, primary_lang: null, is_primary_source: null };
  const [, lang, nn] = m;
  const hasPair = HAS_RU_PAIR.has(nn);
  return {
    pair_id: `M${nn}`,
    primary_lang: hasPair ? 'ru' : null, // політика власника: RU - першоджерело, де є пара
    is_primary_source: hasPair ? (lang === 'RU') : null,
  };
}

const SHARDS_DIR = path.join(ROOT, 'v2/corpus/_shards');

function jaccardWords(a, b) {
  const wa = new Set(norm(a).split(' ').filter(Boolean));
  const wb = new Set(norm(b).split(' ').filter(Boolean));
  if (wa.size === 0 || wb.size === 0) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  const union = new Set([...wa, ...wb]).size;
  return inter / union;
}

// context_before/context_after: 1 сусідній абзац-репліка з файлу-шарда,
// знайдений по місцю входження text_verbatim (той самий поділ на абзаци,
// що й _build_shards.mjs: розрив по порожньому рядку). Якщо цитата
// зустрічається в шарді >1 разу дослівно - позначаємо ambiguous_location.
const shardParaCache = new Map();
function getParas(chunk) {
  if (shardParaCache.has(chunk)) return shardParaCache.get(chunk);
  const p = path.join(SHARDS_DIR, chunk + '.txt');
  if (!fs.existsSync(p)) { shardParaCache.set(chunk, null); return null; }
  const text = fs.readFileSync(p, 'utf8');
  const paras = text.split(/\n\s*\n/);
  shardParaCache.set(chunk, paras);
  return paras;
}
function findContext(chunk, quote) {
  const paras = getParas(chunk);
  if (!paras) return { context_before: null, context_after: null, ambiguous_location: null };
  const q = norm(quote);
  const matches = [];
  for (let i = 0; i < paras.length; i++) {
    if (norm(paras[i]).includes(q)) matches.push(i);
  }
  if (matches.length === 0) return { context_before: null, context_after: null, ambiguous_location: 'quote not found in any paragraph (shard boundary or split artifact)' };
  const i = matches[0];
  return {
    context_before: i > 0 ? paras[i - 1].trim().slice(0, 400) : null,
    context_after: i < paras.length - 1 ? paras[i + 1].trim().slice(0, 400) : null,
    ambiguous_location: matches.length > 1 ? `quote matched ${matches.length} paragraphs in shard - took first` : null,
  };
}

const files = fs.readdirSync(CARDS_DIR).filter(f => f.endsWith('.jsonl'));
const allCards = []; // {file, idx, obj}
for (const f of files.sort()) {
  const lines = fs.readFileSync(path.join(CARDS_DIR, f), 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  lines.forEach((line, idx) => {
    const obj = JSON.parse(line);
    if (obj.empty_reason) return; // не картка
    allCards.push({ file: f, idx, obj });
  });
}

// Дедуплікація: ТІЛЬКИ близький/точний збіг тексту (rule власника: RU і UA
// версії однієї зустрічі НЕ вважати дублями за змістом - вони різними
// мовами і RU може містити матеріал, якого немає в UA; позначаємо дубль
// лише коли текст майже співпадає). Тому:
//  - точний нормалізований збіг -> дубль завжди
//  - "майже збіг" (Jaccard по словах >= 0.9) -> дубль ТІЛЬКИ якщо обидві
//    картки однієї мови (не пара primary/UA з різних source_id за pairMeta)
const seen = new Map(); // normText -> first card_id
for (let idx = 0; idx < allCards.length; idx++) {
  const item = allCards[idx];
  const key = norm(item.obj.text_verbatim);
  if (seen.has(key)) {
    item.obj.is_duplicate = true;
    item.obj.duplicate_of = seen.get(key);
    item.obj.duplicate_reason = 'exact normalized text match';
  } else {
    seen.set(key, item.obj.card_id);
    item.obj.is_duplicate = false;
    item.obj.duplicate_of = null;
    item.obj.duplicate_reason = null;
  }
  const ctx = findContext(item.obj.chunk, item.obj.text_verbatim);
  item.obj.context_before = ctx.context_before;
  item.obj.context_after = ctx.context_after;
  item.obj.ambiguous_location = ctx.ambiguous_location;
  const { relevance, relevance_note } = classify(item.obj);
  item.obj.relevance = relevance;
  item.obj.relevance_note = relevance_note;
  item.obj.same_meeting_pair_source = SAME_MEETING_PAIR[item.obj.source_id] || null;
  const { pair_id, primary_lang, is_primary_source } = pairMeta(item.obj.source_id);
  item.obj.pair_id = pair_id;
  item.obj.primary_lang = primary_lang;
  item.obj.is_primary_source = is_primary_source;
}

// Друга проходка: "майже дублі" (Jaccard по словах >= 0.9), ТІЛЬКИ між
// картками ОДНАКОВОЇ мови джерела (source_id має однаковий префікс UA/RU)
// - явно НЕ звіряємо між UA і RU версіями однієї зустрічі (rule власника:
// RU може містити матеріал, якого немає в UA, це не дублі за змістом,
// навіть якщо обидва описують ту саму тему).
function langOf(sourceId) {
  const m = /^ОБ-(UA|RU)/.exec(sourceId || '');
  return m ? m[1] : (sourceId || '').slice(0, 3); // для N-джерел просто group by source_id
}
for (let i = 0; i < allCards.length; i++) {
  const a = allCards[i].obj;
  if (a.is_duplicate) continue; // вже позначено точним збігом
  for (let j = 0; j < i; j++) {
    const b = allCards[j].obj;
    if (langOf(a.source_id) !== langOf(b.source_id)) continue; // різні мови/джерела - не порівнюємо
    if (a.pair_id && b.pair_id && a.pair_id === b.pair_id && a.source_id !== b.source_id) continue; // UA/RU пара - ніколи не дублі
    const sim = jaccardWords(a.text_verbatim, b.text_verbatim);
    if (sim >= 0.9) {
      a.is_duplicate = true;
      a.duplicate_of = b.card_id;
      a.duplicate_reason = `near-duplicate text (Jaccard=${sim.toFixed(2)}), same language/source`;
      break;
    }
  }
}

// перезаписати кожен файл, зберігаючи порожні-шардові рядки як були
for (const f of files.sort()) {
  const filePath = path.join(CARDS_DIR, f);
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  const rebuilt = lines.map(line => {
    const obj = JSON.parse(line);
    if (obj.empty_reason) return JSON.stringify(obj);
    const match = allCards.find(c => c.file === f && c.obj.card_id === obj.card_id);
    return JSON.stringify(match.obj);
  });
  fs.writeFileSync(filePath, rebuilt.join('\n') + '\n', 'utf8');
}

// лічильники
const byType = {};
const byRelevance = {};
let dupCount = 0;
for (const item of allCards) {
  byType[item.obj.type] = (byType[item.obj.type] || 0) + 1;
  byRelevance[item.obj.relevance] = (byRelevance[item.obj.relevance] || 0) + 1;
  if (item.obj.is_duplicate) dupCount++;
}
console.log('Total cards processed:', allCards.length);
console.log('Duplicates marked (not removed):', dupCount);
console.log('By type:', byType);
console.log('By relevance:', byRelevance);
