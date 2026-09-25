#!/usr/bin/env node
// Ніч 3 · зріз 1: акаунти, ролі, прогрес у Supabase.
// Клієнтський supabase-js — той самий вендорний файл v2/build/assets/vendor/supabase-js.js, що й у
// продакшні (не CDN — див. README в тій самій теці), тест і прод завантажують один і той самий файл.
// Мок GoTrue+PostgREST — v2/mvp/tests/mock-supabase.mjs. ЖИВА перевірка проти справжнього проєкту
// Supabase тут НЕ проводиться, див. v2/mvp/SUPABASE_SETUP.md.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { launch, noHorizontalScroll, popupsOnLoad, Results, V2, SITE } from './lib.mjs';
import { startMockSupabase } from './mock-supabase.mjs';

const R = new Results('account-e2e');

// Той самий набір захистів консолі, що й openPage з lib.mjs.
async function openAccountPage(browser, url, { width = 1280, height = 900, theme = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /googleapis/.test(r.request().url()) ? 'text/css' : 'font/woff2', body: '' }));
  await ctx.addInitScript(th => { try { if (!sessionStorage.getItem('__init')) { sessionStorage.setItem('__init', '1'); localStorage.setItem('ikorka-theme', th); } } catch (e) { /* */ } }, theme);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  // gotrue-js навмисно не чекає мережевого /auth/v1/logout — локальний вихід відбувається одразу
  // (щоб працював і без мережі), а запит іноді скасовується (ERR_ABORTED); це поведінка самої
  // бібліотеки з будь-яким бекендом (мок чи справжній Supabase), не помилка нашого коду.
  page.on('requestfailed', r => { const u = r.url(); if (!/fonts\.(googleapis|gstatic)|\/auth\/v1\/logout/.test(u)) errors.push('requestfailed: ' + u + ' ' + (r.failure() || {}).errorText); });
  await page.goto(url, { waitUntil: 'load' });
  return { page, ctx, errors };
}

function buildWith(env) {
  execFileSync(process.execPath, [path.join(V2, 'build', 'build.mjs')], { cwd: path.resolve(V2, '..'), env: { ...process.env, ...env }, stdio: 'pipe' });
}
function serveStatic(port) {
  return import('./lib.mjs').then(m => m.startServer({ port, env: { STATIC_ONLY: '1' } }));
}
const readLocal = page => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('ikorka-mvp')); } catch (e) { return null; } });
const uniq = () => 'test' + Date.now() + Math.floor(Math.random() * 1e6) + '@example.test';

