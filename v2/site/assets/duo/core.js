/* ==========================================================================
   Ikorka Duo — core.js
   Власник: design-system-engineer. Контракт: docs/design/ARCHITECTURE.md §4.1, §4.2.
   IIFE, реєструється у window.Duo. Не падає, якщо інших модулів (Duo.motion,
   Duo.sfx) немає — усі звернення до них через typeof-перевірку.
   ========================================================================== */
(function () {
  'use strict';
  var Duo = window.Duo = window.Duo || {};

  /* ------------------------------------------------------------------ */
  /* Утиліти                                                             */
  /* ------------------------------------------------------------------ */
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ------------------------------------------------------------------ */
  /* Duo.env — жива інформація про середовище + проста шина подій        */
  /* ------------------------------------------------------------------ */
  (function () {
    var listeners = Object.create(null);
    var mq = (window.matchMedia) ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var reducedMotion = !!(mq && mq.matches);

    function setReducedMotion(v) {
      if (v === reducedMotion) return;
      reducedMotion = v;
      emit('env:reducedMotion', reducedMotion);
    }
    if (mq) {
      if (mq.addEventListener) mq.addEventListener('change', function (e) { setReducedMotion(e.matches); });
      else if (mq.addListener) mq.addListener(function (e) { setReducedMotion(e.matches); }); // Safari legacy
    }

    function on(name, fn) {
      (listeners[name] || (listeners[name] = [])).push(fn);
      return function () { off(name, fn); };
    }
    function off(name, fn) {
      var a = listeners[name];
      if (!a) return;
      var i = a.indexOf(fn);
      if (i > -1) a.splice(i, 1);
    }
    function emit(name, detail) {
      var a = listeners[name];
      if (!a || !a.length) return;
      a.slice().forEach(function (fn) {
        try { fn(detail); } catch (e) { if (window.console) console.error('[Duo.env]', e); }
      });
    }

    Duo.env = {
      get reducedMotion() { return reducedMotion; },
      touch: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0),
      on: on,
      off: off,
      emit: emit
    };
  })();

  /* ------------------------------------------------------------------ */
  /* Duo.icon — один власний набір, одна товщина лінії (2px)             */
  /* ------------------------------------------------------------------ */
  var ICONS = {
    heart: '<path d="M12 20.5c-4.4-2.9-8-6.4-8-10.2A4.3 4.3 0 0 1 8.3 6c1.6 0 3 .8 3.7 2 .7-1.2 2.1-2 3.7-2A4.3 4.3 0 0 1 20 10.3c0 3.8-3.6 7.3-8 10.2z"/>',
    'heart-broken': '<path d="M12 20.5c-4.4-2.9-8-6.4-8-10.2A4.3 4.3 0 0 1 8.3 6c1.6 0 3 .8 3.7 2 .7-1.2 2.1-2 3.7-2A4.3 4.3 0 0 1 20 10.3c0 3.8-3.6 7.3-8 10.2z"/><path d="M13 5.5l-2.2 5 2.4 2.3-2.6 5.7"/>',
    flame: '<path d="M12 21a6.5 6.5 0 0 1-6.5-6.5c0-3 2-5 2.8-7.6.6 1.7 1.8 2.6 1.8 2.6-.7-3 .8-5.5 2.9-7.5-.2 3 .9 4.3 2.7 6.3 1.7 1.9 2.8 3.8 2.8 6.2A6.5 6.5 0 0 1 12 21z"/>',
    bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    close: '<path d="M5 5l14 14"/><path d="M19 5L5 19"/>',
    'arrow-left': '<path d="M19 12H5"/><path d="M11 5l-7 7 7 7"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>',
    'chevron-down': '<path d="M6 9l6 6 6-6"/>',
    volume: '<path d="M4 9v6h4l5 5V4L8 9H4z"/><path d="M16.3 8.7a5 5 0 0 1 0 6.6"/><path d="M19 6a9 9 0 0 1 0 12"/>',
    'volume-off': '<path d="M4 9v6h4l5 5V4L8 9H4z"/><path d="M16 9l6 6"/><path d="M22 9l-6 6"/>',
    vibrate: '<rect x="7" y="3" width="10" height="18" rx="2"/><line x1="3" y1="9" x2="3" y2="15"/><line x1="21" y1="9" x2="21" y2="15"/>',
    gear: '<circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2"/><line x1="19" y1="12" x2="21.5" y2="12"/><line x1="16.95" y1="16.95" x2="18.72" y2="18.72"/><line x1="12" y1="19" x2="12" y2="21.5"/><line x1="7.05" y1="16.95" x2="5.28" y2="18.72"/><line x1="5" y1="12" x2="2.5" y2="12"/><line x1="7.05" y1="7.05" x2="5.28" y2="5.28"/><line x1="12" y1="5" x2="12" y2="2.5"/><line x1="16.95" y1="7.05" x2="18.72" y2="5.28"/>',
    trophy: '<path d="M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M7 6H5a2 2 0 0 0 2 4"/><path d="M17 6h2a2 2 0 0 1-2 4"/><line x1="12" y1="13" x2="12" y2="17"/><path d="M8 21h8"/><path d="M9 17h6v4H9z"/>',
    medal: '<circle cx="12" cy="15" r="5"/><circle cx="12" cy="15" r="2"/><path d="M9 3l3 6 3-6"/>',
    chest: '<path d="M4 11h16v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7z"/><path d="M3 8a5 5 0 0 1 9-3 5 5 0 0 1 9 3v3H3V8z"/><rect x="10" y="11" width="4" height="4" rx="1"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2"/>',
    book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13z"/>',
    headset: '<path d="M4 13a8 8 0 0 1 16 0"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19v1a2 2 0 0 1-2 2h-3"/>',
    path: '<path d="M4 19c4-7 12 3 16-4"/><circle cx="4" cy="19" r="1.6" fill="currentColor" stroke="none"/><circle cx="20" cy="15" r="1.6" fill="currentColor" stroke="none"/>',
    dumbbell: '<line x1="7" y1="7" x2="7" y2="17"/><line x1="17" y1="7" x2="17" y2="17"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="4" y1="9" x2="4" y2="15"/><line x1="20" y1="9" x2="20" y2="15"/>',
    list: '<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    star: '<path d="M12 3.5l2.6 5.7 6.2.6-4.7 4.2 1.4 6-5.5-3.2-5.5 3.2 1.4-6-4.7-4.2 6.2-.6L12 3.5z"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><line x1="5" y1="10" x2="7" y2="10"/><line x1="9" y1="10" x2="11" y2="10"/><line x1="13" y1="10" x2="15" y2="10"/><line x1="17" y1="10" x2="19" y2="10"/><line x1="5" y1="13.5" x2="7" y2="13.5"/><line x1="9" y1="13.5" x2="11" y2="13.5"/><line x1="13" y1="13.5" x2="15" y2="13.5"/><line x1="17" y1="13.5" x2="19" y2="13.5"/><line x1="7" y1="16.5" x2="17" y2="16.5"/>',
    crown: '<path d="M4 18h16l-1.2-8.5-4.3 4-2.5-6.5-2.5 6.5-4.3-4L4 18z"/><line x1="4" y1="20.5" x2="20" y2="20.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><line x1="18" y1="12" x2="21" y2="12"/><line x1="16.24" y1="16.24" x2="18.36" y2="18.36"/><line x1="12" y1="18" x2="12" y2="21"/><line x1="7.76" y1="16.24" x2="5.64" y2="18.36"/><line x1="6" y1="12" x2="3" y2="12"/><line x1="7.76" y1="7.76" x2="5.64" y2="5.64"/><line x1="12" y1="6" x2="12" y2="3"/><line x1="16.24" y1="7.76" x2="18.36" y2="5.64"/>',
    phone: '<path d="M6.6 3.5h3.2l1.6 4-2 1.7a12.5 12.5 0 0 0 5.4 5.4l1.7-2 4 1.6v3.2a1.6 1.6 0 0 1-1.7 1.6A16.5 16.5 0 0 1 5 5.2a1.6 1.6 0 0 1 1.6-1.7z"/>'
  };

  Duo.icon = function (name, opts) {
    opts = opts || {};
    var size = opts.size || 24;
    var body = ICONS[name] || '';
    var a11y = opts.title ? ' role="img" aria-label="' + escHtml(opts.title) + '"' : ' aria-hidden="true"';
    return '<svg class="d-icon" viewBox="0 0 24 24" width="' + size + '" height="' + size +
      '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' +
      a11y + '>' + body + '</svg>';
  };

  /* ------------------------------------------------------------------ */
  /* Duo.ui — sheet / modal / toast / button                            */
  /* ------------------------------------------------------------------ */
  (function () {
    var FOCUSABLE_SEL = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    var scrollLockCount = 0, savedOverflow = '';

    function lockScroll() {
      if (scrollLockCount === 0) {
        savedOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
      }
      scrollLockCount++;
    }
    function unlockScroll() {
      scrollLockCount = Math.max(0, scrollLockCount - 1);
      if (scrollLockCount === 0) document.documentElement.style.overflow = savedOverflow;
    }

    function trapFocus(container) {
      function onKeydown(e) {
        if (e.key !== 'Tab') return;
        var items = Array.prototype.slice.call(container.querySelectorAll(FOCUSABLE_SEL));
        if (!items.length) return;
        var first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      container.addEventListener('keydown', onKeydown);
      return { release: function () { container.removeEventListener('keydown', onKeydown); } };
    }

    function focusFirst(container) {
      var el = container.querySelector('[autofocus]') || container.querySelector(FOCUSABLE_SEL);
      if (el && el.focus) el.focus();
      else { container.setAttribute('tabindex', '-1'); container.focus(); }
    }

    // Анімація: якщо є Duo.motion[name] — використовуємо його (повертає Promise),
    // інакше короткий CSS-transition через inline style (var() резолвиться самим браузером),
    // при reduced motion — миттєво.
    function animate(el, motionName, fromT, toT, durVar, easeVar) {
      if (Duo.env.reducedMotion) {
        el.style.transition = 'none';
        el.style.transform = toT;
        el.style.opacity = '1';
        return Promise.resolve();
      }
      if (Duo.motion && typeof Duo.motion[motionName] === 'function') {
        return Duo.motion[motionName](el);
      }
      return new Promise(function (resolve) {
        el.style.transition = 'none';
        el.style.transform = fromT;
        el.style.opacity = '0';
        void el.offsetHeight; // reflow
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            el.style.transition = 'transform ' + durVar + ' ' + easeVar + ', opacity ' + durVar + ' ' + easeVar;
            el.style.transform = toT;
            el.style.opacity = '1';
          });
        });
        var done = false;
        function finish() { if (done) return; done = true; el.removeEventListener('transitionend', finish); resolve(); }
        el.addEventListener('transitionend', finish);
        setTimeout(finish, 450);
      });
    }
    function animateOut(el, motionName, toT, durVar, easeVar) {
      if (Duo.env.reducedMotion) return Promise.resolve();
      if (Duo.motion && typeof Duo.motion[motionName] === 'function') return Duo.motion[motionName](el);
      return new Promise(function (resolve) {
        el.style.transition = 'transform ' + durVar + ' ' + easeVar + ', opacity ' + durVar + ' ' + easeVar;
        el.style.transform = toT;
        el.style.opacity = '0';
        var done = false;
        function finish() { if (done) return; done = true; el.removeEventListener('transitionend', finish); resolve(); }
        el.addEventListener('transitionend', finish);
        setTimeout(finish, 350);
      });
    }

    function actionsMarkup(actions, wrapClass) {
      if (!actions || !actions.length) return '';
      var buttons = actions.map(function (a, i) {
        var kind = a.kind || 'primary';
        return '<button type="button" class="d-btn d-btn--' + kind + ' d-btn--lg d-btn--block" data-d-action-index="' + i + '">' +
          '<span class="d-btn__label">' + escHtml(a.label || '') + '</span>' +
          '<span class="d-btn__spinner"></span></button>';
      }).join('');
      return '<div class="' + wrapClass + '">' + buttons + '</div>';
    }
    function wireActions(root, actions, close) {
      if (!actions) return;
      Array.prototype.forEach.call(root.querySelectorAll('[data-d-action-index]'), function (btn) {
        btn.addEventListener('click', function () {
          var a = actions[Number(btn.getAttribute('data-d-action-index'))];
          if (a && typeof a.onClick === 'function') a.onClick();
          close();
        });
      });
    }

    Duo.ui = {};

    Duo.ui.sheet = function (opts) {
      opts = opts || {};
      var dismissible = opts.dismissible !== false;
      var toneClass = opts.tone === 'success' ? ' d-sheet--success' : opts.tone === 'error' ? ' d-sheet--error' : '';
      var backdrop = document.createElement('div');
      backdrop.className = 'd-backdrop';
      var el = document.createElement('div');
      el.className = 'd-sheet' + toneClass;
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.tabIndex = -1;
      el.innerHTML = '<div class="d-sheet__handle"></div>' + (opts.html || '') + actionsMarkup(opts.actions, 'd-sheet__actions');
      document.body.appendChild(backdrop);
      document.body.appendChild(el);
      lockScroll();
      var prevFocus = document.activeElement;
      wireActions(el, opts.actions, close);
      var onKey;
      if (dismissible) {
        backdrop.addEventListener('click', close);
        onKey = function (e) { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKey);
      }
      var trap = trapFocus(el);
      focusFirst(el);
      animate(el, 'sheetUp', 'translateY(100%)', 'translateY(0)', 'var(--dur-base)', 'var(--ease-out)');

      var closed = false;
      function close() {
        if (closed) return;
        closed = true;
        if (onKey) document.removeEventListener('keydown', onKey);
        trap.release();
        animateOut(el, 'sheetDown', 'translateY(100%)', 'var(--dur-fast)', 'var(--ease-in-out)').then(function () {
          backdrop.remove(); el.remove(); unlockScroll();
          if (prevFocus && prevFocus.focus) prevFocus.focus();
          if (opts.onClose) opts.onClose();
        });
      }
      return { el: el, close: close };
    };

    Duo.ui.modal = function (opts) {
      opts = opts || {};
      var dismissible = opts.dismissible !== false;
      var backdrop = document.createElement('div');
      backdrop.className = 'd-backdrop d-backdrop--modal';
      var el = document.createElement('div');
      el.className = 'd-modal';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.tabIndex = -1;
      el.innerHTML = (opts.html || '') + actionsMarkup(opts.actions, 'd-modal__actions');
      document.body.appendChild(backdrop);
      document.body.appendChild(el);
      lockScroll();
      var prevFocus = document.activeElement;
      wireActions(el, opts.actions, close);
      var onKey;
      if (dismissible) {
        backdrop.addEventListener('click', close);
        onKey = function (e) { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKey);
      }
      var trap = trapFocus(el);
      focusFirst(el);
      var REST = 'translate(-50%, -50%) scale(1)', START = 'translate(-50%, -50%) scale(.92)';
      animate(el, 'popIn', START, REST, 'var(--dur-base)', 'var(--ease-spring)');

      var closed = false;
      function close() {
        if (closed) return;
        closed = true;
        if (onKey) document.removeEventListener('keydown', onKey);
        trap.release();
        animateOut(el, 'popOut', START, 'var(--dur-fast)', 'var(--ease-in-out)').then(function () {
          backdrop.remove(); el.remove(); unlockScroll();
          if (prevFocus && prevFocus.focus) prevFocus.focus();
          if (opts.onClose) opts.onClose();
        });
      }
      return { el: el, close: close };
    };

    Duo.ui.toast = function (text, opts) {
      opts = opts || {};
      var ms = opts.ms || 2200;
      var toneClass = opts.tone && opts.tone !== 'neutral' ? ' d-toast--' + opts.tone : '';
      var el = document.createElement('div');
      el.className = 'd-toast' + toneClass;
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.textContent = text;
      document.body.appendChild(el);
      var REST = 'translateX(-50%) translateY(0)', START = 'translateX(-50%) translateY(12px)';
      animate(el, 'fadeIn', START, REST, 'var(--dur-fast)', 'var(--ease-out)');
      var timer = setTimeout(close, ms);
      el.addEventListener('click', close);
      var closed = false;
      function close() {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        animateOut(el, 'fadeOut', START, 'var(--dur-fast)', 'var(--ease-in-out)').then(function () { el.remove(); });
      }
      return { el: el, close: close };
    };

    Duo.ui.button = function (label, opts) {
      opts = opts || {};
      var kind = opts.kind || 'primary', size = opts.size || 'md';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'd-btn d-btn--' + kind + ' d-btn--' + size;
      var html = '';
      if (opts.icon) html += '<span class="d-btn__icon">' + Duo.icon(opts.icon, { size: size === 'sm' ? 16 : 20 }) + '</span>';
      html += '<span class="d-btn__label">' + escHtml(label) + '</span>';
      html += '<span class="d-btn__spinner"></span>';
      btn.innerHTML = html;
      return btn;
    };
  })();
})();
