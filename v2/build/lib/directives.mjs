import { inlineRender, escapeHtml, slugify } from './md.mjs';
import {
  cardIconSvg,
  videoIconSvg, flowArrowSvg, loopIconSvg, loopConnectorSvg, lessonSceneSvg, lessonSceneCaption,
} from './svg.mjs';
import { sectionIllo } from './illos-loader.mjs';

// ============ COVER ============
// kind: 'urok' | 'day' | 'vstup' | 'course' | 'sos'
export function renderCover(fields, kind, opts = {}) {
  const nazva = fields['назва'] || '';
  const pidzag = fields['підзаголовок'] || '';

  if (kind === 'sos') {
    return `
    <div class="mockup-panel"><div class="sos-cover">
      <span class="badge">SOS</span>
      <h1>${inlineRender(nazva)}</h1>
      ${pidzag ? `<p class="sub">${inlineRender(pidzag)}</p>` : ''}
    </div></div>`;
  }

  const isDay = kind === 'day';
  const dayNum = parseInt(fields['день'], 10) || 0;
  const colorIdx = dayNum ? ((dayNum - 1) % 5) + 1 : 1;
  const cls = `cover tint-c${colorIdx}` + (isDay ? ' day-cover' : (kind === 'course' ? ' course-cover' : ''));
  // один факт у бейджі, без конкатенації через " · "
  let eyebrow;
  if (kind === 'urok' || kind === 'day') {
    // «з» лишається малою: у капсі Manrope «З» читається як цифра 3 («ДЕНЬ 1 3 5»)
    eyebrow = fields['день'] ? `День ${escapeHtml(fields['день'])}&nbsp;<span class="nocaps">з</span>&nbsp;5` : '';
  } else if (kind === 'vstup') {
    eyebrow = 'Вступ до курсу';
  } else {
    eyebrow = opts.eyebrow || '';
  }
  const titleHtml = kind === 'urok'
    ? `Урок ${escapeHtml(fields['урок'] || '')}.<br><em>${inlineRender(nazva)}</em>`
    : (kind === 'day'
      ? `День ${escapeHtml(fields['день'] || '')}.<br><em>${inlineRender(nazva)}</em>`
      : `<em>${inlineRender(nazva)}</em>`);

  return `
  <div class="mockup-panel"><div class="${cls}">
    ${eyebrow ? `<span class="cover-eyebrow">${eyebrow}</span>` : ''}
    <h1 class="cover-title">${titleHtml}</h1>
    ${pidzag ? `<p class="cover-sub">${inlineRender(pidzag)}</p>` : ''}
    <div class="cover-plaque"></div>
  </div></div>`;
}

// ============ SCENE (inline illustration) ============
// Одноколірна лінійна ілюстрація (DESIGN_SYSTEM) — тільки там, де для сторінки
// є заготовлена сцена в lessonSceneSvg (наразі лише урок 1); інакше — нічого.
export function renderScene(fields, ctx) {
  const svg = lessonSceneSvg(ctx && ctx.pageSlug);
  if (!svg) return '';
  // Патерн мокапу уроку 9: сцена кольором --brand у картці --paper з приглушеним підписом.
  if (ctx && ctx.redesign) {
    const main = sectionIllo(ctx.pageSlug, 'Що це');
    if (main) return `<figure class="scene-card">${main.svg}${main.caption ? `<figcaption>${escapeHtml(main.caption)}</figcaption>` : ''}</figure>`;
    const caption = lessonSceneCaption(ctx.pageSlug);
    return `<figure class="scene-card">${svg.replace(/var\(--ink\)/g, 'var(--brand)')}${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>`;
  }
  return `<div class="scene-block">${svg}</div>`;
}

// ============ STAT GROUP ============
function ringSvg(total, active, color) {
  return `<svg class="ring" data-ring data-total="${total}" data-active="${active}" data-color="${color}" viewBox="0 0 120 120"></svg>`;
}

