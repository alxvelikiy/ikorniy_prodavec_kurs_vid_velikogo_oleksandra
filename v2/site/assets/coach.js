// Ikorka Shop — сторінка ІІ-тренера (зріз 4).
// Режим A «Розмова з ІІ-клієнтом»: клієнт висуває заперечення з таблиці компанії або репліку з уроку,
//   менеджер відповідає (до 8 реплік), потім — розбір від тренера.
// Режим B «Розбір моєї відповіді»: одна відповідь менеджера → розбір у три частини.
// Браузер звертається лише до /api/coach/roleplay і /api/coach/feedback (сервер v2/coach/server.mjs).
// Без сервера, без ключа чи при помилці — «Тренер офлайн»: розбір за парами «помилка → як правильно» з уроків.
// Тексти розмов не зберігаються: у localStorage лише лічильники вправ.
(function () {
  'use strict';
  var app = document.getElementById('coach-app');
  if (!app || !window.TRAINER || !window.MVP) return;
  var T = window.TRAINER, M = window.MVP, esc = M.esc, el = M.el, cap = M.cap;
  var HAS_API = !!document.querySelector('meta[name="ikorka-coach"]');
  var MAX_TURNS = 8, MAX_LEN = 400;
  var CAT = { 'істинне': 'Істинні заперечення', 'ситуативне': 'Ситуативні заперечення', 'хибне': 'Хибні заперечення' };
  var status = { mode: HAS_API ? 'checking' : 'offline', reason: HAS_API ? '' : 'static' };

  function maskDigits(t) { return String(t || '').replace(/\d[\d\s\-()]{4,}\d/g, '***'); }
  function quoteOf(s) { var m = /«([^«»]{2,200})»/.exec(s || ''); return m ? m[1] : ''; }
  function count(k) { M.st.coach = M.st.coach || {}; M.st.coach[k] = (M.st.coach[k] || 0) + 1; M.save(); }

  // ---------- сцени ----------
  function allScenes() {
    var out = [];
    T.sos.objections.forEach(function (o) { out.push({ id: o.id, kind: 'persona', cat: o.cat, title: o.obj, opener: o.obj, lesson: 4, say: o.say }); });
    T.lessons.forEach(function (l) {
      l.scenes.forEach(function (s) { out.push({ id: s.id, kind: 'scene', title: s.title, opener: quoteOf(s.client), situation: s.client, lesson: l.n, rule: s.rule, scene: s }); });
    });
    return out;
  }
  var SCENES = allScenes();
  function sceneById(id) { for (var i = 0; i < SCENES.length; i++) if (SCENES[i].id === id) return SCENES[i]; return null; }

  // ---------- мережа ----------
  function post(url, body) {
    if (!HAS_API || !window.fetch) return Promise.resolve({ ok: false, mode: 'offline', reason: 'static' });
    return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, mode: 'offline', reason: 'network' }; });
  }

  // ---------- статус ----------
  var chip;
  function setStatus(mode, reason) {
    status.mode = mode; status.reason = reason || '';
    if (!chip) return;
    var txt = mode === 'live' ? 'Тренер онлайн' : mode === 'mock' ? 'Демо-режим: відповіді-заготовки, не ІІ' : mode === 'checking' ? 'Перевіряю зв\'язок…' : 'Тренер офлайн';
    chip.textContent = txt;
    chip.className = 'coach-status ' + (mode === 'live' || mode === 'mock' ? 'on' : mode === 'checking' ? '' : 'off');
    var note = app.querySelector('.coach-offline-note');
    if (note) note.hidden = mode !== 'offline';
  }
  var REASON = { 'no-key': 'на сервері не задано ключ API', limit: 'вичерпано ліміт розборів на сьогодні', timeout: 'сервер ІІ не відповів вчасно', error: 'помилка сервера ІІ', format: 'тренер відповів у неправильному форматі', static: 'сайт відкрито без сервера тренера', network: 'немає зв\'язку з сервером тренера' };

  // ---------- офлайн-розбір за правилами уроків ----------
  function stems(t) { return String(t || '').toLowerCase().split(/[^a-zа-яіїєґ']+/i).filter(function (w) { return w.length > 3; }).map(function (w) { return w.slice(0, 5); }); }
  function localFeedback(sc, reply) {
    var l = M.L(sc.lesson), words = stems(reply), best = null, bestScore = 0;
    // кандидати: неправильні варіанти цієї сцени і пари «помилка → як правильно» уроку
    var cands = [];
    if (sc.scene) {
      var gOpt = sc.scene.options.filter(function (o) { return o.good; })[0];
      sc.scene.options.forEach(function (o) { if (!o.good && gOpt) cands.push({ bad: o.text, why: o.why, good: gOpt.text, rule: sc.rule }); });
    }
    l.pairs.forEach(function (p) { if (p.good) cands.push({ bad: p.bad, why: p.why, good: p.good, rule: p.rule }); });
    cands.forEach(function (c) {
      var b = c.bad.toLowerCase(), score = 0;
      words.forEach(function (w) { if (b.indexOf(w) >= 0) score++; });
      if (score > bestScore) { bestScore = score; best = c; }
    });
    if (best && bestScore >= 2 && best.why) return { good: false, said: reply, why: best.why, instead: best.good, lesson: sc.lesson, rule: best.rule || sc.rule, verdict: 'Схоже на типову помилку з уроку' };
    // немає схожої помилки — показуємо зразок з уроку
    var model = null;
    if (sc.kind === 'persona' && sc.say) model = { why: sc.say.why, text: sc.say.text };
    else if (sc.scene) { var g = sc.scene.options.filter(function (o) { return o.good; })[0]; if (g) model = { why: g.why, text: g.text }; }
    if (!model) { var s0 = l.says[0]; model = s0 ? { why: s0.why, text: s0.say } : { why: (l.rules[0] || {}).text, text: (l.rules[0] || {}).text }; }
    return { neutral: true, said: reply, why: model.why, instead: model.text, lesson: sc.lesson, rule: sc.rule || (l.rules[0] || {}).code };
  }

  // розбір від тренера (JSON сервера) → три частини
  function coachFb3(fb, sc) {
    var list = fb['що_сказати_натомість'] || [];
    var html = '<ul>' + list.map(function (x) {
      var ref = x.source_ref || {};
      return '<li>' + esc(x['текст']) + (ref['урок'] ? ' <small>джерело: ' + M.lessonLink(ref['урок']) + '</small>' : '') + '</li>';
    }).join('') + '</ul>';
    var good = fb['оцінка'] === 'добре';
    return M.fb3({ good: good, said: fb['що_сказано'], why: fb['чому'], insteadHtml: html, lesson: sc.lesson, rule: fb['код_правила'], verdict: (good ? 'Тренер: працює на клієнта' : 'Тренер: варто виправити') + ' · правило ' + fb['код_правила'] });
  }

  function showFeedback(host, sc, replies, history) {
    host.innerHTML = '<p class="mvp-muted">Тренер розбирає відповідь…</p>';
    return post('/api/coach/feedback', { scene: sc.id, replies: replies, history: history || undefined }).then(function (r) {
      if (r && r.ok && r.feedback) {
        setStatus(r.mode);
        host.innerHTML = coachFb3(r.feedback, sc) + (r.replaced ? '<p class="mvp-hint">Тренер запропонував фразу, якої немає в уроках, — її замінено посиланням на правило.</p>' : '');
      } else {
        setStatus('offline', r && r.reason);
        host.innerHTML = '<p class="mvp-hint coach-offline-why">Тренер офлайн (' + esc(REASON[r && r.reason] || 'немає зв\'язку') + '). Розбір — за правилами уроку:</p>' + M.fb3(localFeedback(sc, replies[replies.length - 1]));
      }
      count('feedback');
      var f = host.querySelector('.fb3'); if (f) { f.setAttribute('tabindex', '-1'); f.focus(); }
    });
  }

  // ---------- каркас сторінки ----------
  app.innerHTML = '';
  var head = el('section', 'mvp-card coach-head');
  head.innerHTML = '<div class="mvp-test-head"><p class="mvp-card-title">ІІ-тренер</p><span class="coach-status" role="status"></span></div>' +
    '<p>Дві вправи. <b>Розмова з ІІ-клієнтом</b>: клієнт висуває заперечення, ти відповідаєш — до ' + MAX_TURNS + ' реплік, потім розбір. <b>Розбір моєї відповіді</b>: обери ситуацію, напиши відповідь — тренер розбере її в три рядки.</p>' +
    '<p class="mvp-hint">Тренер радить лише фрази, які дослівно є в уроках. Якщо готової фрази немає, він так і пише: «У курсі немає готової фрази — див. правило N».</p>' +
    '<p class="mvp-hint coach-offline-note" hidden>Зараз тренер офлайн: розбір іде за парами «помилка → як правильно» з уроків, розмова з ІІ-клієнтом недоступна. Сцени без ІІ — у <a href="trenazher.html">симуляторі</a>.</p>' +
    '<div class="sos-tabs coach-tabs" role="tablist" aria-label="Вправи тренера"><button type="button" role="tab" class="sos-tab on" aria-selected="true" data-tab="rp">Розмова з ІІ-клієнтом</button><button type="button" role="tab" class="sos-tab" aria-selected="false" data-tab="fb">Розбір моєї відповіді</button></div>';
  app.appendChild(head);
  chip = head.querySelector('.coach-status');
  var paneRp = el('section', 'mvp-card coach-pane'); paneRp.setAttribute('data-pane', 'rp'); paneRp.setAttribute('aria-label', 'Розмова з ІІ-клієнтом');
  var paneFb = el('section', 'mvp-card coach-pane'); paneFb.setAttribute('data-pane', 'fb'); paneFb.setAttribute('aria-label', 'Розбір моєї відповіді'); paneFb.hidden = true;
  app.appendChild(paneRp); app.appendChild(paneFb);
  [].forEach.call(head.querySelectorAll('.sos-tab'), function (tb) {
    tb.addEventListener('click', function () {
      [].forEach.call(head.querySelectorAll('.sos-tab'), function (x) { var on = x === tb; x.classList.toggle('on', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); });
      paneRp.hidden = tb.getAttribute('data-tab') !== 'rp';
      paneFb.hidden = tb.getAttribute('data-tab') !== 'fb';
    });
  });
  setStatus(status.mode, status.reason);
  if (HAS_API) post('/api/coach/feedback', { ping: true }).then(function (r) { setStatus(r && r.ok ? r.mode : 'offline', r && (r.reason || (r.mode === 'offline' ? 'no-key' : ''))); });

  // ---------- Режим A: розмова ----------
  function pickPersona() {
    paneRp.innerHTML = '<p class="mvp-card-title">Обери клієнта</p><p class="mvp-muted">Заперечення з таблиці компанії (істинні, ситуативні, хибні) і репліки клієнтів з уроків.</p>';
    ['істинне', 'ситуативне', 'хибне'].forEach(function (cat) {
      var box = el('div', 'coach-group', '<p class="mvp-sub">' + CAT[cat] + '</p><div class="coach-personas"></div>');
      SCENES.filter(function (s) { return s.kind === 'persona' && s.cat === cat; }).forEach(function (s) {
        var b = el('button', 'sim-tile', '<span>«' + esc(s.opener) + '»</span>'); b.type = 'button'; b.setAttribute('data-scene', s.id);
        b.addEventListener('click', function () { chat(s); });
        box.querySelector('.coach-personas').appendChild(b);
      });
      paneRp.appendChild(box);
    });
    var box2 = el('div', 'coach-group', '<p class="mvp-sub">Репліки клієнтів з уроків</p><div class="coach-personas"></div>');
    SCENES.filter(function (s) { return s.kind === 'scene' && s.opener; }).forEach(function (s) {
      var b = el('button', 'sim-tile', '<small>Урок ' + s.lesson + '</small><span>«' + esc(cap(s.opener)) + '»</span>'); b.type = 'button'; b.setAttribute('data-scene', s.id);
      b.addEventListener('click', function () { chat(s); });
      box2.querySelector('.coach-personas').appendChild(b);
    });
    paneRp.appendChild(box2);
  }

  function chat(sc) {
    var history = [{ r: 'c', t: cap(sc.opener) }];
    var finished = false;
    paneRp.innerHTML = '<div class="mvp-test-head"><p class="mvp-card-title" tabindex="-1">' + (sc.kind === 'persona' ? esc(CAT[sc.cat]) : 'Урок ' + sc.lesson) + '</p><span class="mvp-progress coach-turns" aria-live="polite"></span></div>' +
      (sc.kind === 'scene' ? '<p class="sim-sit"><b>Ситуація:</b> ' + esc(cap(sc.title)) + '</p>' : '') +
      '<div class="coach-log" aria-live="polite"></div>' +
      '<form class="coach-form"><label class="sos-label" for="coach-say">Твоя відповідь клієнту</label><textarea id="coach-say" maxlength="' + MAX_LEN + '" rows="3" placeholder="Твоя репліка в дзвінку"></textarea>' +
      '<p class="mvp-hint">Не вписуй імена, телефони й адреси клієнтів. Довгі числа замінюються на ***.</p>' +
      '<div class="mvp-row"><button type="submit" class="mvp-btn primary coach-send">Сказати</button><button type="button" class="mvp-btn coach-finish">Завершити і отримати розбір</button><button type="button" class="mvp-btn ghost coach-back">← Інший клієнт</button></div></form>' +
      '<div class="coach-result"></div>';
    var log = paneRp.querySelector('.coach-log'), form = paneRp.querySelector('form'), ta = paneRp.querySelector('#coach-say');
    var turns = paneRp.querySelector('.coach-turns'), result = paneRp.querySelector('.coach-result');
    var send = paneRp.querySelector('.coach-send'), fin = paneRp.querySelector('.coach-finish');
    function say(r, t, note) {
      var m = el('div', 'coach-msg ' + (r === 'c' ? 'client' : 'manager'), '<small>' + (r === 'c' ? 'Клієнт' : 'Ти') + '</small>' + esc(t) + (note ? '<em class="coach-note">' + esc(note) + '</em>' : ''));
      log.appendChild(m);
    }
    function mTurns() { return history.filter(function (h) { return h.r === 'm'; }).length; }
    function upd() { turns.textContent = 'Реплік: ' + mTurns() + ' з ' + MAX_TURNS; fin.disabled = !mTurns() || finished; }
    function finish() {
      if (finished || !mTurns()) return;
      finished = true; ta.disabled = true; send.disabled = true; fin.disabled = true;
      var replies = history.filter(function (h) { return h.r === 'm'; }).map(function (h) { return h.t; });
      count('roleplay');
      showFeedback(result, sc, replies, history);
    }
    say('c', history[0].t);
    upd();
    paneRp.querySelector('.coach-back').addEventListener('click', function () { pickPersona(); var f = paneRp.querySelector('[data-scene="' + sc.id + '"]'); if (f) f.focus(); });
    fin.addEventListener('click', finish);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var t = maskDigits(ta.value.trim()).slice(0, MAX_LEN);
      if (!t || finished) return;
      ta.value = '';
      history.push({ r: 'm', t: t }); say('m', t); upd();
      send.disabled = true;
      post('/api/coach/roleplay', { scene: sc.id, history: history }).then(function (r) {
        send.disabled = finished;
        if (r && r.ok) {
          setStatus(r.mode);
          history.push({ r: 'c', t: r.reply });
          say('c', r.reply, r.guarded ? 'ІІ-клієнт спробував вигадати умови — репліку замінено запереченням з уроку' : '');
          if (r.last || mTurns() >= MAX_TURNS) finish(); else ta.focus();
        } else {
          setStatus('offline', r && r.reason);
          // без ІІ-клієнта розмова не продовжується: одразу розбір останньої відповіді за правилами уроку
          finish();
        }
      });
    });
    ta.focus();
  }
  pickPersona();

  // ---------- Режим B: розбір однієї відповіді ----------
  (function () {
    var opts = '<optgroup label="Заперечення з таблиці компанії">' + SCENES.filter(function (s) { return s.kind === 'persona'; }).map(function (s) { return '<option value="' + s.id + '">«' + esc(s.opener) + '» · ' + esc(s.cat) + '</option>'; }).join('') + '</optgroup>';
    T.lessons.forEach(function (l) {
      var sc = SCENES.filter(function (s) { return s.kind === 'scene' && s.lesson === l.n; });
      if (sc.length) opts += '<optgroup label="Урок ' + l.n + '. ' + esc(l.title) + '">' + sc.map(function (s) { return '<option value="' + s.id + '">' + esc(cap(s.title)) + '</option>'; }).join('') + '</optgroup>';
    });
    paneFb.innerHTML = '<p class="mvp-card-title">Розбір моєї відповіді</p>' +
      '<label class="sos-label" for="coach-scene">Ситуація</label><select id="coach-scene" class="coach-select">' + opts + '</select>' +
      '<p class="sim-client coach-line"></p>' +
      '<form class="coach-form"><label class="sos-label" for="coach-reply">Що ти відповіси клієнту?</label><textarea id="coach-reply" maxlength="' + MAX_LEN + '" rows="3"></textarea>' +
      '<p class="mvp-hint">Не вписуй імена, телефони й адреси клієнтів. Довгі числа замінюються на ***.</p>' +
      '<div class="mvp-row"><button type="submit" class="mvp-btn primary">Отримати розбір</button></div></form><div class="coach-result"></div>';
    var sel = paneFb.querySelector('select'), line = paneFb.querySelector('.coach-line'), ta = paneFb.querySelector('textarea'), result = paneFb.querySelector('.coach-result');
    function showLine() {
      var s = sceneById(sel.value);
      line.innerHTML = s.kind === 'persona' ? '<small>Клієнт</small>«' + esc(s.opener) + '»' : '<small>' + (s.opener ? 'Клієнт' : 'Що відбувається') + '</small>' + esc(cap(s.situation));
      result.innerHTML = '';
    }
    sel.addEventListener('change', showLine);
    showLine();
    paneFb.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var t = maskDigits(ta.value.trim()).slice(0, MAX_LEN);
      if (!t) { result.innerHTML = '<p class="mvp-hint">Напиши відповідь — хоча б одне речення.</p>'; return; }
      ta.value = t;
      showFeedback(result, sceneById(sel.value), [t]);
    });
  })();

  window.COACH = { maskDigits: maskDigits, localFeedback: localFeedback, scenes: SCENES };
})();
