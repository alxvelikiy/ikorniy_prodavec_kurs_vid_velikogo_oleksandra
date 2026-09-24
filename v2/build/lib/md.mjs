// Мінімальний markdown-парсер під потреби курсу Ikorka Shop.
// Без npm-залежностей. Розуміє: :::директиви:::, заголовки #/##/###,
// абзаци, списки (- , 1. , - [ ]), таблиці, > цитати, **жирний**, *курсив*, [текст](url).

const TRANSLIT = {
  а:'a',б:'b',в:'v',г:'h',ґ:'g',д:'d',е:'e',є:'ie',ж:'zh',з:'z',и:'y',
  і:'i',ї:'i',й:'i',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',
  т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ь:'',ю:'iu',я:'ia',
  "'":'',"’":'',"«":'',"»":''
};

export function slugify(text, usedSet) {
  let s = String(text).toLowerCase();
  let out = '';
  for (const ch of s) {
    if (TRANSLIT[ch] !== undefined) out += TRANSLIT[ch];
    else if (/[a-z0-9]/.test(ch)) out += ch;
    else out += '-';
  }
  out = out.replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!out) out = 'section';
  if (usedSet) {
    let base = out, n = 2;
    while (usedSet.has(out)) { out = `${base}-${n}`; n++; }
    usedSet.add(out);
  }
  return out;
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Переписує внутрішні .md-посилання у .html за конвенцією курсу.
export function rewriteMdLink(href) {
  const m = href.match(/^([^#?]*\.md)(#.*)?$/i);
  if (!m) return href;
  let [, path, anchor] = m;
  const file = path.split('/').pop();
  const dir = path.slice(0, path.length - file.length);
  let base = file.replace(/\.md$/i, '');
  let mapped;
  if (base === 'intro') mapped = 'vstup';
  else if (base === 'video') mapped = 'video';
  else if (/^urok_(\d+)$/.test(base)) mapped = 'urok-' + base.match(/^urok_(\d+)$/)[1].padStart(2, '0');
  else if (/^den_(\d+)$/.test(base)) mapped = 'den-' + base.match(/^den_(\d+)$/)[1].padStart(2, '0');
  else mapped = base;
  return mapped + '.html' + (anchor || '');
}

function inlineRender(raw) {
  let s = escapeHtml(raw);
  // посилання [текст](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, txt, href) => {
    const h = /\.md(#.*)?$/i.test(href) ? rewriteMdLink(href) : href;
    return `<a href="${h}">${txt}</a>`;
  });
  // голі URL (напр. у списку відео) — автолінк
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<>"']+)/g, (m, pre, url) => `${pre}<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
  // жирний
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // курсив (одна зірка, не зачіпає вже вставлені теги)
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  return s;
}

export { inlineRender };

function isBlockStartLine(line) {
  return /^:::\S/.test(line) || /^#{1,6}\s/.test(line) || /^\s*\|.*\|\s*$/.test(line) ||
    /^\s*>/.test(line) || /^\s*([-*]|\d+\.)\s+/.test(line);
}

function parseDirectiveFields(lines, type) {
  if (type === 'scene') {
    return { opis: lines.join(' ').trim() };
  }
  const fields = {};
  const cards = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^([^:]+):\s?(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2];
    if (key === 'картка') {
      cards.push(val.split('|').map(s => s.trim()));
    } else {
      fields[key] = val.trim();
    }
  }
  if (cards.length) fields.cards = cards;
  return fields;
}

export function parseBlocks(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { i++; continue; }

    // directive
    let m = line.match(/^:::(\S+)\s*$/);
    if (m) {
      const type = m[1];
      i++;
      const content = [];
      while (i < lines.length && lines[i].trim() !== ':::') { content.push(lines[i]); i++; }
      i++; // closing :::
      blocks.push({ kind: 'directive', type, fields: parseDirectiveFields(content, type) });
      continue;
    }

    // heading
    m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      blocks.push({ kind: 'heading', level: m[1].length, text: m[2].trim() });
      i++;
      continue;
    }

    // table
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i]); i++; }
      const parseRow = r => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      const header = parseRow(rows[0]);
      const bodyRows = rows.slice(2).map(parseRow); // skip separator row
      blocks.push({ kind: 'table', header, rows: bodyRows });
      continue;
    }

    // blockquote
    if (/^\s*>/.test(line)) {
      const q = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { q.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      blocks.push({ kind: 'blockquote', text: q.join(' ') });
      continue;
    }

    // list (bullet, numbered, checkbox) — з lazy-continuation рядками
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
          const content = l.replace(/^\s*([-*]|\d+\.)\s+/, '');
          items.push([content]);
          i++;
        } else if (l.trim() !== '' && /^\s+\S/.test(l) && items.length) {
          items[items.length - 1].push(l.trim());
          i++;
        } else {
          break;
        }
      }
      blocks.push({ kind: 'list', ordered, items: items.map(l => l.join('\n')) });
      continue;
    }

    // paragraph (зберігаємо рядки окремо — потрібно для блоків «Перевір себе»)
    {
      const p = [];
      while (i < lines.length && lines[i].trim() !== '' && !isBlockStartLine(lines[i])) {
        p.push(lines[i].trim());
        i++;
      }
      blocks.push({ kind: 'para', lines: p, text: p.join(' ') });
    }
  }
  return blocks;
}