function pseudoRand(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return (h % 60) / 100 + 0.2; // 0.2..0.8
}

// Tier 1 — найсильніша цифра уроку: велика, з інфографікою (кільце/бар/шкала),
// колір завжди --brand (єдиний акцент, без ротації кольорів по індексу).
// Без іконок (SPEC/DESIGN_SYSTEM: іконка лишається тільки для трьох типів заперечень).
function renderStatTier1(fields) {
  const form = fields['форма'] || 'число';
  const chyslo = fields['число'] || '';
  const pidpys = fields['підпис'] || '';
  const dzherelo = fields['джерело'] || '';
  const posylannia = fields['посилання'] || '';
  const ringMatch = chyslo.match(/^(\d+)\s*з\s*(\d+)$/);
  const cmpMatch = chyslo.match(/^(.+?)\s+проти\s+(.+)$/i);

  let visual;
  if (form === 'частка' && ringMatch) {
    const total = parseInt(ringMatch[2], 10);
    const active = parseInt(ringMatch[1], 10);
    visual = `<div class="ring-wrap">${ringSvg(total, active, 'var(--brand)')}</div><div class="big-num">${escapeHtml(chyslo)}</div>`;
  } else if (form === 'порівняння' && cmpMatch) {
    const a = cmpMatch[1].trim(), b = cmpMatch[2].trim();
    const na = (a.match(/\d+/) || [10])[0] * 1;
    const nb = (b.match(/\d+/) || [10])[0] * 1;
    const max = Math.max(na, nb, 1);
    visual = `
      <div class="cmp-bar-row">
        <div class="cmp-bar a"><span>${escapeHtml(a)}</span></div>
        <div class="track"><div class="fill" style="width:${Math.max(18, na / max * 100)}%"></div></div>
        <div class="cmp-bar b"><span>${escapeHtml(b)}</span></div>
        <div class="track"><div class="fill" style="width:${Math.max(18, nb / max * 100)}%"></div></div>
      </div>`;
  } else if (form === 'шкала') {
    // Only draw what the data says: a percent range becomes real segments; otherwise no marker.
    const pcts = (chyslo.match(/\d+(?=\s*%|\s*[–-]\s*\d+\s*%)/g) || []).map(Number).filter(n => n <= 100);
    let track = '';
    if (pcts.length === 4) {
      const seg = (a, b, cls) => `<div class="range ${cls}" style="left:${a}%;width:${b - a}%"></div>`;
      track = `<div class="scale-track">${seg(pcts[0], pcts[1], 'from')}${seg(pcts[2], pcts[3], 'to')}</div>
      <div class="scale-axis"><span>0%</span><span>50%</span><span>100%</span></div>`;
    }
    visual = `
      <div class="big-num" style="font-size:16px">${inlineRender(chyslo)}</div>
      ${track}`;
  } else {
    visual = `<div class="big-num">${inlineRender(chyslo)}</div>`;
  }

  let sourceHtml = '';
  if (dzherelo) {
    if (posylannia) {
      sourceHtml = `<br><span style="opacity:.6;font-weight:500">Джерело: <a class="stat-source-link" href="${escapeHtml(posylannia)}" target="_blank" rel="noopener">${inlineRender(dzherelo)} ↗</a></span>`;
    } else {
      sourceHtml = `<br><span style="opacity:.6;font-weight:500">Джерело: ${inlineRender(dzherelo)}</span>`;
    }
  }

  return `
    <div class="stat-tier1">
      ${visual}
      <div class="num-caption">${inlineRender(pidpys)}${sourceHtml}</div>
    </div>`;
}

