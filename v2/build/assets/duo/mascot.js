/* Ikorka Duo — маскот «Ікринка»: window.Duo.mascot (UMD: браузер + Node для пререндера).
 * Контракт — docs/design/ARCHITECTURE.md §4.7. Оригінальний персонаж: ікринка з лососевої ікри
 * (тіло-кулька, очі, повіки-моргання, рот, «ручки», аксесуари). Кольори — лише токени через класи mascot.css.
 * Рух — тільки transform/opacity (CSS-класи .dm-do-*). Reduced motion: змінюється лише вираз, без руху.
 * svg() не торкається DOM, тож працює в Node при збірці. */
(function (root, factory) {
  var api = factory(typeof window !== 'undefined' && typeof document !== 'undefined' ? window : null);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') { var D = window.Duo = window.Duo || {}; D.mascot = api; }
})(this, function (W) {
  'use strict';

  var EMOTIONS = ['idle', 'happy', 'excited', 'sad', 'thinking', 'cheer', 'coach', 'sleepy'];
  var ACTIONS = { blink: 200, wave: 1100, jump: 700, nod: 640 };
  var TITLES = {
    idle: 'Ікринка, маскот Ikorka, спокійна',
    happy: 'Ікринка, маскот Ikorka, усміхається',
    excited: 'Ікринка, маскот Ikorka, у захваті',
    sad: 'Ікринка, маскот Ikorka, засмучена',
    thinking: 'Ікринка, маскот Ikorka, замислилась',
    cheer: 'Ікринка, маскот Ikorka, святкує',
    coach: 'Ікринка, маскот Ikorka, у ролі тренера',
    sleepy: 'Ікринка, маскот Ikorka, куняє'
  };
  var REACT_GAP = 2000;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---- Деталі обличчя (viewBox 0 0 120 120, тіло: коло (60,64) r42) ---- */
  function eyes(r, pr, ox, oy) {
    var o = '';
    [46, 74].forEach(function (x) {
      o += '<circle class="dm-w" cx="' + x + '" cy="62" r="' + r + '"/>' +
        '<circle class="dm-p" cx="' + (x + ox) + '" cy="' + (62 + oy) + '" r="' + pr + '"/>' +
        '<circle class="dm-w" cx="' + (x + ox + 1.8) + '" cy="' + (62 + oy - 1.8) + '" r="1.6"/>';
    });
    return o;
  }
  function closed(d, d2) { return '<path class="dm-line" d="' + d + '"/><path class="dm-line" d="' + d2 + '"/>'; }
  function line(d) { return '<path class="dm-line" d="' + d + '"/>'; }
  function mouth(d) { return '<path class="dm-mouth" d="' + d + '"/>'; }
  function cheeks() { return '<ellipse class="dm-cheek" cx="33" cy="76" rx="6" ry="4"/><ellipse class="dm-cheek" cx="87" cy="76" rx="6" ry="4"/>'; }
  function spark(x, y, s, c) {
    return '<path class="' + c + '" d="M' + x + ' ' + (y - s) + 'Q' + x + ' ' + y + ' ' + (x + s) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y + s) +
      'Q' + x + ' ' + y + ' ' + (x - s) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y - s) + 'Z"/>';
  }
  function arm(side, pose, ry) {
    return '<g class="dm-arm dm-arm-' + side + '"><g transform="' + pose + '"><ellipse class="dm-limb" rx="7.5" ry="' + (ry || 12) + '"/></g></g>';
  }

  var ARM_L = 'translate(19 76) rotate(16)', ARM_R = 'translate(101 76) rotate(-16)';
  var HEADSET = '<path class="dm-ink" d="M23 60A37 37 0 0 1 97 60"/>' +
    '<rect class="dm-cup" x="15" y="55" width="11" height="20" rx="5"/><rect class="dm-cup" x="94" y="55" width="11" height="20" rx="5"/>' +
    '<path class="dm-ink" d="M100 72Q101 90 78 88"/><circle class="dm-cup" cx="75" cy="88" r="3.5"/>';
  var CONFETTI = '<rect class="dm-c1" x="14" y="18" width="7" height="3.5" rx="1" transform="rotate(-30 17 20)"/>' +
    '<rect class="dm-c2" x="98" y="14" width="7" height="3.5" rx="1" transform="rotate(35 101 16)"/>' +
    '<circle class="dm-c3" cx="30" cy="10" r="2.6"/><circle class="dm-c1" cx="90" cy="8" r="2.6"/>' +
    '<rect class="dm-c3" x="60" y="6" width="6" height="3" rx="1" transform="rotate(20 63 7)"/>';
  var ZZZ = '<path class="dm-zz" d="M84 34h9l-9 11h9"/><path class="dm-zz dm-zz-s" d="M98 20h6l-6 7.5h6"/>';
  var THINK = '<circle class="dm-bub" cx="95" cy="24" r="2.6"/><circle class="dm-bub" cx="103" cy="17" r="3.6"/><circle class="dm-bub" cx="111" cy="7" r="5"/>';

  var FACE = {
    idle: { l: ARM_L, r: ARM_R, eyes: eyes(9, 4.5, 0, 1), mouth: line('M50 80Q60 88 70 80') },
    happy: { l: ARM_L, r: ARM_R, eyes: closed('M38 65Q46 54 54 65', 'M66 65Q74 54 82 65'), mouth: mouth('M47 77Q60 96 73 77Z'), extra: cheeks() },
    excited: {
      l: 'translate(15 70) rotate(-40)', r: 'translate(105 70) rotate(40)', eyes: eyes(10.5, 5.5, 0, 0),
      brows: line('M37 46Q46 41 55 46') + line('M65 46Q74 41 83 46'), mouth: mouth('M44 75Q60 104 76 75Z'), extra: cheeks() + spark(14, 28, 7, 'dm-xp') + spark(106, 24, 9, 'dm-xp') + spark(108, 56, 5, 'dm-xp')
    },
    sad: {
      l: 'translate(21 84) rotate(6)', r: 'translate(99 84) rotate(-6)', eyes: eyes(9, 4.5, 0, 2.5),
      brows: line('M36 54L54 47') + line('M84 54L66 47'), mouth: line('M50 89Q60 79 70 89'),
      extra: '<path class="dm-tear" d="M37 71Q32 78 37 83Q42 78 37 71Z"/>'
    },
    thinking: {
      l: ARM_L, r: 'translate(87 86) rotate(68)', rFront: 1, eyes: eyes(9, 4.5, 3, -3),
      brows: line('M38 49L53 49') + line('M67 44Q75 40 83 45'), mouth: line('M52 86Q61 82 70 85'), extra: THINK
    },
    cheer: {
      l: 'translate(16 50) rotate(-20)', r: 'translate(104 50) rotate(20)', eyes: closed('M38 65Q46 54 54 65', 'M66 65Q74 54 82 65'),
      mouth: mouth('M43 75Q60 106 77 75Z'), extra: cheeks() + CONFETTI
    },
    coach: {
      l: ARM_L, r: ARM_R, eyes: eyes(7.5, 4.3, 0, 0), brows: line('M36 48L54 54') + line('M84 48L66 54'), mouth: line('M51 84H69'), extra: HEADSET
    },
    sleepy: {
      l: 'translate(21 84) rotate(6)', r: 'translate(99 84) rotate(-6)', eyes: closed('M38 62Q46 69 54 62', 'M66 62Q74 69 82 62'),
      mouth: mouth('M56.5 84a3.5 4.5 0 1 0 7 0a3.5 4.5 0 1 0 -7 0Z'), extra: ZZZ
    }
  };

  /* ---- svg(emotion, {size, title}) → рядок ---- */
  function svg(emotion, o) {
    o = o || {};
    var f = FACE[emotion] || FACE.idle, em = FACE[emotion] ? emotion : 'idle';
    var size = Math.max(16, Math.round(+o.size || 96));
    var decor = o.title === false || o.title === '';
    var title = o.title == null ? TITLES[em] : o.title;
    var a11y = decor ? ' aria-hidden="true" focusable="false"' : ' role="img"';
    var behindR = f.rFront ? '' : arm('r', f.r);
    return '<svg class="dm dm--' + em + '" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="' + size + '" height="' + size + '"' + a11y + '>' +
      (decor ? '' : '<title>' + esc(title) + '</title>') +
      '<ellipse class="dm-gnd" cx="60" cy="109" rx="30" ry="5"/>' +
      '<g class="dm-all">' + arm('l', f.l) + behindR +
      '<circle class="dm-body" cx="60" cy="64" r="42"/>' +
      '<path class="dm-shade" d="M21.3 74A40 40 0 0 0 98.7 74A40 20 0 0 1 21.3 74Z"/>' +
      '<ellipse class="dm-hi" cx="42" cy="40" rx="10" ry="5.5" transform="rotate(-35 42 40)"/>' +
      '<g class="dm-eyes">' + f.eyes + '</g>' + (f.brows || '') + f.mouth + (f.extra || '') +
      (f.rFront ? arm('r', f.r, 14) : '') + '</g></svg>';
  }

  var api = { EMOTIONS: EMOTIONS, ACTIONS: Object.keys(ACTIONS), svg: svg };
  if (!W) { api.mount = api.peek = function () { return null; }; return api; }

  /* ===================== Браузер ===================== */
  var doc = W.document;
  function env() { return (W.Duo && W.Duo.env) || null; }
  function reduced() {
    var e = env();
    if (e && typeof e.reducedMotion === 'boolean') return e.reducedMotion;
    return !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function validEmotion(e) { return FACE[e] ? e : 'idle'; }
  var CLOSED_EYES = { happy: 1, cheer: 1, sleepy: 1 };

  /* Реакції на події плеєра: name → [емоція, дія] */
  var REACT = {
    correct: ['happy', 'nod'], wrong: ['sad', null], heart_lost: ['sad', null],
    streak: ['excited', 'jump'], node_complete: ['cheer', 'jump'], lesson_complete: ['cheer', 'jump']
  };

  function mount(el, o) {
    o = o || {};
    var host = doc.createElement('span');
    host.className = 'dm-host';
    var base = validEmotion(o.emotion), cur = base, size = o.size || 96;
    var timers = [], blinkT = 0, revertT = 0, actT = 0, lastReact = 0, visible = true, dead = false, io = null, offSig = null;
    var withIdle = !!o.idle;

    function render() { host.innerHTML = svg(cur, { size: size, title: o.title }); }
    function later(fn, ms) { var t = setTimeout(function () { var i = timers.indexOf(t); if (i > -1) timers.splice(i, 1); fn(); }, ms); timers.push(t); return t; }
    function clearT(t) { clearTimeout(t); var i = timers.indexOf(t); if (i > -1) timers.splice(i, 1); }

    function play(action) {
      if (dead || !ACTIONS[action] || reduced()) return;
      if (action === 'blink' && CLOSED_EYES[cur]) return;
      clearT(actT);
      host.className = 'dm-host';
      void host.offsetWidth; // перезапуск CSS-анімації
      host.className = 'dm-host dm-do-' + action;
      actT = later(function () { host.className = 'dm-host'; }, ACTIONS[action]);
    }
    function set(emotion) {
      if (dead) return;
      base = validEmotion(emotion);
      clearT(revertT);
      if (cur !== base) { cur = base; render(); }
    }
    function tmp(emotion, action, ms) {
      clearT(revertT);
      var e = validEmotion(emotion);
      if (cur !== e) { cur = e; render(); }
      if (action) play(action);
      revertT = later(function () { cur = base; render(); schedule(); }, ms || 1800);
    }
    function schedule() {
      clearT(blinkT);
      if (!withIdle || dead || !visible || doc.hidden || reduced()) return;
      blinkT = later(function () { play('blink'); schedule(); }, 3000 + Math.random() * 3000);
    }
    function onVis() { schedule(); }
    function onSignal(d) {
      var r = d && REACT[d.name], now = Date.now();
      if (!r || dead || now - lastReact < REACT_GAP) return;
      lastReact = now;
      tmp(r[0], r[1], 1800);
    }

    render();
    el.appendChild(host);
    if (W.IntersectionObserver) {
      io = new W.IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; schedule(); });
      io.observe(host);
    }
    doc.addEventListener('visibilitychange', onVis);
    var e = env();
    if (e && o.react !== false && typeof e.on === 'function') offSig = e.on('signal', onSignal);
    if (e && typeof e.on === 'function') var offRm = e.on('env:reducedMotion', function () { host.className = 'dm-host'; schedule(); });
    schedule();

    return {
      el: host,
      set: set,
      play: play,
      destroy: function () {
        if (dead) return;
        dead = true;
        timers.forEach(clearTimeout); timers.length = 0;
        if (io) io.disconnect();
        doc.removeEventListener('visibilitychange', onVis);
        if (offSig) offSig();
        if (offRm) offRm();
        if (host.parentNode) host.parentNode.removeChild(host);
      }
    };
  }

  /* peek: одна «виглядаючa» ікринка за раз; декор (aria-hidden) — текст озвучує живий регіон плеєра */
  var peekEl = null, peekT = [];
  function peekClear() {
    peekT.forEach(clearTimeout); peekT = [];
    if (peekEl && peekEl.parentNode) peekEl.parentNode.removeChild(peekEl);
    peekEl = null;
  }
  function peek(o) {
    o = o || {};
    peekClear();
    var side = o.side === 'left' ? 'left' : 'right', ms = o.ms > 0 ? o.ms : 2200;
    var el = doc.createElement('div');
    el.className = 'dm-peek dm-peek--' + side + (reduced() ? ' dm-peek--still' : '');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="dm-peek__bubble">' + esc(o.text || '') + '</div>' + svg(validEmotion(o.emotion || 'excited'), { size: o.size || 72, title: false });
    doc.body.appendChild(el);
    peekEl = el;
    void el.offsetWidth;
    el.classList.add('is-in');
    var out = function () {
      if (peekEl !== el) return;
      el.classList.remove('is-in');
      peekT.push(setTimeout(peekClear, 320));
    };
    peekT.push(setTimeout(out, ms));
    return { dismiss: out };
  }

  api.mount = mount;
  api.peek = peek;
  return api;
});