// Групує послідовні directive:stat блоки в один statgroup.
// :::stat з полем "подача: цитата" виключається з групування і йде окремим
// блоком kind:'pullquote' — рендериться inline на своєму місці в тексті,
// а не в панелі "Цифри уроку" (DESIGN_SYSTEM: нечислові/другорядні твердження —
// pull-quote у прозі, не картка). Лишає рівно один (або нуль) :::stat на
// групування — той і стає Tier-1 панеллю; урок без жодного непозначеного
// :::stat лишається взагалі без Tier-1-панелі.
export function groupStats(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.kind === 'directive' && b.type === 'stat') {
      if ((b.fields['подача'] || '').trim() === 'цитата') {
        out.push({ kind: 'pullquote', fields: b.fields });
        continue;
      }
      const last = out[out.length - 1];
      if (last && last.kind === 'statgroup') { last.items.push(b.fields); continue; }
      out.push({ kind: 'statgroup', items: [b.fields] });
    } else {
      out.push(b);
    }
  }
  return out;
}

// Групує пару блоків «**N. Питання** / A. .. B. .. / Правильна відповідь: X»
// в один блок kind:'quiz' — реальний вибір замість toggle. Питання без літерних
// варіантів (відкриті, «Звір себе:») цей прохід не займає — лишаються як були.
export function groupQuiz(blocks) {
  const out = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.kind === 'para' && b.lines && b.lines.length > 1) {
      const qMatch = b.lines[0].match(/^\*\*(\d+)\.\s*(.+?)\*\*\s*$/);
      const optLines = b.lines.slice(1);
      const allOpts = optLines.length > 0 && optLines.every(l => /^[A-ZА-Я]\.\s/.test(l));
      const next = blocks[i + 1];
      const nextText = next && next.kind === 'para' ? (next.lines || [next.text]).join(' ').trim() : '';
      // «Правильна відповідь: B» або «Правильна відповідь: B — пояснення» (пояснення показуємо після кліку)
      const revealMatch = nextText.match(/^Правильна відповідь:\s*([A-ZА-Я])\s*\.?\s*(?:[—–-]\s*(.+))?$/);
      if (qMatch && allOpts && revealMatch) {
        const options = optLines.map(l => {
          const m = l.match(/^([A-ZА-Я])\.\s*(.*)$/);
          return { letter: m[1], text: m[2] };
        });
        out.push({ kind: 'quiz', num: qMatch[1], title: qMatch[2], options, correct: revealMatch[1], why: revealMatch[2] || '' });
        i++; // поглинути блок з "Правильна відповідь:"
        continue;
      }
    }
    out.push(b);
  }
  return out;
}

const REVEAL_PREFIXES = ['Правильна відповідь:', 'Звір себе:'];

function splitReveal(text) {
  const lines = text.split('\n');
  for (let idx = 0; idx < lines.length; idx++) {
    const trimmed = lines[idx].trim();
    if (REVEAL_PREFIXES.some(p => trimmed.startsWith(p))) {
      return { main: lines.slice(0, idx).join(' ').trim(), reveal: lines.slice(idx).join(' ').trim() };
    }
  }
  return { main: text.replace(/\n/g, ' ').trim(), reveal: null };
}

export function renderListItem(raw, checklistCtx) {
  let text = raw;
  let checked = false;
  let isCheckbox = false;
  const cbMatch = text.match(/^\[( |x|X)\]\s*(.*)$/s);
  if (cbMatch) {
    isCheckbox = true;
    checked = cbMatch[1].toLowerCase() === 'x';
    text = cbMatch[2];
  }
  const { main, reveal } = splitReveal(text);
  let html = inlineRender(main);
  let revealHtml = '';
  if (reveal) {
    revealHtml = `<details class="reveal"><summary>Показати відповідь</summary><div class="reveal-body">${inlineRender(reveal)}</div></details>`;
  }
  return { isCheckbox, checked, html, revealHtml };
}

export { splitReveal };
