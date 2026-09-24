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

const SLICES = { 1: slice1 };

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
