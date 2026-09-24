// Ikorka Shop — курс новачка. Клієнтський скрипт: кільця статистики + чек-листи (localStorage).
(function () {
  function polarPoint(cx, cy, r, angle) {
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }
  function renderRing(svg) {
    var total = parseInt(svg.getAttribute('data-total'), 10) || 0;
    var active = parseInt(svg.getAttribute('data-active'), 10) || 0;
    var color = svg.getAttribute('data-color') || '#2150F0';
    var inactive = '#DEE6F2';
    var cx = 60, cy = 60, r = 46, dotR = 6.4;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < total; i++) {
      var angle = (i / total) * Math.PI * 2 - Math.PI / 2;
      var p = polarPoint(cx, cy, r, angle);
      var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', p.x.toFixed(2));
      c.setAttribute('cy', p.y.toFixed(2));
      c.setAttribute('r', dotR);
      c.setAttribute('fill', i < active ? color : inactive);
      frag.appendChild(c);
    }
    svg.appendChild(frag);
  }
  try {
    var rings = document.querySelectorAll('svg[data-ring]');
    for (var i = 0; i < rings.length; i++) renderRing(rings[i]);
  } catch (e) { /* ігноруємо — кільце просто не намалюється */ }
})();

(function () {
  try {
    var KEY = 'ikorka-course-checks';
    var store;
    try { store = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { store = {}; }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
    var items = document.querySelectorAll('.check-item[data-check-id]');
    for (var i = 0; i < items.length; i++) {
      (function (el) {
        var id = el.getAttribute('data-check-id');
        var input = el.querySelector('input[type="checkbox"]');
        if (!input) return;
        if (store[id]) input.checked = true;
        function sync() {
          el.classList.toggle('checked', input.checked);
          store[id] = input.checked;
          save();
        }
        sync();
        el.addEventListener('click', function (e) {
          if (e.target === input) { setTimeout(sync, 0); return; }
          e.preventDefault();
          input.checked = !input.checked;
          sync();
        });
      })(items[i]);
    }
  } catch (e) { /* localStorage недоступний (приватний режим тощо) — курс працює і без збереження стану */ }
})();
