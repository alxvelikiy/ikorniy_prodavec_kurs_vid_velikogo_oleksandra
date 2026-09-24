// Ikorka Shop — курс новачка. Дрібна інтерактивність сторінки:
// закриття спадних меню по кліку поза ними, прогрес читання уроку,
// плаваюче міні-оглавлення зі scrollspy.
(function () {
  // ---------- Перемикач теми (токени light/dark у assets/tokens.css) ----------
  var themeBtn = document.querySelector('.theme-btn');
  if (themeBtn) {
    var root = document.documentElement;
    var paint = function () {
      var dark = root.getAttribute('data-theme') === 'dark';
      var label = dark ? 'Світла тема' : 'Темна тема';
      themeBtn.setAttribute('aria-label', label);
      themeBtn.setAttribute('title', label);
      themeBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    };
    paint();
    themeBtn.addEventListener('click', function () {
      var dark = root.getAttribute('data-theme') !== 'dark';
      if (dark) root.setAttribute('data-theme', 'dark'); else root.removeAttribute('data-theme');
      try { localStorage.setItem('ikorka-theme', dark ? 'dark' : 'light'); } catch (e) {}
      paint();
    });
  }

  document.addEventListener('click', function (e) {
    document.querySelectorAll('.navmenu[open]').forEach(function (m) {
      if (!m.contains(e.target)) m.open = false;
    });
  });

  // ---------- Мобільне меню (гамбургер) ----------
  var navToggle = document.querySelector('.nav-toggle');
  var siteNav = document.getElementById('site-nav');
  if (navToggle && siteNav) {
    navToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = siteNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (siteNav.classList.contains('open') && !siteNav.contains(e.target) && e.target !== navToggle) {
        siteNav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ---------- Прогрес читання уроку: тонка смужка зверху ----------
  var lessonEl = document.querySelector('.lesson');
  if (lessonEl) {
    var bar = document.createElement('div');
    bar.className = 'read-progress';
    bar.setAttribute('aria-hidden', 'true');
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
      var toc = document.createElement('nav');
      toc.className = 'lesson-toc';
      toc.setAttribute('aria-label', 'Зміст уроку');
      var linksHtml = '<span class="lt-label">На цій сторінці</span>';
      heads.forEach(function (h) {
        var cls = h.tagName === 'H3' ? ' lt-h3' : '';
        linksHtml += '<a class="' + ('lt-link' + cls) + '" href="#' + h.id + '">' + h.textContent + '</a>';
      });
      toc.innerHTML = linksHtml;
      document.body.appendChild(toc);
      // вузькі екрани: той самий зміст — згорнутим блоком на початку уроку
      var inl = document.createElement('details');
      inl.className = 'toc-inline';
      var h2n = heads.filter(function (h) { return h.tagName === 'H2'; });
      inl.innerHTML = '<summary>Зміст уроку · ' + h2n.length + ' розділів</summary><ol>' +
        h2n.map(function (h) { return '<li><a href="#' + h.id + '">' + h.textContent + '</a></li>'; }).join('') + '</ol>';
      lessonEl.insertBefore(inl, lessonEl.firstChild);
      inl.addEventListener('click', function (e) { if (e.target.tagName === 'A') inl.open = false; });
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
