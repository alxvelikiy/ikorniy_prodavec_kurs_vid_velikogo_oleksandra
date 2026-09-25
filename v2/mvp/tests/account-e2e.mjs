#!/usr/bin/env node
// Ніч 3 · зріз 1: акаунти, ролі, прогрес у Supabase.
// Мережевий запит на реальний cdn.jsdelivr.net заборонено політикою цього середовища (403 на проксі,
// v2/mvp/tests/mock-supabase.mjs — коментар угорі), тому клієнтський supabase-js встановлено локально
// (npm i @supabase/supabase-js — registry.npmjs.org у білому списку) і CDN-запит у браузері підміняється
// на локальний файл через Playwright-роут. Це наближений мок GoTrue+PostgREST, а не сам Supabase —
// ЖИВА перевірка проти справжнього проєкту тут НЕ проводиться, див. v2/mvp/SUPABASE_SETUP.md.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { launch, noHorizontalScroll, popupsOnLoad, Results, V2, SITE, CHROME } from './lib.mjs';
import { startMockSupabase } from './mock-supabase.mjs';

const require = createRequire(import.meta.url);
const UMD_PATH = require.resolve('@supabase/supabase-js/dist/umd/supabase.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = new Results('account-e2e');

// Сторінка з підміною CDN на локальний supabase-js і тим самим набором захистів консолі, що й openPage.
async function openAccountPage(browser, url, { width = 1280, height = 900, theme = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: /googleapis/.test(r.request().url()) ? 'text/css' : 'font/woff2', body: '' }));
  await ctx.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', r => r.fulfill({ status: 200, contentType: 'text/javascript', path: UMD_PATH }));
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
  const srv = await serveStatic(4900 + Math.floor(Math.random() * 400));
  const browser = await launch();
  try {
    const email = uniq(), pass = 'test-pass-123';

    // 1. Реєстрація на account.html → з'являється профіль з роллю «новачок», віджет показує пошту
    {
      const { page, ctx, errors } = await openAccountPage(browser, srv.url + '/account.html');
      R.check('1.account.no-popup-on-load', (await popupsOnLoad(page, 1500)).length === 0);
      await page.click('[data-tab="up"]');
      await page.fill('#acct-email-up', email);
      await page.fill('#acct-pass-up', pass);
      await page.click('[data-pane="up"] button[type="submit"]');
      await page.waitForSelector('.acct-signout', { timeout: 8000 });
      R.check('1.signup.shows-account', /новачок/.test(await page.locator('#account-app').textContent()));
      R.check('1.signup.widget-shows-email', new RegExp(email.split('@')[0]).test(await page.locator('#acct-widget').textContent()));
      const u = mock._users.get(email);
      R.check('1.signup.profile-created', !!u && mock._profiles.get(u.id) && mock._profiles.get(u.id).role === 'newbie', JSON.stringify(u && mock._profiles.get(u.id)));
      R.check('1.account.console', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // 2. Прогрес: локальні зміни → push у хмару (через window.ACCOUNT.pushProgress, без очікування таймера)
    {
      const { page, ctx, errors } = await openAccountPage(browser, srv.url + '/account.html');
      await page.click('[data-tab="in"]');
      await page.fill('#acct-email-in', email);
      await page.fill('#acct-pass-in', pass);
      await page.click('[data-pane="in"] button[type="submit"]');
      await page.waitForSelector('.acct-signout', { timeout: 8000 });
      await page.evaluate(() => { window.MVP.st.lessons = { 1: { tries: {}, test: { passed: true, pct: 100 } } }; window.MVP.save(); });
      await page.evaluate(() => window.ACCOUNT.pushProgress());
      await page.waitForFunction(() => /Прогрес синхронізовано/.test(document.querySelector('.acct-sync-line').textContent), { timeout: 5000 });
      const u = mock._users.get(email);
      const row = mock._progress.get(u.id);
      R.check('2.push.saved-to-cloud', !!row && row.state.lessons['1'].test.pct === 100 && row.rev >= 1, JSON.stringify(row && row.rev));
      R.check('2.push.console', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // 3. Інший пристрій (свіжий контекст, порожній локальний стан): вхід підтягує прогрес із хмари
    //    (replaceState + одноразовий reload) — перевіряємо localStorage після синхронізації
    {
      const { page, ctx, errors } = await openAccountPage(browser, srv.url + '/account.html');
      await page.fill('#acct-email-in', email);
      await page.fill('#acct-pass-in', pass);
      await page.click('[data-pane="in"] button[type="submit"]');
      await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem('ikorka-mvp')).lessons['1'].test.pct === 100; } catch (e) { return false; } }, { timeout: 8000 });
      R.check('3.pull.local-updated-from-cloud', true, 'на новому пристрої локальний стан підтягнув прогрес із хмари після входу');
      R.check('3.pull.console', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // 4. Роль «керівник» відображається на сторінці акаунта
    {
      mock.setRole(email, 'mentor');
      const { page, ctx, errors } = await openAccountPage(browser, srv.url + '/account.html');
      await page.fill('#acct-email-in', email);
      await page.fill('#acct-pass-in', pass);
      await page.click('[data-pane="in"] button[type="submit"]');
      await page.waitForSelector('.acct-signout', { timeout: 8000 });
      R.check('4.role.mentor-shown', /керівник/.test(await page.locator('#account-app').textContent()));
      R.check('4.role.widget-badge', /керівник/.test(await page.locator('#acct-widget').textContent()));
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
      await page.click('[data-pane="in"] button[type="submit"]');
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
