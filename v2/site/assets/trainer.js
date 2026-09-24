// Ikorka Shop — MVP-тренажер новачка (рантайм). Дані: window.TRAINER (assets/trainer-data.js,
// згенеровано збіркою дослівно з уроків). Прогрес — лише в localStorage цього браузера.
(function () {
  'use strict';
  var T = window.TRAINER;
  if (!T) return;
  var META = document.getElementById('page-meta');
  var SLUG = META ? META.getAttribute('data-slug') : '';
  var KIND = META ? META.getAttribute('data-kind') : '';
  var LOADED_AT = Date.now();
  var userScrolled = false;
  window.addEventListener('scroll', function () { if (Date.now() - LOADED_AT > 600) userScrolled = true; }, { passive: true });

  // =====================================================================
  // 1. Сховище прогресу (localStorage, try/catch; без нього все працює в пам'яті)
  // =====================================================================
  var KEY = 'ikorka-mvp';
  var st = null;
  function blank() {
    return { v: 1, created: Date.now(), days: {}, last: null, pos: {}, lessons: {}, review: {}, daily: {}, goal: null, goals: [], sections: {}, final: [], sim: {}, deck: [] };
  }
  function load() {
    if (st) return st;
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { s = null; }
    st = (s && s.v === 1) ? s : blank();
    var b = blank();
    for (var k in b) if (!(k in st)) st[k] = b[k];
    return st;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* приватний режим — лишаємось у пам'яті */ } }
  function legacyDone() { try { return JSON.parse(localStorage.getItem('ikorka-done')) || {}; } catch (e) { return {}; } }
  load();

  // =====================================================================
  // 2. Утиліти
  // =====================================================================
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  var DAY = 864e5;
  function lessonOfSlug(slug) { var m = /^urok-(\d\d)$/.exec(slug || ''); return m ? parseInt(m[1], 10) : null; }
  function L(n) { return T.lessons[n - 1]; }
  function ruleByCode(code) {
    if (!code) return null;
    var n = parseInt(code, 10), l = L(n);
    if (!l) return null;
    for (var i = 0; i < l.rules.length; i++) if (l.rules[i].code === code) return l.rules[i];
    return null;
  }
  // детерміноване перемішування (однаковий порядок при повторному відкритті)
  function seeded(seed) { var x = seed % 2147483647; if (x <= 0) x += 2147483646; return function () { x = x * 16807 % 2147483647; return (x - 1) / 2147483646; }; }
  function shuffle(arr, seed) { var a = arr.slice(), r = seeded(seed || 1); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function hashStr(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 2147483647; return h || 1; }
  function quoteWrap(s) { s = String(s || '').trim(); return /^[«"]/.test(s) ? s : '«' + s + '»'; }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function lessonLink(n) { var l = L(n); return l ? '<a href="' + l.href + '">Урок ' + n + '. ' + esc(l.title) + '</a>' : ''; }
  function srcLine(n, rule) {
    var r = ruleByCode(rule);
    return '<p class="fb3-src">Джерело: ' + lessonLink(n) + (r ? ' · правило ' + esc(r.code) : '') + '</p>';
  }

  // Активний день (для лічильника днів навчання — без штрафу за пропуск)
  st.days[dayKey()] = true; save();

  // =====================================================================
  // 3. Розбір відповіді у три рядки: Що сказано → Чому → Що сказати натомість
  // =====================================================================
  // o: {good:bool, said, why, instead, lesson, rule, neutral?, verdict?, insteadHtml?}
  //  neutral — розбір без оцінки (офлайн-режим тренера: звір зі зразком з уроку)
  function fb3(o) {
    var good = !!o.good, neutral = !!o.neutral;
    var cls = neutral ? 'is-neutral' : good ? 'is-good' : 'is-bad';
    return '<div class="fb3 ' + cls + '" role="status">' +
      '<p class="fb3-verdict">' + esc(o.verdict || (neutral ? 'Звір зі зразком з уроку' : good ? 'Так' : 'Не зовсім')) + '</p>' +
      '<p class="fb3-said"><b>Що сказано:</b> ' + esc(o.said) + '</p>' +
      '<p class="fb3-why"><b>' + (neutral ? 'Чому це важливо для клієнта:' : good ? 'Чому це добре для клієнта:' : 'Чому це погано для клієнта:') + '</b> ' + esc(cap(o.why)) + '</p>' +
      (o.insteadHtml ? '<div class="fb3-instead"><b>' + (good ? 'Що сказати в дзвінку:' : 'Що сказати натомість:') + '</b> ' + o.insteadHtml + '</div>'
        : '<p class="fb3-instead"><b>' + (good ? 'Що сказати в дзвінку:' : 'Що сказати натомість:') + '</b> ' + esc(o.instead) + '</p>') +
      (o.lesson ? srcLine(o.lesson, o.rule) : '') +
      '</div>';
  }
  // Пояснення до тестового питання: з курованої розмітки, інакше — з самого уроку.
  function quizWhy(q, n) {
    if (q.why) return q.why;
    var l = L(n);
    for (var i = 0; i < l.attempts.length; i++) if (l.attempts[i].quiz === q.id) return l.attempts[i].explain;
    var c = null; q.options.forEach(function (o) { if (o.letter === q.correct) c = o; });
    return c ? c.text : '';
  }
  function correctOpt(q) { var c = null; q.options.forEach(function (o) { if (o.letter === q.correct) c = o; }); return c; }
  function quizInstead(q) { return q.say || (correctOpt(q) || {}).text || ''; }
  function pairWhy(p) {
    if (p.why) return p.why;
    var m = /^[^:—]+[:—]\s*(.+)$/.exec(p.bad);
    return m ? m[1] : p.bad;
  }
  function quoteInstead(c, n) {
    if (c.strong) return c.text;
    if (c.instead) return c.instead;
    var l = L(n);
    for (var i = 0; i < l.quotes.length; i++) if (l.quotes[i].strong) return l.quotes[i].text;
    return l.says.length ? l.says[0].say : '';
  }

  // Універсальне питання з варіантами (вибір → розбір). item: {kind, id, lesson, prompt, options:[{key,text,good,said?,why,instead}], rule}
  function renderChoice(host, item, onAnswer) {
    var box = el('div', 'mvp-q');
    box.setAttribute('data-item', item.id);
    box.innerHTML = (item.lead ? '<p class="mvp-q-lead">' + item.lead + '</p>' : '') +
      '<p class="mvp-q-title">' + esc(item.prompt) + '</p>' +
      (item.sub ? '<p class="mvp-q-sub">' + item.sub + '</p>' : '') +
      '<div class="mvp-opts" role="group" aria-label="Варіанти відповіді"></div><div class="mvp-fb" aria-live="polite"></div>';
    var opts = box.querySelector('.mvp-opts'), fbBox = box.querySelector('.mvp-fb');
    item.options.forEach(function (o) {
      var b = el('button', 'mvp-opt', esc(o.text));
      b.type = 'button';
      b.addEventListener('click', function () {
        if (box.classList.contains('answered')) return;
        box.classList.add('answered');
        [].forEach.call(opts.children, function (x, i) { x.disabled = true; if (item.options[i].good) x.classList.add('is-correct'); });
        if (!o.good) b.classList.add('is-wrong');
        var good = item.options.filter(function (x) { return x.good; })[0];
        fbBox.innerHTML = fb3({ good: o.good, said: o.said || o.text, why: o.why, instead: o.instead || (good ? good.text : ''), lesson: item.lesson, rule: item.rule });
        if (onAnswer) onAnswer(!!o.good, o, box);
      });
      opts.appendChild(b);
    });
    host.appendChild(box);
    return box;
  }
  function quizItem(q, n) {
    var why = quizWhy(q, n), instead = quizInstead(q);
    return {
      kind: 'mcq', id: q.id, lesson: n, rule: q.rule, prompt: q.title,
      options: q.options.map(function (o) { return { key: o.letter, text: o.text, good: o.letter === q.correct, why: why, instead: instead }; }),
    };
  }
  function quoteItem(c, n) {
    var instead = quoteInstead(c, n);
    return {
      kind: 'quote', id: c.id, lesson: n, rule: c.rule, prompt: 'Як звучить ця фраза менеджера?',
      sub: '<span class="mvp-said">' + esc(c.text) + '</span>',
      options: [
        { key: 's', text: 'Сильно', good: c.strong, said: c.text, why: c.why, instead: instead },
        { key: 'w', text: 'Слабко', good: !c.strong, said: c.text, why: c.why, instead: instead },
      ],
    };
  }
  function pairItem(p, n, seed) {
    var l = L(n);
    var others = l.pairs.filter(function (x) { return x.id !== p.id && x.good && x.good !== p.good; });
    others = shuffle(others, seed).slice(0, 2);
    var why = pairWhy(p);
    var opts = [{ key: p.id, text: p.good, good: true, said: p.bad, why: why, instead: p.good }].concat(others.map(function (o) {
      return { key: o.id, text: o.good, good: false, said: p.bad, why: why, instead: p.good };
    }));
    return {
      kind: 'pair', id: p.id, lesson: n, rule: p.rule, prompt: 'Що тут зробити правильно?',
      lead: '<span class="quote-tag weak">Помилка</span> ' + esc(p.bad),
      options: shuffle(opts, seed + 3),
    };
  }

  // =====================================================================
  // 4. Спливні вікна за правилами: ніколи при завантаженні, одне на розділ,
  //    лише в паузі (кінець H2), немодальні, «Пропустити» завжди видно, фокус повертається
  // =====================================================================
  var Pop = (function () {
    var open = null, lastFocus = null;
    function canAuto() { return Date.now() - LOADED_AT > 4000 && userScrolled && !open; }
    function close() {
      if (!open) return;
      var node = open; open = null;
      node.classList.remove('is-open');
      setTimeout(function () { node.remove(); }, 200);
      if (lastFocus && node.contains(document.activeElement)) { try { lastFocus.focus(); } catch (e) {} }
      lastFocus = null;
    }
    // kind: 'drawer' | 'toast'; actions: [{label, fn, primary}]
    function show(kind, title, html, actions) {
      if (open) close();
      lastFocus = document.activeElement;
      var node = el('aside', 'mvp-pop mvp-' + kind);
      node.setAttribute('role', 'complementary');
      node.setAttribute('aria-label', title);
      node.innerHTML = '<div class="mvp-pop-body"><p class="mvp-pop-title">' + esc(title) + '</p>' + html + '</div><div class="mvp-pop-actions"></div>';
      var bar = node.querySelector('.mvp-pop-actions');
      (actions || []).forEach(function (a) {
        var b = el('button', 'mvp-btn' + (a.primary ? ' primary' : ''), esc(a.label)); b.type = 'button';
        b.addEventListener('click', function () { if (a.fn) a.fn(); close(); });
        bar.appendChild(b);
      });
      var skip = el('button', 'mvp-btn ghost mvp-skip', 'Пропустити'); skip.type = 'button';
      skip.addEventListener('click', close);
      bar.appendChild(skip);
      document.body.appendChild(node);
      requestAnimationFrame(function () { node.classList.add('is-open'); });
      open = node;
      if (kind === 'toast') setTimeout(function () { if (open === node) close(); }, 9000);
      return node;
    }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) close(); });
    return { show: show, close: close, canAuto: canAuto, isOpen: function () { return !!open; } };
  })();

  // =====================================================================
  // 5. Статус уроків і маршрут
  // =====================================================================
  function ls(n) { if (!st.lessons[n]) st.lessons[n] = { tries: {}, test: null }; return st.lessons[n]; }
  function passed(n) { var x = st.lessons[n]; return !!(x && x.test && x.test.passed) || !!legacyDone()['urok-' + pad2(n)]; }
  function started(n) { var x = st.lessons[n]; return !!(x && (x.test || Object.keys(x.tries || {}).length)) || !!st.pos['urok-' + pad2(n)]; }
  function pageDone(slug) { return !!legacyDone()[slug] || !!st.pos[slug]; }
  var ROUTE = [{ slug: 'vstup', title: 'Вступ', kind: 'vstup' }];
  T.days.forEach(function (d) {
    ROUTE.push({ slug: d.slug, title: 'День ' + d.d, kind: 'day', day: d.d });
    d.lessons.forEach(function (n) { ROUTE.push({ slug: L(n).slug, title: 'Урок ' + n + '. ' + L(n).title, kind: 'urok', n: n, day: d.d }); });
  });
  function itemDone(it) { return it.kind === 'urok' ? passed(it.n) : pageDone(it.slug); }
  function dayPassed(d) { var day = T.days[d - 1]; return day.lessons.every(passed); }
  function passedCount() { var c = 0; for (var n = 1; n <= 12; n++) if (passed(n)) c++; return c; }

  // =====================================================================
  // 6. Повторення: інтервали 1, 3, 7, 14 днів; до 5 карток на день; слабкі частіше
  // =====================================================================
  var INTERVALS = [1, 3, 7, 14];
  function rvAdd(id, weak) {
    var r = st.review[id];
    if (!r) { st.review[id] = { step: 0, due: Date.now() + DAY, lapses: weak ? 1 : 0, added: Date.now() }; }
    else if (weak) { r.step = 0; r.due = Math.min(r.due, Date.now() + DAY); r.lapses = (r.lapses || 0) + 1; }
  }
  function rvGrade(id, ok) {
    var r = st.review[id] || (st.review[id] = { step: 0, due: 0, lapses: 0, added: Date.now() });
    if (ok) {
      var gap = INTERVALS[Math.min(r.step, INTERVALS.length - 1)];
      if ((r.lapses || 0) >= 2) gap = Math.max(1, Math.ceil(gap / 2)); // слабкі повертаються частіше
      r.due = Date.now() + gap * DAY; r.step = Math.min(r.step + 1, INTERVALS.length);
    } else { r.step = 0; r.due = Date.now() + DAY; r.lapses = (r.lapses || 0) + 1; }
    var dk = dayKey(); st.daily[dk] = st.daily[dk] || { reviewed: 0 }; st.daily[dk].reviewed++;
    save();
  }
  var DAILY_LIMIT = 5;
  function rvDueList() {
    var now = Date.now();
    var ids = Object.keys(st.review).filter(function (id) { return st.review[id].due <= now && cardById(id); });
    ids.sort(function (a, b) { var A = st.review[a], B = st.review[b]; return (B.lapses || 0) - (A.lapses || 0) || A.due - B.due; });
    var done = (st.daily[dayKey()] || {}).reviewed || 0;
    return ids.slice(0, Math.max(0, DAILY_LIMIT - done));
  }
  // картка повторення за id: тестове питання, пара, цитата, відкрите питання, особиста колода
  function cardById(id) {
    var m = /^(\d+)-(q|p|c|o|r)(\d+)$/.exec(id);
    if (m) {
      var l = L(parseInt(m[1], 10)); if (!l) return null;
      if (m[2] === 'r') { var rr = ruleByCode(l.n + '.' + m[3]); return rr ? { type: 'r', n: l.n, data: rr } : null; }
      var list = { q: l.quiz, p: l.pairs, c: l.quotes, o: l.open }[m[2]];
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return { type: m[2], n: l.n, data: list[i] };
      return null;
    }
    if (/^deck-/.test(id)) { for (var j = 0; j < st.deck.length; j++) if (st.deck[j].id === id) return { type: 'deck', data: st.deck[j] }; }
    return null;
  }

  // =====================================================================
  // 7. SOS «Я на дзвінку»: плаваюча кнопка на кожній сторінці, працює офлайн
  // =====================================================================
  function initSos() {
    if (!T.sos) return;
    var btn = el('button', 'sos-fab', '<span aria-hidden="true">☎</span> Я на дзвінку');
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', 'sos-panel');
    document.body.appendChild(btn);
    var panel = null;
    function close() {
      if (!panel) return;
      panel.classList.remove('is-open');
      var p = panel; panel = null;
      setTimeout(function () { p.remove(); }, 180);
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
    function results(q) {
      var qn = String(q || '').toLowerCase().replace(/[’ʼ`']/g, "'").trim();
      var words = qn.split(/[^a-zа-яіїєґ0-9']+/i).filter(function (w) { return w.length > 1; }).map(function (w) { return w.length > 5 ? w.slice(0, -2) : w; });
      function hit(t) { t = String(t).toLowerCase().replace(/[’ʼ`']/g, "'"); return words.every(function (w) { return t.indexOf(w) >= 0; }); }
      var out = [];
      T.sos.objections.forEach(function (o) {
        var hay = o.obj + ' ' + o.cat + ' ' + (o.say ? o.say.sit + ' ' + o.say.text : '') + ' ' + o.script;
        if (!words.length || hit(hay)) out.push({ t: 'obj', o: o, score: hit(o.obj) ? 2 : 1 });
      });
      if (words.length) T.sos.says.forEach(function (s) { if (hit(s.sit + ' ' + s.say + ' ' + (s.keys || []).join(' '))) out.push({ t: 'say', s: s, score: 1 }); });
      out.sort(function (a, b) { return b.score - a.score; });
      return out.slice(0, 30);
    }
    var CAT = { 'істинне': 'Істинне', 'ситуативне': 'Ситуативне', 'хибне': 'Хибне' };
    function renderList(box, q) {
      var rs = results(q);
      if (!rs.length) { box.innerHTML = '<p class="sos-none">Нічого не знайдено. Спробуй інше слово: «дорого», «подумаю», «не актуально».</p>'; return; }
      box.innerHTML = rs.map(function (r) {
        if (r.t === 'obj') {
          var o = r.o;
          return '<div class="sos-item"><p class="sos-obj"><span class="sos-cat cat-' + esc(o.cat) + '">' + CAT[o.cat] + '</span> «' + esc(o.obj) + '»</p>' +
            (o.say ? '<p class="sos-say"><b>Скажи так:</b> ' + esc(o.say.text) + '</p><p class="sos-why">' + esc(cap(o.say.why)) + ' · <a href="urok-04.html">Урок 4</a></p>' : '') +
            '<details class="sos-script"' + (o.say ? '' : ' open') + '><summary>Відповідь зі скрипту компанії</summary><p>' + esc(o.script) + '</p></details></div>';
        }
        var s = r.s;
        return '<div class="sos-item"><p class="sos-obj">' + esc(s.sit) + '</p><p class="sos-say"><b>Скажи так:</b> ' + esc(s.say) + '</p><p class="sos-why">' + esc(cap(s.why)) + ' · ' + lessonLink(s.lesson) + '</p></div>';
      }).join('');
    }
    function stagesHtml() {
      var sk = T.sos.skeleton ? '<p class="sos-skel">' + esc(T.sos.skeleton.text) + '</p><p class="sos-why"><a href="urok-03.html">Урок 3. Етапи дзвінка</a></p>' : '';
      var rules = T.lessons.map(function (l) {
        return l.rules.length ? '<details class="sos-rules"><summary>Урок ' + l.n + '. ' + esc(l.title) + '</summary><ul>' + l.rules.map(function (r) { return '<li><b>' + esc(r.code) + '</b> ' + esc(r.text) + '</li>'; }).join('') + '</ul></details>' : '';
      }).join('');
      return sk + '<p class="sos-sub">Правила уроків</p>' + rules;
    }
    btn.addEventListener('click', function () {
      if (panel) { close(); return; }
      Pop.close();
      panel = el('aside', 'sos-panel');
      panel.id = 'sos-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'false');
      panel.setAttribute('aria-labelledby', 'sos-title');
      panel.innerHTML = '<div class="sos-head"><p id="sos-title" class="sos-title">Я на дзвінку</p><button type="button" class="mvp-btn ghost sos-close">Закрити</button></div>' +
        '<div class="sos-tabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-tab="obj" class="sos-tab on">Заперечення</button><button type="button" role="tab" aria-selected="false" data-tab="stages" class="sos-tab">Етапи і правила</button></div>' +
        '<div class="sos-pane" data-pane="obj"><label class="sos-label" for="sos-q">Що каже клієнт?</label><input id="sos-q" type="search" autocomplete="off" placeholder="напр. дорого, подумаю, є ікра"><div class="sos-list" aria-live="polite"></div></div>' +
        '<div class="sos-pane" data-pane="stages" hidden>' + stagesHtml() + '</div>';
      document.body.appendChild(panel);
      var input = panel.querySelector('#sos-q'), list = panel.querySelector('.sos-list');
      renderList(list, '');
      var t = null;
      input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { renderList(list, input.value); }, 120); });
      panel.querySelector('.sos-close').addEventListener('click', close);
      [].forEach.call(panel.querySelectorAll('.sos-tab'), function (tb) {
        tb.addEventListener('click', function () {
          [].forEach.call(panel.querySelectorAll('.sos-tab'), function (x) { var on = x === tb; x.classList.toggle('on', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); });
          [].forEach.call(panel.querySelectorAll('.sos-pane'), function (p) { p.hidden = p.getAttribute('data-pane') !== tb.getAttribute('data-tab'); });
        });
      });
      panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
      requestAnimationFrame(function () { panel.classList.add('is-open'); });
      btn.setAttribute('aria-expanded', 'true');
      input.focus();
    });
  }
  initSos();

  // Далі — модулі сторінок (додаються нижче зрізами).
  var MVP = window.MVP = {
    st: st, save: save, esc: esc, el: el, L: L, fb3: fb3, Pop: Pop, renderChoice: renderChoice,
    quizItem: quizItem, quoteItem: quoteItem, pairItem: pairItem, ruleByCode: ruleByCode, lessonLink: lessonLink,
    shuffle: shuffle, hashStr: hashStr, dayKey: dayKey, DAY: DAY, cap: cap, quoteWrap: quoteWrap,
    ls: ls, passed: passed, started: started, pageDone: pageDone, ROUTE: ROUTE, itemDone: itemDone, dayPassed: dayPassed, passedCount: passedCount,
    rvAdd: rvAdd, rvGrade: rvGrade, rvDueList: rvDueList, cardById: cardById, lessonOfSlug: lessonOfSlug,
    userScrolled: function () { return userScrolled; }, SLUG: SLUG, KIND: KIND,
  };


  // =====================================================================
  // 8. Сторінка уроку: правила уроку, «Ви зупинились на…», спроба до пояснення,
  //    пауза в кінці розділу, терміни, запам'ятовування місця
  // =====================================================================
  var lessonEl = document.querySelector('.lesson');
  function h2s() { return lessonEl ? [].slice.call(lessonEl.querySelectorAll('h2[id]')) : []; }
  function findH2(text) { var hs = h2s(); for (var i = 0; i < hs.length; i++) if (hs[i].textContent.trim() === text) return hs[i]; return null; }
  function afterHeading(h) { var n = h; var nx = h.nextElementSibling; if (nx && nx.classList.contains('sec-illo')) n = nx; return n; }
  function sectionEnd(h) { var n = h.nextElementSibling; while (n && n.tagName !== 'H2') { if (!n.nextElementSibling || n.nextElementSibling.tagName === 'H2') return n; n = n.nextElementSibling; } return h; }

  function trackPosition() {
    if (!lessonEl || !/urok|day|vstup/.test(KIND)) return;
    var hs = h2s(); if (!hs.length) return;
    var ticking = false, lastSave = 0;
    function upd() {
      ticking = false;
      var cur = null;
      hs.forEach(function (h) { if (h.getBoundingClientRect().top - 140 <= 0) cur = h; });
      if (!cur) return;
      st.pos[SLUG] = { id: cur.id, text: cur.textContent.trim(), t: Date.now() };
      st.last = { slug: SLUG, id: cur.id, text: cur.textContent.trim(), title: (document.querySelector('.cover-title') || {}).textContent || document.title, t: Date.now() };
      if (Date.now() - lastSave > 1200) { lastSave = Date.now(); save(); }
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    window.addEventListener('pagehide', save);
    if (!st.pos[SLUG]) { st.pos[SLUG] = { id: hs[0].id, text: hs[0].textContent.trim(), t: Date.now() }; save(); }
  }

  function resumeBanner() {
    if (!lessonEl || location.hash) return;
    var p = st.pos[SLUG];
    var hs = h2s();
    if (!p || !hs.length || p.id === hs[0].id || !document.getElementById(p.id)) return;
    var b = el('div', 'mvp-resume', '<p>Ви зупинились на розділі «' + esc(p.text) + '».</p>');
    var go = el('a', 'mvp-btn primary', 'Продовжити'); go.href = '#' + p.id;
    var x = el('button', 'mvp-btn ghost', 'Сховати'); x.type = 'button';
    x.addEventListener('click', function () { b.remove(); });
    go.addEventListener('click', function () { b.remove(); });
    var bar = el('div', 'mvp-row'); bar.appendChild(go); bar.appendChild(x); b.appendChild(bar);
    lessonEl.insertBefore(b, lessonEl.firstChild);
  }

  function rulesCard(l) {
    if (!l.rules.length) return;
    var html = '<p class="mvp-card-title">Правила уроку</p><ul class="mvp-rules">' + l.rules.map(function (r) {
      var h = r.section ? findH2(r.section) : null;
      return '<li id="rule-' + esc(r.code.replace('.', '-')) + '"><span class="rule-code">' + esc(r.code) + '</span> <span class="rule-text">' + esc(cap(r.text)) + '</span>' +
        (r.label ? ' <span class="mvp-label">' + esc(r.label) + '</span>' : '') +
        (h ? ' <a class="rule-go" href="#' + h.id + '">до розділу</a>' : '') + '</li>';
    }).join('') + '</ul><p class="mvp-hint">Коди правил повторюються в SOS «Я на дзвінку», у перевірці в кінці уроку і в цілі на дзвінки.</p>';
    var card = el('section', 'mvp-card mvp-rules-card', html);
    card.setAttribute('aria-label', 'Правила уроку');
    var first = h2s()[0];
    if (first) lessonEl.insertBefore(card, first); else lessonEl.appendChild(card);
  }

  function attemptCards(l) {
    l.attempts.forEach(function (a) {
      var h = findH2(a.before); if (!h) return;
      var q = null; l.quiz.forEach(function (x) { if (x.id === a.quiz) q = x; });
      if (!q) return;
      var item = quizItem(q, l.n);
      item.id = a.id; item.rule = a.rule || q.rule;
      item.options.forEach(function (o) { o.why = a.explain; });
      item.lead = '<span class="mvp-kicker">Спробуй до пояснення</span> Відповідь — у цьому розділі. Помилка нічого не коштує.';
      var wrap = el('div', 'mvp-attempt');
      var anchor = afterHeading(h);
      anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
      var prev = ls(l.n).tries[a.id];
      var box = renderChoice(wrap, item, function (ok) { ls(l.n).tries[a.id] = { ok: ok, t: Date.now() }; save(); });
      if (prev) box.querySelector('.mvp-q-title').insertAdjacentHTML('afterend', '<p class="mvp-q-sub mvp-muted">Минулого разу: ' + (prev.ok ? 'правильно' : 'з помилкою') + '. Спробуй ще раз.</p>');
    });
  }

  function sectionPauses(l) {
    if (!('IntersectionObserver' in window)) return;
    var bySection = {};
    l.rules.forEach(function (r) { if (r.section) (bySection[r.section] = bySection[r.section] || []).push(r); });
    var lastAuto = 0;
    Object.keys(bySection).forEach(function (sec) {
      var h = findH2(sec); if (!h) return;
      var key = SLUG + '#' + h.id;
      var end = sectionEnd(h);
      var sentinel = el('div', 'mvp-sentinel'); sentinel.setAttribute('aria-hidden', 'true');
      end.parentNode.insertBefore(sentinel, end.nextSibling);
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (e) {
          if (!e.isIntersecting || st.sections[key] || !Pop.canAuto() || Date.now() - lastAuto < 45000) return;
          var r = bySection[sec][0];
          st.sections[key] = Date.now(); save(); lastAuto = Date.now(); io.disconnect();
          Pop.show('drawer', 'Пауза · правило ' + r.code, '<p class="mvp-pop-text">' + esc(cap(r.text)) + '</p><p class="mvp-muted">Закріпи: скажи це правило вголос своїми словами, перш ніж читати далі.</p>', [
            { label: 'Додати в повторення', primary: true, fn: function () { rvAdd(l.n + '-r' + r.code.split('.')[1], false); save(); } },
          ]);
        });
      }, { rootMargin: '0px 0px -30% 0px' });
      io.observe(sentinel);
    });
  }

  // Терміни: тап — визначення дослівно з уроку (немодально)
  function terms() {
    if (!lessonEl || !T.glossary || !T.glossary.length || !/urok|day|vstup/.test(KIND)) return;
    var used = {};
    var paras = [].slice.call(lessonEl.querySelectorAll('p.lesson-body'));
    T.glossary.forEach(function (g) {
      var re;
      try { re = new RegExp('(^|[^\\p{L}])(' + g.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?=[^\\p{L}]|$)', 'iu'); } catch (e) { return; }
      for (var i = 0; i < paras.length && !used[g.term]; i++) {
        var walker = document.createTreeWalker(paras[i], NodeFilter.SHOW_TEXT, null);
        var node;
        while ((node = walker.nextNode())) {
          if (node.parentNode.closest('a,button,.term')) continue;
          var m = re.exec(node.nodeValue);
          if (!m) continue;
          var start = m.index + m[1].length;
          var after = node.splitText(start); after.splitText(m[2].length);
          var b = el('button', 'term', esc(after.nodeValue)); b.type = 'button';
          b.setAttribute('aria-expanded', 'false');
          b.setAttribute('data-term', g.term);
          after.parentNode.replaceChild(b, after);
          used[g.term] = true;
          break;
        }
      }
    });
    var tip = null, owner = null;
    function closeTip(refocus) { if (!tip) return; tip.remove(); tip = null; if (owner) { owner.setAttribute('aria-expanded', 'false'); if (refocus) owner.focus(); } owner = null; }
    document.addEventListener('click', function (e) {
      var b = e.target.closest('button.term');
      if (!b) { if (tip && !tip.contains(e.target)) closeTip(false); return; }
      if (owner === b) { closeTip(true); return; }
      closeTip(false);
      var g = null; T.glossary.forEach(function (x) { if (x.term === b.getAttribute('data-term')) g = x; });
      if (!g) return;
      tip = el('div', 'term-tip', '<p>' + esc(g.def) + '</p><p class="fb3-src">' + lessonLink(g.lesson) + '</p>');
      tip.setAttribute('role', 'note');
      var close = el('button', 'mvp-btn ghost', 'Закрити'); close.type = 'button';
      close.addEventListener('click', function () { closeTip(true); });
      tip.appendChild(close);
      b.insertAdjacentElement('afterend', tip);
      b.setAttribute('aria-expanded', 'true');
      owner = b;
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && tip) closeTip(true); });
  }

  // =====================================================================
  // 9. «Сьогодні»: один наступний крок, кільце прогресу, «Продовжити з місця», маршрут по днях
  // =====================================================================
  function ringSvg(pct) {
    var C = 2 * Math.PI * 42, f = Math.max(0, Math.min(1, pct / 100)) * C;
    return '<svg class="mvp-ring" viewBox="0 0 100 100" role="img" aria-label="Прогрес ' + Math.round(pct) + ' відсотків">' +
      '<circle cx="50" cy="50" r="42" fill="none" stroke="var(--ring-track)" stroke-width="10"/>' +
      '<circle cx="50" cy="50" r="42" fill="none" stroke="var(--ring-fill)" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + f.toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 50 50)"/>' +
      '<text x="50" y="57" text-anchor="middle" class="mvp-ring-num">' + Math.round(pct) + '%</text></svg>';
  }
  function nextStep() {
    for (var i = 0; i < ROUTE.length; i++) {
      var it = ROUTE[i];
      if (!itemDone(it)) return it;
    }
    return null;
  }
  function weekDots() {
    var out = '', d = new Date();
    var days = [];
    for (var i = 6; i >= 0; i--) { var x = new Date(d.getTime() - i * DAY); days.push(x); }
    var names = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    days.forEach(function (x) { var on = !!st.days[dayKey(x)]; out += '<span class="wk' + (on ? ' on' : '') + '" title="' + dayKey(x) + '"><i></i>' + names[x.getDay()] + '</span>'; });
    return out;
  }
  function renderToday() {
    var app = document.getElementById('today-app');
    if (!app) return;
    var html = '';
    // 1) «Чи вийшло?» — ціль на дзвінки з попереднього дня
    var g = st.goal;
    if (g && !g.answered && g.set !== dayKey()) {
      var r = ruleByCode(g.code);
      html += '<section class="mvp-card mvp-goalcheck" aria-label="Перевірка цілі на дзвінки"><p class="mvp-card-title">Чи вийшло?</p>' +
        '<p>Ціль на дзвінки була: <b>правило ' + esc(g.code) + '</b> — ' + esc(r ? cap(r.text) : '') + '</p>' +
        '<div class="mvp-row" role="group" aria-label="Чи вийшло"><button type="button" class="mvp-btn" data-goal="так">Так</button><button type="button" class="mvp-btn" data-goal="частково">Частково</button><button type="button" class="mvp-btn" data-goal="ні">Ні</button></div></section>';
    }
    // 2) наступний крок + кільце
    var pc = passedCount(), pct = pc / 12 * 100;
    var nx = nextStep();
    var nxHtml;
    if (nx) {
      var label = nx.kind === 'urok' ? (started(nx.n) ? 'Продовжити: ' : 'Почати: ') + nx.title : 'Відкрити: ' + (nx.kind === 'day' ? nx.title + ' — план дня' : nx.title);
      var href = nx.slug + '.html' + (nx.kind === 'urok' && started(nx.n) && st.pos[nx.slug] ? '#' + st.pos[nx.slug].id : '');
      nxHtml = '<p class="mvp-kicker">Наступний крок</p><p class="mvp-next-title">' + esc(nx.title) + '</p><a class="mvp-btn primary big" href="' + href + '">' + esc(label) + '</a>';
    } else {
      nxHtml = '<p class="mvp-kicker">Наступний крок</p><p class="mvp-next-title">Усі 12 уроків зараховано</p><a class="mvp-btn primary big" href="perevirka.html">Пройти перевірку готовності</a>';
    }
    var due = rvDueList().length;
    var extra = '';
    if (due) extra += '<a class="mvp-btn" href="povtorennia.html">Повторення: ' + due + ' ' + (due === 1 ? 'картка' : (due < 5 ? 'картки' : 'карток')) + '</a>';
    if (st.last && st.last.slug && st.last.slug !== SLUG) {
      extra += '<a class="mvp-btn ghost" href="' + esc(st.last.slug) + '.html#' + esc(st.last.id) + '">Продовжити з місця: ' + esc((st.last.title || '').trim()) + ' → «' + esc(st.last.text) + '»</a>';
    }
    var nDays = Object.keys(st.days).length;
    html += '<section class="mvp-card mvp-today" aria-label="Сьогодні"><div class="mvp-today-grid"><div class="mvp-ringbox">' + ringSvg(pct) +
      '<p class="mvp-ring-cap">' + pc + ' з 12 уроків зараховано</p></div><div class="mvp-next">' + nxHtml +
      (extra ? '<div class="mvp-row mvp-extra">' + extra + '</div>' : '') + '</div></div>' +
      '<div class="mvp-week" aria-label="Дні навчання за тиждень"><span class="mvp-week-cap">Днів навчання: ' + nDays + '</span>' + weekDots() + '</div></section>';
    // 3) маршрут по днях
    html += '<section class="mvp-card mvp-route" aria-label="Маршрут по днях"><p class="mvp-card-title">Маршрут по днях</p><ol class="mvp-days">' + T.days.map(function (d) {
      var ok = dayPassed(d.d);
      return '<li class="mvp-day' + (ok ? ' done' : '') + '"><a class="mvp-day-h" href="' + d.slug + '.html">День ' + d.d + (ok ? ' <span class="mvp-tick" aria-label="пройдено">✓</span>' : '') + '</a><div class="mvp-chips">' +
        d.lessons.map(function (n) {
          var s = passed(n) ? 'passed' : (started(n) ? 'started' : 'new');
          var sl = { passed: 'зараховано', started: 'розпочато', new: 'не розпочато' }[s];
          return '<a class="mvp-chip ' + s + '" href="' + L(n).href + '" title="' + sl + '"><b>' + n + '</b> ' + esc(L(n).title) + '<span class="sr-only"> — ' + sl + '</span></a>';
        }).join('') + '</div></li>';
    }).join('') + '</ol></section>';
    app.innerHTML = html;
    [].forEach.call(app.querySelectorAll('[data-goal]'), function (b) {
      b.addEventListener('click', function () {
        st.goal.answered = b.getAttribute('data-goal'); st.goal.answeredAt = Date.now();
        st.goals.push({ code: st.goal.code, set: st.goal.set, answered: st.goal.answered });
        save();
        var card = b.closest('.mvp-goalcheck');
        card.innerHTML = '<p class="mvp-card-title">Записано</p><p>Відповідь «' + esc(st.goal.answered) + '» збережено. Нову ціль обереш у кінці наступного дня навчання.</p>';
      });
    });
  }

  // Віха в кінці дня + вибір цілі на дзвінки (1 код правила)
  function goalPicker(dayNum, host) {
    var day = T.days[dayNum - 1]; if (!day) return;
    var rules = [];
    day.lessons.forEach(function (n) { L(n).rules.forEach(function (r) { rules.push(r); }); });
    if (!rules.length) return;
    var box = el('section', 'mvp-card mvp-goal');
    box.setAttribute('aria-label', 'Ціль на дзвінки');
    var cur = st.goal && st.goal.set === dayKey() ? st.goal.code : '';
    box.innerHTML = '<p class="mvp-card-title">Ціль на дзвінки</p><p>Обери одне правило, яке відпрацюєш у сьогоднішніх дзвінках. Наступного разу курс запитає, чи вийшло.</p>' +
      '<div class="mvp-goal-list" role="radiogroup" aria-label="Правило на сьогодні">' + rules.map(function (r) {
        return '<button type="button" role="radio" aria-checked="' + (cur === r.code ? 'true' : 'false') + '" class="mvp-goal-opt' + (cur === r.code ? ' on' : '') + '" data-code="' + esc(r.code) + '"><b>' + esc(r.code) + '</b> ' + esc(cap(r.text)) + '</button>';
      }).join('') + '</div><p class="mvp-goal-msg" aria-live="polite"></p>';
    host.appendChild(box);
    [].forEach.call(box.querySelectorAll('.mvp-goal-opt'), function (b) {
      b.addEventListener('click', function () {
        st.goal = { code: b.getAttribute('data-code'), day: dayNum, set: dayKey(), answered: null };
        save();
        [].forEach.call(box.querySelectorAll('.mvp-goal-opt'), function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on ? 'true' : 'false'); });
        box.querySelector('.mvp-goal-msg').textContent = 'Ціль збережено: правило ' + st.goal.code + '. Наступного разу курс запитає, чи вийшло.';
      });
    });
  }
  function dayMilestone() {
    if (KIND !== 'day' || !lessonEl) return;
    var d = parseInt(SLUG.slice(-2), 10);
    if (!dayPassed(d)) return;
    var card = el('section', 'mvp-card mvp-milestone', '<p class="mvp-card-title">Віха: день ' + d + ' пройдено</p><p>Усі уроки цього дня зараховано.</p>');
    card.setAttribute('aria-label', 'Віха дня');
    lessonEl.insertBefore(card, lessonEl.firstChild);
    goalPicker(d, card);
  }

  if (KIND === 'urok') {
    var LN = lessonOfSlug(SLUG), LL = LN ? L(LN) : null;
    if (LL && lessonEl) {
      resumeBanner();
      rulesCard(LL);
      attemptCards(LL);
      sectionPauses(LL);
    }
  }
  if (/urok|day|vstup/.test(KIND)) { trackPosition(); terms(); }
  if (KIND === 'day') dayMilestone();
  if (KIND === 'index') renderToday();
  MVP.goalPicker = goalPicker;
  MVP.renderToday = renderToday;


  // =====================================================================
  // 10. Зріз 2 — закріплення: пари з вибором, перевірка уроку, повторення, особиста колода
  // =====================================================================
  function maskDigits(t) { return String(t || '').replace(/\d[\d\s\-()]{4,}\d/g, '***'); }

  function interactivePairs(l) {
    var cards = lessonEl ? [].slice.call(lessonEl.querySelectorAll('.pairs .pair-card')) : [];
    cards.forEach(function (card, i) {
      var p = l.pairs[i];
      if (!p || !p.good) return; // без «як правильно» — лишаємо тільки помилку
      var wrap = el('div', 'pair-card mvp-pair');
      card.parentNode.replaceChild(wrap, card);
      var item = pairItem(p, l.n, hashStr(p.id));
      item.lead = '<span class="mvp-kicker">Спершу обери</span><br><span class="quote-tag weak">Помилка</span> ' + esc(p.bad);
      renderChoice(wrap, item, function (ok) { ls(l.n).tries[p.id] = { ok: ok, t: Date.now() }; save(); });
    });
  }

  function lessonTest(l) {
    var h = findH2('Перевір себе');
    if (!h) return;
    // статичний тест (для роботи без JS) ховаємо — його замінює інтерактивна перевірка
    var n = h.nextElementSibling;
    while (n && n.tagName !== 'H2') { if (!n.classList.contains('sec-illo')) n.classList.add('static-hidden'); n = n.nextElementSibling; }
    var card = el('section', 'mvp-card mvp-test');
    card.setAttribute('aria-label', 'Перевірка уроку');
    afterHeading(h).insertAdjacentElement('afterend', card);
    var seed = l.n * 97;
    var pairsWithGood = l.pairs.filter(function (p) { return p.good; });
    var items = l.quiz.map(function (q) { return quizItem(q, l.n); })
      .concat(l.quotes.map(function (c) { return quoteItem(c, l.n); }))
      .concat(shuffle(pairsWithGood, seed).slice(0, 3).map(function (p) { return pairItem(p, l.n, hashStr(p.id) + 7); }));
    var prevTest = ls(l.n).test;

    function start() {
      card.innerHTML = '<div class="mvp-test-head"><p class="mvp-card-title">Перевірка уроку</p>' + (prevTest ? '<span class="mvp-progress">' + (prevTest.passed ? 'Урок зараховано · ' : '') + 'останній результат ' + prevTest.pct + '%</span>' : '') + '</div>' +
        '<p>' + items.length + ' питань: тест уроку, «сильно чи слабко?» і типові помилки. Неправильні повернуться в кінці, доки не відповіси вірно. Урок зараховується, коли з першої спроби правильні щонайменше 80 %.</p>' +
        '<p class="mvp-q-title" id="conf-q-' + l.n + '">Наскільки впевнені, що знаєте матеріал уроку? (1–5)</p>' +
        '<div class="mvp-conf" role="group" aria-labelledby="conf-q-' + l.n + '">' + [1, 2, 3, 4, 5].map(function (c) { return '<button type="button" class="mvp-btn" data-conf="' + c + '">' + c + '</button>'; }).join('') + '</div>' +
        '<p class="mvp-hint">1 — зовсім не впевнені, 5 — повністю впевнені. Потім порівняємо з результатом.</p>';
      [].forEach.call(card.querySelectorAll('[data-conf]'), function (b) { b.addEventListener('click', function () { run(parseInt(b.getAttribute('data-conf'), 10)); }); });
    }

    function run(conf) {
      var queue = items.slice(), first = {}, total = items.length, answered = 0;
      card.innerHTML = '<div class="mvp-test-head"><p class="mvp-card-title">Перевірка уроку</p><span class="mvp-progress" aria-live="polite"></span></div><div class="mvp-test-body"></div>';
      var body = card.querySelector('.mvp-test-body'), prog = card.querySelector('.mvp-progress');
      function next() {
        body.innerHTML = '';
        if (!queue.length) return finish();
        var it = queue.shift();
        var repeat = it.id in first;
        prog.textContent = repeat ? 'Повтор: питання, де була помилка' : 'Питання ' + (answered + 1) + ' з ' + total;
        var box = renderChoice(body, it, function (ok) {
          if (!(it.id in first)) { first[it.id] = ok; answered++; }
          if (!ok) queue.push(it);
          var nb = el('button', 'mvp-btn primary mvp-next-q', queue.length ? 'Далі' : 'Результат'); nb.type = 'button';
          nb.addEventListener('click', next);
          box.appendChild(nb);
          nb.focus();
        });
        var firstOpt = box.querySelector('.mvp-opt'); if (firstOpt && answered > 0) firstOpt.focus();
      }
      function finish() {
        var ok = 0, wrongRules = {};
        items.forEach(function (it) { if (first[it.id]) ok++; else if (it.rule) wrongRules[it.rule] = true; });
        var pct = Math.round(ok / total * 100);
        var pass = pct >= 80;
        var t = ls(l.n);
        var wasPassed = passed(l.n);
        t.test = { passed: pass || !!(t.test && t.test.passed), pct: pct, conf: conf, t: Date.now(), runs: ((t.test && t.test.runs) || 0) + 1 };
        items.forEach(function (it) { rvAdd(it.id, !first[it.id]); });
        l.open.forEach(function (o) { rvAdd(o.id, false); });
        save();
        var confPct = conf * 20;
        var cmp = Math.abs(confPct - pct) <= 20 ? 'твоя оцінка приблизно збігається з результатом.'
          : (confPct > pct ? 'впевненість вища за результат — повтори правила нижче.' : 'ти знаєш більше, ніж здавалось.');
        var wr = Object.keys(wrongRules);
        var html = '<p class="mvp-result ' + (pass ? 'ok' : 'no') + '">' + (pass ? 'Урок зараховано ✓' : 'Ще не зараховано (поріг 80 %)') + ' — з першої спроби правильно ' + ok + '/' + total + ' (' + pct + '%).</p>' +
          '<p class="mvp-compare">Впевненість ' + conf + '/5, результат ' + pct + '%: ' + cmp + '</p>';
        if (wr.length) html += '<p class="mvp-sub" style="margin-top:10px;font-weight:700">Повтори правила:</p><ul class="mvp-weak">' + wr.map(function (c) { var r = ruleByCode(c); return r ? '<li><b>' + esc(c) + '</b> ' + esc(cap(r.text)) + '</li>' : ''; }).join('') + '</ul>';
        html += '<p class="mvp-hint">Питання цього уроку додано в «Повторення»: ті, де була помилка, повернуться вже завтра.</p>';
        card.innerHTML = '<div class="mvp-test-head"><p class="mvp-card-title">Перевірка уроку</p></div><div class="mvp-test-res" tabindex="-1">' + html + '</div><div class="mvp-row"><button type="button" class="mvp-btn mvp-again">Пройти ще раз</button><a class="mvp-btn primary" href="index.html">До «Сьогодні»</a></div>';
        card.querySelector('.mvp-again').addEventListener('click', function () { prevTest = ls(l.n).test; start(); });
        card.querySelector('.mvp-test-res').focus();
        openRecall(card);
        if (pass && !wasPassed) {
          var d = l.day;
          if (dayPassed(d)) {
            Pop.show('toast', 'Віха: день ' + d + ' пройдено', '<p class="mvp-pop-text">Усі уроки дня зараховано. Обери ціль на дзвінки — одне правило на сьогодні.</p>', []);
            goalPicker(d, card);
          }
        }
      }
      next();
    }

    function openRecall(host) {
      if (!l.open.length) return;
      var box = el('div', 'mvp-open');
      box.innerHTML = '<p class="mvp-card-title">Пригадай без підказок</p><p class="mvp-muted">Відповідай подумки або вголос, потім звір з еталоном з уроку.</p>';
      l.open.forEach(function (o) {
        var q = el('div', 'mvp-q');
        q.innerHTML = '<p class="mvp-q-title">' + esc(o.q) + '</p>';
        var show = el('button', 'mvp-btn', 'Показати еталон'); show.type = 'button';
        show.addEventListener('click', function () {
          show.remove();
          var rev = el('div', 'mvp-reveal', '<b>Звір себе:</b> ' + esc(o.answer));
          var g = el('div', 'mvp-row', '<span class="mvp-muted">Як вийшло?</span>');
          ['Знаю', 'Частково', 'Не знаю'].forEach(function (lab, k) {
            var b = el('button', 'mvp-btn', lab); b.type = 'button';
            b.addEventListener('click', function () { rvAdd(o.id, k > 0); save(); g.innerHTML = '<span class="mvp-muted">Записано: «' + lab + '».</span>'; });
            g.appendChild(b);
          });
          q.appendChild(rev); q.appendChild(g);
        });
        q.appendChild(show);
        box.appendChild(q);
      });
      host.appendChild(box);
    }
    start();
  }

  // ---------- Повторення ----------
  function renderCardForReview(host, id, onDone) {
    var c = cardById(id);
    if (!c) return false;
    var n = c.n;
    function selfGrade(q, promptHtml, answerHtml) {
      q.innerHTML = promptHtml;
      var show = el('button', 'mvp-btn', 'Показати відповідь'); show.type = 'button';
      show.addEventListener('click', function () {
        show.remove();
        q.appendChild(el('div', 'mvp-reveal', answerHtml));
        var g = el('div', 'mvp-row', '<span class="mvp-muted">Як вийшло?</span>');
        ['Знаю', 'Частково', 'Не знаю'].forEach(function (lab, k) {
          var b = el('button', 'mvp-btn', lab); b.type = 'button';
          b.addEventListener('click', function () { rvGrade(id, k === 0); onDone(); });
          g.appendChild(b);
        });
        q.appendChild(g);
      });
      q.appendChild(show);
    }
    if (c.type === 'q' || c.type === 'p' || c.type === 'c') {
      var item = c.type === 'q' ? quizItem(c.data, n) : c.type === 'p' ? pairItem(c.data, n, hashStr(id) + dayKey().length) : quoteItem(c.data, n);
      item.lead = '<span class="mvp-kicker">' + lessonLink(n) + '</span>';
      var box = renderChoice(host, item, function (ok) {
        rvGrade(id, ok);
        var nb = el('button', 'mvp-btn primary', 'Далі'); nb.type = 'button';
        nb.addEventListener('click', onDone);
        box.appendChild(nb); nb.focus();
      });
      return true;
    }
    var q = el('div', 'mvp-q'); host.appendChild(q);
    if (c.type === 'o') selfGrade(q, '<p class="mvp-q-lead"><span class="mvp-kicker">' + lessonLink(n) + '</span></p><p class="mvp-q-title">' + esc(c.data.q) + '</p>', '<b>Звір себе:</b> ' + esc(c.data.answer));
    else if (c.type === 'r') selfGrade(q, '<p class="mvp-q-lead"><span class="mvp-kicker">' + lessonLink(n) + '</span></p><p class="mvp-q-title">Згадай правило ' + esc(c.data.code) + '</p>', '<b>Правило ' + esc(c.data.code) + ':</b> ' + esc(cap(c.data.text)));
    else if (c.type === 'deck') selfGrade(q, '<p class="mvp-q-lead"><span class="mvp-kicker">Моя колода</span></p><p class="mvp-q-title">Складний клієнт: ' + esc(c.data.text) + '</p><p class="mvp-q-sub">Що скажеш зараз? Проговори вголос, потім звір із SOS «Я на дзвінку».</p>', 'Знайди заперечення в SOS «Я на дзвінку» (кнопка внизу сторінки) і порівняй зі своєю відповіддю.');
    return true;
  }

  function deckForm(host, onSaved) {
    var box = el('section', 'mvp-card mvp-deck');
    box.setAttribute('aria-label', 'Складний клієнт сьогодні');
    box.innerHTML = '<p class="mvp-card-title">Складний клієнт сьогодні</p>' +
      '<p class="mvp-pii" role="note"><b>Увага:</b> не вписуй імена, телефони й адреси клієнтів — лише ситуацію і що він сказав.</p>' +
      '<form class="deck-form"><label for="deck-text" class="sos-label">Що сказав клієнт і в чому складність?</label><textarea id="deck-text" maxlength="400" placeholder="Напр.: клієнтка сказала «дорого, минулого разу було дешевше», не знаю, що відповісти"></textarea>' +
      '<div class="mvp-row"><button type="submit" class="mvp-btn primary">Зберегти в мою колоду</button><span class="deck-msg mvp-muted" aria-live="polite"></span></div></form>';
    host.appendChild(box);
    box.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var ta = box.querySelector('textarea');
      var t = maskDigits(ta.value.trim());
      if (!t) { box.querySelector('.deck-msg').textContent = 'Порожньо — опиши ситуацію кількома словами.'; return; }
      var id = 'deck-' + Date.now();
      st.deck.push({ id: id, text: t, t: Date.now() });
      rvAdd(id, false); save();
      ta.value = '';
      box.querySelector('.deck-msg').textContent = 'Збережено. Картка повернеться в «Повторенні» завтра.';
      if (onSaved) onSaved();
    });
    return box;
  }

  function renderReview() {
    var app = document.getElementById('review-app');
    if (!app) return;
    var queue = rvDueList();
    var pos = 0;
    var cardHost = el('div', 'rv-card-host'), deckHost = el('div', 'rv-deck-host'), listHost = el('div', 'rv-list-host');
    app.innerHTML = '';
    app.appendChild(cardHost); app.appendChild(deckHost); app.appendChild(listHost);
    function show() {
      cardHost.innerHTML = '';
      var total = Object.keys(st.review).length;
      var head = el('div', 'mvp-test-head', '<p class="mvp-card-title">Повторення на сьогодні</p><span class="mvp-progress">' + (queue.length && pos < queue.length ? 'Картка ' + (pos + 1) + ' з ' + queue.length + ' · ліміт 5 на день' : 'ліміт 5 на день') + '</span>');
      var card = el('section', 'mvp-card mvp-review'); card.setAttribute('aria-label', 'Картка повторення');
      card.appendChild(head);
      cardHost.appendChild(card);
      if (!total) {
        card.appendChild(el('p', 'rv-empty', 'Карток ще немає. Вони з\'являються після перевірки в кінці уроку і з твоєї колоди «Складний клієнт».'));
      } else if (pos >= queue.length) {
        var future = Object.keys(st.review).map(function (k) { return st.review[k].due; }).filter(function (x) { return x > Date.now(); }).sort(function (x, y) { return x - y; })[0];
        card.appendChild(el('p', 'rv-done', 'На сьогодні все. ' + (future ? 'Наступні картки — ' + new Date(future).toLocaleDateString('uk-UA') + '.' : '')));
      } else {
        var body = el('div', 'mvp-review-body'); card.appendChild(body);
        if (!renderCardForReview(body, queue[pos], function () { pos++; show(); var f = cardHost.querySelector('.mvp-opt, .mvp-btn'); if (f) f.focus(); })) { pos++; show(); }
      }
    }
    // особиста колода «Складний клієнт сьогодні»
    function renderList() {
      listHost.innerHTML = '';
      if (!st.deck.length) return;
      var list = el('section', 'mvp-card', '<p class="mvp-card-title">Моя колода</p><ul class="deck-list"></ul>');
      list.setAttribute('aria-label', 'Моя колода');
      var ul = list.querySelector('ul');
      st.deck.forEach(function (dk) {
        var li = el('li', '', '<span>' + esc(dk.text) + '</span>');
        var del = el('button', 'mvp-btn ghost', 'Видалити'); del.type = 'button';
        del.setAttribute('aria-label', 'Видалити картку');
        del.addEventListener('click', function () { st.deck = st.deck.filter(function (x) { return x.id !== dk.id; }); delete st.review[dk.id]; save(); renderList(); });
        li.appendChild(del); ul.appendChild(li);
      });
      listHost.appendChild(list);
    }
    show();
    deckForm(deckHost, renderList);
    renderList();
  }

  if (KIND === 'urok' && LL && lessonEl) { interactivePairs(LL); lessonTest(LL); }
  if (KIND === 'review') renderReview();
  if (KIND === 'index') { var tApp = document.getElementById('today-app'); if (tApp) deckForm(tApp); }
  MVP.deckForm = deckForm; MVP.maskDigits = maskDigits;

  // =====================================================================
  // 11. Зріз 3 — симулятор дзвінка: сцени з уроків (реплика клієнта → варіанти менеджера дослівно
  //     з уроку → наслідок і розбір → спроба з іншим вибором → «що відпрацювати»)
  // =====================================================================
  function sceneById(id) {
    var m = /^s(\d+)-/.exec(id || ''); var l = m && L(parseInt(m[1], 10));
    if (!l) return null;
    for (var i = 0; i < l.scenes.length; i++) if (l.scenes[i].id === id) return l.scenes[i];
    return null;
  }
  function renderSim() {
    var app = document.getElementById('sim-app');
    if (!app) return;
    var ids = (T.sim || []).filter(sceneById);
    if (!st.sim || typeof st.sim !== 'object') st.sim = {};
    function solvedCount() { return ids.filter(function (id) { return st.sim[id] && st.sim[id].solved; }).length; }

    function list(focusId) {
      app.innerHTML = '';
      var head = el('section', 'mvp-card sim-head');
      head.setAttribute('aria-label', 'Симулятор дзвінка');
      head.innerHTML = '<div class="mvp-test-head"><p class="mvp-card-title">Симулятор дзвінка</p><span class="mvp-progress">Пройдено ' + solvedCount() + '/' + ids.length + '</span></div>' +
        '<p>' + ids.length + ' сцен з уроків. Читаєш, що каже клієнт, обираєш відповідь і бачиш, чому вона працює або ні. Помилка — пробуєш інший варіант. У кінці сцени — що відпрацювати на дзвінках.</p>';
      app.appendChild(head);
      var grid = el('div', 'sim-list');
      ids.forEach(function (id, k) {
        var sc = sceneById(id), s = st.sim[id];
        var b = el('button', 'sim-tile' + (s && s.solved ? ' solved' : ''), '<small>Сцена ' + (k + 1) + ' · Урок ' + sc.lesson + (s && s.solved ? ' · ✓ пройдено' : s && s.tried && s.tried.length ? ' · почато' : '') + '</small><span>' + esc(cap(sc.title)) + '</span>');
        b.type = 'button'; b.setAttribute('data-scene', id);
        b.addEventListener('click', function () { play(k); });
        grid.appendChild(b);
      });
      app.appendChild(grid);
      // що відпрацювати: сцени, де перша відповідь була неправильною
      var weak = ids.filter(function (id) { return st.sim[id] && st.sim[id].firstGood === false; });
      if (weak.length) {
        var wk = el('section', 'mvp-card sim-weak');
        wk.setAttribute('aria-label', 'Що відпрацювати');
        wk.innerHTML = '<p class="mvp-card-title">Що відпрацювати</p><p class="mvp-muted">Сцени, де перша відповідь була неправильною.</p><ul class="mvp-weak">' + weak.map(function (id) {
          var sc = sceneById(id), r = ruleByCode(sc.rule);
          return '<li>' + (r ? '<b>' + esc(r.code) + '</b> ' + esc(cap(r.text)) : esc(cap(sc.title))) + (sc.practice ? '<br><span class="mvp-muted">' + esc(cap(sc.practice)) + '</span>' : '') + '</li>';
        }).join('') + '</ul>';
        app.appendChild(wk);
      }
      var f = focusId && app.querySelector('[data-scene="' + focusId + '"]');
      if (f) f.focus();
    }

    function play(k) {
      var id = ids[k], sc = sceneById(id);
      var s = st.sim[id] || (st.sim[id] = { tried: [], solved: false });
      if (!s.tried) s.tried = [];
      var opts = shuffle(sc.options.map(function (o, i) { return { o: o, i: i }; }), hashStr(id));
      var good = sc.options.filter(function (o) { return o.good; })[0];
      var isLine = /«/.test(sc.client);
      app.innerHTML = '';
      var card = el('section', 'mvp-card sim-scene');
      card.setAttribute('aria-label', 'Сцена ' + (k + 1) + ' з ' + ids.length);
      card.innerHTML = '<div class="mvp-test-head"><p class="mvp-card-title" tabindex="-1">Сцена ' + (k + 1) + ' з ' + ids.length + '</p><span class="mvp-progress">' + lessonLink(sc.lesson) + '</span></div>' +
        '<p class="sim-sit"><b>Ситуація:</b> ' + esc(cap(sc.title)) + '</p>' +
        '<p class="sim-client"><small>' + (isLine ? 'Клієнт' : 'Що відбувається') + '</small>' + esc(cap(sc.client)) + '</p>' +
        '<p class="mvp-q-title">Що скажеш?</p><div class="mvp-opts sim-opts" role="group" aria-label="Варіанти відповіді"></div><div class="sim-out" aria-live="polite"></div>' +
        '<div class="mvp-row"><button type="button" class="mvp-btn ghost sim-back">← Усі сцени</button></div>';
      app.appendChild(card);
      card.querySelector('.sim-back').addEventListener('click', function () { list(id); });
      var optsBox = card.querySelector('.sim-opts'), out = card.querySelector('.sim-out');

      function round() {
        optsBox.innerHTML = ''; out.innerHTML = '';
        opts.forEach(function (x) {
          var tried = s.tried.indexOf(x.i) >= 0;
          var b = el('button', 'mvp-opt' + (tried ? ' is-tried' : ''), esc(x.o.text) + (tried ? ' <small class="sim-tried">уже обрано</small>' : ''));
          b.type = 'button'; b.setAttribute('data-opt', String(x.i));
          b.addEventListener('click', function () { choose(x, b); });
          optsBox.appendChild(b);
        });
      }
      function choose(x, b) {
        [].forEach.call(optsBox.children, function (y) { y.disabled = true; });
        b.classList.add(x.o.good ? 'is-correct' : 'is-wrong');
        if (!s.tried.length) s.firstGood = !!x.o.good;
        if (s.tried.indexOf(x.i) < 0) s.tried.push(x.i);
        if (x.o.good) s.solved = true;
        s.t = Date.now(); save();
        var html = fb3({ good: x.o.good, said: x.o.text, why: x.o.why, instead: good ? good.text : '', lesson: sc.lesson, rule: sc.rule });
        var r = ruleByCode(sc.rule);
        if (x.o.good || s.tried.length >= sc.options.length) {
          html += '<div class="sim-practice"><p><b>Що відпрацювати:</b> ' + esc(cap(sc.practice || '')) + '</p>' + (r ? '<p class="mvp-muted"><b>Правило ' + esc(r.code) + ':</b> ' + esc(cap(r.text)) + '</p>' : '') + '</div>';
        }
        out.innerHTML = html;
        var row = el('div', 'mvp-row');
        var untried = sc.options.length - s.tried.length;
        if (untried > 0) {
          var again = el('button', 'mvp-btn sim-again', x.o.good ? 'Подивитися інший варіант' : 'Спробувати інший варіант'); again.type = 'button';
          again.addEventListener('click', function () { round(); var f = optsBox.querySelector('.mvp-opt:not(.is-tried)'); if (f) f.focus(); });
          row.appendChild(again);
        }
        if (s.solved) {
          if (k + 1 < ids.length) {
            var nx = el('button', 'mvp-btn primary sim-next', 'Наступна сцена →'); nx.type = 'button';
            nx.addEventListener('click', function () { play(k + 1); });
            row.appendChild(nx);
          } else {
            var fin = el('button', 'mvp-btn primary sim-finish', 'До всіх сцен'); fin.type = 'button';
            fin.addEventListener('click', function () { list(); });
            row.appendChild(fin);
          }
        }
        out.appendChild(row);
        var focusBtn = row.querySelector('.sim-next, .sim-finish, .sim-again');
        if (focusBtn) focusBtn.focus();
      }
      round();
      var t = card.querySelector('.mvp-card-title'); if (t) t.focus();
      try { card.scrollIntoView({ block: 'start' }); } catch (e) {}
    }
    list();
  }
  if (KIND === 'trenazher') renderSim();
  MVP.sceneById = sceneById;

  // Офлайн-кеш (service worker) — лише на зібраному сайті (у фрагментах курсу атрибута data-sw немає)
  try {
    if ('serviceWorker' in navigator && document.documentElement.hasAttribute('data-sw') && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  } catch (e) { /* без офлайн-кешу */ }

  //__MODULES__
})();
