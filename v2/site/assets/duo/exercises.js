/* ==========================================================================
   Ikorka Duo — exercises.js
   Власник: builder-lesson. 8 типів кроків (v2/duo/SCHEMA.md): theory, choice, build, match, order, fill,
   spot, truefalse. Кожен тип — функція (step, host, api) → екземпляр вправи.
   Екземпляр: { info?, auto?, canCheck(), check() → результат, key(n), enterChecks(target), destroy() }.
   Результат check(): { correct, answer?, answerList?, answerLabel?, why?, note? }.
   api (дає lesson.js): { changed(), emit(signal), requestCheck() }; emit -> Duo.signals.emit (tap_tile).
   Тексти інтерфейсу — Duo.exercises.labels (виставляє lesson.js); тут лише розмітка і поведінка.
   Анімуємо лише через Duo.motion (transform/opacity). Не падає без Duo.motion / Duo.signals.
   ========================================================================== */
(function () {
  'use strict';
  var Duo = window.Duo = window.Duo || {};
  var X = Duo.exercises = { types: {}, labels: {} };

  /* ------------------------------ утиліти ------------------------------ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function L(key) { var v = X.labels && X.labels[key]; return typeof v === 'string' ? v : ''; }
  function el(tag, cls, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    return e;
  }
  function shuffle(list, avoidSame) {
    var a = list.slice(), i, j, t, tries = 0, same;
    do {
      for (i = a.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
      same = avoidSame && a.length > 1 && a.every(function (x, n) { return x === list[n]; });
    } while (same && ++tries < 8);
    return a;
  }
  // плитки → речення: без пробілу перед розділовими знаками і після відкривальної лапки
  function joinTiles(tiles) {
    return tiles.join(' ').replace(/\s+([,.!?:;»…)])/g, '$1').replace(/([«(])\s+/g, '$1');
  }
  // before + пропуск + after; розділовий знак на початку after склеюється без пробілу
  function joinSentence(before, mid, after) {
    var b = String(before == null ? '' : before).replace(/\s+$/, ''), m = String(mid || ''), a = String(after == null ? '' : after).replace(/^\s+/, '');
    var out = b;
    if (out && m) out += /[«(\[„]$/.test(out) ? '' : ' ';
    out += m;
    if (a) out += (!out || /^[,.;:!?)»…\]]/.test(a)) ? '' : ' ';
    return out + a;
  }
  function M(name) { return Duo.motion && typeof Duo.motion[name] === 'function' ? Duo.motion[name] : null; }
  function shake(node) { var f = M('shake'); if (f && node) f(node); }
  function flip(els, mutate, opts) {
    var f = M('flip');
    if (f) return f(els, mutate, opts);
    mutate(); return Promise.resolve();
  }
  function icon(name, size) { return Duo.icon ? Duo.icon(name, { size: size || 20 }) : ''; }
  var uid = 0;

  // Заголовок кроку: prompt з даних або типова інструкція
  function head(host, step, fallbackKey) {
    var id = 'dl-q-' + (++uid);
    var h = el('h1', 'dl-prompt', { id: id });
    h.textContent = step.prompt || L(fallbackKey);
    host.appendChild(h);
    host.setAttribute('aria-labelledby', id);
    return h;
  }
  function say(host, text, labelKey) {
    var b = el('div', 'd-speech dl-say');
    b.innerHTML = '<span class="dl-say__label">' + esc(L(labelKey || 'clientSays')) + '</span><span class="dl-say__text">' + esc(text) + '</span>';
    host.appendChild(b);
    return b;
  }

  // Група радіо-кнопок (choice, truefalse, fill, spot): ролі, roving tabindex, стрілки, цифри
  function radios(root, buttons, api) {
    var sel = -1, locked = false;
    buttons.forEach(function (b, i) {
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.tabIndex = i === 0 ? 0 : -1;
      b.addEventListener('click', function () { pick(i); });
    });
    function pick(i) {
      if (locked || i < 0 || i >= buttons.length || i === sel) return;
      sel = i;
      buttons.forEach(function (b, n) {
        var on = n === i;
        b.classList.toggle('is-selected', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      });
      api.emit('tap_tile'); api.changed();
    }
    root.addEventListener('keydown', function (e) {
      if (locked || e.altKey || e.ctrlKey || e.metaKey) return;
      var k = e.key, cur = buttons.indexOf(document.activeElement), n = -1;
      if (cur < 0) return;
      if (k === 'ArrowDown' || k === 'ArrowRight') n = (cur + 1) % buttons.length;
      else if (k === 'ArrowUp' || k === 'ArrowLeft') n = (cur - 1 + buttons.length) % buttons.length;
      else if (k === 'Home') n = 0;
      else if (k === 'End') n = buttons.length - 1;
      if (n < 0) return;
      e.preventDefault();
      buttons[n].focus();
      pick(n);
    });
    return {
      get sel() { return sel; },
      pick: pick,
      lock: function () { locked = true; },
      enterChecks: function (t) { var i = buttons.indexOf(t); return i < 0 || i === sel; }
    };
  }
  function optionButton(html, n, withKey) {
    var b = el('button', 'd-option', { type: 'button' });
    b.innerHTML = (withKey === false ? '' : '<span class="d-option__key" aria-hidden="true">' + n + '</span>') + '<span class="dl-opt__text">' + html + '</span>';
    return b;
  }
  // Підсвітка після перевірки: status — 'is-correct' | 'is-wrong' | null; решта кнопок гаснуть
  function paint(buttons, marks) {
    buttons.forEach(function (b, i) {
      b.classList.remove('is-selected');
      b.setAttribute('aria-disabled', 'true');
      b.tabIndex = -1;
      if (marks[i]) b.classList.add(marks[i]); else b.classList.add('is-disabled');
    });
  }

  /* ------------------------------- theory ------------------------------- */
  X.types.theory = function (step, host) {
    host.classList.add('dl-card--theory');
    if (Duo.mascot && typeof Duo.mascot.svg === 'function') {
      try {
        var m = el('div', 'dl-theory__mascot', { 'aria-hidden': 'true' });
        m.innerHTML = Duo.mascot.svg('thinking', { size: 72 });
        host.appendChild(m);
      } catch (e) { /* маскот необов'язковий */ }
    }
    var id = 'dl-q-' + (++uid);
    var h = el('h1', 'dl-prompt dl-prompt--theory', { id: id });
    h.textContent = step.title || L('theoryTitle');
    host.appendChild(h);
    host.setAttribute('aria-labelledby', id);
    var p = el('p', 'dl-theory__text');
    p.textContent = step.text || '';
    host.appendChild(p);
    if (step.example) {
      var q = el('figure', 'dl-quote');
      q.innerHTML = '<figcaption class="dl-quote__label">' + esc(L('example')) + '</figcaption><blockquote class="dl-quote__text">' + esc(step.example) + '</blockquote>';
      host.appendChild(q);
    }
    return {
      info: true,
      canCheck: function () { return true; },
      check: function () { return { correct: true }; },
      key: function () {},
      enterChecks: function () { return true; },
      destroy: function () {}
    };
  };

  /* ------------------------------- choice ------------------------------- */
  X.types.choice = function (step, host, api) {
    head(host, step, 'pChoice');
    if (step.context) say(host, step.context, 'clientSays');
    if (step.question) { var qn = el('p', 'dl-question'); qn.textContent = step.question; host.appendChild(qn); }
    var opts = shuffle((step.options || []).map(function (o) { return { text: o.text, correct: !!o.correct, why: o.why }; }));
    var list = el('div', 'dl-options', { role: 'radiogroup', 'aria-labelledby': host.getAttribute('aria-labelledby') });
    var btns = opts.map(function (o, i) { var b = optionButton(esc(o.text), i + 1); list.appendChild(b); return b; });
    host.appendChild(list);
    var rg = radios(list, btns, api);
    return {
      canCheck: function () { return rg.sel >= 0; },
      check: function () {
        var chosen = opts[rg.sel], right = opts.filter(function (o) { return o.correct; })[0] || {};
        var ci = opts.indexOf(right), marks = {};
        marks[rg.sel] = chosen.correct ? 'is-correct' : 'is-wrong';
        if (!chosen.correct) { marks[ci] = 'is-correct'; shake(btns[rg.sel]); }
        rg.lock(); paint(btns, marks);
        return chosen.correct ? { correct: true, why: chosen.why } : { correct: false, answer: right.text, why: chosen.why };
      },
      key: function (n) { rg.pick(n - 1); },
      enterChecks: rg.enterChecks,
      destroy: function () {}
    };
  };

  /* ------------------------------ truefalse ------------------------------ */
  X.types.truefalse = function (step, host, api) {
    head(host, step, 'pTruefalse');
    var st = el('div', 'd-speech dl-statement');
    st.textContent = step.statement || '';
    host.appendChild(st);
    var list = el('div', 'dl-options dl-options--tf', { role: 'radiogroup', 'aria-labelledby': host.getAttribute('aria-labelledby') });
    var vals = [true, false];
    var btns = [L('true'), L('false')].map(function (t, i) { var b = optionButton(esc(t), i + 1); b.classList.add('dl-option--tf'); list.appendChild(b); return b; });
    host.appendChild(list);
    var rg = radios(list, btns, api);
    return {
      canCheck: function () { return rg.sel >= 0; },
      check: function () {
        var ok = vals[rg.sel] === !!step.answer, marks = {}, ci = step.answer ? 0 : 1;
        marks[rg.sel] = ok ? 'is-correct' : 'is-wrong';
        if (!ok) { marks[ci] = 'is-correct'; shake(btns[rg.sel]); }
        rg.lock(); paint(btns, marks);
        return ok ? { correct: true } : { correct: false, answer: step.answer ? L('trueFull') : L('falseFull') };
      },
      key: function (n) { rg.pick(n - 1); },
      enterChecks: rg.enterChecks,
      destroy: function () {}
    };
  };

  /* --------------------------------- fill --------------------------------- */
  X.types.fill = function (step, host, api) {
    head(host, step, 'pFill');
    var before = String(step.before == null ? '' : step.before).replace(/\s+$/, ''), after = String(step.after == null ? '' : step.after).replace(/^\s+/, '');
    var p = el('p', 'dl-fill');
    var blank = el('span', 'dl-blank', { role: 'img', 'aria-label': L('blank') });
    blank.innerHTML = '<span class="dl-blank__text">&nbsp;</span>';
    var btxt = blank.firstChild;
    if (before) p.appendChild(document.createTextNode(before + (/[«(\[„]$/.test(before) ? '' : ' ')));
    p.appendChild(blank);
    if (after) p.appendChild(document.createTextNode((/^[,.;:!?)»…\]]/.test(after) ? '' : ' ') + after));
    host.appendChild(p);
    var opts = shuffle(step.options || [step.answer]);
    var list = el('div', 'dl-options', { role: 'radiogroup', 'aria-labelledby': host.getAttribute('aria-labelledby') });
    var btns = opts.map(function (t, i) { var b = optionButton(esc(t), i + 1); list.appendChild(b); return b; });
    host.appendChild(list);
    var rg = radios(list, btns, {
      emit: api.emit,
      changed: function () {
        blank.classList.add('is-filled');
        btxt.textContent = opts[rg.sel];
        blank.setAttribute('aria-label', L('blank') + ': ' + opts[rg.sel]);
        api.changed();
      }
    });
    return {
      canCheck: function () { return rg.sel >= 0; },
      check: function () {
        var chosen = opts[rg.sel], ok = chosen === step.answer, marks = {};
        marks[rg.sel] = ok ? 'is-correct' : 'is-wrong';
        blank.classList.add(ok ? 'is-correct' : 'is-wrong');
        if (!ok) { marks[opts.indexOf(step.answer)] = 'is-correct'; shake(blank); }
        rg.lock(); paint(btns, marks);
        return ok ? { correct: true } : { correct: false, answer: joinSentence(before, step.answer, after) };
      },
      key: function (n) { rg.pick(n - 1); },
      enterChecks: rg.enterChecks,
      destroy: function () {}
    };
  };

  /* --------------------------------- spot --------------------------------- */
  X.types.spot = function (step, host, api) {
    head(host, step, 'pSpot');
    var wrap = el('div', 'dl-spot', { role: 'radiogroup', 'aria-labelledby': host.getAttribute('aria-labelledby') });
    var btns = [], idx = [], n = 0;
    (step.lines || []).forEach(function (ln, i) {
      var isMgr = ln.who === 'manager';
      var who = '<span class="sr-only">' + esc(isMgr ? L('manager') : L('client')) + ': </span>';
      if (isMgr) {
        n++;
        var b = optionButton(who + esc(ln.text), n);
        b.classList.add('dl-line', 'dl-line--manager');
        wrap.appendChild(b); btns.push(b); idx.push(i);
      } else {
        var d = el('div', 'dl-line dl-line--client');
        d.innerHTML = who + esc(ln.text);
        wrap.appendChild(d);
      }
    });
    host.appendChild(wrap);
    var rg = radios(wrap, btns, api);
    var wrongAt = -1;
    btns.forEach(function (b, k) { if (step.lines[idx[k]].wrong) wrongAt = k; });
    return {
      canCheck: function () { return rg.sel >= 0; },
      check: function () {
        var ok = rg.sel === wrongAt, marks = {};
        marks[rg.sel] = ok ? 'is-correct' : 'is-wrong';
        if (!ok) { marks[wrongAt] = 'is-correct'; shake(btns[rg.sel]); }
        rg.lock(); paint(btns, marks);
        return ok ? { correct: true } : { correct: false, answer: step.lines[idx[wrongAt]].text, answerLabel: L('spotAnswer') };
      },
      key: function (k) { rg.pick(k - 1); },
      enterChecks: rg.enterChecks,
      destroy: function () {}
    };
  };

  /* ---------------------- build / order: плитки і відповідь ---------------------- */
  // Банк — один список плиток у порядку перемішування; тап переносить кнопку в рядок відповіді, її місце в банку
  // схлопується, решта переупаковується (FLIP по всіх плитках). Повернення тапом — на «рідне» місце за початковим порядком.
  function board(host, o, api) {
    var list = o.layout === 'list';
    var answer = el('div', 'dl-answer dl-answer--' + o.layout, { role: 'group', 'aria-label': o.answerLabel });
    answer.setAttribute('data-placeholder', o.placeholder);
    var bank = el('div', 'dl-bank dl-bank--' + o.layout, { role: 'group', 'aria-label': o.bankLabel });
    var placed = [], locked = false;
    var tiles = o.texts.map(function (t, i) {
      var b = el('button', 'd-tile dl-tile' + (list ? ' dl-tile--row' : ''), { type: 'button', 'aria-pressed': 'false' });
      b.textContent = t;
      bank.appendChild(b);
      var tile = { text: t, el: b, idx: i, placed: false };
      b.addEventListener('click', function () { toggle(tile); });
      return tile;
    });
    host.appendChild(answer);
    host.appendChild(bank);

    function move(tile, mutate) {
      var had = document.activeElement === tile.el;
      return flip(tiles.map(function (x) { return x.el; }), function () { mutate(); if (had) tile.el.focus({ preventScroll: true }); }, { ms: 280 });
    }
    function toggle(tile) {
      if (locked) return;
      if (tile.placed) {
        api.emit('tap_tile');
        move(tile, function () {
          var next = null;
          tiles.forEach(function (t) { if (!t.placed && t !== tile && t.idx > tile.idx && (!next || t.idx < next.idx)) next = t; });
          bank.insertBefore(tile.el, next ? next.el : null);
          placed.splice(placed.indexOf(tile), 1);
          tile.placed = false; tile.el.setAttribute('aria-pressed', 'false');
        });
      } else {
        api.emit('tap_tile');
        move(tile, function () {
          answer.appendChild(tile.el);
          placed.push(tile);
          tile.placed = true; tile.el.setAttribute('aria-pressed', 'true');
        });
      }
      api.changed();
    }
    host.addEventListener('keydown', function (e) {
      if (locked || e.altKey || e.ctrlKey || e.metaKey) return;
      var dir = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
      if (!dir) return;
      var all = Array.prototype.slice.call(host.querySelectorAll('button.d-tile')), cur = all.indexOf(document.activeElement);
      if (cur < 0) return;
      e.preventDefault();
      all[(cur + dir + all.length) % all.length].focus();
    });
    return {
      placedTexts: function () { return placed.map(function (t) { return t.text; }); },
      count: function () { return placed.length; },
      total: tiles.length,
      lock: function (okAt) {
        locked = true;
        tiles.forEach(function (t) { t.el.setAttribute('aria-disabled', 'true'); t.el.tabIndex = -1; });
        placed.forEach(function (t, i) { t.el.classList.add(okAt(i, t) ? 'is-correct' : 'is-wrong'); });
        bank.classList.add('is-locked');
      },
      shake: function () { shake(answer); },
      enterChecks: function (t) { return !t || !t.classList || !t.classList.contains('d-tile') || placed.some(function (x) { return x.el === t; }); },
      destroy: function () { var st = M('stop'); if (st) tiles.forEach(function (t) { st(t.el); }); }
    };
  }

  /* --------------------------------- build --------------------------------- */
  X.types.build = function (step, host, api) {
    head(host, step, 'pBuild');
    if (step.context) say(host, step.context, 'clientSays');
    var texts = shuffle((step.answer || []).concat(step.distractors || []), true);
    var bd = board(host, { layout: 'inline', texts: texts, answerLabel: L('yourAnswer'), bankLabel: L('wordBank'), placeholder: L('tapWords') }, api);
    return {
      canCheck: function () { return bd.count() > 0; },
      check: function () {
        var got = bd.placedTexts(), want = step.answer || [];
        var ok = joinTiles(got) === joinTiles(want);
        bd.lock(function (i) { return ok || got[i] === want[i]; });
        if (!ok) bd.shake();
        return ok ? { correct: true } : { correct: false, answer: step.full || joinTiles(want) };
      },
      key: function () {},
      enterChecks: bd.enterChecks,
      destroy: bd.destroy
    };
  };

  /* --------------------------------- order --------------------------------- */
  X.types.order = function (step, host, api) {
    head(host, step, 'pOrder');
    var items = step.items || [];
    var bd = board(host, { layout: 'list', texts: shuffle(items, true), answerLabel: L('yourOrder'), bankLabel: L('stepsBank'), placeholder: L('tapSteps') }, api);
    return {
      canCheck: function () { return bd.count() === bd.total; },
      check: function () {
        var got = bd.placedTexts();
        var ok = got.length === items.length && got.every(function (t, i) { return t === items[i]; });
        bd.lock(function (i) { return got[i] === items[i]; });
        if (!ok) bd.shake();
        return ok ? { correct: true } : { correct: false, answerList: items.slice(), answerLabel: L('rightOrder') };
      },
      key: function () {},
      enterChecks: bd.enterChecks,
      destroy: bd.destroy
    };
  };

  /* --------------------------------- match --------------------------------- */
  X.types.match = function (step, host, api) {
    head(host, step, 'pMatch');
    var pairs = step.pairs || [];
    var left = shuffle(pairs.map(function (p, i) { return { pid: i, text: p.left, side: 0 }; }), true);
    var right = shuffle(pairs.map(function (p, i) { return { pid: i, text: p.right, side: 1 }; }), true);
    var wrap = el('div', 'dl-match');
    var cols = [el('div', 'dl-match__col', { role: 'group', 'aria-label': L('matchLeft') }), el('div', 'dl-match__col', { role: 'group', 'aria-label': L('matchRight') })];
    var items = [left, right];
    items.forEach(function (col, side) {
      col.forEach(function (it) {
        var b = el('button', 'd-option dl-match__item', { type: 'button', 'aria-pressed': 'false' });
        b.innerHTML = '<span class="dl-match__tag" aria-hidden="true"></span><span class="dl-opt__text">' + esc(it.text) + '</span>';
        b.addEventListener('click', function () { click(it); });
        it.el = b;
        cols[side].appendChild(b);
      });
      wrap.appendChild(cols[side]);
    });
    host.appendChild(wrap);
    var sel = null, solved = 0, wrongTries = 0, busy = false, locked = false, done = false;

    function mark(it, on) { it.el.classList.toggle('is-selected', on); it.el.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    function click(it) {
      if (busy || locked || it.done) return;
      if (!sel) { sel = it; mark(it, true); api.emit('tap_tile'); return; }
      if (sel === it) { mark(it, false); sel = null; api.emit('tap_tile'); return; }
      if (sel.side === it.side) { mark(sel, false); sel = it; mark(it, true); api.emit('tap_tile'); return; }
      var a = sel, b = it;
      sel = null;
      if (a.pid === b.pid) {
        solved++;
        [a, b].forEach(function (x) {
          x.done = true; mark(x, false);
          x.el.classList.add('is-correct');
          x.el.setAttribute('aria-disabled', 'true');
          x.el.querySelector('.dl-match__tag').textContent = String(solved);
          x.el.insertAdjacentHTML('beforeend', '<span class="sr-only"> (' + esc(L('pair')) + ' ' + solved + ')</span>');
        });
        api.emit('tap_tile'); api.changed();
        if (solved === pairs.length) setTimeout(function () { if (!done) api.requestCheck(); }, 500);
      } else {
        wrongTries++; busy = true;
        b.el.classList.add('is-wrong'); a.el.classList.add('is-wrong');
        shake(a.el); shake(b.el);
        api.emit('tap_tile');
        setTimeout(function () {
          [a, b].forEach(function (x) { x.el.classList.remove('is-wrong'); mark(x, false); });
          busy = false;
        }, 480);
      }
    }
    // Навігація: вгору/вниз — в межах колонки, вліво/вправо — в іншу колонку на тому ж рівні
    wrap.addEventListener('keydown', function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var cur = document.activeElement, side = -1, i = -1;
      items.forEach(function (col, s) { col.forEach(function (it, k) { if (it.el === cur) { side = s; i = k; } }); });
      if (side < 0) return;
      var ns = side, ni = i;
      if (e.key === 'ArrowDown') ni = Math.min(items[side].length - 1, i + 1);
      else if (e.key === 'ArrowUp') ni = Math.max(0, i - 1);
      else if (e.key === 'ArrowRight' && side === 0) ns = 1;
      else if (e.key === 'ArrowLeft' && side === 1) ns = 0;
      else return;
      e.preventDefault();
      ni = Math.min(ni, items[ns].length - 1);
      items[ns][ni].el.focus();
    });
    return {
      auto: true,
      canCheck: function () { return solved === pairs.length; },
      check: function () {
        done = true; locked = true;
        var ok = wrongTries < 2; // одна помилкова спроба прощається
        return ok ? { correct: true } : {
          correct: false,
          note: L('matchTries').replace('{n}', String(wrongTries))
        };
      },
      key: function () {},
      enterChecks: function () { return false; },
      destroy: function () { done = true; }
    };
  };

  /* ------------------------------- фабрика ------------------------------- */
  X.create = function (step, host, api) {
    var t = X.types[step && step.type];
    if (!t) throw new Error('Невідомий тип кроку: ' + (step && step.type));
    return t(step, host, api);
  };
  X.joinTiles = joinTiles;
  X.joinSentence = joinSentence;
})();
