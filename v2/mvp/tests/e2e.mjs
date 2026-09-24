#!/usr/bin/env node
// Клік-сценарії MVP-тренажера в headless Chromium.
//   node v2/mvp/tests/e2e.mjs            — усі зрізи
//   node v2/mvp/tests/e2e.mjs 1 2        — вибрані зрізи
import path from 'node:path';
import fs from 'node:fs';
import { startServer, launch, openPage, noHorizontalScroll, popupsOnLoad, fb3Parts, Results, V2 } from './lib.mjs';

const want = process.argv.slice(2).map(Number).filter(Boolean);
const run = n => !want.length || want.includes(n);
const OUT = path.join(V2, 'mvp', 'tests', 'results');
const T = (() => { const src = fs.readFileSync(path.join(V2, 'site', 'assets', 'trainer-data.js'), 'utf8'); const w = {}; new Function('window', src)(w); return w.TRAINER; })();
const d = new Date(); const pad = n => String(n).padStart(2, '0');
const dayKey = x => x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
const YESTERDAY = dayKey(new Date(Date.now() - 864e5));

function stateWith(extra) {
  return Object.assign({ v: 1, created: Date.now(), days: {}, last: null, pos: {}, lessons: {}, review: {}, daily: {}, goal: null, goals: [], sections: {}, final: [], sim: {}, deck: [] }, extra || {});
}
async function expectFb3(R, id, loc) {
  const p = await fb3Parts(loc);
  R.check(id, p.said && p.why && p.instead, `Що сказано «${p.said.slice(0, 40)}» · Чому «${p.why.slice(0, 40)}» · Натомість «${p.instead.slice(0, 40)}»`);
}

const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
const lessonN = n => T.lessons.find(x => x.n === n);
// правильний текст варіанта для інтерактиву з data-item (тестове питання, цитата, пара)
function correctText(id) {
  const m = /^(\d+)-(q|p|c)(\d+)$/.exec(id); if (!m) return null;
  const l = lessonN(+m[1]);
  if (m[2] === 'q') { const q = l.quiz.find(x => x.id === id); return norm(q.options.find(o => o.letter === q.correct).text); }
  if (m[2] === 'c') { const c = l.quotes.find(x => x.id === id); return c.strong ? 'Сильно' : 'Слабко'; }
  return norm(l.pairs.find(x => x.id === id).good);
}
// клік, стійкий до немодальних підказок-паузи, що можуть з'явитися під час прокрутки
async function click(page, loc) {
  try { await loc.click({ timeout: 4000 }); }
  catch (e) { await page.evaluate(() => document.querySelectorAll('.mvp-pop .mvp-skip').forEach(b => b.click())); await page.waitForTimeout(300); await loc.click({ timeout: 4000 }); }
}
// відповісти на поточне питання всередині scope правильно або неправильно
async function answer(page, scope, wantCorrect) {
  const q = scope.locator('.mvp-q[data-item]:not(.answered)').first();
  const id = await q.getAttribute('data-item');
  const good = correctText(id);
  const opts = q.locator('.mvp-opt');
  const n = await opts.count();
  for (let i = 0; i < n; i++) {
    const t = norm(await opts.nth(i).textContent());
    if ((t === good) === wantCorrect) { await click(page, opts.nth(i)); return { id, q }; }
  }
  throw new Error('немає варіанта (' + (wantCorrect ? 'правильного' : 'неправильного') + ') для ' + id);
}
const readState = page => page.evaluate(() => JSON.parse(localStorage.getItem('ikorka-mvp')));