// Tier 2 — решта цифр уроку: дрібні чипи (число + короткий підпис, 4-6 слів), без картки-в-картці.
// Джерело «підпис» — повне речення з уроку; для чипа показуємо лише перші слова,
// щоб чип лишався чипом, а не повноширинним абзацом. Повний текст нікуди не губиться —
// він лишається в markdown-джерелі, тут тільки скорочене прев'ю.
function truncateWords(text, maxWords) {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '…';
}
function renderStatChip(fields) {
  const chyslo = fields['число'] || '';
  const full = fields['підпис'] || '';
  const pidpys = truncateWords(full, 6);
  const titleAttr = pidpys !== full ? ` title="${escapeHtml(full)}"` : '';
  return `<span class="stat-chip"${titleAttr}><b>${inlineRender(chyslo)}</b> ${inlineRender(pidpys)}</span>`;
}

// Inline pull-quote для :::stat з "подача: цитата" — число + підпис прямо в
// тексті, без картки, без інфографіки. Джерело показуємо як просте посилання.
export function renderPullQuote(fields, ctx) {
  const chyslo = fields['число'] || '';
  if (ctx && ctx.redesign) return renderPqItem(fields);
  const pidpys = fields['підпис'] || '';
  const dzherelo = fields['джерело'] || '';
  const posylannia = fields['посилання'] || '';
  let sourceHtml = '';
  if (dzherelo) {
    sourceHtml = posylannia
      ? ` <a class="stat-source-link" href="${escapeHtml(posylannia)}" target="_blank" rel="noopener">${inlineRender(dzherelo)} ↗</a>`
      : ` ${inlineRender(dzherelo)}`;
  }
  return `<p class="stat-pullquote"><b>${inlineRender(chyslo)}</b> — ${inlineRender(pidpys)}${sourceHtml ? `<span class="stat-pullquote-src">Джерело:${sourceHtml}</span>` : ''}</p>`;
}

// Патерн DOU «цифра + підпис»: велике число, під ним підпис; для «N з M» — тонка смужка-частка поруч із числом.
function renderPqItem(fields) {
  const chyslo = (fields['число'] || '').trim();
  const m = chyslo.match(/^(\d+)\s*з\s*(\d+)$/);
  const dzherelo = fields['джерело'] || '';
  const posylannia = fields['посилання'] || '';
  const src = dzherelo ? (posylannia
    ? `<a class="stat-source-link" href="${escapeHtml(posylannia)}" target="_blank" rel="noopener">${inlineRender(dzherelo)} ↗</a>`
    : inlineRender(dzherelo)) : '';
  // «графік: ні» — число не є часткою з підрахунку (оцінка наставника, приріст, значення оцінок) → без графіка
  const noChart = (fields['графік'] || '').trim() === 'ні';
  let bar = m && !noChart ? `<span class="pq-bar" role="img" aria-label="${m[1]} з ${m[2]}"><i style="width:${(Math.min(+m[1] / +m[2], 1) * 100).toFixed(1)}%"></i></span>` : '';
  // порівняння у відсотках («72% проти 48% і 52%») — міні-стовпчики по кожному значенню, перше — акцентне
  const pcts = (fields['форма'] || '') === 'порівняння' ? (chyslo.match(/\d+(?:[.,]\d+)?(?=\s*%)/g) || []).map(v => parseFloat(v.replace(',', '.'))) : [];
  // стовпчики — лише для порівняння часток: без приростів («+9%») і без діапазонів («93–94%»)
  const shareCmp = !/\+\s*\d/.test(chyslo) && !/\d\s*[–-]\s*\d/.test(chyslo);
  if (!bar && !noChart && shareCmp && pcts.length >= 2 && pcts.every(v => v <= 100)) {
    bar = `<span class="pq-cols" role="img" aria-label="${escapeHtml(chyslo)}">${pcts.map((v, i) => `<span class="pq-col${i === 0 ? ' on' : ''}"><i style="height:${v}%"></i><b>${String(v).replace('.', ',')}%</b></span>`).join('')}</span>`;
  }
  const mitka = fields['мітка'] ? `<span class="mvp-label">${escapeHtml(fields['мітка'])}</span>` : '';
  return `<div class="pq-item">${mitka}<p class="pq-num">${inlineRender(chyslo)}</p>${bar}<p class="pq-text">${inlineRender(fields['підпис'] || '')}</p>${src ? `<p class="pq-src">Джерело: ${src}</p>` : ''}</div>`;
}

