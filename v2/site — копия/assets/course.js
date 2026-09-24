// Ikorka Shop — курс новачка: пошук, озвучення уроку, відео, прогрес, повторення.
(function () {
  var META = document.getElementById('page-meta');
  var SLUG = META ? META.getAttribute('data-slug') : '';
  var KIND = META ? META.getAttribute('data-kind') : '';

  function load(key, def) { try { return JSON.parse(localStorage.getItem(key)) || def; } catch (e) { return def; } }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- Один звук за раз: зупинити все, що грає ----------
  function stopAllMedia(except) {
    if (except !== 'tts' && window.speechSynthesis) { try { speechSynthesis.cancel(); } catch (e) {} if (window.__ttsReset) window.__ttsReset(); }
    if (except !== 'video') document.querySelectorAll('.video-embed').forEach(function (v) { v.remove(); });
    document.querySelectorAll('.video-play[aria-pressed="true"]').forEach(function (b) { if (except !== 'video') { b.setAttribute('aria-pressed', 'false'); b.textContent = '▶ Дивитися тут'; } });
  }
  window.addEventListener('pagehide', function () { stopAllMedia(); });
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}

  // ---------- Пошук ----------
  var DAYS = { 'den-01': ['urok-01', 'urok-02', 'urok-03'], 'den-02': ['urok-04', 'urok-05'], 'den-03': ['urok-06', 'urok-07', 'urok-08'], 'den-04': ['urok-09', 'urok-10', 'urok-11'], 'den-05': ['urok-12'] };
  var STOPWORDS = { 'не': 1, 'получается': 1, 'виходить': 1, 'как': 1, 'що': 1, 'что': 1, 'клиент': 1, 'клієнт': 1 };
  function norm(s) { return String(s).toLowerCase().replace(/[’ʼ`']/g, "'").replace(/ё/g, 'е'); }
  function stems(q) {
    var all = norm(q).split(/[^a-zа-яіїєґ0-9']+/i).filter(function (w) { return w.length > 1; }).map(function (w) { return w.length > 5 ? w.slice(0, w.length - 2) : w; });
    var meaningful = all.filter(function (w) { return !STOPWORDS[w]; });
    return meaningful.length ? meaningful : all;
  }
  var form = document.querySelector('.search-box');
  if (form && window.COURSE_INDEX) {
    var input = form.querySelector('input'), box = form.querySelector('.search-results'), timer;
    function run() {
      var st = stems(input.value);
      if (!st.length) { box.hidden = true; return; }

      // Say-картки («Скажи так») — завжди першими: шукаємо і по ситуації/фразі, і по прихованих «ключі».
      var sayHits = [];
      (window.COURSE_SAY || []).forEach(function (c) {
        var t = norm(c.sit + ' ' + c.say + ' ' + (c.keys || []).join(' '));
        if (!st.every(function (w) { return t.indexOf(w) >= 0; })) return;
        sayHits.push(c);
      });

      var hits = [];
      window.COURSE_INDEX.forEach(function (p) {
        p.s.forEach(function (sec) {
          var t = norm(sec.x + ' ' + sec.h);
          if (!st.every(function (w) { return t.indexOf(w) >= 0; })) return;
          var i = t.indexOf(st[0]), from = Math.max(0, i - 60);
          var snip = esc(sec.x.slice(from, from + 170));
          st.forEach(function (w) { snip = snip.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[а-яіїєґ\'a-z]*)', 'ig'), '<mark>$1</mark>'); });
          hits.push({ u: p.u + (sec.id ? '#' + sec.id : ''), t: p.t + (sec.h ? ' › ' + sec.h : ''), snip: snip, score: t.split(st[0]).length });
        });
      });
      hits.sort(function (a, b) { return b.score - a.score; });

      var sayHtml = sayHits.length
        ? '<div class="search-say-block"><span class="search-say-label">Скажи так</span>' + sayHits.slice(0, 6).map(function (c) {
          return '<a class="search-say-hit" href="' + c.u + '#' + c.id + '"><b>' + esc(c.sit) + '</b><span>' + esc(c.say.slice(0, 160)) + '</span></a>';
        }).join('') + '</div>'
        : '';
      var restHtml = hits.length
        ? hits.slice(0, 20).map(function (h) { return '<a href="' + h.u + '"><b>' + esc(h.t) + '</b><span>…' + h.snip + '…</span></a>'; }).join('')
        : (sayHits.length ? '' : (window.COURSE_HAS_SOS ? '<p class="none">Нічого не знайдено. <a href="sos.html">Відкрий SOS: скажи так</a></p>' : '<p class="none">Нічого не знайдено. Спробуй інше слово.</p>'));

      box.innerHTML = sayHtml + restHtml;
      box.hidden = false;
    }
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 150); });
    form.addEventListener('submit', function (e) { e.preventDefault(); var a = box.querySelector('a'); if (a) location.href = a.href; });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape') { box.hidden = true; input.blur(); } });
    document.addEventListener('click', function (e) { if (!form.contains(e.target)) box.hidden = true; });
  }

  // ---------- Копіювати фразу («Скажи так») ----------
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.say-copy');
    if (!b) return;
    var text = b.getAttribute('data-copy') || '';
    var done = b.getAttribute('data-copied-label') || 'Скопійовано';
    var def = b.getAttribute('data-default-label') || b.textContent;
    function mark() {
      b.textContent = done; b.classList.add('copied');
      setTimeout(function () { b.textContent = def; b.classList.remove('copied'); }, 1800);
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(mark).catch(function () { fallbackCopy(text, mark); });
      } else {
        fallbackCopy(text, mark);
      }
    } catch (err) { fallbackCopy(text, mark); }
  });
  function fallbackCopy(text, cb) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      cb();
    } catch (e) {}
  }

  // ---------- SOS: живий фільтр карток ----------
  if (KIND === 'sos') {
    var sosInput = document.getElementById('sos-filter');
    var sosCards = [].slice.call(document.querySelectorAll('.say-card'));
    if (sosInput && sosCards.length) {
      sosInput.addEventListener('input', function () {
        var st = stems(sosInput.value);
        var shown = 0;
        sosCards.forEach(function (card) {
          var t = norm(card.textContent + ' ' + (card.getAttribute('data-keys') || ''));
          var ok = !st.length || st.every(function (w) { return t.indexOf(w) >= 0; });
          card.classList.toggle('is-hidden', !ok);
          if (ok) shown++;
        });
        var empty = document.getElementById('sos-empty-msg');
        if (!shown) {
          if (!empty) {
            empty = el('p', 'sos-empty', 'Нічого не знайдено. Спробуй інше слово.');
            empty.id = 'sos-empty-msg';
            sosCards[sosCards.length - 1].parentNode.appendChild(empty);
          }
        } else if (empty) { empty.remove(); }
      });
    }
  }

  var lesson = document.querySelector('.lesson');

  // ---------- Час читання ----------
  if (lesson && /urok|day|vstup|chzv/.test(KIND)) {
    var words = (lesson.innerText || '').split(/\s+/).length;
    var eb = document.querySelector('.cover-eyebrow');
    if (eb) eb.appendChild(el('span', 'readtime', ' · ≈ ' + Math.max(1, Math.round(words / 170)) + ' хв читання'));
  }

  // ---------- Челендж дня ----------
  var ch = document.getElementById('chelendzh-dnia');
  if (ch) { ch.classList.add('challenge-h'); var nx = ch.nextElementSibling; if (nx) nx.classList.add('challenge-text'); }

  // ---------- Питання на старт ----------
  if (KIND === 'urok') {
    var qh = document.getElementById('perevir-sebe'), firstQ = null, n = qh;
    while (n && (n = n.nextElementSibling) && n.tagName !== 'H2') { if (/^\s*1\./.test(n.textContent)) { firstQ = n; break; } }
    var firstH2 = lesson && lesson.querySelector('h2');
    if (firstQ && firstH2) {
      var hook = el('div', 'hook', '<div class="hook-label">Питання на старт</div><div class="hook-q">' + esc(firstQ.querySelector('strong') ? firstQ.querySelector('strong').textContent : firstQ.textContent.split('\n')[0]).replace(/^\s*1\.\s*/, '') + '</div><a href="#perevir-sebe">Спробуй відповісти подумки. Перевіриш себе в кінці уроку ↓</a>');
      firstH2.parentNode.insertBefore(hook, firstH2);
    }
  }

  // ---------- Озвучення: «Слухати урок» ----------
  if (lesson && window.speechSynthesis && /urok|day|vstup|chzv/.test(KIND)) {
    var parts = [].slice.call(lesson.querySelectorAll('h2,h3,p,li')).filter(function (e) {
      return !e.closest('details,.hook,.tts') && (e.innerText || '').trim().length > 2 && !(e.tagName === 'P' && e.closest('li'));
    });
    var bar = el('div', 'tts', '<button type="button" class="tts-play" aria-label="Слухати урок">▶ Слухати урок</button>' +
      '<button type="button" class="tts-stop" aria-label="Стоп" disabled>■ Стоп</button>' +
      '<input type="range" class="tts-seek" min="0" max="' + (parts.length - 1) + '" value="0" aria-label="Фрагмент уроку">' +
      '<span class="tts-pos">1 / ' + parts.length + '</span>' +
      '<select class="tts-rate" aria-label="Швидкість"><option value="0.85">0.85×</option><option value="1" selected>1×</option><option value="1.2">1.2×</option><option value="1.5">1.5×</option></select>' +
      '<span class="tts-note"></span>');
    var cover = document.querySelector('main > .mockup-panel');
    if (cover) cover.parentNode.insertBefore(bar, cover.nextSibling);
    var bPlay = bar.querySelector('.tts-play'), bStop = bar.querySelector('.tts-stop'), seek = bar.querySelector('.tts-seek'), pos = bar.querySelector('.tts-pos'), rate = bar.querySelector('.tts-rate'), note = bar.querySelector('.tts-note');
    var idx = 0, state = 'stop', voice = null, token = 0;
    function pickVoice() { var v = speechSynthesis.getVoices(); voice = v.filter(function (x) { return /^uk/i.test(x.lang); })[0] || null; note.textContent = voice || !v.length ? '' : 'Українського голосу в браузері немає, читатиме голос за замовчуванням'; }
    pickVoice(); speechSynthesis.onvoiceschanged = pickVoice;
    function mark() { parts.forEach(function (p, i) { p.classList.toggle('tts-current', state !== 'stop' && i === idx); }); seek.value = idx; pos.textContent = (idx + 1) + ' / ' + parts.length; }
    function ui() { bPlay.textContent = state === 'play' ? '❚❚ Пауза' : (state === 'pause' ? '▶ Продовжити' : '▶ Слухати урок'); bStop.disabled = state === 'stop'; mark(); }
    function speak() {
      var my = ++token;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(parts[idx].innerText);
      u.lang = 'uk-UA'; if (voice) u.voice = voice; u.rate = parseFloat(rate.value);
      u.onend = function () { if (my !== token || state !== 'play') return; if (idx < parts.length - 1) { idx++; ui(); speak(); } else { state = 'stop'; idx = 0; ui(); } };
      parts[idx].scrollIntoView({ block: 'center', behavior: 'smooth' });
      speechSynthesis.speak(u);
    }
    window.__ttsReset = function () { token++; state = 'stop'; ui(); };
    bPlay.addEventListener('click', function () {
      if (state === 'play') { state = 'pause'; speechSynthesis.pause(); }
      else if (state === 'pause') { state = 'play'; speechSynthesis.resume(); if (!speechSynthesis.speaking) speak(); }
      else { stopAllMedia('tts'); state = 'play'; speak(); }
      ui();
    });
    bStop.addEventListener('click', function () { token++; state = 'stop'; speechSynthesis.cancel(); ui(); });
    seek.addEventListener('input', function () { idx = parseInt(seek.value, 10); if (state === 'play') speak(); else { if (state === 'pause') { token++; speechSynthesis.cancel(); state = 'stop'; } ui(); } });
    rate.addEventListener('change', function () { if (state === 'play') speak(); });
    ui();
  }

  // ---------- Відео: вбудований плеєр із кнопкою «Закрити» ----------
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.video-play');
    if (!b) return;
    var card = b.closest('.video-card'), open = b.getAttribute('aria-pressed') === 'true';
    stopAllMedia();
    if (open) return;
    var box = el('div', 'video-embed', '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(b.getAttribute('data-yt')) + '?rel=0&autoplay=1" title="Відео" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>' +
      '<p class="video-fallback">Якщо відео не з\'явилося, відкрий його кнопкою «Дивитись на YouTube».</p>');
    card.parentNode.insertBefore(box, card.nextSibling);
    b.setAttribute('aria-pressed', 'true'); b.textContent = '■ Закрити відео';
  });

  // ---------- Прогрес: «Пройдено» ----------
  var done = load('ikorka-done', {});
  var nav = document.querySelector('.pagenav');
  if (nav && /urok|day|vstup/.test(KIND)) {
    var btn = el('button', 'done-btn'); btn.type = 'button';
    function paint() { btn.classList.toggle('on', !!done[SLUG]); btn.textContent = done[SLUG] ? '✓ Пройдено' : 'Позначити як пройдене'; }
    btn.addEventListener('click', function () { done[SLUG] = !done[SLUG]; save('ikorka-done', done); paint(); });
    paint(); nav.parentNode.insertBefore(btn, nav);
  }
  var prog = document.getElementById('course-progress');
  if (prog) {
    var all = ['vstup'].concat(Object.keys(DAYS)); Object.keys(DAYS).forEach(function (d) { all = all.concat(DAYS[d]); });
    var cnt = all.filter(function (s) { return done[s]; }).length, pct = Math.round(cnt / all.length * 100);
    var badges = Object.keys(DAYS).map(function (d, i) {
      var ok = [d].concat(DAYS[d]).every(function (s) { return done[s]; });
      return '<span class="badge-day' + (ok ? ' on' : '') + '">' + (ok ? '★' : '☆') + ' День ' + (i + 1) + '</span>';
    }).join('');
    prog.innerHTML = '<div class="prog-top"><b>Твій прогрес: ' + pct + '%</b><span>' + cnt + ' з ' + all.length + ' сторінок пройдено</span></div><div class="prog-bar"><i style="width:' + pct + '%"></i></div><div class="badges">' + badges + '</div>';
  }

  // ---------- Повторення: картки з інтервалами ----------
  var app = document.getElementById('review-app');
  if (app && window.REVIEW_CARDS) {
    var DAY = 864e5, st = load('ikorka-review', {}), now = Date.now();
    var due = window.REVIEW_CARDS.filter(function (c) { return !st[c.id] || st[c.id].due <= now; });
    var queue = due.slice(0, 12), qi = 0;
    function show() {
      if (qi >= queue.length) { app.innerHTML = '<div class="rv-card rv-empty"><h3>На сьогодні все</h3><p>Карток до повторення більше немає. Повертайся завтра: картки, які ти знав, повернуться через 2 дні, потім через тиждень і через місяць.</p></div>'; return; }
      var c = queue[qi];
      app.innerHTML = '<div class="rv-head">Картка ' + (qi + 1) + ' з ' + queue.length + ' · до повторення всього: ' + due.length + '</div>' +
        '<div class="rv-card"><a class="rv-src" href="' + c.u + '#perevir-sebe">' + esc(c.l) + '</a><h3>' + esc(c.q) + '</h3>' +
        (c.o.length ? '<ul>' + c.o.map(function (o) { return '<li>' + esc(o) + '</li>'; }).join('') + '</ul>' : '') +
        '<button type="button" class="rv-show">Показати відповідь</button><div class="rv-ans" hidden><p>' + esc(c.a) + '</p>' +
        '<div class="rv-btns"><button type="button" class="rv-no">Не знав</button><button type="button" class="rv-yes">Знав</button></div></div></div>';
      app.querySelector('.rv-show').onclick = function () { this.hidden = true; app.querySelector('.rv-ans').hidden = false; };
      app.querySelector('.rv-yes').onclick = function () { var s = st[c.id] || { step: 0 }; var gaps = [2, 7, 30]; s.due = Date.now() + gaps[Math.min(s.step, 2)] * DAY; s.step++; st[c.id] = s; save('ikorka-review', st); qi++; show(); };
      app.querySelector('.rv-no').onclick = function () { st[c.id] = { step: 0, due: Date.now() + DAY }; save('ikorka-review', st); qi++; show(); };
    }
    show();
  }
})();
