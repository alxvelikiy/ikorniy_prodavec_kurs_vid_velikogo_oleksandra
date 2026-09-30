/* Ikorka Duo — сигнали плеєра: window.Duo.signals.
   Один виклик Duo.signals.emit('correct') = подія для маскота (Duo.env 'signal') + звук + вібрація.
   Звук і вібрація — поверх sfx.js (Web Audio, жодних файлів); перемикачі «Звук» і «Вібрація» незалежні,
   за замовчуванням увімкнені, зберігаються в localStorage (у sfx.js, у try/catch).
   Реакція маскота від перемикачів не залежить. Без жесту користувача звук не стартує (це робить sfx.js). */
(function () {
  'use strict';
  var W = window, Duo = W.Duo = W.Duo || {};

  /* подія → звук (Duo.sfx.play), вібрація (Duo.haptics.play) */
  var MAP = {
    correct:         { sfx: 'correct',        hap: 'correct' },
    wrong:           { sfx: 'wrong',          hap: 'wrong' },
    heart_lost:      { sfx: 'heartLose',      hap: null },
    streak:          { sfx: 'combo',          hap: null },
    node_complete:   { sfx: 'unlock',         hap: 'celebrate' },
    lesson_complete: { sfx: 'lessonComplete', hap: 'celebrate' },
    tap_tile:        { sfx: 'tileSelect',     hap: null }
  };

  function reduced() {
    var e = Duo.env;
    if (e && typeof e.reducedMotion === 'boolean') return e.reducedMotion;
    return !!(W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function safe(fn) { try { return fn(); } catch (e) { return undefined; } }

  function emit(name) {
    var m = MAP[name];
    if (!m) return false;
    // 1) маскот і будь-які слухачі: завжди, незалежно від перемикачів
    if (Duo.env && typeof Duo.env.emit === 'function') safe(function () { Duo.env.emit('signal', { name: name }); });
    // 2) звук
    if (m.sfx && Duo.sfx && typeof Duo.sfx.play === 'function') safe(function () { Duo.sfx.play(m.sfx); });
    // 3) вібрація: не при «зменшити рух»
    if (m.hap && Duo.haptics && !reduced()) safe(function () { Duo.haptics.play(m.hap); });
    return true;
  }

  var S = Duo.signals = { emit: emit, names: Object.keys(MAP) };
  Object.defineProperty(S, 'sound', {
    enumerable: true,
    get: function () { return !!(Duo.sfx && Duo.sfx.enabled); },
    set: function (v) { if (Duo.sfx) Duo.sfx.enabled = !!v; }
  });
  Object.defineProperty(S, 'haptics', {
    enumerable: true,
    get: function () { return !!(Duo.haptics && Duo.haptics.enabled) && !reduced(); },
    set: function (v) { if (Duo.haptics) Duo.haptics.enabled = !!v; }
  });

  /* Два перемикачі «Звук» / «Вібрація» у контейнері el. Повертає { destroy() }. */
  S.mountSettings = function (el) {
    if (!el) return { destroy: function () {} };
    var box = document.createElement('div');
    box.className = 'dsig-settings';
    function row(id, label, hint, get, set) {
      var l = document.createElement('label');
      l.className = 'd-switch dsig-row';
      l.innerHTML = '<input type="checkbox" id="' + id + '"><span class="d-switch__track"><span class="d-switch__thumb"></span></span>' +
        '<span class="dsig-row__txt"><b>' + label + '</b><small>' + hint + '</small></span>';
      var inp = l.querySelector('input');
      inp.checked = !!get();
      inp.addEventListener('change', function () {
        set(inp.checked);
        if (inp.checked) emit('correct');
      });
      box.appendChild(l);
      return inp;
    }
    row('dsig-sound', 'Звук', 'Короткі тони під час уроку', function () { return S.sound; }, function (v) { S.sound = v; });
    var vib = row('dsig-haptics', 'Вібрація', reduced() ? 'Вимкнена, бо в системі увімкнено «зменшити рух»' : 'Короткий відгук на телефоні',
      function () { return Duo.haptics && Duo.haptics.enabled; }, function (v) { S.haptics = v; });
    if (reduced() || !(W.navigator && typeof W.navigator.vibrate === 'function')) vib.disabled = true;
    el.appendChild(box);
    return { destroy: function () { if (box.parentNode) box.parentNode.removeChild(box); } };
  };
})();