// Tier 1 за патерном мокапу уроку 9: донат поруч із числом і підписом.
// Лише для "N з M" (частка); верхня межа ("до N з M") та інші форми сюди не потрапляють —
// для них лишається велике число без графіка (правило Tier-1, затверджено 2026-09-23).
// У центрі — «N» і «з M», ніколи «N/M» (SPEC п.0.2).
function donutSvg(active, total) {
  const C = 2 * Math.PI * 42;
  const fill = Math.min(active / total, 1) * C;
  return `<svg class="donut" viewBox="0 0 100 100" role="img" aria-label="${active} з ${total}">
    <circle cx="50" cy="50" r="42" fill="none" class="donut-track" stroke-width="10"/>
    <circle cx="50" cy="50" r="42" fill="none" class="donut-fill" stroke-width="10" stroke-linecap="round" stroke-dasharray="${fill.toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 50 50)"/>
    <text x="50" y="52" text-anchor="middle" class="donut-num">${active}</text>
    <text x="50" y="68" text-anchor="middle" class="donut-of">з ${total}</text>
  </svg>`;
}
function renderStatHero(fields) {
  const chyslo = (fields['число'] || '').trim();
  const m = chyslo.match(/^(\d+)\s*з\s*(\d+)$/);
  // донат — лише для «N з M» у формі «частка»; «число», верхня межа («до N з M») тощо — та сама смуга без графіка
  const donut = (fields['форма'] || '') === 'частка' && m && (fields['графік'] || '').trim() !== 'ні';
  const dzherelo = fields['джерело'] || '';
  const posylannia = fields['посилання'] || '';
  const src = dzherelo ? (posylannia
    ? `<a class="stat-source-link" href="${escapeHtml(posylannia)}" target="_blank" rel="noopener">${inlineRender(dzherelo)} ↗</a>`
    : inlineRender(dzherelo)) : '';
  return `
  <div class="stat-hero${donut ? '' : ' no-chart'}">
    ${donut ? donutSvg(parseInt(m[1], 10), parseInt(m[2], 10)) : ''}
    <div class="stat-hero-text">
      <p class="stat-hero-label">Головна цифра уроку${fields['мітка'] ? ` <span class="mvp-label">${escapeHtml(fields['мітка'])}</span>` : ''}</p>
      <p class="stat-hero-big">${escapeHtml(chyslo)}</p>
      <p class="stat-hero-main">${inlineRender(fields['підпис'] || '')}</p>
      ${src ? `<p class="stat-hero-src">Джерело: ${src}</p>` : ''}
    </div>
  </div>`;
}

export function renderStatGroup(items, ctx) {
  const [first, ...rest] = items;
  if (ctx && ctx.redesign && first && !rest.length) {
    const hero = renderStatHero(first);
    if (hero) return hero;
  }
  const tier1Html = first ? renderStatTier1(first) : '';
  const chipsHtml = rest.map(renderStatChip).join('');
  return `
  <div class="stat-panel">
    <div class="stat-panel-head"><span class="label">Цифри уроку</span></div>
    ${tier1Html}
    ${chipsHtml ? `<div class="stat-chips">${chipsHtml}</div>` : ''}
  </div>`;
}

// ============ CARDS ============
// Без іконок (DESIGN_SYSTEM: іконка лишається лише для трьох типів заперечень) —
// перше поле картки (колишнє слово-іконка) ігнорується.
export function renderCards(fields) {
  const zag = fields['заголовок'] || '';
  const cards = fields.cards || [];
  const items = cards.map(parts => {
    const [, title, ...bits] = parts;
    const bitsHtml = bits.map(b => `<p class="obj-bit">${inlineRender(b)}</p>`).join('');
    return `
      <div class="obj-card">
        <h4>${inlineRender(title || '')}</h4>
        <hr>
        ${bitsHtml}
      </div>`;
  }).join('');
  return `
  <div class="cardsec">
    ${zag ? `<div class="cardsec-head"><h3>${inlineRender(zag)}</h3></div>` : ''}
    <div class="cards-row">${items}</div>
  </div>`;
}

