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
const SAME_MEETING_PAIR = {};
for (let i = 1; i <= 15; i++) {
  const nn = String(i).padStart(2, '0');
  SAME_MEETING_PAIR[`ОБ-UA${nn}`] = `ОБ-RU${nn}`;
  SAME_MEETING_PAIR[`ОБ-RU${nn}`] = `ОБ-UA${nn}`;
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

// дедуплікація за нормалізованим text_verbatim, порядок = порядок файлів (sort) + порядок рядків
const seen = new Map(); // normText -> first card_id
for (const item of allCards) {
  const key = norm(item.obj.text_verbatim);
  if (seen.has(key)) {
    item.obj.is_duplicate = true;
    item.obj.duplicate_of = seen.get(key);
  } else {
    seen.set(key, item.obj.card_id);
    item.obj.is_duplicate = false;
    item.obj.duplicate_of = null;
  }
  const { relevance, relevance_note } = classify(item.obj);
  item.obj.relevance = relevance;
  item.obj.relevance_note = relevance_note;
  item.obj.same_meeting_pair_source = SAME_MEETING_PAIR[item.obj.source_id] || null;
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
