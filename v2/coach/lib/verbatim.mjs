// Дослівна звірка з текстами уроків — та сама нормалізація, що й у v2/mvp/tools/content-lib.mjs
// (копія без залежностей, щоб сервер тренера запускався окремо; збіг перевіряє static-checks.mjs).

export function normText(s) {
  return String(s == null ? '' : s)
    .normalize('NFC')
    .replace(/\*\*|__/g, '')
    .replace(/[«»„“”"]/g, '"')
    .replace(/[’ʼ`‘']/g, "'")
    .replace(/[‒–—―]/g, '—')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Фрагмент є в нормалізованому тексті (з допуском на трикрапку й лапки по краях)
export function inText(hayNorm, fragment) {
  const f = normText(fragment);
  if (!f) return false;
  if (hayNorm.includes(f)) return true;
  const trimmed = f.replace(/^(…|\.\.\.)\s*/, '').replace(/\s*(…|\.\.\.)$/, '').replace(/^"|"$/g, '').trim();
  return trimmed.length > 0 && hayNorm.includes(trimmed);
}

// Частка «N з M» — за замовчуванням на сайті не показується, тренер її теж не радить
export function hasShare(s) { return /\d+(?:[.,]\d+)?\s*(?:з|із)\s*\d+|двадцяти\s+шести/i.test(String(s || '')); }

// Довгі цифрові послідовності (телефони, номери замовлень) маскуються до відправки
export function maskDigits(t) { return String(t || '').replace(/\d[\d\s\-()]{4,}\d/g, '***'); }
