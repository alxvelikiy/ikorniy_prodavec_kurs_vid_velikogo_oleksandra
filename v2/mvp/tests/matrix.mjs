#!/usr/bin/env node
// Ф6: повна матриця — кожна сторінка сайту × 375/1280 px × світла/темна тема:
//   нуль помилок консолі; немає горизонтальної прокрутки; жодних спливних вікон при завантаженні (4,5 с без дій);
//   є <main id="main-content">, lang="uk", <title>.
// Плюс: на кожному з 12 уроків розбір кожного типу інтерактиву має три частини.
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch, openPage, noHorizontalScroll, popupsOnLoad, fb3Parts, Results, SITE, V2 } from './lib.mjs';

const R = new Results('matrix');
const pages = fs.readdirSync(SITE).filter(f => f.endsWith('.html')).sort();
const combos = [];
for (const f of pages) for (const width of [375, 1280]) for (const theme of ['light', 'dark']) combos.push({ f, width, theme });

const srv = await startServer({ port: 6200 + Math.floor(Math.random() * 500) });
const browser = await launch();
const failures = [];
let done = 0;
async function check({ f, width, theme }) {
  const { page, ctx, errors } = await openPage(browser, srv.url + '/' + f, { width, height: width < 500 ? 800 : 900, theme });
  try {
    const pops = await popupsOnLoad(page, 4500);
    const hs = await noHorizontalScroll(page);
    const meta = await page.evaluate(() => ({ main: !!document.querySelector('main#main-content'), lang: document.documentElement.lang, title: document.title, theme: document.documentElement.getAttribute('data-theme') || 'light' }));
    const probs = [];
    if (errors.length) probs.push('консоль: ' + errors.slice(0, 2).join(' | '));
    if (!hs.ok) probs.push(`гориз. прокрутка ${hs.over}px (${hs.offenders.join(', ')})`);
    if (pops.length) probs.push('спливне при завантаженні: ' + pops.join(', '));
    if (!meta.main || meta.lang !== 'uk' || !meta.title) probs.push('розмітка: main/lang/title');
    if ((theme === 'dark') !== (meta.theme === 'dark')) probs.push('тема не застосована');
    if (probs.length) failures.push(`${f} · ${width}px · ${theme}: ${probs.join('; ')}`);
  } finally { await ctx.close(); done++; }
}
// 4 паралельні вкладки
const queue = combos.slice();
await Promise.all([0, 1, 2, 3].map(async () => { while (queue.length) await check(queue.shift()); }));
R.check('6.matrix.pages', failures.length === 0, failures.length ? failures.slice(0, 8).join('\n      ') : `${pages.length} сторінок × 2 ширини × 2 теми = ${combos.length} прогонів: консоль чиста, без горизонтальної прокрутки, без спливних вікон при завантаженні`);

// Розбір у три частини на кожному уроці: спроба до пояснення, пара з вибором, перевірка уроку
const T = (() => { const src = fs.readFileSync(path.join(SITE, 'assets', 'trainer-data.js'), 'utf8'); const w = {}; new Function('window', src)(w); return w.TRAINER; })();
const bad = [];
for (const l of T.lessons) {
  const { page, ctx, errors } = await openPage(browser, srv.url + '/' + l.href);
  const kinds = [];
  for (const [kind, sel] of [['спроба', '.mvp-attempt'], ['пара', '.mvp-pair']]) {
    const box = page.locator(sel).first();
    if (!await box.count()) continue;
    await box.scrollIntoViewIfNeeded();
    await box.locator('.mvp-opt').first().click();
    const p = await fb3Parts(box.locator('.fb3'));
    kinds.push(kind);
    if (!(p.said && p.why && p.instead)) bad.push(`урок ${l.n}: ${kind}`);
  }
  const test = page.locator('.mvp-test');
  await test.scrollIntoViewIfNeeded();
  await test.locator('[data-conf="3"]').click();
  let guard = 0;
  while (await test.locator('.mvp-result').count() === 0 && guard++ < 40) {
    await test.locator('.mvp-q:not(.answered) .mvp-opt').first().click();
    const p = await fb3Parts(test.locator('.mvp-q.answered .fb3'));
    if (!(p.said && p.why && p.instead)) bad.push(`урок ${l.n}: перевірка, ${await test.locator('.mvp-q.answered').getAttribute('data-item')}`);
    await test.locator('.mvp-next-q').click();
  }
  kinds.push('перевірка');
  if (errors.length) bad.push(`урок ${l.n}: консоль ${errors[0]}`);
  await ctx.close();
}
R.check('6.fb3.all-lessons', bad.length === 0, bad.length ? bad.slice(0, 6).join(' | ') : '12 уроків: спроби, пари, усі питання перевірки — розбір у три частини');

await browser.close(); srv.close();
const f = R.save(path.join(V2, 'mvp', 'tests', 'results'));
console.log(`\nРАЗОМ: ${R.items.length - R.failed.length} ok, ${R.failed.length} fail → ${path.relative(process.cwd(), f)}`);
process.exit(R.failed.length ? 1 : 0);
