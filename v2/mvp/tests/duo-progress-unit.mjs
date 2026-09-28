#!/usr/bin/env node
// DUO-редизайн: юніт-тести чистої логіки прогресу (v2/build/assets/duo/progress-core.js) —
// київська дата, серія, XP, ціль, серця, помилки, завдання, досягнення, розблокування шляху і злиття станів.
import path from 'node:path';
import { createRequire } from 'node:module';
import { Results, V2 } from './lib.mjs';

const require = createRequire(import.meta.url);
const C = require(path.join(V2, 'build', 'assets', 'duo', 'progress-core.js'));
const R = new Results('duo-progress-unit');

const H = 3600 * 1000, D = 24 * H;
const at = iso => Date.parse(iso);
const COURSE = {
  units: [
    { n: 1, items: [
      { kind: 'node', id: 'u01-1', lesson: 1 }, { kind: 'node', id: 'u01-2', lesson: 1 },
      { kind: 'chest', id: 'c1', after: 'u01-2' },
      { kind: 'node', id: 'u02-1', lesson: 2 },
      { kind: 'boss', id: 'b1' },
    ] },
    { n: 2, items: [{ kind: 'node', id: 'u04-1', lesson: 4 }, { kind: 'boss', id: 'b2' }] },
  ],
};

// --- київська дата
R.check('date.kyiv-summer-after-midnight', C.dayKey(at('2026-09-27T21:30:00Z')) === '2026-09-28', C.dayKey(at('2026-09-27T21:30:00Z')));
R.check('date.kyiv-summer-before-midnight', C.dayKey(at('2026-09-27T20:30:00Z')) === '2026-09-27');
R.check('date.kyiv-winter-new-year', C.dayKey(at('2026-12-31T22:30:00Z')) === '2027-01-01', C.dayKey(at('2026-12-31T22:30:00Z')));
R.check('date.add-days-across-month', C.addDays('2026-09-30', 1) === '2026-10-01' && C.addDays('2026-03-01', -1) === '2026-02-28');
R.check('date.weekday-monday-0', C.weekday('2026-09-28') === 0 && C.weekday('2026-10-04') === 6);

// --- XP за вузол: перший раз, бонус без помилок, повтор
{
  const s = C.blank(at('2026-09-28T08:00:00Z'));
  const r1 = C.completeNode(s, COURSE, 'u01-1', { correct: 10, total: 10, mistakes: 0 }, at('2026-09-28T08:05:00Z'));
  R.check('xp.first-perfect-15', r1.xp === 15 && r1.accuracy === 100 && r1.perfect, JSON.stringify(r1.xpBreakdown));
  const r2 = C.completeNode(s, COURSE, 'u01-1', { correct: 8, total: 10, mistakes: 2 }, at('2026-09-28T08:15:00Z'));
  R.check('xp.repeat-with-mistakes-5', r2.xp === 5 && r2.accuracy === 80 && !r2.perfect, JSON.stringify(r2.xpBreakdown));
  R.check('xp.total-20', C.xpTotal(s) === 20);
  R.check('node.best-accuracy-kept', s.nodes['u01-1'].best === 100 && s.nodes['u01-1'].n === 2);
  R.check('xp.first-today-once', r1.firstToday === true && r2.firstToday === false);
  R.check('next-node-after-u01-1', r1.nextNodeId === 'u01-2', r1.nextNodeId);
}

// --- серія за київськими датами
{
  const s = C.blank(at('2026-09-20T08:00:00Z'));
  ['2026-09-25T09:00:00Z', '2026-09-26T09:00:00Z', '2026-09-27T09:00:00Z'].forEach((t, i) => C.completeNode(s, COURSE, 'x' + i, { correct: 5, total: 5 }, at(t)));
  const today = C.streak(s, at('2026-09-28T09:00:00Z'));
  R.check('streak.alive-before-today-activity', today.count === 3 && !today.activeToday, JSON.stringify({ c: today.count, a: today.activeToday }));
  const r = C.completeNode(s, COURSE, 'x9', { correct: 5, total: 5 }, at('2026-09-28T09:10:00Z'));
  R.check('streak.plus-one-on-first-lesson', r.streak.before === 3 && r.streak.after === 4 && r.firstToday, JSON.stringify(r.streak));
  R.check('streak.week-mon-sun', C.streak(s, at('2026-09-28T10:00:00Z')).week.length === 7 && C.streak(s, at('2026-09-28T10:00:00Z')).week[0].day === '2026-09-28');
  const gap = C.streak(s, at('2026-09-30T09:00:00Z'));
  R.check('streak.lost-after-gap-soft', gap.count === 0 && gap.lost === 4, JSON.stringify({ c: gap.count, lost: gap.lost }));
  // пізно ввечері за Києвом (після 21:00 UTC влітку) — це вже наступний день
  const s2 = C.blank();
  C.completeNode(s2, COURSE, 'a', { correct: 1, total: 1 }, at('2026-09-27T20:00:00Z')); // 23:00 Київ, 27-ме
  C.completeNode(s2, COURSE, 'b', { correct: 1, total: 1 }, at('2026-09-27T21:30:00Z')); // 00:30 Київ, 28-ме
  R.check('streak.kyiv-midnight-counts-two-days', C.streak(s2, at('2026-09-28T06:00:00Z')).count === 2);
  R.check('streak.best', C.streak(s, at('2026-09-30T09:00:00Z')).best === 4);
}