// ============ PAIRS «Помилка / Як правильно» ============
// Той самий контраст «слабко / сильно», що в картках-цитатах «Як це звучить у житті».
// :::pairs / картка: <помилка> | <як правильно> / :::
export function renderPairs(fields) {
  // порожнє «як правильно» (в уроці немає органічної відповіді) — показуємо лише помилку, нічого не дописуємо
  const items = (fields.cards || []).map(([bad, good]) => `
    <div class="pair-card">
      <div class="pair-row bad"><span class="quote-tag weak">Помилка</span><p>${inlineRender(bad || '')}</p></div>
      ${good ? `<div class="pair-row good"><span class="quote-tag strong">Як правильно</span><p>${inlineRender(good)}</p></div>` : ''}
    </div>`).join('');
  return `<div class="pairs">${items}</div>`;
}

// ============ INSIGHT (двоколонковий блок-інсайт під заголовком уроку) ============
// :::insight / картка: ТЕЗА CAPS | пояснювальний текст / картка: ... / :::
export function renderInsight(fields) {
  const cards = fields.cards || [];
  const items = cards.map(([lead, text]) => `
    <div class="insight-card">
      <p class="insight-lead">${inlineRender(lead || '')}</p>
      <p class="insight-text">${inlineRender(text || '')}</p>
    </div>`).join('');
  return `<div class="insight-grid">${items}</div>`;
}

// ============ QUIZ (реальний вибір, DESIGN_SYSTEM) ============
export function renderQuiz(q, ctx) {
  const id = `q-${(ctx && ctx.pageSlug) || 'quiz'}-${q.num}`;
  const opts = q.options.map(o =>
    `<button type="button" class="quiz-opt" data-letter="${escapeHtml(o.letter)}">${inlineRender(o.text)}</button>`
  ).join('');
  return `
  <div class="quiz-q quiz-interactive" id="${id}" data-qnum="${escapeHtml(q.num)}" data-correct="${escapeHtml(q.correct)}"${q.why ? ` data-why="${escapeHtml(q.why)}"` : ''}>
    <div class="q-title">${escapeHtml(q.num)}. ${inlineRender(q.title)}</div>
    <div class="quiz-opts">${opts}</div>
    <p class="q-feedback" hidden></p>
  </div>`;
}

// ============ QUOTE ============
export function renderQuote(fields) {
  const otsinka = (fields['оцінка'] || '').toLowerCase();
  const isStrong = otsinka.startsWith('сильно');
  const tagCls = isStrong ? 'strong' : 'weak';
  const tagText = isStrong ? 'Сильно' : 'Слабко';
  const who = fields['хто'] || '';
  const tekst = fields['текст'] || '';
  const chomu = fields['чому'] || '';
  return `
  <div class="quote-card">
    <span class="quote-tag ${tagCls}">${tagText}</span><span class="quote-who">${inlineRender(who)}</span>
    <p class="quote-text">${inlineRender(tekst)}</p>
    ${chomu ? `<p class="quote-why"><b>Чому:</b> ${inlineRender(chomu)}</p>` : ''}
  </div>`;
}

// ============ VIDEO ============
export function renderVideo(fields, videos) {
  if (!videos || !videos.length) return '';
  const cards = videos.map(v => `
    <div class="video-card">
      <div class="video-ico">${videoIconSvg()}</div>
      <div class="video-meta">
        <div class="video-title">${escapeHtml(v.title || v.назва || 'Відео')}</div>
        <div class="video-sub">${escapeHtml(v.author || v.автор || '')}</div>
      </div>
      ${(String(v.url || '').match(/(?:v=|youtu\.be\/)([\w-]{11})/) || [])[1] ? `<button type="button" class="video-play" aria-pressed="false" data-yt="${(String(v.url).match(/(?:v=|youtu\.be\/)([\w-]{11})/))[1]}">▶ Дивитися тут</button>` : ''}
      <a class="video-link" href="${escapeHtml(v.url || v.посилання || '#')}" target="_blank" rel="noopener">Дивитись на YouTube</a>
    </div>`).join('');
  return cards;
}

