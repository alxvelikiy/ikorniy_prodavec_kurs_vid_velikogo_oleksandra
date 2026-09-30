/* Ikorka Duo — мета-сторінки (meta.js): «Практика» (#duo-practice), «Завдання» (#duo-quests), «Профіль» (#duo-profile).
 * Власник — builder-celebrate. Дані — Duo.progress; перемальовується за Duo.env 'progress:change', при поверненні на вкладку і з bfcache.
 * Назви завдань/досягнень — Duo.celebrate.copy (celebrate.js), із запасними значеннями тут. Не падає без mascot/signals/motion. */
(function () {
  'use strict';
  var W = window, doc = document, Duo = W.Duo = W.Duo || {};

  var QUEST_FALLBACK = { perfect: 'Пройди урок без помилок', xp30: 'Набери 30 XP', coach: 'Пройди бос-випробування', coachOffline: 'Відпрацюй 3 заперечення' };
  var ACH_FALLBACK = { objections: ['Майстер заперечень', 'Відпрацьовані заперечення', 'headset'], streak: ['Вогняна серія', 'Найдовша серія, днів', 'flame'], perfect: ['Без жодної помилки', 'Уроки без помилок', 'star'], builder: ['Знавець скрипта', 'Зібрані фрази скрипта', 'keyboard'], boss: ['Легенда дзвінка', 'Пройдені босі', 'crown'], course: ['Крок за кроком', 'Повністю пройдені уроки', 'book'] };
  var ACH_ICON = { objections: 'headset', streak: 'flame', perfect: 'star', builder: 'keyboard', boss: 'crown', course: 'book' };
  var DAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];
  var DAYS_FULL = ['понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота', 'неділя'];
  var MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
  var MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

  function $(id) { return doc.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safe(fn, dflt) { try { return fn(); } catch (e) { return dflt; } }
  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    return b > 1 && b < 5 ? few : many;
  }
  function icon(name, size) { return typeof Duo.icon === 'function' ? Duo.icon(name, { size: size || 20 }) : ''; }
  function reduced() { var e = Duo.env; return !!(e && e.reducedMotion); }
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function copy() { return Duo.celebrate && Duo.celebrate.copy; }
  function questTitle(id) { var c = copy(); return c ? c.quest(id) : (QUEST_FALLBACK[id] || 'Щоденне завдання'); }
  function achInfo(id) {
    var c = copy(), a = c ? c.achievement(id) : null;
    if (a && a.name) return { name: a.name, what: a.what, icon: ACH_ICON[id] || 'medal' };
    var f = ACH_FALLBACK[id] || ['Досягнення', 'Прогрес', 'medal'];
    return { name: f[0], what: f[1], icon: f[2] };
  }
  function P() { return Duo.progress; }

  /* Полоска прогресу: .d-progress з role=progressbar, заповнення — transform: scaleX */
  function bar(label, value, max, text, cls) {
    var f = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
    return '<div class="d-progress mt-bar ' + (cls || '') + (f >= 1 ? ' is-done' : '') + '"><div class="d-progress__track" role="progressbar" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="' + max + '" aria-valuenow="' + Math.min(value, max) + '" aria-valuetext="' + esc(text) + '">' +
      '<div class="d-progress__fill" style="transform:scaleX(' + f.toFixed(3) + ')"><span class="d-progress__shine"></span></div></div></div>';
  }
  function setHtml(el, html) { if (el && el.innerHTML !== html) el.innerHTML = html; }

  /* Перемалювання з утриманням фокуса: якщо елемент із фокусом зник, фокус іде на fallback */
  function keepFocus(fn, fallbackId) {
    var a = doc.activeElement, id = a && a.id;
    fn();
    if (id && a !== doc.activeElement && !doc.body.contains(a)) {
      var n = $(id) || (fallbackId && $(fallbackId));
      if (n && n.focus) n.focus({ preventScroll: true });
    }
  }

  /* ================================================================ */
  /* Практика                                                          */
  /* ================================================================ */
  function practice() {
    var p = P(); if (!p) return;
    var n = (p.mistakes() || []).length, txt = $('pr-mis-text'), act = $('pr-mis-act');
    if (n > 0) {
      setHtml(txt, 'Є ' + n + ' ' + plural(n, 'помилка', 'помилки', 'помилок') + ' для повторення. Повтори їх, щоб закріпити правила.');
      setHtml(act, '<a class="d-btn d-btn--primary d-btn--md" id="pr-mis-btn" href="vprava.html?mode=mistakes"><span class="d-btn__label">Повторити помилки</span></a>');
    } else {
      setHtml(txt, 'Помилок для повторення зараз немає. Коли помилишся в уроці, завдання з’явиться тут.');
      setHtml(act, '<a class="d-btn d-btn--secondary d-btn--md" id="pr-mis-btn" href="index.html"><span class="d-btn__label">До навчання</span></a>');
    }
  }

  /* ================================================================ */
  /* Завдання                                                          */
  /* ================================================================ */
  var justOpened = null; // { xp } — щойно відкрита скриня на цій сторінці
  function quests() {
    var p = P(); if (!p) return;
    var g = p.dailyGoal(), qs = p.quests() || [], ch = p.questChest() || {}, left = qs.filter(function (q) { return !q.done; }).length;

    var shown = Math.min(g.xpToday, g.target);
    setHtml($('qz-goal'),
      '<div class="mt-goal__row"><div class="mt-goal__num">' + shown + ' <small>з ' + g.target + ' XP</small></div>' +
      (g.done ? '<span class="mt-state mt-state--done">' + icon('check', 16) + 'Ціль виконано</span>' : '<span class="mt-state">Ще ' + (g.target - g.xpToday) + ' XP</span>') + '</div>' +
      bar('Ціль дня, XP', g.xpToday, g.target, shown + ' з ' + g.target + ' XP', 'mt-bar--xp') +
      (g.xpToday > g.target ? '<p class="mt-hint">Сьогодні набрано ' + g.xpToday + ' XP, це більше за ціль.</p>' : ''));

    setHtml($('qz-list'), qs.map(function (q) {
      var t = questTitle(q.id), v = Math.min(q.value, q.target);
      return '<li class="mt-quest' + (q.done ? ' is-done' : '') + '"><div class="mt-quest__top"><span class="mt-quest__ico" aria-hidden="true">' + icon(q.done ? 'check' : 'target', 20) + '</span>' +
        '<span class="mt-quest__t">' + esc(t) + '</span>' +
        (q.done ? '<span class="mt-state mt-state--done">' + icon('check', 16) + 'Виконано</span>' : '<span class="mt-state">' + v + ' з ' + q.target + '</span>') + '</div>' +
        bar(t, v, q.target, v + ' з ' + q.target, '') + '</li>';
    }).join(''));

    var box = $('qz-chest'), html;
    if (ch.opened) {
      html = '<p class="mt-chest__status" id="qz-chest-status" tabindex="-1">Скриню відкрито. Нова скриня чекатиме завтра.</p>' +
        (justOpened ? '<span class="mt-chest__xp">' + icon('bolt', 16) + '+' + justOpened.xp + ' XP</span>' : '<span class="mt-state mt-state--done">' + icon('check', 16) + 'Відкрито</span>');
    } else if (ch.ready) {
      html = '<p class="mt-chest__status" id="qz-chest-status" tabindex="-1">Усі завдання виконано. Скриня готова до відкриття.</p>' +
        '<button type="button" class="d-btn d-btn--primary d-btn--md" id="qz-open"><span class="d-btn__label">Відкрити</span></button>';
    } else {
      html = '<p class="mt-chest__status" id="qz-chest-status" tabindex="-1">Скриня зачинена. Виконай ще ' + left + ' ' + plural(left, 'завдання', 'завдання', 'завдань') + ', щоб відкрити її та отримати XP.</p>' +
        '<span class="mt-state">' + icon('lock', 16) + 'Зачинена</span>';
    }
    keepFocus(function () { setHtml(box, html); }, 'qz-chest-status');
  }

  function openChest() {
    var p = P(); if (!p) return;
    var r = p.openQuestChest();
    if (!r || !r.xp) return;
    justOpened = { xp: r.xp };
    var live = $('qz-live'); if (live) live.textContent = 'Скриню відкрито: +' + r.xp + ' XP';
    if (Duo.signals && Duo.signals.emit) safe(function () { Duo.signals.emit('node_complete'); });
    quests();
    var st = $('qz-chest-status'); if (st) st.focus({ preventScroll: true });
    if (Duo.motion && !reduced()) {
      var x = box_xp();
      if (x && Duo.motion.floatText) safe(function () { Duo.motion.floatText(x, '+' + r.xp + ' XP', { tone: 'success' }); });
      if (Duo.motion.confetti) safe(function () { Duo.motion.confetti({ ms: 1200, origin: x || undefined }); });
    }
  }
  function box_xp() { return doc.querySelector('.mt-chest__xp'); }

  /* ================================================================ */
  /* Профіль                                                           */
  /* ================================================================ */
  function kpi(cls, label, value, unit) {
    return '<li class="d-card d-stat d-stat--' + cls + ' mt-kpi"><div class="d-stat__label">' + esc(label) + '</div><div class="d-stat__value">' + value + (unit ? ' <small>' + esc(unit) + '</small>' : '') + '</div></li>';
  }
  function nodesDone() {
    var c = W.DUO_COURSE, p = P(), d = 0, t = 0;
    if (!c || !c.units) return null;
    c.units.forEach(function (u) { u.items.forEach(function (it) { if (it.kind === 'node') { t++; if (p.isDone ? p.isDone(it.id) : p.nodeState(it.id) === 'done') d++; } }); });
    return { done: d, total: t };
  }

  function activeSet(state) {
    var set = {};
    (state.xp || []).forEach(function (e) { if (e && e.xp > 0) set[e.d] = true; });
    Object.keys(state.days || {}).forEach(function (k) { var x = state.days[k]; if (x && (x.lessons || x.practice || x.coach)) set[k] = true; });
    return set;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function calendar() {
    var p = P(), st = p.streak(), s = p.get(), act = activeSet(s), today = p.today();
    var week = '<ul class="mt-week" aria-label="Цей тиждень">' + st.week.map(function (w, i) {
      var cls = 'mt-wd' + (w.active ? ' is-on' : '') + (w.today ? ' is-today' : '') + (w.future ? ' is-future' : '');
      return '<li class="' + cls + '"><span class="mt-wd__dot" aria-hidden="true">' + (w.active ? icon('check', 18) : '') + '</span><span aria-hidden="true">' + DAYS[i] + '</span>' +
        '<span class="sr-only">' + DAYS_FULL[i] + (w.active ? ', зараховано' : w.future ? ', ще попереду' : ', без занять') + (w.today ? ', сьогодні' : '') + '</span></li>';
    }).join('') + '</ul>';

    // місяць (пн — перший стовпець), дні з активністю відмічені галкою-кольором і підписом
    var y = +today.slice(0, 4), m = +today.slice(5, 7) - 1, dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    var first = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7, rows = '', d = 1, cell, activeCount = 0, r, c;
    for (r = 0; d <= dim; r++) {
      rows += '<tr>';
      for (c = 0; c < 7; c++) {
        if ((r === 0 && c < first) || d > dim) { rows += '<td></td>'; continue; }
        var key = y + '-' + pad(m + 1) + '-' + pad(d), on = !!act[key], isT = key === today, fut = key > today;
        if (on) activeCount++;
        cell = '<span class="mt-day' + (on ? ' is-on' : '') + (isT ? ' is-today' : '') + (fut ? ' is-future' : '') + '"><span aria-hidden="true">' + d + '</span>' +
          '<span class="sr-only">' + d + ' ' + MONTHS_GEN[m] + (on ? ', зараховано' : fut ? ', ще попереду' : ', без занять') + (isT ? ', сьогодні' : '') + '</span></span>';
        rows += '<td>' + cell + '</td>'; d++;
      }
      rows += '</tr>';
    }
    var head = DAYS.map(function (x, i) { return '<th scope="col"><abbr title="' + DAYS_FULL[i] + '">' + x + '</abbr></th>'; }).join('');
    var month = '<table class="mt-month"><caption>' + MONTHS[m] + ' ' + y + '</caption><thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody></table>';
    var legend = '<p class="mt-legend">' + (activeCount ? 'У цьому місяці занять: ' + activeCount + ' ' + plural(activeCount, 'день', 'дні', 'днів') + '. Підсвічені дні зараховані.' : 'У цьому місяці занять поки немає. Пройди урок, і день підсвітиться.') + '</p>';
    setHtml($('pf-cal'), week + month + legend);
  }

  function profile() {
    var p = P(); if (!p) return;
    var st = p.streak(), nd = nodesDone();
    setHtml($('pf-stats'),
      kpi('streak', 'Серія', st.count, plural(st.count, 'день', 'дні', 'днів')) +
      kpi('xp', 'XP всього', num(p.xpTotal()), '') +
      kpi('xp', 'XP сьогодні', p.xpToday(), '') +
      kpi('success', 'Пройдено вузлів', nd ? nd.done + ' <small>з ' + nd.total + '</small>' : '—', ''));
    safe(calendar);

    var list = p.achievements() || [];
    setHtml($('pf-achs'), list.map(function (a) {
      var inf = achInfo(a.id), lv = a.level, pips = '';
      for (var i = 1; i <= a.maxLevel; i++) pips += '<i class="' + (i <= lv ? 'is-on' : '') + '"></i>';
      var lvText = lv ? 'Рівень ' + lv + ' з ' + a.maxLevel : 'Ще не відкрито';
      var next = a.next != null ? inf.what + ': ' + Math.min(a.value, a.next) + ' з ' + a.next : inf.what + ': ' + a.value + '. Найвищий рівень!';
      return '<li class="mt-ach" data-level="' + lv + '"><span class="mt-ach__ico" aria-hidden="true">' + icon(inf.icon, 24) + '</span><div class="mt-ach__body">' +
        '<h3 class="mt-h3">' + esc(inf.name) + '</h3>' +
        '<p class="mt-ach__lvl">' + lvText + '<span class="mt-pips" aria-hidden="true">' + pips + '</span></p>' +
        '<p class="mt-ach__what">' + esc(next) + '</p>' +
        (a.next != null ? bar(inf.name + ': до наступного рівня', Math.min(a.value, a.next), a.next, Math.min(a.value, a.next) + ' з ' + a.next, 'mt-bar--xp') : '') +
        '</div></li>';
    }).join(''));

    var sel = $('pf-goal');
    if (sel && doc.activeElement !== sel) sel.value = String(p.dailyGoal().target);
  }

  function theme() { var t = 'light'; safe(function () { t = localStorage.getItem('ikorka-theme') === 'dark' ? 'dark' : 'light'; }); return t; }
  function applyTheme(t) {
    if (t === 'dark') doc.documentElement.setAttribute('data-theme', 'dark'); else doc.documentElement.removeAttribute('data-theme');
    safe(function () { localStorage.setItem('ikorka-theme', t); });
    syncTheme(t);
  }
  function syncTheme(t) {
    Array.prototype.forEach.call(doc.querySelectorAll('[data-theme-set]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-theme-set') === t ? 'true' : 'false'); b.classList.toggle('is-selected', b.getAttribute('data-theme-set') === t); });
  }

  function initProfile() {
    var p = P(), sel = $('pf-goal');
    if (sel && p) sel.addEventListener('change', function () { p.setDailyGoal(+sel.value); });
    var sig = $('pf-signals');
    if (sig && Duo.signals && Duo.signals.mountSettings) Duo.signals.mountSettings(sig);
    var box = $('pf-theme');
    if (box) box.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-theme-set]'); if (b) applyTheme(b.getAttribute('data-theme-set'));
    });
    syncTheme(theme());
  }

  /* ================================================================ */
  function init() {
    var page = $('duo-practice') ? 'practice' : $('duo-quests') ? 'quests' : $('duo-profile') ? 'profile' : '';
    if (!page) return;
    var draw = page === 'practice' ? practice : page === 'quests' ? quests : profile;
    if (page === 'quests') doc.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('#qz-open'); if (b) openChest(); });
    if (page === 'profile') initProfile();
    var render = function () { safe(draw); };
    render();
    if (Duo.env && Duo.env.on) Duo.env.on('progress:change', render);
    doc.addEventListener('visibilitychange', function () { if (!doc.hidden) render(); });
    W.addEventListener('pageshow', function (e) { if (e.persisted) render(); });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
