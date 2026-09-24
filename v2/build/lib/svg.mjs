// Бібліотека переюзуваних SVG-сцен та лінійних іконок у стилі неонових світлових вивісок
// (neon sign line-art): рівні скруглені лінії, подвійний шар (яскрава лінія + розмите
// світіння через SVG filter feGaussianBlur), 2–3 неонових кольори на сцену, без заливок
// облич, охайна анатомія (пропорції дорослої людини, кисті рук, гарнітура).
// Кольори — лише токени дизайнера (контракт SPEC), з фолбеками про всяк випадок.

const NEON = {
  pink: 'var(--neon-pink, #FF2E97)',
  orange: 'var(--neon-orange, #FF8A00)',
  yellow: 'var(--neon-yellow, #FFE45C)',
  violet: 'var(--neon-violet, #9D4DFF)',
  green: 'var(--neon-green, #39FF88)',
  cyan: 'var(--neon-cyan, #2EF2FF)',
};

// Лічильник для унікальних id <filter> — щоб кілька сцен на одній сторінці
// (наприклад кілька карток :::say з однаковою сценою point-say) не конфліктували.
let UID = 0;
function nextId(prefix) { UID += 1; return `${prefix}${UID}`; }

function neonFilter(id, std = 2.4) {
  return `
  <filter id="${id}" x="-120%" y="-120%" width="340%" height="340%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceGraphic" stdDeviation="${std}" result="blur"/>
    <feMerge>
      <feMergeNode in="blur"/>
      <feMergeNode in="blur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>`;
}

