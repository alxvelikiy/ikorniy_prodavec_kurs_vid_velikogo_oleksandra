/* Ikorka Duo — оболонка застосунку (shell.js): лічильники верхньої панелі (серія, серця, XP дня з ціллю)
 * і порядок навігації в DOM. Власник — builder-home. Без .duo-top на сторінці (плеєр уроку) нічого не робить.
 * Дані — Duo.progress; перемальовується за подією progress:change, при поверненні на вкладку і з bfcache. */
(function () {
  'use strict';
  var D = window.Duo = window.Duo || {};
  var root = null, timer = 0;

  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    return b > 1 && b < 5 ? few : many;
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
    var st = P.streak(), h = P.hearts(), g = P.dailyGoal();
    var sl = q('[data-stat="streak"]'), hl = q('[data-stat="hearts"]'), xl = q('[data-stat="xp"]');
    if (sl) {
      setText(sl, '<b>' + st.count + '</b> дн.', 'Серія: ' + st.count + ' ' + plural(st.count, 'день', 'дні', 'днів') + (st.activeToday ? ', сьогодні зараховано' : ''));
      sl.classList.toggle('is-idle', !st.count);
    }
    if (hl) {
      setText(hl, '<b>' + h.n + '</b>', 'Серця: ' + h.n + ' з ' + h.max);
      hl.classList.toggle('is-idle', h.n === 0);
    }
    if (xl) {
      var xp = g.xpToday != null ? g.xpToday : P.xpToday(), frac = g.target ? Math.min(1, xp / g.target) : 0;
      setText(xl, '<b>' + xp + '</b> з ' + g.target + ' XP', 'Сьогодні ' + xp + ' XP з цілі ' + g.target + ' XP' + (g.done ? ', ціль виконано' : ''));
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
    render();
    if (D.env && D.env.on) D.env.on('progress:change', render);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) render(); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) render(); });
  }

  D.shell = { refresh: render };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