// ---------------- Зріз 1: ядро навчання ----------------
async function slice1(browser, base, R) {
  // «Сьогодні»
  {
    const { page, ctx, errors } = await openPage(browser, base + '/index.html');
    await page.waitForSelector('#today-app .mvp-today');
    R.check('1.today.ring', await page.locator('#today-app svg.mvp-ring').count() === 1);
    const nextBtn = page.locator('#today-app .mvp-next a.mvp-btn.primary');
    R.check('1.today.next-step', (await nextBtn.textContent()).includes('Вступ'), await nextBtn.textContent());
    R.check('1.today.route-5-days', await page.locator('#today-app .mvp-day').count() === 5);
    R.check('1.today.no-popup-on-load', (await popupsOnLoad(page)).length === 0);
    await nextBtn.click(); await page.waitForURL(/vstup\.html/);
    R.check('1.today.next-step-navigates', page.url().includes('vstup.html'));
    R.check('1.today.console', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  // Урок 1: правила, спроба до пояснення, розбір, пауза, терміни, «Ви зупинились на…»
  {
    const L1 = T.lessons[0];
    const { page, ctx, errors } = await openPage(browser, base + '/urok-01.html');
    R.check('1.lesson.no-popup-on-load', (await popupsOnLoad(page)).length === 0);
    const rules = await page.locator('.mvp-rules-card .mvp-rules li').count();
    R.check('1.lesson.rules-3-5', rules >= 3 && rules <= 5, rules + ' правил');
    const attempts = page.locator('.mvp-attempt');
    R.check('1.lesson.attempts', await attempts.count() === L1.attempts.length, (await attempts.count()) + ' спроб');
    // спроба стоїть перед текстом розділу
    const placed = await page.evaluate(sec => {
      const h = [...document.querySelectorAll('.lesson h2')].find(x => x.textContent.trim() === sec);
      const a = document.querySelector('.mvp-attempt');
      if (!h || !a) return false;
      let n = h.nextElementSibling; while (n && n.classList.contains('sec-illo')) n = n.nextElementSibling;
      return n === a;
    }, L1.attempts[0].before);
    R.check('1.lesson.attempt-before-text', placed, 'перед розділом «' + L1.attempts[0].before + '»');
    await attempts.first().locator('.mvp-opt').first().click();
    await expectFb3(R, '1.lesson.attempt-fb3', attempts.first().locator('.fb3'));
    // пауза в кінці розділу: лише після прокрутки і не раніше ніж за 4 с
    await page.waitForTimeout(300);
    const secWithRule = L1.rules.find(r => r.section).section;
    await page.evaluate(sec => {
      const h = [...document.querySelectorAll('.lesson h2')].find(x => x.textContent.trim() === sec);
      let n = h.nextElementSibling; while (n && n.nextElementSibling && n.nextElementSibling.tagName !== 'H2') n = n.nextElementSibling;
      window.scrollTo(0, window.scrollY + 50);
      n.scrollIntoView({ block: 'center' });
    }, secWithRule);
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(900);
    const drawer = page.locator('.mvp-pop.mvp-drawer');
    R.check('1.popup.section-pause', await drawer.count() === 1, 'після прокрутки до кінця розділу «' + secWithRule + '»');
    if (await drawer.count()) {
      R.check('1.popup.non-modal', await page.evaluate(() => !document.querySelector('.mvp-pop[aria-modal="true"]') && document.querySelector('.mvp-pop').getAttribute('role') !== 'dialog'));
      R.check('1.popup.skip-visible', await drawer.locator('.mvp-skip').isVisible());
      await drawer.locator('.mvp-skip').click();
      await page.waitForTimeout(300);
      R.check('1.popup.closed', await page.locator('.mvp-pop').count() === 0);
    }
    // термін
    const term = page.locator('button.term').first();
    if (await term.count()) {
      await term.scrollIntoViewIfNeeded(); await term.click();
      R.check('1.term.tip', await page.locator('.term-tip').isVisible());
      await page.keyboard.press('Escape');
      R.check('1.term.focus-returns', await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('term')));
    } else R.fail('1.term.tip', 'на сторінці немає терміна');
    // «Ви зупинились на…» — плашка в тексті після повернення
    await page.evaluate(() => { const hs = document.querySelectorAll('.lesson h2'); hs[3].scrollIntoView(); });
    await page.mouse.wheel(0, 60); await page.waitForTimeout(1500);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.goto(base + '/urok-01.html');
    await page.waitForTimeout(400);
    const res = page.locator('.mvp-resume');
    R.check('1.lesson.resume-banner', await res.count() === 1 && (await res.textContent()).includes('Ви зупинились на розділі'), (await res.count()) ? (await res.textContent()).slice(0, 80) : '');
    R.check('1.lesson.console', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  // Віха дня і ціль на дзвінки; «Чи вийшло?» при наступному вході
  {
    const tests = {}; [1, 2, 3].forEach(n => { tests[n] = { tries: {}, test: { passed: true, pct: 100 } }; });
    const { page, ctx, errors } = await openPage(browser, base + '/den-01.html', { state: stateWith({ lessons: tests }) });
    const ms = page.locator('.mvp-milestone');
    R.check('1.day.milestone', await ms.count() === 1);
    const opt = page.locator('.mvp-goal-opt').first();
    R.check('1.goal.picker', await opt.count() === 1);
    await opt.click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ikorka-mvp')).goal);
    R.check('1.goal.saved', saved && /^\d+\.\d$/.test(saved.code), JSON.stringify(saved));
    R.check('1.day.console', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  {
    // наступний вхід: ціль, обрана вчора → «Чи вийшло?»
    const { page, ctx, errors } = await openPage(browser, base + '/index.html', { state: stateWith({ goal: { code: '1.1', day: 1, set: YESTERDAY, answered: null } }) });
    const gc = page.locator('.mvp-goalcheck');
    R.check('1.goal.check-on-entry', await gc.count() === 1);
    await gc.locator('[data-goal="частково"]').click();
    const g2 = await page.evaluate(() => JSON.parse(localStorage.getItem('ikorka-mvp')).goal);
    R.check('1.goal.answered', g2.answered === 'частково');
    R.check('1.goal.console', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
}

// ---------------- Зріз 2: закріплення ----------------
async function slice2(browser, base, R) {
  const L1 = lessonN(1);
  const pairsGood = L1.pairs.filter(p => p.good);
  const total = L1.quiz.length + L1.quotes.length + Math.min(3, pairsGood.length);
  // Пари «Типові помилки → Як правильно»: спершу вибір, потім розкриття
  {
    const { page, ctx, errors } = await openPage(browser, base + '/urok-01.html');
    const pairs = page.locator('.mvp-pair');
    R.check('2.pairs.interactive', await pairs.count() === pairsGood.length, (await pairs.count()) + ' карток із вибором');
    const first = pairs.first();
    await first.scrollIntoViewIfNeeded();
    R.check('2.pairs.choice-before-reveal', await first.locator('.fb3').count() === 0 && await first.locator('.is-correct').count() === 0, 'до вибору правильна відповідь схована');
    await answer(page, first, false);
    await expectFb3(R, '2.pairs.fb3', first.locator('.fb3'));
    R.check('2.pairs.reveal-after-choice', await first.locator('.is-correct').count() === 1);
    // Перевірка уроку: самооцінка → неправильна відповідь → повтор → результат, поріг, порівняння
    const test = page.locator('.mvp-test');
    const staticVisible = await page.evaluate(() => {
      const h = [...document.querySelectorAll('.lesson h2')].find(x => x.textContent.trim() === 'Перевір себе');
      let n = h.nextElementSibling, vis = 0;
      while (n && n.tagName !== 'H2') { if (!n.classList.contains('mvp-test') && !n.classList.contains('sec-illo') && getComputedStyle(n).display !== 'none') vis++; n = n.nextElementSibling; }
      return vis;
    });
    R.check('2.test.replaces-static', staticVisible === 0 && await test.count() === 1, 'статичний блок «Перевір себе» схований, інтерактивний — один');
    await test.scrollIntoViewIfNeeded();
    R.check('2.test.confidence-first', await test.locator('[data-conf]').count() === 5, 'перед тестом «Наскільки впевнені (1–5)?»');
    await click(page, test.locator('[data-conf="3"]'));
    const { id: wrongId } = await answer(page, test, false);
    await expectFb3(R, '2.test.fb3-on-wrong', test.locator('.mvp-q.answered .fb3'));
    await click(page, test.locator('.mvp-next-q'));
    let sawRepeat = false, guard = 0, fb3ok = true;
    while (await test.locator('.mvp-result').count() === 0 && guard++ < 40) {
      if (/Повтор/.test(await test.locator('.mvp-progress').textContent())) sawRepeat = true;
      await answer(page, test, true);
      const p = await fb3Parts(test.locator('.mvp-q.answered .fb3'));
      if (!(p.said && p.why && p.instead)) fb3ok = false;
      await click(page, test.locator('.mvp-next-q'));
    }
    R.check('2.test.fb3-every-answer', fb3ok, 'розбір у три частини після кожної відповіді');
    R.check('2.test.wrong-repeated', sawRepeat, 'питання з помилкою повернулося з позначкою «Повтор»');
    const pct = Math.round((total - 1) / total * 100);
    const resTxt = norm(await test.locator('.mvp-result').textContent());
    R.check('2.test.result', resTxt.includes(pct + '%'), resTxt);
    const cmp = test.locator('.mvp-compare');
    R.check('2.test.self-assessment-compare', await cmp.count() === 1 && /3\/5/.test(await cmp.textContent()) && (await cmp.evaluate(e => e.getClientRects().length)) >= 1, norm(await cmp.textContent()));
    const st = await readState(page);
    R.check('2.test.threshold-80', st.lessons['1'].test.passed === (pct >= 80) && st.lessons['1'].test.conf === 3, `результат ${pct}%, зараховано: ${st.lessons['1'].test.passed}`);
    R.check('2.test.items-to-review', Object.keys(st.review).length >= total && st.review[wrongId].lapses === 1, `карток у повторенні ${Object.keys(st.review).length}, помилкова позначена слабкою`);
    // пригадування відкритих питань (самооцінка)
    const recall = test.locator('.mvp-open .mvp-q').first();
    if (await recall.count()) {
      await click(page, recall.locator('button', { hasText: 'Показати еталон' }));
      R.check('2.test.open-recall', await recall.locator('.mvp-reveal').count() === 1);
      await click(page, recall.locator('button', { hasText: 'Не знав' }));
      const st2 = await readState(page);
      R.check('2.test.open-recall-weak', (st2.review[L1.open[0].id] || {}).lapses >= 1);
    }
    R.check('2.test.console', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  // Поріг: усі відповіді з першої спроби неправильні → урок не зараховано
  {
    const { page, ctx, errors } = await openPage(browser, base + '/urok-01.html');
    const test = page.locator('.mvp-test');
    await test.scrollIntoViewIfNeeded();
    await click(page, test.locator('[data-conf="5"]'));
    let guard = 0;
    while (await test.locator('.mvp-result').count() === 0 && guard++ < 40) {
      const repeat = /Повтор/.test(await test.locator('.mvp-progress').textContent());
      await answer(page, test, repeat);
      await click(page, test.locator('.mvp-next-q'));
    }
    const res = test.locator('.mvp-result');
    R.check('2.test.below-threshold', await res.evaluate(e => e.classList.contains('no')), norm(await res.textContent()));
    R.check('2.test.weak-rules-card', await test.locator('.mvp-weak li').count() >= 1, (await test.locator('.mvp-weak li').count()) + ' правил до повторення');
    R.check('2.test.overconfidence', /впевненість вища/.test(await test.locator('.mvp-compare').textContent()));
    const st = await readState(page);
    R.check('2.test.not-passed', st.lessons['1'].test.passed === false);
    R.check('2.test2.console', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  // «Повторення»: ліміт 5 на день, інтервали 1/3/7/14, слабкі — частіше і першими
  {
    const now = Date.now(), DAY = 864e5;
    const review = {};
    const ids = [...L1.quiz.map(q => q.id), ...L1.quotes.map(c => c.id), ...pairsGood.slice(0, 4).map(p => p.id)];
    ids.forEach((id, i) => { review[id] = { step: 0, due: now - DAY, lapses: 0, added: now - 3 * DAY }; });
    review[ids[0]] = { step: 2, due: now - 3 * DAY, lapses: 2, added: now - 20 * DAY }; // слабка: має йти першою, інтервал удвічі коротший
    review[ids[1]] = { step: 2, due: now - 5 * DAY, lapses: 0, added: now - 20 * DAY };  // звичайна, крок 3 → 7 днів
    const { page, ctx, errors } = await openPage(browser, base + '/povtorennia.html', { state: stateWith({ review }) });
    const prog = page.locator('.mvp-review .mvp-progress');
    R.check('2.review.limit-5', /Картка 1 з 5/.test(await prog.textContent()), `${ids.length} карток на черзі, показано: ${await prog.textContent()}`);
    const firstId = await page.locator('.mvp-review .mvp-q[data-item]').first().getAttribute('data-item');
    R.check('2.review.weak-first', firstId === ids[0], firstId);
    await answer(page, page.locator('.mvp-review'), true);
    await expectFb3(R, '2.review.fb3', page.locator('.mvp-review .fb3'));
    await click(page, page.locator('.mvp-review .mvp-review-body > .mvp-q > .mvp-btn.primary'));
    let st = await readState(page);
    const days = id => Math.round((st.review[id].due - Date.now()) / DAY);
    R.check('2.review.weak-interval-halved', days(ids[0]) === 4, `слабка картка (2 помилки, крок 7 днів) → через ${days(ids[0])} дн.`);
    R.check('2.review.next', /Картка 2 з 5/.test(await prog.textContent()), await prog.textContent());
    await answer(page, page.locator('.mvp-review'), true);
    await click(page, page.locator('.mvp-review .mvp-review-body > .mvp-q > .mvp-btn.primary'));
    st = await readState(page);
    R.check('2.review.interval-7', days(ids[1]) === 7, `крок 3 → через ${days(ids[1])} дн.`);
    const thirdId = await page.locator('.mvp-review .mvp-q[data-item]').first().getAttribute('data-item');
    await answer(page, page.locator('.mvp-review'), false);
    await click(page, page.locator('.mvp-review .mvp-review-body > .mvp-q > .mvp-btn.primary'));
    st = await readState(page);
    R.check('2.review.wrong-tomorrow', days(thirdId) === 1 && st.review[thirdId].lapses === 1 && st.review[thirdId].step === 0, `помилка → завтра (${days(thirdId)} дн.)`);
    for (let k = 0; k < 2; k++) { await answer(page, page.locator('.mvp-review'), true); await click(page, page.locator('.mvp-review .mvp-review-body > .mvp-q > .mvp-btn.primary')); }
    R.check('2.review.done-after-5', await page.locator('.mvp-review .rv-done').count() === 1, 'після 5 карток — «На сьогодні все», хоча на черзі ще ' + (ids.length - 5));
    // інтервали 1 → 3 → 7 → 14 для нової картки
    const seq = await page.evaluate(() => {
      const M = window.MVP, id = '1-q1', out = [];
      delete M.st.review[id]; M.st.daily = {};
      M.rvAdd(id, false);
      for (let i = 0; i < 5; i++) { M.rvGrade(id, true); out.push(Math.round((M.st.review[id].due - Date.now()) / M.DAY)); }
      return out;
    });
    R.check('2.review.intervals-1-3-7-14', seq.join(',') === '1,3,7,14,14', seq.join(' → ') + ' дн.');
    R.check('2.review.console', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
  // Особиста колода: попередження про персональні дані, маскування цифр, збереження
  {
    const { page, ctx, errors } = await openPage(browser, base + '/povtorennia.html');
    R.check('2.deck.pii-warning', await page.locator('.mvp-deck .mvp-pii').isVisible());
    await page.fill('#deck-text', 'Клієнтка сказала «дорого, минулого разу було дешевше», номер замовлення 12-34-56-78');
    await click(page, page.locator('.mvp-deck button[type="submit"]'));
    const st = await readState(page);
    const saved = (st.deck[0] || {}).text || '';
    R.check('2.deck.saved-masked', saved.includes('***') && !/12-34/.test(saved), saved);
    R.check('2.deck.in-review', !!st.review[(st.deck[0] || {}).id], 'картка потрапила в повторення (завтра)');
    R.check('2.deck.list', await page.locator('.deck-list li').count() === 1);
    await click(page, page.locator('.deck-list li button'));
    R.check('2.deck.delete', (await readState(page)).deck.length === 0);
    R.check('2.deck.console', errors.length === 0, errors.join(' | '));
    await ctx.close();
  }
}

const SLICES = { 1: slice1, 2: slice2 };

(async () => {
  const srv = await startServer({ port: 4173 + Math.floor(Math.random() * 500) });
  const browser = await launch();
  const R = new Results('e2e' + (want.length ? '-' + want.join('-') : ''));
  try {
    for (const [n, fn] of Object.entries(SLICES)) {
      if (!run(+n)) continue;
      console.log(`\n== Зріз ${n} ==`);
      try { await fn(browser, srv.url, R); } catch (e) { R.fail(`slice${n}.crash`, e.stack || e.message); }
    }
  } finally {
    await browser.close(); srv.close();
  }
  const f = R.save(OUT);
  console.log(`\nРАЗОМ: ${R.items.length - R.failed.length} ok, ${R.failed.length} fail → ${path.relative(process.cwd(), f)}`);
  process.exit(R.failed.length ? 1 : 0);
})();