// ---------- примітиви неонової трубки: розмите світіння (через filter) + яскраве ядро ----------
function tube(d, color, filterId, width = 3.2) {
  const core = (width * 0.3).toFixed(2);
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" filter="url(#${filterId})"/>` +
    `<path d="${d}" fill="none" stroke="#fff" stroke-width="${core}" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>`;
}
function tubeCircle(cx, cy, r, color, filterId, width = 3.2) {
  const core = (width * 0.3).toFixed(2);
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${width}" filter="url(#${filterId})"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="${core}" opacity=".55"/>`;
}
function tubeRect(x, y, w, h, rx, color, filterId, width = 3) {
  const core = (width * 0.3).toFixed(2);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke="${color}" stroke-width="${width}" filter="url(#${filterId})"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke="#fff" stroke-width="${core}" opacity=".5"/>`;
}
function neonText(x, y, str, color, filterId, size = 24) {
  return `<text x="${x}" y="${y}" font-family="'Manrope',sans-serif" font-weight="800" font-size="${size}" fill="${color}" text-anchor="middle" filter="url(#${filterId})">${str}</text>`;
}

function wrap(inner, vb = '0 0 400 300') {
  return `<svg viewBox="${vb}" fill="none" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

// ---------- кисть руки: долоня-дуга + три коротких пальці-риски (без заливок) ----------
function hand(x, y, angleDeg, color, filterId, s = 1) {
  return `<g transform="translate(${x} ${y}) rotate(${angleDeg})">
    ${tube(`M${-6 * s} 0 Q${-6 * s} ${-7 * s} 0 ${-7 * s} Q${6 * s} ${-7 * s} ${6 * s} 0`, color, filterId, 2.4 * s)}
    ${tube(`M${-3.4 * s} ${-7 * s} l${-1.4 * s} ${-5 * s} M0 ${-7.6 * s} l0 ${-5.6 * s} M${3.4 * s} ${-7 * s} l${1.4 * s} ${-5 * s}`, color, filterId, 1.8 * s)}
  </g>`;
}

// ---------- голова: коло + короткі риски очей і рот-дуга, без заливки обличчя ----------
function headGlyph(cx, cy, r, color, filterId, s, mood) {
  const eyeY = cy - 1 * s;
  const eyes = `${tube(`M${cx - 9 * s} ${eyeY} l${4 * s} 0`, color, filterId, 2 * s)}${tube(`M${cx + 5 * s} ${eyeY} l${4 * s} 0`, color, filterId, 2 * s)}`;
  const mouth = mood === 'confused'
    ? tube(`M${cx - 4 * s} ${cy + 9 * s} Q${cx} ${cy + 5 * s} ${cx + 4 * s} ${cy + 9 * s}`, color, filterId, 1.8 * s)
    : tube(`M${cx - 5 * s} ${cy + 7 * s} Q${cx} ${cy + 11 * s} ${cx + 5 * s} ${cy + 7 * s}`, color, filterId, 1.8 * s);
  const brows = mood === 'confused'
    ? `${tube(`M${cx - 10 * s} ${cy - 9 * s} l3 -3`, color, filterId, 1.6 * s)}${tube(`M${cx + 7 * s} ${cy - 12 * s} l3 3`, color, filterId, 1.6 * s)}`
    : '';
  return tubeCircle(cx, cy, r, color, filterId, 3 * s) + eyes + mouth + brows;
}

// ---------- базова фігура дорослої людини: голова + шия + тулуб + ноги (без рук) ----------
function personBase(cx, feetY, color, filterId, s, mood) {
  const headR = 20 * s, headCy = feetY - 200 * s;
  const shY = headCy + 34 * s, shHalf = 32 * s;
  const waistY = shY + 58 * s, waistHalf = 19 * s;
  const hipY = shY + 76 * s, hipHalf = 24 * s;
  const kneeY = hipY + 45 * s;
  const feetHalf = 25 * s;
  const shL = { x: cx - shHalf, y: shY }, shR = { x: cx + shHalf, y: shY };
  const hipL = { x: cx - hipHalf, y: hipY }, hipR = { x: cx + hipHalf, y: hipY };

  const neck = tube(`M${cx - 5 * s} ${headCy + headR - 2 * s} L${cx - 5 * s} ${shY}`, color, filterId, 2.4 * s) +
    tube(`M${cx + 5 * s} ${headCy + headR - 2 * s} L${cx + 5 * s} ${shY}`, color, filterId, 2.4 * s);
  const torso =
    tube(`M${shL.x} ${shL.y} C${cx - waistHalf - 6 * s} ${waistY - 16 * s} ${cx - waistHalf} ${waistY} ${hipL.x} ${hipL.y}`, color, filterId, 3.2 * s) +
    tube(`M${shR.x} ${shR.y} C${cx + waistHalf + 6 * s} ${waistY - 16 * s} ${cx + waistHalf} ${waistY} ${hipR.x} ${hipR.y}`, color, filterId, 3.2 * s) +
    tube(`M${shL.x} ${shL.y} Q${cx} ${shY - 9 * s} ${shR.x} ${shR.y}`, color, filterId, 2.8 * s) +
    tube(`M${hipL.x} ${hipL.y} Q${cx} ${hipY + 7 * s} ${hipR.x} ${hipR.y}`, color, filterId, 2.8 * s);
  const legs =
    tube(`M${hipL.x} ${hipL.y} C${hipL.x - 3 * s} ${kneeY - 6 * s} ${cx - feetHalf + 7 * s} ${kneeY + 8 * s} ${cx - feetHalf} ${feetY}`, color, filterId, 3 * s) +
    tube(`M${hipR.x} ${hipR.y} C${hipR.x + 3 * s} ${kneeY - 6 * s} ${cx + feetHalf - 7 * s} ${kneeY + 8 * s} ${cx + feetHalf} ${feetY}`, color, filterId, 3 * s) +
    tube(`M${cx - feetHalf} ${feetY} l${-13 * s} 0`, color, filterId, 2.8 * s) +
    tube(`M${cx + feetHalf} ${feetY} l${13 * s} 0`, color, filterId, 2.8 * s);
  const head = headGlyph(cx, headCy, headR, color, filterId, s, mood);
  return { html: head + neck + torso + legs, shL, shR, hipL, hipR, headCy, headR, shY };
}

// ---------- рука від плеча: зміщення ліктя/кисті відносно плеча (side: -1 ліворуч, 1 праворуч) ----------
function arm(sh, side, elbowOff, handOff, color, filterId, s, fingerAngle) {
  const e = { x: sh.x + side * elbowOff[0] * s, y: sh.y + elbowOff[1] * s };
  const h = { x: sh.x + side * handOff[0] * s, y: sh.y + handOff[1] * s };
  const d = `M${sh.x} ${sh.y} Q${e.x} ${e.y} ${h.x} ${h.y}`;
  return tube(d, color, filterId, 2.9 * s) + hand(h.x, h.y, fingerAngle, color, filterId, s);
}
function bubble(x, y, w, h, color, filterId, tailX) {
  const rect = tubeRect(x - w / 2, y - h / 2, w, h, 16, color, filterId, 2.6);
  const tail = tube(`M${tailX - 9} ${y + h / 2} L${tailX + 9} ${y + h / 2} L${tailX - 2} ${y + h / 2 + 16} Z`, color, filterId, 2.2);
  return rect + tail;
}

// ============================================================
// ДІЛОВІ НАПІВ-ІЗОМЕТРИЧНІ СЦЕНИ (office management, viewBox 400×300)
// Заливки з градієнтами на кожну велику площину, м'яка тінь на «підлозі»,
// підсвітка зверху (radial glow) і неоновий контровий світ ТІЛЬКИ по краю
// силуету (тонка лінія + невеликий blur), а не суцільний контур навколо фігури.
// Люди не розфарбовані неоном — темна ділова база (#1A1030…#2C1450) + шкіра/
// сорочка світлими акцентами; неон лише як джерело світла (rim/glow/акценти).
// ============================================================
const BIZ = {
  blazerLight: '#3E2170', blazerMid: '#2C1450', blazerDark: '#170B28',
  skinLight: '#F3C9A6', skinMid: '#D89A6E',
  shirtLight: '#F6EEFF', shirtMid: '#CFC2E8',
  deskTop: '#311D4E', deskTopDark: '#1C0F30',
  deskFront: '#1B0E2D', deskFrontDark: '#0D0618',
  deskSide: '#150B24', deskSideDark: '#08040F',
  metal: '#5A4A80', metalDark: '#241238',
  paper: '#EDE6FA', paperDark: '#B9ACD6',
};

function grad(id, kind, stops, c = {}) {
  const tag = kind === 'radial' ? 'radialGradient' : 'linearGradient';
  const pos = kind === 'radial'
    ? `cx="${c.cx ?? 0.35}" cy="${c.cy ?? 0.3}" r="${c.r ?? 0.75}"`
    : `x1="${c.x1 ?? 0}" y1="${c.y1 ?? 0}" x2="${c.x2 ?? 0}" y2="${c.y2 ?? 1}"`;
  const stopsHtml = stops.map(([off, color, op]) => `<stop offset="${off}" stop-color="${color}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('');
  return `<${tag} id="${id}" ${pos}>${stopsHtml}</${tag}>`;
}
function blurFilter(id, std) {
  return `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${std}"/></filter>`;
}
function glowFilter(id, std = 1.5) {
  return `<filter id="${id}" x="-140%" y="-140%" width="380%" height="380%"><feGaussianBlur stdDeviation="${std}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
}
function floorShadow(cx, cy, rx, ry, blurId) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#050212" opacity=".5" filter="url(#${blurId})"/>`;
}
function topGlow(cx, cy, r, color, gid) {
  return `<defs>${grad(gid, 'radial', [[0, color, .3], [1, color, 0]])}</defs><ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.6}" fill="url(#${gid})"/>`;
}
function rimStroke(d, color, glowId, width = 1.8, opacity = .75) {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}" filter="url(#${glowId})"/>`;
}

// ---------- стіл: стільниця + фронтальна грань + бокова грань (об'ємна ізометрія) ----------
function deskProp(x1, y1, w, frontH, skewX, skewY, id) {
  const x2 = x1 + w;
  const topPts = `${x1},${y1} ${x2},${y1} ${x2 - skewX},${y1 - skewY} ${x1 - skewX},${y1 - skewY}`;
  const frontPts = `${x1},${y1} ${x2},${y1} ${x2},${y1 + frontH} ${x1},${y1 + frontH}`;
  const sidePts = `${x2},${y1} ${x2 - skewX},${y1 - skewY} ${x2 - skewX},${y1 - skewY + frontH} ${x2},${y1 + frontH}`;
  const gTop = `${id}dt`, gFront = `${id}df`, gSide = `${id}ds`;
  const defs = grad(gTop, 'linear', [[0, BIZ.deskTop], [1, BIZ.deskTopDark]], { x1: 0, y1: 0, x2: 1, y2: 1 }) +
    grad(gFront, 'linear', [[0, BIZ.deskFront], [1, BIZ.deskFrontDark]], { x1: 0, y1: 0, x2: 0, y2: 1 }) +
    grad(gSide, 'linear', [[0, BIZ.deskSide], [1, BIZ.deskSideDark]], { x1: 0, y1: 0, x2: 1, y2: 0 });
  const html = `<polygon points="${sidePts}" fill="url(#${gSide})"/>` +
    `<polygon points="${frontPts}" fill="url(#${gFront})"/>` +
    `<polygon points="${topPts}" fill="url(#${gTop})"/>` +
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y1}" stroke="${NEON.cyan}" stroke-width="1.2" opacity=".35"/>`;
  return { defs: `<defs>${defs}</defs>`, html, x1, y1, x2, w, frontH, skewX, skewY };
}

// ---------- ділова людина (поясний портрет за столом): голова + піджак + сорочка ----------
// Ноги навмисно не малюємо — фігура сидить за столом, стіл перекриває низ тулуба
// (менше деталей = менше ризик «кривої» анатомії, композиція охайніша).
function personBust(cx, shoulderY, torsoBottom, opts, id) {
  const { blazer = [BIZ.blazerLight, BIZ.blazerMid], rimColor = NEON.pink, mood = 'calm', shHalf = 33 } = opts;
  const headR = 15;
  const headCy = shoulderY - 9 - headR;
  const gSkin = `${id}sk`, gBlz = `${id}bz`, gShirt = `${id}sh`;
  const defs = grad(gSkin, 'radial', [[0, BIZ.skinLight], [1, BIZ.skinMid]], { cx: .35, cy: .3, r: .75 }) +
    grad(gBlz, 'linear', [[0, blazer[0]], [1, blazer[1]]], { x1: 0, y1: 0, x2: 1, y2: 1 }) +
    grad(gShirt, 'linear', [[0, BIZ.shirtLight], [1, BIZ.shirtMid]], { x1: 0, y1: 0, x2: 0, y2: 1 });

  const hipHalf = shHalf * 0.68;
  const shL = { x: cx - shHalf, y: shoulderY }, shR = { x: cx + shHalf, y: shoulderY };
  const torsoPath = `M${shL.x} ${shL.y} Q${cx - shHalf - 8} ${shoulderY + 34} ${cx - hipHalf} ${torsoBottom} L${cx + hipHalf} ${torsoBottom} Q${cx + shHalf + 8} ${shoulderY + 34} ${shR.x} ${shR.y} Z`;
  const torso = `<path d="${torsoPath}" fill="url(#${gBlz})"/>`;
  const shirt = `<path d="M${cx - 9} ${shoulderY + 3} L${cx} ${shoulderY + 25} L${cx + 9} ${shoulderY + 3} Z" fill="url(#${gShirt})"/>`;
  const lapelL = `<path d="M${cx - 9} ${shoulderY + 3} L${cx - 3} ${shoulderY + 20} L${cx - 17} ${shoulderY + 13} Z" fill="${blazer[1]}" opacity=".85"/>`;
  const lapelR = `<path d="M${cx + 9} ${shoulderY + 3} L${cx + 3} ${shoulderY + 20} L${cx + 17} ${shoulderY + 13} Z" fill="${blazer[1]}" opacity=".85"/>`;

  const head = `<circle cx="${cx}" cy="${headCy}" r="${headR}" fill="url(#${gSkin})"/>`;
  const faceShade = `<path d="M${cx + headR * 0.15} ${headCy - headR * 0.75} A${headR} ${headR} 0 0 1 ${cx + headR * 0.55} ${headCy + headR * 0.7}" fill="none" stroke="${BIZ.skinMid}" stroke-width="${headR * 0.55}" opacity=".3" stroke-linecap="round"/>`;
  const face = mood === 'confused'
    ? `<path d="M${cx - 6} ${headCy + 3} q6 -5 12 0" fill="none" stroke="${BIZ.blazerDark}" stroke-width="1.6" opacity=".55" stroke-linecap="round"/>`
    : `<path d="M${cx - 7} ${headCy + 1} l4 0 M${cx + 3} ${headCy + 1} l4 0" stroke="${BIZ.blazerDark}" stroke-width="1.6" opacity=".5" stroke-linecap="round"/>`;

  const gwId = `${id}gw`;
  const rim = rimStroke(`M${shR.x} ${shR.y} Q${cx + shHalf + 8} ${shoulderY + 34} ${cx + hipHalf} ${torsoBottom}`, rimColor, gwId, 2, .8) +
    rimStroke(`M${cx + headR * 0.6} ${headCy - headR * 0.7} A${headR} ${headR} 0 0 1 ${cx + headR * 0.75} ${headCy + headR * 0.45}`, rimColor, gwId, 1.5, .75);

  return {
    defsSvg: `<defs>${defs}${glowFilter(gwId, 1.3)}</defs>`,
    html: torso + shirt + lapelL + lapelR + head + faceShade + face + rim,
    shL, shR, headCy, headR, cx, shoulderY, gwId,
  };
}

// ---------- рукав-кінцівка: товстий градієнтний штрих + проста кисть-еліпс ----------
function limb(sh, side, elbowOff, handOff, colors, id, tag) {
  const e = { x: sh.x + side * elbowOff[0], y: sh.y + elbowOff[1] };
  const h = { x: sh.x + side * handOff[0], y: sh.y + handOff[1] };
  return limbAbs(sh, e, h, colors, id, tag);
}
// ---------- рукав-кінцівка до абсолютних точок (для рук, що сходяться на предметі) ----------
function limbAbs(sh, elbow, handPt, colors, id, tag) {
  const d = `M${sh.x} ${sh.y} Q${elbow.x} ${elbow.y} ${handPt.x} ${handPt.y}`;
  const gid = `${id}${tag}`;
  const defs = grad(gid, 'linear', [[0, colors[0]], [1, colors[1]]], { x1: 0, y1: 0, x2: 1, y2: 1 });
  const sleeve = `<path d="${d}" fill="none" stroke="url(#${gid})" stroke-width="12.5" stroke-linecap="round"/>`;
  const handEl = `<ellipse cx="${handPt.x}" cy="${handPt.y}" rx="6.5" ry="5.5" fill="${BIZ.skinMid}"/>`;
  return { defs: `<defs>${defs}</defs>`, html: sleeve + handEl, hand: handPt };
}

// ---------- ноутбук: корпус + екран (об'ємні грані) ----------
function laptopProp(x, y, id) {
  const w = 66, d = 30, sh = 42;
  const gBody = `${id}lb`, gScreen = `${id}ls`;
  const defs = `<defs>${grad(gBody, 'linear', [[0, BIZ.metal], [1, BIZ.metalDark]], { x1: 0, y1: 0, x2: 0, y2: 1 })}${grad(gScreen, 'linear', [[0, '#16324A'], [1, '#0A1826']], { x1: 0, y1: 0, x2: 0, y2: 1 })}</defs>`;
  const baseFront = `${x - w / 2},${y} ${x + w / 2},${y} ${x + w / 2},${y + 6} ${x - w / 2},${y + 6}`;
  const baseTop = `${x - w / 2},${y} ${x + w / 2},${y} ${x + w / 2 - 13},${y - d * 0.5} ${x - w / 2 - 13},${y - d * 0.5}`;
  const screenPts = `${x - w / 2 - 13},${y - d * 0.5} ${x + w / 2 - 13},${y - d * 0.5} ${x + w / 2 - 13},${y - d * 0.5 - sh} ${x - w / 2 - 13},${y - d * 0.5 - sh}`;
  const html = `<polygon points="${baseFront}" fill="url(#${gBody})"/>` +
    `<polygon points="${baseTop}" fill="url(#${gBody})" opacity=".92"/>` +
    `<polygon points="${screenPts}" fill="url(#${gScreen})"/>` +
    `<rect x="${x - w / 2 - 9}" y="${y - d * 0.5 - sh + 6}" width="${w - 8}" height="${sh - 14}" fill="${NEON.cyan}" opacity=".16"/>` +
    `<line x1="${x - w / 2 - 13}" y1="${y - d * 0.5}" x2="${x + w / 2 - 13}" y2="${y - d * 0.5}" stroke="${NEON.cyan}" stroke-width="1.3" opacity=".55"/>`;
  return { defs, html };
}

// ---------- планшет-чекліст ----------
function clipboard3D(x, y, id) {
  const w = 58, h = 76, depth = 7;
  const gid = `${id}cl`;
  const defs = `<defs>${grad(gid, 'linear', [[0, BIZ.paper], [1, BIZ.paperDark]], { x1: 0, y1: 0, x2: 0, y2: 1 })}</defs>`;
  const side = `<polygon points="${x + w / 2},${y - h / 2} ${x + w / 2 + depth},${y - h / 2 + depth} ${x + w / 2 + depth},${y + h / 2 + depth} ${x + w / 2},${y + h / 2}" fill="${BIZ.metalDark}"/>`;
  const front = `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="5" fill="url(#${gid})"/>`;
  const clip = `<rect x="${x - 12}" y="${y - h / 2 - 9}" width="24" height="12" rx="3" fill="${BIZ.metal}"/>`;
  const lines = [0, 1, 2].map(i => `<rect x="${x - w / 2 + 10}" y="${y - h / 2 + 20 + i * 18}" width="${w - 32}" height="3" rx="1.5" fill="${BIZ.paperDark}"/>`).join('');
  const checks = [0, 1].map(i => `<path d="M${x - w / 2 + 8} ${y - h / 2 + 30 + i * 18} l5 5 l9 -11" fill="none" stroke="${NEON.green}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return { defs, html: side + front + clip + lines + checks };
}

// ---------- стос паперів (для confused) ----------
function papersStack(x, y, id) {
  const gid = `${id}pp`;
  const defs = `<defs>${grad(gid, 'linear', [[0, BIZ.paper], [1, BIZ.paperDark]], { x1: 0, y1: 0, x2: 1, y2: 1 })}</defs>`;
  const p1 = `<rect x="${x - 26}" y="${y - 15}" width="42" height="28" rx="2" fill="url(#${gid})" transform="rotate(-9 ${x - 5} ${y - 1})"/>`;
  const p2 = `<rect x="${x - 6}" y="${y - 9}" width="42" height="28" rx="2" fill="url(#${gid})" opacity=".92" transform="rotate(7 ${x + 15} ${y + 5})"/>`;
  return { defs, html: p1 + p2 };
}

// ---------- об'ємний графік-«плитка» зі стовпчиками, що ростуть, і стрілкою вгору ----------
function chartPanel3D(x, y, id) {
  const heights = [16, 28, 42, 58];
  const colors = [NEON.pink, NEON.orange, NEON.yellow, NEON.cyan];
  const bw = 15, gap = 7, depth = 7;
  let defs = '', html = '';
  heights.forEach((h, i) => {
    const bx = x + i * (bw + gap), by = y - h;
    const gid = `${id}cb${i}`;
    defs += grad(gid, 'linear', [[0, colors[i]], [1, BIZ.blazerDark]], { x1: 0, y1: 0, x2: 0, y2: 1 });
    const topPts = `${bx},${by} ${bx + bw},${by} ${bx + bw - depth * 0.5},${by - depth * 0.6} ${bx - depth * 0.5},${by - depth * 0.6}`;
    const frontPts = `${bx},${by} ${bx + bw},${by} ${bx + bw},${y} ${bx},${y}`;
    const sidePts = `${bx + bw},${by} ${bx + bw - depth * 0.5},${by - depth * 0.6} ${bx + bw - depth * 0.5},${y - depth * 0.6} ${bx + bw},${y}`;
    html += `<polygon points="${sidePts}" fill="${colors[i]}" opacity=".5"/>` +
      `<polygon points="${frontPts}" fill="url(#${gid})"/>` +
      `<polygon points="${topPts}" fill="${colors[i]}"/>`;
  });
  const endX = x + heights.length * (bw + gap);
  const arrow = `<path d="M${x - 14} ${y - 2} L${endX - 8} ${y - 74}" fill="none" stroke="${NEON.green}" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>` +
    `<path d="M${endX - 20} ${y - 82} L${endX - 8} ${y - 74} L${endX - 16} ${y - 62}" fill="none" stroke="${NEON.green}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>`;
  return { defs: `<defs>${defs}</defs>`, html: html + arrow };
}

// ---------- велика плашка з фразою (для point-say) ----------
function plaqueCard3D(x, y, w, h, id, accent) {
  const gid = `${id}pc`, gwId = `${id}pcg`;
  const defs = `<defs>${grad(gid, 'linear', [[0, BIZ.blazerLight], [1, BIZ.blazerDark]], { x1: 0, y1: 0, x2: 1, y2: 1 })}${glowFilter(gwId, 1.6)}</defs>`;
  const card = `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="16" fill="url(#${gid})"/>` +
    `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="16" fill="none" stroke="${accent}" stroke-width="1.8" opacity=".85" filter="url(#${gwId})"/>`;
  const quote = `<text x="${x - w / 2 + 14}" y="${y - h / 2 + 36}" font-family="Georgia, serif" font-size="42" fill="${accent}" opacity=".8">“</text>`;
  const lines = [0, 1, 2].map(i => `<rect x="${x - w / 2 + 20}" y="${y - 6 + i * 15}" width="${w - 40 - (i === 2 ? 40 : 0)}" height="4" rx="2" fill="${BIZ.shirtLight}" opacity="${.85 - i * 0.15}"/>`).join('');
  return { defs, html: card + quote + lines };
}

// ---------- сет ікри: банки + подарункова коробка (об'ємні) ----------
function jarsAndBox3D(x, y, id) {
  const gJar = `${id}jr`, gBoxTop = `${id}bt`, gBoxFront = `${id}bf`, gBoxSide = `${id}bs`;
  const defs = `<defs>
    ${grad(gJar, 'linear', [[0, BIZ.blazerLight], [1, BIZ.blazerDark]], { x1: 0, y1: 0, x2: 1, y2: 0 })}
    ${grad(gBoxTop, 'linear', [[0, '#FFB199'], [1, NEON.orange]], { x1: 0, y1: 0, x2: 1, y2: 1 })}
    ${grad(gBoxFront, 'linear', [[0, NEON.orange], [1, '#B85400']], { x1: 0, y1: 0, x2: 0, y2: 1 })}
    ${grad(gBoxSide, 'linear', [[0, '#B85400'], [1, '#7A3600']], { x1: 0, y1: 0, x2: 1, y2: 0 })}
  </defs>`;
  function jar(jx, jy, s = 1) {
    const w = 26 * s, h = 38 * s;
    return `<ellipse cx="${jx}" cy="${jy - h}" rx="${w / 2}" ry="${5 * s}" fill="${BIZ.metal}"/>` +
      `<rect x="${jx - w / 2}" y="${jy - h + 3}" width="${w}" height="${h - 3}" rx="${4 * s}" fill="url(#${gJar})"/>` +
      `<ellipse cx="${jx}" cy="${jy}" rx="${w / 2}" ry="${5 * s}" fill="${BIZ.blazerDark}"/>` +
      `<rect x="${jx - w / 2 + 3 * s}" y="${jy - h + 10}" width="${4 * s}" height="${h - 18}" rx="2" fill="#fff" opacity=".2"/>`;
  }
  const jars = jar(x - 70, y, 1) + jar(x - 40, y + 6, 0.92) + jar(x - 98, y + 8, 0.86);
  const bx1 = x + 8, by1 = y - 2, bw = 78, bfront = 50, skx = 22, sky = 14, bx2 = bx1 + bw;
  const topPts = `${bx1},${by1} ${bx2},${by1} ${bx2 - skx},${by1 - sky} ${bx1 - skx},${by1 - sky}`;
  const frontPts = `${bx1},${by1} ${bx2},${by1} ${bx2},${by1 + bfront} ${bx1},${by1 + bfront}`;
  const sidePts = `${bx2},${by1} ${bx2 - skx},${by1 - sky} ${bx2 - skx},${by1 - sky + bfront} ${bx2},${by1 + bfront}`;
  const box = `<polygon points="${sidePts}" fill="url(#${gBoxSide})"/>` +
    `<polygon points="${frontPts}" fill="url(#${gBoxFront})"/>` +
    `<polygon points="${topPts}" fill="url(#${gBoxTop})"/>` +
    `<line x1="${bx1}" y1="${by1 + bfront * 0.4}" x2="${bx2}" y2="${by1 + bfront * 0.4}" stroke="${NEON.yellow}" stroke-width="3" opacity=".85"/>` +
    `<line x1="${(bx1 + bx2) / 2}" y1="${by1}" x2="${(bx1 + bx2) / 2}" y2="${by1 + bfront}" stroke="${NEON.yellow}" stroke-width="3" opacity=".85"/>`;
  return { defs, html: jars + box };
}

// ---------- кубок-підсумок (об'ємний) ----------
function trophy3D(x, y, id) {
  const gCup = `${id}tc`, gBase = `${id}tb`;
  const defs = `<defs>${grad(gCup, 'linear', [[0, NEON.yellow], [1, NEON.orange]], { x1: 0, y1: 0, x2: 1, y2: 1 })}${grad(gBase, 'linear', [[0, BIZ.metal], [1, BIZ.metalDark]], { x1: 0, y1: 0, x2: 0, y2: 1 })}</defs>`;
  const cup = `<path d="M${x - 36} ${y - 80} h72 v20 c0 30 -18 48 -36 48 c-18 0 -36 -18 -36 -48 Z" fill="url(#${gCup})"/>`;
  const shine = `<path d="M${x - 28} ${y - 72} v32" stroke="#fff" stroke-width="4" opacity=".25" stroke-linecap="round"/>`;
  const handleL = `<path d="M${x - 36} ${y - 66} c-20 0 -20 32 -2 32" fill="none" stroke="url(#${gCup})" stroke-width="6" stroke-linecap="round"/>`;
  const handleR = `<path d="M${x + 36} ${y - 66} c20 0 20 32 2 32" fill="none" stroke="url(#${gCup})" stroke-width="6" stroke-linecap="round"/>`;
  const stem = `<rect x="${x - 6}" y="${y - 14}" width="12" height="20" fill="url(#${gBase})"/>`;
  const baseTopPts = `${x - 30},${y + 6} ${x + 30},${y + 6} ${x + 22},${y + 16} ${x - 22},${y + 16}`;
  const baseFrontPts = `${x - 22},${y + 16} ${x + 22},${y + 16} ${x + 22},${y + 30} ${x - 22},${y + 30}`;
  const base = `<polygon points="${baseTopPts}" fill="url(#${gBase})"/><polygon points="${baseFrontPts}" fill="${BIZ.metalDark}"/>`;
  return { defs, html: cup + shine + handleL + handleR + stem + base };
}

// ============================================================
// 8 сцен
// ============================================================
function headsetScene() {
  const id = nextId('bz');
  const cx = 205, shoulderY = 148, rimColor = NEON.pink;
  const desk = deskProp(55, 216, 290, 40, 40, 22, id);
  const bust = personBust(cx, shoulderY, 205, { rimColor }, id);
  const armL = limb(bust.shL, -1, [24, 30], [30, 66], [BIZ.blazerLight, BIZ.blazerMid], id, 'aL');
  const armR = limb(bust.shR, 1, [24, 30], [30, 66], [BIZ.blazerLight, BIZ.blazerMid], id, 'aR');
  const band = `<path d="M${cx - bust.headR - 1} ${bust.headCy - 2} C${cx - bust.headR - 1} ${bust.headCy - bust.headR - 12} ${cx + bust.headR + 1} ${bust.headCy - bust.headR - 12} ${cx + bust.headR + 1} ${bust.headCy - 2}" fill="none" stroke="${NEON.cyan}" stroke-width="2.4" stroke-linecap="round" filter="url(#${bust.gwId})"/>`;
  const earCup = `<circle cx="${cx + bust.headR + 1}" cy="${bust.headCy + 3}" r="5" fill="${BIZ.metal}"/><circle cx="${cx + bust.headR + 1}" cy="${bust.headCy + 3}" r="5" fill="none" stroke="${NEON.cyan}" stroke-width="1.3" opacity=".8"/>`;
  const boom = `<path d="M${cx + bust.headR + 1} ${bust.headCy + 8} Q${cx + bust.headR + 17} ${bust.headCy + 13} ${cx + bust.headR + 11} ${bust.headCy + 23}" fill="none" stroke="${NEON.cyan}" stroke-width="1.7" stroke-linecap="round"/><circle cx="${cx + bust.headR + 11}" cy="${bust.headCy + 23}" r="2.2" fill="${NEON.cyan}"/>`;
  const lap = laptopProp(cx + 6, desk.y1 - 3, id);
  return wrap(`<defs>${blurFilter(id + 'bl', 7)}</defs>
    ${floorShadow(cx + 6, 262, 132, 12, id + 'bl')}
    ${topGlow(cx, bust.headCy - 24, 92, rimColor, id + 'sp')}
    ${bust.defsSvg}${armL.defs}${armR.defs}
    ${armL.html}${armR.html}${bust.html}${band}${earCup}${boom}
    ${desk.defs}${desk.html}
    ${lap.defs}${lap.html}`);
}

function dialogScene() {
  const id = nextId('bz');
  const cxA = 118, cxB = 282, shoulderY = 150;
  const desk = deskProp(35, 220, 330, 36, 36, 20, id);
  const bustA = personBust(cxA, shoulderY, 206, { rimColor: NEON.pink, blazer: [BIZ.blazerLight, BIZ.blazerMid] }, id);
  const bustB = personBust(cxB, shoulderY, 206, { rimColor: NEON.violet, blazer: ['#2A1750', '#170B28'] }, id + 'b');
  const armA1 = limb(bustA.shR, 1, [20, 26], [26, 58], [BIZ.blazerLight, BIZ.blazerMid], id, 'a1');
  const armA2 = limb(bustA.shL, -1, [20, 26], [26, 58], [BIZ.blazerLight, BIZ.blazerMid], id, 'a2');
  const armB1 = limb(bustB.shL, -1, [20, 26], [26, 58], ['#2A1750', '#170B28'], id + 'b', 'b1');
  const armB2 = limb(bustB.shR, 1, [20, 26], [26, 58], ['#2A1750', '#170B28'], id + 'b', 'b2');
  const gid = `${id}fold`;
  const foldDefs = `<defs>${grad(gid, 'linear', [[0, BIZ.paper], [1, BIZ.paperDark]], { x1: 0, y1: 0, x2: 1, y2: 0 })}</defs>`;
  const folder = `<rect x="${200 - 24}" y="${desk.y1 - 14}" width="48" height="30" rx="3" fill="url(#${gid})" transform="rotate(-4 200 ${desk.y1 - 1})"/>`;
  return wrap(`<defs>${blurFilter(id + 'bl', 8)}</defs>
    ${floorShadow(200, 264, 160, 12, id + 'bl')}
    ${topGlow(200, 106, 110, NEON.cyan, id + 'sp')}
    ${bustA.defsSvg}${bustB.defsSvg}${armA1.defs}${armA2.defs}${armB1.defs}${armB2.defs}
    ${armA1.html}${armA2.html}${bustA.html}${armB1.html}${armB2.html}${bustB.html}
    ${desk.defs}${desk.html}${foldDefs}${folder}`);
}

function pointSayScene() {
  const id = nextId('bz');
  const cx = 130, shoulderY = 150, rimColor = NEON.pink;
  const desk = deskProp(45, 218, 170, 38, 34, 20, id);
  const bust = personBust(cx, shoulderY, 205, { rimColor }, id);
  const armPoint = limb(bust.shR, 1, [42, 4], [104, -22], [BIZ.blazerLight, BIZ.blazerMid], id, 'aP');
  const armRelax = limb(bust.shL, -1, [20, 28], [22, 60], [BIZ.blazerLight, BIZ.blazerMid], id, 'aR');
  const plaque = plaqueCard3D(292, 118, 180, 108, id, NEON.orange);
  return wrap(`<defs>${blurFilter(id + 'bl', 7)}</defs>
    ${floorShadow(cx, 262, 96, 11, id + 'bl')}
    ${topGlow(cx, bust.headCy - 22, 88, rimColor, id + 'sp')}
    ${bust.defsSvg}${armRelax.defs}${armPoint.defs}
    ${armRelax.html}${bust.html}${armPoint.html}
    ${desk.defs}${desk.html}
    ${plaque.defs}${plaque.html}`);
}

function chartScene() {
  const id = nextId('bz');
  const cx = 118, shoulderY = 150, rimColor = NEON.cyan;
  const desk = deskProp(35, 220, 160, 36, 32, 18, id);
  const bust = personBust(cx, shoulderY, 205, { rimColor, blazer: ['#1E3A52', '#0F2030'] }, id);
  const armPoint = limb(bust.shR, 1, [34, -6], [66, -28], ['#1E3A52', '#0F2030'], id, 'aP');
  const armRelax = limb(bust.shL, -1, [20, 28], [22, 60], ['#1E3A52', '#0F2030'], id, 'aR');
  const panel = chartPanel3D(228, 214, id);
  return wrap(`<defs>${blurFilter(id + 'bl', 7)}</defs>
    ${floorShadow(cx, 262, 96, 11, id + 'bl')}
    ${topGlow(cx, bust.headCy - 22, 88, rimColor, id + 'sp')}
    ${bust.defsSvg}${armRelax.defs}${armPoint.defs}
    ${armRelax.html}${bust.html}${armPoint.html}
    ${desk.defs}${desk.html}
    ${panel.defs}${panel.html}`);
}

function confusedScene() {
  const id = nextId('bz');
  const cx = 190, shoulderY = 148, rimColor = NEON.violet;
  const desk = deskProp(55, 216, 290, 40, 40, 22, id);
  const bust = personBust(cx, shoulderY, 205, { rimColor, mood: 'confused', blazer: ['#2A1750', '#170B28'] }, id);
  const armL = limb(bust.shL, -1, [30, -14], [42, -50], ['#2A1750', '#170B28'], id, 'aL');
  const armR = limb(bust.shR, 1, [30, -14], [42, -50], ['#2A1750', '#170B28'], id, 'aR');
  const papers = papersStack(cx - 10, desk.y1 - 4, id);
  const q = `<text x="${cx + 72}" y="${bust.headCy - 10}" font-family="'Manrope',sans-serif" font-weight="800" font-size="30" fill="${NEON.yellow}" text-anchor="middle" filter="url(#${bust.gwId})">?</text>`;
  return wrap(`<defs>${blurFilter(id + 'bl', 7)}</defs>
    ${floorShadow(cx, 262, 132, 12, id + 'bl')}
    ${topGlow(cx, bust.headCy - 24, 92, rimColor, id + 'sp')}
    ${bust.defsSvg}${armL.defs}${armR.defs}
    ${armL.html}${armR.html}${bust.html}${q}
    ${desk.defs}${desk.html}
    ${papers.defs}${papers.html}`);
}

function checklistScene() {
  const id = nextId('bz');
  const cx = 150, shoulderY = 150, rimColor = NEON.green;
  const desk = deskProp(45, 218, 210, 38, 34, 20, id);
  const bust = personBust(cx, shoulderY, 205, { rimColor, blazer: ['#173A2C', '#0B1E18'] }, id);
  const target = { x: cx + 66, y: 176 };
  const armL = limbAbs(bust.shL, { x: cx - 6, y: shoulderY + 24 }, { x: target.x - 18, y: target.y }, ['#173A2C', '#0B1E18'], id, 'aL');
  const armR = limbAbs(bust.shR, { x: cx + 50, y: shoulderY + 16 }, { x: target.x + 16, y: target.y - 6 }, ['#173A2C', '#0B1E18'], id, 'aR');
  const board = clipboard3D(target.x, target.y, id);
  return wrap(`<defs>${blurFilter(id + 'bl', 7)}</defs>
    ${floorShadow(cx + 20, 262, 118, 11, id + 'bl')}
    ${topGlow(cx, bust.headCy - 22, 88, rimColor, id + 'sp')}
    ${bust.defsSvg}${armL.defs}${armR.defs}
    ${armL.html}${armR.html}${bust.html}
    ${desk.defs}${desk.html}
    ${board.defs}${board.html}`);
}

function boxScene() {
  const id = nextId('bz');
  const scene = jarsAndBox3D(190, 216, id);
  return wrap(`<defs>${blurFilter(id + 'bl', 8)}</defs>
    ${floorShadow(190, 258, 140, 12, id + 'bl')}
    ${topGlow(190, 150, 120, NEON.orange, id + 'sp')}
    ${scene.defs}${scene.html}`);
}

function trophyScene() {
  const id = nextId('bz');
  const t = trophy3D(200, 150, id);
  return wrap(`<defs>${blurFilter(id + 'bl', 8)}</defs>
    ${floorShadow(200, 246, 90, 10, id + 'bl')}
    ${topGlow(200, 110, 110, NEON.yellow, id + 'sp')}
    ${t.defs}${t.html}`);
}

const SCENES = {
  headset: headsetScene,
  dialog: dialogScene,
  'point-say': pointSayScene,
  chart: chartScene,
  confused: confusedScene,
  checklist: checklistScene,
  box: boxScene,
  trophy: trophyScene,
};

// Старі ключі mic/phone/shield/brain зведені до цих 8 (щоб збірка й старі тексти не ламались).
const SCENE_KEYWORDS = {
  chart: ['графік', 'статистик', 'зростанн', 'дан', 'цифр', 'аналіз'],
  dialog: ['розмов', 'діалог', 'двоє', 'дві людини', 'співрозмовник', 'клієнт і менеджер', 'переговори'],
  confused: ['розгублен', 'панік', 'забув', 'не знаю', 'дзеркал', 'здивован', 'загубив'],
  checklist: ['чек-лист', 'чеклист', 'список', 'перевірк', 'план', 'галочк', 'щит', 'захист', 'гаранті', 'недовір', 'справедлив', 'компенсац', 'скарг', 'памʼят', "пам'ят", 'повторен', 'запамʼят', 'мозок'],
  headset: ['гарнітур', 'слухавк', 'дзвін', 'вступ', 'телефон', 'смартфон', 'вхідний дзвінок', 'екран телефону'],
  'point-say': ['скажи', 'фраза', 'мікрофон', 'голос', 'інтонаці', 'темп', 'мова', 'звук', 'пауз'],
  box: ['сет', 'коробк', 'ікр', 'набір', 'подарунок', 'доставк', 'посилк'],
  trophy: ['успіх', 'перемог', 'кубок', 'результат', 'досягнен'],
};

export function pickSceneKey(text, exclude = []) {
  const t = (text || '').toLowerCase();
  for (const [key, words] of Object.entries(SCENE_KEYWORDS)) {
    if (exclude.includes(key)) continue;
    if (words.some(w => t.includes(w))) return key;
  }
  // Fallback: a scene that differs from the ones already on the page.
  return ['dialog', 'chart', 'checklist', 'headset', 'point-say', 'confused', 'box', 'trophy'].find(k => !exclude.includes(k)) || 'headset';
}

export function sceneSvg(key) {
  const fn = SCENES[key] || SCENES.headset;
  return fn();
}

// ---------- мемна ілюстрація для ЧЗВ і SOS — неоновий стиль ----------
export function faqPersonSvg({ bubbles = ['НІ?'] } = {}) {
  const id = nextId('sg');
  const body = NEON.pink, mark = NEON.yellow;
  const cx = 140, feetY = 246, s = 0.94;
  const p = personBase(cx, feetY, body, id, s, 'confused');
  const armL = arm(p.shL, -1, [30, -16], [40, -54], body, id, s, 30);
  const armR = arm(p.shR, 1, [30, -16], [40, -54], body, id, s, -30);
  const positions = [
    { x: 214, y: 24, w: 88, h: 46, fs: 20, color: NEON.cyan },
    { x: 250, y: 90, w: 104, h: 52, fs: 22, color: NEON.orange },
    { x: 190, y: 156, w: 128, h: 62, fs: 26, color: NEON.violet },
  ];
  const bubbleSvgs = bubbles.slice(0, 3).map((txt, idx) => {
    const pos = positions[idx];
    const b = bubble(pos.x + pos.w / 2, pos.y + pos.h / 2, pos.w, pos.h, pos.color, id, pos.x + pos.w / 2 - 14);
    const t = neonText(pos.x + pos.w / 2, pos.y + pos.h / 2 + pos.fs * 0.34, txt, mark, id, pos.fs);
    return b + t;
  }).join('');
  return wrap(`<defs>${neonFilter(id, 2.3)}</defs>
    <ellipse cx="${cx}" cy="260" rx="74" ry="9" fill="rgba(255,46,151,.12)"/>
    ${armL}${armR}${p.html}${bubbleSvgs}`, '0 0 360 260');
}

// ============================================================
// Лінійні неонові іконки для карток (без розмиття — дрібний розмір)
// ============================================================
const ICON_COLOR = NEON.cyan;
const ICONS = {
  check: `<circle cx="24" cy="24" r="19" fill="none" stroke="${ICON_COLOR}" stroke-width="3"/><path d="M16 24l5 5 10-11" stroke="${ICON_COLOR}" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  cross: `<circle cx="24" cy="24" r="19" fill="none" stroke="${ICON_COLOR}" stroke-width="3"/><path d="M17 17l14 14M31 17l-14 14" stroke="${ICON_COLOR}" stroke-width="3" stroke-linecap="round"/>`,
  clock: `<circle cx="24" cy="24" r="19" fill="none" stroke="${ICON_COLOR}" stroke-width="3"/><path d="M24 13v11l8 6" stroke="${ICON_COLOR}" stroke-width="3" stroke-linecap="round" fill="none"/>`,
  fire: `<path d="M24 6c3 8-6 10-6 18a6 6 0 0012 0c0-3-2-4-2-7 4 2 6 6 6 10a10 10 0 01-20 0C14 18 20 14 24 6Z" fill="none" stroke="${ICON_COLOR}" stroke-width="2.6" stroke-linejoin="round"/>`,
  question: `<circle cx="24" cy="24" r="19" fill="none" stroke="${ICON_COLOR}" stroke-width="3"/><path d="M18 19a6 6 0 1110 5c-2 2-4 3-4 6" stroke="${ICON_COLOR}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M23 35h2" stroke="${ICON_COLOR}" stroke-width="2.4" stroke-linecap="round"/>`,
  money: `<rect x="6" y="14" width="36" height="20" rx="4" fill="none" stroke="${ICON_COLOR}" stroke-width="3"/><circle cx="24" cy="24" r="6" fill="none" stroke="${ICON_COLOR}" stroke-width="2.4"/>`,
  heart: `<path d="M24 38C10 29 6 21 6 14a9 9 0 0118-2 9 9 0 0118 2c0 7-4 15-18 24Z" fill="none" stroke="${ICON_COLOR}" stroke-width="2.6" stroke-linejoin="round"/>`,
  arrow: `<path d="M8 24h28M24 12l12 12-12 12" fill="none" stroke="${ICON_COLOR}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  star: `<path d="M24 7l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" fill="none" stroke="${ICON_COLOR}" stroke-width="2.4" stroke-linejoin="round"/>`,
  target: `<circle cx="24" cy="24" r="18" fill="none" stroke="${ICON_COLOR}" stroke-width="2.6"/><circle cx="24" cy="24" r="10" fill="none" stroke="${ICON_COLOR}" stroke-width="2.4"/><circle cx="24" cy="24" r="2.6" fill="${ICON_COLOR}"/>`,
  shield: `<path d="M24 6l16 6v10c0 11-7 18-16 22-9-4-16-11-16-22V12z" fill="none" stroke="${ICON_COLOR}" stroke-width="2.6" stroke-linejoin="round"/><path d="M17 24l5 5 10-11" stroke="${ICON_COLOR}" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  box: `<path d="M6 16l18-8 18 8-18 8Z" fill="none" stroke="${ICON_COLOR}" stroke-width="2.4" stroke-linejoin="round"/><path d="M6 16v16l18 8 18-8V16M24 24v16" stroke="${ICON_COLOR}" stroke-width="2.4" fill="none" stroke-linejoin="round"/>`,
  phone: `<rect x="14" y="6" width="20" height="36" rx="4" fill="none" stroke="${ICON_COLOR}" stroke-width="2.6"/><circle cx="24" cy="34" r="1.8" fill="${ICON_COLOR}"/>`,
  smile: `<circle cx="24" cy="24" r="18" fill="none" stroke="${ICON_COLOR}" stroke-width="2.6"/><path d="M15 26a9 9 0 0018 0" stroke="${ICON_COLOR}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M15 19h4M29 19h4" stroke="${ICON_COLOR}" stroke-width="2.2" stroke-linecap="round"/>`,
  frown: `<circle cx="24" cy="24" r="18" fill="none" stroke="${ICON_COLOR}" stroke-width="2.6"/><path d="M15 30a9 9 0 0118 0" stroke="${ICON_COLOR}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M15 19h4M29 19h4" stroke="${ICON_COLOR}" stroke-width="2.2" stroke-linecap="round"/>`,
  book: `<path d="M8 10c6-3 12-3 16 0v28c-4-3-10-3-16 0Z" fill="none" stroke="${ICON_COLOR}" stroke-width="2.4" stroke-linejoin="round"/><path d="M40 10c-6-3-12-3-16 0v28c4-3 10-3 16 0Z" fill="none" stroke="${ICON_COLOR}" stroke-width="2.4" stroke-linejoin="round"/>`,
  gift: `<rect x="8" y="20" width="32" height="20" rx="2" fill="none" stroke="${ICON_COLOR}" stroke-width="2.6"/><path d="M8 20h32M24 20v20" stroke="${ICON_COLOR}" stroke-width="2.4"/><path d="M24 20c-6-12-18-8-12 0M24 20c6-12 18-8 12 0" fill="none" stroke="${ICON_COLOR}" stroke-width="2.2"/>`,
  mic: `<rect x="18" y="6" width="12" height="20" rx="6" fill="none" stroke="${ICON_COLOR}" stroke-width="2.6"/><path d="M12 20a12 12 0 0024 0" fill="none" stroke="${ICON_COLOR}" stroke-width="2.6" stroke-linecap="round"/><path d="M24 32v8M18 40h12" stroke="${ICON_COLOR}" stroke-width="2.4" stroke-linecap="round"/>`,
  scale: `<path d="M24 6v36M12 14h24M12 14l-6 14h12ZM36 14l-6 14h12Z" fill="none" stroke="${ICON_COLOR}" stroke-width="2.4" stroke-linejoin="round"/>`,
  pause: `<circle cx="24" cy="24" r="18" fill="none" stroke="${ICON_COLOR}" stroke-width="2.6"/><rect x="18" y="16" width="4" height="16" rx="1.5" fill="${ICON_COLOR}"/><rect x="26" y="16" width="4" height="16" rx="1.5" fill="${ICON_COLOR}"/>`,
  compass: `<circle cx="24" cy="24" r="18" fill="none" stroke="${ICON_COLOR}" stroke-width="2.6"/><path d="M30 18l-4 10-10 4 4-10z" fill="none" stroke="${ICON_COLOR}" stroke-width="2.2" stroke-linejoin="round"/>`,
  lock: `<rect x="12" y="20" width="24" height="18" rx="4" fill="none" stroke="${ICON_COLOR}" stroke-width="2.6"/><path d="M16 20v-4a8 8 0 0116 0v4" fill="none" stroke="${ICON_COLOR}" stroke-width="2.6"/>`,
};

// DESIGN_SYSTEM: іконка лишається тільки для трьох типів заперечень — фіксована
// мапа ключ → іконка, без нечіткого пошуку по ключових словах (був pickIconKey/
// ICON_KEYWORDS — джерело «іконок навмання», прибрано).
export function cardIconSvg(key) {
  return `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">${ICONS[key] || ICONS.question}</svg>`;
}

export function videoIconSvg() {
  return `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="12" width="26" height="24" rx="5" fill="none" stroke="${NEON.cyan}" stroke-width="2.6"/><path d="M32 20l10-6v20l-10-6Z" fill="none" stroke="${NEON.cyan}" stroke-width="2.4" stroke-linejoin="round"/></svg>`;
}

export function flowArrowSvg(dashed = false) {
  return `<svg viewBox="0 0 14 26"><path d="M7 0v20M2 16l5 8 5-8" fill="none" stroke="${NEON.pink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"${dashed ? ' stroke-dasharray="2 4"' : ''}/></svg>`;
}

export function loopIconSvg() {
  return `<svg viewBox="0 0 24 24" fill="none"><path d="M4 12a8 8 0 0 1 14-5.3M20 5v5h-5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function loopConnectorSvg() {
  return `<svg viewBox="0 0 24 24" fill="none"><path d="M6 9l-3 3 3 3M18 9l3 3-3 3M3 12h18" stroke="${NEON.orange}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

// ============ ЛІНІЙНІ ІЛЮСТРАЦІЇ УРОКІВ (DESIGN_SYSTEM) ============
// Одноколірні (var(--ink)), без неонового світіння, без облич/фігур людей —
// сухий, самоіронічний натяк на конкретну ситуацію уроку. Одна на урок, там,
// де є природний привід; мапа навмисно неповна — решта уроків без ілюстрації.
const LESSON_SCENES = {
  'urok-01': `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="38" cy="32" r="13"/>
    <circle cx="78" cy="72" r="13"/>
    <path d="M49,43 Q64,52 67,61" stroke-width="11"/>
    <rect x="112" y="16" width="72" height="90" rx="6" transform="rotate(4 148 61)"/>
    <path d="M126,40 h44" transform="rotate(4 148 61)"/>
    <path d="M126,56 h44" transform="rotate(4 148 61)"/>
    <path d="M126,72 q10,-6 18,0 t18,0" transform="rotate(4 148 61)" stroke-width="2.2"/>
  </svg>`,
  // Гачок — риболовний гачок замість наживки тримає цінник (дослівний каламбур на назву навички)
  'urok-02': `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="55" cy="14" r="5"/>
    <path d="M55,18 V55 Q55,82 78,82 Q98,82 98,62"/>
    <path d="M98,62 L128,80" stroke-width="2.2"/>
    <rect x="128" y="78" width="46" height="30" rx="5" transform="rotate(18 151 93)"/>
    <circle cx="137" cy="87" r="2.2" fill="var(--ink)" transform="rotate(18 151 93)"/>
    <path d="M144,101 h20" stroke-width="2.2" transform="rotate(18 151 93)"/>
  </svg>`,
  // Етапи дзвінка — «розворот заборонено» на пунктирній прямій: один скелет, без повернень назад
  'urok-03': `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <line x1="15" y1="95" x2="185" y2="95" stroke-dasharray="8 8" stroke-width="2.2"/>
    <circle cx="100" cy="52" r="34" stroke-width="2.8"/>
    <path d="M84,60 A18,18 0 1 1 116,60" stroke-width="4.2" fill="none"/>
    <path d="M116,60 l11,-3 l1,11" stroke-width="2.4"/>
    <line x1="75" y1="70" x2="125" y2="34" stroke-width="4.2"/>
  </svg>`,
  // Робота із запереченнями — гілка з трьома листками, один трохи зів'ялий (пунктир)
  'urok-04': `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M100,108 V48" stroke-width="3"/>
    <path d="M100,68 Q80,53 70,33" stroke-width="2.2"/>
    <path d="M100,58 Q120,43 128,23" stroke-width="2.2"/>
    <path d="M100,48 Q94,34 78,27" stroke-width="2.2" stroke-dasharray="3 4"/>
    <ellipse cx="65" cy="28" rx="13" ry="7.5" transform="rotate(-32 65 28)"/>
    <ellipse cx="130" cy="19" rx="13" ry="7.5" transform="rotate(25 130 19)"/>
    <ellipse cx="73" cy="22" rx="11" ry="6" transform="rotate(-58 73 22)" stroke-dasharray="3 3"/>
  </svg>`,
  // Заклик до дії — репліка-бульбашка з крапкою замість знаку питання: твердження, не питання
  'urok-05': `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M32,25 h120 a10,10 0 0 1 10,10 v42 a10,10 0 0 1 -10,10 h-68 l-22,20 v-20 h-30 a10,10 0 0 1 -10,-10 v-42 a10,10 0 0 1 10,-10 Z"/>
    <circle cx="97" cy="56" r="5.5" fill="var(--ink)"/>
  </svg>`,
  // Персоналізація — бирка з іменем і маленька коробка (минуле замовлення) поруч
  'urok-06': `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M32,30 h68 l22,25 l-22,25 h-68 a8,8 0 0 1 -8,-8 v-34 a8,8 0 0 1 8,-8 Z"/>
    <circle cx="48" cy="55" r="4.5" fill="var(--ink)"/>
    <path d="M68,46 q22,0 30,9 q7,10 -8,15" stroke-width="2.2"/>
    <rect x="128" y="58" width="44" height="36" rx="4"/>
    <path d="M128,73 h44 M150,58 v36" stroke-width="2"/>
  </svg>`,
  // УТП — цінник: закреслена абстрактна фраза замінена конкретним, «сенсорним» описом
  'urok-07': `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M28,35 h74 l32,32 l-32,32 h-74 a9,9 0 0 1 -9,-9 v-46 a9,9 0 0 1 9,-9 Z"/>
    <circle cx="45" cy="50" r="4.5" fill="var(--ink)"/>
    <path d="M58,62 h56" stroke-width="2.2"/>
    <path d="M55,53 l62,20" stroke-width="2.2"/>
    <path d="M62,80 q8,-10 16,0 t16,0 t16,0" stroke-width="2.2"/>
  </svg>`,
  // Альтернатива і спуск — одна сходинка вниз, від якої стрілка йде вбік/угору (допродаж), без повного маршу
  'urok-08': `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--ink)" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M30,95 h55 v-28 h55"/>
    <path d="M130,67 l32,-20"/>
    <path d="M149,47 h13 v13" stroke-width="2.4"/>
  </svg>`,
  // Впевненість, темп, інтонація, пауза — звукова хвиля: рвана зліва, рівна й спокійна справа
  'urok-09': `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14,62 L28,40 L38,78 L52,28 L63,82 L78,58"/>
    <path d="M90,60 Q104,44 118,60 T146,60 T174,60" stroke-width="2.8"/>
  </svg>`,
  // Чистота мови — аркуш скрипту з двома закресленими словами (два слова під забороною)
  'urok-10': `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="45" y="14" width="110" height="92" rx="6"/>
    <path d="M60,36 h80" stroke-width="2"/>
    <path d="M60,52 h34" stroke-width="2"/>
    <path d="M58,50 l38,6" stroke-width="2.4"/>
    <path d="M100,52 h42" stroke-width="2"/>
    <path d="M98,50 l46,6" stroke-width="2.4"/>
    <path d="M60,70 h60 M60,84 h44" stroke-width="2"/>
  </svg>`,
  // Знання продукту і мети дзвінка — стрілка-індикатор шкали, що показує на «точно», не «приблизно»
  'urok-11': `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M28,92 A72,72 0 0 1 172,92" stroke-width="2.8"/>
    <path d="M100,92 L147,49" stroke-width="3.4"/>
    <circle cx="100" cy="92" r="6.5" fill="var(--ink)"/>
    <path d="M33,92 h7 M100,17 v7 M167,92 h-7" stroke-width="2"/>
  </svg>`,
  // Підсумок і прощання — блокнот із позначкою навпроти замовлення, поруч кільце від кавової чашки
  'urok-12': `<svg viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="30" y="18" width="92" height="88" rx="6"/>
    <path d="M48,42 h56 M48,58 h56 M48,74 h36" stroke-width="2"/>
    <path d="M118,70 l10,10 l19,-23" stroke-width="3.2"/>
    <circle cx="158" cy="92" r="16" stroke-width="2.2"/>
    <circle cx="158" cy="92" r="10" stroke-width="1.6" opacity=".5"/>
  </svg>`,
};

// Підписи до сцен (патерн мокапу: сцена в картці з приглушеним підписом) — описують
// сцену, не додають фактів. Заповнюються разом із переходом уроку на новий патерн.
const SCENE_CAPTIONS = {
  'urok-01': 'Слухавка і картка клієнта: ти дзвониш людині, чию історію замовлень уже бачиш',
};
export function lessonSceneCaption(pageSlug) {
  return SCENE_CAPTIONS[pageSlug] || '';
}

export function lessonSceneSvg(pageSlug) {
  return LESSON_SCENES[pageSlug] || '';
}
