/* Ikorka Duo — оболонка застосунку (shell.js): лічильники верхньої панелі (серія, серця, XP дня з ціллю)
 * і порядок навігації в DOM. Власник — builder-home. Без .duo-top на сторінці (плеєр уроку) нічого не робить.
 * Дані — Duo.progress; перемальовується за подією progress:change, при поверненні на вкладку і з bfcache. */
(function () {
  'use strict';
  var D = window.Duo = window.Duo || {};
  var root = null, timer = 0;
  // позначка «Ціль виконано»: іконка + текст (текст — від 480px), не лише колір
  var DONE_MARK = '<span class="duo-stat__done"><svg class="d-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 12.5l5 5L20 6.5"/></svg><span class="duo-stat__donetxt">{t}</span></span>';
  function addStyle() {
    if (document.querySelector('style[data-duo-shell]')) return;
    var st = document.createElement('style'); st.setAttribute('data-duo-shell', '');
    st.textContent = '.duo-stat__done{display:inline-flex;align-items:center;gap:var(--s-1);margin-inline-start:var(--s-1)}.duo-stat__done .d-icon{width:14px;height:14px}' +
      '.duo-stat__donetxt{display:none}@media (min-width:480px){.duo-stat__donetxt{display:inline}}';
    document.head.appendChild(st);
  }

  // тексти лічильників — Duo.copy.topbar (copy.js)
  function T() {
    if (!D.copy) { var m = '[Duo] copy.js не завантажено: Duo.copy відсутній.'; if (window.console) console.error(m); throw new Error(m); }
    return D.copy;
  }
  function q(sel) { return root.querySelector(sel); }
  function setText(li, vHtml, sr) {
    var v = li.querySelector('.duo-stat__v'), s = li.querySelector('.sr-only');
    if (v && v.innerHTML !== vHtml) v.innerHTML = vHtml;
    if (s && s.textContent !== sr) s.textContent = sr;
  }

  function render() {
    var P = D.progress;
    if (!root || !P) return;
    clearTimeout(timer);
    var st = P.streak(), h = P.hearts(), g = P.dailyGoal(), X = T().topbar;
    var sl = q('[data-stat="streak"]'), hl = q('[data-stat="hearts"]'), xl = q('[data-stat="xp"]');
    if (sl) {
      setText(sl, '<b>' + st.count + '</b> ' + X.daysShort, X.streakSr(st.count, st.activeToday));
      sl.classList.toggle('is-idle', !st.count);
    }
    if (hl) {
      setText(hl, '<b>' + h.n + '</b>', X.heartsSr(h.n, h.max));
      hl.classList.toggle('is-idle', h.n === 0);
    }
    if (xl) {
      var xp = g.xpToday != null ? g.xpToday : P.xpToday(), frac = g.target ? Math.min(1, xp / g.target) : 0;
      // над ціллю показуємо «ціль з цілі» (20 з 20 XP) і позначку; реальний XP лишається в профілі
      var shown = Math.min(xp, g.target);
      setText(xl, '<b>' + shown + '</b>' + X.ofXp(g.target) + (g.done ? DONE_MARK.replace('{t}', X.goalDone) : ''),
        g.done ? X.xpSrDone(g.target) : X.xpSr(xp, g.target));
      var bar = xl.querySelector('.duo-stat__bar i');
      if (bar) bar.style.transform = 'scaleX(' + frac + ')';
      xl.classList.toggle('is-done', !!g.done);
    }
    // серця відновлюються з часом — оновити, коли з'явиться наступне
    if (h.n < h.max && h.nextInMs > 0) timer = setTimeout(render, Math.min(h.nextInMs + 500, 60000));
  }

  // Мобільний: таб-бар унизу → у DOM після <main> (Tab-порядок = візуальний); від 768px: сайдбар → перед <main>.
  function place(wide) {
    var nav = document.querySelector('.duo-nav'), main = document.getElementById('main-content');
    if (!nav || !main || !main.parentNode) return;
    if (wide) { if (nav.nextElementSibling !== main && main.previousElementSibling !== nav) main.parentNode.insertBefore(nav, main); }
    else if (main.nextElementSibling !== nav) main.parentNode.insertBefore(nav, main.nextSibling);
  }

  function init() {
    root = document.getElementById('duo-stats');
    var mq = window.matchMedia ? window.matchMedia('(min-width: 768px)') : null;
    if (document.querySelector('.duo-nav')) {
      place(!!(mq && mq.matches));
      if (mq) { if (mq.addEventListener) mq.addEventListener('change', function (e) { place(e.matches); }); }
    }
    if (!root) return;
    addStyle();
    render();
    if (D.env && D.env.on) D.env.on('progress:change', render);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) render(); });
  }

  D.shell = { refresh: render };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