// ============ EXTVIDEO (зовнішнє відео-джерело з поясненням, макет "Відео") ============
// :::extvideo / назва / автор / мова / посилання / взяти / уроки (markdown-посилання) / :::
export function renderExtVideo(fields) {
  const nazva = fields['назва'] || '';
  const avtor = fields['автор'] || '';
  const mova = fields['мова'] || '';
  const url = fields['посилання'] || '';
  const vzyaty = fields['взяти'] || '';
  const uroky = fields['уроки'] || '';
  const meta = [avtor, mova ? `мова: ${mova}` : ''].filter(Boolean).join(' · ');
  const ytId = (String(url).match(/(?:v=|youtu\.be\/)([\w-]{11})/) || [])[1];
  return `
  <div class="video-card extvideo-card">
    <div class="video-ico">${videoIconSvg()}</div>
    <div class="video-meta">
      <div class="video-title">${inlineRender(nazva)}</div>
      ${meta ? `<div class="video-sub">${escapeHtml(meta)}</div>` : ''}
      ${vzyaty ? `<p class="extvideo-take"><b>Що взяти для наших дзвінків:</b> ${inlineRender(vzyaty)}</p>` : ''}
      ${uroky ? `<p class="extvideo-lessons">До уроку: ${inlineRender(uroky)}</p>` : ''}
    </div>
    ${ytId ? `<button type="button" class="video-play" aria-pressed="false" data-yt="${ytId}">▶ Дивитися тут</button>` : ''}
    <a class="video-link" href="${escapeHtml(url || '#')}" target="_blank" rel="noopener">Дивитись на YouTube</a>
  </div>`;
}

// ============ CALL FLOW (макет 4) ============
export function renderCallFlow() {
  const arrow = () => `<div class="flow-arrow">${flowArrowSvg(false)}</div>`;
  const dashedArrow = () => `<div class="flow-arrow dashed">${flowArrowSvg(true)}</div>`;
  return `
  <div class="flowsec">
    <div class="flowsec-head"><h3>Шлях дзвінка</h3><p>Від вступу до прощання — з петлею на запереченнях</p></div>
    <div class="flow">
      <div class="flow-step"><span class="num">1</span><span class="txt">Вступ</span></div>
      ${arrow()}
      <div class="flow-step"><span class="num">2</span><span class="txt">Гачок</span></div>
      ${dashedArrow()}
      <div class="flow-step optional"><span class="num">3</span><span class="txt">Прив'язка до історії</span><span class="flow-tag">можна пропустити</span></div>
      ${arrow()}
      <div class="flow-step"><span class="num">4</span><span class="txt">Презентація сету</span></div>
      ${arrow()}
      <div class="flow-step"><span class="num">5</span><span class="txt">Ціна й умови</span></div>
      ${arrow()}
      <div class="loop-zone">
        <span class="loop-label">${loopIconSvg()}петля — до 2–3 разів</span>
        <div class="loop-inner">
          <div class="flow-step"><span class="num">6</span><span class="txt">Заклик до дії</span></div>
          <div class="loop-connector">${loopConnectorSvg()}після кожної відповіді — знову заклик</div>
          <div class="flow-step"><span class="num">7</span><span class="txt">Заперечення</span></div>
        </div>
      </div>
      ${dashedArrow()}
      <div class="branch-note">тільки після повторного «дорого»</div>
      <div class="flow-step optional"><span class="num">8</span><span class="txt">Альтернатива і спуск</span></div>
      ${arrow()}
      <div class="flow-step"><span class="num">9</span><span class="txt">Допродаж</span></div>
      ${arrow()}
      <div class="flow-step"><span class="num">10</span><span class="txt">Доставка й оплата</span></div>
      ${arrow()}
      <div class="flow-step"><span class="num">11</span><span class="txt">Підсумок і прощання</span></div>
    </div>
  </div>`;
}