async function main() {
  // 0. Регресія без конфігурації: жодних слідів акаунтів на сайті
  buildWith({ SUPABASE_URL: '', SUPABASE_ANON_KEY: '' });
  R.check('0.no-config.account-html-absent', !fs.existsSync(path.join(SITE, 'account.html')));
  R.check('0.no-config.widget-absent-in-html', !fs.readFileSync(path.join(SITE, 'index.html'), 'utf8').includes('acct-widget'));
  R.check('0.no-config.no-supabase-script', !fs.readFileSync(path.join(SITE, 'index.html'), 'utf8').includes('supabase'));

  // Далі — з увімкненими акаунтами проти мок-Supabase
  const mock = await startMockSupabase();
  buildWith({ SUPABASE_URL: mock.url, SUPABASE_ANON_KEY: mock.anonKey });
  // Вузький діапазон навмисно: 4900+400 зачіпає 5060/5061 (SIP) — «небезпечні» порти, які Chromium
  // відмовляється відкривати (net::ERR_UNSAFE_PORT), зрідка ловили це в випадковому виборі порту.
  const srv = await serveStatic(4900 + Math.floor(Math.random() * 100));
  const browser = await launch();
  try {
    const email = uniq(), pass = 'test-pass-123';

    // 1. Публічної реєстрації немає: на account.html лише форма входу, ні вкладки, ні форми «up»
    {
      const { page, ctx, errors } = await openAccountPage(browser, srv.url + '/account.html');
      R.check('1.account.no-popup-on-load', (await popupsOnLoad(page, 1500)).length === 0);
      R.check('1.no-public-signup.no-tabs', await page.locator('.acct-tabs').count() === 0);
      R.check('1.no-public-signup.no-signup-form', await page.locator('#acct-email-up, [data-pane="up"]').count() === 0);
      R.check('1.no-public-signup.invite-hint', /лише за запрошенням/.test(await page.locator('#account-app').textContent()));
      R.check('1.account.console', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // 1б. Запрошення керівником → лист із посиланням → новачок встановлює пароль (подія PASSWORD_RECOVERY)
    {
      const invite = mock.inviteUser(email);
      const hash = `#access_token=${invite.access_token}&refresh_token=${invite.refresh_token}&expires_in=3600&token_type=bearer&type=invite`;
      const { page, ctx, errors } = await openAccountPage(browser, srv.url + '/account.html' + hash);
      await page.waitForSelector('.acct-pane[data-pane="setpass"]', { timeout: 8000 });
      R.check('1b.invite.set-password-form-shown', true);
      await page.fill('#acct-pass-new', pass);
      await page.click('[data-pane="setpass"] button[type="submit"]');
      await page.waitForSelector('.acct-signout', { timeout: 8000 });
      R.check('1b.invite.password-set-in-mock', mock._users.get(email).password === pass);
      R.check('1b.invite.shows-account', /новачок/.test(await page.locator('#account-app').textContent()));
      R.check('1b.invite.profile-role-newbie', mock._profiles.get(mock._users.get(email).id).role === 'newbie');
      R.check('1b.invite.console', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // 1в. Тепер той самий пароль працює для звичайного входу
    {
      const { page, ctx, errors } = await openAccountPage(browser, srv.url + '/account.html');
      await page.fill('#acct-email-in', email);
      await page.fill('#acct-pass-in', pass);
      await page.click('[data-pane="in"] button[type="submit"]');
      // до цього моменту в хмарі вже може бути порожній рядок прогресу (фоновий reconcile() під час
      // кроку 1б) — auto-reconcile тут теж здатен перезавантажити сторінку; waitForFunction (а не разовий
      // textContent()) сам переживає таку навігацію.
      const signedIn = await page.waitForFunction(re => { var el = document.querySelector('#acct-widget'); return !!(el && new RegExp(re).test(el.textContent)); }, email.split('@')[0], { timeout: 12000 }).then(() => true).catch(() => false);
      R.check('1c.signin-after-invite.works', signedIn);
      R.check('1c.signin-after-invite.console', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // 2. Прогрес: локальні зміни → push у хмару (через window.ACCOUNT.pushProgress, без очікування таймера)
    // Контекст «пристрою А» лишається відкритим — крок 3 продовжує з нього ж (той самий локальний стан).
    let devA;
    {
      const { page, ctx, errors } = await openAccountPage(browser, srv.url + '/account.html');
      await page.fill('#acct-email-in', email);
      await page.fill('#acct-pass-in', pass);
      // до цього моменту в хмарі вже може бути порожній рядок прогресу (його міг створити фоновий
      // reconcile() під час кроку 1б) — тоді auto-reconcile після входу тут теж здатен перезавантажити
      // сторінку (розбіжність хоча б у полі created), тож так само чекаємо навігацію явно.
      const navP = page.waitForNavigation({ timeout: 10000 }).catch(() => null);
      await page.click('[data-pane="in"] button[type="submit"]');
      await navP;
      await page.waitForSelector('.acct-signout', { timeout: 8000 });
      await page.evaluate(() => { window.MVP.st.lessons = { 1: { tries: {}, test: { passed: true, pct: 100 } } }; window.MVP.save(); });
      await page.evaluate(() => window.ACCOUNT.pushProgress());
      await page.waitForFunction(() => /Прогрес синхронізовано/.test(document.querySelector('.acct-sync-line').textContent), { timeout: 5000 });
      const u = mock._users.get(email);
      const row = mock._progress.get(u.id);
      R.check('2.push.saved-to-cloud', !!row && row.state.lessons['1'].test.pct === 100 && row.rev >= 1, JSON.stringify(row && row.rev));
      R.check('2.push.console', errors.length === 0, errors.join(' | '));
      devA = { page, ctx, errors };
    }

    // 3. Два пристрої, розбіжний прогрес → злиття (union), а не «останній перезаписав усе»
    let devB;
    {
      // пристрій Б: свіжий контекст (порожній локальний стан) того самого акаунта
      const { page, ctx, errors } = await openAccountPage(browser, srv.url + '/account.html');
      await page.fill('#acct-email-in', email);
      await page.fill('#acct-pass-in', pass);
      // злиття (auto-reconcile після входу) підтягує прогрес пристрою А і перезавантажує сторінку
      // (reloadOnce у account.js) — чекаємо саме цю навігацію, а не просто зміну localStorage, інакше
      // наступний evaluate() падає з «execution context was destroyed» посеред перезавантаження.
      const navP = page.waitForNavigation({ timeout: 10000 }).catch(() => null);
      await page.click('[data-pane="in"] button[type="submit"]');
      await navP;
      await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('ikorka-mvp')).lessons['1'].test.pct === 100; } catch (e) { return false; } }, { timeout: 8000 });
      R.check('3.merge.device-b-inherits-device-a', true, 'пристрій Б підтягнув прогрес уроку 1 від пристрою А');
      // на пристрої Б проходимо ІНШИЙ урок, поки пристрій А про це не знає — типова розбіжність
      await page.waitForSelector('.acct-signout', { timeout: 8000 }); // сторінка вже переініціалізувалась після reload
      // після reload сторінка сама одразу запускає ще один reconcile() (getSession → startPolling+reconcile) —
      // даємо йому завершитись, інакше його фоновий upsert інколи гониться з нашим явним pushProgress()
      // нижче за той самий рядок у моку й одна з двох мережевих вимог падає з ERR_ABORTED (гонитва тесту,
      // не помилка коду).
      await page.waitForFunction(() => /Прогрес синхронізовано/.test((document.querySelector('.acct-sync-line') || {}).textContent || ''), { timeout: 5000 }).catch(() => {});
      await page.evaluate(() => { window.MVP.st.lessons['2'] = { tries: {}, test: { passed: true, pct: 90 } }; window.MVP.save(); });
      await page.evaluate(() => window.ACCOUNT.pushProgress());
      await page.waitForFunction(() => /Прогрес синхронізовано/.test(document.querySelector('.acct-sync-line').textContent), { timeout: 5000 });
      R.check('3.merge.device-b-console', errors.length === 0, errors.join(' | '));
      devB = { page, ctx };
    }
    {
      // пристрій А (та сама вкладка з кроку 2, ще залогинена) синхронізується знову — має отримати
      // урок 2 від Б, не втративши свій урок 1. reconcile() не await-имо напряму (виклик, що зрештою
      // викликає location.reload(), інакше evaluate() падає з «execution context was destroyed»
      // посеред навігації) — лише «штовхаємо» і чекаємо саму навігацію окремо.
      const { page, ctx, errors } = devA;
      const navP = page.waitForNavigation({ timeout: 10000 }).catch(() => null);
      await page.evaluate(() => { window.ACCOUNT.reconcile(); });
      await navP;
      await page.waitForFunction(() => { try { const l = JSON.parse(localStorage.getItem('ikorka-mvp')).lessons; return l['1'] && l['1'].test.pct === 100 && l['2'] && l['2'].test.pct === 90; } catch (e) { return false; } }, { timeout: 8000 });
      R.check('3.merge.union-both-lessons-present', true, 'пристрій А після злиття має і урок 1 (своє), і урок 2 (від пристрою Б) — union, а не перезапис');
      R.check('3.merge.device-a-console', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
    await devB.ctx.close();
    {
      // одиничний тест самої функції злиття (без мережі): «max по кожному уроку», а не заміна цілком
      const { page, ctx, errors } = await openAccountPage(browser, srv.url + '/account.html');
      const result = await page.evaluate(() => {
        var a = { lessons: { 1: { tries: { 'q1': { ok: true, t: 10 } }, test: { passed: false, pct: 60, runs: 1, t: 10 } }, 3: { tries: {}, test: { passed: true, pct: 100, runs: 1, t: 5 } } }, review: { c1: { step: 1, due: 100, lapses: 2, added: 1 } }, days: { d1: true }, deck: [{ id: 'x1', text: 'a', t: 1 }], final: [], goals: [], sim: {}, daily: {}, pos: {}, sections: {} };
        var b = { lessons: { 1: { tries: { 'q1': { ok: false, t: 5 } }, test: { passed: true, pct: 90, runs: 3, t: 20 } }, 2: { tries: {}, test: { passed: true, pct: 80, runs: 1, t: 7 } } }, review: { c1: { step: 3, due: 50, lapses: 1, added: 2 }, c2: { step: 0, due: 1, lapses: 0, added: 1 } }, days: { d2: true }, deck: [{ id: 'x2', text: 'b', t: 2 }], final: [], goals: [], sim: {}, daily: {}, pos: {}, sections: {} };
        var m = window.ACCOUNT_MERGE(a, b);
        return { lesson1: m.lessons[1].test, lesson2Present: !!m.lessons[2], lesson3Present: !!m.lessons[3], q1: m.lessons[1].tries.q1, review: m.review.c1, c2Present: !!m.review.c2, days: Object.keys(m.days).sort(), deckIds: m.deck.map(function (d) { return d.id; }).sort() };
      });
      R.check('3.merge-unit.lesson1-max-pct-and-passed-or', result.lesson1.pct === 90 && result.lesson1.passed === true && result.lesson1.runs === 3, JSON.stringify(result.lesson1));
      R.check('3.merge-unit.tries-newer-wins', result.q1.ok === true, JSON.stringify(result.q1));
      R.check('3.merge-unit.union-lessons-2-and-3-kept', result.lesson2Present && result.lesson3Present);
      R.check('3.merge-unit.review-due-step-lapses-max', result.review.due === 100 && result.review.step === 3 && result.review.lapses === 2 && result.review.added === 1, JSON.stringify(result.review));
      R.check('3.merge-unit.review-union-card2', result.c2Present);
      R.check('3.merge-unit.days-union', result.days.length === 2, result.days.join(','));
      R.check('3.merge-unit.deck-union', result.deckIds.length === 2, result.deckIds.join(','));
      R.check('3.merge-unit.console', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // 4. Роль «керівник» відображається на сторінці акаунта
    {
      mock.setRole(email, 'mentor');
      const { page, ctx, errors } = await openAccountPage(browser, srv.url + '/account.html');
      await page.fill('#acct-email-in', email);
      await page.fill('#acct-pass-in', pass);
      await page.click('[data-pane="in"] button[type="submit"]');
      // свіжий контекст без локального стану — auto-reconcile після входу підтягує хмарний прогрес і
      // перезавантажує сторінку, а вона може реініціалізуватись і зробити ще один reconcile (як у кроці
      // 3). waitForFunction (на відміну від разового textContent()) сам переживає навігацію й перечитує
      // DOM у новому контексті сторінки, тож не гониться з можливим другим reload.
      const mentorShown = await page.waitForFunction(() => { var el = document.querySelector('#account-app'); return !!(el && /керівник/.test(el.textContent)); }, { timeout: 12000 }).then(() => true).catch(() => false);
      R.check('4.role.mentor-shown', mentorShown);
      const widgetShown = await page.waitForFunction(() => { var el = document.querySelector('#acct-widget'); return !!(el && /керівник/.test(el.textContent)); }, { timeout: 5000 }).then(() => true).catch(() => false);
      R.check('4.role.widget-badge', widgetShown);
      // дати фоновому reconcile() (запущеному одразу після відновлення сесії) завершити свій upsert,
      // інакше закриття контексту абортує запит у польоті — не помилка коду, а гонитва самого тесту.
      await page.waitForFunction(() => /Прогрес синхронізовано/.test((document.querySelector('.acct-sync-line') || {}).textContent || ''), { timeout: 5000 }).catch(() => {});
      R.check('4.role.console', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // 5. Невірний пароль — читана помилка, без падіння консолі
    {
      const { page, ctx, errors } = await openAccountPage(browser, srv.url + '/account.html');
      await page.fill('#acct-email-in', email);
      await page.fill('#acct-pass-in', 'wrong-password');
      await page.click('[data-pane="in"] button[type="submit"]');
      await page.waitForFunction(() => /Невірна пошта або пароль/.test(document.querySelector('[data-pane="in"] .acct-msg').textContent), { timeout: 5000 });
      R.check('5.wrong-password.message', true);
      // тут навмисно провокуємо 400 від мок-сервера — не рахуємо його як помилку консолі
      await ctx.close();
    }

    // 6. Гість (не залогинений): віджет пропонує «Увійти», курс лишається доступним і без гориз. прокрутки
    {
      const { page, ctx, errors } = await openAccountPage(browser, srv.url + '/urok-01.html', { width: 375, height: 800 });
      R.check('6.guest.widget-login-link', /Увійти/.test(await page.locator('#acct-widget').textContent()));
      R.check('6.guest.lesson-works', await page.locator('.mvp-rules-card .mvp-rules li').count() >= 3);
      R.check('6.guest.no-hscroll', (await noHorizontalScroll(page)).ok);
      R.check('6.guest.console', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // 7. Вихід: віджет повертається до «Увійти», локальний прогрес не стирається
    {
      const { page, ctx, errors } = await openAccountPage(browser, srv.url + '/account.html');
      await page.fill('#acct-email-in', email);
      await page.fill('#acct-pass-in', pass);
      // свіжий контекст без локального стану — auto-reconcile після входу перезавантажує сторінку
      // (як у кроках 3 і 4), тож чекаємо навігацію перед читанням localStorage.
      const navP = page.waitForNavigation({ timeout: 10000 }).catch(() => null);
      await page.click('[data-pane="in"] button[type="submit"]');
      await navP;
      await page.waitForSelector('.acct-signout', { timeout: 8000 });
      const before = await readLocal(page);
      await page.click('.acct-signout');
      await page.waitForFunction(() => /Увійти/.test(document.querySelector('#acct-widget').textContent), { timeout: 5000 });
      const after = await readLocal(page);
      R.check('7.signout.widget-resets', true);
      R.check('7.signout.local-progress-kept', after && before && after.lessons && after.lessons['1'] && after.lessons['1'].test.pct === before.lessons['1'].test.pct);
      await page.waitForTimeout(400); // дати запиту /auth/v1/logout завершитись, перш ніж закривати контекст
      R.check('7.signout.console', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
  } finally {
    await browser.close(); srv.close(); mock.close();
    // повернути репозиторій у стан без конфігурації Supabase (звичайний деліверабл)
    buildWith({ SUPABASE_URL: '', SUPABASE_ANON_KEY: '' });
  }
}

await main();
const f = R.save(path.join(V2, 'mvp', 'tests', 'results'));
console.log(`\nРАЗОМ: ${R.items.length - R.failed.length} ok, ${R.failed.length} fail → ${path.relative(process.cwd(), f)}`);
console.log('Увага: перевірено проти НАБЛИЖЕНОГО мока Supabase (GoTrue+PostgREST), не проти живого проєкту.');
process.exit(R.failed.length ? 1 : 0);