// --- денна ціль
{
  const s = C.blank(); s.settings.goal = 20;
  const r1 = C.completeNode(s, COURSE, 'u01-1', { correct: 10, total: 10 }, at('2026-09-28T08:00:00Z')); // 15
  const r2 = C.completeNode(s, COURSE, 'u01-2', { correct: 9, total: 10, mistakes: 1 }, at('2026-09-28T08:20:00Z')); // +10 → 25
  R.check('goal.not-reached-first', r1.goal.reachedNow === false && r1.goal.after === 15);
  R.check('goal.reached-now-once', r2.goal.reachedNow === true && r2.goal.after === 25 && r2.goal.target === 20, JSON.stringify(r2.goal));
  const r3 = C.completeNode(s, COURSE, 'u02-1', { correct: 10, total: 10 }, at('2026-09-28T09:00:00Z'));
  R.check('goal.not-celebrated-twice', r3.goal.reachedNow === false);
}

// --- серця: втрата, відновлення з часом, повне поповнення
{
  const t0 = at('2026-09-28T08:00:00Z');
  const s = C.blank(t0);
  C.loseHeart(s, t0); C.loseHeart(s, t0 + 1000);
  R.check('hearts.lose', C.hearts(s, t0 + 2000).n === 3);
  R.check('hearts.regen-30min', C.hearts(s, t0 + 31 * 60 * 1000).n === 4);
  R.check('hearts.regen-cap', C.hearts(s, t0 + 10 * H).n === 5);
  for (let i = 0; i < 7; i++) C.loseHeart(s, t0 + 10 * H + i);
  R.check('hearts.floor-zero', C.hearts(s, t0 + 10 * H + 100).n === 0);
  C.refillHearts(s, t0 + 10 * H + 200);
  R.check('hearts.refill', C.hearts(s, t0 + 10 * H + 300).n === 5);
}

// --- помилки для повторення
{
  const s = C.blank();
  C.recordMistake(s, { stepId: 'u04-1-s3', lesson: 4, nodeId: 'u04-1' }, 1000);
  C.recordMistake(s, { stepId: 'u04-1-s3', lesson: 4, nodeId: 'u04-1' }, 2000);
  C.recordMistake(s, { stepId: 'u01-1-s2', lesson: 1, nodeId: 'u01-1' }, 3000);
  const open = C.openMistakes(s);
  R.check('mistakes.dedupe-and-order', open.length === 2 && open[0].stepId === 'u04-1-s3' && open[0].n === 2, JSON.stringify(open));
  C.resolveMistake(s, 'u04-1-s3', 4000);
  R.check('mistakes.resolve', C.openMistakes(s).length === 1);
}

// --- розблокування шляху: вузли по черзі, скриня після вузла, бос після всіх вузлів юніта, бос не блокує наступний юніт
{
  const s = C.blank();
  R.check('path.first-current', C.nodeState(s, COURSE, 'u01-1') === 'current' && C.nodeState(s, COURSE, 'u01-2') === 'locked');
  R.check('path.chest-locked', C.nodeState(s, COURSE, 'c1') === 'locked' && C.nodeState(s, COURSE, 'b1') === 'locked');
  C.completeNode(s, COURSE, 'u01-1', { correct: 1, total: 1 }, 1e12);
  C.completeNode(s, COURSE, 'u01-2', { correct: 1, total: 1 }, 1e12 + 1);
  R.check('path.chest-available', C.nodeState(s, COURSE, 'c1') === 'available' && C.nodeState(s, COURSE, 'u02-1') === 'current');
  const ch = C.openChest(s, 'c1', 1e12 + 2), again = C.openChest(s, 'c1', 1e12 + 3);
  R.check('chest.xp-once', C.CHEST_XP.includes(ch.xp) && again.xp === 0 && again.already && C.nodeState(s, COURSE, 'c1') === 'done');
  C.completeNode(s, COURSE, 'u02-1', { correct: 1, total: 1 }, 1e12 + 4);
  R.check('path.boss-available-after-unit', C.nodeState(s, COURSE, 'b1') === 'available');
  R.check('path.boss-optional', C.nodeState(s, COURSE, 'u04-1') === 'current' && C.currentNodeId(s, COURSE) === 'u04-1');
  R.check('path.done-state', C.nodeState(s, COURSE, 'u01-1') === 'done');
}

