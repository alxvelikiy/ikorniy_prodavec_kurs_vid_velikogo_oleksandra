// Ikorka Shop — акаунти й синхронізація прогресу (публічний деплой, зріз 1).
// Працює лише коли assets/supabase-config.js згенеровано (SUPABASE_URL/SUPABASE_ANON_KEY задані при збірці).
// Без цього файл не підключається взагалі (build.mjs) — сайт лишається офлайн-only, як і раніше.
//
// Модель синхронізації: локальний стан (window.MVP.st, той самий localStorage «ikorka-mvp») лишається
// єдиним джерелом істини на цьому пристрої, коли не залогинено. Коли залогинено — раз на кілька секунд
// порівнюється з хмарою за монотонним лічильником _rev: новіший rev перемагає повністю (без злиття полів).
// Це проста модель «останній синхронізований виграє», без одночасного редагування з двох пристроїв.
(function () {
  'use strict';
  if (!window.SUPABASE_CONFIG || !window.supabase || !window.MVP) return;
  var CFG = window.SUPABASE_CONFIG;
  var sb = window.supabase.createClient(CFG.url, CFG.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  var MVP = window.MVP;
  var POLL_MS = 4000;
  var session = null;
  var lastSnapshot = null; // останній стан, який точно вже в хмарі (щоб не пушити без змін)
  var syncedOnce = false;
  var status = 'idle'; // idle | syncing | synced | offline | error
  var statusCb = null;

  function setStatus(s) { status = s; if (statusCb) statusCb(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ---------- синхронізація прогресу ----------
  function currentSnapshot() { try { return JSON.stringify(MVP.st); } catch (e) { return null; } }

  function pushProgress() {
    if (!session) return Promise.resolve();
    if (navigator.onLine === false) { setStatus('offline'); return Promise.resolve(); }
    var snap = currentSnapshot();
    if (snap === lastSnapshot) return Promise.resolve();
    MVP.st._rev = (MVP.st._rev || 0) + 1;
    MVP.save();
    setStatus('syncing');
    var row = { user_id: session.user.id, state: MVP.st, rev: MVP.st._rev, updated_at: new Date().toISOString() };
    return sb.from('progress').upsert(row, { onConflict: 'user_id' }).then(function (r) {
      if (r.error) { setStatus('error'); return; }
      lastSnapshot = currentSnapshot();
      setStatus('synced');
    }).catch(function () { setStatus('error'); });
  }

  function reloadOnce() {
    try { if (sessionStorage.getItem('acct_synced_once')) return; sessionStorage.setItem('acct_synced_once', '1'); } catch (e) { /* без sessionStorage — просто не перезавантажуємо */ return; }
    location.reload();
  }

  // Перший раз після входу: хмара новіша (більший rev) → перезаписуємо локальний стан і перезавантажуємось;
  // локальний новіший або хмари ще немає → відправляємо локальний стан у хмару.
  function pullThenReconcile() {
    if (navigator.onLine === false) { setStatus('offline'); return Promise.resolve(); }
    setStatus('syncing');
    return sb.from('progress').select('state,rev').eq('user_id', session.user.id).maybeSingle().then(function (r) {
      if (r.error) { setStatus('error'); return; }
      var cloud = r.data;
      var localRev = (MVP.st && MVP.st._rev) || 0;
      if (cloud && cloud.rev > localRev) {
        var sanitized = MVP.sanitizeState(cloud.state);
        if (sanitized) {
          sanitized._rev = cloud.rev;
          MVP.replaceState(sanitized);
          lastSnapshot = currentSnapshot();
          setStatus('synced');
          reloadOnce();
          return;
        }
      }
      lastSnapshot = null; // примусово даємо push нижче побачити «є що відправити», навіть якщо rev рівні
      return pushProgress();
    }).catch(function () { setStatus('error'); });
  }

  var pollTimer = null;
  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(function () { pushProgress(); }, POLL_MS);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') pushProgress(); });
    window.addEventListener('pagehide', function () { pushProgress(); });
  }
  function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

  // ---------- профіль (роль) ----------
  function fetchProfile() {
    if (!session) return Promise.resolve(null);
    return sb.from('profiles').select('role,display_name').eq('id', session.user.id).maybeSingle().then(function (r) { return r.error ? null : r.data; });
  }

  // ---------- віджет у топнаві (усі сторінки) ----------
  function renderWidget() {
    var el = document.getElementById('acct-widget');
    if (!el) return;
    if (!session) { el.innerHTML = '<a class="acct-link" href="account.html">Увійти</a>'; return; }
    fetchProfile().then(function (p) {
      var label = (p && p.display_name) || session.user.email.split('@')[0];
      el.innerHTML = '<a class="acct-link" href="account.html">' + esc(label) + (p && p.role === 'mentor' ? ' <span class="acct-role">керівник</span>' : '') + '</a>';
    });
  }

  // ---------- сторінка account.html ----------
  function renderAccountPage() {
    var app = document.getElementById('account-app');
    if (!app) return;
    function show() {
      if (!session) {
        app.innerHTML =
          '<div class="sos-tabs acct-tabs" role="tablist" aria-label="Вхід або реєстрація"><button type="button" class="sos-tab on" aria-selected="true" data-tab="in">Увійти</button><button type="button" class="sos-tab" aria-selected="false" data-tab="up">Зареєструватися</button></div>' +
          '<form class="coach-form acct-pane" data-pane="in"><label class="sos-label" for="acct-email-in">Пошта</label><input id="acct-email-in" type="email" required autocomplete="email">' +
          '<label class="sos-label" for="acct-pass-in">Пароль</label><input id="acct-pass-in" type="password" required autocomplete="current-password">' +
          '<div class="mvp-row"><button type="submit" class="mvp-btn primary">Увійти</button><span class="acct-msg" aria-live="polite"></span></div></form>' +
          '<form class="coach-form acct-pane" data-pane="up" hidden><label class="sos-label" for="acct-email-up">Пошта</label><input id="acct-email-up" type="email" required autocomplete="email">' +
          '<label class="sos-label" for="acct-pass-up">Пароль (мінімум 6 символів)</label><input id="acct-pass-up" type="password" required minlength="6" autocomplete="new-password">' +
          '<div class="mvp-row"><button type="submit" class="mvp-btn primary">Зареєструватися</button><span class="acct-msg" aria-live="polite"></span></div>' +
          '<p class="mvp-hint">Роль «новачок» призначається автоматично. Роль «керівник» призначає власник курсу окремо.</p></form>';
        var tabs = app.querySelectorAll('.acct-tabs .sos-tab');
        [].forEach.call(tabs, function (tb) {
          tb.addEventListener('click', function () {
            [].forEach.call(tabs, function (x) { var on = x === tb; x.classList.toggle('on', on); x.setAttribute('aria-selected', on ? 'true' : 'false'); });
            [].forEach.call(app.querySelectorAll('.acct-pane'), function (p) { p.hidden = p.getAttribute('data-pane') !== tb.getAttribute('data-tab'); });
          });
        });
        app.querySelector('[data-pane="in"]').addEventListener('submit', function (e) {
          e.preventDefault();
          var msg = this.querySelector('.acct-msg'); msg.textContent = 'Вхід…';
          sb.auth.signInWithPassword({ email: app.querySelector('#acct-email-in').value.trim(), password: app.querySelector('#acct-pass-in').value }).then(function (r) {
            msg.textContent = r.error ? offlineOrError(r.error) : '';
          });
        });
        app.querySelector('[data-pane="up"]').addEventListener('submit', function (e) {
          e.preventDefault();
          var msg = this.querySelector('.acct-msg'); msg.textContent = 'Реєстрація…';
          sb.auth.signUp({ email: app.querySelector('#acct-email-up').value.trim(), password: app.querySelector('#acct-pass-up').value }).then(function (r) {
            msg.textContent = r.error ? offlineOrError(r.error) : 'Готово. Якщо потрібне підтвердження пошти — перевір лист.';
          });
        });
      } else {
        fetchProfile().then(function (p) {
          var roleLabel = p && p.role === 'mentor' ? 'керівник' : 'новачок';
          app.innerHTML = '<p class="mvp-card-title">Мій акаунт</p>' +
            '<p>Пошта: <b>' + esc(session.user.email) + '</b><br>Роль: <b>' + esc(roleLabel) + '</b></p>' +
            '<p class="acct-sync-line mvp-muted" aria-live="polite"></p>' +
            '<div class="mvp-row"><button type="button" class="mvp-btn acct-signout">Вийти</button></div>';
          renderSyncLine();
          statusCb = renderSyncLine;
          app.querySelector('.acct-signout').addEventListener('click', function () { sb.auth.signOut(); });
        });
      }
    }
    function renderSyncLine() {
      var line = app.querySelector('.acct-sync-line');
      if (!line) return;
      var map = { idle: 'Синхронізація ще не запускалась.', syncing: 'Синхронізую з хмарою…', synced: 'Прогрес синхронізовано з хмарою.', offline: 'Немає зв’язку — працюю лише локально, спробую пізніше.', error: 'Помилка синхронізації — прогрес лишається локально, спробую пізніше.' };
      line.textContent = map[status] || '';
    }
    sb.auth.onAuthStateChange(function () { show(); });
    show();
  }

  function offlineOrError(err) {
    var m = String((err && err.message) || '');
    return /invalid login credentials/i.test(m) ? 'Невірна пошта або пароль.' : /already registered|user already exists/i.test(m) ? 'Ця пошта вже зареєстрована.' : m || 'Сталася помилка.';
  }

  // ---------- ініціалізація ----------
  window.addEventListener('online', function () { pushProgress(); });
  sb.auth.getSession().then(function (r) {
    session = r.data && r.data.session;
    renderWidget();
    renderAccountPage();
    if (session) { startPolling(); pullThenReconcile(); }
  });
  sb.auth.onAuthStateChange(function (event, s) {
    var was = !!session;
    session = s;
    renderWidget();
    if (session && !was) { startPolling(); pullThenReconcile(); }
    if (!session && was) { stopPolling(); lastSnapshot = null; }
  });

  window.ACCOUNT = { pushProgress: pushProgress, sb: sb };
})();
