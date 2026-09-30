/* Ikorka Duo — звук: window.Duo.sfx, вібрація: window.Duo.haptics (власник — motion-sound-designer).
 * Контракт — docs/design/ARCHITECTURE.md §4.4, палітра й правила — docs/design/SOUND_SPEC.md.
 * Жодних файлів: усі звуки синтезуються Web Audio (осцилятори, огинальні ADSR, фільтри, трохи шуму) в одній
 * тональності — ре-мажорна пентатоніка D E F# A B, тож звучать як одна родина. AudioContext створюється ліниво
 * на першому жесті користувача; до того play() — тихий no-op. Ланцюг: голоси → компресор → гучність → вихід. */
(function () {
  'use strict';
  var W = window, D = document, N = W.navigator || {}, Duo = W.Duo = W.Duo || {};
  var AC = W.AudioContext || W.webkitAudioContext, OAC = W.OfflineAudioContext || W.webkitOfflineAudioContext;
  var KEY = 'ikorka-duo-sound', HKEY = 'ikorka-duo-haptics';
  var ctx = null, bus = null, vol = .5, voices = 0, idle = 0, gest = false, last = {}, noise = new WeakMap();

  function ls(k, v) {
    try { if (v == null) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* приватний режим */ }
    return null;
  }
  var on = ls(KEY) !== 'off', hapOn = ls(HKEY) !== 'off';
  W.addEventListener('storage', function (e) {
    if (e.key === KEY) on = e.newValue !== 'off';
    if (e.key === HKEY) hapOn = e.newValue !== 'off';
  });
  function noop() {}
  function quiet(p) { if (p && p.catch) p.catch(noop); }

  // ---- висота: MIDI → Гц; deg(n) — n-й щабель пентатоніки D E F# A B від D4 (0 → D4, 5 → D5, 8 → A5)
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  var PENTA = [0, 2, 4, 7, 9];
  function deg(n) { return 62 + 12 * Math.floor(n / 5) + PENTA[n % 5]; }

  // Компресор — страхувальний лімітер для накладень (поріг −6 dB, ~+1.6 dB компенсації). Стартує «стиснутим»
  // і відпускає ~0.3 с, тому перший звук сесії трохи тихіший; далі рівні стабільні (див. SOUND_SPEC).
  function chain(ac, v) {
    var c = ac.createDynamicsCompressor(), g = ac.createGain();
    c.threshold.value = -6; c.knee.value = 6; c.ratio.value = 4; c.attack.value = .003; c.release.value = .12;
    g.gain.value = v;
    c.connect(g); g.connect(ac.destination);
    return { input: c, gain: g };
  }

  // ---- набір інструментів для конкретного контексту (реальний або офлайн для аналізу)
  function kit(ac, out) {
    var real = ac === ctx;
    function track(src, nodes) {
      if (real) voices++;
      src.onended = function () { if (real) voices--; nodes.forEach(function (x) { if (x) x.disconnect(); }); };
    }
    // ADSR: атака лінійна, спад/відпуск експоненційні (природне згасання)
    function env(p, t, a, d, s, h, r, pk) {
      var sl = Math.max(pk * s, 1e-4);
      p.setValueAtTime(0, t);
      p.linearRampToValueAtTime(pk, t + a);
      p.exponentialRampToValueAtTime(sl, t + a + d);
      if (h) p.setValueAtTime(sl, t + a + d + h);
      p.exponentialRampToValueAtTime(1e-4, t + a + d + h + r);
      return t + a + d + h + r;
    }
    function nbuf() {
      var b = noise.get(ac);
      if (!b) {
        b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        for (var d = b.getChannelData(0), i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        noise.set(ac, b);
      }
      return b;
    }
    return {
      // тон: f, f2/g — глісандо, w — форма хвилі, a/d/s/h/r — огинальна, p — пік, lp/lp2/q — фільтр, dt — розстроювання
      v: function (t, o) {
        var osc = ac.createOscillator(), g = ac.createGain(), f = null, a = o.a || .003, d = o.d || .15;
        osc.type = o.w || 'sine';
        osc.frequency.setValueAtTime(o.f, t);
        if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.g || .1));
        if (o.dt) osc.detune.setValueAtTime(o.dt, t);
        if (o.lp) {
          f = ac.createBiquadFilter();
          f.type = 'lowpass'; f.Q.value = o.q || .7;
          f.frequency.setValueAtTime(o.lp, t);
          if (o.lp2) f.frequency.exponentialRampToValueAtTime(o.lp2, t + a + d);
          osc.connect(f); f.connect(g);
        } else osc.connect(g);
        g.connect(out);
        var end = env(g.gain, t, a, d, o.s || 0, o.h || 0, o.r || .04, o.p || .2);
        osc.start(t); osc.stop(end + .02);
        track(osc, [osc, f, g]);
      },
      // шум через фільтр: ty — тип фільтра (bandpass за замовчуванням), f → f2 — рух частоти
      n: function (t, o) {
        var src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), a = o.a || .002, d = o.d || .05;
        src.buffer = nbuf();
        f.type = o.ty || 'bandpass'; f.Q.value = o.q || 1;
        f.frequency.setValueAtTime(o.f, t);
        if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + a + d);
        src.connect(f); f.connect(g); g.connect(out);
        var end = env(g.gain, t, a, d, 0, 0, .02, o.p || .1);
        src.start(t, Math.random() * .4); src.stop(end + .02);
        track(src, [src, f, g]);
      }
    };
  }

  // ---- тембри родини
  function mallet(K, t, m, p, d) { // «маримба»: основний тон + 2 октави вгору (дерево) + октава (блиск)
    var f = hz(m);
    K.v(t, { f: f, p: p, d: d });
    K.v(t, { f: f * 4, p: p * .2, d: d * .3 });
    K.v(t, { f: f * 2, w: 'triangle', p: p * .12, d: d * .5 });
  }
  function bell(K, t, m, p, d) { // дзвіночок: гармоніки 1–3 + легкий «метал» 4.2
    var f = hz(m);
    K.v(t, { f: f, p: p, d: d });
    K.v(t, { f: f * 2, p: p * .45, d: d * .6 });
    K.v(t, { f: f * 3, p: p * .2, d: d * .35 });
    K.v(t, { f: f * 4.2, p: p * .08, d: d * .2 });
  }
  function ting(K, t, m, p, d) { // легкий «дзинь» для глісандо
    var f = hz(m);
    K.v(t, { f: f, p: p, d: d });
    K.v(t, { f: f * 3, p: p * .25, d: d * .4 });
  }
  function thud(K, t, m, p, d) { // м'який низький «бум»: трикутник з падінням висоти крізь фільтр + синус
    var f = hz(m);
    K.v(t, { f: f * 1.5, f2: f, g: .04, w: 'triangle', lp: 900, p: p, d: d });
    K.v(t, { f: f, p: p * .7, d: d * 1.3 });
    K.v(t, { f: f * 2, p: p * .25, d: d * .6 });
  }
  function brass(K, t, m, p, h) { // теплий «мідний» акорд: дві розстроєні пилки крізь фільтр, що закривається
    var f = hz(m), lp = Math.min(f * 6, 4000);
    K.v(t, { f: f, w: 'sawtooth', dt: -6, lp: lp, lp2: f * 2.5, q: .9, a: .02, d: .15, s: .55, h: h, r: .25, p: p });
    K.v(t, { f: f, w: 'sawtooth', dt: 6, lp: lp, lp2: f * 2.5, q: .9, a: .02, d: .15, s: .55, h: h, r: .25, p: p });
  }

  // ---- палітра (MIDI: D4 62, F#4 66, A4 69, D5 74, E5 76, F#5 78, A5 81, B5 83, D6 86, F#6 90, A6 93)
  var S = {
    tap: function (K, t) { // м'який «ток»
      K.v(t, { f: hz(86), f2: hz(81), g: .02, p: .14, d: .05 });
      K.n(t, { ty: 'highpass', f: 3000, p: .06, d: .012 });
    },
    click: function (K, t) { // сухий короткий клац
      K.n(t, { f: 3500, q: 1.4, p: .26, d: .016 });
      K.v(t, { f: hz(93), w: 'triangle', p: .07, d: .02 });
    },
    tileSelect: function (K, t) { // «бліп» угору F#5 → A5
      K.v(t, { f: hz(78), f2: hz(81), g: .035, p: .2, d: .11 });
      K.v(t, { f: hz(81) * 4, p: .025, d: .03 });
    },
    tileReturn: function (K, t) { // «блуп» униз A5 → E5
      K.v(t, { f: hz(81), f2: hz(76), g: .05, p: .17, d: .11 });
    },
    correct: function (K, t) { // «дзінь-дзінь»: A5 → D6 (кварта вгору — «розв'язка» на тоніку)
      bell(K, t, 81, .24, .3);
      bell(K, t + .085, 86, .28, .42);
      K.v(t + .085, { f: hz(74), p: .08, d: .24 });
    },
    wrong: function (K, t) { // м'яке «бу-бум»: A3 → F#3, мала терція вниз
      thud(K, t, 57, .28, .2);
      thud(K, t + .11, 54, .26, .28);
    },
    combo: function (K, t) { // швидке арпеджіо D5 → D6 + іскра A6
      [74, 76, 78, 81, 83, 86].forEach(function (m, i) { mallet(K, t + i * .045, m, .17 + i * .02, .16); });
      bell(K, t + .27, 93, .13, .5);
    },
    heartLose: function (K, t) { // «тріск» + спадне ковзання D5 → D4
      K.n(t, { f: 2000, q: 2, p: .16, d: .03 });
      K.v(t, { f: hz(74), f2: hz(62), g: .35, w: 'triangle', lp: 2200, p: .21, a: .01, d: .12, s: .6, h: .12, r: .15 });
    },
    lessonComplete: function (K, t) { // фанфара ~1.2 с: арпеджіо D–F#–A, акорд D-мажор, дзвіночки, бас
      mallet(K, t, 74, .24, .3); mallet(K, t + .12, 78, .24, .3); mallet(K, t + .24, 81, .26, .35);
      var c = t + .38;
      [74, 78, 81].forEach(function (m) { brass(K, c, m, .055, .3); });
      bell(K, c, 86, .19, .9); bell(K, c + .1, 90, .11, .7); bell(K, c + .2, 93, .09, .6);
      K.v(c, { f: hz(50), p: .16, d: .8 });
    },
    xpTick: function (K, t, o) { // короткий високий тик; { pitch: n } — n-й тик, висота росте щаблями від A5
      var m = deg(8 + Math.max(0, Math.min(6, o.pitch | 0)));
      K.v(t, { f: hz(m), w: 'triangle', p: .11, d: .035 });
      K.v(t, { f: hz(m) * 2, p: .03, d: .02 });
    },
    streak: function (K, t) { // теплий підйом: квінта D4+A4 → A4+E5, фільтр відкривається, «вогонь», дзвін
      [[62, 69, .14], [69, 76, .1]].forEach(function (x) {
        K.v(t, { f: hz(x[0]), f2: hz(x[1]), g: .3, w: 'triangle', lp: 500, lp2: 2600, a: .12, d: .25, s: .5, h: .1, r: .3, p: x[2] });
      });
      K.n(t, { f: 400, f2: 2400, q: .9, a: .15, d: .3, p: .12 });
      bell(K, t + .32, 86, .17, .7); bell(K, t + .32, 81, .08, .6);
    },
    chest: function (K, t) { // «клац» кришки + іскристе глісандо A5 → F#7 + мерехтіння
      K.v(t, { f: hz(50), f2: hz(45), g: .06, w: 'triangle', lp: 700, p: .26, d: .12 });
      for (var i = 0; i < 10; i++) ting(K, t + .08 + i * .032, deg(8 + i), .13 + i * .007, .25);
      K.n(t + .08, { ty: 'highpass', f: 6000, a: .05, d: .45, p: .04 });
    },
    goal: function (K, t) { // тріумфальні три ноти A4 – D5 – A5 (остання тримається)
      [[69, 0], [74, .14], [81, .28]].forEach(function (x, i) {
        mallet(K, t + x[1], x[0], .18, i < 2 ? .22 : .6);
        brass(K, t + x[1], x[0], .04, i < 2 ? .04 : .45);
      });
      bell(K, t + .28, 93, .09, .8);
      K.v(t + .28, { f: hz(50), p: .14, d: .7 });
    },
    unlock: function (K, t) { // магічний підйом A4 → A5 і дзвіночки D6 F#6 A6
      K.v(t, { f: hz(69), f2: hz(81), g: .32, p: .14, a: .05, d: .3, s: .3, r: .2 });
      [86, 90, 93].forEach(function (m, i) { bell(K, t + .26 + i * .06, m, .15, .55); });
      K.n(t + .24, { ty: 'highpass', f: 5000, a: .04, d: .35, p: .03 });
    },
    matchPair: function (K, t, o) { // легке «дінь-дінь» кварта вгору; { n } — номер пари поспіль, зсуває вгору
      var k = Math.max(0, Math.min(4, o.n | 0));
      mallet(K, t, deg(7 + k), .22, .16);
      mallet(K, t + .06, deg(9 + k), .25, .24);
    },
    sheet: function (K, t, o) { // м'який «вжух»; { dir: 'down' } — униз
      var up = o.dir !== 'down';
      K.n(t, { f: up ? 500 : 1600, f2: up ? 1600 : 500, q: .8, a: .06, d: .14, p: .32 });
    }
  };

  // ---- контекст: лише після жесту (інакше Chrome пише попередження автоплею)
  function active() { return N.userActivation ? N.userActivation.isActive : true; }
  function unlock() {
    if (!AC || !on) return;
    if (!ctx) {
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return; } }
      bus = chain(ctx, vol);
    }
    if (ctx.state !== 'running' && ctx.state !== 'closed') quiet(ctx.resume());
  }
  function onGesture(e) {
    if (e.isTrusted === false || !active()) return; // дотик: активація приходить на pointerup/touchend
    gest = true;
    if (!ctx || ctx.state !== 'running') unlock();
  }
  ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'].forEach(function (t) {
    W.addEventListener(t, onGesture, { capture: true, passive: true });
  });
  function sleep() { if (ctx && ctx.state === 'running') quiet(ctx.suspend()); }
  D.addEventListener('visibilitychange', function () { if (D.hidden) sleep(); });

  var GAP = { tap: 25, click: 25, tileSelect: 25, tileReturn: 25, xpTick: 30 };
  function play(name, o) {
    var fn = S[name];
    if (!fn || !on || D.hidden) return false;
    if (!ctx && N.userActivation && N.userActivation.isActive) unlock();
    if (!ctx || ctx.state === 'closed') return false;
    var now = Date.now();
    if (now - (last[name] || 0) < (GAP[name] || 60) || voices > 90) return false;
    last[name] = now;
    if (ctx.state !== 'running') unlock();
    try { fn(kit(ctx, bus.input), ctx.currentTime + .005, o || {}); } catch (e) { return false; }
    clearTimeout(idle);
    idle = setTimeout(sleep, 30000); // тиша 30 с → призупинити аудіопотік (батарея); жест розбудить
    return true;
  }

  // Офлайн-рендер звуку (стенд і перевірка: хвиля, пік, тривалість). Не потребує жесту. Звук стартує на
  // RENDER_AT с — після того, як компресор «відпустив», як у живому контексті.
  var RENDER_AT = .6;
  function render(name, o) {
    o = o || {};
    if (!OAC || !S[name]) return Promise.resolve(null);
    var sr = o.sampleRate || 44100, oc = new OAC(1, Math.ceil(sr * (RENDER_AT + (o.seconds || 2))), sr);
    S[name](kit(oc, chain(oc, o.volume == null ? 1 : o.volume).input), RENDER_AT, o);
    return oc.startRendering();
  }

  var X = Duo.sfx = {
    play: play,
    names: Object.keys(S),
    state: function () { return !AC ? 'unsupported' : !ctx ? 'locked' : ctx.state; },
    unlock: function () { if (active()) unlock(); },
    _render: render,
    _renderAt: RENDER_AT
  };
  Object.defineProperty(X, 'enabled', {
    enumerable: true,
    get: function () { return on; },
    set: function (v) {
      on = !!v;
      ls(KEY, on ? 'on' : 'off');
      if (!ctx) { if (on && N.userActivation && N.userActivation.isActive) unlock(); return; }
      bus.gain.gain.setTargetAtTime(on ? vol : 0, ctx.currentTime, .02);
      if (on) unlock(); else setTimeout(function () { if (!on) sleep(); }, 150);
    }
  });
  Object.defineProperty(X, 'volume', {
    enumerable: true,
    get: function () { return vol; },
    set: function (v) {
      v = +v;
      vol = v > 0 ? (v < 1 ? v : 1) : 0;
      if (ctx && on) bus.gain.gain.setTargetAtTime(vol, ctx.currentTime, .02);
    }
  });

  // ---- вібрація: вимикається разом зі звуком; окремо — Duo.haptics.enabled або progress.settings().haptics === false
  var PAT = { tap: 10, correct: 20, wrong: [35, 70, 35], celebrate: [25, 50, 25, 50, 90] };
  var H = Duo.haptics = {
    play: function (k) {
      var p = PAT[k];
      if (!p || typeof N.vibrate !== 'function' || !H.enabled) return false;
      if (N.userActivation ? !N.userActivation.hasBeenActive : !gest) return false; // інакше Chrome пише Intervention
      try { return !!N.vibrate(p); } catch (e) { return false; }
    }
  };
  Object.defineProperty(H, 'enabled', {
    enumerable: true,
    get: function () {
      if (!hapOn) return false; // незалежно від перемикача «Звук»
      try { var s = Duo.progress && Duo.progress.settings && Duo.progress.settings(); if (s && s.haptics === false) return false; } catch (e) { /* */ }
      return true;
    },
    set: function (v) { hapOn = !!v; ls(HKEY, hapOn ? 'on' : 'off'); }
  });
})();
