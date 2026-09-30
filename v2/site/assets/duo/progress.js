/* Ikorka Duo — прогрес у браузері: localStorage['ikorka-duo'] (офлайн-перш за все), події через Duo.env,
 * синхронізація з Supabase (таблиця duo_progress, міграція 0004) за наявності сесії.
 * Уся логіка — у progress-core.js (DuoProgressCore); тут лише сховище, події і мережа.
 * Контракт — docs/design/ARCHITECTURE.md §4.5. */
(function () {
  'use strict';
  var Duo = window.Duo = window.Duo || {};
  var Core = window.DuoProgressCore;
  if (!Core) return;
  var KEY = 'ikorka-duo';
  var st = null;
  var mem = null; // якщо localStorage недоступний (приватний режим) — живемо в пам'яті

  function course() { return window.DUO_COURSE || { units: [] }; }
  function coachOn() { var m = document.querySelector('meta[name="ikorka-coach"]'); return !!(m && m.getAttribute('content') === 'on'); }
  function qopts() { return { coach: coachOn() }; }
  function emit(name, detail) { if (Duo.env && Duo.env.emit) Duo.env.emit(name, detail); }

  function load() {
    if (st) return st;
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { raw = mem; }
    st = Core.sanitize(raw);
    return st;
  }
  function save(reason) {
    st.updated = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { mem = Core.clone(st); }
    emit('progress:change', { reason: reason || 'save' });
    Sync.schedule();
  }
  // інша вкладка змінила прогрес — підхопити
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY) return;
    st = null; load(); emit('progress:change', { reason: 'storage' });
  });

  var P = Duo.progress = {
    get: function () { return load(); },
    today: function () { return Core.dayKey(); },
    nodeState: function (id) { return Core.nodeState(load(), course(), id); },
    currentNodeId: function () { return Core.currentNodeId(load(), course()); },
    isDone: function (id) { return Core.isDone(load(), id); },
    completeNode: function (nodeId, r) {
      var res = Core.completeNode(load(), course(), nodeId, r || {}, Date.now(), qopts());
      save('complete');
      emit('progress:xp', { xp: res.xp, nodeId: nodeId });
      if (res.firstToday) emit('progress:streak', res.streak);
      if (res.goal.reachedNow) emit('progress:goal', res.goal);
      res.quests.forEach(function (q) { emit('progress:quest', { id: q }); });
      res.achievements.forEach(function (a) { emit('progress:achievement', a); });
      return res;
    },
    openChest: function (id) { var r = Core.openChest(load(), id, Date.now()); if (!r.already) { save('chest'); emit('progress:xp', { xp: r.xp, chest: id }); } return r; },
    xpToday: function () { return Core.xpOnDay(load(), Core.dayKey()); },
    xpTotal: function () { return Core.xpTotal(load()); },
    streak: function () { return Core.streak(load()); },
    dailyGoal: function () { return Core.dailyGoal(load()); },
    setDailyGoal: function (xp) { var s = load(); if (Core.GOALS.indexOf(xp) < 0) return; s.settings = { goal: xp, t: Date.now() }; save('goal'); },
    hearts: function () { var h = Core.hearts(load()); return h; },
    loseHeart: function () { var n = Core.loseHeart(load()); save('heart'); return n; },
    refillHearts: function () { var n = Core.refillHearts(load()); save('heart'); return n; },
    recordMistake: function (m) { Core.recordMistake(load(), m); save('mistake'); },
    resolveMistake: function (stepId) { if (Core.resolveMistake(load(), stepId)) save('mistake'); },
    mistakes: function () { return Core.openMistakes(load()); },
    quests: function () { return Core.questsFor(load(), Date.now(), qopts()); },
    questChest: function () { return Core.questChest(load(), Date.now(), qopts()); },
    openQuestChest: function () { var r = Core.openQuestChest(load(), Date.now(), qopts()); if (r.xp) { save('quests'); emit('progress:xp', { xp: r.xp, quests: true }); } return r; },
    achievements: function () { return Core.achievements(load(), course()); },
    settings: function () { return load().settings; },
    setSetting: function (k, v) { var s = load(); if (k === 'goal') return P.setDailyGoal(v); s.settings[k] = v; s.settings.t = Date.now(); save('settings'); },
    onboarded: function () { return !!load().onboarded; },
    setOnboarded: function () { load().onboarded = true; save('onboarding'); },
    reset: function () { st = Core.blank(); save('reset'); },
    coachOn: coachOn,
    core: Core,
  };

  // ---------- синхронізація з Supabase (лише коли збірка з акаунтами й є сесія) ----------
  var Sync = P.sync = (function () {
    var sb = null, session = null, timer = null, inflight = null, status = 'off';
    function setStatus(s) { status = s; emit('progress:sync', { status: s }); }
    function uid() { return session && session.user && session.user.id; }
    function push() {
      if (!sb || !uid() || navigator.onLine === false) return Promise.resolve();
      if (inflight) return inflight;
      setStatus('syncing');
      var row = { user_id: uid(), state: load(), updated_at: new Date().toISOString() };
      inflight = sb.from('duo_progress').upsert(row, { onConflict: 'user_id' }).then(function (r) {
        inflight = null; setStatus(r.error ? 'error' : 'synced');
      }, function () { inflight = null; setStatus('error'); });
      return inflight;
    }
    function pull() {
      if (!sb || !uid() || navigator.onLine === false) return Promise.resolve();
      setStatus('syncing');
      return sb.from('duo_progress').select('state').eq('user_id', uid()).maybeSingle().then(function (r) {
        if (r.error) { setStatus('error'); return; }
        if (r.data && r.data.state) {
          var before = JSON.stringify(load());
          st = Core.merge(load(), r.data.state); // при конфлікті XP перемагає сервер
          try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { mem = Core.clone(st); }
          if (JSON.stringify(st) !== before) emit('progress:change', { reason: 'sync' });
        }
        return push();
      }, function () { setStatus('error'); });
    }
    function schedule() { if (!sb || !uid()) return; clearTimeout(timer); timer = setTimeout(push, 1500); }
    function init() {
      var A = window.ACCOUNT;
      if (!A || !A.sb) return;
      sb = A.sb;
      sb.auth.getSession().then(function (r) { session = r.data && r.data.session; if (session) pull(); });
      sb.auth.onAuthStateChange(function (ev, s) { var was = !!session; session = s; if (s && !was) pull(); if (!s) setStatus('off'); });
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') push(); else pull(); });
      window.addEventListener('pagehide', function () { push(); });
      window.addEventListener('online', function () { pull(); });
    }
    return { init: init, push: push, pull: pull, schedule: schedule, status: function () { return status; } };
  })();

  load();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', Sync.init); else Sync.init();
})();
