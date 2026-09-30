/* Ikorka Duo — шлях навчання (path.js, index.html). Власник — builder-home.
 * Розмітка шляху згенерована збіркою (pages/index.mjs); тут: стани вузлів з Duo.progress, aria-label, тултип «Почати»,
 * тост на закритий вузол, онбординг (блок у вмісті сторінки), прокрутка до поточного вузла, перемальовування
 * за progress:change (повернення з плеєра / іншої вкладки) без перезавантаження. */
(function () {
  'use strict';
  var D = window.Duo = window.Duo || {};
  var root, onb, done, jump, tip, tipFor = null, tipH = null, io = null, curEl = null, ready = false;

  var STATE_TXT = { locked: 'закрито', available: 'доступно', current: 'поточний', done: 'пройдено' };
  var CHEST_TXT = { locked: 'закритий', available: 'готовий, можна відкрити', done: 'відкрито' };
  var BOSS_TXT = { locked: 'недоступний', available: 'доступний', done: 'пройдено' };
  var CHEST_OPEN = '<svg class="d-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 12h16v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6z"/><path d="M4 12l1.6-6.5h12.8L20 12"/><rect x="10" y="12" width="4" height="3" rx="1"/></svg>';

  function iconFor(kind, st) {
    if (st === 'locked') return 'lock';
    if (kind === 'chest') return st === 'done' ? 'chest-open' : 'chest';
    if (kind === 'boss') return st === 'done' ? 'check' : 'crown';
    return st === 'current' ? 'star' : 'check';
  }
  function setIcon(face, name) {
    if (face.getAttribute('data-ico') === name) return;
    face.setAttribute('data-ico', name);
    face.innerHTML = name === 'chest-open' ? CHEST_OPEN : (D.icon ? D.icon(name) : '');
  }
  function reduced() { return !!(D.env && D.env.reducedMotion); }
  function P() { return D.progress; }

  // ---------- тултип «Почати» ----------
  function placeTip(el) {
    if (tipFor === el) return;
    if (tipH) { tipH.stop(); tipH = null; }
    tipFor = el;
    if (!el) { if (tip && tip.parentNode) tip.parentNode.removeChild(tip); return; }
    if (!tip) {
      tip = document.createElement('span');
      tip.className = 'duo-node__tip';
      tip.setAttribute('aria-hidden', 'true');
      tip.textContent = 'Почати';
    }
    el.querySelector('.duo-node__box').appendChild(tip);
    if (D.motion && D.motion.bounceTooltip) tipH = D.motion.bounceTooltip(tip);
  }

  // ---------- стани вузлів ----------
  function updateNodes() {
    var p = P(), cur = null;
    var nodes = root.querySelectorAll('.duo-node');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i], kind = el.getAttribute('data-kind'), st = p.nodeState(el.getAttribute('data-id'));
      if (st === 'current') cur = el;
      if (el.getAttribute('data-state') !== st) el.setAttribute('data-state', st);
      var txt = kind === 'chest' ? CHEST_TXT[st] : kind === 'boss' ? BOSS_TXT[st] : STATE_TXT[st];
      var label = el.getAttribute('data-a') + ', ' + (txt || st);
      if (el.getAttribute('aria-label') !== label) el.setAttribute('aria-label', label);
      if (st === 'locked') el.setAttribute('aria-disabled', 'true'); else el.removeAttribute('aria-disabled');
      if (st === 'current') el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
      setIcon(el.querySelector('.duo-node__face'), iconFor(kind, st));
    }
    curEl = cur;
    placeTip(cur);
    observeCurrent();
  }

  // ---------- «До поточного вузла» ----------
  function observeCurrent() {
    if (io) { io.disconnect(); io = null; }
    if (!curEl || !window.IntersectionObserver) { jump.hidden = true; return; }
    io = new IntersectionObserver(function (es) {
      var vis = es[es.length - 1].isIntersecting;
      jump.hidden = vis || !ready || !onb.hidden;
    });
    io.observe(curEl);
  }
  function scrollToCurrent(smooth) {
    if (!curEl) return;
    var r = curEl.getBoundingClientRect();
    var top = Math.max(0, Math.round(r.top + window.pageYOffset - window.innerHeight * 0.4));
    // найперший вузол уже видно під баннером юніта — не зсуваємо сторінку
    if (top < 160 && !smooth) return;
    window.scrollTo({ top: top, behavior: smooth && !reduced() ? 'smooth' : 'auto' });
  }

  // ---------- онбординг ----------
  function updateOnboarding() {
    var p = P(), first = root.querySelector('.duo-node[data-kind="node"]');
    // показуємо лише новому користувачу без пройдених уроків
    var show = !p.onboarded() && !(first && p.isDone(first.getAttribute('data-id')));
    if (onb.hidden !== !show) {
      onb.hidden = !show;
      if (show && D.mascot && D.mascot.mount && !onb.getAttribute('data-m')) {
        onb.setAttribute('data-m', '1');
        var host = document.getElementById('duo-onb-mascot');
        host.innerHTML = '';
        D.mascot.mount(host, { emotion: 'happy', size: 96, idle: true });
      }
    }
    if (show) {
      var g = p.dailyGoal().target, radios = onb.querySelectorAll('input[name="duo-goal"]');
      if (!onb.getAttribute('data-g')) {
        onb.setAttribute('data-g', '1');
        for (var i = 0; i < radios.length; i++) radios[i].checked = +radios[i].value === g;
      }
    }
    return show;
  }
  function startCourse() {
    var p = P(), sel = onb.querySelector('input[name="duo-goal"]:checked');
    if (sel) p.setDailyGoal(+sel.value);
    p.setOnboarded();
    if (D.sfx && D.sfx.play) D.sfx.play('click');
    var id = p.currentNodeId();
    location.href = id ? 'vprava.html?n=' + encodeURIComponent(id) : 'index.html';
  }

  function update() {
    if (!P() || !root) return;
    updateOnboarding();
    updateNodes();
    done.hidden = !!P().currentNodeId();
    if (!onb.hidden) jump.hidden = true;
  }

  // ---------- клік по вузлу ----------
  function onClick(e) {
    var a = e.target.closest ? e.target.closest('.duo-node') : null;
    if (!a) return;
    if (a.getAttribute('data-state') === 'locked') {
      e.preventDefault();
      var boss = a.getAttribute('data-kind') === 'boss';
      if (D.ui && D.ui.toast) D.ui.toast(boss ? 'Спершу заверши всі уроки цього дня' : 'Спершу заверши попередній вузол');
      var face = a.querySelector('.duo-node__face');
      if (D.motion && D.motion.shake && face) D.motion.shake(face);
      return;
    }
    if (D.sfx && D.sfx.play) D.sfx.play('tap');
  }

  function init() {
    root = document.getElementById('duo-units');
    onb = document.getElementById('duo-onb');
    done = document.getElementById('duo-alldone');
    jump = document.getElementById('duo-jump');
    if (!root || !onb || !P() || !window.DUO_COURSE) return;
    var home = document.getElementById('duo-home');
    root.addEventListener('click', onClick);
    document.getElementById('duo-onb-start').addEventListener('click', startCourse);
    jump.addEventListener('click', function () { scrollToCurrent(true); });
    update();

    // стартова прокрутка — після шрифтів (висота підписів), без анімації; потім показуємо шлях
    function reveal() {
      if (ready) return;
      ready = true;
      if (onb.hidden) scrollToCurrent(false);
      home.classList.add('is-ready');
      observeCurrent();
    }
    var fonts = document.fonts && document.fonts.ready;
    if (fonts && fonts.then) { fonts.then(reveal); setTimeout(reveal, 600); } else reveal();

    if (D.env && D.env.on) D.env.on('progress:change', update);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) update(); });
    window.addEventListener('pageshow', function (e) { if (e.persisted) { update(); if (onb.hidden) scrollToCurrent(false); } });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
