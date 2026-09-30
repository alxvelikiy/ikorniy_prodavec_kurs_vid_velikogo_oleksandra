/* Ikorka Duo — празднування (celebrate.js): черга повноекранних екранів після уроку, window.Duo.celebrate.
 * Контракт: docs/design/ARCHITECTURE.md §4.6.
 *   Duo.celebrate.enqueue({ type, data })  — type: streak | goal | quest | achievement | lessonComplete
 *   Duo.celebrate.run() → Promise          — показує екрани по одному (кожен чекає «Продовжити»), резолвить, коли черга порожня
 * Порядок: lessonComplete → streak → goal → quest → achievement (завдання одного уроку зливаються в один екран).
 * Не падає без Duo.mascot / Duo.signals / Duo.motion / Duo.progress. Esc екран не закриває (потрібна кнопка).
 * Також тримає назви завдань і досягнень: Duo.celebrate.copy (їх використовує meta.js).
 * Анімація — тільки transform/opacity; за «зменшити рух» екран з'являється одразу, без конфеті. */
(function () {
  'use strict';
  var W = window, doc = document, Duo = W.Duo = W.Duo || {};

  /* ---------------------------------------------------------------- */
  /* Тексти                                                            */
  /* ---------------------------------------------------------------- */
  var QUEST = {
    perfect:       { title: 'Пройди урок без помилок' },
    xp30:          { title: 'Набери 30 XP' },
    coach:         { title: 'Пройди бос-випробування' },
    coachOffline:  { title: 'Відпрацюй 3 заперечення' }
  };
  var ACH = {
    objections: { name: 'Майстер заперечень', what: 'Відпрацьовані заперечення' },
    streak:     { name: 'Вогняна серія',      what: 'Найдовша серія, днів' },
    perfect:    { name: 'Без жодної помилки', what: 'Уроки без помилок' },
    builder:    { name: 'Знавець скрипта',    what: 'Зібрані фрази скрипта' },
    boss:       { name: 'Легенда дзвінка',    what: 'Пройдені босі' },
    course:     { name: 'Крок за кроком',     what: 'Повністю пройдені уроки' }
  };
  var DAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];

  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    return b > 1 && b < 5 ? few : many;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safe(fn) { try { return fn(); } catch (e) { return undefined; } }
  function reduced() {
    var e = Duo.env;
    if (e && typeof e.reducedMotion === 'boolean') return e.reducedMotion;
    return !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function icon(name, size) {
    if (typeof Duo.icon === 'function') return Duo.icon(name, { size: size || 24 });
    return '';
  }
  var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

  var copy = {
    quest: function (id) { return (QUEST[id] || { title: 'Щоденне завдання' }).title; },
    achievement: function (id) { return ACH[id] || { name: 'Досягнення', what: 'Прогрес' }; },
    roman: function (n) { return ROMAN[n] || String(n); },
    plural: plural
  };

  /* ---------------------------------------------------------------- */
  /* Стилі (вбудовані: скрипт підключений і на сторінці плеєра)        */
  /* ---------------------------------------------------------------- */
  var CSS = [
    '.dcel{position:fixed;inset:0;z-index:var(--z-modal,500);background:var(--c-bg);color:var(--c-text);font-family:var(--font-ui,system-ui,sans-serif);display:flex;flex-direction:column;overflow-y:auto;padding:var(--s-5,24px) var(--s-4,16px) calc(var(--s-5,24px) + var(--safe-b,0px))}',
    '.dcel__in{margin:auto;width:100%;max-width:440px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:var(--s-4,16px)}',
    '.dcel__hero{display:flex;flex-direction:column;align-items:center;gap:var(--s-3,12px)}',
    '.dcel__mascot{min-height:128px;display:flex;align-items:center;justify-content:center}',
    '.dcel__title{margin:0;font-size:var(--fs-2xl,32px);line-height:var(--lh-tight,1.15);font-weight:var(--fw-black,900)}',
    '.dcel__title:focus{outline:none}',
    '.dcel__title:focus-visible{outline:var(--focus-ring-w,3px) solid var(--c-focus);outline-offset:var(--focus-ring-offset,2px);border-radius:var(--r-sm,8px)}',
    '.dcel__sub{margin:0;font-size:var(--fs-lg,19px);line-height:var(--lh-snug,1.3);color:var(--c-muted)}',
    '.dcel__big{display:inline-flex;align-items:center;justify-content:center;gap:var(--s-2,8px);font-size:var(--fs-display,40px);font-weight:var(--fw-black,900);line-height:1}',
    '.dcel--streak .dcel__big{color:var(--c-streak)}',
    '.dcel--goal .dcel__big{color:var(--c-xp)}',
    '.dcel__big .d-icon{width:48px;height:48px}',
    '.dcel__week{display:flex;gap:var(--s-2,8px);list-style:none;margin:0;padding:0;justify-content:center}',
    '.dcel__day{display:flex;flex-direction:column;align-items:center;gap:var(--s-1,4px);font-size:var(--fs-xs,12px);font-weight:var(--fw-xbold,800);color:var(--c-muted)}',
    '.dcel__dot{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--c-surface-2);border:var(--bw,2px) solid var(--c-line-shadow);color:var(--c-muted)}',
    '.dcel__dot .d-icon{width:18px;height:18px}',
    '.dcel__day.is-on .dcel__dot{background:var(--c-streak-soft);border-color:var(--c-streak);color:var(--c-streak-on-soft)}',
    '.dcel__day.is-today{color:var(--c-text)}',
    '.dcel__ring{position:relative;width:132px;height:132px;display:flex;align-items:center;justify-content:center}',
    '.dcel__ring svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}',
    '.dcel__ring .d-ring__track{stroke-width:12}',
    '.dcel__ring .d-ring__fill{stroke:var(--c-xp);stroke-width:12;transition:stroke-dashoffset var(--dur-celebrate,1200ms) var(--ease-out)}',
    '.dcel__ring b{position:relative;display:flex;flex-direction:column;align-items:center;font-size:var(--fs-xl,24px);font-weight:var(--fw-black,900);line-height:1.1}',
    '.dcel__ring small{font-size:var(--fs-sm,14px);font-weight:var(--fw-xbold,800);color:var(--c-muted)}',
    '.dcel__list{list-style:none;margin:0;padding:0;width:100%;display:flex;flex-direction:column;gap:var(--s-2,8px)}',
    '.dcel__item{display:flex;align-items:center;gap:var(--s-3,12px);padding:var(--s-3,12px) var(--s-4,16px);background:var(--c-surface);border:1px solid var(--c-line);border-radius:var(--r-lg,16px);text-align:left;font-weight:var(--fw-xbold,800)}',
    '.dcel__tick{flex:none;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--c-success);color:var(--c-text-inverse,#fff)}',
    '.dcel__tick .d-icon{width:18px;height:18px}',
    '.dcel__medal{width:112px;height:112px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--c-xp-soft);border:var(--bw,2px) solid var(--c-xp);color:var(--c-xp-on-soft)}',
    '.dcel__medal .d-icon{width:56px;height:56px}',
    '.dcel__lvl{display:inline-flex;padding:var(--s-1,4px) var(--s-3,12px);border-radius:var(--r-pill,999px);background:var(--c-xp-soft);color:var(--c-xp-on-soft);font-size:var(--fs-sm,14px);font-weight:var(--fw-xbold,800)}',
    '.dcel__cards{display:flex;gap:var(--s-3,12px);width:100%;justify-content:center}',
    '.dcel__cards .d-stat{flex:1}',
    '.dcel__act{width:100%;margin-top:var(--s-2,8px)}',
    '.dcel--goal .dcel__medal{background:var(--c-xp-soft)}',
    '@media (prefers-reduced-motion:no-preference){',
    '.dcel{animation:dcel-in var(--dur-base,250ms) var(--ease-out) both}',
    '.dcel__in>*{animation:dcel-up var(--dur-slow,400ms) var(--ease-out) both}',
    '.dcel__in>*:nth-child(2){animation-delay:80ms}.dcel__in>*:nth-child(3){animation-delay:160ms}.dcel__in>*:nth-child(4){animation-delay:240ms}',
    '.dcel__item{animation:dcel-up var(--dur-slow,400ms) var(--ease-out) both}',
    '.dcel__item:nth-child(2){animation-delay:120ms}.dcel__item:nth-child(3){animation-delay:240ms}',
    '}',
    '@keyframes dcel-in{from{opacity:0}to{opacity:1}}',
    '@keyframes dcel-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}',
    '@media (prefers-reduced-motion:reduce){.dcel__ring .d-ring__fill{transition:none}}'
  ].join('\n');
  var styled = false;
  function injectCss() {
    if (styled || !doc.head) return;
    styled = true;
    var s = doc.createElement('style');
    s.setAttribute('data-dcel', '');
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  /* ---------------------------------------------------------------- */
  /* Екрани: кожен повертає { emotion, sound, html, after(el) }        */
  /* ---------------------------------------------------------------- */
  var BTN = 'Продовжити';

  function screenStreak(d) {
    var n = Math.max(1, (d && d.after) || 1), before = d && d.before != null ? d.before : Math.max(0, n - 1);
    var st = Duo.progress && safe(function () { return Duo.progress.streak(); });
    var week = '';
    if (st && st.week) {
      week = '<ul class="dcel__week" aria-label="Цей тиждень">' + st.week.map(function (w, i) {
        var on = w.active, nm = DAYS[i];
        return '<li class="dcel__day' + (on ? ' is-on' : '') + (w.today ? ' is-today' : '') + '"><span class="dcel__dot">' + (on ? icon('check', 18) : '') + '</span><span aria-hidden="true">' + nm + '</span><span class="sr-only">' + nm + (on ? ', зараховано' : ', без занять') + (w.today ? ', сьогодні' : '') + '</span></li>';
      }).join('') + '</ul>';
    }
    return {
      cls: 'streak', emotion: 'excited', sound: 'streak',
      title: 'Серія: ' + n + ' ' + plural(n, 'день', 'дні', 'днів'),
      sub: n === 1 ? 'Перший день є. Повертайся завтра й продовжуй!' : 'Ти займаєшся щодня. Так тримати!',
      big: '<span class="dcel__big" aria-hidden="true">' + icon('flame', 48) + '<span data-count="' + n + '" data-from="' + before + '">' + n + '</span></span>',
      extra: week, confetti: n >= 7 || n === 3
    };
  }

  function screenGoal(d) {
    var target = (d && d.target) || 20, xp = d && d.after != null ? d.after : target;
    var C = 2 * Math.PI * 54;
    return {
      cls: 'goal', emotion: 'cheer', sound: 'goal',
      title: 'Ціль дня виконано!',
      sub: 'Сьогодні ' + xp + ' XP. Ціль була ' + target + ' XP.',
      big: '<div class="dcel__ring" aria-hidden="true"><svg viewBox="0 0 132 132"><circle class="d-ring__track" cx="66" cy="66" r="54"/><circle class="d-ring__fill" cx="66" cy="66" r="54" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + C.toFixed(1) + '" data-full="0"/></svg><b>' + Math.min(xp, target) + '<small>з ' + target + ' XP</small></b></div>',
      extra: '', confetti: true
    };
  }

  function screenQuest(items) {
    var list = items.map(function (it) { return it && it.id; }).filter(Boolean);
    var many = list.length > 1;
    return {
      cls: 'quest', emotion: 'happy', sound: 'quest',
      title: many ? 'Завдання виконано' : 'Завдання виконано!',
      sub: many ? 'Заглянь у вкладку «Завдання» по скриню.' : 'Так тримати. Скриня з XP чекає у вкладці «Завдання».',
      big: '<ul class="dcel__list">' + list.map(function (id) {
        return '<li class="dcel__item"><span class="dcel__tick">' + icon('check', 18) + '</span><span>' + esc(copy.quest(id)) + '</span></li>';
      }).join('') + '</ul>',
      extra: '', confetti: false
    };
  }

  function screenAchievement(d) {
    var id = d && d.id, lvl = (d && d.level) || 1, a = copy.achievement(id);
    var all = Duo.progress && safe(function () { return Duo.progress.achievements(); });
    var cur = all && all.filter(function (x) { return x.id === id; })[0];
    var line = cur && cur.next != null ? a.what + ': ' + cur.value + ' з ' + cur.next + ' до наступного рівня.' : (cur ? 'Найвищий рівень відкрито.' : '');
    return {
      cls: 'achievement', emotion: 'cheer', sound: 'achievement',
      title: 'Нове досягнення!',
      sub: a.name,
      big: '<div class="dcel__medal" aria-hidden="true">' + icon('medal', 56) + '</div><span class="dcel__lvl">Рівень ' + lvl + ' з 3</span>',
      extra: line ? '<p class="dcel__sub" style="font-size:var(--fs-md,16px)">' + esc(line) + '</p>' : '', confetti: true
    };
  }

  function screenLesson(d) {
    d = d || {};
    var cards = '';
    if (d.xp != null) cards += '<div class="d-card d-stat d-stat--xp"><div class="d-stat__label">XP</div><div class="d-stat__value">' + esc(d.xp) + '</div></div>';
    if (d.accuracy != null) cards += '<div class="d-card d-stat d-stat--success"><div class="d-stat__label">Точність</div><div class="d-stat__value">' + esc(d.accuracy) + '%</div></div>';
    return {
      cls: 'lesson', emotion: 'cheer', sound: 'lesson',
      title: 'Урок пройдено!', sub: d.title ? String(d.title) : 'Гарна робота.',
      big: cards ? '<div class="dcel__cards">' + cards + '</div>' : '', extra: '', confetti: true
    };
  }

  var BUILD = { streak: screenStreak, goal: screenGoal, quest: screenQuest, achievement: screenAchievement, lessonComplete: screenLesson };

  /* звук і вібрація через Duo.signals (є події streak, node_complete); інших дзвінків напряму не робимо */
  function signal(kind) {
    var S = Duo.signals;
    if (!S || typeof S.emit !== 'function') return;
    var name = kind === 'streak' ? 'streak' : kind === 'lesson' ? 'lesson_complete' : 'node_complete';
    if (S.names && S.names.indexOf(kind) >= 0) name = kind;
    safe(function () { S.emit(name); });
  }

  /* ---------------------------------------------------------------- */
  /* Черга                                                             */
  /* ---------------------------------------------------------------- */
  var ORDER = { lessonComplete: 0, streak: 1, goal: 2, quest: 3, achievement: 4 };
  var queue = [], running = null, current = null, seq = 0;

  function enqueue(item) {
    if (!item || !BUILD[item.type]) return false;
    queue.push({ type: item.type, data: item.data, seq: seq++ });
    queue.sort(function (a, b) { return (ORDER[a.type] - ORDER[b.type]) || (a.seq - b.seq); });
    return true;
  }

  function takeNext() {
    if (!queue.length) return null;
    var first = queue.shift();
    if (first.type === 'quest') { // усі завдання одного уроку — одним екраном
      var items = [first.data];
      queue = queue.filter(function (q) { if (q.type === 'quest') { items.push(q.data); return false; } return true; });
      return { type: 'quest', data: items };
    }
    return first;
  }

  function show(item) {
    return new Promise(function (resolve) {
      injectCss();
      var spec = BUILD[item.type](item.data);
      var prevFocus = doc.activeElement;
      var el = doc.createElement('div');
      el.className = 'dcel dcel--' + spec.cls;
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-labelledby', 'dcel-title');
      el.innerHTML =
        '<div class="dcel__in">' +
          '<div class="dcel__hero"><div class="dcel__mascot" aria-hidden="true"></div>' +
          '<h2 class="dcel__title" id="dcel-title" tabindex="-1">' + esc(spec.title) + '</h2>' +
          (spec.sub ? '<p class="dcel__sub">' + esc(spec.sub) + '</p>' : '') + '</div>' +
          (spec.big || '') + (spec.extra || '') +
          '<button type="button" class="d-btn d-btn--primary d-btn--lg d-btn--block dcel__act"><span class="d-btn__label">' + BTN + '</span></button>' +
        '</div>' +
        '<div class="sr-only" aria-live="polite" role="status"></div>';
      var title = el.querySelector('#dcel-title'), btn = el.querySelector('.dcel__act'), live = el.querySelector('[aria-live]');
      var mascotBox = el.querySelector('.dcel__mascot'), mh = null, inerted = [], done = false;

      // решта сторінки недоступна для читалки і Tab, поки є екран
      Array.prototype.forEach.call(doc.body.children, function (c) {
        if (c.tagName === 'SCRIPT' || c.tagName === 'STYLE' || c.hasAttribute('inert')) return;
        c.setAttribute('inert', ''); inerted.push(c);
      });
      doc.body.appendChild(el);
      var savedOv = doc.documentElement.style.overflow; doc.documentElement.style.overflow = 'hidden';

      if (Duo.mascot && mascotBox) {
        safe(function () {
          if (typeof Duo.mascot.mount === 'function') {
            mh = Duo.mascot.mount(mascotBox, { emotion: spec.emotion, size: 128, idle: false, react: false });
            if (mh && mh.play) mh.play('jump');
          } else if (typeof Duo.mascot.svg === 'function') mascotBox.innerHTML = Duo.mascot.svg(spec.emotion, { size: 128 });
        });
      }
      if (!mascotBox.firstChild) mascotBox.style.display = 'none';

      signal(spec.cls === 'lesson' ? 'lesson' : spec.cls);
      if (spec.confetti !== false && Duo.motion && typeof Duo.motion.confetti === 'function') safe(function () { Duo.motion.confetti({ ms: 1400, origin: mascotBox.firstChild ? mascotBox : undefined }); });

      // число серії: відлік від попередньої серії
      var cnt = el.querySelector('[data-count]');
      if (cnt && Duo.motion && typeof Duo.motion.countUp === 'function' && !reduced()) {
        safe(function () { Duo.motion.countUp(cnt, +cnt.getAttribute('data-from') || 0, +cnt.getAttribute('data-count')); });
      }
      // кільце цілі
      var ring = el.querySelector('.d-ring__fill');
      if (ring) { if (reduced()) { ring.style.transition = 'none'; ring.setAttribute('stroke-dashoffset', '0'); } else { void ring.getBoundingClientRect(); W.requestAnimationFrame(function () { ring.setAttribute('stroke-dashoffset', '0'); }); } }

      title.focus({ preventScroll: true });
      // озвучка для читалки: фокус на заголовку + повідомлення
      setTimeout(function () { if (!done && live) live.textContent = spec.title + '. ' + (spec.sub || ''); }, 50);

      function finish() {
        if (done) return; done = true;
        doc.removeEventListener('keydown', onKey, true);
        if (mh && mh.destroy) safe(function () { mh.destroy(); });
        if (el.parentNode) el.parentNode.removeChild(el);
        inerted.forEach(function (c) { c.removeAttribute('inert'); });
        doc.documentElement.style.overflow = savedOv;
        if (prevFocus && prevFocus.focus && doc.contains(prevFocus)) safe(function () { prevFocus.focus({ preventScroll: true }); });
        current = null;
        resolve();
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return; } // закрити можна тільки кнопкою
        if (e.key === 'Enter' && !e.repeat && e.target === title) { e.preventDefault(); btn.click(); return; }
        if (e.key === 'Tab') { // єдина кнопка + заголовок: фокус не виходить за межі екрана
          e.preventDefault();
          if (doc.activeElement === btn) title.focus({ preventScroll: true }); else btn.focus({ preventScroll: true });
        }
      }
      doc.addEventListener('keydown', onKey, true);
      btn.addEventListener('click', finish);
      current = { el: el, finish: finish };
    });
  }

  function run() {
    if (running) return running;
    if (!queue.length) return Promise.resolve();
    function loop() {
      var item = takeNext();
      if (!item) return Promise.resolve();
      return show(item).then(loop, loop);
    }
    running = loop().then(function () { running = null; });
    return running;
  }

  Duo.celebrate = {
    enqueue: enqueue,
    run: run,
    copy: copy,
    pending: function () { return queue.length + (current ? 1 : 0); },
    isOpen: function () { return !!current; }
  };
})();
