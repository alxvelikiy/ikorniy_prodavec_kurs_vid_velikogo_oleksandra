/* Ikorka Duo — рух: window.Duo.motion (власник — motion-sound-designer).
 * Контракт — docs/design/ARCHITECTURE.md §4.3; хореографія, reduced motion і бюджет — docs/design/MOTION_SPEC.md.
 * Web Animations API, лише transform / translate / opacity. Постійних анімацій немає (виняток — bounceTooltip:
 * на паузі поза екраном і у фоновій вкладці). Reduced motion → миттєво кінцевий стан. Усе повертає Promise
 * (bounceTooltip → { stop }). Рухи накладаються на власний transform елемента (composite 'add' або окрема
 * властивість translate), тож центрування translate(-50%) чи зсув вузла шляху не збиваються. */
(function () {
  'use strict';
  var W = window, D = document, Duo = W.Duo = W.Duo || {};
  var dur = { instant: 80, press: 100, fast: 150, base: 250, slow: 400, celebrate: 1200 };
  var ease = { out: 'cubic-bezier(.22,1,.36,1)', inOut: 'cubic-bezier(.65,0,.35,1)', spring: 'cubic-bezier(.34,1.56,.64,1)' };
  ease.bounce = ease.spring; // псевдонім з ARCHITECTURE §4.3 (окремого токена немає)
  var HAS = !!(W.Element && Element.prototype.animate), ADD = false, IND = false;
  try { ADD = HAS && 'composite' in KeyframeEffect.prototype; } catch (e) { /* старий рушій */ }
  try { IND = !!(W.CSS && CSS.supports('translate', '1px 1px')); } catch (e) { /* */ }
  var mq = W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)');
  var groups = new WeakMap(), owned = new WeakMap(), counters = new WeakMap();
  var PRESS = '.d-btn,.d-option,.d-tile,[data-press="class"]';
  var M = Duo.motion = { dur: dur, ease: ease, forceReduced: null };

  function reduced() {
    if (typeof M.forceReduced === 'boolean') return M.forceReduced;
    var env = Duo.env;
    if (env && typeof env.reducedMotion === 'boolean') return env.reducedMotion;
    return !!(mq && mq.matches);
  }
  function still() { return !HAS || reduced(); }
  function noop() {}
  function done() { return Promise.resolve(); }
  function arr(x) { return !x ? [] : x.nodeType || x.length == null ? [x] : Array.prototype.slice.call(x); }
  function later(e) { setTimeout(function () { throw e; }); } // помилка колбека — у консоль, хореографія не ламається
  // зсув: окрема властивість translate (не конфліктує з transform і CSS-переходами елемента) або transform
  function T(x, y) { return IND ? { translate: x + ' ' + y } : { transform: 'translate(' + x + ',' + y + ')' }; }

  // кінцевий inline-стан (запам'ятовуємо, що поставили ми, — щоб наступний «вхід» його прибрав)
  function commit(el, st) {
    if (!st) return;
    var o = owned.get(el) || {};
    for (var k in st) { el.style[k] = st[k]; if (st[k] === '') delete o[k]; else o[k] = 1; }
    owned.set(el, o);
  }
  function release(el) {
    var o = owned.get(el);
    if (o) { for (var k in o) el.style[k] = ''; owned.delete(el); }
    if (el.hidden) el.hidden = false;
  }
  function stop(el) { var g = el && groups.get(el); if (g) g(false); }

  // parts: [{ k: кадри, ms, e: easing, d: затримка, add: накласти на власний transform }]; end — кінцевий inline-стан
  function run(el, parts, end) {
    if (!el) return done();
    stop(el);
    if (still()) { commit(el, end); return done(); }
    return new Promise(function (res) {
      var anims = [], left = parts.length, over = false, total = 0, timer;
      function fin(ok) {
        if (over) return;
        over = true;
        clearTimeout(timer);
        if (groups.get(el) === fin) { groups.delete(el); el.style.willChange = ''; }
        if (ok) commit(el, end);
        anims.forEach(function (a) { a.onfinish = a.oncancel = null; try { a.cancel(); } catch (e) { /* */ } });
        res();
      }
      groups.set(el, fin);
      el.style.willChange = 'transform, opacity';
      parts.forEach(function (p) {
        var o = { duration: p.ms, easing: p.e || 'linear', delay: p.d || 0, fill: 'both' };
        if (p.add && ADD) o.composite = 'add';
        total = Math.max(total, o.delay + p.ms);
        try {
          var a = el.animate(p.k, o);
          a.onfinish = function () { if (--left <= 0) fin(true); };
          a.oncancel = function () { fin(false); };
          anims.push(a);
        } catch (e) { left--; }
      });
      if (!anims.length) return fin(true);
      timer = setTimeout(function () { fin(true); }, total + 300); // фонова вкладка / зупинений таймлайн
    });
  }

  M.reduced = reduced;
  M.stop = stop;
  M.wait = function (ms) { return reduced() ? done() : new Promise(function (r) { setTimeout(r, ms); }); };

  // Поява з пружинкою. Великі елементи (модалки) — м'якше: від 0.9
  M.popIn = function (el, o) {
    o = o || {};
    if (!el) return done();
    release(el);
    if (still()) return run(el, []);
    var s0 = o.from || (el.offsetWidth * el.offsetHeight > 9e4 ? .9 : .5);
    return run(el, [
      { k: [{ opacity: 0 }, { opacity: 1 }], ms: dur.fast, e: ease.out, d: o.delay },
      { k: [{ transform: 'scale(' + s0 + ')' }, { transform: 'scale(1)' }], ms: o.ms || dur.slow, e: ease.spring, d: o.delay, add: 1 }
    ]);
  };
  M.popOut = function (el) {
    return run(el, [
      { k: [{ opacity: 1 }, { opacity: 0 }], ms: dur.fast, e: ease.inOut },
      { k: [{ transform: 'scale(1)' }, { transform: 'scale(.9)' }], ms: dur.fast, e: ease.inOut, add: 1 }
    ], { opacity: '0' });
  };

  // Натискання: 3D-елементи дизайн-системи — класом .is-pressed (CSS опускає «губу»), решта — WAAPI
  M.pressDown = function (el) {
    if (!el || still()) return done();
    if (el.matches && el.matches(PRESS)) {
      stop(el);
      el.classList.add('is-pressed');
      return new Promise(function (res) {
        setTimeout(function () { el.classList.remove('is-pressed'); setTimeout(res, dur.press); }, dur.press);
      });
    }
    return run(el, [{ k: [
      { transform: 'none', easing: ease.out },
      { transform: 'translateY(2px) scale(.96)', offset: .3, easing: ease.spring },
      { transform: 'none' }], ms: dur.press * 3, add: 1 }]);
  };

  M.shake = function (el) {
    return run(el, [{ k: [0, -10, 9, -7, 5, -3, 0].map(function (x) { return T(x + 'px', '0px'); }), ms: dur.slow, e: ease.out, add: 1 }]);
  };

  M.pulse = function (el, o) {
    o = o || {};
    return run(el, [{ k: [{ transform: 'scale(1)' }, { transform: 'scale(' + (o.scale || 1.15) + ')', offset: .3 }, { transform: 'scale(1)' }],
      ms: o.ms || dur.slow, e: ease.out, add: 1 }]);
  };

  // Підскок тултипа «ПОЧАТИ»: цикл 1.2 с; грає лише коли видно на екрані, вкладка активна і рух дозволено
  M.bounceTooltip = function (el) {
    var h = { stop: noop };
    if (!el || !HAS) return h;
    stop(el);
    var a, io, seen = !W.IntersectionObserver, off = false, T0 = T('0px', '0px'), T1 = T('0px', '-6px');
    T0.easing = T1.easing = ease.inOut;
    try { a = el.animate([T0, T1, T('0px', '0px')], { duration: dur.celebrate, iterations: Infinity, composite: ADD ? 'add' : 'replace' }); } catch (e) { return h; }
    a.pause();
    function upd() {
      if (off) return;
      if (seen && !D.hidden && !reduced()) a.play();
      else { a.pause(); if (reduced()) a.currentTime = 0; }
    }
    function kill() {
      if (off) return;
      off = true;
      if (io) io.disconnect();
      D.removeEventListener('visibilitychange', upd);
      if (mq && mq.removeEventListener) mq.removeEventListener('change', upd);
      if (groups.get(el) === kill) groups.delete(el);
      a.cancel();
    }
    groups.set(el, kill);
    D.addEventListener('visibilitychange', upd);
    if (mq && mq.addEventListener) mq.addEventListener('change', upd);
    if (!seen) { io = new IntersectionObserver(function (es) { seen = es[es.length - 1].isIntersecting; upd(); }); io.observe(el); }
    else upd();
    h.stop = kill;
    return h;
  };

  // Прогрес-бар: transform scaleX з легким перельотом; підсумок фіксується у style.transform
  function frac(x) { x = +x; return x > 0 ? (x < 1 ? x : 1) : 0; }
  M.springGrow = function (fill, from, to, o) {
    o = o || {};
    if (!fill) return done();
    if (from == null) { var m = /scaleX\(([\d.]+)/.exec(fill.style.transform); from = m ? +m[1] : 0; }
    from = frac(from); to = frac(to);
    var d = to - from, peak = frac(to + (d < 0 ? -1 : 1) * Math.min(.04, Math.abs(d) * .25)), end = { transform: 'scaleX(' + to + ')' };
    fill.style.transformOrigin = '0 50%';
    fill.style.transition = 'none'; // заливкою керує WAAPI, CSS-перехід лише заважав би
    if (from === to) return run(fill, [], end);
    return run(fill, [{ k: [
      { transform: 'scaleX(' + from + ')', easing: ease.out },
      { transform: 'scaleX(' + peak + ')', offset: .6, easing: ease.inOut },
      end], ms: o.ms || dur.slow }], end);
  };

  // Лічильник: onTick(value, n) на кожній зміні показаного числа (тики звуку XP)
  M.countUp = function (el, from, to, o) {
    o = o || {};
    from = Math.round(+from || 0); to = Math.round(+to || 0);
    var fmt = o.format || String, tick = typeof o.onTick === 'function' ? o.onTick : null;
    var prev = el && counters.get(el);
    if (prev) prev(false);
    function show(v) { if (el) el.textContent = fmt(v); }
    function beat(v, n) { if (tick) try { tick(v, n); } catch (e) { later(e); } }
    if (from === to || reduced()) { show(to); if (from !== to) beat(to, 0); return done(); }
    var ms = o.ms || Math.max(dur.slow, Math.min(dur.celebrate, Math.abs(to - from) * 20));
    return new Promise(function (res) {
      var t0 = 0, cur = from, n = 0, raf = 0, over = false, timer;
      function fin(ok) {
        if (over) return;
        over = true;
        cancelAnimationFrame(raf); clearTimeout(timer);
        if (el && counters.get(el) === fin) counters.delete(el);
        if (ok && cur !== to) { cur = to; show(to); beat(to, n++); }
        res();
      }
      function step(now) {
        if (!t0) t0 = now;
        var p = Math.min(1, (now - t0) / ms), v = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
        if (v !== cur) { cur = v; show(v); beat(v, n++); }
        if (p < 1) raf = requestAnimationFrame(step); else fin(true);
      }
      if (el) counters.set(el, fin);
      show(from);
      raf = requestAnimationFrame(step);
      timer = setTimeout(function () { fin(true); }, ms + 1000);
    });
  };

  // FLIP: замір → mutate() → інверсія → пружина до нуля. Елемент або пара [el, джерело] (плитка переїхала
  // в інший елемент — анімуємо новий від місця старого)
  function box(el) {
    if (!el || !el.isConnected) return null;
    var r = el.getBoundingClientRect();
    return r.width || r.height ? r : null;
  }
  M.flip = function (els, mutate, o) {
    o = o || {};
    var list = arr(els).map(function (x) { return x && x.nodeType ? [x, x] : x; }).filter(function (p) { return p && p[0]; });
    var first = still() ? null : list.map(function (p) { return box(p[1]); });
    if (first) list.forEach(function (p) { stop(p[0]); stop(p[1]); });
    return new Promise(function (res) { res(mutate && mutate()); }).then(function () {
      if (!first) return;
      var last = list.map(function (p) { return box(p[0]); });
      return Promise.all(list.map(function (p, i) {
        var a = first[i], b = last[i];
        if (!a || !b) return;
        var dx = a.left + a.width / 2 - b.left - b.width / 2, dy = a.top + a.height / 2 - b.top - b.height / 2;
        var sx = a.width / b.width, sy = a.height / b.height, sc = Math.abs(sx - 1) > .02 || Math.abs(sy - 1) > .02;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && !sc) return;
        var k = sc ? [{ transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')' }, { transform: 'none' }]
          : [T(dx + 'px', dy + 'px'), T('0px', '0px')];
        return run(p[0], [{ k: k, ms: o.ms || dur.slow, e: o.ease || ease.spring, add: 1 }]);
      }));
    }).then(noop);
  };

  // Переліт дугою до цілі (нагорода → лічильник); наприкінці елемент зникає (opacity 0), ціль «пульсує»
  M.flyTo = function (el, target, o) {
    o = o || {};
    if (!el || !target) return done();
    if (still()) return run(el, [], { opacity: '0' });
    var a = el.getBoundingClientRect(), b = target.getBoundingClientRect(), k = [];
    var dx = b.left + b.width / 2 - a.left - a.width / 2, dy = b.top + b.height / 2 - a.top - a.height / 2;
    var s = Math.max(.35, Math.min(1, b.height / (a.height || 1))), lift = Math.min(160, Math.sqrt(dx * dx + dy * dy) * .35);
    for (var i = 0; i <= 12; i++) { // квадратична крива Безьє з контрольною точкою над серединою шляху
      var t = i / 12, u = 1 - t;
      k.push({ transform: 'translate(' + (u * t * dx + t * t * dx).toFixed(1) + 'px,' + (u * t * (dy - 2 * lift) + t * t * dy).toFixed(1) +
        'px) scale(' + (1 + (s - 1) * t).toFixed(3) + ')' });
    }
    var ms = o.ms || dur.slow + dur.base;
    return run(el, [
      { k: k, ms: ms, e: ease.inOut, add: 1 },
      { k: [{ opacity: 1 }, { opacity: 1, offset: .8 }, { opacity: 0 }], ms: ms }
    ], { opacity: '0' }).then(function () { if (o.pulse !== false) M.pulse(target); });
  };

  M.sheetUp = function (el, o) {
    o = o || {};
    if (o.backdrop) M.fadeIn(o.backdrop);
    if (el) release(el);
    return run(el, [{ k: [T('0px', '100%'), T('0px', '0px')], ms: o.ms || dur.base, e: ease.out, add: 1 }]);
  };
  M.sheetDown = function (el, o) {
    o = o || {};
    var ms = o.ms || dur.base * .8, end = T('0px', '100%');
    end.opacity = '0';
    if (o.backdrop) M.fadeOut(o.backdrop);
    return run(el, [
      { k: [T('0px', '0px'), T('0px', '100%')], ms: ms, e: ease.inOut, add: 1 },
      { k: [{ opacity: 1 }, { opacity: 1, offset: .6 }, { opacity: 0 }], ms: ms }
    ], end);
  };

  // Втрата серця: пульс → хитання → потьмяніння (+ «−1»). { empty: true } — серце лишається тьмяним
  M.heartBreak = function (heart, o) {
    o = o || {};
    if (!heart) return done();
    if (o.text !== false) M.floatText(heart, o.text || '−1', { tone: 'error' });
    var ms = dur.slow + dur.base + 50;
    return run(heart, [
      { k: [
        { transform: 'none', easing: ease.out },
        { transform: 'scale(1.3)', offset: .15, easing: ease.inOut },
        { transform: 'scale(1.1) rotate(-14deg)', offset: .32, easing: ease.inOut },
        { transform: 'scale(1.05) rotate(11deg)', offset: .48, easing: ease.inOut },
        { transform: 'scale(.92) rotate(-5deg)', offset: .64, easing: ease.out },
        { transform: 'none' }], ms: ms, add: 1 },
      { k: [{ opacity: 1 }, { opacity: 1, offset: .45 }, { opacity: .35, offset: .7 }, { opacity: o.empty ? .35 : 1 }], ms: ms }
    ], o.empty ? { opacity: '.35' } : null);
  };

  // «+10 XP», «−1»: спливає над якорем і зникає, елемент прибирає сам. Тони: success/error/xp/info/streak/brand
  var TONE = { success: ['--c-success', '#237A35'], error: ['--c-error', '#C41E3A'], xp: ['--c-xp', '#8A6A00'],
    info: ['--c-info', '#1868B0'], streak: ['--c-streak', '#B25400'], brand: ['--c-brand', '#C8440F'] };
  M.floatText = function (anchor, text, o) {
    o = o || {};
    if (!anchor || !D.body || still()) return done();
    var r = anchor.getBoundingClientRect(), c = TONE[o.tone], s = D.createElement('span');
    s.className = 'd-float-text' + (c ? ' d-float-text--' + o.tone : '');
    s.setAttribute('aria-hidden', 'true');
    s.textContent = text;
    s.style.cssText = 'position:fixed;left:' + (r.left + r.width / 2) + 'px;top:' + r.top + 'px;z-index:calc(var(--z-toast,600) + 1);' +
      'pointer-events:none;white-space:nowrap;font-weight:900;font-size:var(--fs-lg,19px);line-height:1;color:' +
      (c ? 'var(' + c[0] + ',' + c[1] + ')' : 'inherit') + ';text-shadow:0 0 3px var(--c-surface,#fff),0 0 3px var(--c-surface,#fff)';
    D.body.appendChild(s);
    var ms = dur.slow * 2 + 100;
    return run(s, [
      { k: [{ transform: 'translate(-50%,-40%) scale(.7)' }, { transform: 'translate(-50%,-110%) scale(1.1)', offset: .22 },
        { transform: 'translate(-50%,-100%) scale(1)', offset: .35 }, { transform: 'translate(-50%,-260%) scale(1)' }], ms: ms, e: ease.out },
      { k: [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .6 }, { opacity: 0 }], ms: ms }
    ]).then(function () { s.remove(); });
  };

  // Конфеті: canvas поверх сторінки (pointer-events: none), 80–120 частинок у кольорах токенів,
  // гравітація + опір повітря + «перевертання»; наприкінці canvas видаляється, rAF скасовується
  var PAL = [['--c-brand', '#C8440F'], ['--c-success', '#237A35'], ['--c-xp', '#C9A22E'], ['--c-info', '#1868B0'], ['--c-streak', '#D9791E']];
  M.confetti = function (o) {
    o = o || {};
    if (still() || !D.body) return done();
    var cv = D.createElement('canvas'), g = cv.getContext && cv.getContext('2d');
    if (!g) return done();
    var w = W.innerWidth, h = W.innerHeight, ms = o.ms || 1400, org = o.origin, ox = w / 2, oy = h * .35, i;
    var dpr = Math.max(.5, Math.min(W.devicePixelRatio || 1, 2, Math.sqrt(2.4e6 / (w * h)))); // ≤ 2.4 Мп полотна
    var cs = getComputedStyle(D.documentElement), cols = PAL.map(function (p) { return cs.getPropertyValue(p[0]).trim() || p[1]; });
    if (org && org.getBoundingClientRect) { var b = org.getBoundingClientRect(); ox = b.left + b.width / 2; oy = b.top + b.height / 2; }
    else if (org) { if (org.x != null) ox = org.x * w; if (org.y != null) oy = org.y * h; }
    var n = Math.max(80, Math.min(120, o.count || (w < 480 ? 80 : 110))), sp = Math.max(h, 560), ps = [];
    for (i = 0; i < n; i++) {
      var ang = -Math.PI / 2 + (Math.random() - .5) * 2.4, v = sp * (.8 + Math.random() * .9), rib = Math.random() < .3;
      ps.push({ x: ox, y: oy, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, r: Math.random() * 6.3, vr: (Math.random() - .5) * 18,
        t: Math.random() * 6.3, vt: 6 + Math.random() * 8, w: rib ? 4 : 7 + Math.random() * 5, h: rib ? 12 + Math.random() * 6 : 5 + Math.random() * 3, c: i % cols.length });
    }
    ps.sort(function (p, q) { return p.c - q.c; });
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:calc(var(--z-toast,600) + 2)';
    D.body.appendChild(cv);
    return new Promise(function (res) {
      var t0 = 0, prev = 0, raf = 0, over = false, G = sp * 1.5, timer;
      function fin() { if (over) return; over = true; cancelAnimationFrame(raf); clearTimeout(timer); cv.remove(); res(); }
      function frame(now) {
        if (!t0) t0 = prev = now;
        var el = now - t0, dt = Math.min(.05, (now - prev) / 1000), drag = Math.exp(-2.2 * dt), fade = el > ms * .7 ? Math.max(0, (ms - el) / (ms * .3)) : 1, c = -1;
        prev = now;
        if (el >= ms) return fin();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, cv.width, cv.height);
        for (var j = 0; j < n; j++) {
          var p = ps[j];
          p.vx *= drag; p.vy = p.vy * drag + G * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.t += p.vt * dt;
          if (p.y > h + 20 || p.x < -20 || p.x > w + 20) continue;
          if (p.c !== c) { c = p.c; g.fillStyle = cols[c]; }
          var co = Math.cos(p.r) * dpr, si = Math.sin(p.r) * dpr, f = Math.cos(p.t);
          g.globalAlpha = fade * (.55 + .45 * Math.abs(f)); // «перевертання» — світліша/темніша сторона
          g.setTransform(co, si, -si * f, co * f, p.x * dpr, p.y * dpr);
          g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
      timer = setTimeout(fin, ms + 500);
    });
  };

  M.fadeIn = function (el, o) {
    o = o || {};
    if (!el) return done();
    var own = owned.get(el), from = own && own.opacity ? +el.style.opacity || 0 : 0;
    release(el);
    return run(el, [{ k: [{ opacity: from }, { opacity: 1 }], ms: o.ms || dur.base, e: ease.out, d: o.delay }]);
  };
  // { to: 0.4 } — «пригаснути» до значення; { hide: true } — наприкінці hidden = true
  M.fadeOut = function (el, o) {
    o = o || {};
    var to = o.to == null ? 0 : +o.to;
    return run(el, [{ k: [{ opacity: to }], ms: o.ms || dur.fast, e: ease.out }], { opacity: String(to) }).then(function () {
      if (o.hide && el) { el.hidden = true; commit(el, { opacity: '' }); }
    });
  };

  M.stagger = function (els, fn, step) {
    els = arr(els);
    step = reduced() ? 0 : step == null ? 60 : +step;
    return Promise.all(els.map(function (el, i) {
      return new Promise(function (res) {
        function go() { try { res(fn(el, i)); } catch (e) { res(); later(e); } }
        if (step && i) setTimeout(go, i * step); else go();
      });
    })).then(noop);
  };
})();
