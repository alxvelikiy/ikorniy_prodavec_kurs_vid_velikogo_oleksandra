// Ikorka Shop — акаунти й синхронізація прогресу (публічний деплой, зріз 1).
// Працює лише коли assets/supabase-config.js згенеровано (SUPABASE_URL/SUPABASE_ANON_KEY задані при
// збірці). Без цього файл не підключається взагалі (build.mjs) — сайт лишається офлайн-only, як і раніше.
// supabase-js — локальний вендорний файл assets/vendor/supabase-js.js (не CDN): той самий файл
// використовують і продакшн, і тести. Джерело й версія — v2/build/assets/vendor/README.md.
//
// Реєстрація — лише за запрошенням: публічного signup немає, керівник запрошує новачка поштою через
// Supabase Dashboard (Authentication → Users → Invite user). Новачок переходить за посиланням із листа,
// це відкриває сторінку з формою «встановити пароль» (подія PASSWORD_RECOVERY — той самий механізм, що й
// відновлення пароля).
//
// Синхронізація прогресу — злиття, не «останній виграє»: пройдені уроки/тести — union по кожному уроку
// (найкращий результат з обох пристроїв), повторення — union карток із «дальшим» станом (більший
// due/step), симулятор і особиста колода — union за id. Деталі — mergeState() нижче.
(function () {
  'use strict';
  if (!window.SUPABASE_CONFIG || !window.supabase || !window.MVP) return;
  var CFG = window.SUPABASE_CONFIG;
  var sb = window.supabase.createClient(CFG.url, CFG.anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  var MVP = window.MVP;
  var PUSH_MS = 4000; // локальні зміни → хмара
  var RECONCILE_MS = 20000; // повне злиття з хмарою (може прийти прогрес з іншого пристрою)
  var RELOAD_COOLDOWN_MS = 15000;
  var session = null;
  var lastSnapshot = null; // останній локальний стан, який точно вже в хмарі (щоб не пушити без змін)
  var lastReloadAt = 0;
  var status = 'idle'; // idle | syncing | synced | offline | error
  var statusCb = null;

  function setStatus(s) { status = s; if (statusCb) statusCb(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // =====================================================================
  // Злиття прогресу двох пристроїв (union / max по кожному полю).
  // =====================================================================
  function keys(a, b) { var s = {}; Object.keys(a || {}).forEach(function (k) { s[k] = 1; }); Object.keys(b || {}).forEach(function (k) { s[k] = 1; }); return Object.keys(s); }
  function byId(list) { var m = {}; (list || []).forEach(function (x) { if (x && x.id != null) m[x.id] = x; }); return m; }
  function mergeById(a, b) {
    var m = byId(a); var mb = byId(b);
    Object.keys(mb).forEach(function (id) { m[id] = mb[id]; }); // ідентичні за id записи — беремо будь-який
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (p, q) { return (p.t || 0) - (q.t || 0); });
  }
  function mergeByT(a, b) {
    var m = {};
    (a || []).concat(b || []).forEach(function (x) { if (x) m[x.t] = x; });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (p, q) { return (p.t || 0) - (q.t || 0); });
  }
  function mergeLessons(a, b) {
    a = a || {}; b = b || {};
    var out = {};
    keys(a, b).forEach(function (k) {
      var x = a[k], y = b[k];
      if (!x) { out[k] = y; return; } if (!y) { out[k] = x; return; }
      var tries = {};
      Object.keys(x.tries || {}).forEach(function (id) { tries[id] = x.tries[id]; });
      Object.keys(y.tries || {}).forEach(function (id) {
        var xt = tries[id];
        tries[id] = (!xt || (y.tries[id].t || 0) >= (xt.t || 0)) ? y.tries[id] : xt;
      });
      var test = null;
      if (x.test && y.test) {
        var better = (y.test.pct || 0) >= (x.test.pct || 0) ? y.test : x.test;
        test = { passed: !!(x.test.passed || y.test.passed), pct: Math.max(x.test.pct || 0, y.test.pct || 0), runs: Math.max(x.test.runs || 0, y.test.runs || 0), conf: better.conf, t: Math.max(x.test.t || 0, y.test.t || 0) };
      } else test = x.test || y.test || null;
      out[k] = { tries: tries, test: test };
    });
    return out;
  }
  function mergeReview(a, b) {
    a = a || {}; b = b || {};
    var out = {};
    keys(a, b).forEach(function (k) {
      var x = a[k], y = b[k];
      if (!x) { out[k] = y; return; } if (!y) { out[k] = x; return; }
      out[k] = { step: Math.max(x.step || 0, y.step || 0), due: Math.max(x.due || 0, y.due || 0), lapses: Math.max(x.lapses || 0, y.lapses || 0), added: Math.min(x.added || Infinity, y.added || Infinity) };
    });
    return out;
  }
  function mergeSim(a, b) {
    a = a || {}; b = b || {};
    var out = {};
    keys(a, b).forEach(function (k) {
      var x = a[k], y = b[k];
      if (!x) { out[k] = y; return; } if (!y) { out[k] = x; return; }
      var tried = {}; (x.tried || []).concat(y.tried || []).forEach(function (i) { tried[i] = 1; });
      var earlier = (x.tried || []).length && (y.tried || []).length ? ((x.t || 0) <= (y.t || 0) ? x : y) : ((x.tried || []).length ? x : y);
      out[k] = { solved: !!(x.solved || y.solved), tried: Object.keys(tried).map(Number), firstGood: earlier.firstGood, t: Math.max(x.t || 0, y.t || 0) };
    });
    return out;
  }
  function mergeByKeyMaxT(a, b) {
    a = a || {}; b = b || {};
    var out = {};
    keys(a, b).forEach(function (k) { var x = a[k], y = b[k]; out[k] = (!x) ? y : (!y) ? x : ((x.t || 0) >= (y.t || 0) ? x : y); });
    return out;
  }
  function mergeByKeyMaxNum(a, b) { a = a || {}; b = b || {}; var out = {}; keys(a, b).forEach(function (k) { out[k] = Math.max(a[k] || 0, b[k] || 0); }); return out; }
  function mergeDaily(a, b) {
    a = a || {}; b = b || {};
    var out = {};
    keys(a, b).forEach(function (k) { out[k] = { reviewed: Math.max((a[k] && a[k].reviewed) || 0, (b[k] && b[k].reviewed) || 0) }; });
    return out;
  }
  function laterByT(a, b) { if (!a) return b; if (!b) return a; return (a.t || 0) >= (b.t || 0) ? a : b; }
  function mergeGoal(a, b) { if (!a) return b; if (!b) return a; if (a.set !== b.set) return a.set > b.set ? a : b; return a.answered != null ? a : b; }
  function mergeGoalsHistory(a, b) {
    var m = {}; (a || []).concat(b || []).forEach(function (g) { if (g && g.set) m[g.set] = g; });
    return Object.keys(m).sort().map(function (k) { return m[k]; });
  }
  // _rev і _gen — клієнтські службові поля (лічильник ревізії й покоління, дзеркалять колонки rev/
  // generation у progress), не «вміст» прогресу; MVP.sanitizeState() їх ніколи не повертає (не входять
  // у канонічний blank()), тож порівняння без цього стриппінгу завжди бачило б розбіжність там, де її
  // немає, щойно generation стає ненульовим.
  function stripRev(o) { var c = {}; for (var k in o) if (k !== '_rev' && k !== '_gen') c[k] = o[k]; return c; }
  // Порівняння НЕ через JSON.stringify: MVP.sanitizeState() завжди перебудовує стан у канонічному
  // порядку полів (Object.keys(blank())), а mergeState() нижче успадковує порядок полів свого base —
  // рядки JSON із однаковим вмістом, але різним порядком ключів, не рівні як текст, хоча як дані —
  // ідентичні. Раніше це змушувало reconcile() вважати стан «зміненим» без жодної реальної різниці й
  // подекуди перезавантажувати сторінку повторно без причини.
  // Ключі зі значенням undefined (напр. test.conf, коли жоден бік його не має) рахуємо як відсутні —
  // так само, як їх трактує JSON.stringify при збереженні в localStorage/мережу; інакше свіжопорахований
  // merged (де такий ключ ще є, хай і undefined) ніколи не зрівняється зі стороною, що вже пройшла через
  // JSON (де ключ мовчки зникає), і reconcile() перезавантажував би сторінку в нескінченному циклі.
  function ownKeys(o) { return Object.keys(o).filter(function (k) { return o[k] !== undefined; }); }
  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null) return a === b;
    if (typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
      return true;
    }
    var ak = ownKeys(a), bk = ownKeys(b);
    if (ak.length !== bk.length) return false;
    for (var j = 0; j < ak.length; j++) {
      var k = ak[j];
      if (!deepEqual(a[k], b[k])) return false;
    }
    return true;
  }
  function stateEqual(a, b) { try { return deepEqual(stripRev(a), stripRev(b)); } catch (e) { return false; } }

  // Базовий знімок — новіший за rev (для полів, які тут не описані явно); явно перелічені поля
  // зливаються по суті (union/max), а не заміняються цілком.
  function mergeState(local, cloud) {
    local = local || {}; cloud = cloud || {};
    var base = (cloud._rev || 0) >= (local._rev || 0) ? cloud : local;
    var out = JSON.parse(JSON.stringify(base));
    out.created = Math.min(local.created || Date.now(), cloud.created || Date.now());
    out.days = Object.assign({}, local.days, cloud.days);
    out.lessons = mergeLessons(local.lessons, cloud.lessons);
    out.review = mergeReview(local.review, cloud.review);
    out.daily = mergeDaily(local.daily, cloud.daily);
    out.sim = mergeSim(local.sim, cloud.sim);
    out.deck = mergeById(local.deck, cloud.deck);
    out.final = mergeByT(local.final, cloud.final);
    out.goal = mergeGoal(local.goal, cloud.goal);
    out.goals = mergeGoalsHistory(local.goals, cloud.goals);
    out.pos = mergeByKeyMaxT(local.pos, cloud.pos);
    out.last = laterByT(local.last, cloud.last);
    out.sections = mergeByKeyMaxNum(local.sections, cloud.sections);
    return out;
  }
  window.ACCOUNT_MERGE = mergeState; // для автотестів (v2/mvp/tests/merge-unit.mjs)

  // =====================================================================
  // Синхронізація: періодичний push локальних змін + періодичне злиття (reconcile) з хмарою.
  // =====================================================================
  function currentSnapshot() { try { return JSON.stringify(MVP.st); } catch (e) { return null; } }

  // Захист від паралельних викликів (таймер + ручний виклик, visibilitychange, pagehide тощо) —
  // без нього два одночасних pushProgress() можуть піти в мережу як два окремі upsert-запити майже
  // одночасно, і один із них інколи падає з ERR_ABORTED (гонитва в браузері/мок-сервері).
  var pushInFlight = null;
  function pushProgress() {
    if (!session) return Promise.resolve();
    if (navigator.onLine === false) { setStatus('offline'); return Promise.resolve(); }
    if (pushInFlight) return pushInFlight;
    var snap = currentSnapshot();
    if (snap === lastSnapshot) return Promise.resolve();
    MVP.st._rev = (MVP.st._rev || 0) + 1;
    MVP.save();
    setStatus('syncing');
    var row = { user_id: session.user.id, state: MVP.st, rev: MVP.st._rev, updated_at: new Date().toISOString() };
    pushInFlight = sb.from('progress').upsert(row, { onConflict: 'user_id' }).then(function (r) {
      pushInFlight = null;
      if (r.error) { setStatus('error'); return; }
      lastSnapshot = currentSnapshot();
      setStatus('synced');
    }).catch(function () { pushInFlight = null; setStatus('error'); });
    return pushInFlight;
  }

  function reloadOnce() {
    var now = Date.now();
    if (now - lastReloadAt < RELOAD_COOLDOWN_MS) return; // щойно вже перезавантажували — не смикати сторінку знову
    lastReloadAt = now;
    location.reload();
  }

  // Повне злиття: тягне хмарний рядок, зливає з локальним (union/max), і якщо результат відрізняється
  // від будь-якого боку — записує назад той бік, який змінився (локально і/або в хмару).
  //
  // Reload — лише при першому reconcile() після входу/відкриття сторінки (isInitial): саме тоді сторінка
  // щойно завантажилась і втрачати нічого. Наступні виклики (з таймера, visibilitychange, online) під час
  // активної роботи на сторінці НЕ чіпають поточний DOM/MVP.st і НЕ перезавантажують — інакше можна
  // втратити введення в тренажері/тесті просто посеред відповіді. У хмару правильний (злитий) стан
  // однаково йде щоразу; локально він застосується природно на наступному переході (кожна сторінка тут —
  // окреме завантаження, і його власний initial reconcile() підхопить уже актуальний хмарний стан).
  var didInitialReconcile = false;
  var lastDeferredMerge = null; // щоб не пушити той самий незастосований merge щораз повторно
  var reconcileInFlight = null; // той самий захист від паралельних викликів, що й pushInFlight
  function reconcile() {
    if (!session) return Promise.resolve();
    if (navigator.onLine === false) { setStatus('offline'); return Promise.resolve(); }
    if (reconcileInFlight) return reconcileInFlight;
    var isInitial = !didInitialReconcile;
    didInitialReconcile = true;
    setStatus('syncing');
    reconcileInFlight = sb.from('progress').select('state,rev,generation').eq('user_id', session.user.id).maybeSingle().then(function (r) {
      if (r.error) { setStatus('error'); return; }
      var cloud = r.data;
      if (!cloud) return pushProgress();
      var cloudGen = cloud.generation || 0;
      var localGen = MVP.st._gen || 0;
      if (cloudGen > localGen) {
        // наставник скинув прогрес (весь або по уроку) — локальний кеш застарілий і його не зливаємо
        // (union повернув би скинутий урок назад), а приймаємо хмару як є.
        if (!isInitial) { lastSnapshot = currentSnapshot(); setStatus('synced'); return; } // застосується на наступному переході
        var fresh = MVP.sanitizeState(cloud.state) || {};
        fresh._rev = cloud.rev || 0;
        fresh._gen = cloudGen;
        MVP.replaceState(fresh);
        lastSnapshot = currentSnapshot();
        setStatus('synced');
        reloadOnce();
        return;
      }
      var sanitizedCloud = MVP.sanitizeState(cloud.state) || {};
      var merged = mergeState(MVP.st, sanitizedCloud);
      merged._gen = Math.max(localGen, cloudGen);
      var changedLocally = !stateEqual(merged, MVP.st);
      var changedFromCloud = !stateEqual(merged, sanitizedCloud);
      if (!changedLocally && !changedFromCloud) { lastSnapshot = currentSnapshot(); setStatus('synced'); return; }
      if (changedLocally && !isInitial) {
        // не чіпаємо MVP.st/DOM просто зараз — лише пушимо коректний злитий стан у хмару (щоб не
        // загубити свіжі дані з іншого пристрою), а самі не повторюємо той самий push щоразу з таймера
        var mergedSnap = JSON.stringify(stripRev(merged));
        if (mergedSnap === lastDeferredMerge) { setStatus('synced'); return; }
        lastDeferredMerge = mergedSnap;
        merged._rev = Math.max(MVP.st._rev || 0, cloud.rev || 0) + 1;
        var deferredRow = { user_id: session.user.id, state: merged, rev: merged._rev, updated_at: new Date().toISOString() };
        return sb.from('progress').upsert(deferredRow, { onConflict: 'user_id' }).then(function (r2) {
          if (r2.error) { setStatus('error'); return; }
          setStatus('synced');
        });
      }
      merged._rev = Math.max(MVP.st._rev || 0, cloud.rev || 0) + 1;
      if (changedLocally) MVP.replaceState(merged); else { MVP.st._rev = merged._rev; MVP.st._gen = merged._gen; MVP.save(); }
      lastSnapshot = currentSnapshot();
      var row = { user_id: session.user.id, state: merged, rev: merged._rev, updated_at: new Date().toISOString() };
      return sb.from('progress').upsert(row, { onConflict: 'user_id' }).then(function (r2) {
        if (r2.error) { setStatus('error'); return; }
        setStatus('synced');
        if (changedLocally) reloadOnce();
      });
    }).catch(function () { setStatus('error'); }).then(function () { reconcileInFlight = null; });
    return reconcileInFlight;
  }

  // ---------- журнал спроб (append-only, тест уроку / тренажер) — «історія спроб» у кабінеті наставника,
  // не лише останній/найкращий результат, що лишається в progress.state ----------
  function recordAttempt(a) {
    if (!session) return Promise.resolve();
    // Білдер PostgREST — thenable (є лише .then(), немає власного .catch()) — виклик .catch() напряму на
    // ньому падає з «.catch is not a function»; тому обробка помилки — другим аргументом .then().
    return sb.from('attempts').insert({
      user_id: session.user.id, lesson_n: a.lesson, kind: a.kind,
      pct: a.pct == null ? null : a.pct, passed: !!a.passed, mistakes: a.mistakes || [],
    }).then(function () {}, function () { /* найкраще з можливого — не блокує тренажер/тест офлайн чи при збої мережі */ });
  }

  var pushTimer = null, reconcileTimer = null;
  function startPolling() {
    if (pushTimer) return;
    pushTimer = setInterval(function () { pushProgress(); }, PUSH_MS);
    reconcileTimer = setInterval(function () { reconcile(); }, RECONCILE_MS);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') pushProgress(); else reconcile(); });
    window.addEventListener('pagehide', function () { pushProgress(); });
  }
  function stopPolling() { if (pushTimer) { clearInterval(pushTimer); pushTimer = null; } if (reconcileTimer) { clearInterval(reconcileTimer); reconcileTimer = null; } }

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
  // supabase-js емітить PASSWORD_RECOVERY лише коли redirectType хмари === 'recovery'; посилання-
  // запрошення мають redirectType 'invite' і дають звичайний SIGNED_IN. Тому тип читаємо напряму з
  // хеша адреси (доки supabase-js його не «з'їв») — це покриває і запрошення, і відновлення пароля.
  var pendingRecovery = /(^|[#&])type=(invite|recovery)(&|$)/.test(location.hash);
  function renderAccountPage() {
    var app = document.getElementById('account-app');
    if (!app) return;
    function showSetPassword() {
      app.innerHTML = '<p class="mvp-card-title">Встановити пароль</p><p class="mvp-muted">Це посилання із запрошення від керівника. Задай пароль для входу.</p>' +
        '<form class="coach-form acct-pane" data-pane="setpass"><label class="sos-label" for="acct-pass-new">Пароль (мінімум 6 символів)</label><input id="acct-pass-new" type="password" required minlength="6" autocomplete="new-password">' +
        '<div class="mvp-row"><button type="submit" class="mvp-btn primary">Зберегти пароль</button><span class="acct-msg" aria-live="polite"></span></div></form>';
      app.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        var msg = this.querySelector('.acct-msg'); msg.textContent = 'Зберігаю…';
        sb.auth.updateUser({ password: app.querySelector('#acct-pass-new').value }).then(function (r) {
          if (r.error) { msg.textContent = offlineOrError(r.error); return; }
          pendingRecovery = false;
          show();
        });
      });
    }
    function show() {
      if (pendingRecovery) { showSetPassword(); return; }
      if (!session) {
        app.innerHTML = '<p class="mvp-card-title">Увійти</p>' +
          '<form class="coach-form acct-pane" data-pane="in"><label class="sos-label" for="acct-email-in">Пошта</label><input id="acct-email-in" type="email" required autocomplete="email">' +
          '<label class="sos-label" for="acct-pass-in">Пароль</label><input id="acct-pass-in" type="password" required autocomplete="current-password">' +
          '<div class="mvp-row"><button type="submit" class="mvp-btn primary">Увійти</button><span class="acct-msg" aria-live="polite"></span></div></form>' +
          '<p class="mvp-hint">Реєстрація — лише за запрошенням від керівника: він надсилає запрошення на пошту, лист містить посилання для встановлення пароля.</p>';
        app.querySelector('[data-pane="in"]').addEventListener('submit', function (e) {
          e.preventDefault();
          var msg = this.querySelector('.acct-msg'); msg.textContent = 'Вхід…';
          sb.auth.signInWithPassword({ email: app.querySelector('#acct-email-in').value.trim(), password: app.querySelector('#acct-pass-in').value }).then(function (r) {
            msg.textContent = r.error ? offlineOrError(r.error) : '';
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
    sb.auth.onAuthStateChange(function (event, s) {
      if (event === 'PASSWORD_RECOVERY') pendingRecovery = true;
      show();
    });
    show();
  }

  function offlineOrError(err) {
    var m = String((err && err.message) || '');
    return /invalid login credentials/i.test(m) ? 'Невірна пошта або пароль.' : m || 'Сталася помилка.';
  }

  // ---------- кабінет наставника (kerivnyku.html, #mentor-app): список новачків з хмари ----------
  function renderMentorDashboard() {
    var app = document.getElementById('mentor-app');
    if (!app) return;

    function attemptsHtml(list) {
      if (!list || !list.length) return '<p class="mvp-muted">Спроб ще немає.</p>';
      var shown = list.slice(0, 15);
      var rows = shown.map(function (a) {
        var when = esc(new Date(a.created_at).toLocaleString('uk-UA'));
        var kind = a.kind === 'test' ? 'тест' : 'тренажер';
        var res = a.kind === 'test' ? (a.pct == null ? '—' : a.pct + '%') : (a.passed ? 'вірно' : 'помилка');
        var mist = (a.mistakes && a.mistakes.length) ? esc(a.mistakes.join(', ')) : '—';
        return '<tr><td>' + when + '</td><td>' + a.lesson_n + '</td><td>' + kind + '</td><td>' + esc(res) + '</td><td>' + mist + '</td></tr>';
      }).join('');
      return '<div class="mgr-scroll"><table class="mgr-table"><caption class="sr-only">Історія спроб</caption>' +
        '<thead><tr><th scope="col">Коли</th><th scope="col">Урок</th><th scope="col">Тип</th><th scope="col">Результат</th><th scope="col">Помилки (правила)</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>' +
        (list.length > shown.length ? '<p class="mvp-muted">Показано останні ' + shown.length + ' з ' + list.length + '.</p>' : '');
    }
    function resetControlsHtml() {
      // без data-uid на кнопках навмисно: card.closest('[data-uid]') має знайти зовнішню .mgr-card, а
      // closest() перевіряє СПОЧАТКУ сам елемент — data-uid на кнопці підмінив би card на саму кнопку.
      var lessons = (window.TRAINER && window.TRAINER.lessons) || [];
      var opts = lessons.map(function (l) { return '<option value="' + l.n + '">Урок ' + l.n + '</option>'; }).join('');
      return '<div class="mvp-row mgr-reset">' +
        '<select class="mgr-reset-lesson" aria-label="Урок для скидання">' + opts + '</select>' +
        '<button type="button" class="mvp-btn ghost mgr-reset-lesson-btn">Скинути урок</button>' +
        '<button type="button" class="mvp-btn ghost mgr-reset-all-btn">Скинути весь прогрес</button>' +
        '</div>';
    }
    function doReset(uid, lessonN, btn) {
      var msg = lessonN ? 'Скинути урок ' + lessonN + ' цьому новачку? Це не можна відмінити.' : 'Скинути ВЕСЬ прогрес цьому новачку? Це не можна відмінити.';
      if (!window.confirm(msg)) return;
      btn.disabled = true;
      sb.rpc('reset_progress', { p_user_id: uid, p_lesson_n: lessonN || null }).then(function (r) {
        if (r.error) { btn.disabled = false; window.alert('Помилка скидання: ' + r.error.message); return; }
        loadDashboard();
      });
    }
    function renderList(novices, progressByUser, attemptsByUser, attemptsErrored) {
      if (!novices.length) { app.innerHTML = '<p class="mvp-muted">Ще жодного новачка не запрошено.</p>'; return; }
      var cards = novices.map(function (n) {
        var pr = progressByUser[n.id];
        var label = n.display_name || n.email || n.id;
        var lastActive = pr ? esc(new Date(pr.updated_at).toLocaleString('uk-UA')) : 'ще не заходив(ла)';
        var sum = pr ? MVP.progressSummary(MVP.sanitizeState(pr.state) || {}) : null;
        return '<section class="mvp-card mgr-card" data-uid="' + esc(n.id) + '">' +
          '<p class="mvp-card-title">' + esc(label) + '</p>' +
          '<p class="mvp-muted">Остання активність: ' + lastActive + '</p>' +
          (sum ? MVP.summaryHtml(sum) : '<p class="mvp-muted">Прогресу ще немає.</p>') +
          '<p class="mvp-sub" style="margin-top:10px;font-weight:700">Історія спроб</p>' +
          attemptsHtml(attemptsByUser[n.id]) +
          resetControlsHtml() +
          '</section>';
      }).join('');
      app.innerHTML = (attemptsErrored ? '<p class="mvp-muted">Історія спроб тимчасово недоступна.</p>' : '') + cards;
      [].forEach.call(app.querySelectorAll('.mgr-reset-lesson-btn'), function (btn) {
        btn.addEventListener('click', function () {
          var card = btn.closest('[data-uid]'), uid = card.getAttribute('data-uid');
          var lessonN = parseInt(card.querySelector('.mgr-reset-lesson').value, 10);
          doReset(uid, lessonN, btn);
        });
      });
      [].forEach.call(app.querySelectorAll('.mgr-reset-all-btn'), function (btn) {
        btn.addEventListener('click', function () { doReset(btn.closest('[data-uid]').getAttribute('data-uid'), null, btn); });
      });
    }
    function loadDashboard() {
      app.innerHTML = '<p class="mvp-muted">Завантажую список новачків…</p>';
      Promise.all([
        sb.from('profiles').select('id,email,display_name').eq('role', 'newbie'),
        sb.from('progress').select('user_id,state,rev,generation,updated_at'),
        sb.from('attempts').select('user_id,lesson_n,kind,pct,passed,mistakes,created_at').order('created_at', { ascending: false }).limit(500),
      ]).then(function (results) {
        var profRes = results[0], progRes = results[1], attRes = results[2];
        if (profRes.error || progRes.error) { app.innerHTML = '<p class="mvp-muted">Помилка завантаження списку новачків.</p>'; return; }
        var novices = profRes.data || [];
        var progressByUser = {}; (progRes.data || []).forEach(function (r) { progressByUser[r.user_id] = r; });
        var attemptsByUser = {}; (attRes.data || []).forEach(function (a) { (attemptsByUser[a.user_id] = attemptsByUser[a.user_id] || []).push(a); });
        renderList(novices, progressByUser, attemptsByUser, !!attRes.error);
      }).catch(function () { app.innerHTML = '<p class="mvp-muted">Помилка завантаження.</p>'; });
    }
    function show() {
      if (!session) { app.innerHTML = '<p class="mvp-muted">Ця частина кабінету — лише для керівника. <a href="account.html">Увійти</a>.</p>'; return; }
      app.innerHTML = '<p class="mvp-muted">Перевіряю роль…</p>';
      fetchProfile().then(function (p) {
        if (!p || p.role !== 'mentor') { app.innerHTML = '<p class="mvp-muted">Ця частина кабінету — лише для керівника.</p>'; return; }
        loadDashboard();
      });
    }
    sb.auth.onAuthStateChange(function () { show(); });
    show();
  }

  // ---------- ініціалізація ----------
  window.addEventListener('online', function () { reconcile(); });
  sb.auth.getSession().then(function (r) {
    session = r.data && r.data.session;
    renderWidget();
    renderAccountPage();
    renderMentorDashboard();
    if (session) { startPolling(); reconcile(); }
  });
  sb.auth.onAuthStateChange(function (event, s) {
    var was = !!session;
    session = s;
    renderWidget();
    if (session && !was) { startPolling(); reconcile(); }
    if (!session && was) { stopPolling(); lastSnapshot = null; }
  });

  window.ACCOUNT = { pushProgress: pushProgress, reconcile: reconcile, recordAttempt: recordAttempt, sb: sb };
})();