// ============ Типи заперечень — дефолтні картки (макет 3) ============
// Єдине місце на сайті, де лишається іконка — вона кодує сам тип заперечення.
export function renderObjectionTypesCards() {
  const rows = [
    ['fire', 'Істинні', 'дорого, немає грошей, є ікра вдома, сумнів у якості', 'даємо два-три аргументи по суті й повертаємось до заклику до дії'],
    ['clock', 'Ситуативні', 'Укрпошта, спека, «чому така низька ціна»', 'одна-дві фрази по суті — і одразу до оформлення'],
    ['question', 'Хибні', '«подумаю», «порадюсь», «незручно»', 'одне питання-гіпотеза, без слова «чому»'],
  ];
  const cards = rows.map(([icon, title, ex, action]) => `
    <div class="obj-card">
      <div class="obj-ico">${cardIconSvg(icon)}</div>
      <h4>${title}</h4>
      <hr>
      <p class="obj-bit"><b>Приклади:</b> ${ex}.</p>
      <p class="obj-bit"><b>Що робимо:</b> ${action}.</p>
    </div>`).join('');
  return `
  <div class="cardsec">
    <div class="cardsec-head"><h3>Три види заперечень</h3></div>
    <div class="cards-row">${cards}</div>
  </div>`;
}

// ============ SAY («Скажи так») ============
// Формат:
// :::say
// ситуація: ...
// скажи: «...»
// чому: ...
// урок: 4            (необов'язково)
// ключі: слово, слово (необов'язково, у видачу не потрапляє — тільки в пошуковий індекс)
// :::
export function renderSay(fields, ctx) {
  const situation = fields['ситуація'] || fields['ситуация'] || '';
  const sayText = fields['скажи'] || '';
  const chomu = fields['чому'] || '';
  const lessonNum = (fields['урок'] || '').trim();
  const keysRaw = fields['ключі'] || fields['ключи'] || '';
  const keys = keysRaw.split(',').map(s => s.trim()).filter(Boolean);

  const id = slugify(situation || 'skazhy-tak', ctx && ctx.slugSet);
  if (ctx && ctx.sayCards) {
    ctx.sayCards.push({ id, sit: situation, say: sayText.replace(/^[«"]|[»"]$/g, ''), keys, u: `${ctx.pageSlug}.html` });
  }

  const copyText = escapeHtml(sayText.replace(/^«|»$/g, '').replace(/^"|"$/g, ''));
  const moreHtml = lessonNum
    ? `<a class="say-more" href="urok-${String(lessonNum).padStart(2, '0')}.html">Детальніше: Урок ${escapeHtml(lessonNum)}</a>`
    : '';

  const cat = (ctx && ctx.currentH2) || '';
  return `
  <div class="say-card" id="${id}" data-keys="${escapeHtml(keys.join(', '))}" data-cat="${escapeHtml(cat)}">
    <div class="say-body">
      <div class="say-row">
        <span class="say-label">Ситуація</span>
        <p class="say-sit">${inlineRender(situation)}</p>
      </div>
      <div class="say-plaque">
        <span class="say-tag">СКАЖИ ТАК:</span>
        <p class="say-phrase">${inlineRender(sayText)}</p>
      </div>
      ${chomu ? `<p class="say-why"><b>Чому це працює:</b> ${inlineRender(chomu)}</p>` : ''}
      <div class="say-actions">
        <button type="button" class="say-copy" data-copy="${copyText}" data-copied-label="Скопійовано" data-default-label="Скопіювати фразу">Скопіювати фразу</button>
        ${moreHtml}
      </div>
    </div>
  </div>`;
}
