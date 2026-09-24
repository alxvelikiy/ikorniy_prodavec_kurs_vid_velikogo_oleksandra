// Ikorka Shop — синтвейв-сцена, реалістичний неоновий лосось по діагоналі, ікра, водорості,
// прогрес читання, міні-оглавлення уроку, нагорода за пройдене.
(function () {
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var uid = 0;

  // ---------- Реалістичний неоновий лосось (SVG, великий, з градієнтами і плавцями) ----------
  function salmon(cls) {
    var id = 'sg' + (uid++);
    return '<svg class="' + cls + '" viewBox="0 0 320 130" aria-hidden="true">' +
      '<defs>' +
        '<linearGradient id="body' + id + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#3A0F2E"/>' +
          '<stop offset=".36" stop-color="#FF5FA8"/>' +
          '<stop offset=".62" stop-color="#FFD3E8"/>' +
          '<stop offset="1" stop-color="#FFB199"/>' +
        '</linearGradient>' +
        '<linearGradient id="rim' + id + '" x1="0" x2="1">' +
          '<stop offset="0" stop-color="#FF2E97"/>' +
          '<stop offset=".55" stop-color="#FF8A00"/>' +
          '<stop offset="1" stop-color="#FFE45C"/>' +
        '</linearGradient>' +
        '<radialGradient id="cheek' + id + '" cx=".5" cy=".5" r=".5">' +
          '<stop offset="0" stop-color="#FF8FC2" stop-opacity=".65"/>' +
          '<stop offset="1" stop-color="#FF8FC2" stop-opacity="0"/>' +
        '</radialGradient>' +
      '</defs>' +
      '<g class="tail">' +
        '<path d="M64 65 L4 24 Q27 65 4 108 L64 65 Z" fill="rgba(255,111,170,.3)" stroke="url(#rim' + id + ')" stroke-width="3.5" stroke-linejoin="round"/>' +
        '<path d="M42 65 L16 40 M42 65 L16 92" stroke="#FFE45C" stroke-width="1.3" opacity=".55"/>' +
      '</g>' +
      '<path d="M150 22 Q173 -8 206 15 Q186 26 168 34 Z" fill="rgba(157,77,255,.3)" stroke="#9D4DFF" stroke-width="2.5"/>' +
      '<path d="M150 104 Q169 131 197 112 Q179 100 163 96 Z" fill="rgba(157,77,255,.24)" stroke="#9D4DFF" stroke-width="2.2"/>' +
      '<path d="M214 78 Q235 97 225 117 Q207 100 199 84 Z" fill="rgba(46,242,255,.28)" stroke="#2EF2FF" stroke-width="2.2"/>' +
      '<path d="M60 65 C90 17 170 5 233 22 C271 32 301 48 313 65 C301 82 271 98 233 108 C170 125 90 113 60 65 Z" fill="url(#body' + id + ')" stroke="url(#rim' + id + ')" stroke-width="4"/>' +
      '<g fill="#5A1436" opacity=".55">' +
        '<circle cx="126" cy="40" r="2.6"/><circle cx="150" cy="33" r="2.2"/><circle cx="177" cy="31" r="2.4"/>' +
        '<circle cx="140" cy="52" r="2"/><circle cx="165" cy="45" r="2.3"/><circle cx="191" cy="41" r="2"/>' +
        '<circle cx="112" cy="54" r="2.2"/><circle cx="201" cy="53" r="1.8"/>' +
      '</g>' +
      '<path d="M72 83 C121 109 211 109 289 78" fill="none" stroke="#FFE9F4" stroke-width="2" opacity=".35"/>' +
      '<path d="M257 39 Q249 65 257 91" fill="none" stroke="#C81C6E" stroke-width="2.5" opacity=".6"/>' +
      '<circle cx="271" cy="64" r="21" fill="url(#cheek' + id + ')"/>' +
      '<circle cx="281" cy="58" r="8" fill="#0A0410" stroke="#7CFF4F" stroke-width="2.2"/>' +
      '<circle cx="283.5" cy="55" r="2.4" fill="#fff"/>' +
    '</svg>';
  }

  // ---------- Синтвейв-сцена: каркасні гори + перспективна сітка (сонце/зорі — в theme.css .aura) ----------
  var scene = document.createElement('div'); scene.className = 'scene'; scene.setAttribute('aria-hidden', 'true');
  scene.innerHTML =
    '<svg class="scene-mountains" viewBox="0 0 1600 260" preserveAspectRatio="none">' +
      '<defs><linearGradient id="mtn1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9D4DFF"/><stop offset="1" stop-color="#2EF2FF" stop-opacity=".15"/></linearGradient></defs>' +
      '<polyline points="0,260 0,150 90,70 170,160 260,50 350,170 430,90 520,180 610,60 700,170 800,40 900,180 1000,80 1100,190 1200,60 1300,170 1400,90 1500,180 1600,120 1600,260" fill="none" stroke="url(#mtn1)" stroke-width="2.5"/>' +
      '<polyline points="0,260 0,190 140,140 300,200 460,130 620,205 800,120 980,205 1160,140 1340,200 1500,150 1600,190 1600,260" fill="none" stroke="#FF2E97" stroke-width="1.5" opacity=".3"/>' +
    '</svg>' +
    '<div class="scene-grid"></div>';
  document.body.insertBefore(scene, document.body.firstChild);

  // ---------- Скрим: затемнення між декораціями і контентом (theme.css .scrim) ----------
  var scrim = document.createElement('div'); scrim.className = 'scrim'; scrim.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(scrim, scene.nextSibling);

  // ---------- Фон: ікра, водорості, два великих неонових лосося по діагоналі ----------
  var back = document.createElement('div'); back.className = 'fx fx-back'; back.setAttribute('aria-hidden', 'true');
  var weeds = '';
  for (var w = 0; w < 7; w++) {
    var x = 4 + w * 15 + (w % 2) * 4, h = 120 + (w * 37) % 110, col = w % 3 === 1 ? '#39FF88' : '#9D4DFF';
    weeds += '<path class="weed" style="animation-delay:-' + w * 1.3 + 's" d="M' + x * 16 + ' 400 C' + (x * 16 - 30) + ' ' + (400 - h / 2) + ', ' + (x * 16 + 30) + ' ' + (400 - h * 0.8) + ', ' + (x * 16 - 8) + ' ' + (400 - h) + '" stroke="' + col + '"/>';
  }
  var roe = '';
  for (var r = 0; r < 22; r++) {
    roe += '<i class="roe" style="left:' + ((r * 47) % 100) + '%;width:' + (6 + (r * 7) % 9) + 'px;height:' + (6 + (r * 7) % 9) + 'px;animation-duration:' + (14 + (r * 5) % 16) + 's;animation-delay:-' + (r * 1.7) + 's"></i>';
  }
  back.innerHTML = '<svg class="weeds" viewBox="0 0 1600 400" preserveAspectRatio="none">' + weeds + '</svg>' + roe;
  document.body.appendChild(back);

  // Два великі лосося: один — з лівого нижнього кута у правий верхній, другий — назад іншим маршрутом.
  // Напівпрозорі й у mix-blend-mode:screen (fx.css), тому текст під ними лишається читабельним.
  var diagWrap = document.createElement('div'); diagWrap.setAttribute('aria-hidden', 'true');
  var diagA = document.createElement('div'); diagA.className = 'swim-diag diag-a'; diagA.innerHTML = salmon('fish');
  var diagB = document.createElement('div'); diagB.className = 'swim-diag diag-b'; diagB.innerHTML = salmon('fish');
  diagWrap.appendChild(diagA); diagWrap.appendChild(diagB);
  document.body.appendChild(diagA); document.body.appendChild(diagB);

  document.addEventListener("click", function (e) { document.querySelectorAll(".navmenu[open]").forEach(function (m) { if (!m.contains(e.target)) m.open = false; }); });

  // ---------- Нагорода: лосось випускає ікру ----------
  var busy = false;
  function celebrate(text) {
    if (busy) return; busy = true;
    var c = document.createElement('div'); c.className = 'celebrate'; c.setAttribute('role', 'status');
    var burst = '';
    for (var i = 0; i < 18; i++) {
      var ang = (i / 18) * Math.PI * 2, dist = 90 + (i * 29) % 90;
      burst += '<i style="--dx:' + Math.round(Math.cos(ang) * dist) + 'px;--dy:' + Math.round(Math.sin(ang) * dist) + 'px;animation-delay:' + (0.25 + i * 0.02) + 's"></i>';
    }
    c.innerHTML = '<div class="cel-fish">' + salmon('fish') + '</div><div class="cel-roe">' + burst + '</div><div class="cel-text">' + text + '</div>';
    document.body.appendChild(c);
    setTimeout(function () { c.remove(); busy = false; }, calm ? 1200 : 2300);
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    setTimeout(function () {
      if (t.closest('.done-btn') && t.closest('.done-btn').classList.contains('on')) celebrate('Пройдено! Ще одна ікринка у твою скарбничку');
      else if (t.closest('.rv-yes')) celebrate('Знаєш! Картка повернеться пізніше');
      else if (t.closest('.check-item') && t.closest('.check-item').classList.contains('checked')) celebrate('Пункт виконано');
    }, 30);
  });

  // ---------- Прогрес читання уроку: тонка неонова смужка зверху ----------
  var lessonEl = document.querySelector('.lesson');
  if (lessonEl) {
    var bar = document.createElement('div'); bar.className = 'read-progress'; bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    var ticking = false;
    function paintProgress() {
      ticking = false;
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var pct = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0;
      bar.style.width = pct + '%';
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(paintProgress); } }, { passive: true });
    window.addEventListener('resize', paintProgress);
    paintProgress();
  }

  // ---------- Плаваюче міні-оглавлення уроку зі scrollspy ----------
  if (lessonEl) {
    var heads = [].slice.call(lessonEl.querySelectorAll('h2[id], h3[id]'));
    var h2count = heads.filter(function (h) { return h.tagName === 'H2'; }).length;
    if (h2count >= 2) {
      var toc = document.createElement('nav'); toc.className = 'lesson-toc'; toc.setAttribute('aria-label', 'Зміст уроку');
      var linksHtml = '<span class="lt-label">На цій сторінці</span>';
      heads.forEach(function (h) {
        var cls = h.tagName === 'H3' ? ' lt-h3' : '';
        linksHtml += '<a class="' + ('lt-link' + cls) + '" href="#' + h.id + '">' + h.textContent + '</a>';
      });
      toc.innerHTML = linksHtml;
      document.body.appendChild(toc);
      var tocLinks = [].slice.call(toc.querySelectorAll('a'));
      var spyTicking = false;
      function spy() {
        spyTicking = false;
        var best = null, bestTop = -Infinity;
        heads.forEach(function (h, i) {
          var top = h.getBoundingClientRect().top;
          if (top - 110 <= 0 && top > bestTop) { bestTop = top; best = i; }
        });
        if (best === null) best = 0;
        tocLinks.forEach(function (a, i) { a.classList.toggle('active', i === best); });
      }
      window.addEventListener('scroll', function () { if (!spyTicking) { spyTicking = true; requestAnimationFrame(spy); } }, { passive: true });
      window.addEventListener('resize', spy);
      spy();
    }
  }
})();