// --- щоденні завдання і скриня завдань
{
  const t = at('2026-09-28T08:00:00Z');
  const s = C.blank(t);
  C.completeNode(s, COURSE, 'u01-1', { correct: 10, total: 10 }, t);            // perfect, 15 XP
  const r = C.completeNode(s, COURSE, 'b1', { correct: 5, total: 5, kind: 'boss' }, t + 1000); // coach, +30
  R.check('quests.all-done', C.questsFor(s, t + 2000).every(q => q.done), JSON.stringify(C.questsFor(s, t + 2000)));
  R.check('quests.reported-as-just-done', r.quests.includes('coach') && r.quests.includes('xp30'), JSON.stringify(r.quests));
  const q1 = C.openQuestChest(s, t + 3000), q2 = C.openQuestChest(s, t + 4000);
  R.check('quests.chest-once', q1.xp === C.XP.questChest && q2.xp === 0);
  const off = C.questsFor(C.blank(t), t, { coach: false });
  R.check('quests.coach-offline-alternative', off[2].id === 'coachOffline' && off[2].target === 3);
}

// --- досягнення
{
  const s = C.blank();
  const r = C.completeNode(s, COURSE, 'u01-1', { correct: 10, total: 10, objections: 10, builds: 3 }, at('2026-09-28T08:00:00Z'));
  R.check('ach.unlock-level-1', r.achievements.some(a => a.id === 'objections' && a.level === 1) && r.achievements.some(a => a.id === 'perfect' && a.level === 1), JSON.stringify(r.achievements));
  const again = C.syncAchievements(s, COURSE, at('2026-09-28T09:00:00Z'));
  R.check('ach.not-twice', again.length === 0);
}

// --- злиття: офлайн-XP не губиться, сервер перемагає при конфлікті, ідемпотентність, серія з обох пристроїв
{
  const a = C.blank(1000), b = C.blank(2000);
  C.completeNode(a, COURSE, 'u01-1', { correct: 10, total: 10 }, at('2026-09-26T08:00:00Z')); // пристрій А, 26-те
  C.completeNode(b, COURSE, 'u01-2', { correct: 9, total: 10, mistakes: 1 }, at('2026-09-27T08:00:00Z')); // пристрій Б, 27-ме
  const m = C.merge(a, b);
  R.check('merge.union-xp', C.xpTotal(m) === C.xpTotal(a) + C.xpTotal(b), `${C.xpTotal(m)} = ${C.xpTotal(a)} + ${C.xpTotal(b)}`);
  R.check('merge.union-nodes', m.nodes['u01-1'] && m.nodes['u01-2']);
  R.check('merge.streak-from-both-devices', C.streak(m, at('2026-09-27T12:00:00Z')).count === 2);
  const again = C.merge(m, m);
  R.check('merge.idempotent', C.xpTotal(again) === C.xpTotal(m) && JSON.stringify(Object.keys(again.nodes).sort()) === JSON.stringify(Object.keys(m.nodes).sort()));
  R.check('merge.commutative-totals', C.xpTotal(C.merge(a, b)) === C.xpTotal(C.merge(b, a)));
  // конфлікт: той самий id події з різною кількістю XP — перемагає сервер (другий аргумент)
  const local = C.blank(), server = C.blank();
  local.xp.push({ id: 'node:u01-1:1', t: 1, d: '2026-09-28', xp: 15, src: 'node' });
  server.xp.push({ id: 'node:u01-1:1', t: 1, d: '2026-09-28', xp: 10, src: 'node' });
  R.check('merge.server-wins-xp-conflict', C.xpTotal(C.merge(local, server)) === 10);
  // виправлена помилка на одному пристрої не «воскресає» з іншого
  const p = C.blank(), q = C.blank();
  C.recordMistake(p, { stepId: 's1', lesson: 1, nodeId: 'u01-1' }, 1000);
  C.recordMistake(q, { stepId: 's1', lesson: 1, nodeId: 'u01-1' }, 1000);
  C.resolveMistake(p, 's1', 5000);
  R.check('merge.mistake-tombstone', C.openMistakes(C.merge(q, p)).length === 0 && C.openMistakes(C.merge(p, q)).length === 0);
  // скриня, відкрита на обох пристроях, дає XP один раз
  const x = C.blank(), y = C.blank();
  C.openChest(x, 'c1', 1000); C.openChest(y, 'c1', 2000);
  R.check('merge.chest-xp-once', C.xpTotal(C.merge(x, y)) === C.openChest(C.blank(), 'c1', 1).xp);
}

// --- санітизація сміття
{
  const s = C.sanitize({ v: 99, xp: 'bad' });
  R.check('sanitize.bad-version-blank', s.v === C.VERSION && Array.isArray(s.xp) && s.xp.length === 0);
  const t = C.sanitize({ v: 1, xp: [{ id: 'a', xp: 5, d: '2026-09-28' }, { bad: 1 }], settings: { goal: 7 }, hearts: { n: 'x' } });
  R.check('sanitize.filters-and-defaults', t.xp.length === 1 && t.settings.goal === 20 && t.hearts.n === 5);
}

const f = R.save(path.join(V2, 'mvp', 'tests', 'results'));
console.log(`\nРАЗОМ: ${R.items.length - R.failed.length} ok, ${R.failed.length} fail → ${path.relative(process.cwd(), f)}`);
process.exitCode = R.failed.length ? 1 : 0;
