/* Ikorka Duo — чиста логіка прогресу (без DOM і localStorage): XP-журнал, серія за київською датою,
 * денна ціль, серця, помилки для повторення, щоденні завдання, досягнення, злиття двох станів.
 * UMD: у браузері — window.DuoProgressCore, у Node — module.exports (юніт-тести v2/mvp/tests/duo-progress-unit.mjs).
 * Контракт — docs/design/ARCHITECTURE.md §4.5. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DuoProgressCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 1;
  var HEARTS_MAX = 5;
  var HEART_REGEN_MS = 30 * 60 * 1000; // +1 серце кожні 30 хв — серця не блокують навчання надовго
  var GOALS = [10, 20, 30, 50];
  var DEFAULT_GOAL = 20;
  var XP = { lessonFirst: 10, lessonRepeat: 5, perfectBonus: 5, boss: 20, bossPerfect: 10, practice: 5, practicePerfect: 5, questChest: 15 };
  var CHEST_XP = [5, 10, 15];
  var MISTAKE_TOMBSTONE_MS = 30 * 24 * 3600 * 1000;

  // ---------- дати: локальна дата Europe/Kyiv (YYYY-MM-DD) ----------
  var fmt = null;
  function kyivFormatter() {
    if (fmt) return fmt;
    var zones = ['Europe/Kyiv', 'Europe/Kiev'];
    for (var i = 0; i < zones.length; i++) {
      try { fmt = new Intl.DateTimeFormat('en-CA', { timeZone: zones[i], year: 'numeric', month: '2-digit', day: '2-digit' }); fmt.format(new Date()); return fmt; } catch (e) { fmt = null; }
    }
    return null;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(t) {
    var d = new Date(t == null ? Date.now() : t);
    var f = kyivFormatter();
    if (f) {
      var parts = f.formatToParts ? f.formatToParts(d) : null;
      if (parts) {
        var y = '', m = '', dd = '';
        parts.forEach(function (p) { if (p.type === 'year') y = p.value; else if (p.type === 'month') m = p.value; else if (p.type === 'day') dd = p.value; });
        if (y && m && dd) return y + '-' + m + '-' + dd;
      }
      return f.format(d); // en-CA → YYYY-MM-DD
    }
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  // арифметика днів над ключами (без часових поясів: опівдні UTC)
  function keyToUtcNoon(k) { var p = k.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2], 12); }
  function addDays(k, n) { var d = new Date(keyToUtcNoon(k) + n * 86400000); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); }
  function weekday(k) { return (new Date(keyToUtcNoon(k)).getUTCDay() + 6) % 7; } // 0 = понеділок

  function hash(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 2147483647; return h; }

  // ---------- стан ----------
  function blank(now) {
    now = now || Date.now();
    return {
      v: VERSION, created: now, updated: now, onboarded: false,
      settings: { goal: DEFAULT_GOAL, t: 0 },
      xp: [],            // [{ id, t, d, xp, src }] — злиття об'єднанням за id, при конфлікті перемагає сервер
      nodes: {},         // nodeId → { n, best, first, last, perfect }
      chests: {},        // chestId → t
      hearts: { n: HEARTS_MAX, t: now },
      mistakes: {},      // stepId → { l, node, t, n, r? } (r — коли виправлено; «надгробок» для злиття)
      days: {},          // YYYY-MM-DD → { lessons, perfect, coach, practice }
      quests: {},        // YYYY-MM-DD → { chest: t }
      ach: {},           // id → level
      stats: { answered: 0, correct: 0, objections: 0, builds: 0, perfect: 0, bosses: 0 },
    };
  }

  function sanitize(s, now) {
    var b = blank(now);
    if (!s || typeof s !== 'object' || s.v !== VERSION) return b;
    for (var k in b) if (!(k in s) || s[k] == null || typeof s[k] !== typeof b[k] || Array.isArray(b[k]) !== Array.isArray(s[k])) s[k] = b[k];
    for (var st in b.stats) if (typeof s.stats[st] !== 'number') s.stats[st] = 0;
    if (GOALS.indexOf(s.settings.goal) < 0) s.settings.goal = DEFAULT_GOAL;
    if (typeof s.hearts.n !== 'number') s.hearts = b.hearts;
    s.xp = s.xp.filter(function (e) { return e && typeof e.id === 'string' && typeof e.xp === 'number' && typeof e.d === 'string'; });
    return s;
  }

  // ---------- XP ----------
  function addXp(s, amount, src, id, now) {
    now = now || Date.now();
    if (!amount) return 0;
    id = id || (src + ':' + now);
    for (var i = 0; i < s.xp.length; i++) if (s.xp[i].id === id) return 0; // уже нараховано
    s.xp.push({ id: id, t: now, d: dayKey(now), xp: amount, src: src });
    s.updated = now;
    return amount;
  }
  function xpOnDay(s, d) { var x = 0; s.xp.forEach(function (e) { if (e.d === d) x += e.xp; }); return x; }
  function xpTotal(s) { var x = 0; s.xp.forEach(function (e) { x += e.xp; }); return x; }

  // ---------- активні дні і серія ----------
  function activeDays(s) {
    var set = {};
    s.xp.forEach(function (e) { if (e.xp > 0) set[e.d] = true; });
    Object.keys(s.days).forEach(function (d) { var x = s.days[d]; if (x && (x.lessons || x.practice || x.coach)) set[d] = true; });
    return set;
  }
  // count — серія, що триває (сьогодні або вчора був активний день); activeToday — чи вже зараховано сьогодні
  function streak(s, now) {
    var today = dayKey(now), act = activeDays(s);
    var activeToday = !!act[today];
    var start = activeToday ? today : addDays(today, -1);
    var count = 0;
    for (var d = start; act[d]; d = addDays(d, -1)) count++;
    // тиждень (пн–нд) поточного тижня
    var monday = addDays(today, -weekday(today));
    var week = [];
    for (var i = 0; i < 7; i++) { var k = addDays(monday, i); week.push({ day: k, active: !!act[k], today: k === today, future: k > today }); }
    // серія обірвалась: вчора не було активності, але раніше була серія ≥ 2 днів (м'який екран, не покарання)
    var lost = 0;
    if (!act[addDays(today, -1)]) { var c = 0; for (var e = addDays(today, -2); act[e]; e = addDays(e, -1)) c++; if (c >= 2) lost = c; }
    var best = 0, run = 0, keys = Object.keys(act).sort();
    for (var j = 0; j < keys.length; j++) { run = (j && addDays(keys[j - 1], 1) === keys[j]) ? run + 1 : 1; if (run > best) best = run; }
    return { count: count, activeToday: activeToday, week: week, lost: activeToday ? 0 : lost, best: best };
  }

  // ---------- денна ціль ----------
  function dailyGoal(s, now) { var t = s.settings.goal; var x = xpOnDay(s, dayKey(now)); return { target: t, xpToday: x, done: x >= t }; }

  // ---------- серця ----------
  function hearts(s, now) {
    now = now || Date.now();
    var h = s.hearts;
    if (h.n < HEARTS_MAX && h.t) {
      var gained = Math.floor((now - h.t) / HEART_REGEN_MS);
      if (gained > 0) { h.n = Math.min(HEARTS_MAX, h.n + gained); h.t = h.n >= HEARTS_MAX ? now : h.t + gained * HEART_REGEN_MS; }
    }
    return { n: h.n, max: HEARTS_MAX, nextInMs: h.n >= HEARTS_MAX ? 0 : Math.max(0, h.t + HEART_REGEN_MS - now) };
  }
  function loseHeart(s, now) { now = now || Date.now(); hearts(s, now); if (s.hearts.n >= HEARTS_MAX) s.hearts.t = now; s.hearts.n = Math.max(0, s.hearts.n - 1); s.updated = now; return s.hearts.n; }
  function refillHearts(s, now) { now = now || Date.now(); s.hearts = { n: HEARTS_MAX, t: now }; s.updated = now; return HEARTS_MAX; }

  // ---------- помилки для повторення ----------
  function recordMistake(s, m, now) {
    now = now || Date.now();
    var cur = s.mistakes[m.stepId];
    s.mistakes[m.stepId] = { l: m.lesson, node: m.nodeId, t: now, n: ((cur && !cur.r) ? cur.n : 0) + 1 };
    s.updated = now;
  }
  function resolveMistake(s, stepId, now) {
    now = now || Date.now();
    var cur = s.mistakes[stepId];
    if (cur && !cur.r) { cur.r = now; s.updated = now; return true; }
    return false;
  }
  function openMistakes(s) {
    return Object.keys(s.mistakes).filter(function (k) { return !s.mistakes[k].r; })
      .map(function (k) { var m = s.mistakes[k]; return { stepId: k, lesson: m.l, nodeId: m.node, t: m.t, n: m.n }; })
      .sort(function (a, b) { return b.n - a.n || b.t - a.t; });
  }

  // ---------- вузли і шлях ----------
  // order — послідовність вузлів шляху: [{ kind:'node'|'boss'|'chest', id, after? }] з DUO_COURSE
  function flatPath(course) {
    var out = [];
    (course && course.units || []).forEach(function (u) { u.items.forEach(function (it) { out.push(it); }); });
    return out;
  }
  function isDone(s, id) { return !!(s.nodes[id] && s.nodes[id].n > 0); }
  // Вузли уроків відкриваються по черзі; бос (легендарний рівень) необов'язковий і наступний юніт не блокує.
  function currentNodeId(s, course) {
    var items = flatPath(course);
    for (var i = 0; i < items.length; i++) if (items[i].kind === 'node' && !isDone(s, items[i].id)) return items[i].id;
    return null; // усі уроки пройдено
  }
  function nodeState(s, course, id) {
    var items = flatPath(course), cur = currentNodeId(s, course), idx = -1, curIdx = -1;
    for (var i = 0; i < items.length; i++) { if (items[i].id === id) idx = i; if (items[i].id === cur) curIdx = i; }
    if (idx < 0) return 'locked';
    var it = items[idx];
    if (it.kind === 'chest') {
      if (s.chests[id]) return 'done';
      return isDone(s, it.after) ? 'available' : 'locked';
    }
    if (it.kind === 'boss') {
      if (isDone(s, id)) return 'done';
      // доступний, коли пройдено всі вузли уроків свого юніта
      var unit = (course.units || []).filter(function (u) { return u.items.some(function (x) { return x.id === id; }); })[0];
      var ready = unit && unit.items.every(function (x) { return x.kind !== 'node' || isDone(s, x.id); });
      return ready ? 'available' : 'locked';
    }
    if (isDone(s, id)) return 'done';
    if (id === cur) return 'current';
    return (cur === null || idx < curIdx) ? 'available' : 'locked';
  }

  // ---------- щоденні завдання ----------
  function questsFor(s, now, opts) {
    var d = dayKey(now), day = s.days[d] || {};
    var coachOn = !opts || opts.coach !== false;
    var list = [
      { id: 'perfect', target: 1, value: Math.min(1, day.perfect || 0) },
      { id: 'xp30', target: 30, value: Math.min(30, xpOnDay(s, d)) },
      coachOn ? { id: 'coach', target: 1, value: Math.min(1, day.coach || 0) } : { id: 'coachOffline', target: 3, value: Math.min(3, day.objections || 0) },
    ];
    list.forEach(function (q) { q.done = q.value >= q.target; });
    return list;
  }
  function questChest(s, now, opts) {
    var d = dayKey(now), qs = questsFor(s, now, opts);
    return { ready: qs.every(function (q) { return q.done; }), opened: !!(s.quests[d] && s.quests[d].chest) };
  }

  // ---------- досягнення (рівні I–III) ----------
  var ACH = [
    { id: 'objections', stat: 'objections', levels: [10, 25, 50] }, // «Майстер заперечень»
    { id: 'streak', stat: '_streakBest', levels: [3, 7, 14] },
    { id: 'perfect', stat: 'perfect', levels: [1, 5, 12] },
    { id: 'builder', stat: 'builds', levels: [10, 25, 50] },          // «Знавець скрипта»
    { id: 'boss', stat: 'bosses', levels: [1, 3, 5] },                // «Легенда дзвінка»
    { id: 'course', stat: '_lessonsDone', levels: [3, 8, 12] },       // уроки курсу
  ];
  function achValues(s, course, now) {
    var v = {}; for (var k in s.stats) v[k] = s.stats[k];
    v._streakBest = streak(s, now).best;
    var lessons = {};
    flatPath(course).forEach(function (it) { if (it.kind === 'node') { (lessons[it.lesson] = lessons[it.lesson] || []).push(it.id); } });
    v._lessonsDone = Object.keys(lessons).filter(function (l) { return lessons[l].every(function (id) { return isDone(s, id); }); }).length;
    return v;
  }
  function achievements(s, course, now) {
    var v = achValues(s, course, now);
    return ACH.map(function (a) {
      var value = v[a.stat] || 0, level = 0;
      a.levels.forEach(function (x, i) { if (value >= x) level = i + 1; });
      return { id: a.id, level: level, maxLevel: a.levels.length, value: value, next: level < a.levels.length ? a.levels[level] : null };
    });
  }
  // зафіксувати нові рівні; повертає [{id, level}] щойно відкритих
  function syncAchievements(s, course, now) {
    var out = [];
    achievements(s, course, now).forEach(function (a) { if (a.level > (s.ach[a.id] || 0)) { s.ach[a.id] = a.level; out.push({ id: a.id, level: a.level }); } });
    return out;
  }

  function dayRec(s, d) { return (s.days[d] = s.days[d] || { lessons: 0, perfect: 0, coach: 0, practice: 0, objections: 0 }); }

  // ---------- завершення вузла ----------
  // r = { correct, total, mistakes, ms, perfect, kind: 'node'|'boss'|'practice', objections, builds }
  function completeNode(s, course, nodeId, r, now, opts) {
    now = now || Date.now();
    var d = dayKey(now);
    var before = { streak: streak(s, now), goal: dailyGoal(s, now), quests: questsFor(s, now, opts) };
    var kind = r.kind || 'node';
    var total = Math.max(1, r.total || 0), correct = Math.max(0, r.correct || 0);
    var accuracy = Math.round(100 * Math.min(correct, total) / total);
    var perfect = r.perfect != null ? !!r.perfect : !r.mistakes;
    var prev = s.nodes[nodeId];
    var xp = 0, breakdown = [];
    if (kind === 'practice') { xp += XP.practice; breakdown.push(['practice', XP.practice]); if (perfect) { xp += XP.practicePerfect; breakdown.push(['perfect', XP.practicePerfect]); } }
    else if (kind === 'boss') { xp += XP.boss; breakdown.push(['boss', XP.boss]); if (perfect) { xp += XP.bossPerfect; breakdown.push(['perfect', XP.bossPerfect]); } }
    else {
      var base = prev && prev.n ? XP.lessonRepeat : XP.lessonFirst;
      xp += base; breakdown.push([prev && prev.n ? 'repeat' : 'lesson', base]);
      if (perfect) { xp += XP.perfectBonus; breakdown.push(['perfect', XP.perfectBonus]); }
    }
    addXp(s, xp, kind, kind + ':' + nodeId + ':' + now, now);
    if (kind !== 'practice') {
      s.nodes[nodeId] = { n: ((prev && prev.n) || 0) + 1, best: Math.max((prev && prev.best) || 0, accuracy), first: (prev && prev.first) || now, last: now, perfect: !!((prev && prev.perfect) || perfect) };
    }
    var rec = dayRec(s, d);
    if (kind === 'practice') rec.practice++; else rec.lessons++;
    if (perfect && kind === 'node') { rec.perfect++; s.stats.perfect++; }
    if (kind === 'boss') { rec.coach++; s.stats.bosses++; }
    s.stats.answered += total; s.stats.correct += correct;
    s.stats.objections += r.objections || 0; rec.objections = (rec.objections || 0) + (r.objections || 0);
    s.stats.builds += r.builds || 0;
    s.updated = now;
    var after = { streak: streak(s, now), goal: dailyGoal(s, now), quests: questsFor(s, now, opts) };
    var questsDone = after.quests.filter(function (q, i) { return q.done && !before.quests[i].done; }).map(function (q) { return q.id; });
    var unlocked = syncAchievements(s, course, now);
    return {
      xp: xp, xpBreakdown: breakdown, accuracy: accuracy, perfect: perfect, ms: r.ms || 0,
      firstToday: !before.streak.activeToday && after.streak.activeToday,
      streak: { before: before.streak.count, after: after.streak.count },
      goal: { before: before.goal.xpToday, after: after.goal.xpToday, target: after.goal.target, reachedNow: !before.goal.done && after.goal.done },
      quests: questsDone, achievements: unlocked,
      nextNodeId: currentNodeId(s, course),
    };
  }

  function openChest(s, chestId, now) {
    now = now || Date.now();
    if (s.chests[chestId]) return { xp: 0, already: true };
    var xp = CHEST_XP[hash(chestId) % CHEST_XP.length];
    s.chests[chestId] = now;
    addXp(s, xp, 'chest', 'chest:' + chestId, now);
    return { xp: xp, already: false };
  }
  function openQuestChest(s, now, opts) {
    now = now || Date.now();
    var d = dayKey(now), qc = questChest(s, now, opts);
    if (!qc.ready || qc.opened) return { xp: 0, already: qc.opened };
    s.quests[d] = { chest: now };
    addXp(s, XP.questChest, 'quests', 'qchest:' + d, now);
    return { xp: XP.questChest, already: false };
  }

  // ---------- злиття двох станів (два пристрої / локальний кеш і хмара) ----------
  function merge(local, remote) {
    local = sanitize(clone(local)); remote = sanitize(clone(remote));
    var out = blank(Math.min(local.created, remote.created));
    out.created = Math.min(local.created, remote.created);
    out.updated = Math.max(local.updated, remote.updated);
    out.onboarded = !!(local.onboarded || remote.onboarded);
    out.settings = (remote.settings.t || 0) >= (local.settings.t || 0) ? remote.settings : local.settings;
    // XP: об'єднання за id; однаковий id з різними значеннями — перемагає сервер (remote)
    var byId = {};
    local.xp.forEach(function (e) { byId[e.id] = e; });
    remote.xp.forEach(function (e) { byId[e.id] = e; });
    out.xp = Object.keys(byId).map(function (k) { return byId[k]; }).sort(function (a, b) { return a.t - b.t || (a.id < b.id ? -1 : 1); });
    keysOf(local.nodes, remote.nodes).forEach(function (k) {
      var a = local.nodes[k], b = remote.nodes[k];
      if (!a || !b) { out.nodes[k] = a || b; return; }
      out.nodes[k] = { n: Math.max(a.n, b.n), best: Math.max(a.best || 0, b.best || 0), first: Math.min(a.first || Infinity, b.first || Infinity), last: Math.max(a.last || 0, b.last || 0), perfect: !!(a.perfect || b.perfect) };
    });
    keysOf(local.chests, remote.chests).forEach(function (k) { out.chests[k] = Math.min(local.chests[k] || Infinity, remote.chests[k] || Infinity); });
    out.hearts = (remote.hearts.t || 0) >= (local.hearts.t || 0) ? remote.hearts : local.hearts;
    keysOf(local.mistakes, remote.mistakes).forEach(function (k) {
      var a = local.mistakes[k], b = remote.mistakes[k];
      if (!a || !b) { out.mistakes[k] = a || b; return; }
      var la = Math.max(a.t, a.r || 0), lb = Math.max(b.t, b.r || 0);
      out.mistakes[k] = lb >= la ? b : a;
    });
    keysOf(local.days, remote.days).forEach(function (k) {
      var a = local.days[k] || {}, b = remote.days[k] || {}, r = {};
      keysOf(a, b).forEach(function (f) { r[f] = Math.max(a[f] || 0, b[f] || 0); });
      out.days[k] = r;
    });
    keysOf(local.quests, remote.quests).forEach(function (k) {
      var a = local.quests[k], b = remote.quests[k];
      out.quests[k] = { chest: Math.min((a && a.chest) || Infinity, (b && b.chest) || Infinity) };
      if (out.quests[k].chest === Infinity) delete out.quests[k].chest;
    });
    keysOf(local.ach, remote.ach).forEach(function (k) { out.ach[k] = Math.max(local.ach[k] || 0, remote.ach[k] || 0); });
    keysOf(local.stats, remote.stats).forEach(function (k) { out.stats[k] = Math.max(local.stats[k] || 0, remote.stats[k] || 0); });
    return prune(out);
  }
  function prune(s, now) {
    now = now || Date.now();
    Object.keys(s.mistakes).forEach(function (k) { var m = s.mistakes[k]; if (m.r && now - m.r > MISTAKE_TOMBSTONE_MS) delete s.mistakes[k]; });
    return s;
  }
  function keysOf(a, b) { var o = {}; Object.keys(a || {}).forEach(function (k) { o[k] = 1; }); Object.keys(b || {}).forEach(function (k) { o[k] = 1; }); return Object.keys(o); }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }

  return {
    VERSION: VERSION, HEARTS_MAX: HEARTS_MAX, GOALS: GOALS, XP: XP, CHEST_XP: CHEST_XP, ACH: ACH,
    dayKey: dayKey, addDays: addDays, weekday: weekday,
    blank: blank, sanitize: sanitize, clone: clone,
    addXp: addXp, xpOnDay: xpOnDay, xpTotal: xpTotal,
    streak: streak, dailyGoal: dailyGoal,
    hearts: hearts, loseHeart: loseHeart, refillHearts: refillHearts,
    recordMistake: recordMistake, resolveMistake: resolveMistake, openMistakes: openMistakes,
    flatPath: flatPath, currentNodeId: currentNodeId, nodeState: nodeState, isDone: isDone,
    questsFor: questsFor, questChest: questChest, openQuestChest: openQuestChest,
    achievements: achievements, syncAchievements: syncAchievements,
    completeNode: completeNode, openChest: openChest,
    merge: merge, prune: prune,
  };
});
