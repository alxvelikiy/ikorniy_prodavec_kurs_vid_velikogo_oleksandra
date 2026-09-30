/* ==========================================================================
   Ikorka Duo — lesson.js
   Власник: builder-lesson. Плеєр уроку: vprava.html?n=<nodeId> (вузол шляху) або ?mode=mistakes (повтор помилок).
   Контракти: docs/design/ARCHITECTURE.md §4 (Duo.env/ui/motion/sfx/progress/celebrate/mascot/copy).
   Черга кроків із повтором помилок, серця, комбо, лист-результат, екран підсумку. Вправи — exercises.js.
   Не падає без Duo.mascot / Duo.copy / Duo.celebrate (перевірки на існування).
   ========================================================================== */
(function () {
  'use strict';
  var Duo = window.Duo = window.Duo || {};

  /* --------------------------------------------------------------------- */
  /* Тимчасова мікрокопія (Duo.copy потім замінить). Українською.          */
  /* --------------------------------------------------------------------- */
  var FALLBACK_COPY = {
    praise: [
      'Чудово!', 'Так тримати!', 'Влучно!', 'Ти в темі!', 'Саме так!', 'Точно!', 'Гарна робота!', 'Впевнено!',
      'У точку!', 'Чітко!', 'Молодець!', 'Сильний хід!', 'Без вагань!', 'Ось це рівень!', 'Так і роби!', 'Тримаєш темп!'
    ],
    wrongTitles: ['Не зовсім', 'Майже', 'Тут була пастка', 'Варто запам\'ятати', 'Ще не те'],
    comboSuffix: 'поспіль!',
    correctAnswer: 'Правильна відповідь:',
    buttons: { check: 'Перевірити', next: 'Далі', gotIt: 'Зрозуміло', cont: 'Продовжити', toPath: 'До шляху', stay: 'Продовжити урок', leave: 'Вийти', refill: 'Поповнити', close: 'Вийти з уроку' },
    exit: { title: 'Точно вийти?', text: 'Прогрес цього вузла не збережеться.' },
    heartsEmpty: { title: 'Серця закінчились', text: 'Поповни серця, щоб продовжити. Або вийди до шляху й повтори помилки.' },
    loading: 'Завантажую урок…',
    errors: {
      load: 'Не вдалося завантажити урок. Перевір з\'єднання й спробуй ще раз.',
      missing: 'Такого вузла немає. Повернись до шляху й обери урок.',
      boss: 'Цей вузол — розмова з ІІ-клієнтом, її відкриває шлях навчання.',
      noMistakes: 'Помилок для повторення немає. Так тримати!'
    },
    done: {
      title: 'Урок пройдено!', titlePractice: 'Повторення завершено!', xp: 'XP', accuracy: 'Точність', streak: 'Серія', time: 'Час', mistakes: 'Помилок',
      daysOne: 'день', daysFew: 'дні', daysMany: 'днів', min: 'хв', sec: 'с',
      epithets: { 100: 'Ідеально!', 90: 'Чудово!', 75: 'Добре!', 50: 'Непогано, є що підтягнути', 0: 'Повтор — найкращий друг пам\'яті' },
      xpKinds: { lesson: 'Урок', repeat: 'Повтор уроку', perfect: 'Без помилок', practice: 'Практика', practicePerfect: 'Без помилок', boss: 'Бос', bossPerfect: 'Без помилок' }
    },
    mistakesMode: { title: 'Повторення помилок' },
    sos: { title: 'Швидке повторення', done: 'Готово!', sub: 'Ключові правила повторено', cards: 'Карток', answers: 'Відповідей', note: 'Це швидке повторення: без сердець і XP.' },
    chest: { locked: 'Сундук відкриється після вузла «{t}». Пройди його на шляху.', opened: 'Сундук відкрито!', already: 'Цей сундук уже відкрито', sub: 'Нагорода за блок уроків', nodes: 'Вузлів пройдено', reward: 'Нагорода', take: 'Забрати', alreadyText: 'XP за нього вже зараховано.' },
    boss: { titleDone: 'Боса пройдено!', retry: 'Ще раз!', retryText: 'Потрібно щонайменше {n} з {t} вірних з першої спроби. Повтори правила й спробуй знову.', again: 'Спробувати ще раз', got: 'Вірно з першої' },
    settings: { label: 'Налаштування сигналів', title: 'Сигнали', text: 'Звук і вібрація під час уроку.', done: 'Готово' },
    aria: { progress: 'Прогрес уроку', heartsOf: 'Серця', of: 'з', step: 'Крок', right: 'Правильно.', wrong: 'Неправильно.', stage: 'Вміст кроку' },
    ex: {
      clientSays: 'Клієнт каже', manager: 'Менеджер', client: 'Клієнт', example: 'Приклад фрази',
      theoryTitle: 'Запам\'ятай', pChoice: 'Обери найкращу відповідь', pTruefalse: 'Правда чи міф?', pBuild: 'Склади фразу',
      pMatch: 'Поєднай пари', pOrder: 'Розстав по порядку', pFill: 'Встав пропущене', pSpot: 'Знайди помилку менеджера',
      'true': 'Правда', 'false': 'Міф', trueFull: 'Правда', falseFull: 'Міф — твердження хибне', blank: 'Пропуск',
      spotAnswer: 'Помилка тут:', yourAnswer: 'Твоя відповідь', wordBank: 'Доступні слова', tapWords: 'Торкайся слів нижче, щоб скласти фразу',
      yourOrder: 'Твій порядок', stepsBank: 'Кроки для розстановки', tapSteps: 'Торкайся кроків у правильному порядку', rightOrder: 'Правильний порядок:',
      matchLeft: 'Ліва колонка', matchRight: 'Права колонка', pair: 'пара', rightPairs: 'Правильні пари:', matchTries: 'Помилкових спроб: {n}. Ще один підхід — і пари закріпляться.'
    }
  };

  /* --------------------------------------------------------------------- */
  /* Доступ до копії: Duo.copy, якщо є функція, інакше FALLBACK_COPY        */
  /* --------------------------------------------------------------------- */
  var lastPraise = -1, lastWrong = -1;
  function pickRotating(list, last) {
    if (list.length < 2) return { i: 0, t: list[0] };
    var i; do { i = Math.floor(Math.random() * list.length); } while (i === last);
    return { i: i, t: list[i] };
  }
  function copyCall(name, arg) {
    try {
      var c = Duo.copy;
      if (c && typeof c[name] === 'function') { var v = c[name](arg); if (typeof v === 'string' && v) return v; }
    } catch (e) { /* падаємо на запасний текст */ }
    return null;
  }
  function praise() {
    var v = copyCall('praise'); if (v) return v;
    var p = pickRotating(FALLBACK_COPY.praise, lastPraise); lastPraise = p.i; return p.t;
  }
  function wrongTitle() {
    var v = copyCall('wrongTitle'); if (v) return v;
    var p = pickRotating(FALLBACK_COPY.wrongTitles, lastWrong); lastWrong = p.i; return p.t;
  }
  function comboText(n) { return copyCall('comboBadge', n) || (n + ' ' + FALLBACK_COPY.comboSuffix); }
  function epithet(pct) {
    var v = copyCall('accuracyEpithet', pct); if (v) return v;
    var e = FALLBACK_COPY.done.epithets;
    return pct >= 100 ? e[100] : pct >= 90 ? e[90] : pct >= 75 ? e[75] : pct >= 50 ? e[50] : e[0];
  }
  var B = FALLBACK_COPY.buttons;

  /* --------------------------------------------------------------------- */
  /* Утиліти                                                                */
  /* --------------------------------------------------------------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function icon(name, size) { return Duo.icon ? Duo.icon(name, { size: size || 20 }) : ''; }
  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    return (a > 10 && a < 20) ? many : b === 1 ? one : (b >= 2 && b <= 4) ? few : many;
  }
  function fmtTime(ms) {
    var s = Math.max(1, Math.round(ms / 1000)), m = Math.floor(s / 60), D = FALLBACK_COPY.done;
    return m ? m + ' ' + D.min + ' ' + (s % 60) + ' ' + D.sec : s + ' ' + D.sec;
  }
  // Усі звуки/вібрація/реакції маскота — через Duo.signals.emit (signals.js); без модуля — тихий no-op
  function emit(name) { try { if (Duo.signals && typeof Duo.signals.emit === 'function') Duo.signals.emit(name); } catch (e) { /* сигнали необов'язкові */ } }
  function mo(name) { return Duo.motion && typeof Duo.motion[name] === 'function' ? Duo.motion[name] : null; }
  function call(name, a, b, c) { var f = mo(name); return f ? f(a, b, c) : Promise.resolve(); }
  function reduced() { return !!(Duo.env && Duo.env.reducedMotion); }
  function qs(name) {
    try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
  }
  function go(url) { location.href = url; }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('load ' + src)); };
      document.head.appendChild(s);
    });
  }
  function loadLesson(n) {
    var L = window.DUO_LESSONS && window.DUO_LESSONS[n];
    if (L) return Promise.resolve(L);
    return loadScript('data/duo-u' + (n < 10 ? '0' : '') + n + '.js').then(function () {
      var d = window.DUO_LESSONS && window.DUO_LESSONS[n];
      if (!d) throw new Error('no data ' + n);
      return d;
    });
  }
  function findNode(data, nodeId) {
    var nodes = (data && data.nodes) || [];
    for (var i = 0; i < nodes.length; i++) if (nodes[i].id === nodeId) return nodes[i];
    return null;
  }

  /* --------------------------------------------------------------------- */
  /* Стан і DOM                                                             */
  /* --------------------------------------------------------------------- */
  var root, S = null, ui = {};
  var COMBO_FROM = 3, PEEK_EVERY = 5;

  function init() {
    root = document.getElementById('duo-lesson');
    if (!root) return;
    if (Duo.exercises) Duo.exercises.labels = FALLBACK_COPY.ex;
    var mode = qs('mode'), n = qs('n');
    if (mode === 'mistakes') return startMistakes();
    if (mode === 'sos') return startSos();
    if (/^c\d+$/.test(n || '')) return startChest(n);
    if (/^b\d+$/.test(n || '')) return startBoss(n);
    var m = /^u(\d\d)-(\d+)$/.exec(n || '');
    if (!m) return fail(FALLBACK_COPY.errors.missing);
    loadLesson(Number(m[1])).then(function (data) {
      var node = findNode(data, n);
      if (!node) return fail(FALLBACK_COPY.errors.missing);
      start({ id: n, lesson: Number(m[1]), title: node.title, steps: node.steps, mode: 'node' });
    }, function () { fail(FALLBACK_COPY.errors.load, true); });
  }

  function fail(text, retry) {
    root.setAttribute('data-state', 'error');
    root.innerHTML = '<div class="dl-msg"><div role="alert"><h1 class="dl-msg__text"></h1></div><div class="dl-msg__actions"></div></div>';
    root.querySelector('.dl-msg__text').textContent = text;
    var box = root.querySelector('.dl-msg__actions');
    if (retry) {
      var r = Duo.ui ? Duo.ui.button(B.cont, { kind: 'primary', size: 'lg' }) : el('button');
      r.classList.add('d-btn--block');
      r.querySelector('.d-btn__label').textContent = 'Спробувати ще раз';
      r.addEventListener('click', function () { location.reload(); });
      box.appendChild(r);
    }
    var a = el('a', 'd-btn d-btn--secondary d-btn--lg d-btn--block');
    a.href = 'index.html'; a.textContent = B.toPath;
    box.appendChild(a);
  }

  function startMistakes() {
    var list = (Duo.progress && Duo.progress.mistakes && Duo.progress.mistakes()) || [];
    list = list.slice(0, 10);
    if (!list.length) return fail(FALLBACK_COPY.errors.noMistakes);
    var lessons = {};
    list.forEach(function (m) { lessons[m.lesson] = 1; });
    Promise.all(Object.keys(lessons).map(function (k) { return loadLesson(Number(k)); })).then(function () {
      var steps = [];
      list.forEach(function (m) {
        var d = window.DUO_LESSONS[m.lesson], node = d && findNode(d, m.nodeId);
        var st = node && node.steps.filter(function (s) { return s.id === m.stepId; })[0];
        if (st && st.type !== 'theory') steps.push(st);
      });
      if (!steps.length) return fail(FALLBACK_COPY.errors.noMistakes);
      start({ id: 'mistakes', lesson: 0, title: FALLBACK_COPY.mistakesMode.title, steps: steps, mode: 'mistakes' });
    }, function () { fail(FALLBACK_COPY.errors.load, true); });
  }

  /* ---------------- курс: вузли, пул кроків для SOS і боса ---------------- */
  function courseData() { return window.DUO_COURSE || { units: [], lessons: {} }; }
  function isDone(id) { return !!(Duo.progress && Duo.progress.isDone && Duo.progress.isDone(id)); }
  function lessonOf(nodeId) { var m = /^u(\d\d)-/.exec(nodeId); return m ? Number(m[1]) : 0; }
  function shuffleList(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function allNodeIds() {
    var ids = [];
    courseData().units.forEach(function (u) { u.items.forEach(function (it) { if (it.kind === 'node') ids.push(it.id); }); });
    return ids;
  }
  function nodeTitle(id) {
    var t = '';
    courseData().units.forEach(function (u) { u.items.forEach(function (it) { if (it.id === id) t = it.title || ''; }); });
    return t;
  }
  function loadLessonsFor(ids) {
    var seen = {}, list = [];
    ids.forEach(function (id) { var n = lessonOf(id); if (n && !seen[n]) { seen[n] = 1; list.push(loadLesson(n)); } });
    return Promise.all(list);
  }
  // записи черги { step, attempts, meta } із вузлів ids, відфільтровані за типом
  function collectEntries(ids, typeOk) {
    var out = [];
    ids.forEach(function (id) {
      var n = lessonOf(id), d = window.DUO_LESSONS && window.DUO_LESSONS[n], node = d && findNode(d, id);
      if (node) node.steps.forEach(function (st) { if (typeOk(st.type)) out.push({ step: st, attempts: 0, meta: { lesson: n, node: id } }); });
    });
    return out;
  }
  function findItem(id) {
    var found = null;
    courseData().units.forEach(function (u) { u.items.forEach(function (it) { if (it.id === id) found = { item: it, unit: u }; }); });
    return found;
  }

  function startSos() {
    var all = allNodeIds(), done = all.filter(isDone), ids = done.length ? done : all;
    loadLessonsFor(ids).then(function () {
      var theory = shuffleList(collectEntries(ids, function (t) { return t === 'theory'; })).slice(0, 8);
      var qs = shuffleList(collectEntries(ids, function (t) { return t === 'truefalse' || t === 'choice'; })).slice(0, 4);
      if (!theory.length && !qs.length) return fail(FALLBACK_COPY.errors.missing);
      start({ id: 'sos', lesson: 0, title: FALLBACK_COPY.sos.title, entries: theory.concat(qs), mode: 'sos' });
    }, function () { fail(FALLBACK_COPY.errors.load, true); });
  }

  function startBoss(id) {
    var f = findItem(id);
    if (!f || f.item.kind !== 'boss') return fail(FALLBACK_COPY.errors.missing);
    var lessons = f.item.lessons || f.unit.lessons || [], course = courseData(), all = [];
    lessons.forEach(function (n) { var L = course.lessons && course.lessons[n]; if (L) all = all.concat(L.nodes); });
    var okType = function (t) { return t === 'choice' || t === 'truefalse' || t === 'fill' || t === 'build'; };
    loadLessonsFor(all).then(function () {
      var pool = collectEntries(all.filter(isDone), okType);
      if (pool.length < 8) pool = collectEntries(all, okType);
      var entries = shuffleList(pool).slice(0, 8);
      if (!entries.length) return fail(FALLBACK_COPY.errors.missing);
      start({ id: id, lesson: 0, title: f.item.title || '', entries: entries, mode: 'boss' });
    }, function () { fail(FALLBACK_COPY.errors.load, true); });
  }

  function startChest(id) {
    var f = findItem(id);
    if (!f || f.item.kind !== 'chest') return fail(FALLBACK_COPY.errors.missing);
    if (!isDone(f.item.after)) return fail(FALLBACK_COPY.chest.locked.replace('{t}', nodeTitle(f.item.after)));
    var C = FALLBACK_COPY.chest, r = { xp: 0, already: false };
    try { if (Duo.progress && Duo.progress.openChest) r = Duo.progress.openChest(id); } catch (e) { if (window.console) console.error(e); }
    // блок = вузли юніта до сундука включно
    var ids = [];
    for (var i = 0; i < f.unit.items.length; i++) {
      var it = f.unit.items[i];
      if (it.kind === 'node') ids.push(it.id);
      if (it.id === f.item.after) break;
    }
    var n = ids.filter(isDone).length;
    if (!r.already) emit('node_complete');
    showSimple({
      title: r.already ? C.already : C.opened, sub: C.sub, medal: 'chest',
      cards: [
        { cls: 'xp', label: C.reward, value: '<span data-xp>0</span>', unit: 'XP' },
        { cls: 'success', label: C.nodes, value: n + ' з ' + ids.length }
      ],
      countXp: r.xp, note: r.already ? C.alreadyText : '', primary: C.take, dest: 'index.html'
    });
  }

  function start(node) {
    var entries = node.entries || (node.steps || []).map(function (s) { return { step: s, attempts: 0 }; });
    var ex = entries.filter(function (e) { return e.step.type !== 'theory'; }).length;
    S = {
      node: node, mode: node.mode, practice: node.mode === 'mistakes',
      free: node.mode === 'mistakes' || node.mode === 'sos',          // без сердець і запису помилок
      noRequeue: node.mode === 'sos' || node.mode === 'boss',         // помилка не повертається в чергу
      queue: entries,
      total: entries.length, solved: 0, solvedIds: {}, exTotal: ex,
      correct: 0, mistakes: 0, builds: 0, combo: 0, bestCombo: 0, startedAt: Date.now(),
      phase: 'answer', entry: null, inst: null, lastResult: null, dead: false, busy: false
    };
    Duo.lesson = Duo.lesson || {};
    Duo.lesson.state = S;
    buildChrome();
    heartsGate(next);
  }

  function buildChrome() {
    root.setAttribute('data-state', 'play');
    root.innerHTML =
      '<header class="dl-top"><div class="dl-top__in">' +
        '<button type="button" class="dl-close" aria-label="' + esc(B.close) + '">' + icon('close', 22) + '</button>' +
        '<div class="d-progress dl-progress" role="progressbar" aria-label="' + esc(FALLBACK_COPY.aria.progress) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
          '<div class="d-progress__track"><div class="d-progress__fill" style="transform:scaleX(0)"><span class="d-progress__shine"></span></div></div></div>' +
        '<div class="dl-hearts" role="img"><span class="dl-hearts__icon">' + icon('heart', 26) + '</span><span class="dl-hearts__n"></span></div>' +
        (Duo.signals && typeof Duo.signals.mountSettings === 'function' ? '<button type="button" class="dl-gear" aria-label="' + esc(FALLBACK_COPY.settings.label) + '">' + icon('gear', 22) + '</button>' : '') +
      '</div><div class="dl-combo-wrap"><div class="dl-combo d-badge d-badge--streak" hidden aria-hidden="true"></div></div></header>' +
      '<div class="dl-stage"><div class="dl-stage__in"><section class="dl-card" tabindex="-1" role="group"></section></div></div>' +
      '<footer class="dl-foot"><div class="dl-foot__in">' +
        '<div class="dl-foot__check"><button type="button" class="d-btn d-btn--primary d-btn--lg d-btn--block dl-primary is-disabled" aria-disabled="true"><span class="d-btn__label">' + esc(B.check) + '</span></button></div>' +
        '<div class="dl-sheet" hidden></div>' +
      '</div></footer>' +
      '<div class="sr-only dl-live" aria-live="assertive" aria-atomic="true"></div>';
    ui = {
      close: root.querySelector('.dl-close'), settings: root.querySelector('.dl-gear'), progress: root.querySelector('.dl-progress'), fill: root.querySelector('.d-progress__fill'),
      hearts: root.querySelector('.dl-hearts'), heartIcon: root.querySelector('.dl-hearts__icon'), heartN: root.querySelector('.dl-hearts__n'),
      combo: root.querySelector('.dl-combo'), card: root.querySelector('.dl-card'), foot: root.querySelector('.dl-foot'),
      checkRow: root.querySelector('.dl-foot__check'), primary: root.querySelector('.dl-primary'), sheet: root.querySelector('.dl-sheet'),
      live: root.querySelector('.dl-live')
    };
    ui.primary.addEventListener('click', onPrimary);
    ui.close.addEventListener('click', function () { call('pressDown', ui.close); openExit(); });
    if (ui.settings) ui.settings.addEventListener('click', openSettings);
    renderHearts(false);
    hook();
  }

  var hooked = false;
  function hook() {
    if (hooked) return; hooked = true;
    document.addEventListener('keydown', onKey);
  }

  /* --------------------------------------------------------------------- */
  /* Серця, прогрес, комбо                                                  */
  /* --------------------------------------------------------------------- */
  function heartsNow() {
    var h = Duo.progress && Duo.progress.hearts ? Duo.progress.hearts() : { n: 5, max: 5 };
    return h;
  }
  function renderHearts(animateLoss) {
    if (!ui.hearts) return;
    var h = heartsNow();
    ui.heartN.textContent = String(h.n);
    ui.hearts.setAttribute('aria-label', FALLBACK_COPY.aria.heartsOf + ': ' + h.n + ' ' + FALLBACK_COPY.aria.of + ' ' + h.max);
    ui.hearts.classList.toggle('is-empty', h.n === 0);
    if (animateLoss) call('heartBreak', ui.heartIcon, { empty: h.n === 0 });
    else if (h.n > 0 && ui.heartIcon) ui.heartIcon.style.opacity = '';
  }
  function setProgress(animate) {
    var to = S.total ? Math.min(1, S.solved / S.total) : 0, from = S.frac || 0;
    S.frac = to;
    ui.progress.setAttribute('aria-valuenow', String(Math.round(to * 100)));
    if (animate && mo('springGrow')) mo('springGrow')(ui.fill, from, to);
    else ui.fill.style.transform = 'scaleX(' + to + ')';
  }
  function setCombo(n) {
    var on = n >= COMBO_FROM;
    ui.progress.classList.toggle('is-combo', on);
    if (!on) {
      if (!ui.combo.hidden) { ui.combo.hidden = true; }
      return;
    }
    var wasHidden = ui.combo.hidden;
    ui.combo.innerHTML = icon('flame', 14) + '<span>' + esc(comboText(n)) + '</span>';
    ui.combo.hidden = false;
    if (wasHidden) call('popIn', ui.combo); else call('pulse', ui.combo);
    if (n % PEEK_EVERY === 0 && Duo.mascot && typeof Duo.mascot.peek === 'function') {
      try { Duo.mascot.peek({ side: 'right', text: comboText(n), emotion: 'excited', ms: 2200 }); } catch (e) { /* */ }
    }
  }
  function announce(text) {
    if (!ui.live) return;
    ui.live.textContent = '';
    setTimeout(function () { if (ui.live) ui.live.textContent = text; }, 40);
  }

  /* --------------------------------------------------------------------- */
  /* Крок: рендер, перевірка, лист-результат                                */
  /* --------------------------------------------------------------------- */
  var api = {
    changed: function () { updatePrimary(); },
    emit: emit,
    requestCheck: function () { if (S && S.phase === 'answer' && !S.busy) onPrimary(); }
  };

  function next() {
    if (!S || S.dead) return;
    if (!S.queue.length) return finish();
    renderStep(S.queue.shift());
  }

  function renderStep(entry) {
    S.entry = entry; S.phase = 'answer'; S.busy = false; S.lastResult = null;
    var card = ui.card, step = entry.step;
    if (S.inst && typeof S.inst.destroy === 'function') { try { S.inst.destroy(); } catch (e) { /* зупиняємо анімації попереднього кроку */ } }
    card.innerHTML = ''; card.className = 'dl-card';
    card.removeAttribute('aria-labelledby');
    card.setAttribute('data-type', step.type);
    try {
      S.inst = Duo.exercises.create(step, card, api);
    } catch (err) {
      if (window.console) console.error('[Duo.lesson] крок ' + step.id + ' не відрендерився:', err);
      S.inst = null;
      markSolved(step.id); // не блокуємо урок через зламаний крок
      return next();
    }
    hideSheet();
    updatePrimary();
    call('fadeIn', card);
    focusStep();
    card.scrollTop = 0;
    var stage = root.querySelector('.dl-stage'); if (stage) stage.scrollTop = 0;
    syncScrollers();
  }

  // Фокус на заголовку кроку (h1 із tabindex=-1): скринридер читає питання, Tab веде до варіантів
  function focusStep() {
    var h = ui.card && ui.card.querySelector('.dl-prompt');
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } else if (ui.card) ui.card.focus({ preventScroll: true });
  }
  // Прокручувана зона без жодного елемента, що отримує фокус (після перевірки плитки/варіанти вимкнені), недосяжна з клавіатури:
  // тоді сама зона стає фокусованою (WCAG 2.1.1)
  function syncScrollers() {
    var list = [[root.querySelector('.dl-stage'), FALLBACK_COPY.aria.stage], [root.querySelector('.dl-sheet__row'), null]];
    list.forEach(function (p) {
      var e = p[0]; if (!e) return;
      var need = e.scrollHeight > e.clientHeight + 1 && !e.querySelector('button:not([disabled]):not([tabindex="-1"]), a[href], input:not([disabled]), [tabindex="0"]');
      if (need) { e.tabIndex = 0; if (p[1]) { e.setAttribute('role', 'region'); e.setAttribute('aria-label', p[1]); } }
      else { e.removeAttribute('tabindex'); if (p[1]) { e.removeAttribute('role'); e.removeAttribute('aria-label'); } }
    });
  }
  window.addEventListener('resize', function () { if (S && ui.card && S.phase !== 'done') syncScrollers(); });
  // Duo.ui.sheet (core.js) не дає діалогу назви: беремо заголовок листа
  var sheetUid = 0;
  function nameSheet(sh) {
    try {
      var h = sh && sh.el && sh.el.querySelector('.dl-sheet-title');
      if (h) { if (!h.id) h.id = 'dl-sheet-t' + (++sheetUid); sh.el.setAttribute('aria-labelledby', h.id); }
    } catch (e) { /* назва необов'язкова */ }
    return sh;
  }

  function updatePrimary() {
    if (!S || !S.inst || S.phase !== 'answer') return;
    var info = !!S.inst.info, ok = S.inst.canCheck();
    ui.primary.className = 'd-btn d-btn--primary d-btn--lg d-btn--block dl-primary' + (ok ? '' : ' is-disabled');
    ui.primary.setAttribute('aria-disabled', ok ? 'false' : 'true');
    ui.primary.querySelector('.d-btn__label').textContent = info ? B.next : B.check;
  }

  function markSolved(stepId) {
    if (S.solvedIds[stepId]) return;
    S.solvedIds[stepId] = 1; S.solved++;
    setProgress(true);
  }

  function onPrimary() {
    if (!S || S.busy || S.dead) return;
    if (S.phase === 'feedback') return afterFeedback();
    if (S.phase !== 'answer' || !S.inst || !S.inst.canCheck()) return;
    call('pressDown', ui.primary);
    if (S.inst.info) {
      markSolved(S.entry.step.id);
      return next();
    }
    S.busy = true;
    var res;
    try { res = S.inst.check(); } catch (err) { if (window.console) console.error(err); S.busy = false; return; }
    S.phase = 'feedback'; S.lastResult = res; S.busy = false;
    if (res.correct) onCorrect(res); else onWrong(res);
  }

  function onCorrect(res) {
    var entry = S.entry, first = entry.attempts === 0;
    S.combo++; S.bestCombo = Math.max(S.bestCombo, S.combo);
    if (first) {
      S.correct++;
      if (entry.step.type === 'build') S.builds++;
      if (S.practice && Duo.progress && Duo.progress.resolveMistake) Duo.progress.resolveMistake(entry.step.id);
    }
    markSolved(entry.step.id);
    emit('correct');
    if (S.combo >= COMBO_FROM) setTimeout(function () { emit('streak'); }, 140);
    setCombo(S.combo);
    var title = praise();
    showSheet('ok', title, res);
    announce(FALLBACK_COPY.aria.right + ' ' + title + (S.combo >= COMBO_FROM ? ' ' + comboText(S.combo) : ''));
  }

  function onWrong(res) {
    var entry = S.entry, step = entry.step;
    S.combo = 0; setCombo(0);
    S.mistakes++;
    if (!S.noRequeue) S.queue.push({ step: step, attempts: entry.attempts + 1, meta: entry.meta }); // повтор у кінці черги
    if (!S.free && Duo.progress) {
      try {
        var mt = entry.meta || { lesson: S.node.lesson, node: S.node.id };
        Duo.progress.recordMistake({ lesson: mt.lesson, stepId: step.id, nodeId: mt.node });
        Duo.progress.loseHeart();
      } catch (e) { /* прогрес необов'язковий для проходження */ }
      renderHearts(true);
      setTimeout(function () { emit('heart_lost'); }, 220);
    }
    emit('wrong');
    var title = wrongTitle();
    showSheet('bad', title, res);
    announce(FALLBACK_COPY.aria.wrong + ' ' + (res.answer ? FALLBACK_COPY.correctAnswer + ' ' + res.answer : ''));
  }

  function showSheet(kind, title, res) {
    var why = (S.entry.step.why) || res.why || '';
    var h = '<div class="dl-sheet__row"><span class="dl-sheet__icon" aria-hidden="true">' + icon(kind === 'ok' ? 'check' : 'close', 22) + '</span>' +
      '<div class="dl-sheet__body"><p class="dl-sheet__title" id="dl-sheet-t-res">' + esc(title) + '</p>';
    if (kind === 'bad') {
      if (res.answerList) {
        h += '<p class="dl-sheet__label">' + esc(res.answerLabel || FALLBACK_COPY.correctAnswer) + '</p><ol class="dl-sheet__list">' +
          res.answerList.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>';
      } else if (res.answer) {
        h += '<p class="dl-sheet__label">' + esc(res.answerLabel || FALLBACK_COPY.correctAnswer) + '</p><p class="dl-sheet__answer">' + esc(res.answer) + '</p>';
      }
      if (res.note) h += '<p class="dl-sheet__why">' + esc(res.note) + '</p>';
    }
    if (why) h += '<p class="dl-sheet__why">' + esc(why) + '</p>';
    h += '</div></div><button type="button" class="d-btn d-btn--lg d-btn--block ' + (kind === 'ok' ? 'd-btn--success' : 'd-btn--secondary') + ' dl-next"><span class="d-btn__label">' +
      esc(kind === 'ok' ? B.next : B.gotIt) + '</span></button>';
    ui.sheet.innerHTML = h;
    ui.sheet.className = 'dl-sheet dl-sheet--' + kind;
    ui.sheet.setAttribute('role', 'group'); ui.sheet.setAttribute('aria-labelledby', 'dl-sheet-t-res');
    ui.sheet.hidden = false;
    ui.checkRow.hidden = true;
    ui.foot.className = 'dl-foot is-' + kind;
    var nx = ui.sheet.querySelector('.dl-next');
    nx.addEventListener('click', onPrimary);
    call('sheetUp', ui.sheet);
    var ic = ui.sheet.querySelector('.dl-sheet__icon'); if (ic) call('popIn', ic);
    nx.focus({ preventScroll: true });
    var stage = root.querySelector('.dl-stage');
    if (stage && stage.scrollHeight > stage.clientHeight) { /* лист зменшив сцену: утримуємо відповідь у полі зору */ stage.scrollTop = stage.scrollTop; }
    syncScrollers();
  }
  function hideSheet() {
    ui.sheet.hidden = true; ui.sheet.innerHTML = ''; ui.checkRow.hidden = false;
    ui.sheet.removeAttribute('role'); ui.sheet.removeAttribute('aria-labelledby');
    ui.foot.className = 'dl-foot';
  }

  function afterFeedback() {
    var wasWrong = S.lastResult && !S.lastResult.correct;
    S.busy = true;
    hideSheet();
    var cont = function () { S.busy = false; next(); };
    if (wasWrong && !S.free && heartsNow().n === 0) heartsGate(cont); else cont();
  }

  /* --------------------------------------------------------------------- */
  /* Листи: вихід, серця закінчились                                        */
  /* --------------------------------------------------------------------- */
  function mascotBlock(emotion, size) {
    if (!Duo.mascot || typeof Duo.mascot.svg !== 'function') return '';
    try { return '<div class="dl-sheet-mascot" aria-hidden="true">' + Duo.mascot.svg(emotion, { size: size || 88 }) + '</div>'; } catch (e) { return ''; }
  }
  function dialogOpen() { return !!document.querySelector('.d-sheet, .d-modal'); }

  function openExit() {
    if (!S || S.dead || dialogOpen() || !Duo.ui) { if (!Duo.ui) go('index.html'); return; }
    var E = FALLBACK_COPY.exit;
    var sh = Duo.ui.sheet({
      tone: 'neutral',
      html: mascotBlock('sad') + '<h2 class="dl-sheet-title">' + esc(E.title) + '</h2><p class="dl-sheet-text">' + esc(E.text) + '</p>',
      actions: [
        { label: B.stay, kind: 'primary' },
        { label: B.leave, kind: 'ghost', onClick: function () { S.dead = true; go(S.practice ? 'praktyka.html' : 'index.html'); } }
      ],
      dismissible: true,
      // фокус повертається на хрестик (це робить Duo.ui.sheet); у вправу — лише якщо фокус загубився
      onClose: function () { if (S && !S.dead && S.phase === 'answer' && S.inst && (!document.activeElement || document.activeElement === document.body)) focusStep(); }
    });
    nameSheet(sh);
  }

  function openSettings() {
    if (!S || S.dead || dialogOpen() || !Duo.ui || !Duo.signals || !Duo.signals.mountSettings) return;
    var T = FALLBACK_COPY.settings;
    var sh = Duo.ui.sheet({
      tone: 'neutral',
      html: '<h2 class="dl-sheet-title">' + esc(T.title) + '</h2><p class="dl-sheet-text">' + esc(T.text) + '</p><div class="dl-settings"></div>',
      actions: [{ label: T.done, kind: 'primary' }],
      dismissible: true
    });
    nameSheet(sh);
    Duo.signals.mountSettings(sh.el.querySelector('.dl-settings'));
  }

  function heartsGate(cont) {
    if (S.free || heartsNow().n > 0 || !Duo.ui) return cont();
    var H = FALLBACK_COPY.heartsEmpty, refilled = false;
    nameSheet(Duo.ui.sheet({
      tone: 'error',
      html: mascotBlock('sad') + '<h2 class="dl-sheet-title">' + esc(H.title) + '</h2><p class="dl-sheet-text">' + esc(H.text) + '</p>',
      actions: [
        { label: B.refill, kind: 'primary', onClick: function () { refilled = true; if (Duo.progress && Duo.progress.refillHearts) Duo.progress.refillHearts(); renderHearts(false); } },
        { label: B.leave, kind: 'ghost', onClick: function () { S.dead = true; go('index.html'); } }
      ],
      dismissible: false,
      onClose: function () { if (refilled) cont(); }
    }));
  }

  /* --------------------------------------------------------------------- */
  /* Клавіатура: Enter — головна дія, цифри — варіанти, Esc — вихід          */
  /* --------------------------------------------------------------------- */
  function onKey(e) {
    if (!S || S.dead || e.altKey || e.ctrlKey || e.metaKey) return;
    if (dialogOpen()) return;
    var t = e.target, k = e.key;
    if (k === 'Escape') { if (S.phase !== 'done') { e.preventDefault(); openExit(); } return; }
    if (S.phase === 'done') return;
    if (k === 'Enter') {
      if (e.repeat) return;
      if (t && t.closest && t.closest('.dl-foot, .dl-top')) return; // кнопки панелі спрацьовують самі
      if (S.phase === 'feedback') { e.preventDefault(); onPrimary(); return; }
      if (S.phase === 'answer' && S.inst && S.inst.canCheck() && S.inst.enterChecks(t)) { e.preventDefault(); onPrimary(); }
      return;
    }
    if (/^[1-9]$/.test(k) && S.phase === 'answer' && S.inst && !(t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) {
      S.inst.key(Number(k));
    }
  }

  /* --------------------------------------------------------------------- */
  /* Кінець вузла: completeNode → екран підсумку → черга святкувань         */
  /* --------------------------------------------------------------------- */
  function finish() {
    S.phase = 'done'; S.dead = false;
    if (S.mode === 'sos') return finishSos();
    var ms = Date.now() - S.startedAt;
    var payload = { correct: S.correct, total: S.exTotal, mistakes: S.mistakes, ms: ms, perfect: S.mistakes === 0, builds: S.builds };
    if (S.practice) payload.kind = 'practice';
    if (S.mode === 'boss') {
      payload.kind = 'boss';
      var need = Math.ceil(0.8 * S.exTotal);
      if (S.correct < need) return finishBossFail(need);
    }
    var res = null;
    try { if (Duo.progress && Duo.progress.completeNode) res = Duo.progress.completeNode(S.node.id, payload); } catch (err) { if (window.console) console.error(err); }
    if (!res) {
      var acc = S.exTotal ? Math.round(100 * S.correct / S.exTotal) : 100;
      res = { xp: 0, xpBreakdown: [], accuracy: acc, streak: { before: 0, after: 0 }, goal: {}, quests: [], achievements: [], nextNodeId: null, firstToday: false };
    }
    emit('node_complete');
    if (S.mode === 'node') {
      var L = courseData().lessons && courseData().lessons[S.node.lesson];
      if (L && L.nodes.every(isDone)) emit('lesson_complete');
    }
    showDone(res, payload);
  }

  function finishSos() {
    var T = FALLBACK_COPY.sos, theory = S.total - S.exTotal;
    emit('node_complete');
    showSimple({
      title: T.done, sub: T.sub, medal: 'book',
      cards: [
        { cls: 'xp', label: T.cards, value: String(theory) },
        { cls: 'success', label: T.answers, value: S.correct + ' з ' + S.exTotal }
      ],
      note: T.note, primary: B.toPath, dest: 'index.html'
    });
  }

  function finishBossFail(need) {
    var T = FALLBACK_COPY.boss;
    showSimple({
      title: T.retry, sub: S.node.title, medal: 'target',
      cards: [{ cls: 'neutral', label: T.got, value: S.correct + ' з ' + S.exTotal }],
      note: T.retryText.replace('{n}', String(need)).replace('{t}', String(S.exTotal)),
      primary: T.again, reload: true, secondary: { label: B.toPath, href: 'index.html' }
    });
  }

  // Простий екран підсумку без completeNode: SOS, сундук, «Ще раз» боса
  function showSimple(o) {
    root.setAttribute('data-state', 'done');
    var cards = o.cards.map(function (c) {
      return '<div class="d-card d-stat d-stat--' + c.cls + ' dl-stat"><div class="d-stat__label">' + esc(c.label) + '</div><div class="d-stat__value">' + c.value + '</div>' +
        (c.unit ? '<div class="dl-stat__unit">' + esc(c.unit) + '</div>' : '') + '</div>';
    }).join('');
    root.innerHTML =
      '<section class="dl-done" aria-labelledby="dl-done-title"><div class="dl-done__hero">' +
        '<div class="dl-done__mascot"><span class="dl-done__medal" aria-hidden="true">' + icon(o.medal || 'trophy', 56) + '</span></div>' +
        '<h1 class="dl-done__title" id="dl-done-title" tabindex="-1">' + esc(o.title) + '</h1>' +
        '<p class="dl-done__sub">' + esc(o.sub || '') + '</p></div>' +
        '<div class="dl-done__stats dl-done__stats--' + o.cards.length + '">' + cards + '</div>' +
        (o.note ? '<p class="dl-done__meta">' + esc(o.note) + '</p>' : '') +
        '<div class="dl-done__actions"><button type="button" class="d-btn d-btn--primary d-btn--lg d-btn--block dl-continue"><span class="d-btn__label">' + esc(o.primary) + '</span></button>' +
        (o.secondary ? '<a class="d-btn d-btn--ghost d-btn--lg d-btn--block" href="' + esc(o.secondary.href) + '">' + esc(o.secondary.label) + '</a>' : '') + '</div></section>';
    var xpEl = root.querySelector('[data-xp]'), cardEls = Array.prototype.slice.call(root.querySelectorAll('.dl-stat'));
    if (xpEl) { if (mo('countUp')) call('countUp', xpEl, 0, o.countXp || 0); else xpEl.textContent = o.countXp || 0; }
    cardEls.forEach(function (c, i) { call('popIn', c, { delay: i * 120 }); });
    var t = root.querySelector('#dl-done-title'); if (t) t.focus({ preventScroll: true });
    var btn = root.querySelector('.dl-continue');
    btn.addEventListener('click', function () { if (o.reload) location.reload(); else go(o.dest); });
    root.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.repeat && e.target === t) { e.preventDefault(); btn.click(); } });
  }

  function enqueueCelebrations(res) {
    var C = Duo.celebrate;
    if (!C || typeof C.enqueue !== 'function') return Promise.resolve();
    try {
      // Підсумок уроку (XP, точність, серія) показує сам плеєр; тут — лише святкування за ARCHITECTURE §4.6
      if (res.firstToday) C.enqueue({ type: 'streak', data: res.streak });
      if (res.goal && res.goal.reachedNow) C.enqueue({ type: 'goal', data: res.goal });
      (res.quests || []).forEach(function (id) { C.enqueue({ type: 'quest', data: { id: id } }); });
      (res.achievements || []).forEach(function (a) { C.enqueue({ type: 'achievement', data: a }); });
      return typeof C.run === 'function' ? Promise.resolve(C.run()) : Promise.resolve();
    } catch (err) { return Promise.resolve(); }
  }

  function showDone(res, payload) {
    var D = FALLBACK_COPY.done, title = S.practice ? D.titlePractice : S.mode === 'boss' ? FALLBACK_COPY.boss.titleDone : D.title;
    var streakN = res.streak ? res.streak.after : 0;
    var kinds = (res.xpBreakdown || []).map(function (b) { return (D.xpKinds[b[0]] || b[0]) + ' +' + b[1]; }).join(' · ');
    root.setAttribute('data-state', 'done');
    root.innerHTML =
      '<section class="dl-done" aria-labelledby="dl-done-title">' +
        '<div class="dl-done__hero"><div class="dl-done__mascot">' + '<span class="dl-done__medal" aria-hidden="true">' + icon('trophy', 56) + '</span>' + '</div>' +
        '<h1 class="dl-done__title" id="dl-done-title" tabindex="-1">' + esc(title) + '</h1>' +
        '<p class="dl-done__sub">' + esc(S.node.title || '') + '</p></div>' +
        '<div class="dl-done__stats">' +
          '<div class="d-card d-stat d-stat--xp dl-stat"><div class="d-stat__label">' + esc(D.xp) + '</div><div class="d-stat__value"><span data-xp>0</span></div></div>' +
          '<div class="d-card d-stat d-stat--success dl-stat"><div class="d-stat__label">' + esc(D.accuracy) + '</div><div class="d-stat__value"><span data-acc>0</span>%</div></div>' +
          '<div class="d-card d-stat d-stat--streak dl-stat"><div class="d-stat__label">' + esc(D.streak) + '</div><div class="d-stat__value">' + streakN + '</div><div class="dl-stat__unit">' + esc(plural(streakN, D.daysOne, D.daysFew, D.daysMany)) + '</div></div>' +
        '</div>' +
        '<p class="dl-done__epithet">' + esc(epithet(res.accuracy)) + '</p>' +
        '<p class="dl-done__meta">' + esc(D.time) + ': ' + esc(fmtTime(payload.ms)) + ' · ' + esc(D.mistakes) + ': ' + payload.mistakes + (kinds ? '<br>' + esc(kinds) : '') + '</p>' +
        '<div class="dl-done__actions">' +
          '<button type="button" class="d-btn d-btn--primary d-btn--lg d-btn--block dl-continue"><span class="d-btn__label">' + esc(B.cont) + '</span><span class="d-btn__spinner"></span></button>' +
          (res.nextNodeId ? '<a class="d-btn d-btn--ghost d-btn--lg d-btn--block" href="index.html">' + esc(B.toPath) + '</a>' : '') +
        '</div>' +
      '</section><div class="sr-only dl-live" aria-live="polite"></div>';
    var cards = Array.prototype.slice.call(root.querySelectorAll('.dl-stat'));
    cards.forEach(function (c) { c.style.opacity = '0'; });
    var xpEl = root.querySelector('[data-xp]'), accEl = root.querySelector('[data-acc]');
    var btn = root.querySelector('.dl-continue');
    var mascot = root.querySelector('.dl-done__mascot');
    if (mascot && Duo.mascot) {
      try {
        if (typeof Duo.mascot.mount === 'function') {
          mascot.innerHTML = '';
          var mh = Duo.mascot.mount(mascot, { emotion: 'cheer', size: 128, idle: true });
          if (mh && mh.play) mh.play('jump');
        } else if (typeof Duo.mascot.svg === 'function') mascot.innerHTML = Duo.mascot.svg('cheer', { size: 128 });
      } catch (e) { /* маскот необов'язковий */ }
    }
    call('confetti', { ms: 1400 });
    var title1 = root.querySelector('#dl-done-title'); if (title1) title1.focus({ preventScroll: true });
    (mo('stagger') || function (els, fn) { els.forEach(fn); return Promise.resolve(); })(cards, function (c, i) {
      c.style.opacity = '';
      call('popIn', c);
      if (i === 0) call('countUp', xpEl, 0, res.xp);
      if (i === 1) call('countUp', accEl, 0, res.accuracy);
    }, 160);
    if (!mo('countUp')) { xpEl.textContent = res.xp; accEl.textContent = res.accuracy; }
    btn.addEventListener('click', function () {
      if (btn.classList.contains('is-loading')) return;
      btn.classList.add('is-loading');
      var dest = res.nextNodeId ? 'vprava.html?n=' + encodeURIComponent(res.nextNodeId) : (S.practice ? 'praktyka.html' : 'index.html');
      enqueueCelebrations(res).then(function () { go(dest); }, function () { go(dest); });
    });
    // у режимі підсумку Enter активує кнопку «Продовжити» (фокус на заголовку)
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.repeat && e.target === title1) { e.preventDefault(); btn.click(); }
    });
  }

  Duo.lesson = Duo.lesson || {};
  Duo.lesson.copy = FALLBACK_COPY;
  Duo.lesson.next = next; // для автотестів: показати наступний крок черги

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
